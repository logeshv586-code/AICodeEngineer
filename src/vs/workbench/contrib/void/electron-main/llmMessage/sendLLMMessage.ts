/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { SendLLMMessageParams, OnText, OnFinalMessage, OnError } from '../../common/sendLLMMessageTypes.js';
import { IMetricsService } from '../../common/metricsService.js';
import { displayInfoOfProviderName } from '../../common/voidSettingsTypes.js';
import { sendLLMMessageToProviderImplementation } from './sendLLMMessage.impl.js';
import { encode as toonEncode } from '@toon-format/toon';


export const sendLLMMessage = async ({
	messagesType,
	messages: messages_,
	onText: onText_,
	onFinalMessage: onFinalMessage_,
	onError: onError_,
	abortRef: abortRef_,
	logging: { loggingName, loggingExtras },
	settingsOfProvider,
	modelSelection,
	modelSelectionOptions,
	overridesOfModel,
	chatMode,
	separateSystemMessage,
	mcpTools,
}: SendLLMMessageParams,

	metricsService: IMetricsService
) => {


	const { providerName, modelName } = modelSelection

	// only captures number of messages and message "shape", no actual code, instructions, prompts, etc
	const captureLLMEvent = (eventId: string, extras?: object) => {


		metricsService.capture(eventId, {
			providerName,
			modelName,
			customEndpointURL: settingsOfProvider[providerName]?.endpoint,
			numModelsAtEndpoint: settingsOfProvider[providerName]?.models?.length,
			...messagesType === 'chatMessages' ? {
				numMessages: messages_?.length,
			} : messagesType === 'FIMMessage' ? {
				prefixLength: messages_.prefix.length,
				suffixLength: messages_.suffix.length,
			} : {},
			...loggingExtras,
			...extras,
		})
	}
	const submit_time = new Date()

	let _fullTextSoFar = ''
	let _aborter: (() => void) | null = null
	let _setAborter = (fn: () => void) => { _aborter = fn }
	let _didAbort = false

	const onText: OnText = (params) => {
		const { fullText } = params
		if (_didAbort) return
		onText_(params)
		_fullTextSoFar = fullText
	}

	const onFinalMessage: OnFinalMessage = (params) => {
		const { fullText, fullReasoning, toolCall, finishReason } = params
		if (_didAbort) return
		captureLLMEvent(`${loggingName} - Received Full Message`, { messageLength: fullText.length, reasoningLength: fullReasoning?.length, duration: new Date().getMilliseconds() - submit_time.getMilliseconds(), toolCallName: toolCall?.name, finishReason })
		onFinalMessage_(params)
	}

	const onError: OnError = ({ message: errorMessage, fullError }) => {
		if (_didAbort) return
		console.error('sendLLMMessage onError:', errorMessage)

		// handle failed to fetch errors, which give 0 information by design
		if (errorMessage === 'TypeError: fetch failed')
			errorMessage = `Failed to fetch from ${displayInfoOfProviderName(providerName).title}. This likely means you specified the wrong endpoint in Void's Settings, or your local model provider like Ollama is powered off.`

		const providerTitle = displayInfoOfProviderName(providerName).title
		const isContextOverflow = /context(?: window| length)?|too many tokens|maximum.*tokens|prompt.*(?:long|large)/i.test(errorMessage)
		const errorRecord = fullError as unknown as { status?: unknown, headers?: Record<string, unknown> | { get?: (name: string) => string | null } } | null
		const parsedStatus = Number(errorRecord?.status)
		const status = Number.isInteger(parsedStatus) ? parsedStatus : Number(errorMessage.match(/\b([45]\d\d)\b/)?.[1])
		if (Number.isInteger(status)) {
			const headers = errorRecord?.headers
			const retryAfter = typeof (headers as { get?: unknown })?.get === 'function'
				? (headers as { get: (name: string) => string | null }).get('retry-after')
				: String((headers as Record<string, unknown> | undefined)?.['retry-after'] ?? '') || null
			const statusMessages: Record<number, string> = {
				400: `${providerTitle} rejected the request (HTTP 400). The selected model or endpoint may not support this request format.`,
				401: `${providerTitle} rejected the API credentials (HTTP 401). Check the API key in Settings.`,
				403: `${providerTitle} denied access (HTTP 403). Check model access and account permissions.`,
				404: `${providerTitle} could not find the configured model or endpoint (HTTP 404). Check both in Settings.`,
				408: `${providerTitle} timed out (HTTP 408). Retry the message.`,
				413: `${providerTitle} rejected the request because its context was too large (HTTP 413). Remove attachments or start a shorter thread.`,
				429: `${providerTitle} is rate-limiting requests (HTTP 429). Wait${retryAfter ? ` ${retryAfter} seconds` : ' briefly'} or check your provider quota, then use Continue task.`,
				500: `${providerTitle} had an internal error (HTTP 500). Retry shortly.`,
				502: `${providerTitle} returned a bad gateway response (HTTP 502). Check the endpoint or retry shortly.`,
				503: `${providerTitle} is temporarily unavailable (HTTP 503). Retry shortly.`,
				504: `${providerTitle} timed out at its gateway (HTTP 504). Retry shortly.`,
			}
			if (statusMessages[status]) {
				errorMessage = isContextOverflow
					? `[CONTEXT_OVERFLOW] ${providerTitle} rejected this context. Forge will compact the task state and continue automatically.`
					: statusMessages[status]
				fullError = null
			}
		}

		captureLLMEvent(`${loggingName} - Error`, { error: errorMessage })
		onError_({ message: errorMessage, fullError })
	}

	// we should NEVER call onAbort internally, only from the outside
	const onAbort = () => {
		captureLLMEvent(`${loggingName} - Abort`, { messageLengthSoFar: _fullTextSoFar.length })
		try { _aborter?.() } // aborter sometimes automatically throws an error
		catch (e) { }
		_didAbort = true
	}
	abortRef_.current = onAbort


	if (messagesType === 'chatMessages')
		captureLLMEvent(`${loggingName} - Sending Message`, {})
	else if (messagesType === 'FIMMessage')
		captureLLMEvent(`${loggingName} - Sending FIM`, { prefixLen: messages_?.prefix?.length, suffixLen: messages_?.suffix?.length })


	try {
		const implementation = sendLLMMessageToProviderImplementation[providerName]
		if (!implementation) {
			onError({ message: `Error: Provider "${providerName}" not recognized.`, fullError: null })
			return
		}
		const { sendFIM, sendChat } = implementation

		// Apply TOON Token Reduction for ALL payloads
		// We convert large stringified JSON back to objects, encode them, and stringify
		// to significantly reduce token overhead in standard LLM task payloads.
		if (messages_ && Array.isArray(messages_)) {
			messages_.forEach(msg => {
				const m = msg as any;
				if (m.role === 'user' && typeof m.content === 'string' && m.content.includes('{') && m.content.includes('}')) {
					try {
						// Only apply TOON to JSON payloads like Crawl4AI metadata, tool results, etc
						const regex = /```json\n([\s\S]*?)\n```/g;
						m.content = m.content.replace(regex, (match: string, p1: string) => {
							try {
								const obj = JSON.parse(p1);
								return `\`\`\`toon\n${toonEncode(obj)}\n\`\`\``;
							} catch (e) {
								return match;
							}
						});
					} catch(e) {}
				}
			});
		}

		if (messagesType === 'chatMessages') {
			await sendChat({ messages: messages_, onText, onFinalMessage, onError, settingsOfProvider, modelSelectionOptions, overridesOfModel, modelName, _setAborter, providerName, separateSystemMessage, chatMode, mcpTools })
			return
		}
		if (messagesType === 'FIMMessage') {
			if (sendFIM) {
				await sendFIM({ messages: messages_, onText, onFinalMessage, onError, settingsOfProvider, modelSelectionOptions, overridesOfModel, modelName, _setAborter, providerName, separateSystemMessage })
				return
			}
			onError({ message: `Error running Autocomplete with ${providerName} - ${modelName}.`, fullError: null })
			return
		}
		onError({ message: `Error: Message type "${messagesType}" not recognized.`, fullError: null })
		return
	}

	catch (error) {
		if (error instanceof Error) { onError({ message: error + '', fullError: error }) }
		else { onError({ message: `Unexpected Error in sendLLMMessage: ${error}`, fullError: error }); }
		// ; (_aborter as any)?.()
		// _didAbort = true
	}



}


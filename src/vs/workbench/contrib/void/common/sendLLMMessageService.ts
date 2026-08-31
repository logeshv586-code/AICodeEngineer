/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { EventLLMMessageOnTextParams, EventLLMMessageOnErrorParams, EventLLMMessageOnFinalMessageParams, ServiceSendLLMMessageParams, MainSendLLMMessageParams, MainLLMMessageAbortParams, ServiceModelListParams, EventModelListOnSuccessParams, EventModelListOnErrorParams, MainModelListParams, OllamaModelResponse, OpenaiCompatibleModelResponse, TestModelConnectionParams, TestModelConnectionResult, RawToolCallObj, RawToolParamsObj } from './sendLLMMessageTypes.js';

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IVoidSettingsService } from './voidSettingsService.js';
import { IMCPService } from './mcpService.js';

// calls channel to implement features
export const ILLMMessageService = createDecorator<ILLMMessageService>('llmMessageService');

export interface ILLMMessageService {
	readonly _serviceBrand: undefined;
	sendLLMMessage: (params: ServiceSendLLMMessageParams) => string | null;
	abort: (requestId: string) => void;
	ollamaList: (params: ServiceModelListParams<OllamaModelResponse>) => void;
	openAICompatibleList: (params: ServiceModelListParams<OpenaiCompatibleModelResponse>) => void;
	testConnection: (params: Omit<TestModelConnectionParams, 'settingsOfProvider'> & { connectionSettings?: Record<string, string> }) => Promise<TestModelConnectionResult>;
}

type AgentRequestMeta = {
	chatMode: 'normal' | 'gather' | 'agent' | null;
	latestUserText: string;
	persistentTerminalId?: string;
};

type ParsedShellBlock = {
	command: string;
	cwd?: string;
	rawBlock: string;
	wasExplicitToolCode: boolean;
};

const providerValueToText = (value: unknown): string => {
	if (value === null || value === undefined) return '';
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	if (Array.isArray(value)) return value.map(providerValueToText).filter(Boolean).join('\n');
	if (typeof value === 'object') {
		const record = value as Record<string, unknown>;
		for (const key of ['text', 'content', 'parts', 'message', 'output', 'response', 'value']) {
			if (key in record && record[key] !== value) {
				const nested = providerValueToText(record[key]);
				if (nested) return nested;
			}
		}
	}
	return '';
};

const requestMetaFromParams = (params: ServiceSendLLMMessageParams): AgentRequestMeta | undefined => {
	if (params.messagesType !== 'chatMessages') return undefined;
	const messages = params.messages as unknown as Array<Record<string, unknown>>;
	let latestUserText = '';
	for (let index = messages.length - 1; index >= 0; index--) {
		if (messages[index]?.role !== 'user') continue;
		latestUserText = providerValueToText(messages[index]);
		break;
	}
	const allText = messages.map(providerValueToText).join('\n');
	const terminalMatch = /Persistent terminal IDs available for you to run commands in:\s*([^\n<]+)/i.exec(allText);
	const persistentTerminalId = terminalMatch?.[1]?.split(',')[0]?.trim() || undefined;
	return { chatMode: params.chatMode, latestUserText, persistentTerminalId };
};

const stripQuotes = (value: string): string => {
	const trimmed = value.trim();
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) return trimmed.slice(1, -1);
	return trimmed;
};

const parseShellBody = (rawBody: string, rawBlock: string, wasExplicitToolCode: boolean): ParsedShellBlock | null => {
	let body = rawBody.replace(/\r\n/g, '\n').trim();
	const lines = body.split('\n');
	if (wasExplicitToolCode && /^(?:shell|bash|sh|zsh|cmd|powershell|pwsh|ps1)$/i.test(lines[0]?.trim() ?? '')) {
		lines.shift();
		body = lines.join('\n').trim();
	}
	if (!body) return null;

	let cwd: string | undefined;
	let command = body;
	const commandLines = body.split('\n');
	const firstLine = commandLines[0]?.trim() ?? '';
	const firstCd = /^cd\s+(?:\/d\s+)?(.+)$/i.exec(firstLine) ?? /^(?:set-location|chdir)\s+(.+)$/i.exec(firstLine);
	if (firstCd && commandLines.length > 1) {
		cwd = stripQuotes(firstCd[1]);
		command = commandLines.slice(1).join('\n').trim();
	} else {
		const inlineCd = /^cd\s+(?:\/d\s+)?(.+?)\s*(?:&&|;)\s*([\s\S]+)$/i.exec(body);
		if (inlineCd) {
			cwd = stripQuotes(inlineCd[1]);
			command = inlineCd[2].trim();
		}
	}

	command = command.replace(/^\$\s+/gm, '').trim();
	if (!command) return null;
	return { command, cwd, rawBlock, wasExplicitToolCode };
};

const parseTextualShellBlock = (fullText: string, latestUserText: string): ParsedShellBlock | null => {
	const actionIntent = /\b(run|start|launch|execute|test|build|install|lint|check|fix|debug|serve)\b/i.test(latestUserText);
	const fencePattern = /```([^\n`]*)\n([\s\S]*?)```/g;
	let match: RegExpExecArray | null;
	while ((match = fencePattern.exec(fullText)) !== null) {
		const info = match[1].trim().toLowerCase();
		const explicitToolCode = ['tool_code', 'tool-code', 'tool', 'toolcall', 'tool_call'].includes(info);
		const shellFence = ['shell', 'bash', 'sh', 'zsh', 'cmd', 'powershell', 'pwsh', 'ps1'].includes(info);
		if (!explicitToolCode && !(shellFence && actionIntent)) continue;
		const parsed = parseShellBody(match[2], match[0], explicitToolCode);
		if (parsed) return parsed;
	}

	const xmlToolCode = /<tool_code>\s*([\s\S]*?)<\/tool_code>/i.exec(fullText);
	if (xmlToolCode) return parseShellBody(xmlToolCode[1], xmlToolCode[0], true);

	const bareToolCode = /(?:^|\n)tool_code\s*\n((?:shell|bash|sh|zsh|cmd|powershell|pwsh|ps1)\s*\n[\s\S]+)$/i.exec(fullText);
	if (bareToolCode) return parseShellBody(bareToolCode[1], bareToolCode[0], true);
	return null;
};

const isLongRunningCommand = (command: string): boolean => /(?:^|[\s;&|])(?:npm\s+(?:run\s+)?(?:dev|start)|pnpm\s+(?:run\s+)?(?:dev|start)|yarn\s+(?:run\s+)?(?:dev|start)|bun\s+(?:run\s+)?(?:dev|start)|vite(?:\s|$)|next\s+dev|react-scripts\s+start|ng\s+serve|uvicorn\b|flask\s+run|manage\.py\s+runserver|python\s+-m\s+http\.server|dotnet\s+watch|cargo\s+watch)(?:\s|$)/i.test(command);

const toToolCall = (name: string, rawParams: RawToolParamsObj): RawToolCallObj => ({
	name,
	rawParams,
	doneParams: Object.keys(rawParams) as RawToolCallObj['doneParams'],
	id: generateUuid(),
	isDone: true,
});

/**
 * Small local models sometimes ignore Forge's XML tool grammar and emit a textual
 * ```tool_code shell``` block instead. In Agent mode that should be treated as an
 * attempted terminal tool call, not rendered as advice. Recover the intent here so
 * Ollama/LM Studio models can still drive the real IDE terminal.
 */
const recoverTextualAgentToolCall = (event: EventLLMMessageOnFinalMessageParams, meta: AgentRequestMeta | undefined): EventLLMMessageOnFinalMessageParams => {
	if (!meta || meta.chatMode !== 'agent' || event.toolCall) return event;
	const parsed = parseTextualShellBlock(event.fullText, meta.latestUserText);
	if (!parsed) return event;

	let toolCall: RawToolCallObj;
	let statusText = 'Running the requested command…';
	if (isLongRunningCommand(parsed.command)) {
		if (meta.persistentTerminalId) {
			toolCall = toToolCall('run_persistent_command', {
				command: parsed.command,
				persistent_terminal_id: meta.persistentTerminalId,
			});
			statusText = 'Running the project in the integrated terminal…';
		} else {
			toolCall = toToolCall('open_persistent_terminal', parsed.cwd ? { cwd: parsed.cwd } : {});
			statusText = 'Preparing an integrated terminal for the project…';
		}
	} else {
		toolCall = toToolCall('run_command', {
			command: parsed.command,
			...(parsed.cwd ? { cwd: parsed.cwd } : {}),
		});
	}

	const cleanedText = event.fullText.replace(parsed.rawBlock, '').replace(/\n{3,}/g, '\n\n').trim();
	console.debug(`[Forge Local Tool Recovery] Recovered ${toolCall.name} from textual tool output.`);
	return { ...event, fullText: cleanedText || statusText, toolCall };
};

// open this file side by side with llmMessageChannel
export class LLMMessageService extends Disposable implements ILLMMessageService {

	readonly _serviceBrand: undefined;
	private readonly channel: IChannel // LLMMessageChannel
	private readonly requestMeta: Record<string, AgentRequestMeta | undefined> = {};

	// sendLLMMessage
	private readonly llmMessageHooks = {
		onText: {} as { [eventId: string]: ((params: EventLLMMessageOnTextParams) => void) },
		onFinalMessage: {} as { [eventId: string]: ((params: EventLLMMessageOnFinalMessageParams) => void) },
		onError: {} as { [eventId: string]: ((params: EventLLMMessageOnErrorParams) => void) },
		onAbort: {} as { [eventId: string]: (() => void) }, // NOT sent over the channel, result is instant when we call .abort()
	}

	// list hooks
	private readonly listHooks = {
		ollama: {
			success: {} as { [eventId: string]: ((params: EventModelListOnSuccessParams<OllamaModelResponse>) => void) },
			error: {} as { [eventId: string]: ((params: EventModelListOnErrorParams<OllamaModelResponse>) => void) },
		},
		openAICompat: {
			success: {} as { [eventId: string]: ((params: EventModelListOnSuccessParams<OpenaiCompatibleModelResponse>) => void) },
			error: {} as { [eventId: string]: ((params: EventModelListOnErrorParams<OpenaiCompatibleModelResponse>) => void) },
		}
	} satisfies {
		[providerName in 'ollama' | 'openAICompat']: {
			success: { [eventId: string]: ((params: EventModelListOnSuccessParams<any>) => void) },
			error: { [eventId: string]: ((params: EventModelListOnErrorParams<any>) => void) },
		}
	}

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService, // used as a renderer (only usable on client side)
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@IMCPService private readonly mcpService: IMCPService,
	) {
		super()

		this.channel = this.mainProcessService.getChannel('void-channel-llmMessage')

		// .listen sets up an IPC channel and takes a few ms, so we set up listeners immediately and add hooks to them instead
		this._register((this.channel.listen('onText_sendLLMMessage') satisfies Event<EventLLMMessageOnTextParams>)(e => {
			this.llmMessageHooks.onText[e.requestId]?.(e)
		}))
		this._register((this.channel.listen('onFinalMessage_sendLLMMessage') satisfies Event<EventLLMMessageOnFinalMessageParams>)(e => {
			const recoveredEvent = recoverTextualAgentToolCall(e, this.requestMeta[e.requestId]);
			this.llmMessageHooks.onFinalMessage[e.requestId]?.(recoveredEvent);
			this._clearChannelHooks(e.requestId)
		}))
		this._register((this.channel.listen('onError_sendLLMMessage') satisfies Event<EventLLMMessageOnErrorParams>)(e => {
			this.llmMessageHooks.onError[e.requestId]?.(e);
			this._clearChannelHooks(e.requestId);
			console.error('Error in LLMMessageService:', JSON.stringify(e))
		}))
		this._register((this.channel.listen('onSuccess_list_ollama') satisfies Event<EventModelListOnSuccessParams<OllamaModelResponse>>)(e => {
			this.listHooks.ollama.success[e.requestId]?.(e)
		}))
		this._register((this.channel.listen('onError_list_ollama') satisfies Event<EventModelListOnErrorParams<OllamaModelResponse>>)(e => {
			this.listHooks.ollama.error[e.requestId]?.(e)
		}))
		this._register((this.channel.listen('onSuccess_list_openAICompatible') satisfies Event<EventModelListOnSuccessParams<OpenaiCompatibleModelResponse>>)(e => {
			this.listHooks.openAICompat.success[e.requestId]?.(e)
		}))
		this._register((this.channel.listen('onError_list_openAICompatible') satisfies Event<EventModelListOnErrorParams<OpenaiCompatibleModelResponse>>)(e => {
			this.listHooks.openAICompat.error[e.requestId]?.(e)
		}))

	}

	sendLLMMessage(params: ServiceSendLLMMessageParams) {
		const { onText, onFinalMessage, onError, onAbort, modelSelection, ...proxyParams } = params;

		if (modelSelection === null) {
			const message = `Please add a provider in Void's Settings.`
			onError({ message, fullError: null })
			return null
		}

		if (params.messagesType === 'chatMessages' && (params.messages?.length ?? 0) === 0) {
			const message = `No messages detected.`
			onError({ message, fullError: null })
			return null
		}

		const { settingsOfProvider, } = this.voidSettingsService.state
		const selectedModel = settingsOfProvider[modelSelection.providerName]?.models.find(model => model.modelName === modelSelection.modelName)
		const effectiveSettingsOfProvider = selectedModel?.connectionSettings
			? {
				...settingsOfProvider,
				[modelSelection.providerName]: {
					...settingsOfProvider[modelSelection.providerName],
					...selectedModel.connectionSettings,
				},
			}
			: settingsOfProvider

		const mcpTools = this.mcpService.getMCPTools()

		const requestId = generateUuid();
		this.llmMessageHooks.onText[requestId] = onText
		this.llmMessageHooks.onFinalMessage[requestId] = onFinalMessage
		this.llmMessageHooks.onError[requestId] = onError
		this.llmMessageHooks.onAbort[requestId] = onAbort
		this.requestMeta[requestId] = requestMetaFromParams(params)

		this.channel.call('sendLLMMessage', {
			...proxyParams,
			requestId,
			settingsOfProvider: effectiveSettingsOfProvider,
			modelSelection,
			mcpTools,
		} satisfies MainSendLLMMessageParams);

		return requestId
	}

	abort(requestId: string) {
		this.llmMessageHooks.onAbort[requestId]?.()
		this.channel.call('abort', { requestId } satisfies MainLLMMessageAbortParams);
		this._clearChannelHooks(requestId)
	}

	ollamaList = (params: ServiceModelListParams<OllamaModelResponse>) => {
		const { onSuccess, onError, ...proxyParams } = params
		const { settingsOfProvider } = this.voidSettingsService.state
		const requestId_ = generateUuid();
		this.listHooks.ollama.success[requestId_] = onSuccess
		this.listHooks.ollama.error[requestId_] = onError

		this.channel.call('ollamaList', {
			...proxyParams,
			settingsOfProvider,
			providerName: 'ollama',
			requestId: requestId_,
		} satisfies MainModelListParams<OllamaModelResponse>)
	}

	openAICompatibleList = (params: ServiceModelListParams<OpenaiCompatibleModelResponse>) => {
		const { onSuccess, onError, ...proxyParams } = params
		const { settingsOfProvider } = this.voidSettingsService.state
		const requestId_ = generateUuid();
		this.listHooks.openAICompat.success[requestId_] = onSuccess
		this.listHooks.openAICompat.error[requestId_] = onError

		this.channel.call('openAICompatibleList', {
			...proxyParams,
			settingsOfProvider,
			requestId: requestId_,
		} satisfies MainModelListParams<OpenaiCompatibleModelResponse>)
	}

	testConnection = async (params: Omit<TestModelConnectionParams, 'settingsOfProvider'> & { connectionSettings?: Record<string, string> }) => {
		const { settingsOfProvider } = this.voidSettingsService.state
		const providerSettings = settingsOfProvider[params.providerName]
		const effectiveSettingsOfProvider = params.connectionSettings
			? { ...settingsOfProvider, [params.providerName]: { ...providerSettings, ...params.connectionSettings } }
			: settingsOfProvider
		return await this.channel.call<TestModelConnectionResult>('testConnection', {
			providerName: params.providerName,
			modelName: params.modelName,
			settingsOfProvider: effectiveSettingsOfProvider,
		} satisfies TestModelConnectionParams)
	}

	private _clearChannelHooks(requestId: string) {
		delete this.llmMessageHooks.onText[requestId]
		delete this.llmMessageHooks.onFinalMessage[requestId]
		delete this.llmMessageHooks.onError[requestId]
		delete this.requestMeta[requestId]

		delete this.listHooks.ollama.success[requestId]
		delete this.listHooks.ollama.error[requestId]

		delete this.listHooks.openAICompat.success[requestId]
		delete this.listHooks.openAICompat.error[requestId]
	}
}

registerSingleton(ILLMMessageService, LLMMessageService, InstantiationType.Eager);

/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { InternalToolInfo } from './prompt/prompts.js'
import { ToolName, ToolParamName } from './toolsServiceTypes.js'
import { ChatMode, ModelSelection, ModelSelectionOptions, OverridesOfModel, ProviderName, RefreshableProviderName, SettingsOfProvider } from './voidSettingsTypes.js'


export const errorDetails = (fullError: Error | null): string | null => {
	if (fullError === null) {
		return null
	}
	else if (typeof fullError === 'object') {
		if (Object.keys(fullError).length === 0) return null
		return JSON.stringify(fullError, null, 2)
	}
	else if (typeof fullError === 'string') {
		return null
	}
	return null
}

export const getErrorMessage: (error: unknown) => string = (error) => {
	if (error instanceof Error) return `${error.name}: ${error.message}`
	return readableLLMContent(error)
}

/** Convert provider SDK payloads into safe text before they reach React or chat history. */
export const readableLLMContent = (value: unknown): string => {
	if (value === null || value === undefined) return ''
	if (typeof value === 'string') {
		return value.replaceAll('[object Object]', '[Structured provider response — please retry to display it correctly]')
	}
	if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
	if (Array.isArray(value)) return value.map(readableLLMContent).filter(Boolean).join('\n\n')
	if (typeof value === 'object') {
		const record = value as Record<string, unknown>
		for (const key of ['text', 'content', 'message', 'output', 'response', 'value']) {
			if (key in record && record[key] !== value) {
				const nested = readableLLMContent(record[key])
				if (nested) return nested
			}
		}
		try { return JSON.stringify(value, null, 2) }
		catch { return '[Unserializable provider response]' }
	}
	return String(value)
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const isExecutionPreambleOnly = (text: string): boolean => {
	if (!text || text.length > 280 || text.includes('\n')) return false
	return /^(?:okay[,.]?\s*)?(?:(?:let me)|(?:i(?:'|’)ll)|(?:i will)|(?:i(?:'|’)m going to)|(?:i am going to)|(?:i need to)|(?:first,?\s+i(?:'|’)ll)|(?:first,?\s+i will))\s+(?:inspect|check|look|explore|read|search|scan|review|open|find|trace|examine|analy[sz]e|run|test|verify)\b[^.!?]*[.!?]?$/.test(text.trim().toLowerCase())
}

/**
 * Strip recognized tool-call patterns from display text.
 *
 * Only removes structures whose tool name matches one of the
 * `registeredToolNames`. Legitimate assistant JSON (e.g. {"name":"John"})
 * is never removed because "John" won't be in the tool list.
 *
 * When a registered tool call was actually removed, also suppress a leftover
 * one-sentence execution preamble such as "Let me inspect the files.". This
 * prevents XML/custom-model tool turns from becoming repetitive chat bubbles
 * while preserving substantive assistant prose.
 *
 * This is a secondary safety net; the primary defence is the streaming
 * tool-call interceptor in extractGrammar.ts and the agent system prompt.
 */
export const sanitizeToolCallLeakage = (text: string, registeredToolNames: string[]): string => {
	if (!text || registeredToolNames.length === 0) return text

	let result = text
	let removedRegisteredToolCall = false
	const strip = (pattern: RegExp) => {
		const previous = result
		result = result.replace(pattern, '')
		if (result !== previous) removedRegisteredToolCall = true
	}

	for (const name of registeredToolNames) {
		const eName = escapeRegex(name)

		// Strip: tool_name({...}) or tool_name({"name":"tool_name",...})
		strip(new RegExp(`${eName}\\s*\\(\\s*\\{[\\s\\S]*?\\}\\s*\\)`, 'g'))

		// Strip: tool_name{...} (no parens)
		strip(new RegExp(`${eName}\\s*\\{[\\s\\S]*?\\}`, 'g'))

		// Strip: {"name":"tool_name","args":{...}} (JSON tool-call object)
		strip(new RegExp(`\\{\\s*"name"\\s*:\\s*"${eName}"[\\s\\S]*?\\}(?:\\s*\\})?`, 'g'))

		// Strip: <tool_name>...</tool_name> (residual XML)
		strip(new RegExp(`<${eName}>[\\s\\S]*?</${eName}>`, 'g'))
	}

	const cleaned = result.replace(/\n{3,}/g, '\n\n').trim()
	if (removedRegisteredToolCall && isExecutionPreambleOnly(cleaned)) return ''
	return cleaned
}


export type AnthropicLLMChatMessage = {
	role: 'assistant',
	content: string | (AnthropicReasoning | { type: 'text'; text: string }
		| { type: 'tool_use'; name: string; input: Record<string, any>; id: string; }
	)[];
} | {
	role: 'user',
	content: string | (
		{ type: 'text'; text: string; }
		| { type: 'tool_result'; tool_use_id: string; content: string; }
		| { type: 'image'; source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'; data: string; } }
	)[]
}
export type OpenAILLMChatMessage = {
	role: 'system' | 'developer';
	content: string;
} | {
	role: 'user';
	content: string | (
		{ type: 'text'; text: string; }
		| { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
	)[];
} | {
	role: 'assistant',
	content: string | (AnthropicReasoning | { type: 'text'; text: string })[];
	tool_calls?: { type: 'function'; id: string; function: { name: string; arguments: string; } }[];
} | {
	role: 'tool',
	content: string;
	tool_call_id: string;
}

export type GeminiLLMChatMessage = {
	role: 'model'
	parts: (
		| { text: string; }
		| { functionCall: { id: string; name: ToolName, args: Record<string, unknown> } }
	)[];
} | {
	role: 'user';
	parts: (
		| { text: string; }
		| { inlineData: { mimeType: string; data: string; } }
		| { functionResponse: { id: string; name: ToolName, response: { output: string } } }
	)[];
}

export type LLMChatMessage = AnthropicLLMChatMessage | OpenAILLMChatMessage | GeminiLLMChatMessage



export type LLMFIMMessage = {
	prefix: string;
	suffix: string;
	stopTokens: string[];
}


export type RawToolParamsObj = {
	[paramName in ToolParamName<ToolName>]?: string;
}
export type RawToolCallObj = {
	name: ToolName;
	rawParams: RawToolParamsObj;
	doneParams: ToolParamName<ToolName>[];
	id: string;
	isDone: boolean;
};

export type AnthropicReasoning = ({ type: 'thinking'; thinking: any; signature: string; } | { type: 'redacted_thinking', data: any })

export type OnText = (p: { fullText: string; fullReasoning: string; toolCall?: RawToolCallObj }) => void
export type OnFinalMessage = (p: { fullText: string; fullReasoning: string; toolCall?: RawToolCallObj; anthropicReasoning: AnthropicReasoning[] | null; finishReason?: string }) => void // id is tool_use_id
export type OnError = (p: { message: string; fullError: Error | null }) => void
export type OnAbort = () => void
export type AbortRef = { current: (() => void) | null }


// service types
type SendLLMType = {
	messagesType: 'chatMessages';
	messages: LLMChatMessage[]; // the type of raw chat messages that we send to Anthropic, OAI, etc
	separateSystemMessage: string | undefined;
	chatMode: ChatMode | null;
} | {
	messagesType: 'FIMMessage';
	messages: LLMFIMMessage;
	separateSystemMessage?: undefined;
	chatMode?: undefined;
}
export type ServiceSendLLMMessageParams = {
	onText: OnText;
	onFinalMessage: OnFinalMessage;
	onError: OnError;
	logging: { loggingName: string, loggingExtras?: { [k: string]: any } };
	modelSelection: ModelSelection | null;
	modelSelectionOptions: ModelSelectionOptions | undefined;
	overridesOfModel: OverridesOfModel | undefined;
	onAbort: OnAbort;
} & SendLLMType;

// params to the true sendLLMMessage function
export type SendLLMMessageParams = {
	onText: OnText;
	onFinalMessage: OnFinalMessage;
	onError: OnError;
	logging: { loggingName: string, loggingExtras?: { [k: string]: any } };
	abortRef: AbortRef;

	modelSelection: ModelSelection;
	modelSelectionOptions: ModelSelectionOptions | undefined;
	overridesOfModel: OverridesOfModel | undefined;

	settingsOfProvider: SettingsOfProvider;
	mcpTools: InternalToolInfo[] | undefined;
} & SendLLMType



// can't send functions across a proxy, use listeners instead
export type BlockedMainLLMMessageParams = 'onText' | 'onFinalMessage' | 'onError' | 'abortRef'
export type MainSendLLMMessageParams = Omit<SendLLMMessageParams, BlockedMainLLMMessageParams> & { requestId: string } & SendLLMType

export type MainLLMMessageAbortParams = { requestId: string }

export type EventLLMMessageOnTextParams = Parameters<OnText>[0] & { requestId: string }
export type EventLLMMessageOnFinalMessageParams = Parameters<OnFinalMessage>[0] & { requestId: string }
export type EventLLMMessageOnErrorParams = Parameters<OnError>[0] & { requestId: string }

// service -> main -> internal -> event (back to main)
// (browser)









// These are from 'ollama' SDK
interface OllamaModelDetails {
	parent_model: string;
	format: string;
	family: string;
	families: string[];
	parameter_size: string;
	quantization_level: string;
}

export type OllamaModelResponse = {
	name: string;
	modified_at: Date;
	size: number;
	digest: string;
	details: OllamaModelDetails;
	expires_at: Date;
	size_vram: number;
}

export type OpenaiCompatibleModelResponse = {
	id: string;
	created: number;
	object: 'model';
	owned_by: string;
}



// params to the true list fn
export type ModelListParams<ModelResponse> = {
	providerName: ProviderName;
	settingsOfProvider: SettingsOfProvider;
	onSuccess: (param: { models: ModelResponse[] }) => void;
	onError: (param: { error: string }) => void;
}

// params to the service
export type ServiceModelListParams<modelResponse> = {
	providerName: RefreshableProviderName;
	onSuccess: (param: { models: modelResponse[] }) => void;
	onError: (param: { error: any }) => void;
}

type BlockedMainModelListParams = 'onSuccess' | 'onError'
export type MainModelListParams<modelResponse> = Omit<ModelListParams<modelResponse>, BlockedMainModelListParams> & { providerName: RefreshableProviderName, requestId: string }

export type EventModelListOnSuccessParams<modelResponse> = Parameters<ModelListParams<modelResponse>['onSuccess']>[0] & { requestId: string }
export type EventModelListOnErrorParams<modelResponse> = Parameters<ModelListParams<modelResponse>['onError']>[0] & { requestId: string }

export type TestModelConnectionParams = {
	providerName: ProviderName;
	modelName: string;
	settingsOfProvider: SettingsOfProvider;
}

export type TestModelConnectionResult = {
	ok: boolean;
	error?: string;
}





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

const builtInAgentToolNames = [
	'read_file',
	'ls_dir',
	'get_dir_tree',
	'search_pathnames_only',
	'search_for_files',
	'search_in_file',
	'semantic_search',
	'read_lint_errors',
	'create_file_or_folder',
	'delete_file_or_folder',
	'edit_file',
	'rewrite_file',
	'run_command',
	'run_persistent_command',
	'open_persistent_terminal',
	'kill_persistent_terminal',
] as const;

const localToolNameAliases: Readonly<Record<string, string>> = {
	write_file: 'create_file_or_folder',
	write_file_or_folder: 'create_file_or_folder',
	create_file: 'create_file_or_folder',
	create_folder: 'create_file_or_folder',
	save_file: 'create_file_or_folder',
	read: 'read_file',
	view_file: 'read_file',
	get_file: 'read_file',
	modify_file: 'edit_file',
	update_file: 'edit_file',
	apply_diff: 'edit_file',
	apply_patch: 'edit_file',
	overwrite_file: 'rewrite_file',
	replace_file: 'rewrite_file',
	delete_file: 'delete_file_or_folder',
	remove_file: 'delete_file_or_folder',
	list_dir: 'ls_dir',
	list_directory: 'ls_dir',
	ls: 'ls_dir',
	dir_tree: 'get_dir_tree',
	tree: 'get_dir_tree',
	grep: 'search_for_files',
	search_files: 'search_for_files',
	find_files: 'search_pathnames_only',
	exec: 'run_command',
	execute_command: 'run_command',
	run_terminal_command: 'run_command',
	bash: 'run_command',
	terminal: 'run_command',
	'shell.execute': 'run_command',
	persistent_shell: 'run_persistent_command',
};

type AgentRequestMeta = {
	chatMode: 'normal' | 'gather' | 'agent' | null;
	latestUserText: string;
	persistentTerminalId?: string;
	availableToolNames: readonly string[];
};

type ParsedShellBlock = {
	command: string;
	cwd?: string;
	rawBlock: string;
	wasExplicitToolCode: boolean;
};

type ParsedTextualToolCall = {
	name: string;
	rawParams: RawToolParamsObj;
	rawBlock: string;
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

const requestMetaFromParams = (params: ServiceSendLLMMessageParams, mcpToolNames: readonly string[] = []): AgentRequestMeta | undefined => {
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
	return {
		chatMode: params.chatMode,
		latestUserText,
		persistentTerminalId,
		availableToolNames: [...builtInAgentToolNames, ...mcpToolNames],
	};
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

const normalizeRecoveredToolName = (rawName: unknown, allowedToolNames: ReadonlySet<string>): string | null => {
	if (typeof rawName !== 'string' || !rawName.trim()) return null;
	const trimmed = rawName.trim().replace(/^<+/, '').replace(/[>\s]+$/, '');
	const lower = trimmed.toLowerCase();
	const canonical = localToolNameAliases[lower] ?? trimmed;
	if (allowedToolNames.has(canonical)) return canonical;
	if (allowedToolNames.has(trimmed)) return trimmed;
	return null;
};

const rawParamsFromUnknown = (value: unknown): RawToolParamsObj | null => {
	let resolved = value;
	if (typeof resolved === 'string') {
		const trimmed = resolved.trim();
		if (!trimmed) return {};
		try { resolved = JSON.parse(trimmed); }
		catch { return null; }
	}
	if (resolved === null || resolved === undefined) return {};
	if (typeof resolved !== 'object' || Array.isArray(resolved)) return null;

	const rawParams: RawToolParamsObj = {};
	for (const [key, parameterValue] of Object.entries(resolved as Record<string, unknown>)) {
		if (parameterValue === undefined) continue;
		if (typeof parameterValue === 'string') rawParams[key] = parameterValue;
		else if (parameterValue === null) rawParams[key] = 'null';
		else if (typeof parameterValue === 'number' || typeof parameterValue === 'boolean') rawParams[key] = String(parameterValue);
		else {
			try { rawParams[key] = JSON.stringify(parameterValue); }
			catch { return null; }
		}
	}
	return rawParams;
};

const textualToolCallFromValue = (value: unknown, rawBlock: string, allowedToolNames: ReadonlySet<string>, depth = 0): ParsedTextualToolCall | null => {
	if (depth > 4 || value === null || value === undefined) return null;
	if (Array.isArray(value)) {
		for (const item of value) {
			const parsed = textualToolCallFromValue(item, rawBlock, allowedToolNames, depth + 1);
			if (parsed) return parsed;
		}
		return null;
	}
	if (typeof value !== 'object') return null;

	const record = value as Record<string, unknown>;
	for (const wrapperKey of ['tool_calls', 'toolCalls', 'calls']) {
		if (!(wrapperKey in record)) continue;
		const parsed = textualToolCallFromValue(record[wrapperKey], rawBlock, allowedToolNames, depth + 1);
		if (parsed) return parsed;
	}

	const fn = typeof record.function === 'object' && record.function !== null
		? record.function as Record<string, unknown>
		: undefined;
	const name = normalizeRecoveredToolName(
		fn?.name ?? record.name ?? record.tool ?? record.tool_name ?? record.toolName,
		allowedToolNames,
	);
	if (!name) return null;

	const argsValue = fn?.arguments
		?? record.arguments
		?? record.args
		?? record.parameters
		?? record.input
		?? record.params
		?? {};
	const rawParams = rawParamsFromUnknown(argsValue);
	if (rawParams === null) return null;
	return { name, rawParams, rawBlock };
};

const extractBalancedJSONBlocks = (text: string): string[] => {
	const blocks: string[] = [];
	for (let start = 0; start < text.length; start++) {
		if (text[start] !== '{' && text[start] !== '[') continue;
		const stack: string[] = [];
		let inString = false;
		let escaped = false;
		for (let index = start; index < text.length; index++) {
			const char = text[index];
			if (inString) {
				if (escaped) escaped = false;
				else if (char === '\\') escaped = true;
				else if (char === '"') inString = false;
				continue;
			}
			if (char === '"') {
				inString = true;
				continue;
			}
			if (char === '{' || char === '[') stack.push(char);
			else if (char === '}' || char === ']') {
				const expected = char === '}' ? '{' : '[';
				if (stack.pop() !== expected) break;
				if (stack.length === 0) {
					blocks.push(text.slice(start, index + 1));
					start = index;
					break;
				}
			}
		}
	}
	return blocks;
};

const parseTextualStructuredToolCall = (fullText: string, availableToolNames: readonly string[]): ParsedTextualToolCall | null => {
	const allowedToolNames = new Set(availableToolNames);
	if (allowedToolNames.size === 0) return null;

	const tagged = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi;
	let taggedMatch: RegExpExecArray | null;
	while ((taggedMatch = tagged.exec(fullText)) !== null) {
		try {
			const parsed = textualToolCallFromValue(JSON.parse(taggedMatch[1]), taggedMatch[0], allowedToolNames);
			if (parsed) return parsed;
		} catch { /* keep looking */ }
	}

	const fencePattern = /```(?:json|tool|tool_call|toolcall)\s*\n([\s\S]*?)```/gi;
	let fenceMatch: RegExpExecArray | null;
	while ((fenceMatch = fencePattern.exec(fullText)) !== null) {
		try {
			const parsed = textualToolCallFromValue(JSON.parse(fenceMatch[1].trim()), fenceMatch[0], allowedToolNames);
			if (parsed) return parsed;
		} catch { /* keep looking */ }
	}

	for (const block of extractBalancedJSONBlocks(fullText)) {
		try {
			const parsed = textualToolCallFromValue(JSON.parse(block), block, allowedToolNames);
			if (parsed) return parsed;
		} catch { /* not a JSON tool call */ }
	}
	return null;
};

const statusTextForTool = (name: string): string => {
	if (['edit_file', 'rewrite_file', 'create_file_or_folder', 'delete_file_or_folder'].includes(name)) return 'Applying the requested code change…';
	if (['read_file', 'ls_dir', 'get_dir_tree', 'search_pathnames_only', 'search_for_files', 'search_in_file', 'semantic_search', 'read_lint_errors'].includes(name)) return 'Inspecting the codebase…';
	if (name.includes('terminal') || name.includes('command')) return 'Running the requested command…';
	return 'Running the requested IDE tool…';
};

/**
 * Local and reasoning-oriented models sometimes ignore the provider-native tool
 * protocol and print an OpenAI/DeepSeek-style JSON tool call (or a shell block) as
 * ordinary text. In Agent mode that is execution intent, not advice. Recover only
 * names that are actually registered for this request, including MCP tools, so
 * arbitrary JSON in a normal answer can never become an executable action.
 */
const recoverTextualAgentToolCall = (event: EventLLMMessageOnFinalMessageParams, meta: AgentRequestMeta | undefined): EventLLMMessageOnFinalMessageParams => {
	if (!meta || meta.chatMode !== 'agent' || event.toolCall) return event;

	const structured = parseTextualStructuredToolCall(event.fullText, meta.availableToolNames);
	if (structured) {
		const toolCall = toToolCall(structured.name, structured.rawParams);
		const cleanedText = event.fullText.replace(structured.rawBlock, '').replace(/\n{3,}/g, '\n\n').trim();
		console.debug(`[Forge Local Tool Recovery] Recovered ${toolCall.name} from structured textual tool output.`);
		return { ...event, fullText: cleanedText || statusTextForTool(toolCall.name), toolCall };
	}

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
	console.debug(`[Forge Local Tool Recovery] Recovered ${toolCall.name} from textual shell output.`);
	return { ...event, fullText: cleanedText || statusText, toolCall };
};

const suppressAgentToolTurnProse = <T extends { fullText: string; fullReasoning: string; toolCall?: RawToolCallObj }>(event: T, meta: AgentRequestMeta | undefined): T => {
	if (!meta || meta.chatMode !== 'agent' || !event.toolCall) return event;
	return { ...event, fullText: '', fullReasoning: '' };
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
			const displayEvent = suppressAgentToolTurnProse(e, this.requestMeta[e.requestId]);
			this.llmMessageHooks.onText[e.requestId]?.(displayEvent)
		}))
		this._register((this.channel.listen('onFinalMessage_sendLLMMessage') satisfies Event<EventLLMMessageOnFinalMessageParams>)(e => {
			const meta = this.requestMeta[e.requestId];
			const recoveredEvent = recoverTextualAgentToolCall(e, meta);
			const displayEvent = suppressAgentToolTurnProse(recoveredEvent, meta);
			this.llmMessageHooks.onFinalMessage[e.requestId]?.(displayEvent);
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
		this.requestMeta[requestId] = requestMetaFromParams(params, mcpTools?.map(tool => tool.name) ?? [])

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
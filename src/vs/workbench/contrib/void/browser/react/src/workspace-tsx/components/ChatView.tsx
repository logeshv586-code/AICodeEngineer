/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Sparkles, Command, RotateCcw, Copy, GitFork, ThumbsUp, ThumbsDown } from 'lucide-react';
import { URI } from '../../../../../../../base/common/uri.js';
import { INotificationService } from '../../../../../../../platform/notification/common/notification.js';
import { IFileDialogService } from '../../../../../../../platform/dialogs/common/dialogs.js';
import { SlashCommandPalette, SlashCommandContext, SlashCommand } from '../utils/slashCommandRouter';
import { StreamRenderer } from './StreamRenderer';
import { ComposerControlCenter, Attachment, NewAttachment } from './ComposerControlCenter';
import { useStreamEvents, StreamEvent } from '../utils/streamEvents';
import { IVoidSettingsService } from '../../../../../common/voidSettingsService.js';
import { IMetricsService } from '../../../../../common/metricsService.js';
import { StagingSelectionItem } from '../../../../../common/chatThreadServiceTypes.js';
import { chooseAdaptiveModel } from '../../../../../common/forge/intelligence/adaptiveModelRouter.js';
import { ISkillsService } from '../../../skillsService.js';

export interface ChatViewMessage {
	readonly id: string;
	readonly role: 'user' | 'assistant';
	readonly content: string;
	readonly timestamp: number;
	readonly messageIndex?: number;
}

export interface ChatViewProps {
	messages: ChatViewMessage[];
	isStreaming?: boolean;
	onSendMessage: (msg: string) => void | Promise<void>;
	onNewThread?: () => void;
	slashContext?: SlashCommandContext;
	className?: string;
	workspaceReady?: boolean;
	workspaceFileCount?: number;
	selectedFiles?: string[];
	providerName?: string;
	modelName?: string;
	onOpenSettings?: () => void;
	tokenCount?: number;
	maxTokens?: number;
	attachments?: Attachment[];
	onRemoveAttachment?: (index: number) => void;
	onRevertMessage?: (messageIndex: number) => void;
}

const EmptyState: React.FC<{
	onSuggestionClick: (text: string) => void;
	onCommandsClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}> = ({ onSuggestionClick, onCommandsClick }) => (
	<div className='flex flex-col items-center justify-center h-full select-none px-6'>
		<div className='w-12 h-12 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center mb-4'><Sparkles size={24} className='text-zinc-400' /></div>
		<div className='text-sm font-medium text-zinc-400 mb-1'>What should Forge complete?</div>
		<div className='text-[11px] text-zinc-600 mb-5 max-w-[320px] text-center'>Forge can understand the codebase, edit files, run commands and tests, use the browser, create designs, and build Work Mode automations.</div>
		<div className='flex flex-wrap gap-1.5 justify-center max-w-[420px]'>
			{[
				'Understand this codebase and explain the architecture',
				'Find and fix the current bug, then run tests',
				'Implement this feature end-to-end and verify it',
				'Review the current changes for regressions',
				'Inspect the app in the browser and fix the UI',
				'Create an automation workflow for this task',
			].map(suggestion => <button key={suggestion} type='button' onClick={() => onSuggestionClick(suggestion)} className='px-2.5 py-1.5 rounded-lg border border-zinc-800/60 bg-zinc-900/40 text-[11px] text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300 hover:border-zinc-700/60 transition-colors cursor-pointer'>{suggestion}</button>)}
		</div>
		<button type='button' onClick={onCommandsClick} className='mt-5 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800/40 hover:bg-zinc-700/40 border border-zinc-700/30 text-[10px] text-zinc-600 font-mono transition-colors cursor-pointer'><Command size={10} /><span>/</span><span>Commands & skills</span></button>
	</div>
);

const MessageActions: React.FC<{
	onRevert?: () => void;
	onCopy?: () => void;
	onDuplicateThread?: () => void;
}> = ({ onRevert, onCopy, onDuplicateThread }) => {
	if (!onRevert && !onCopy && !onDuplicateThread) return null;
	return <div className='absolute right-3 top-2 hidden group-hover:flex items-center gap-0.5 rounded-md border border-zinc-800/60 bg-zinc-950/90 p-0.5 shadow-lg'>
		{onCopy && <button type='button' onClick={onCopy} title='Copy message' aria-label='Copy message' className='w-6 h-6 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/80 transition-colors'><Copy size={11} /></button>}
		{onDuplicateThread && <button type='button' onClick={onDuplicateThread} title='Duplicate thread' aria-label='Duplicate thread' className='w-6 h-6 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/80 transition-colors'><GitFork size={11} /></button>}
		{onRevert && <button type='button' onClick={onRevert} title='Revert to here' aria-label='Revert to here' className='w-6 h-6 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/80 transition-colors'><RotateCcw size={11} /></button>}
	</div>;
};

const UserMessage: React.FC<{ message: ChatViewMessage; onRevert?: () => void; onCopy?: () => void }> = ({ message, onRevert, onCopy }) => (
	<div className='group relative flex gap-3 py-3 px-4 hover:bg-zinc-900/10 transition-colors'>
		<MessageActions onRevert={onRevert} onCopy={onCopy} />
		<div className='w-7 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center shrink-0 mt-0.5'><span className='text-[10px] font-bold text-zinc-500'>U</span></div>
		<div className='flex-1 min-w-0'>
			<div className='flex items-center gap-2 mb-0.5'><span className='text-[11px] font-medium text-zinc-500'>You</span><span className='text-[9px] text-zinc-700'>{new Date(message.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span></div>
			<div className='text-[13px] leading-relaxed text-zinc-300 whitespace-pre-wrap break-words'>{message.content}</div>
		</div>
	</div>
);

const AssistantMessage: React.FC<{
	message: ChatViewMessage;
	streamEvents: StreamEvent[];
	isStreaming: boolean;
	onRevert?: () => void;
	onCopy?: () => void;
	onDuplicateThread?: () => void;
	onFeedback?: (rating: 'positive' | 'negative') => void;
}> = ({ message, streamEvents, isStreaming, onRevert, onCopy, onDuplicateThread, onFeedback }) => {
	const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
	const displayEvents = useMemo(() => {
		const seen = new Set<string>();
		return streamEvents.filter(event => {
			const key = event.kind + (event.label || '');
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}, [streamEvents]);
	const hasActiveWork = displayEvents.some(event => event.status === 'active');
	const submitFeedback = (rating: 'positive' | 'negative') => {
		setFeedback(current => current === rating ? null : rating);
		if (feedback !== rating) onFeedback?.(rating);
	};

	return <div className='group relative flex gap-3 py-3 px-4 hover:bg-zinc-900/10 transition-colors'>
		<MessageActions onRevert={onRevert} onCopy={onCopy} onDuplicateThread={onDuplicateThread} />
		<div className='w-7 h-7 rounded-lg bg-emerald-600/10 border border-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5'><Sparkles size={14} className='text-emerald-400' /></div>
		<div className='flex-1 min-w-0'>
			<div className='flex items-center gap-2 mb-1'><span className='text-[11px] font-medium text-zinc-400'>Forge</span><span className='text-[9px] text-zinc-700'>{new Date(message.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span></div>
			{hasActiveWork && <div className='text-[13px] leading-relaxed text-zinc-500 mb-1.5'>{displayEvents.filter(event => event.status === 'active').map(event => event.label).join(' · ')}</div>}
			{message.content && <div className='text-[13px] leading-relaxed text-zinc-400 whitespace-pre-wrap break-words'>{message.content}</div>}
			{displayEvents.length > 0 && <StreamRenderer events={displayEvents} className='mt-2' />}
			{isStreaming && <div className='flex items-center gap-1.5 mt-2 text-zinc-600'><Sparkles size={10} className='text-emerald-400 animate-pulse' /><span className='text-[10px] animate-pulse'>Working…</span></div>}
			{!isStreaming && message.content && onFeedback && <div className='flex items-center gap-0.5 mt-2'>
				<button type='button' onClick={() => submitFeedback('positive')} title='Helpful response' className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${feedback === 'positive' ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-700 hover:text-zinc-400 hover:bg-zinc-800/50'}`}><ThumbsUp size={11} /></button>
				<button type='button' onClick={() => submitFeedback('negative')} title='Unhelpful response' className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${feedback === 'negative' ? 'text-red-400 bg-red-500/10' : 'text-zinc-700 hover:text-zinc-400 hover:bg-zinc-800/50'}`}><ThumbsDown size={11} /></button>
			</div>}
		</div>
	</div>;
};

const mimeTypeForFile = (filePath: string): string => {
	const ext = filePath.split('.').pop()?.toLowerCase() || '';
	const map: Record<string, string> = {
		pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', json: 'application/json', jsonl: 'application/jsonl',
		js: 'text/javascript', mjs: 'text/javascript', cjs: 'text/javascript', ts: 'text/typescript', tsx: 'text/typescript', jsx: 'text/javascript',
		py: 'text/x-python', css: 'text/css', scss: 'text/x-scss', html: 'text/html', svg: 'image/svg+xml', xml: 'application/xml',
		yaml: 'application/yaml', yml: 'application/yaml', toml: 'application/toml', rs: 'text/x-rust', go: 'text/x-go', java: 'text/x-java',
		kt: 'text/x-kotlin', kts: 'text/x-kotlin', c: 'text/x-c', h: 'text/x-c', cpp: 'text/x-c++', hpp: 'text/x-c++', cs: 'text/x-csharp',
		php: 'text/x-php', rb: 'text/x-ruby', sh: 'text/x-shellscript', ps1: 'text/x-powershell', sql: 'text/x-sql',
	};
	return map[ext] || 'application/octet-stream';
};

export const ChatView: React.FC<ChatViewProps> = ({
	messages,
	isStreaming = false,
	onSendMessage,
	slashContext,
	className = '',
	workspaceReady = false,
	workspaceFileCount,
	selectedFiles = [],
	providerName,
	modelName,
	onOpenSettings,
	tokenCount,
	maxTokens,
	attachments = [],
	onRemoveAttachment,
	onRevertMessage,
}) => {
	const [isSlashOpen, setIsSlashOpen] = useState(false);
	const [slashAnchor, setSlashAnchor] = useState<DOMRect | null>(null);
	const [draftText, setDraftText] = useState('');
	const [localAttachments, setLocalAttachments] = useState<Attachment[]>([]);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const clearEventsRef = useRef<(() => void) | null>(null);
	const { state: streamState, clearEvents } = useStreamEvents({ maxEvents: 150, resetOnRunStart: true, onRunStart: () => clearEventsRef.current?.() });
	clearEventsRef.current = clearEvents;
	const effectiveAttachments = useMemo(() => [...attachments, ...localAttachments], [attachments, localAttachments]);

	useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamState.events.length, isStreaming]);

	const notify = useCallback((message: string, level: 'info' | 'warn' | 'error' = 'info') => {
		try {
			const service = slashContext?.accessor.get(INotificationService);
			if (!service) return;
			if (level === 'error') service.error(message); else if (level === 'warn') service.warn(message); else service.info(message);
		} catch { /* optional UI service */ }
	}, [slashContext]);

	const copyText = useCallback(async (text: string) => {
		try { await navigator.clipboard.writeText(text); notify('Copied to clipboard.'); }
		catch (error) { console.warn('[Forge Chat] Clipboard write failed:', error); notify('Could not copy this message.', 'warn'); }
	}, [notify]);

	const duplicateCurrentThread = useCallback(() => {
		if (!slashContext) return;
		try { slashContext.chatThreadsService.duplicateThread(slashContext.chatThreadsService.state.currentThreadId); notify('Thread duplicated.'); }
		catch (error) { console.warn('[Forge Chat] Could not duplicate thread:', error); }
	}, [notify, slashContext]);

	const recordFeedback = useCallback((message: ChatViewMessage, rating: 'positive' | 'negative') => {
		if (!slashContext) return;
		try { slashContext.accessor.get(IMetricsService).capture('Forge Assistant Response Feedback', { rating, messageId: message.id, model: modelName || 'unknown', provider: providerName || 'unknown' }); }
		catch (error) { console.warn('[Forge Chat] Could not record response feedback:', error); }
	}, [modelName, providerName, slashContext]);

	const handleLocalSkillCommand = useCallback(async (text: string): Promise<boolean> => {
		if (!slashContext) return false;
		if (text === '/skills') {
			const skills = slashContext.accessor.get(ISkillsService);
			const workspaceSkills = skills.getAllSkills();
			notify(`${skills.getRegistrySkillCount()} registry skills, ${workspaceSkills.length} active workspace skills.`);
			return true;
		}
		if (text === '/skill' || text.startsWith('/skill ')) {
			const query = text.replace(/^\/skill\s*/, '').trim();
			if (!query) { notify('Usage: /skill <query> (e.g. /skill jetson)'); return true; }
			const results = await slashContext.accessor.get(ISkillsService).searchSkills(query);
			const top = results.slice(0, 8);
			notify(top.length ? `Skill search "${query}": ${top.map(result => `${result.id} (${result.category})`).join(', ')}` : `No skills match "${query}".`);
			return true;
		}
		return false;
	}, [notify, slashContext]);

	const sendWithAdaptiveModel = useCallback(async (text: string) => {
		const trimmed = text.trim();
		if (!trimmed) return;
		if (await handleLocalSkillCommand(trimmed)) return;
		if (slashContext) {
			try {
				const settingsService = slashContext.accessor.get(IVoidSettingsService);
				if (settingsService.state.globalSettings.autoModelSelection) {
					const currentSelection = settingsService.state.modelSelectionOfFeature.Chat;
					const decision = chooseAdaptiveModel({ prompt: trimmed, candidates: settingsService.state._modelOptions, currentSelection });
					if (decision.selection && (decision.selection.providerName !== currentSelection?.providerName || decision.selection.modelName !== currentSelection?.modelName)) {
						await settingsService.setModelSelectionOfFeature('Chat', decision.selection);
						console.log(`[Forge Model Router] ${decision.reason}`);
					}
				}
			} catch (error) { console.warn('[Forge Model Router] Falling back to current model:', error); }
		}
		await Promise.resolve(onSendMessage(trimmed));
	}, [handleLocalSkillCommand, onSendMessage, slashContext]);

	const handleSend = useCallback(async () => {
		if (isStreaming) return;
		const text = draftText.trim() || (effectiveAttachments.length > 0 ? 'Inspect the attached context and complete the requested work. Read relevant files first, make the necessary changes, and verify the result.' : '');
		if (!text) return;
		await sendWithAdaptiveModel(text);
		setDraftText('');
		setLocalAttachments([]);
		if (textareaRef.current) textareaRef.current.style.height = 'auto';
	}, [draftText, effectiveAttachments.length, isStreaming, sendWithAdaptiveModel]);

	const handleAbort = useCallback(async () => {
		if (!slashContext) return;
		try { await slashContext.chatThreadsService.abortRunning(slashContext.chatThreadsService.state.currentThreadId); }
		catch (error) { console.warn('[Forge Chat] Abort failed:', error); notify('Could not stop the current run.', 'warn'); }
	}, [notify, slashContext]);

	const handleAddAttachment = useCallback((attachment: NewAttachment) => {
		if (!slashContext) { notify('Attachment service is unavailable in this view.', 'warn'); return; }
		const isImage = attachment.mimeType.startsWith('image/');
		if (!isImage || !attachment.dataUrl) { notify('Use the paperclip button for non-image files.', 'warn'); return; }
		const uri = URI.file(attachment.uri);
		const selection: StagingSelectionItem = { type: 'Image', uri, dataUrl: attachment.dataUrl, mimeType: attachment.mimeType };
		slashContext.chatThreadsService.addNewStagingSelection(selection);
		setLocalAttachments(previous => previous.some(item => item.uri === attachment.uri && item.dataUrl === attachment.dataUrl) ? previous : [...previous, { ...attachment, name: attachment.uri.split(/[\\/]/).pop() || attachment.uri }]);
	}, [notify, slashContext]);

	const handlePickFiles = useCallback(async () => {
		if (!slashContext) { notify('File attachment service is unavailable.', 'warn'); return; }
		try {
			const resources = await slashContext.accessor.get(IFileDialogService).showOpenDialog({
				title: 'Attach files to Forge',
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: true,
				openLabel: 'Attach',
				filters: [{ name: 'Code and documents', extensions: ['pdf', 'txt', 'md', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'json', 'jsonl', 'css', 'scss', 'html', 'svg', 'xml', 'yaml', 'yml', 'toml', 'rs', 'go', 'java', 'kt', 'kts', 'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'rb', 'sh', 'ps1', 'sql'] }],
			});
			if (!resources?.length) return;
			for (const resource of resources) {
				const filePath = resource.fsPath;
				const language = filePath.split('.').pop() || '';
				const selection: StagingSelectionItem = { type: 'File', uri: resource, language, state: { wasAddedAsCurrentFile: false } };
				slashContext.chatThreadsService.addNewStagingSelection(selection);
				setLocalAttachments(previous => previous.some(item => URI.file(item.uri).fsPath === filePath) ? previous : [...previous, { uri: filePath, name: filePath.split(/[\\/]/).pop() || filePath, mimeType: mimeTypeForFile(filePath) }]);
			}
		} catch (error) {
			console.warn('[Forge Chat] Native file picker failed:', error);
			notify(`Could not attach file: ${error instanceof Error ? error.message : String(error)}`, 'error');
		}
	}, [notify, slashContext]);

	const removeStagedAttachment = useCallback((attachment: Attachment) => {
		if (!slashContext) return;
		const threadState = slashContext.chatThreadsService.getCurrentThreadState();
		const fsPath = URI.file(attachment.uri).fsPath;
		const isImage = attachment.mimeType.startsWith('image/');
		const next = threadState.stagingSelections.filter(selection => selection.uri.fsPath !== fsPath || (isImage ? selection.type !== 'Image' : selection.type !== 'File'));
		if (next.length !== threadState.stagingSelections.length) slashContext.chatThreadsService.setCurrentThreadState({ stagingSelections: next });
	}, [slashContext]);

	const handleRemoveAttachment = useCallback((index: number) => {
		if (index < attachments.length) { onRemoveAttachment?.(index); return; }
		const localIndex = index - attachments.length;
		const attachment = localAttachments[localIndex];
		if (!attachment) return;
		removeStagedAttachment(attachment);
		setLocalAttachments(previous => previous.filter((_, i) => i !== localIndex));
	}, [attachments.length, localAttachments, onRemoveAttachment, removeStagedAttachment]);

	const handleSuggestion = useCallback((text: string) => { void sendWithAdaptiveModel(text); }, [sendWithAdaptiveModel]);
	const handleOpenCommands = useCallback((event: React.MouseEvent<HTMLButtonElement>) => { setSlashAnchor(event.currentTarget.getBoundingClientRect()); setIsSlashOpen(true); }, []);
	const handleSlashSelect = useCallback((cmd: SlashCommand, args: string) => {
		setIsSlashOpen(false);
		setSlashAnchor(null);
		if (cmd.category === 'Skills (Registry)' && !args) { setDraftText(`${cmd.name} `); setTimeout(() => textareaRef.current?.focus(), 50); return; }
		if (slashContext) void cmd.execute({ ...slashContext, args });
	}, [slashContext]);

	const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === '/' && !draftText && !isSlashOpen) { event.preventDefault(); setSlashAnchor(event.currentTarget.getBoundingClientRect()); setIsSlashOpen(true); return; }
		if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void handleSend(); return; }
		if (event.key === 'Escape' && isSlashOpen) { setIsSlashOpen(false); setSlashAnchor(null); }
	}, [draftText, handleSend, isSlashOpen]);

	const lastAssistantIndex = [...messages].reverse().findIndex(message => message.role === 'assistant');
	const streamEventsForLastResponse = lastAssistantIndex >= 0 ? streamState.events : [];

	return <div className={`flex flex-1 min-w-0 min-h-0 flex-col h-full bg-void-bg-1 ${className}`}>
		{slashContext && <SlashCommandPalette isOpen={isSlashOpen} onClose={() => { setIsSlashOpen(false); setSlashAnchor(null); }} onSelect={handleSlashSelect} anchorRect={slashAnchor} context={slashContext} />}
		<div className='flex-1 overflow-y-auto'>
			{messages.length === 0 ? <EmptyState onSuggestionClick={handleSuggestion} onCommandsClick={handleOpenCommands} /> : <>
				{messages.map((message, index) => {
					const revert = message.messageIndex === undefined ? undefined : () => onRevertMessage?.(message.messageIndex!);
					const copy = message.content ? () => { void copyText(message.content); } : undefined;
					if (message.role === 'user') return <UserMessage key={message.id} message={message} onRevert={revert} onCopy={copy} />;
					const isLastAssistant = index === messages.length - 1;
					return <AssistantMessage key={message.id} message={message} streamEvents={isLastAssistant ? streamEventsForLastResponse : []} isStreaming={isStreaming && isLastAssistant} onRevert={revert} onCopy={copy} onDuplicateThread={slashContext ? duplicateCurrentThread : undefined} onFeedback={slashContext ? rating => recordFeedback(message, rating) : undefined} />;
				})}
				{isStreaming && streamState.events.length > 0 && !messages.some(message => message.role === 'assistant' && message.timestamp > Date.now() - 5000) && <div className='flex gap-3 py-3 px-4'><div className='w-7 h-7 rounded-lg bg-emerald-600/10 border border-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5'><Sparkles size={14} className='text-emerald-400' /></div><div className='flex-1 min-w-0'><StreamRenderer events={streamEventsForLastResponse} /></div></div>}
				<div ref={messagesEndRef} />
			</>}
		</div>
		<ComposerControlCenter
			value={draftText}
			onChange={setDraftText}
			onSubmit={() => { void handleSend(); }}
			onAbort={handleAbort}
			isStreaming={isStreaming}
			isDisabled={false}
			workspaceReady={workspaceReady}
			workspaceFileCount={workspaceFileCount}
			selectedFiles={selectedFiles}
			providerName={providerName}
			modelName={modelName}
			onOpenSettings={onOpenSettings}
			tokenCount={tokenCount}
			maxTokens={maxTokens}
			attachments={effectiveAttachments}
			onAddAttachment={handleAddAttachment}
			onPickFiles={handlePickFiles}
			onAttachmentError={message => notify(message, 'warn')}
			onRemoveAttachment={handleRemoveAttachment}
			placeholder='Ask Forge to complete a task…'
			onKeyDown={handleKeyDown}
			textareaRef={textareaRef}
		/>
	</div>;
};
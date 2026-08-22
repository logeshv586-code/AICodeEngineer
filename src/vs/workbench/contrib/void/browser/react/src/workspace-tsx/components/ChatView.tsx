/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Sparkles, RotateCcw, Copy, GitFork, ThumbsUp, ThumbsDown } from 'lucide-react';
import { URI } from '../../../../../../../base/common/uri.js';
import { INotificationService } from '../../../../../../../platform/notification/common/notification.js';
import { IFileDialogService } from '../../../../../../../platform/dialogs/common/dialogs.js';
import { SlashCommandPalette, SlashCommandContext, SlashCommand } from '../utils/slashCommandRouter';
import { StreamRenderer } from './StreamRenderer';
import { ComposerControlCenter, Attachment, NewAttachment } from './ComposerControlCenter';
import { ForgeBrandMark } from './ForgeBrandMark';
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

const EmptyState: React.FC = () => (
	<div className='flex h-full items-center justify-center select-none px-5 py-8'>
		<div className='forge-brand-empty-card text-center'>
			<div className='flex justify-center mb-3'><ForgeBrandMark size={42} /></div>
			<div className='text-[15px] font-medium tracking-[-0.015em] text-[var(--forge-text)]'>How can Forge help with this project?</div>
			<div className='text-[10.5px] leading-relaxed text-[var(--forge-muted)] mt-2 max-w-[420px] mx-auto'>Describe what you want to change or build. Forge will inspect the project, use the right tools and skills, make the changes, and verify the result.</div>
		</div>
	</div>
);

const MessageActions: React.FC<{ onRevert?: () => void; onCopy?: () => void; onDuplicateThread?: () => void }> = ({ onRevert, onCopy, onDuplicateThread }) => {
	if (!onRevert && !onCopy && !onDuplicateThread) return null;
	return <div className='absolute right-2 top-2 hidden group-hover:flex items-center gap-0.5 rounded-lg border border-[var(--forge-line)] bg-[var(--forge-bg-1)]/95 p-0.5 shadow-xl z-10'>
		{onCopy && <button type='button' onClick={onCopy} title='Copy message' aria-label='Copy message' className='forge-brand-tool w-6 h-6 flex items-center justify-center rounded-md'><Copy size={11} /></button>}
		{onDuplicateThread && <button type='button' onClick={onDuplicateThread} title='Duplicate thread' aria-label='Duplicate thread' className='forge-brand-tool w-6 h-6 flex items-center justify-center rounded-md'><GitFork size={11} /></button>}
		{onRevert && <button type='button' onClick={onRevert} title='Revert to here' aria-label='Revert to here' className='forge-brand-tool w-6 h-6 flex items-center justify-center rounded-md'><RotateCcw size={11} /></button>}
	</div>;
};

const UserMessage: React.FC<{ message: ChatViewMessage; onRevert?: () => void; onCopy?: () => void }> = ({ message, onRevert, onCopy }) => (
	<div className='flex justify-end px-5 py-3'>
		<div className='group forge-brand-user-bubble relative max-w-[82%] rounded-2xl rounded-tr-md px-3.5 py-2.5'>
			<MessageActions onRevert={onRevert} onCopy={onCopy} />
			<div className='flex items-center gap-2 mb-1'><span className='text-[9.5px] font-medium text-[var(--forge-muted)]'>You</span><span className='text-[8.5px] text-[var(--forge-muted-2)]'>{new Date(message.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span></div>
			<div className='text-[12.5px] leading-relaxed text-[var(--forge-text)] whitespace-pre-wrap break-words'>{message.content}</div>
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

	return <div className='forge-brand-assistant-row group relative flex gap-3 px-5 py-4'>
		<MessageActions onRevert={onRevert} onCopy={onCopy} onDuplicateThread={onDuplicateThread} />
		<div className='shrink-0 mt-0.5'><ForgeBrandMark size={29} /></div>
		<div className='flex-1 min-w-0 max-w-[900px]'>
			<div className='flex items-center gap-2 mb-1.5'><span className='text-[10.5px] font-semibold text-[var(--forge-text-2)]'>Forge</span><span className='text-[8.5px] text-[var(--forge-muted-2)]'>{new Date(message.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span></div>
			{hasActiveWork && <div className='text-[11px] leading-relaxed text-[var(--forge-cyan)] mb-2'>{displayEvents.filter(event => event.status === 'active').map(event => event.label).join(' · ')}</div>}
			{message.content && <div className='text-[12.5px] leading-[1.62] text-[var(--forge-text-2)] whitespace-pre-wrap break-words'>{message.content}</div>}
			{displayEvents.length > 0 && <StreamRenderer events={displayEvents} className='mt-2.5' />}
			{isStreaming && <div className='flex items-center gap-1.5 mt-2.5 text-[var(--forge-muted)]'><Sparkles size={10} className='text-[var(--forge-cyan)] animate-pulse' /><span className='text-[9.5px] animate-pulse'>Working through the task…</span></div>}
			{!isStreaming && message.content && onFeedback && <div className='flex items-center gap-1 mt-2.5'>
				<button type='button' onClick={() => submitFeedback('positive')} title='Helpful response' className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${feedback === 'positive' ? 'text-[var(--forge-success)] bg-emerald-500/10' : 'forge-brand-tool'}`}><ThumbsUp size={11} /></button>
				<button type='button' onClick={() => submitFeedback('negative')} title='Unhelpful response' className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${feedback === 'negative' ? 'text-[var(--forge-danger)] bg-red-500/10' : 'forge-brand-tool'}`}><ThumbsDown size={11} /></button>
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
	messages, isStreaming = false, onSendMessage, slashContext, className = '', workspaceReady = false,
	workspaceFileCount, selectedFiles = [], providerName, modelName, onOpenSettings, tokenCount, maxTokens,
	attachments = [], onRemoveAttachment, onRevertMessage,
}) => {
	const [isSlashOpen, setIsSlashOpen] = useState(false);
	const [slashAnchor, setSlashAnchor] = useState<DOMRect | null>(null);
	const [draftText, setDraftText] = useState('');
	const [localAttachments, setLocalAttachments] = useState<Attachment[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
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
		const threadId = slashContext.chatThreadsService.state.currentThreadId;
		if (!threadId) { notify('There is no thread to duplicate yet.', 'warn'); return; }
		try { slashContext.chatThreadsService.duplicateThread(threadId); notify('Thread duplicated.'); }
		catch (error) { console.warn('[Forge Chat] Could not duplicate thread:', error); notify('Could not duplicate this thread.', 'warn'); }
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

	const sendWithAdaptiveModel = useCallback(async (text: string): Promise<boolean> => {
		const trimmed = text.trim();
		if (!trimmed) return false;
		if (await handleLocalSkillCommand(trimmed)) return false;

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
				if (!settingsService.state.modelSelectionOfFeature.Chat) {
					notify('Choose a Chat model before sending a task. Forge opened model settings for you.', 'warn');
					onOpenSettings?.();
					return false;
				}
			} catch (error) {
				console.warn('[Forge Model Router] Falling back to current model:', error);
			}
		}

		await Promise.resolve(onSendMessage(trimmed));
		return true;
	}, [handleLocalSkillCommand, notify, onOpenSettings, onSendMessage, slashContext]);

	const handleSend = useCallback(async () => {
		if (isStreaming || isSubmitting) return;
		const text = draftText.trim() || (effectiveAttachments.length > 0 ? 'Inspect the attached context and complete the requested work. Read relevant files first, make the necessary changes, and verify the result.' : '');
		if (!text) return;
		setIsSubmitting(true);
		try {
			const sent = await sendWithAdaptiveModel(text);
			if (!sent) return;
			setDraftText('');
			setLocalAttachments([]);
			if (textareaRef.current) textareaRef.current.style.height = 'auto';
		} catch (error) {
			console.error('[Forge Chat] Task submission failed:', error);
			notify(`Forge could not start this task: ${error instanceof Error ? error.message : String(error)}`, 'error');
		} finally {
			setIsSubmitting(false);
		}
	}, [draftText, effectiveAttachments.length, isStreaming, isSubmitting, notify, sendWithAdaptiveModel]);

	const handleAbort = useCallback(async () => {
		if (!slashContext) return;
		const threadId = slashContext.chatThreadsService.state.currentThreadId;
		if (!threadId) return;
		try { await slashContext.chatThreadsService.abortRunning(threadId); }
		catch (error) { console.warn('[Forge Chat] Abort failed:', error); notify('Could not stop the current run.', 'warn'); }
	}, [notify, slashContext]);

	const handleAddAttachment = useCallback((attachment: NewAttachment) => {
		if (!slashContext) { notify('Attachment service is unavailable in this view.', 'warn'); return; }
		if (!attachment.mimeType.startsWith('image/') || !attachment.dataUrl) { notify('Use the paperclip button for non-image files.', 'warn'); return; }
		const uri = URI.file(attachment.uri);
		const selection: StagingSelectionItem = { type: 'Image', uri, dataUrl: attachment.dataUrl, mimeType: attachment.mimeType };
		slashContext.chatThreadsService.addNewStagingSelection(selection);
		setLocalAttachments(previous => previous.some(item => item.uri === attachment.uri && item.dataUrl === attachment.dataUrl) ? previous : [...previous, { ...attachment, name: attachment.uri.split(/[\\/]/).pop() || attachment.uri }]);
	}, [notify, slashContext]);

	const handlePickFiles = useCallback(async () => {
		if (!slashContext) { notify('File attachment service is unavailable.', 'warn'); return; }
		try {
			const resources = await slashContext.accessor.get(IFileDialogService).showOpenDialog({
				title: 'Attach files to Forge', canSelectFiles: true, canSelectFolders: false, canSelectMany: true, openLabel: 'Attach',
				filters: [{ name: 'Code and documents', extensions: ['pdf', 'txt', 'md', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'json', 'jsonl', 'css', 'scss', 'html', 'svg', 'xml', 'yaml', 'yml', 'toml', 'rs', 'go', 'java', 'kt', 'kts', 'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'rb', 'sh', 'ps1', 'sql'] }],
			});
			if (!resources?.length) return;
			for (const resource of resources) {
				const filePath = resource.fsPath;
				const selection: StagingSelectionItem = { type: 'File', uri: resource, language: filePath.split('.').pop() || '', state: { wasAddedAsCurrentFile: false } };
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

	const handleSlashSelect = useCallback((cmd: SlashCommand, args: string) => {
		setIsSlashOpen(false);
		setSlashAnchor(null);
		if (cmd.category === 'Skills (Registry)' && !args) { setDraftText(`${cmd.name} `); setTimeout(() => textareaRef.current?.focus(), 50); return; }
		if (slashContext) void Promise.resolve(cmd.execute({ ...slashContext, args })).catch(error => { console.error('[Forge Slash] Command failed:', error); notify(`Command ${cmd.name} failed: ${error instanceof Error ? error.message : String(error)}`, 'error'); });
	}, [notify, slashContext]);

	const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === '/' && !draftText && !isSlashOpen) { event.preventDefault(); setSlashAnchor(event.currentTarget.getBoundingClientRect()); setIsSlashOpen(true); return; }
		if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void handleSend(); return; }
		if (event.key === 'Escape' && isSlashOpen) { setIsSlashOpen(false); setSlashAnchor(null); }
	}, [draftText, handleSend, isSlashOpen]);

	const lastAssistantIndex = [...messages].reverse().findIndex(message => message.role === 'assistant');
	const streamEventsForLastResponse = lastAssistantIndex >= 0 ? streamState.events : [];

	return <div className={`forge-brand-chat flex flex-1 min-w-0 min-h-0 flex-col h-full ${className}`}>
		{slashContext && <SlashCommandPalette isOpen={isSlashOpen} onClose={() => { setIsSlashOpen(false); setSlashAnchor(null); }} onSelect={handleSlashSelect} anchorRect={slashAnchor} context={slashContext} />}
		<div className='forge-brand-scroll flex-1 overflow-y-auto'>
			<div className='mx-auto w-full max-w-[980px] min-h-full'>
				{messages.length === 0 ? <EmptyState /> : <>
					{messages.map((message, index) => {
						const revert = message.messageIndex === undefined ? undefined : () => onRevertMessage?.(message.messageIndex!);
						const copy = message.content ? () => { void copyText(message.content); } : undefined;
						if (message.role === 'user') return <UserMessage key={message.id} message={message} onRevert={revert} onCopy={copy} />;
						const isLastAssistant = index === messages.length - 1;
						return <AssistantMessage key={message.id} message={message} streamEvents={isLastAssistant ? streamEventsForLastResponse : []} isStreaming={isStreaming && isLastAssistant} onRevert={revert} onCopy={copy} onDuplicateThread={slashContext ? duplicateCurrentThread : undefined} onFeedback={slashContext ? rating => recordFeedback(message, rating) : undefined} />;
					})}
					{isStreaming && streamState.events.length > 0 && !messages.some(message => message.role === 'assistant' && message.timestamp > Date.now() - 5000) && <div className='forge-brand-assistant-row flex gap-3 px-5 py-4'><ForgeBrandMark size={29} /><div className='flex-1 min-w-0'><StreamRenderer events={streamEventsForLastResponse} /></div></div>}
					<div ref={messagesEndRef} />
				</>}
			</div>
		</div>
		<ComposerControlCenter
			value={draftText} onChange={setDraftText} onSubmit={() => { void handleSend(); }} onAbort={handleAbort}
			isStreaming={isStreaming} isDisabled={isSubmitting} workspaceReady={workspaceReady} workspaceFileCount={workspaceFileCount}
			selectedFiles={selectedFiles} providerName={providerName} modelName={modelName} onOpenSettings={onOpenSettings}
			tokenCount={tokenCount} maxTokens={maxTokens} attachments={effectiveAttachments} onAddAttachment={handleAddAttachment}
			onPickFiles={handlePickFiles} onAttachmentError={message => notify(message, 'warn')} onRemoveAttachment={handleRemoveAttachment}
			placeholder={isSubmitting ? 'Starting the task…' : 'Describe the outcome you want Forge to deliver…'} onKeyDown={handleKeyDown} textareaRef={textareaRef}
		/>
	</div>;
};

/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useMemo, useRef } from 'react';
import {
	Send,
	Square,
	Paperclip,
	Image as ImageIcon,
	Mic,
	X,
	Sparkles,
	HardDrive,
	FileText,
	Settings,
} from 'lucide-react';

export interface Attachment {
	readonly uri: string;
	readonly name?: string;
	readonly mimeType: string;
	readonly dataUrl?: string;
}

export interface NewAttachment {
	readonly uri: string;
	readonly dataUrl: string;
	readonly mimeType: string;
}

export interface ComposerControlCenterProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	onAbort: () => void | Promise<void>;
	isStreaming: boolean;
	isDisabled?: boolean;
	workspaceReady?: boolean;
	workspaceFileCount?: number;
	selectedFiles?: string[];
	providerName?: string;
	modelName?: string;
	onOpenSettings?: () => void;
	tokenCount?: number;
	maxTokens?: number;
	attachments?: Attachment[];
	onAddAttachment?: (attachment: NewAttachment) => void;
	onPickFiles?: () => void | Promise<void>;
	onAttachmentError?: (message: string) => void;
	onRemoveAttachment?: (index: number) => void;
	canUseVoice?: boolean;
	isListening?: boolean;
	onVoiceToggle?: () => void;
	onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
	placeholder?: string;
	textareaRef?: React.Ref<HTMLTextAreaElement>;
}

const attachmentName = (attachment: Attachment): string => attachment.name || attachment.uri.split(/[\\/]/).pop() || attachment.uri;

export const ComposerControlCenter: React.FC<ComposerControlCenterProps> = ({
	value,
	onChange,
	onSubmit,
	onAbort,
	isStreaming,
	isDisabled = false,
	workspaceReady = false,
	workspaceFileCount,
	selectedFiles = [],
	providerName,
	modelName,
	onOpenSettings,
	tokenCount,
	maxTokens,
	attachments = [],
	onAddAttachment,
	onPickFiles,
	onAttachmentError,
	onRemoveAttachment,
	canUseVoice = false,
	isListening = false,
	onVoiceToggle,
	onKeyDown: onComposerKeyDown,
	placeholder = 'How can I help?',
	textareaRef,
}) => {
	const imageInputRef = useRef<HTMLInputElement>(null);
	const canSubmit = !isDisabled && (value.trim().length > 0 || attachments.length > 0);

	const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault();
			if (!isStreaming && canSubmit) onSubmit();
		}
	}, [canSubmit, isStreaming, onSubmit]);

	const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		onChange(e.target.value);
		const target = e.target;
		target.style.height = 'auto';
		target.style.height = Math.min(target.scrollHeight, 200) + 'px';
	}, [onChange]);

	const addImages = useCallback((files: File[]) => {
		if (!onAddAttachment) return;
		for (const file of files.filter(file => file.type.startsWith('image/'))) {
			const reader = new FileReader();
			reader.onload = event => {
				onAddAttachment({ uri: file.name, dataUrl: String(event.target?.result || ''), mimeType: file.type || 'image/png' });
			};
			reader.onerror = () => onAttachmentError?.(`Could not read image ${file.name}.`);
			reader.readAsDataURL(file);
		}
	}, [onAddAttachment, onAttachmentError]);

	const handleImageInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		addImages(Array.from(event.target.files || []));
		event.target.value = '';
	}, [addImages]);

	const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		const files = Array.from(event.dataTransfer.files || []);
		const images = files.filter(file => file.type.startsWith('image/'));
		const nonImages = files.filter(file => !file.type.startsWith('image/'));
		if (images.length) addImages(images);
		if (nonImages.length) onAttachmentError?.('Drop supports images directly. Use the paperclip button for code, documents, and other files so Forge receives the real filesystem URI.');
	}, [addImages, onAttachmentError]);

	const contextPercent = useMemo(() => {
		if (tokenCount === undefined || !maxTokens) return null;
		return Math.max(0, Math.min(100, Math.round((tokenCount / maxTokens) * 100)));
	}, [tokenCount, maxTokens]);

	return (
		<div className='shrink-0 border-t border-zinc-800/40 bg-zinc-900/20' onDragOver={event => event.preventDefault()} onDrop={handleDrop}>
			<input ref={imageInputRef} type='file' multiple accept='image/*' className='hidden' onChange={handleImageInput} />

			{(workspaceReady || selectedFiles.length > 0 || attachments.length > 0 || providerName) && (
				<div className='flex items-center gap-1.5 px-3 pt-1.5 flex-wrap'>
					{workspaceReady && <span className='inline-flex items-center gap-1 text-[9px] text-zinc-500 bg-zinc-800/40 px-1.5 py-0.5 rounded border border-zinc-700/30'><HardDrive size={8} />{workspaceFileCount ? `${workspaceFileCount.toLocaleString()} files` : 'Workspace ready'}</span>}
					{selectedFiles.slice(0, 3).map(file => <span key={file} className='inline-flex items-center gap-1 text-[9px] text-zinc-500 bg-zinc-800/40 px-1.5 py-0.5 rounded border border-zinc-700/30 max-w-[120px]'><FileText size={8} className='shrink-0' /><span className='truncate'>{file.split(/[\\/]/).pop()}</span></span>)}
					{selectedFiles.length > 3 && <span className='text-[9px] text-zinc-600'>+{selectedFiles.length - 3}</span>}
					{attachments.map((att, i) => <span key={`${att.uri}-${i}`} className='inline-flex items-center gap-1 text-[9px] text-zinc-500 bg-zinc-800/40 px-1.5 py-0.5 rounded border border-zinc-700/30 max-w-[140px]'><Paperclip size={8} /><span className='truncate'>{attachmentName(att)}</span>{onRemoveAttachment && <button type='button' onClick={() => onRemoveAttachment(i)} className='text-zinc-600 hover:text-red-400 cursor-pointer ml-0.5' title={`Remove ${attachmentName(att)}`} aria-label={`Remove ${attachmentName(att)}`}><X size={8} /></button>}</span>)}
					{(providerName || modelName) && onOpenSettings && <button type='button' onClick={onOpenSettings} className='inline-flex items-center gap-1 text-[9px] text-zinc-500 bg-zinc-800/40 px-1.5 py-0.5 rounded border border-zinc-700/30 cursor-pointer hover:text-zinc-300 hover:border-zinc-600 transition-colors' title='Model settings'><Sparkles size={8} /><span className='truncate max-w-[100px]'>{modelName || providerName}</span></button>}
					{contextPercent !== null && <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${contextPercent > 80 ? 'text-red-400 bg-red-500/10 border border-red-500/20' : contextPercent > 50 ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' : 'text-zinc-500 bg-zinc-800/40 border border-zinc-700/30'}`} title={`${tokenCount?.toLocaleString() ?? 0} / ${maxTokens?.toLocaleString() ?? 0} context tokens`}>{contextPercent}%</span>}
				</div>
			)}

			<div className='flex items-end gap-1.5 px-3 py-2'>
				<button type='button' onClick={() => { if (onPickFiles) void onPickFiles(); }} disabled={!onPickFiles || isDisabled} className='w-7 h-7 flex items-center justify-center rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed' title={onPickFiles ? 'Attach code or document files' : 'File attachments unavailable'} aria-label='Attach code or document files'><Paperclip size={14} /></button>
				<button type='button' onClick={() => imageInputRef.current?.click()} disabled={!onAddAttachment || isDisabled} className='w-7 h-7 flex items-center justify-center rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed' title='Attach images' aria-label='Attach images'><ImageIcon size={14} /></button>

				<textarea ref={textareaRef as React.Ref<HTMLTextAreaElement>} value={value} onChange={handleTextareaChange} onKeyDown={onComposerKeyDown ?? handleKeyDown} placeholder={placeholder} disabled={isDisabled} rows={1} className='flex-1 bg-transparent text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none resize-none leading-relaxed py-1.5 max-h-[200px] disabled:opacity-40' />

				{canUseVoice && <button type='button' onClick={onVoiceToggle} disabled={!onVoiceToggle || isDisabled} className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors cursor-pointer shrink-0 disabled:opacity-30 ${isListening ? 'text-red-400 bg-red-500/10 animate-pulse' : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800'}`} title={isListening ? 'Stop voice input' : 'Voice input'}><Mic size={14} /></button>}

				<button type='button' onClick={() => { if (isStreaming) void onAbort(); else onSubmit(); }} disabled={!isStreaming && !canSubmit} className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors cursor-pointer shrink-0 ${isStreaming ? 'text-red-400 hover:bg-red-500/10' : canSubmit ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-zinc-700 cursor-not-allowed'}`} title={isStreaming ? 'Stop current agent run' : attachments.length > 0 && !value.trim() ? 'Send attached context' : 'Send (Enter)'} aria-label={isStreaming ? 'Stop current agent run' : 'Send message'}>{isStreaming ? <Square size={14} /> : <Send size={14} />}</button>
			</div>

			<div className='flex items-center justify-between px-3 pb-1.5'>
				<span className='text-[9px] text-zinc-700'>{isStreaming ? 'Stop cancels the active run · new instructions can be queued from the main chat' : 'Enter to send · Shift+Enter for a new line · / for commands · paperclip for files · image button/drop for images'}</span>
				{onOpenSettings && <button type='button' onClick={onOpenSettings} className='text-[9px] text-zinc-700 hover:text-zinc-500 cursor-pointer transition-colors' title='Open Forge settings' aria-label='Open Forge settings'><Settings size={9} /></button>}
			</div>
		</div>
	);
};
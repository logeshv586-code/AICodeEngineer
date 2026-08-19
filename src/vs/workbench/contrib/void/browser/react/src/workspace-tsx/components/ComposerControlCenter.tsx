/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useMemo, useRef } from 'react';
import { Send, Square, Paperclip, Image as ImageIcon, Mic, X, Sparkles, HardDrive, FileText, Settings, Command } from 'lucide-react';

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
	value, onChange, onSubmit, onAbort, isStreaming, isDisabled = false,
	workspaceReady = false, workspaceFileCount, selectedFiles = [], providerName, modelName,
	onOpenSettings, tokenCount, maxTokens, attachments = [], onAddAttachment, onPickFiles,
	onAttachmentError, onRemoveAttachment, canUseVoice = false, isListening = false,
	onVoiceToggle, onKeyDown: onComposerKeyDown, placeholder = 'Describe the outcome you want…', textareaRef,
}) => {
	const imageInputRef = useRef<HTMLInputElement>(null);
	const canSubmit = !isDisabled && (value.trim().length > 0 || attachments.length > 0);

	const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
			event.preventDefault();
			if (!isStreaming && canSubmit) onSubmit();
		}
	}, [canSubmit, isStreaming, onSubmit]);

	const handleTextareaChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
		onChange(event.target.value);
		const target = event.target;
		target.style.height = 'auto';
		target.style.height = Math.min(target.scrollHeight, 220) + 'px';
	}, [onChange]);

	const addImages = useCallback((files: File[]) => {
		if (!onAddAttachment) return;
		for (const file of files.filter(item => item.type.startsWith('image/'))) {
			const reader = new FileReader();
			reader.onload = event => onAddAttachment({ uri: file.name, dataUrl: String(event.target?.result || ''), mimeType: file.type || 'image/png' });
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
		if (images.length) addImages(images);
		if (files.length > images.length) onAttachmentError?.('Drop images directly. For code and documents, use the paperclip so Forge receives the real local file URI.');
	}, [addImages, onAttachmentError]);

	const contextPercent = useMemo(() => {
		if (tokenCount === undefined || !maxTokens) return null;
		return Math.max(0, Math.min(100, Math.round((tokenCount / maxTokens) * 100)));
	}, [tokenCount, maxTokens]);

	return (
		<div className='forge-brand-composer-shell shrink-0' onDragOver={event => event.preventDefault()} onDrop={handleDrop}>
			<input ref={imageInputRef} type='file' multiple accept='image/*' className='hidden' onChange={handleImageInput} />
			<div className='forge-brand-composer'>
				{(workspaceReady || selectedFiles.length > 0 || attachments.length > 0 || providerName || modelName || contextPercent !== null) && <div className='flex items-center gap-1.5 px-3 pt-2.5 flex-wrap'>
					{workspaceReady && <span className='forge-brand-chip inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md'><HardDrive size={8} />{workspaceFileCount ? `${workspaceFileCount.toLocaleString()} files` : 'Workspace'}</span>}
					{selectedFiles.slice(0, 3).map(file => <span key={file} className='forge-brand-chip inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md max-w-[125px]'><FileText size={8} /><span className='truncate'>{file.split(/[\\/]/).pop()}</span></span>)}
					{selectedFiles.length > 3 && <span className='text-[9px] text-[var(--forge-muted)]'>+{selectedFiles.length - 3}</span>}
					{attachments.map((attachment, index) => <span key={`${attachment.uri}-${index}`} className='forge-brand-chip inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md max-w-[150px]'><Paperclip size={8} /><span className='truncate'>{attachmentName(attachment)}</span>{onRemoveAttachment && <button type='button' onClick={() => onRemoveAttachment(index)} className='text-[var(--forge-muted-2)] hover:text-[var(--forge-danger)] ml-0.5' title={`Remove ${attachmentName(attachment)}`}><X size={8} /></button>}</span>)}
					{(providerName || modelName) && onOpenSettings && <button type='button' onClick={onOpenSettings} className='forge-brand-chip inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md cursor-pointer hover:text-[var(--forge-text-2)]' title='Model settings' aria-label='Open AI model settings'><Sparkles size={8} /><span>Model</span></button>}
					{contextPercent !== null && <span className={`inline-flex items-center text-[9px] px-1.5 py-0.5 rounded-md border ${contextPercent > 80 ? 'text-red-300 bg-red-500/10 border-red-400/20' : contextPercent > 55 ? 'text-amber-300 bg-amber-500/10 border-amber-400/20' : 'forge-brand-chip'}`} title={`${tokenCount?.toLocaleString() ?? 0} / ${maxTokens?.toLocaleString() ?? 0} context tokens`}>{contextPercent}% context</span>}
				</div>}

				<div className='flex items-end gap-2 px-3 pt-2 pb-2'>
					<textarea ref={textareaRef as React.Ref<HTMLTextAreaElement>} value={value} onChange={handleTextareaChange} onKeyDown={onComposerKeyDown ?? handleKeyDown} placeholder={placeholder} disabled={isDisabled} rows={1} className='flex-1 bg-transparent text-[13px] text-[var(--forge-text)] placeholder:text-[var(--forge-muted-2)] outline-none resize-none leading-relaxed py-2 max-h-[220px] disabled:opacity-40' />
					<button type='button' onClick={() => { if (isStreaming) void onAbort(); else onSubmit(); }} disabled={!isStreaming && !canSubmit} className={`w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-all ${isStreaming ? 'text-[var(--forge-danger)] bg-red-500/10 hover:bg-red-500/15' : canSubmit ? 'forge-brand-send cursor-pointer' : 'text-[var(--forge-muted-2)] bg-white/[0.025] cursor-not-allowed'}`} title={isStreaming ? 'Stop current agent run' : 'Send task'} aria-label={isStreaming ? 'Stop current agent run' : 'Send task'}>{isStreaming ? <Square size={14} /> : <Send size={14} />}</button>
				</div>

				<div className='flex items-center justify-between gap-2 px-2.5 pb-2'>
					<div className='flex items-center gap-1'>
						<button type='button' onClick={() => { if (onPickFiles) void onPickFiles(); }} disabled={!onPickFiles || isDisabled} className='forge-brand-tool w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer disabled:opacity-30' title='Attach code or document files'><Paperclip size={13} /></button>
						<button type='button' onClick={() => imageInputRef.current?.click()} disabled={!onAddAttachment || isDisabled} className='forge-brand-tool w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer disabled:opacity-30' title='Attach images'><ImageIcon size={13} /></button>
						{canUseVoice && <button type='button' onClick={onVoiceToggle} disabled={!onVoiceToggle || isDisabled} className={`forge-brand-tool w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer disabled:opacity-30 ${isListening ? '!text-[var(--forge-danger)] !bg-red-500/10 animate-pulse' : ''}`} title={isListening ? 'Stop voice input' : 'Voice input'}><Mic size={13} /></button>}
						<span className='forge-brand-chip h-8 px-2 flex items-center gap-1 rounded-lg text-[9px]'><Command size={10} /> / commands</span>
					</div>
					<div className='flex items-center gap-2 text-[8.5px] text-[var(--forge-muted-2)]'><span>{isStreaming ? 'Forge is working — Stop cancels safely' : 'Enter sends · Shift+Enter adds a line'}</span>{onOpenSettings && <button type='button' onClick={onOpenSettings} className='forge-brand-tool w-7 h-7 flex items-center justify-center rounded-lg' title='Forge settings'><Settings size={10} /></button>}</div>
				</div>
			</div>
		</div>
	);
};
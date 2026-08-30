/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useRef } from 'react';
import { AtSign, Command, Paperclip, Plus, Send, Square, X } from 'lucide-react';
import { ModelDropdown } from '../../void-settings-tsx/ModelDropdown.tsx';

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
	selectedFiles = [],
	attachments = [], onAddAttachment, onPickFiles, onAttachmentError, onRemoveAttachment,
	onKeyDown: onComposerKeyDown, placeholder = 'Describe the outcome you want Forge to deliver…', textareaRef,
}) => {
	const imageInputRef = useRef<HTMLInputElement>(null);
	const canSubmit = !isDisabled && (value.trim().length > 0 || attachments.length > 0);

	const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
			event.preventDefault();
			if (!isStreaming && canSubmit) onSubmit();
		}
	}, [canSubmit, isStreaming, onSubmit]);

	const handleCommandsClick = useCallback(() => {
		if (isDisabled) return;
		const element = textareaRef && typeof textareaRef === 'object' && 'current' in textareaRef
			? textareaRef.current
			: null;
		if (!element) return;
		element.focus();
		// Reuse the exact same key path as a physical `/` press so the parent
		// chat view opens the real SlashCommandPalette instead of maintaining a
		// second command implementation here.
		element.dispatchEvent(new KeyboardEvent('keydown', {
			key: '/',
			code: 'Slash',
			bubbles: true,
			cancelable: true,
		}));
	}, [isDisabled, textareaRef]);

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

	const contextCount = selectedFiles.length + attachments.length;
	return (
		<div className='forge-brand-composer-shell forge-right-composer-shell shrink-0' onDragOver={event => event.preventDefault()} onDrop={handleDrop}>
			<input ref={imageInputRef} type='file' multiple accept='image/*' className='hidden' onChange={handleImageInput} />

			<div className='forge-right-composer-row'>
				<button
					type='button'
					className='forge-right-plus-button'
					onClick={() => imageInputRef.current?.click()}
					disabled={!onAddAttachment || isDisabled}
					title='Add image context'
					aria-label='Add image context'
				>
					<Plus size={15} />
				</button>

				<div className='forge-brand-composer forge-right-composer'>
					{contextCount > 0 && <div className='flex items-center gap-1.5 px-2.5 pt-2 flex-wrap'>
						{selectedFiles.slice(0, 2).map(file => <span key={file} className='forge-brand-chip inline-flex items-center gap-1 text-[8.5px] px-1.5 py-0.5 rounded-md max-w-[135px]'><Paperclip size={8} /><span className='truncate'>{file.split(/[\\/]/).pop()}</span></span>)}
						{attachments.map((attachment, index) => <span key={`${attachment.uri}-${index}`} className='forge-brand-chip inline-flex items-center gap-1 text-[8.5px] px-1.5 py-0.5 rounded-md max-w-[145px]'><Paperclip size={8} /><span className='truncate'>{attachmentName(attachment)}</span>{onRemoveAttachment && <button type='button' onClick={() => onRemoveAttachment(index)} className='text-[var(--forge-muted-2)] hover:text-[var(--forge-danger)] ml-0.5' title={`Remove ${attachmentName(attachment)}`} aria-label={`Remove ${attachmentName(attachment)}`}><X size={8} /></button>}</span>)}
						{contextCount > selectedFiles.slice(0, 2).length + attachments.length && <span className='text-[8.5px] text-[var(--forge-muted-2)]'>+{contextCount - selectedFiles.slice(0, 2).length - attachments.length}</span>}
					</div>}

					<div className='forge-right-composer-input-row'>
						<textarea
							ref={textareaRef as React.Ref<HTMLTextAreaElement>}
							value={value}
							onChange={handleTextareaChange}
							onKeyDown={onComposerKeyDown ?? handleKeyDown}
							placeholder={placeholder}
							disabled={isDisabled}
							rows={1}
							className='flex-1 bg-transparent text-[12.5px] text-[var(--forge-text)] placeholder:text-[var(--forge-muted-2)] outline-none resize-none leading-relaxed max-h-[220px] disabled:opacity-40'
						/>
						<button
							type='button'
							onClick={() => { if (isStreaming) void onAbort(); else onSubmit(); }}
							disabled={!isStreaming && !canSubmit}
							className={`w-8 h-8 flex items-center justify-center rounded-lg shrink-0 transition-all ${isStreaming ? 'text-[var(--forge-danger)] bg-red-500/10 hover:bg-red-500/15' : canSubmit ? 'forge-brand-send cursor-pointer' : 'text-[var(--forge-muted-2)] bg-white/[0.025] cursor-not-allowed'}`}
							title={isStreaming ? 'Stop current agent run' : 'Send task'}
							aria-label={isStreaming ? 'Stop current agent run' : 'Send task'}
						>
							{isStreaming ? <Square size={13} /> : <Send size={13} />}
						</button>
					</div>
				</div>
			</div>

			<div className='forge-right-composer-meta'>
				<div className='forge-right-composer-meta-left'>
					<button type='button' onClick={handleCommandsClick} disabled={isDisabled} className='forge-right-meta-button' title='Open Forge slash commands'><Command size={10} /> / commands</button>
					<button type='button' className='forge-right-meta-button' onClick={() => { if (onPickFiles) void onPickFiles(); }} disabled={!onPickFiles || isDisabled} title='Add code or document context'><AtSign size={10} /> Add context</button>
				</div>
				<div className='forge-right-composer-meta-right'>
					<ModelDropdown featureName='Chat' className='forge-right-meta-button' />
					<span className='forge-right-agent-ready'>{isStreaming ? 'Agent working' : 'Agent ready'}</span>
				</div>
			</div>
		</div>
	);
};

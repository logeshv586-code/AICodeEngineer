/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useMemo } from 'react';
import {
	Send,
	Square,
	Paperclip,
	Mic,
	Image as ImageIcon,
	X,
	Sparkles,
	HardDrive,
	FileText,
	Settings,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Attachment {
	readonly uri: string;
	readonly name: string;
	readonly mimeType: string;
}

export interface ComposerControlCenterProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	onAbort: () => void;
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
	onRemoveAttachment?: (index: number) => void;

	canUseVoice?: boolean;
	isListening?: boolean;
	onVoiceToggle?: () => void;

	placeholder?: string;
	textareaRef?: React.Ref<HTMLTextAreaElement>;
}

// ─── Component ────────────────────────────────────────────────────────────────

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
	onRemoveAttachment,
	canUseVoice = false,
	isListening = false,
	onVoiceToggle,
	placeholder = 'How can I help?',
	textareaRef,
}) => {
	const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
			e.preventDefault();
			if (!isStreaming && value.trim()) {
				onSubmit();
			}
		}
	}, [isStreaming, value, onSubmit]);

	const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		onChange(e.target.value);
		const target = e.target;
		target.style.height = 'auto';
		target.style.height = Math.min(target.scrollHeight, 200) + 'px';
	}, [onChange]);

	const contextPercent = useMemo(() => {
		if (!tokenCount || !maxTokens) return null;
		return Math.round((tokenCount / maxTokens) * 100);
	}, [tokenCount, maxTokens]);

	return (
		<div className='shrink-0 border-t border-zinc-800/40 bg-zinc-900/20'>
			{/* Context bar — tiny pills above input */}
			{(workspaceReady || selectedFiles.length > 0 || attachments.length > 0 || providerName) && (
				<div className='flex items-center gap-1.5 px-3 pt-1.5 flex-wrap'>
					{/* Workspace */}
					{workspaceReady && (
						<span className='inline-flex items-center gap-1 text-[9px] text-zinc-500 bg-zinc-800/40 px-1.5 py-0.5 rounded border border-zinc-700/30'>
							<HardDrive size={8} />
							{workspaceFileCount ? `${workspaceFileCount.toLocaleString()} files` : 'Ready'}
						</span>
					)}

					{/* Selected files */}
					{selectedFiles.slice(0, 3).map(file => (
						<span key={file} className='inline-flex items-center gap-1 text-[9px] text-zinc-500 bg-zinc-800/40 px-1.5 py-0.5 rounded border border-zinc-700/30 max-w-[120px]'>
							<FileText size={8} className='shrink-0' />
							<span className='truncate'>{file.split('/').pop()}</span>
						</span>
					))}
					{selectedFiles.length > 3 && (
						<span className='text-[9px] text-zinc-600'>
							+{selectedFiles.length - 3}
						</span>
					)}

					{/* Attachments */}
					{attachments.map((att, i) => (
						<span key={i} className='inline-flex items-center gap-1 text-[9px] text-zinc-500 bg-zinc-800/40 px-1.5 py-0.5 rounded border border-zinc-700/30 max-w-[100px]'>
							<Paperclip size={8} />
							<span className='truncate'>{att.name}</span>
							<button
								type='button'
								onClick={() => onRemoveAttachment?.(i)}
								className='text-zinc-600 hover:text-red-400 cursor-pointer ml-0.5'
							>
								<X size={8} />
							</button>
						</span>
					))}

					{/* Model chip — click opens settings */}
					{(providerName || modelName) && onOpenSettings && (
						<button
							type='button'
							onClick={onOpenSettings}
							className='
								inline-flex items-center gap-1 text-[9px] text-zinc-500
								bg-zinc-800/40 px-1.5 py-0.5 rounded border border-zinc-700/30
								cursor-pointer hover:text-zinc-300 hover:border-zinc-600 transition-colors
							'
						>
							<Sparkles size={8} />
							<span className='truncate max-w-[80px]'>{modelName || providerName}</span>
						</button>
					)}

					{/* Context usage */}
					{contextPercent !== null && (
						<span className={`
							inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded
							${contextPercent > 80 ? 'text-red-400 bg-red-500/10 border border-red-500/20' :
							  contextPercent > 50 ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' :
							  'text-zinc-500 bg-zinc-800/40 border border-zinc-700/30'}
						`}>
							{contextPercent}%
						</span>
					)}
				</div>
			)}

			{/* Input area */}
			<div className='flex items-end gap-1.5 px-3 py-2'>
				{/* Attachment */}
				<button
					type='button'
					className='
						w-7 h-7 flex items-center justify-center rounded-md
						text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800
						transition-colors cursor-pointer shrink-0
					'
					title='Attach file'
				>
					<Paperclip size={14} />
				</button>

				{/* Textarea */}
				<textarea
					ref={textareaRef as any}
					value={value}
					onChange={handleTextareaChange}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					disabled={isDisabled}
					rows={1}
					className='
						flex-1 bg-transparent text-[13px] text-zinc-200
						placeholder:text-zinc-600 outline-none resize-none
						leading-relaxed py-1.5 max-h-[200px]
						disabled:opacity-40
					'
				/>

				{/* Voice */}
				{canUseVoice && (
					<button
						type='button'
						onClick={onVoiceToggle}
						className={`
							w-7 h-7 flex items-center justify-center rounded-md
							transition-colors cursor-pointer shrink-0
							${isListening
								? 'text-red-400 bg-red-500/10 animate-pulse'
								: 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800'
							}
						`}
						title='Voice input'
					>
						<Mic size={14} />
					</button>
				)}

				{/* Submit / Abort */}
				<button
					type='button'
					onClick={isStreaming ? onAbort : onSubmit}
					disabled={!isStreaming && (!value.trim() || isDisabled)}
					className={`
						w-7 h-7 flex items-center justify-center rounded-md
						transition-colors cursor-pointer shrink-0
						${isStreaming
							? 'text-red-400 hover:bg-red-500/10'
							: value.trim() && !isDisabled
								? 'text-emerald-400 hover:bg-emerald-500/10'
								: 'text-zinc-700 cursor-not-allowed'
						}
					`}
					title={isStreaming ? 'Stop' : 'Send (Ctrl+Enter)'}
				>
					{isStreaming ? <Square size={14} /> : <Send size={14} />}
				</button>
			</div>

			{/* Bottom hint */}
			<div className='flex items-center justify-between px-3 pb-1.5'>
				<span className='text-[9px] text-zinc-700'>
					{isStreaming ? 'Press stop to cancel' : 'Ctrl+Enter to send · / for commands'}
				</span>
				{onOpenSettings && (
					<button
						type='button'
						onClick={onOpenSettings}
						className='text-[9px] text-zinc-700 hover:text-zinc-500 cursor-pointer transition-colors'
					>
						<Settings size={9} />
					</button>
				)}
			</div>
		</div>
	);
};

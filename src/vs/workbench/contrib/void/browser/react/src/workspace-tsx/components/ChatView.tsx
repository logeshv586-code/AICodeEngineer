/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Sparkles, Command } from 'lucide-react';
import { SlashCommandPalette, SlashCommandContext } from '../utils/slashCommandRouter';
import { StreamRenderer } from './StreamRenderer';
import { ComposerControlCenter, Attachment } from './ComposerControlCenter';
import { useStreamEvents, StreamEvent } from '../utils/streamEvents';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatViewMessage {
	readonly id: string;
	readonly role: 'user' | 'assistant';
	readonly content: string;
	readonly timestamp: number;
}

export interface ChatViewProps {
	messages: ChatViewMessage[];
	isStreaming?: boolean;
	onSendMessage: (msg: string) => void;
	onNewThread?: () => void;
	slashContext?: SlashCommandContext;
	className?: string;

	// Composer context
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
}

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState: React.FC<{
	onSuggestionClick: (text: string) => void;
	onCommandsClick: (e: React.MouseEvent) => void;
}> = ({ onSuggestionClick, onCommandsClick }) => (
	<div className='flex flex-col items-center justify-center h-full select-none'>
		{/* Logo */}
		<div className='w-12 h-12 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center mb-4'>
			<Sparkles size={24} className='text-zinc-400' />
		</div>

		{/* Title */}
		<div className='text-sm font-medium text-zinc-400 mb-1'>
			How can I help?
		</div>
		<div className='text-[11px] text-zinc-600 mb-5 max-w-[220px] text-center'>
			I can write code, review files, run tests, search your workspace, and more.
		</div>

		{/* Suggestions */}
		<div className='flex flex-wrap gap-1.5 justify-center max-w-[340px]'>
			{[
				'Explain this codebase',
				'Review the current file',
				'Run the test suite',
				'Find and fix bugs',
				'Write unit tests',
				'Refactor this module',
				'Add error handling',
				'Optimize performance',
			].map(suggestion => (
				<button
					key={suggestion}
					type='button'
					onClick={() => onSuggestionClick(suggestion)}
					className='
						px-2.5 py-1.5 rounded-lg
						border border-zinc-800/60 bg-zinc-900/40
						text-[11px] text-zinc-500
						hover:bg-zinc-800/40 hover:text-zinc-300
						hover:border-zinc-700/60
						transition-colors cursor-pointer
					'
				>
					{suggestion}
				</button>
			))}
		</div>

		{/* Commands hint */}
		<button
			type='button'
			onClick={onCommandsClick}
			className='
				mt-5 flex items-center gap-1.5 px-2.5 py-1 rounded-md
				bg-zinc-800/40 hover:bg-zinc-700/40 border border-zinc-700/30
				text-[10px] text-zinc-600 font-mono
				transition-colors cursor-pointer
			'
		>
			<Command size={10} />
			<span className='text-zinc-600'>/</span>
			<span>Commands</span>
		</button>
	</div>
);

// ─── User Message ─────────────────────────────────────────────────────────────

const UserMessage: React.FC<{ message: ChatViewMessage }> = ({ message }) => (
	<div className='group flex gap-3 py-3 px-4 hover:bg-zinc-900/10 transition-colors'>
		{/* Avatar */}
		<div className='w-7 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center shrink-0 mt-0.5'>
			<span className='text-[10px] font-bold text-zinc-500'>U</span>
		</div>

		{/* Content */}
		<div className='flex-1 min-w-0'>
			<div className='flex items-center gap-2 mb-0.5'>
				<span className='text-[11px] font-medium text-zinc-500'>You</span>
				<span className='text-[9px] text-zinc-700'>
					{new Date(message.timestamp).toLocaleTimeString(undefined, {
						hour: '2-digit',
						minute: '2-digit',
					})}
				</span>
			</div>
			<div className='text-[13px] leading-relaxed text-zinc-300 whitespace-pre-wrap break-words'>
				{message.content}
			</div>
		</div>
	</div>
);

// ─── Assistant Message ────────────────────────────────────────────────────────
//
// The thinking process becomes PART of the reply.
// Execution steps stream inline, woven with the text response.
// No separate "Execution Details" panel.
// No agent names — only human-readable activity labels.

const AssistantMessage: React.FC<{
	message: ChatViewMessage;
	streamEvents: StreamEvent[];
	isStreaming: boolean;
}> = ({ message, streamEvents, isStreaming }) => {
	const timeStr = new Date(message.timestamp).toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit',
	});

	// Deduplicate and filter events for inline display
	const displayEvents = useMemo(() => {
		const seen = new Set<string>();
		return streamEvents.filter(event => {
			const key = event.kind + (event.label || '');
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}, [streamEvents]);

	// Check if we have any active/running events to show inline
	const hasActiveWork = displayEvents.some(e => e.status === 'active');

	return (
		<div className='group flex gap-3 py-3 px-4 hover:bg-zinc-900/10 transition-colors'>
			{/* Avatar */}
			<div className='w-7 h-7 rounded-lg bg-emerald-600/10 border border-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5'>
				<Sparkles size={14} className='text-emerald-400' />
			</div>

			{/* Content */}
			<div className='flex-1 min-w-0'>
				{/* Header */}
				<div className='flex items-center gap-2 mb-1'>
					<span className='text-[11px] font-medium text-zinc-400'>Assistant</span>
					<span className='text-[9px] text-zinc-700'>{timeStr}</span>
				</div>

				{/* Stream events woven into the reply */}
				{hasActiveWork && (
					<div className='text-[13px] leading-relaxed text-zinc-500 mb-1.5'>
						{displayEvents
							.filter(e => e.status === 'active')
							.map(e => e.label)
							.join('...')}
						...
					</div>
				)}

				{/* Text response */}
				{message.content && (
					<div className='text-[13px] leading-relaxed text-zinc-400 whitespace-pre-wrap break-words'>
						{message.content}
					</div>
				)}

				{/* Inline progress stream — collapsible */}
				{displayEvents.length > 0 && (
					<StreamRenderer events={displayEvents} className='mt-2' />
				)}

				{/* Streaming indicator */}
				{isStreaming && (
					<div className='flex items-center gap-1.5 mt-2 text-zinc-600'>
						<Sparkles size={10} className='text-emerald-400 animate-pulse' />
						<span className='text-[10px] animate-pulse'>Thinking...</span>
					</div>
				)}
			</div>
		</div>
	);
};

// ─── Chat View (The IDE) ──────────────────────────────────────────────────────

export const ChatView: React.FC<ChatViewProps> = ({
	messages,
	isStreaming = false,
	onSendMessage,
	onNewThread,
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
}) => {
	const [isSlashOpen, setIsSlashOpen] = useState(false);
	const [slashAnchor, setSlashAnchor] = useState<DOMRect | null>(null);
	const [draftText, setDraftText] = useState('');
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Stream events — scoped to this conversation
	const { state: streamState, clearEvents } = useStreamEvents({
		maxEvents: 150,
		resetOnRunStart: true,
		onRunStart: clearEvents,
	});

	// Auto-scroll on new messages or stream events
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages, streamState.events.length, isStreaming]);

	// Send message handler
	const handleSend = useCallback(() => {
		const text = draftText.trim();
		if (!text || isStreaming) return;
		onSendMessage(text);
		setDraftText('');
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto';
		}
	}, [draftText, isStreaming, onSendMessage]);

	// Suggestion click
	const handleSuggestion = useCallback((text: string) => {
		onSendMessage(text);
	}, [onSendMessage]);

	// Slash command handlers
	const handleOpenCommands = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		setSlashAnchor(rect);
		setIsSlashOpen(true);
	}, []);

	const handleSlashSelect = useCallback((cmd: any, args: string) => {
		setIsSlashOpen(false);
		setSlashAnchor(null);
		if (slashContext) {
			cmd.execute({ ...slashContext, args });
		}
	}, [slashContext]);

	// Keyboard shortcuts
	const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === '/' && !draftText && !isSlashOpen) {
			e.preventDefault();
			const rect = e.currentTarget.getBoundingClientRect();
			setSlashAnchor(rect);
			setIsSlashOpen(true);
			return;
		}
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
		if (e.key === 'Escape' && isSlashOpen) {
			setIsSlashOpen(false);
			setSlashAnchor(null);
		}
	}, [draftText, isSlashOpen, handleSend]);

	// Auto-resize textarea
	const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setDraftText(e.target.value);
		const target = e.target;
		target.style.height = 'auto';
		target.style.height = Math.min(target.scrollHeight, 200) + 'px';
	}, []);

	// Stream events associated with the last assistant message
	const lastAssistantIndex = [...messages].reverse().findIndex(m => m.role === 'assistant');
	const streamEventsForLastResponse = lastAssistantIndex >= 0
		? streamState.events
		: [];

	return (
		<div className={`flex flex-col h-full bg-void-bg-1 ${className}`}>
			{/* Slash command palette */}
			{slashContext && (
				<SlashCommandPalette
					isOpen={isSlashOpen}
					onClose={() => { setIsSlashOpen(false); setSlashAnchor(null); }}
					onSelect={handleSlashSelect}
					anchorRect={slashAnchor}
					context={slashContext}
				/>
			)}

			{/* Messages area */}
			<div className='flex-1 overflow-y-auto'>
				{messages.length === 0 ? (
					<EmptyState
						onSuggestionClick={handleSuggestion}
						onCommandsClick={handleOpenCommands}
					/>
				) : (
					<>
						{messages.map((message, index) => {
							if (message.role === 'user') {
								return <UserMessage key={message.id} message={message} />;
							}

							// Associate stream events with the assistant message that follows the user's
							const isLastAssistant = index === messages.length - 1;
							const events = isLastAssistant ? streamEventsForLastResponse : [];

							return (
								<AssistantMessage
									key={message.id}
									message={message}
									streamEvents={events}
									isStreaming={isStreaming && isLastAssistant}
								/>
							);
						})}

						{/* Streaming placeholder (no text yet, but events coming in) */}
						{isStreaming && streamState.events.length > 0 && !messages.some(m => m.role === 'assistant' && m.timestamp > Date.now() - 5000) && (
							<div className='flex gap-3 py-3 px-4'>
								<div className='w-7 h-7 rounded-lg bg-emerald-600/10 border border-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5'>
									<Sparkles size={14} className='text-emerald-400' />
								</div>
								<div className='flex-1 min-w-0'>
									<StreamRenderer events={streamEventsForLastResponse} />
								</div>
							</div>
						)}

						{/* Scroll anchor */}
						<div ref={messagesEndRef} />
					</>
				)}
			</div>

			{/* Composer — the control center */}
			<ComposerControlCenter
				value={draftText}
				onChange={handleTextareaChange}
				onSubmit={handleSend}
				onAbort={() => {}}
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
				attachments={attachments}
				onRemoveAttachment={onRemoveAttachment}
				placeholder='How can I help?'
				textareaRef={textareaRef}
			/>
		</div>
	);
};

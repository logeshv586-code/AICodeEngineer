/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import { MessageSquare, Trash2, Clock } from 'lucide-react';
import { IChatThreadService } from '../../chatThreadService.js';

export interface ThreadItem {
	readonly id: string;
	readonly title: string;
	readonly preview: string;
	readonly timestamp: number;
	readonly isActive?: boolean;
	readonly agent?: string;
}

export interface ThreadListProps {
	threads: ThreadItem[];
	activeThreadId: string | null;
	onSelectThread: (id: string) => void;
	onNewThread: () => void;
	onDeleteThread?: (id: string) => void;
	className?: string;
}

export const ThreadList: React.FC<ThreadListProps> = ({ threads, activeThreadId, onSelectThread, onDeleteThread, className = '' }) => {
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const [focusedId, setFocusedId] = useState<string | null>(null);
	const [showDeleteId, setShowDeleteId] = useState<string | null>(null);

	const formatTime = useCallback((ts: number) => {
		const diff = Date.now() - ts;
		if (diff < 60000) return 'Now';
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
		if (diff < 604800000) return new Date(ts).toLocaleDateString(undefined, { weekday: 'short' });
		return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}, []);

	return (
		<div className={`flex flex-col h-full ${className}`}>
			<div className='forge-brand-scroll flex-1 overflow-y-auto py-1 px-1.5' role='list' aria-label='Forge conversations'>
				{threads.length === 0 ? (
					<div className='flex flex-col items-center justify-center px-4 py-10 text-center text-[var(--forge-muted-2)]'>
						<div className='w-8 h-8 rounded-xl forge-brand-tool flex items-center justify-center mb-2'><MessageSquare size={14} /></div>
						<span className='text-[10px] text-[var(--forge-muted)]'>No conversations here yet</span>
						<span className='text-[9px] mt-1 leading-relaxed'>Start a task and Forge will keep the session available here.</span>
					</div>
				) : threads.map(thread => {
					const isActive = thread.id === activeThreadId;
					const isHovered = hoveredId === thread.id;
					const isFocused = focusedId === thread.id;
					const showDelete = showDeleteId === thread.id;
					return (
						<div
							key={thread.id}
							role='listitem'
							onMouseEnter={() => setHoveredId(thread.id)}
							onMouseLeave={() => { setHoveredId(null); if (!isFocused) setShowDeleteId(null); }}
							className={`forge-brand-thread ${isActive ? 'forge-brand-thread-active' : ''} group relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg mb-0.5`}
						>
							<div
								role='button'
								tabIndex={0}
								aria-current={isActive ? 'page' : undefined}
								aria-label={`${thread.title || 'Conversation'}${thread.preview ? ` — ${thread.preview}` : ''}`}
								onClick={() => onSelectThread(thread.id)}
								onFocus={() => setFocusedId(thread.id)}
								onBlur={event => {
									if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
										setFocusedId(null);
										setShowDeleteId(null);
									}
								}}
								onKeyDown={event => {
									if (event.key === 'Enter' || event.key === ' ') {
										event.preventDefault();
										onSelectThread(thread.id);
									}
								}}
								className='flex-1 min-w-0 cursor-pointer outline-none rounded-md py-0.5'
							>
								<div className={`text-[10.5px] font-medium truncate ${isActive ? 'text-[var(--forge-text)]' : 'text-[var(--forge-text-2)]'}`}>{thread.title || 'Conversation'}</div>
								<div className='flex items-center gap-1.5 mt-0.5 min-w-0'>
									<span className='text-[8.5px] text-[var(--forge-muted-2)] truncate'>{thread.preview || 'Ready'}</span>
									<span className='text-[var(--forge-muted-2)] opacity-50'>·</span>
									<span className='text-[8.5px] text-[var(--forge-muted-2)] flex items-center gap-0.5 shrink-0'><Clock size={7.5} />{formatTime(thread.timestamp)}</span>
								</div>
							</div>
							{onDeleteThread && (isHovered || isFocused || showDelete) && <button
								type='button'
								onFocus={() => setFocusedId(thread.id)}
								onBlur={event => {
									if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
										setFocusedId(null);
										setShowDeleteId(null);
									}
								}}
								onClick={event => {
									event.stopPropagation();
									if (showDelete) { onDeleteThread(thread.id); setShowDeleteId(null); }
									else setShowDeleteId(thread.id);
								}}
								className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-md transition-colors cursor-pointer ${showDelete ? 'bg-red-500/15 text-[var(--forge-danger)]' : 'text-[var(--forge-muted-2)] hover:text-[var(--forge-danger)] hover:bg-red-500/10'}`}
								title={showDelete ? 'Click again to delete' : 'Delete conversation'}
								aria-label={showDelete ? `Confirm delete ${thread.title || 'conversation'}` : `Delete ${thread.title || 'conversation'}`}
							><Trash2 size={10} /></button>}
						</div>
					);
				})}
			</div>
		</div>
	);
};

export function buildThreadList(chatThreadsService: IChatThreadService | null): ThreadItem[] {
	if (!chatThreadsService) return [];
	const threads = chatThreadsService.listThreads();
	return threads.map(thread => {
		const messages = chatThreadsService.getMessages(thread.id) ?? [];
		return {
			id: thread.id,
			title: 'Conversation',
			preview: messages.length > 0 ? `${messages.length} messages` : 'Ready for a new task',
			timestamp: thread.updatedAt ?? Date.now(),
			isActive: false,
		};
	});
}

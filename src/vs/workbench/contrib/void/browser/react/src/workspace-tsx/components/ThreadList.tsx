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
	const [showDeleteId, setShowDeleteId] = useState<string | null>(null);

	const formatTime = useCallback((ts: number) => {
		const diff = Date.now() - ts;
		if (diff < 60000) return 'Now';
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
		return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}, []);

	return (
		<div className={`flex flex-col h-full ${className}`}>
			<div className='forge-brand-scroll flex-1 overflow-y-auto py-1 px-2'>
				{threads.length === 0 ? (
					<div className='flex flex-col items-center justify-center py-10 text-[var(--forge-muted-2)]'>
						<MessageSquare size={19} className='mb-2 opacity-50' />
						<span className='text-[10px]'>Your conversations will appear here</span>
					</div>
				) : threads.map(thread => {
					const isActive = thread.id === activeThreadId;
					const isHovered = hoveredId === thread.id;
					const showDelete = showDeleteId === thread.id;
					return (
						<div
							key={thread.id}
							onClick={() => onSelectThread(thread.id)}
							onMouseEnter={() => setHoveredId(thread.id)}
							onMouseLeave={() => { setHoveredId(null); setShowDeleteId(null); }}
							className={`forge-brand-thread ${isActive ? 'forge-brand-thread-active' : ''} group relative flex items-start gap-2 px-2.5 py-2 rounded-xl mb-1 cursor-pointer`}
						>
							<div className='flex-1 min-w-0'>
								<div className={`text-[11px] font-medium truncate ${isActive ? 'text-[var(--forge-text)]' : 'text-[var(--forge-text-2)]'}`}>{thread.title || 'Untitled'}</div>
								<div className='text-[9.5px] text-[var(--forge-muted-2)] truncate mt-0.5'>{thread.preview || 'No messages yet'}</div>
								<div className='flex items-center gap-1.5 mt-1.5'>
									{thread.agent && <span className='forge-brand-chip text-[8.5px] px-1.5 py-0.5 rounded-md'>{thread.agent}</span>}
									<span className='text-[8.5px] text-[var(--forge-muted-2)] flex items-center gap-0.5'><Clock size={8} />{formatTime(thread.timestamp)}</span>
								</div>
							</div>
							{onDeleteThread && (isHovered || showDelete) && <button
								type='button'
								onClick={event => {
									event.stopPropagation();
									if (showDelete) { onDeleteThread(thread.id); setShowDeleteId(null); }
									else setShowDeleteId(thread.id);
								}}
								className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${showDelete ? 'bg-red-500/15 text-[var(--forge-danger)]' : 'text-[var(--forge-muted-2)] hover:text-[var(--forge-danger)] hover:bg-red-500/10'}`}
								title={showDelete ? 'Click again to delete' : 'Delete conversation'}
								aria-label={showDelete ? 'Confirm delete conversation' : 'Delete conversation'}
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
		const lastMessage = messages[messages.length - 1];
		const preview = lastMessage ? (typeof lastMessage === 'string' ? lastMessage : lastMessage.content ?? '').slice(0, 80) : '';
		return { id: thread.id, title: thread.title || 'Untitled', preview, timestamp: thread.updatedAt ?? Date.now(), isActive: false };
	});
}

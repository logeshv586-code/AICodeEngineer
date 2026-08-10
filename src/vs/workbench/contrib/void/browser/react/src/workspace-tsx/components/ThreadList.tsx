/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import { MessageSquare, Trash2, Clock, ChevronRight } from 'lucide-react';
import { IChatThreadService } from '../../chatThreadService.js';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export const ThreadList: React.FC<ThreadListProps> = ({
	threads,
	activeThreadId,
	onSelectThread,
	onNewThread,
	onDeleteThread,
	className = '',
}) => {
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const [showDeleteId, setShowDeleteId] = useState<string | null>(null);

	const formatTime = useCallback((ts: number) => {
		const now = Date.now();
		const diff = now - ts;
		if (diff < 60000) return 'Just now';
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
		return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}, []);

	return (
		<div className={`flex flex-col h-full ${className}`}>
			{/* Thread list */}
			<div className='flex-1 overflow-y-auto py-1 px-1.5'>
				{threads.length === 0 ? (
					<div className='flex flex-col items-center justify-center py-8 text-zinc-600'>
						<MessageSquare size={20} className='mb-2 opacity-40' />
						<span className='text-[10px]'>No conversations yet</span>
					</div>
				) : (
					threads.map(thread => {
						const isActive = thread.id === activeThreadId;
						const isHovered = hoveredId === thread.id;
						const showDelete = showDeleteId === thread.id;
						return (
							<div
								key={thread.id}
								onClick={() => onSelectThread(thread.id)}
								onMouseEnter={() => setHoveredId(thread.id)}
								onMouseLeave={() => { setHoveredId(null); setShowDeleteId(null); }}
								className={`
									group relative flex items-start gap-2 px-2 py-1.5 rounded-md mb-0.5
									cursor-pointer transition-colors
									${isActive
										? 'bg-zinc-800/80 text-zinc-200'
										: 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-300'
									}
								`}
							>
								{/* Active indicator */}
								{isActive && (
									<ChevronRight size={10} className='mt-1 text-zinc-500 shrink-0' />
								)}

								<div className='flex-1 min-w-0'>
									{/* Title */}
									<div className={`
										text-[11px] font-medium truncate
										${isActive ? 'text-zinc-200' : 'text-zinc-300'}
									`}>
										{thread.title || 'Untitled'}
									</div>

									{/* Preview */}
									<div className='text-[10px] text-zinc-600 truncate mt-0.5'>
										{thread.preview || 'No messages'}
									</div>

									{/* Footer: agent + time */}
									<div className='flex items-center gap-1.5 mt-1'>
										{thread.agent && (
											<span className='text-[9px] text-zinc-600 bg-zinc-800/60 px-1 py-0.5 rounded'>
												{thread.agent}
											</span>
										)}
										<span className='text-[9px] text-zinc-600 flex items-center gap-0.5'>
											<Clock size={8} />
											{formatTime(thread.timestamp)}
										</span>
									</div>
								</div>

								{/* Delete button */}
								{onDeleteThread && (isHovered || showDelete) && (
									<button
										type='button'
										onClick={(e) => {
											e.stopPropagation();
											if (showDelete) {
												onDeleteThread(thread.id);
												setShowDeleteId(null);
											} else {
												setShowDeleteId(thread.id);
											}
										}}
										className={`
											shrink-0 w-5 h-5 flex items-center justify-center rounded
											transition-colors cursor-pointer
											${showDelete
												? 'bg-red-500/20 text-red-400'
												: 'text-zinc-600 hover:text-red-400 hover:bg-red-500/10'
											}
										`}
										title='Delete thread'
									>
										<Trash2 size={10} />
									</button>
								)}
							</div>
						);
					})
				)}
			</div>
		</div>
	);
};

// ─── Utility: Build thread list from ChatThreadService ───────────────────────

export function buildThreadList(
	chatThreadsService: IChatThreadService | null
): ThreadItem[] {
	if (!chatThreadsService) return [];

	const threads = chatThreadsService.listThreads();
	return threads.map(thread => {
		const messages = chatThreadsService.getMessages(thread.id) ?? [];
		const lastMessage = messages[messages.length - 1];
		const preview = lastMessage
			? (typeof lastMessage === 'string' ? lastMessage : lastMessage.content ?? '').slice(0, 80)
			: '';

		return {
			id: thread.id,
			title: thread.title || 'Untitled',
			preview,
			timestamp: thread.updatedAt ?? Date.now(),
			isActive: false,
		};
	});
}

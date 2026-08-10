/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import { Plus, ChevronDown, Sparkles } from 'lucide-react';
import { ThreadList, ThreadItem } from './ThreadList';
import type { SlashCommandContext } from '../utils/slashCommandRouter';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SimpleSidebarProps {
	threads: ThreadItem[];
	activeThreadId: string | null;
	onSelectThread: (id: string) => void;
	onNewThread: () => void;
	onDeleteThread?: (id: string) => void;
	onSettingsClick?: () => void;
	className?: string;
	slashContext?: SlashCommandContext;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const SimpleSidebar: React.FC<SimpleSidebarProps> = ({
	threads,
	activeThreadId,
	onSelectThread,
	onNewThread,
	onDeleteThread,
	className = '',
}) => {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const handleNewThread = useCallback(() => {
		onNewThread();
	}, [onNewThread]);

	if (isCollapsed) {
		return (
			<div className={`w-10 bg-zinc-900/80 border-r border-zinc-800/60 flex flex-col items-center py-2 gap-1 shrink-0 ${className}`}>
				{/* Logo — single assistant identity */}
				<button
					type='button'
					onClick={() => setIsCollapsed(false)}
					className='
						w-8 h-8 flex items-center justify-center rounded-lg
						bg-zinc-800/60 border border-zinc-700/40
						text-zinc-400 cursor-pointer
						hover:bg-zinc-700/60 hover:text-zinc-300
						transition-colors
					'
					title='Assistant'
				>
					<Sparkles size={14} />
				</button>

				{/* New chat */}
				<button
					type='button'
					onClick={handleNewThread}
					className='
						w-8 h-8 flex items-center justify-center rounded-md
						text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800
						transition-colors cursor-pointer
					'
					title='New Chat'
				>
					<Plus size={16} />
				</button>

				{/* Expand */}
				<button
					type='button'
					onClick={() => setIsCollapsed(false)}
					className='
						w-8 h-8 flex items-center justify-center rounded-md
						text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800
						transition-colors cursor-pointer mt-auto
					'
					title='Expand sidebar'
				>
					<ChevronDown size={14} className='rotate-[-90deg]' />
				</button>
			</div>
		);
	}

	return (
		<div className={`w-56 bg-zinc-900/90 border-r border-zinc-800/60 flex flex-col shrink-0 ${className}`}>
			{/* Top section */}
			<div className='px-2.5 py-2 border-b border-zinc-800/60 shrink-0'>
				{/* Logo + title — single assistant */}
				<div className='flex items-center gap-2 mb-2'>
					<div className='w-7 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center'>
						<Sparkles size={14} className='text-zinc-400' />
					</div>
					<div className='flex-1 min-w-0'>
						<div className='text-[11px] font-semibold text-zinc-300'>Assistant</div>
						<div className='text-[9px] text-zinc-600'>Code Editor</div>
					</div>
				</div>

				{/* New Chat button */}
				<button
					type='button'
					onClick={handleNewThread}
					className='
						w-full flex items-center justify-center gap-1.5
						px-2 py-1.5 rounded-md
						bg-zinc-800/60 hover:bg-zinc-700/60
						border border-zinc-700/40
						text-[11px] text-zinc-300 font-medium
						transition-colors cursor-pointer
					'
				>
					<Plus size={12} />
					New Chat
				</button>
			</div>

			{/* Thread list */}
			<div className='flex-1 overflow-hidden'>
				<ThreadList
					threads={threads}
					activeThreadId={activeThreadId}
					onSelectThread={onSelectThread}
					onNewThread={handleNewThread}
					onDeleteThread={onDeleteThread}
				/>
			</div>

			{/* Minimal footer */}
			<div className='px-2 py-2 border-t border-zinc-800/60 flex justify-end shrink-0'>
				{/* Collapse */}
				<button
					type='button'
					onClick={() => setIsCollapsed(true)}
					className='
						w-7 h-7 flex items-center justify-center rounded-md
						text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800
						transition-colors cursor-pointer
					'
					title='Collapse sidebar'
				>
					<ChevronDown size={13} className='rotate-90' />
				</button>
			</div>
		</div>
	);
};

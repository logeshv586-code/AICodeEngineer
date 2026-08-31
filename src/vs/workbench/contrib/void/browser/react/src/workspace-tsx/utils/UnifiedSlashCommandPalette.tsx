/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, CheckCircle2, Play, TestTube2, Wrench } from 'lucide-react';
import { SlashCommand, SlashCommandPaletteProps } from './slashCommandRouter.tsx';

const command = (name: string, label: string, description: string, icon: React.ReactNode): SlashCommand => ({
	name,
	label,
	category: 'Forge',
	description,
	icon,
	// Product commands are intentionally draft-first. ChatView expands them only
	// after the user has had a chance to add/edit the instruction and presses Send.
	execute: () => undefined,
});

const PRODUCT_COMMANDS: SlashCommand[] = [
	command('/agent', 'Collaborative Agent', 'One coordinated agent team for implementation, debugging, testing, runtime checks, review, and verification.', <Bot size={15} />),
	command('/run', 'Run Current Project', 'Read the opened project, detect its runtime, execute it in the IDE terminal, diagnose failures, and verify startup.', <Play size={15} />),
	command('/fix', 'Fix Current Issue', 'Reproduce the issue, find the root cause, implement the fix, and verify it.', <Wrench size={15} />),
	command('/test', 'Test & Verify', 'Run relevant tests and checks, fix regressions, and rerun verification.', <TestTube2 size={15} />),
	command('/review', 'Review Changes', 'Review the current workspace changes, fix confirmed issues safely, and verify them.', <CheckCircle2 size={15} />),
];

/**
 * Product-facing command palette.
 *
 * Keep the visible surface intentionally small: one collaborative agent mode plus
 * four outcome commands. Selecting a command only puts it into the composer so the
 * user can add or edit the instruction before sending it.
 */
export const UnifiedSlashCommandPalette: React.FC<SlashCommandPaletteProps> = ({
	isOpen,
	onClose,
	onSelect,
	anchorRect,
	context,
}) => {
	const [query, setQuery] = useState('');
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	void context;

	const filtered = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (!normalized) return PRODUCT_COMMANDS;
		return PRODUCT_COMMANDS.filter(item => `${item.name} ${item.label} ${item.description}`.toLowerCase().includes(normalized));
	}, [query]);

	useEffect(() => {
		if (!isOpen) return;
		setQuery('');
		setActiveIndex(0);
		const id = window.setTimeout(() => inputRef.current?.focus(), 0);
		return () => window.clearTimeout(id);
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;
		const onMouseDown = (event: MouseEvent) => {
			if (!panelRef.current?.contains(event.target as Node)) onClose();
		};
		document.addEventListener('mousedown', onMouseDown, true);
		return () => document.removeEventListener('mousedown', onMouseDown, true);
	}, [isOpen, onClose]);

	if (!isOpen || typeof document === 'undefined') return null;

	// Forge's utility CSS is scoped under .void-scope. Portaling to document.body
	// made the palette render as raw browser controls across the bottom of the IDE.
	// Keep the portal inside the React/CSS scope while retaining fixed positioning.
	const portalTarget = document.querySelector<HTMLElement>('.void-scope') ?? document.body;
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const width = Math.min(440, Math.max(280, viewportWidth - 24));
	const left = Math.min(
		Math.max(12, anchorRect?.left ?? 12),
		Math.max(12, viewportWidth - width - 12),
	);
	const availableAbove = anchorRect ? anchorRect.top - 16 : viewportHeight * 0.55;
	const maxHeight = Math.max(220, Math.min(360, availableAbove));
	const bottom = anchorRect ? Math.max(12, viewportHeight - anchorRect.top + 8) : 92;

	const choose = (item: SlashCommand) => onSelect(item, '');

	return createPortal(
		<div
			ref={panelRef}
			className='fixed z-[10050] overflow-hidden rounded-xl border border-zinc-700/70 bg-zinc-950/98 text-zinc-100 shadow-2xl backdrop-blur'
			style={{ position: 'fixed', zIndex: 10050, left, bottom, width, maxHeight, display: 'flex', flexDirection: 'column' }}
			role='dialog'
			aria-label='Forge commands'
		>
			<div className='shrink-0 border-b border-zinc-800/90 px-3 py-2'>
				<div className='mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500'>Commands</div>
				<input
					ref={inputRef}
					value={query}
					onChange={event => { setQuery(event.target.value); setActiveIndex(0); }}
					onKeyDown={event => {
						if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
						if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex(index => Math.min(index + 1, Math.max(0, filtered.length - 1))); return; }
						if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex(index => Math.max(0, index - 1)); return; }
						if (event.key === 'Enter' && filtered[activeIndex]) { event.preventDefault(); choose(filtered[activeIndex]); }
					}}
					placeholder='Search commands…'
					className='w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600'
				/>
			</div>
			<div className='min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5' style={{ overscrollBehavior: 'contain', scrollbarGutter: 'stable' }}>
				{filtered.length === 0 ? <div className='px-3 py-5 text-center text-xs text-zinc-500'>No matching command</div> : filtered.map((item, index) => (
					<button
						key={item.name}
						type='button'
						onMouseEnter={() => setActiveIndex(index)}
						onClick={() => choose(item)}
						className={`flex w-full items-start gap-2.5 rounded-lg border-0 bg-transparent px-2.5 py-2 text-left text-zinc-200 transition-colors ${index === activeIndex ? 'bg-zinc-800/90' : 'hover:bg-zinc-900'}`}
					>
						<span className='mt-0.5 text-cyan-400'>{item.icon}</span>
						<span className='min-w-0 flex-1'>
							<span className='flex items-center gap-2'><span className='font-mono text-[11px] text-zinc-300'>{item.name}</span><span className='truncate text-[11px] font-medium text-zinc-200'>{item.label}</span></span>
							<span className='mt-0.5 block text-[10px] leading-4 text-zinc-500'>{item.description}</span>
						</span>
					</button>
				))}
			</div>
			<div className='shrink-0 border-t border-zinc-800/90 px-3 py-1.5 text-[9.5px] text-zinc-600'>Select a command, add your instruction, then press Enter to send.</div>
		</div>,
		portalTarget,
	);
};

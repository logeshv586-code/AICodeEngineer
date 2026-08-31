/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Bug, CheckCircle2, Globe, HelpCircle, Play, Search, Settings, Terminal, TestTube2, Wrench } from 'lucide-react';
import { SlashCommand, SlashCommandContext, SlashCommandPaletteProps, createAllCommands } from './slashCommandRouter.tsx';

const noopCommand = (name: string, label: string, description: string, icon: React.ReactNode): SlashCommand => ({
	name,
	label,
	category: 'Forge',
	description,
	icon,
	execute: () => undefined,
});

/**
 * Product-facing command palette.
 *
 * The legacy router still owns the actual command implementations for backwards
 * compatibility, but users see one collaborative Agent entry instead of a long
 * list of /agent,* variants. Selecting a command only inserts it into the draft;
 * ChatView decides what happens when the user presses Send.
 */
const buildProductCommands = (context: SlashCommandContext): SlashCommand[] => {
	const legacy = createAllCommands(context);
	const byName = new Map(legacy.map(command => [command.name, command] as const));
	const existing = (name: string, fallback: SlashCommand) => byName.get(name) ?? fallback;

	return [
		noopCommand('/agent', 'Collaborative Agent', 'One coordinated agent team for coding, debugging, testing, runtime checks, review, and verification.', <Bot size={15} />),
		noopCommand('/run', 'Run Current Project', 'Detect the current project runtime, execute it in the IDE terminal, diagnose failures, and verify startup.', <Play size={15} />),
		noopCommand('/fix', 'Fix Current Issue', 'Reproduce the issue, find the root cause, make the smallest coherent fix, and verify it.', <Wrench size={15} />),
		noopCommand('/test', 'Test & Verify', 'Run relevant tests and checks, fix regressions, and rerun verification.', <TestTube2 size={15} />),
		noopCommand('/review', 'Review Changes', 'Review the current workspace changes and fix actionable issues safely.', <CheckCircle2 size={15} />),
		existing('/search,semantic', noopCommand('/search', 'Search Project', 'Search the current workspace by meaning.', <Search size={15} />)),
		existing('/browser', noopCommand('/browser', 'Browser Agent', 'Use the integrated browser to inspect and verify a web task.', <Globe size={15} />)),
		existing('/terminal', noopCommand('/terminal', 'Terminal', 'Work with the integrated terminal.', <Terminal size={15} />)),
		existing('/debug', noopCommand('/debug', 'Debugger', 'Start or use the IDE debugger for the current issue.', <Bug size={15} />)),
		existing('/settings', noopCommand('/settings', 'Forge Settings', 'Open Forge model and runtime settings.', <Settings size={15} />)),
		existing('/help', noopCommand('/help', 'Help', 'Show the small set of Forge commands and how to use them.', <HelpCircle size={15} />)),
	];
};

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
	const commands = useMemo(() => buildProductCommands(context), [context]);
	const filtered = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (!normalized) return commands;
		return commands.filter(command => `${command.name} ${command.label} ${command.description}`.toLowerCase().includes(normalized));
	}, [commands, query]);

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

	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const width = Math.min(440, Math.max(280, viewportWidth - 24));
	const left = Math.min(
		Math.max(12, (anchorRect?.left ?? 12)),
		Math.max(12, viewportWidth - width - 12),
	);
	const availableAbove = anchorRect ? anchorRect.top - 16 : viewportHeight * 0.55;
	const maxHeight = Math.max(220, Math.min(360, availableAbove));
	const bottom = anchorRect ? Math.max(12, viewportHeight - anchorRect.top + 8) : 92;

	const choose = (command: SlashCommand) => {
		onSelect(command, '');
	};

	return createPortal(
		<div
			ref={panelRef}
			className='fixed z-[10050] overflow-hidden rounded-xl border border-zinc-700/70 bg-zinc-950/98 shadow-2xl backdrop-blur'
			style={{ left, bottom, width, maxHeight, display: 'flex', flexDirection: 'column' }}
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
			<div className='min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5'>
				{filtered.length === 0 ? <div className='px-3 py-5 text-center text-xs text-zinc-500'>No matching command</div> : filtered.map((command, index) => (
					<button
						key={command.name}
						type='button'
						onMouseEnter={() => setActiveIndex(index)}
						onClick={() => choose(command)}
						className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${index === activeIndex ? 'bg-zinc-800/90' : 'hover:bg-zinc-900'}`}
					>
						<span className='mt-0.5 text-cyan-400'>{command.icon}</span>
						<span className='min-w-0 flex-1'>
							<span className='flex items-center gap-2'><span className='font-mono text-[11px] text-zinc-300'>{command.name}</span><span className='truncate text-[11px] font-medium text-zinc-200'>{command.label}</span></span>
							<span className='mt-0.5 block text-[10px] leading-4 text-zinc-500'>{command.description}</span>
						</span>
					</button>
				))}
			</div>
			<div className='shrink-0 border-t border-zinc-800/90 px-3 py-1.5 text-[9.5px] text-zinc-600'>Select a command, add your instruction, then press Enter to send.</div>
		</div>,
		document.body,
	);
};

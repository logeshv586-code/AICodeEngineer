/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
	MessageSquare,
	Code2,
	CheckCircle,
	Play,
	Square,
	Loader2,
	HardDrive,
	FileText,
	BookOpen,
	FolderOpen,
	Search,
	Terminal,
	GitCommit,
	FlaskConical,
	Bug,
	Brain,
	Shield,
	Globe,
	Monitor,
	Image,
	Settings,
	HelpCircle,
	Sparkles,
	ChevronRight,
	ChevronDown,
	WandSparkles,
	Zap,
	Bot,
} from 'lucide-react';
import { ServicesAccessor } from '../../../../../../../editor/browser/editorExtensions.js';
import { ICommandService } from '../../../../../../../platform/commands/common/commands.js';
import { IChatThreadService } from '../../../chatThreadService.js';
import { ISkillsService } from '../../../skillsService.js';
import { INotificationService } from '../../../../../../../platform/notification/common/notification.js';
import { ForgeEventBus } from '../../../../forge/events/forgeEventBus.js';
import { ForgeEventType } from '../../../../../common/forge/events/forgeEvents.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlashCommand {
	readonly name: string;
	readonly label: string;
	readonly category: string;
	readonly description: string;
	readonly icon: React.ReactNode;
	readonly shortcut?: string;
	execute: (ctx: SlashCommandContext) => void | Promise<void>;
}

export interface SlashCommandContext {
	accessor: ServicesAccessor;
	commandService: ICommandService;
	chatThreadsService: IChatThreadService;
	args: string;
	onClose: () => void;
	setActiveTool: (tool: string) => void;
	sendMessage: (msg: string) => void;
}

export interface SlashCommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (command: SlashCommand, args: string) => void;
	anchorRect?: DOMRect | null;
	context: SlashCommandContext;
}

// ─── All Commands ────────────────────────────────────────────────────────────

function createAllCommands(ctx: SlashCommandContext): SlashCommand[] {
	const { accessor, commandService, chatThreadsService, setActiveTool, sendMessage } = ctx;

	return [
		// ── Agent ──────────────────────────────────────────────────────────────
		{
			name: '/agent',
			label: 'Chat Mode',
			category: 'Agent',
			description: 'Switch to normal chat mode',
			icon: <MessageSquare size={14} />,
			execute() { commandService.executeCommand('void.setChatMode', 'normal'); },
		},
		{
			name: '/agent,code',
			label: 'Agent Code',
			category: 'Agent',
			description: 'Enable agent mode for code edits',
			icon: <Code2 size={14} />,
			execute() { commandService.executeCommand('void.setChatMode', 'agent'); },
		},
		{
			name: '/agent,parallel',
			label: 'Parallel Agents',
			category: 'Agent',
			description: 'Split independent work across agents and coordinate the result',
			icon: <Bot size={14} />,
			execute() {
				sendMessage('Use parallel agents for independent parts of this task. Coordinate their results, avoid conflicting edits, then verify the combined change.');
			},
		},
		{
			name: '/agent,review',
			label: 'Review Code',
			category: 'Agent',
			description: 'Request a code review of the current file',
			icon: <CheckCircle size={14} />,
			execute() {
				sendMessage('Review the current file for code quality, bugs, and improvements.');
			},
		},
		{
			name: '/agent,test',
			label: 'Run Tests',
			category: 'Agent',
			description: 'Run the project test suite and report results',
			icon: <FlaskConical size={14} />,
			execute() {
				sendMessage('Run the test suite and report any failures or issues.');
			},
		},
		{
			name: '/agent,fix',
			label: 'Auto Fix',
			category: 'Agent',
			description: 'Find and automatically fix issues',
			icon: <WandSparkles size={14} />,
			execute() {
				sendMessage('Find and fix issues in the current file or selected files.');
			},
		},
		{
			name: '/agent,debug',
			label: 'Debug',
			category: 'Agent',
			description: 'Help debug an issue',
			icon: <Bug size={14} />,
			execute() {
				sendMessage('Help me debug the current issue. Analyze the code, identify the problem, and suggest fixes.');
			},
		},
		{
			name: '/agent,optimize',
			label: 'Optimize',
			category: 'Agent',
			description: 'Optimize code for performance',
			icon: <Zap size={14} />,
			execute() {
				sendMessage('Analyze and optimize the current code for performance.');
			},
		},
		{
			name: '/agent,security',
			label: 'Security Review',
			category: 'Agent',
			description: 'Review code for security vulnerabilities',
			icon: <Shield size={14} />,
			execute() {
				sendMessage('Review the current code for security vulnerabilities and suggest fixes.');
			},
		},
		{
			name: '/agent,test,write',
			label: 'Write Tests',
			category: 'Agent',
			description: 'Generate unit tests for the current file',
			icon: <FlaskConical size={14} />,
			execute() {
				sendMessage('Write comprehensive unit tests for the current file.');
			},
		},
		{
			name: '/agent,doc',
			label: 'Generate Docs',
			category: 'Agent',
			description: 'Generate documentation for current code',
			icon: <FileText size={14} />,
			execute() {
				sendMessage('Generate documentation and comments for the current file.');
			},
		},
		{
			name: '/agent,refactor',
			label: 'Refactor',
			category: 'Agent',
			description: 'Refactor the current code for clarity',
			icon: <Code2 size={14} />,
			execute() {
				sendMessage('Refactor the current code for better readability and maintainability.');
			},
		},
		{
			name: '/agent,explain',
			label: 'Explain Code',
			category: 'Agent',
			description: 'Explain what the current code does',
			icon: <MessageSquare size={14} />,
			execute() {
				sendMessage('Explain what this code does in detail.');
			},
		},

		// ── Workflow ───────────────────────────────────────────────────────────
		{
			name: '/workflow,start',
			label: 'Start Workflow',
			category: 'Workflow',
			description: 'Start a new multi-agent workflow for your task',
			icon: <Play size={14} />,
			execute() {
				sendMessage('Start a workflow to handle this task. Plan, execute, and report results.');
			},
		},
		{
			name: '/workflow,stop',
			label: 'Stop Workflow',
			category: 'Workflow',
			description: 'Cancel the currently running workflow',
			icon: <Square size={14} />,
			execute() {
				ForgeEventBus.getInstance().publish('CANCEL_WORKFLOW', {});
				sendMessage('Stopping the current workflow...');
			},
		},

		// ── Context ────────────────────────────────────────────────────────────
		{
			name: '/context,workspace',
			label: 'Workspace',
			category: 'Context',
			description: 'Show workspace overview and structure',
			icon: <HardDrive size={14} />,
			execute() {
				commandService.executeCommand('workbench.files.action.focusFilesExplorer');
				sendMessage('Show me an overview of this workspace.');
			},
		},
		{
			name: '/context,files',
			label: 'Selected Files',
			category: 'Context',
			description: 'Show context for selected files',
			icon: <FileText size={14} />,
			execute() {
				sendMessage('Show me the context of the currently selected files.');
			},
		},
		{
			name: '/context,symbol',
			label: 'Go to Symbol',
			category: 'Context',
			description: 'Jump to a symbol in the current file',
			icon: <BookOpen size={14} />,
			execute() {
				commandService.executeCommand('workbench.action.gotoSymbol');
			},
		},
		{
			name: '/context,folder',
			label: 'Open Folder',
			category: 'Context',
			description: 'Open a folder in the workspace',
			icon: <FolderOpen size={14} />,
			execute() {
				commandService.executeCommand('workbench.files.action.openFolder');
			},
		},
		{
			name: '/context,git',
			label: 'Git Status',
			category: 'Context',
			description: 'Show git status of the workspace',
			icon: <GitCommit size={14} />,
			execute() {
				commandService.executeCommand('git.status');
			},
		},

		// ── Search ─────────────────────────────────────────────────────────────
		{
			name: '/search,semantic',
			label: 'Semantic Search',
			category: 'Search',
			description: 'Search the codebase by meaning',
			icon: <Search size={14} />,
			execute() {
				const query = ctx.args.trim();
				sendMessage(`Search the codebase semantically for: "${query || '...'}"`);
			},
		},
		{
			name: '/search,file',
			label: 'Find File',
			category: 'Search',
			description: 'Quick file finder',
			icon: <FileText size={14} />,
			execute() {
				commandService.executeCommand('workbench.action.quickOpen');
			},
		},
		{
			name: '/search,text',
			label: 'Search Text',
			category: 'Search',
			description: 'Search for text across files',
			icon: <Search size={14} />,
			execute() {
				commandService.executeCommand('workbench.action.findInFiles');
			},
		},
		{
			name: '/search,references',
			label: 'Find References',
			category: 'Search',
			description: 'Find all references to a symbol',
			icon: <Search size={14} />,
			execute() {
				commandService.executeCommand('editor.action.referenceSearch.trigger');
			},
		},
		{
			name: '/search,definition',
			label: 'Go to Definition',
			category: 'Search',
			description: 'Jump to symbol definition',
			icon: <BookOpen size={14} />,
			execute() {
				commandService.executeCommand('editor.action.goToImplementation');
			},
		},

		// ── Tools ──────────────────────────────────────────────────────────────
		{
			name: '/terminal',
			label: 'Terminal',
			category: 'Tools',
			description: 'Open integrated terminal',
			icon: <Terminal size={14} />,
			execute() {
				commandService.executeCommand('workbench.action.terminal.toggleTerminal');
			},
		},
		{
			name: '/run,tests',
			label: 'Run Tests',
			category: 'Tools',
			description: 'Run the project test suite',
			icon: <FlaskConical size={14} />,
			execute() {
				sendMessage('Run the project test suite.');
			},
		},
		{
			name: '/run,lint',
			label: 'Run Linter',
			category: 'Tools',
			description: 'Run the linter on the current file',
			icon: <Bug size={14} />,
			execute() {
				sendMessage('Run the linter on the current file and report issues.');
			},
		},
		{
			name: '/run,build',
			label: 'Build Project',
			category: 'Tools',
			description: 'Build the current project',
			icon: <Terminal size={14} />,
			execute() {
				sendMessage('Build the current project and report any errors.');
			},
		},
		{
			name: '/git,status',
			label: 'Git Status',
			category: 'Tools',
			description: 'Show git repository status',
			icon: <GitCommit size={14} />,
			execute() {
				commandService.executeCommand('git.status');
			},
		},
		{
			name: '/git,commit',
			label: 'Git Commit',
			category: 'Tools',
			description: 'Help create a git commit',
			icon: <GitCommit size={14} />,
			execute() {
				sendMessage('Help me create a git commit for the current changes.');
			},
		},
		{
			name: '/git,diff',
			label: 'Git Diff',
			category: 'Tools',
			description: 'Show git diff for current file',
			icon: <GitCommit size={14} />,
			execute() {
				sendMessage('Show me the git diff for the current file.');
			},
		},
		{
			name: '/debug',
			label: 'Debug',
			category: 'Tools',
			description: 'Start debugging the current project',
			icon: <Bug size={14} />,
			execute() {
				commandService.executeCommand('workbench.action.debug.start');
			},
		},
		{
			name: '/browser',
			label: 'Open Browser',
			category: 'Tools',
			description: 'Open browser for web research',
			icon: <Globe size={14} />,
			execute() {
				sendMessage('Open the browser and help me research the current topic.');
			},
		},

		// ── Memory ─────────────────────────────────────────────────────────────
		{
			name: '/memory,show',
			label: 'Show Memory',
			category: 'Memory',
			description: 'Show workspace memory and knowledge',
			icon: <Brain size={14} />,
			execute() {
				sendMessage('Show me what you remember about this workspace.');
			},
		},
		{
			name: '/memory,save',
			label: 'Save Memory',
			category: 'Memory',
			description: 'Save current context to memory',
			icon: <Brain size={14} />,
			execute() {
				sendMessage('Save the current context and findings to workspace memory.');
			},
		},
		{
			name: '/workspace,index',
			label: 'Reindex Workspace',
			category: 'Memory',
			description: 'Rebuild the workspace index',
			icon: <HardDrive size={14} />,
			execute() {
				ForgeEventBus.getInstance().publish('REINDEX_WORKSPACE', {});
				sendMessage('Reindexing workspace... This may take a moment.');
			},
		},

		// ── Skills ─────────────────────────────────────────────────────────────
		{
			name: '/skill',
			label: 'Search Skills',
			category: 'Skills',
			description: 'Search the 333-skill registry (no LLM call)',
			icon: <BookOpen size={14} />,
			async execute() {
				const query = ctx.args.trim();
				if (!query) {
					accessor.get(INotificationService).info('Usage: /skill <query> (e.g. /skill jetson)');
					return;
				}
				const skillsService = accessor.get(ISkillsService);
				const results = await skillsService.searchSkills(query);
				const top = results.slice(0, 8);
				const formatted = top.length
					? top.map(r => `${r.id} (${r.category})`).join(', ')
					: 'No matching skills found';
				accessor.get(INotificationService).info(
					`Skill search "${query}": ${formatted}`
				);
			},
		},
		{
			name: '/skills',
			label: 'List Skills',
			category: 'Skills',
			description: 'Show skill registry and workspace status',
			icon: <BookOpen size={14} />,
			execute() {
				const skillsService = accessor.get(ISkillsService);
				const registryCount = skillsService.getRegistrySkillCount();
				const workspaceSkills = skillsService.getAllSkills();
				const names = workspaceSkills.map(s => s.name).join(', ');
				accessor.get(INotificationService).info(
					`${registryCount} registry skills, ${workspaceSkills.length} active workspace skills${names ? ` (Active: ${names})` : ''}`
				);
			},
		},

		// ── System ─────────────────────────────────────────────────────────────
		{
			name: '/models',
			label: 'Select Model',
			category: 'System',
			description: 'Change the active AI model',
			icon: <Sparkles size={14} />,
			execute() {
				commandService.executeCommand('void.openSettings');
			},
		},
		{
			name: '/settings',
			label: 'Settings',
			category: 'System',
			description: 'Open Forge AI settings',
			icon: <Settings size={14} />,
			shortcut: 'Ctrl+,',
			execute() {
				commandService.executeCommand('void.openSettings');
			},
		},
		{
			name: '/help',
			label: 'Help',
			category: 'System',
			description: 'Show available commands and shortcuts',
			icon: <HelpCircle size={14} />,
			execute() {
				sendMessage(
					'## Available Commands\n\n' +
					'**Agent** · /agent · /agent code · /agent review · /agent test · /agent fix · /agent debug · /agent optimize · /agent security · /agent explain · /agent refactor · /agent doc\n\n' +
					'**Workflow** · /workflow start · /workflow stop\n\n' +
					'**Context** · /context workspace · /context files · /context symbol · /context folder · /context git\n\n' +
					'**Search** · /search semantic · /search file · /search text · /search references · /search definition\n\n' +
					'**Skills** · /skill <query> · /skills\n\n' +
					'**Tools** · /terminal · /run tests · /run lint · /run build · /git status · /git commit · /git diff · /debug · /browser\n\n' +
					'**Memory** · /memory show · /memory save · /workspace index\n\n' +
					'**System** · /models · /settings · /help\n\n' +
					'**Shortcuts** · Ctrl+Enter = Send · / = Commands · Esc = Close'
				);
			},
		},
	];
}

// ─── Slash Command Palette (Portal) ─────────────────────────────────────────

export const SlashCommandPalette: React.FC<SlashCommandPaletteProps> = ({
	isOpen,
	onClose,
	onSelect,
	anchorRect,
	context,
}) => {
	const [filter, setFilter] = useState('');
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const allCommands = useMemo(() => createAllCommands(context), [context]);
	const filtered = useMemo(() => {
		if (!filter.trim()) return allCommands;
		const q = filter.toLowerCase().replace(/^\//, '').replace(/,/g, ' ');
		return allCommands.filter(c =>
			c.name.toLowerCase().includes(q) ||
			c.label.toLowerCase().includes(q) ||
			c.category.toLowerCase().includes(q) ||
			c.description.toLowerCase().includes(q)
		);
	}, [allCommands, filter]);

	const grouped = useMemo(() => {
		const groups: Record<string, SlashCommand[]> = {};
		for (const cmd of filtered) {
			if (!groups[cmd.category]) groups[cmd.category] = [];
			groups[cmd.category].push(cmd);
		}
		return groups;
	}, [filtered]);

	useEffect(() => {
		if (isOpen) {
			setFilter('');
			setSelectedIndex(0);
			setTimeout(() => inputRef.current?.focus(), 50);
		}
	}, [isOpen]);

	useEffect(() => {
		setSelectedIndex(0);
	}, [filter]);

	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		const flat = Object.values(grouped).flat();
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			setSelectedIndex(i => Math.min(i + 1, flat.length - 1));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			setSelectedIndex(i => Math.max(i - 1, 0));
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const cmd = flat[selectedIndex];
			if (cmd) onSelect(cmd, filter);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		}
	}, [selectedIndex, grouped, filter, onSelect, onClose]);

	if (!isOpen) return null;

	const flatCommands = Object.values(grouped).flat();
	const style: React.CSSProperties = anchorRect ? {
		position: 'fixed',
		left: anchorRect.left,
		bottom: window.innerHeight - anchorRect.top + 8,
		width: Math.min(400, window.innerWidth - 24),
		zIndex: 99999,
	} : {
		position: 'fixed',
		bottom: 24,
		left: '50%',
		transform: 'translateX(-50%)',
		width: Math.min(420, window.innerWidth - 24),
		zIndex: 99999,
	};

	const palette = (
		<div className='fixed inset-0 z-[99998]' onClick={onClose}>
			<div
				style={style}
				className='rounded-lg border border-zinc-700/50 bg-zinc-900/95 backdrop-blur-xl shadow-2xl overflow-hidden'
				onClick={e => e.stopPropagation()}
				onKeyDown={handleKeyDown}
			>
				{/* Input */}
				<div className='flex items-center gap-2 px-3 py-2 border-b border-zinc-800/60'>
					<span className='text-zinc-500 text-xs font-mono'>/</span>
					<input
						ref={inputRef}
						value={filter}
						onChange={e => setFilter(e.target.value)}
						placeholder='Type a command...'
						className='flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 outline-none'
					/>
					<span className='text-[10px] text-zinc-600'>ESC to close</span>
				</div>

				{/* Command list */}
				<div ref={listRef} className='max-h-[300px] overflow-y-auto py-1'>
					{flatCommands.length === 0 ? (
						<div className='px-3 py-4 text-xs text-zinc-600 text-center'>
							No commands found
						</div>
					) : (
						Object.entries(grouped).map(([category, cmds]) => (
							<div key={category}>
								<div className='px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600'>
									{category}
								</div>
								{cmds.map(cmd => {
									const globalIndex = flatCommands.indexOf(cmd);
									const isSelected = globalIndex === selectedIndex;
									return (
										<button
											key={cmd.name}
											type='button'
											onClick={() => onSelect(cmd, filter)}
											className={`
												w-full flex items-center gap-2.5 px-3 py-1.5
												text-left transition-colors cursor-pointer
												${isSelected ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'}
											`}
										>
											<span className={`
												w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0
												${isSelected ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800/60 text-zinc-500'}
											`}>
												{cmd.icon}
											</span>
											<div className='flex-1 min-w-0'>
												<div className={`text-xs ${isSelected ? 'text-zinc-200' : 'text-zinc-400'}`}>
													{cmd.label}
												</div>
												<div className='text-[10px] text-zinc-600 truncate'>
													{cmd.description}
												</div>
											</div>
											<span className='text-[10px] font-mono text-zinc-600 flex-shrink-0'>
												{cmd.name}
											</span>
										</button>
									);
								})}
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);

	return createPortal(palette, document.body);
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSlashCommands() {
	const [isOpen, setIsOpen] = useState(false);
	const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
	const inputRef = useRef<HTMLTextAreaElement | null>(null);

	const open = useCallback((rect: DOMRect) => {
		setAnchorRect(rect);
		setIsOpen(true);
	}, []);

	const close = useCallback(() => {
		setIsOpen(false);
		setAnchorRect(null);
		inputRef.current?.focus();
	}, []);

	const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === '/' && !isOpen) {
			const textarea = e.currentTarget;
			const rect = textarea.getBoundingClientRect();
			setAnchorRect(rect);
			setIsOpen(true);
		}
		if (e.key === 'Escape' && isOpen) {
			close();
		}
	}, [isOpen, close]);

	return { isOpen, anchorRect, open, close, inputRef, handleInputKeyDown };
}

// ─── Router Functions ────────────────────────────────────────────────────────

export function getAllSlashCommands(): SlashCommand[] {
	const mockCtx: SlashCommandContext = {
		accessor: null as any,
		commandService: null as any,
		chatThreadsService: null as any,
		args: '',
		onClose: () => {},
		setActiveTool: () => {},
		sendMessage: () => {},
	};
	return createAllCommands(mockCtx);
}

export async function executeSlashCommand(
	command: SlashCommand,
	args: string,
	ctx: SlashCommandContext
): Promise<void> {
	await command.execute({ ...ctx, args });
}

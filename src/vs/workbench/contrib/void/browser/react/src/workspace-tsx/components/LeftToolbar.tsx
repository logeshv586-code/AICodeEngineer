/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback } from 'react';
import {
	MessageSquare,
	FolderOpen,
	Search,
	Settings,
	Sparkles,
	GitBranch,
	Terminal,
	BookOpen,
	Brain,
	PanelRightOpen,
	PanelRightClose,
	ListChecks,
	Route,
} from 'lucide-react';
import { useAccessor } from '../../util/services.tsx';

interface LeftToolbarProps {
	activeTool: string;
	onToolChange: (tool: string) => void;
	hasActiveThread: boolean;
	threadCount: number;
	isRightPanelOpen: boolean;
	onToggleRightPanel: () => void;
	disabled?: boolean;
	forgeTools?: string[];
}

type ToolSpec = {
	id: string;
	label: string;
	icon: React.ElementType<{ size?: number; className?: string }>;
	shortcut?: string;
	kind: 'workspace' | 'native' | 'chat' | 'knowledge' | 'reasoning';
	command?: string;
};

const tools: ToolSpec[] = [
	{ id: 'chat', label: 'Chat', icon: MessageSquare, kind: 'chat' },
	{ id: 'files', label: 'Files', icon: FolderOpen, shortcut: 'Ctrl+Shift+E', kind: 'native', command: 'workbench.files.action.focusFilesExplorer' },
	{ id: 'search', label: 'Search', icon: Search, shortcut: 'Ctrl+Shift+F', kind: 'native', command: 'workbench.action.findInFiles' },
	{ id: 'terminal', label: 'Terminal', icon: Terminal, shortcut: 'Ctrl+`', kind: 'native', command: 'workbench.action.terminal.toggleTerminal' },
	{ id: 'agents', label: 'Agents', icon: GitBranch, kind: 'workspace' },
	{ id: 'workflows', label: 'Workflows', icon: ListChecks, kind: 'workspace' },
	{ id: 'plan', label: 'Plan', icon: Route, kind: 'workspace' },
	{ id: 'knowledge', label: 'Knowledge', icon: BookOpen, kind: 'knowledge' },
	{ id: 'reasoning', label: 'Reasoning', icon: Brain, kind: 'reasoning' },
];

export const LeftToolbar: React.FC<LeftToolbarProps> = ({
	activeTool,
	onToolChange,
	hasActiveThread,
	threadCount,
	isRightPanelOpen,
	onToggleRightPanel,
	disabled = false,
	forgeTools = ['agents', 'workflows', 'plan', 'knowledge', 'reasoning'],
}) => {
	const accessor = useAccessor();

	const notify = useCallback((message: string) => {
		try { accessor.get('INotificationService').info(message); } catch { /* optional during shutdown */ }
	}, [accessor]);

	const focusChat = useCallback(() => {
		const chat = accessor.get('IChatThreadService');
		if (!chat.state.currentThreadId) chat.openNewThread();
		void chat.focusCurrentChat();
	}, [accessor]);

	const runKnowledgeTask = useCallback(() => {
		const chat = accessor.get('IChatThreadService');
		let threadId = chat.state.currentThreadId;
		if (!threadId) threadId = chat.createNewThread();
		void chat.addUserMessageAndStreamResponse({
			threadId,
			userMessage: 'Understand the current codebase using lean semantic discovery and the Understand Anything graph when available. Summarize the architecture, important flows, and the files most relevant to the active work. Do not inject the entire graph.',
		});
		void chat.focusCurrentChat();
	}, [accessor]);

	const toggleReasoning = useCallback(() => {
		const settings = accessor.get('IVoidSettingsService');
		const selection = settings.state.modelSelectionOfFeature.Chat;
		if (!selection) {
			notify('Select a Chat model before changing reasoning.');
			return;
		}
		const current = settings.state.optionsOfModelSelection.Chat?.[selection.providerName]?.[selection.modelName]?.reasoningEnabled ?? false;
		settings.setOptionsOfModelSelection('Chat', selection.providerName, selection.modelName, { reasoningEnabled: !current });
		notify(`Reasoning ${current ? 'disabled' : 'enabled'} for ${selection.modelName}.`);
	}, [accessor, notify]);

	const handleTool = useCallback((tool: ToolSpec) => {
		if (disabled) return;
		if (tool.kind === 'workspace') {
			onToolChange(tool.id);
			return;
		}
		if (tool.kind === 'native' && tool.command) {
			void accessor.get('ICommandService').executeCommand(tool.command);
			return;
		}
		if (tool.kind === 'chat') {
			focusChat();
			return;
		}
		if (tool.kind === 'knowledge') {
			runKnowledgeTask();
			return;
		}
		if (tool.kind === 'reasoning') toggleReasoning();
	}, [accessor, disabled, focusChat, onToolChange, runKnowledgeTask, toggleReasoning]);

	return (
		<div className='void-left-toolbar flex flex-col items-center py-2 px-1 gap-0.5 border-r border-zinc-700/60 bg-zinc-900/40 shrink-0'>
			<div className='w-8 h-8 mb-2 flex items-center justify-center'>
				<div className='w-6 h-6 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center'><Sparkles size={14} className='text-emerald-400' /></div>
			</div>

			{tools.map(tool => {
				const Icon = tool.icon;
				const isActive = tool.kind === 'workspace' && activeTool === tool.id;
				const isForgeTool = forgeTools.includes(tool.id);
				return (
					<button
						key={tool.id}
						type='button'
						onClick={() => handleTool(tool)}
						disabled={disabled}
						className={`relative w-8 h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer group ${isActive ? 'bg-zinc-700 text-zinc-200' : isForgeTool ? 'text-emerald-400/70 hover:text-emerald-300 hover:bg-emerald-500/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
						title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}${isForgeTool ? ' — Forge' : ''}`}
					>
						<Icon size={16} />
						{isForgeTool && <span className='absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400' />}
						<div className='absolute left-full ml-2 px-2 py-1 bg-zinc-800 border border-zinc-700/60 rounded text-[10px] text-zinc-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10'>
							{tool.label}{tool.shortcut && <span className='ml-1 text-zinc-500'>{tool.shortcut}</span>}{isForgeTool && <span className='ml-1 text-emerald-400'>Forge</span>}
						</div>
					</button>
				);
			})}

			<div className='w-6 h-px bg-zinc-700/60 my-1' />

			{hasActiveThread && (
				<button type='button' onClick={() => onToolChange('workflows')} className='relative w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer' title={`${threadCount} workflow(s)`}>
					<ListChecks size={16} />
					{threadCount > 0 && <span className='absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-0.5 bg-emerald-500 rounded-full text-[8px] text-white flex items-center justify-center font-medium'>{Math.min(threadCount, 99)}</span>}
				</button>
			)}

			<button type='button' onClick={onToggleRightPanel} disabled={disabled} className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer ${isRightPanelOpen ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`} title='Toggle right panel'>
				{isRightPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
			</button>

			<button type='button' onClick={() => { void accessor.get('ICommandService').executeCommand('workbench.action.openVoidSettings'); }} className='w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer' title='Forge Settings'>
				<Settings size={16} />
			</button>
		</div>
	);
};
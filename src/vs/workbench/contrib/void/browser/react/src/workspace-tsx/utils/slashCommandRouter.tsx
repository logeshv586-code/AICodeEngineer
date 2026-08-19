/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0 See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
	MessageSquare, Code2, CheckCircle, Play, Square, HardDrive, FileText, BookOpen,
	FolderOpen, Search, Terminal, GitCommit, FlaskConical, Bug, Brain, Shield, Globe,
	Settings, HelpCircle, Sparkles, WandSparkles, Zap, Bot, ListChecks, Network,
	Palette, Activity,
} from 'lucide-react';
import { ServicesAccessor } from '../../../../../../../editor/browser/editorExtensions.js';
import { ICommandService } from '../../../../../../../platform/commands/common/commands.js';
import { IWorkspaceContextService } from '../../../../../../../platform/workspace/common/workspace.js';
import { IChatThreadService } from '../../../chatThreadService.js';
import { ISkillsService } from '../../../skillsService.js';
import { INotificationService } from '../../../../../../../platform/notification/common/notification.js';
import { IMCPService } from '../../../../../common/mcpService.js';
import { ISemanticSearchService } from '../../../../../common/forge/contracts/ISemanticSearchService.js';
import { FORGE_PROJECT_EVOLUTION_TASK, FORGE_SKILL_EVOLUTION_TASK } from './evolutionPrompts.js';

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

type PendingWorkItem = {
	id: string;
	workflowId: string;
	title: string;
	status: 'agent_required' | 'approval_required';
	prompt?: string;
	command?: string;
};

const notify = (accessor: ServicesAccessor, message: string, level: 'info' | 'warn' | 'error' = 'info') => {
	const service = accessor.get(INotificationService);
	if (level === 'error') service.error(message);
	else if (level === 'warn') service.warn(message);
	else service.info(message);
};

const callForgeToolJson = async <T,>(accessor: ServicesAccessor, toolName: string, params: Record<string, unknown>): Promise<T | null> => {
	const mcp = accessor.get(IMCPService);
	const installed = mcp.getMCPTools()?.some(tool => tool.mcpServerName === 'forge-super-agent' && tool.name === toolName);
	if (!installed) {
		notify(accessor, 'Forge Super Agent MCP is not ready. Run setup-forge-super-agent.bat and restart Forge.', 'warn');
		return null;
	}
	try {
		const { result } = await mcp.callMCPTool({ serverName: 'forge-super-agent', toolName, params });
		const text = mcp.stringifyResult(result).trim();
		return JSON.parse(text) as T;
	} catch (error) {
		notify(accessor, `${toolName} failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
		return null;
	}
};

const callForgeTool = async (accessor: ServicesAccessor, toolName: string, params: Record<string, unknown>, label: string) => {
	const result = await callForgeToolJson<unknown>(accessor, toolName, params);
	if (result !== null) {
		const summary = typeof result === 'string' ? result : JSON.stringify(result);
		notify(accessor, `${label}: ${summary.slice(0, 1200)}`);
	}
};

function createAllCommands(ctx: SlashCommandContext): SlashCommand[] {
	const { accessor, commandService, chatThreadsService, sendMessage } = ctx;
	return [
		{ name: '/agent', label: 'Chat Mode', category: 'Agent', description: 'Switch to normal chat mode', icon: <MessageSquare size={14} />, execute() { void commandService.executeCommand('void.setChatMode', 'normal'); } },
		{ name: '/agent,code', label: 'Agent Code', category: 'Agent', description: 'Enable agent mode for code edits', icon: <Code2 size={14} />, execute() { void commandService.executeCommand('void.setChatMode', 'agent'); } },
		{ name: '/agent,parallel', label: 'Parallel Agents', category: 'Agent', description: 'Split independent work across coordinated agents', icon: <Bot size={14} />, execute() { sendMessage('Use parallel agents only for independent work. Coordinate results, avoid conflicting edits, then verify the combined change.'); } },
		{ name: '/agent,review', label: 'Review Code', category: 'Agent', description: 'Review the current workspace changes', icon: <CheckCircle size={14} />, execute() { sendMessage('Review the current workspace changes for correctness, security, performance, maintainability, and regressions. Fix actionable issues when safe and verify them.'); } },
		{ name: '/agent,test', label: 'Run Tests', category: 'Agent', description: 'Run relevant tests and fix failures', icon: <FlaskConical size={14} />, execute() { sendMessage('Run the most relevant tests, diagnose failures, fix the implementation or tests as appropriate, and rerun verification.'); } },
		{ name: '/agent,fix', label: 'Auto Fix', category: 'Agent', description: 'Find and fix workspace issues', icon: <WandSparkles size={14} />, execute() { sendMessage('Find the root cause of the current issue, implement the smallest coherent fix, and run targeted regression checks.'); } },
		{ name: '/agent,debug', label: 'Debug', category: 'Agent', description: 'Debug the current issue', icon: <Bug size={14} />, execute() { sendMessage('Debug the current issue. Reproduce where possible, inspect relevant code and logs, identify the root cause, fix it, and verify the result.'); } },
		{ name: '/agent,optimize', label: 'Optimize', category: 'Agent', description: 'Optimize code without changing behavior', icon: <Zap size={14} />, execute() { sendMessage('Profile or inspect the relevant code, optimize measurable bottlenecks without changing behavior, and verify the result.'); } },
		{ name: '/agent,security', label: 'Security Review', category: 'Agent', description: 'Review and fix security issues', icon: <Shield size={14} />, execute() { sendMessage('Review the relevant code for security vulnerabilities, fix confirmed issues safely, and verify the changes.'); } },
		{ name: '/agent,test,write', label: 'Write Tests', category: 'Agent', description: 'Create meaningful tests for the current task', icon: <FlaskConical size={14} />, execute() { sendMessage('Write meaningful tests for the current task, prioritizing regressions and behavior over shallow coverage. Run them and fix failures.'); } },
		{ name: '/agent,doc', label: 'Generate Docs', category: 'Agent', description: 'Document relevant code and behavior', icon: <FileText size={14} />, execute() { sendMessage('Document the relevant code and behavior accurately. Keep comments concise and update user-facing documentation where needed.'); } },
		{ name: '/agent,refactor', label: 'Refactor', category: 'Agent', description: 'Refactor code and preserve behavior', icon: <Code2 size={14} />, execute() { sendMessage('Refactor the relevant code for clarity and maintainability while preserving behavior. Run targeted verification afterwards.'); } },
		{ name: '/agent,explain', label: 'Explain Code', category: 'Agent', description: 'Explain relevant architecture and flow', icon: <MessageSquare size={14} />, execute() { sendMessage('Explain the relevant code and architecture for the current task. Read only the context needed and identify important data/control flow.'); } },

		{ name: '/evolve', label: 'Project Evolution', category: 'Evolution', description: 'Inspect the current code and apply or suggest the next safe upgrade', icon: <Sparkles size={14} />, execute() { sendMessage(FORGE_PROJECT_EVOLUTION_TASK); } },
		{ name: '/evolve,skills', label: 'Skills Evolution', category: 'Evolution', description: 'Improve project-local skills from proven code patterns', icon: <BookOpen size={14} />, execute() { sendMessage(FORGE_SKILL_EVOLUTION_TASK); } },

		{ name: '/workflow,start', label: 'Start Workflow', category: 'Workflow', description: 'Plan and execute a multi-step task', icon: <Play size={14} />, execute() { sendMessage(`Run this as a Forge workflow. Plan, implement, verify, fix failures, and review the final result. ${ctx.args}`.trim()); } },
		{ name: '/workflow,stop', label: 'Stop Workflow', category: 'Workflow', description: 'Abort the active agent/workflow run', icon: <Square size={14} />, async execute() {
			const threadId = chatThreadsService.state.currentThreadId;
			if (!threadId) { notify(accessor, 'There is no active workflow thread.', 'warn'); return; }
			await chatThreadsService.abortRunning(threadId);
			notify(accessor, 'Active workflow/agent run stopped.');
		} },

		{ name: '/context,workspace', label: 'Workspace', category: 'Context', description: 'Open files and ask for a focused workspace overview', icon: <HardDrive size={14} />, execute() { void commandService.executeCommand('workbench.files.action.focusFilesExplorer'); sendMessage('Give me a focused overview of this workspace for the current task.'); } },
		{ name: '/context,files', label: 'Selected Files', category: 'Context', description: 'Use selected files as task context', icon: <FileText size={14} />, execute() { sendMessage('Inspect the currently selected files and use only the relevant parts as context for this task.'); } },
		{ name: '/context,symbol', label: 'Go to Symbol', category: 'Context', description: 'Jump to a symbol in the current file', icon: <BookOpen size={14} />, execute() { void commandService.executeCommand('workbench.action.gotoSymbol'); } },
		{ name: '/context,folder', label: 'Open Folder', category: 'Context', description: 'Open a workspace folder', icon: <FolderOpen size={14} />, execute() { void commandService.executeCommand('workbench.action.files.openFolder'); } },
		{ name: '/context,git', label: 'Git Status', category: 'Context', description: 'Open source control status', icon: <GitCommit size={14} />, execute() { void commandService.executeCommand('workbench.view.scm'); } },

		{ name: '/search,semantic', label: 'Semantic Search', category: 'Search', description: 'Search the codebase by meaning', icon: <Search size={14} />, execute() { sendMessage(`Search the codebase semantically for: ${ctx.args || 'the current task'}. Use the Understand Anything graph only when it adds value.`); } },
		{ name: '/search,file', label: 'Find File', category: 'Search', description: 'Quick file finder', icon: <FileText size={14} />, execute() { void commandService.executeCommand('workbench.action.quickOpen'); } },
		{ name: '/search,text', label: 'Search Text', category: 'Search', description: 'Search text across files', icon: <Search size={14} />, execute() { void commandService.executeCommand('workbench.action.findInFiles'); } },
		{ name: '/search,references', label: 'Find References', category: 'Search', description: 'Find references to the current symbol', icon: <Search size={14} />, execute() { void commandService.executeCommand('editor.action.referenceSearch.trigger'); } },
		{ name: '/search,definition', label: 'Go to Definition', category: 'Search', description: 'Jump to the symbol definition', icon: <BookOpen size={14} />, execute() { void commandService.executeCommand('editor.action.revealDefinition'); } },

		{ name: '/terminal', label: 'Terminal', category: 'Tools', description: 'Toggle the integrated terminal', icon: <Terminal size={14} />, execute() { void commandService.executeCommand('workbench.action.terminal.toggleTerminal'); } },
		{ name: '/run,tests', label: 'Run Tests', category: 'Tools', description: 'Run relevant project tests', icon: <FlaskConical size={14} />, execute() { sendMessage('Run the relevant project tests and fix any failures caused by the current changes.'); } },
		{ name: '/run,lint', label: 'Run Linter', category: 'Tools', description: 'Run relevant lint/type checks', icon: <Bug size={14} />, execute() { sendMessage('Run the relevant lint and type checks, fix actionable failures, and rerun them.'); } },
		{ name: '/run,build', label: 'Build Project', category: 'Tools', description: 'Build the current project', icon: <Terminal size={14} />, execute() { sendMessage('Build the current project, diagnose failures, fix issues caused by the current work, and rebuild.'); } },
		{ name: '/git,status', label: 'Git Status', category: 'Tools', description: 'Open source control status', icon: <GitCommit size={14} />, execute() { void commandService.executeCommand('workbench.view.scm'); } },
		{ name: '/git,commit', label: 'Git Commit', category: 'Tools', description: 'Prepare a commit from current changes', icon: <GitCommit size={14} />, execute() { sendMessage('Review the current git changes and prepare a concise commit message. Do not commit unless I explicitly ask you to.'); } },
		{ name: '/git,diff', label: 'Git Diff', category: 'Tools', description: 'Review the current diff', icon: <GitCommit size={14} />, execute() { sendMessage('Review the current git diff, summarize the changes, and flag regressions or incomplete work.'); } },
		{ name: '/debug', label: 'Start Debugging', category: 'Tools', description: 'Start the workbench debugger', icon: <Bug size={14} />, execute() { void commandService.executeCommand('workbench.action.debug.start'); } },

		{ name: '/browser', label: 'Browser Agent', category: 'Super Agent', description: 'Use the persistent browser for UI/web tasks', icon: <Globe size={14} />, execute() { sendMessage(`Use the Forge browser agent for this task. Inspect compact DOM first, interact only as needed, make required code changes, and verify in the browser. ${ctx.args}`.trim()); } },
		{ name: '/browser-status', label: 'Browser Status', category: 'Super Agent', description: 'Inspect local browser runtime without an LLM call', icon: <Globe size={14} />, execute() { return callForgeTool(accessor, 'forge_browser', { action: 'status' }, 'Browser'); } },
		{ name: '/graph', label: 'Code Graph Status', category: 'Super Agent', description: 'Inspect Understand Anything graph status locally', icon: <Network size={14} />, execute() { const workspace = accessor.get(IWorkspaceContextService).getWorkspace().folders[0]?.uri.fsPath; return callForgeTool(accessor, 'forge_understand', { action: 'status', ...(workspace ? { workspace } : {}) }, 'Code graph'); } },
		{ name: '/design', label: 'Design Agent', category: 'Super Agent', description: 'Use Open Design for a design-to-code task', icon: <Palette size={14} />, execute() { sendMessage(`Treat this as a design implementation task. Use Open Design where it adds value, keep editable artifacts, implement production-ready code, and verify visually in the browser. ${ctx.args}`.trim()); } },
		{ name: '/design-status', label: 'Open Design Status', category: 'Super Agent', description: 'Inspect Open Design runtime locally', icon: <Palette size={14} />, execute() { return callForgeTool(accessor, 'forge_sidecar', { action: 'status', name: 'open-design' }, 'Open Design'); } },
		{ name: '/health', label: 'Integration Health', category: 'Super Agent', description: 'Run the local integration doctor', icon: <Activity size={14} />, execute() { return callForgeTool(accessor, 'forge_integrations', { action: 'doctor' }, 'Integrations'); } },
		{ name: '/work', label: 'Work Mode', category: 'Super Agent', description: 'Inspect Work Mode or create an automation from natural language', icon: <ListChecks size={14} />, execute() {
			const requirement = ctx.args.trim();
			if (requirement) {
				sendMessage(`Create or update a persistent Forge Work Mode automation for this requirement: ${requirement}\n\nUse the forge_workflow tool. Prefer a prompt workflow. Use command workflows only when a fixed command is truly required, and preserve explicit approval unless I clearly request unattended execution. Confirm the interpreted schedule and task.`);
				return;
			}
			return callForgeTool(accessor, 'forge_workflow', { action: 'status' }, 'Work Mode');
		} },
		{ name: '/work-pending', label: 'Pending Work', category: 'Super Agent', description: 'Show queued agent work and approval-gated commands', icon: <ListChecks size={14} />, async execute() {
			const pending = await callForgeToolJson<PendingWorkItem[]>(accessor, 'forge_workflow', { action: 'pending' });
			if (!pending) return;
			if (!pending.length) { notify(accessor, 'Work Mode has no pending items.'); return; }
			notify(accessor, `Pending Work Mode: ${pending.slice(0, 10).map(item => `${item.id} · ${item.status} · ${item.title}`).join(' | ')}${pending.length > 10 ? ` · +${pending.length - 10} more` : ''}`);
		} },
		{ name: '/work-approve', label: 'Approve Work Command', category: 'Super Agent', description: 'Approve one queued command by pending id', icon: <CheckCircle size={14} />, async execute() {
			const query = ctx.args.trim();
			if (!query) { notify(accessor, 'Usage: /work-approve <pending-id>', 'warn'); return; }
			const pending = await callForgeToolJson<PendingWorkItem[]>(accessor, 'forge_workflow', { action: 'pending' });
			if (!pending) return;
			const matches = pending.filter(item => item.status === 'approval_required' && (item.id === query || item.id.startsWith(query)));
			if (!matches.length) { notify(accessor, `No approval-required item matches "${query}".`, 'warn'); return; }
			if (matches.length > 1) { notify(accessor, `"${query}" matches multiple pending items. Use a longer id.`, 'warn'); return; }
			const item = matches[0];
			const execution = await callForgeToolJson<{ result?: Record<string, unknown> }>(accessor, 'forge_workflow', { action: 'run', id: item.workflowId, approved: true });
			if (!execution) return;
			await callForgeToolJson(accessor, 'forge_workflow', { action: 'ack', id: item.id, result: execution.result || execution });
			notify(accessor, `Approved and executed "${item.title}".`);
		} },
		{ name: '/work-remove', label: 'Remove Work Automation', category: 'Super Agent', description: 'Remove a Work Mode workflow by id', icon: <Square size={14} />, async execute() {
			const id = ctx.args.trim();
			if (!id) { notify(accessor, 'Usage: /work-remove <workflow-id>', 'warn'); return; }
			const result = await callForgeToolJson<{ removed: boolean }>(accessor, 'forge_workflow', { action: 'remove', id });
			if (result) notify(accessor, result.removed ? `Removed Work Mode workflow ${id}.` : `No workflow found with id ${id}.`, result.removed ? 'info' : 'warn');
		} },

		{ name: '/memory,show', label: 'Show Memory', category: 'Memory', description: 'Inspect relevant workspace memory', icon: <Brain size={14} />, execute() { sendMessage('Show the relevant remembered workspace context for the current task, and distinguish stored facts from fresh code inspection.'); } },
		{ name: '/memory,save', label: 'Save Memory', category: 'Memory', description: 'Save durable workspace findings', icon: <Brain size={14} />, execute() { sendMessage('Save only durable, useful workspace findings from this task to memory. Avoid transient logs or secrets.'); } },
		{ name: '/workspace,index', label: 'Refresh Code Index', category: 'Memory', description: 'Refresh the local CocoIndex semantic index', icon: <HardDrive size={14} />, async execute() {
			try {
				const workspacePath = accessor.get(IWorkspaceContextService).getWorkspace().folders[0]?.uri.fsPath;
				if (!workspacePath) { notify(accessor, 'Open a workspace folder before refreshing the code index.', 'warn'); return; }
				const stats = await accessor.get(ISemanticSearchService).indexWorkspace(workspacePath);
				notify(accessor, `Code index refreshed: ${stats.totalFiles} files, ${stats.totalChunks} chunks.`);
			} catch (error) {
				notify(accessor, `Code index refresh failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
			}
		} },

		{ name: '/skill', label: 'Search Skills', category: 'Skills', description: 'Search the 333-skill registry locally', icon: <BookOpen size={14} />, async execute() {
			const query = ctx.args.trim();
			if (!query) { notify(accessor, 'Usage: /skill <query> (e.g. /skill jetson)'); return; }
			const results = await accessor.get(ISkillsService).searchSkills(query);
			const top = results.slice(0, 8);
			notify(accessor, top.length ? `Skill search "${query}": ${top.map(result => `${result.id} (${result.category})`).join(', ')}` : `No skills match "${query}".`);
		} },
		{ name: '/skills', label: 'List Skills', category: 'Skills', description: 'Show registry and workspace skill status', icon: <BookOpen size={14} />, execute() {
			const skillsService = accessor.get(ISkillsService);
			const workspaceSkills = skillsService.getAllSkills();
			notify(accessor, `${skillsService.getRegistrySkillCount()} registry skills, ${workspaceSkills.length} active workspace skills.`);
		} },

		{ name: '/models', label: 'Select Model', category: 'System', description: 'Open Forge provider/model settings', icon: <Sparkles size={14} />, execute() { void commandService.executeCommand('workbench.action.openVoidSettings'); } },
		{ name: '/settings', label: 'Settings', category: 'System', description: 'Open Forge settings', icon: <Settings size={14} />, shortcut: 'Ctrl+,', execute() { void commandService.executeCommand('workbench.action.openVoidSettings'); } },
		{ name: '/help', label: 'Help', category: 'System', description: 'Show core Forge command groups locally', icon: <HelpCircle size={14} />, execute() {
			notify(accessor, 'Forge commands: Agent /agent,* · Evolution /evolve /evolve,skills · Workflow /workflow,start /workflow,stop · Super Agent /browser /graph /design /work /work-pending /work-approve /health · Skills /skill /skills · Tools /terminal /run,* /git,* · Memory /workspace,index · System /models /settings. Type 2+ letters after / to autocomplete registry skills.');
		} },
	];
}

export const SlashCommandPalette: React.FC<SlashCommandPaletteProps> = ({ isOpen, onClose, onSelect, anchorRect, context }) => {
	const [filter, setFilter] = useState('');
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const allCommands = useMemo(() => createAllCommands(context), [context]);

	const { commandQuery, args } = useMemo(() => {
		const raw = filter.trim();
		const [commandToken, ...argParts] = raw.split(/\s+/);
		return { commandQuery: (commandToken || '').replace(/^\//, '').toLowerCase(), args: argParts.join(' ') };
	}, [filter]);

	const dynamicSkillCommands = useMemo<SlashCommand[]>(() => {
		if (!commandQuery || commandQuery.length < 2) return [];
		try {
			const skillsService = context.accessor?.get?.(ISkillsService);
			if (!skillsService) return [];
			return skillsService.autocompleteSkills(commandQuery, 8).map(suggestion => ({
				name: `/${suggestion.id}`,
				label: suggestion.name || suggestion.id,
				category: 'Skills (Registry)',
				description: suggestion.description || `Domain skill: ${suggestion.id}`,
				icon: <BookOpen size={14} />,
				execute(commandContext: SlashCommandContext) { commandContext.sendMessage(`/${suggestion.id}${commandContext.args ? ` ${commandContext.args}` : ''}`); },
			}));
		} catch { return []; }
	}, [context.accessor, commandQuery]);

	const allAvailableCommands = useMemo(() => [...allCommands, ...dynamicSkillCommands], [allCommands, dynamicSkillCommands]);
	const filtered = useMemo(() => {
		if (!filter.trim()) return allCommands;
		if (args.length > 0) return allAvailableCommands.filter(command => command.name.toLowerCase().replace(/^\//, '').startsWith(commandQuery));
		return allAvailableCommands.filter(command => command.name.toLowerCase().includes(commandQuery) || command.label.toLowerCase().includes(commandQuery) || command.category.toLowerCase().includes(commandQuery) || command.description.toLowerCase().includes(commandQuery));
	}, [allCommands, allAvailableCommands, filter, commandQuery, args]);

	const grouped = useMemo(() => {
		const groups: Record<string, SlashCommand[]> = {};
		for (const command of filtered) (groups[command.category] ||= []).push(command);
		return groups;
	}, [filtered]);

	useEffect(() => { if (isOpen) { setFilter(''); setSelectedIndex(0); setTimeout(() => inputRef.current?.focus(), 50); } }, [isOpen]);
	useEffect(() => { setSelectedIndex(0); }, [filter]);

	const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
		const flat = Object.values(grouped).flat();
		if (event.key === 'ArrowDown') { event.preventDefault(); setSelectedIndex(index => Math.min(index + 1, Math.max(0, flat.length - 1))); }
		else if (event.key === 'ArrowUp') { event.preventDefault(); setSelectedIndex(index => Math.max(index - 1, 0)); }
		else if (event.key === 'Enter') { event.preventDefault(); const command = flat[selectedIndex]; if (command) onSelect(command, args); }
		else if (event.key === 'Escape') { event.preventDefault(); onClose(); }
	}, [selectedIndex, grouped, args, onSelect, onClose]);

	if (!isOpen) return null;
	const flatCommands = Object.values(grouped).flat();
	const style: React.CSSProperties = anchorRect ? { position: 'fixed', left: anchorRect.left, bottom: window.innerHeight - anchorRect.top + 8, width: Math.min(420, window.innerWidth - 24), zIndex: 99999 } : { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', width: Math.min(440, window.innerWidth - 24), zIndex: 99999 };

	return createPortal(
		<div className='forge-slash-overlay fixed inset-0 z-[99998]' onClick={onClose}>
			<div role='dialog' aria-label='Forge slash commands' style={style} className='forge-slash-palette rounded-lg border border-zinc-700/50 bg-zinc-900/95 backdrop-blur-xl shadow-2xl overflow-hidden' onClick={event => event.stopPropagation()} onKeyDown={handleKeyDown}>
				<div className='forge-slash-search flex items-center gap-2 px-3 py-2 border-b border-zinc-800/60'><span className='forge-slash-prefix text-zinc-500 text-xs font-mono'>/</span><input ref={inputRef} value={filter} onChange={event => setFilter(event.target.value)} placeholder='Type a command or skill…' className='forge-slash-input flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 outline-none' /><span className='forge-slash-escape text-[10px] text-zinc-600'>ESC</span></div>
				<div ref={listRef} className='forge-slash-list max-h-[320px] overflow-y-auto py-1'>
					{flatCommands.length === 0 ? <div className='forge-slash-empty px-3 py-4 text-xs text-zinc-600 text-center'>No commands found</div> : Object.entries(grouped).map(([category, commands]) => <div className='forge-slash-group' key={category}>
						<div className='forge-slash-category px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600'>{category}</div>
						{commands.map(command => {
							const globalIndex = flatCommands.indexOf(command);
							const isSelected = globalIndex === selectedIndex;
							return <button key={command.name} type='button' onClick={() => onSelect(command, args)} className={`forge-slash-command ${isSelected ? 'forge-slash-command-selected bg-zinc-800' : 'hover:bg-zinc-800/50'} w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors cursor-pointer`}>
								<span className={`forge-slash-icon w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800/60 text-zinc-500'}`}>{command.icon}</span>
								<div className='forge-slash-copy flex-1 min-w-0'><div className={`forge-slash-label text-xs ${isSelected ? 'text-zinc-200' : 'text-zinc-400'}`}>{command.label}</div><div className='forge-slash-description text-[10px] text-zinc-600 truncate'>{command.description}</div></div>
								<span className='forge-slash-name text-[10px] font-mono text-zinc-600 flex-shrink-0'>{command.name}</span>
							</button>;
						})}
					</div>)}
				</div>
			</div>
		</div>, document.body
	);
};

export function useSlashCommands() {
	const [isOpen, setIsOpen] = useState(false);
	const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
	const inputRef = useRef<HTMLTextAreaElement | null>(null);
	const open = useCallback((rect: DOMRect) => { setAnchorRect(rect); setIsOpen(true); }, []);
	const close = useCallback(() => { setIsOpen(false); setAnchorRect(null); inputRef.current?.focus(); }, []);
	const handleInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === '/' && !isOpen) { setAnchorRect(event.currentTarget.getBoundingClientRect()); setIsOpen(true); }
		if (event.key === 'Escape' && isOpen) close();
	}, [isOpen, close]);
	return { isOpen, anchorRect, open, close, inputRef, handleInputKeyDown };
}

export function getAllSlashCommands(): SlashCommand[] {
	const mockCtx: SlashCommandContext = { accessor: null as any, commandService: null as any, chatThreadsService: null as any, args: '', onClose: () => {}, setActiveTool: () => {}, sendMessage: () => {} };
	return createAllCommands(mockCtx);
}

export async function executeSlashCommand(command: SlashCommand, args: string, ctx: SlashCommandContext): Promise<void> {
	await command.execute({ ...ctx, args });
}
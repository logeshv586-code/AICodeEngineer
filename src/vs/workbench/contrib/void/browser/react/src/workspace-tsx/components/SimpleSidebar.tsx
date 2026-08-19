/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, Network, ListChecks, Palette, Activity, Settings, Globe, MessageSquare, FolderOpen, Search, Terminal, Wrench } from 'lucide-react';
import { INotificationService } from '../../../../../../../platform/notification/common/notification.js';
import { IWorkspaceContextService } from '../../../../../../../platform/workspace/common/workspace.js';
import { IMCPService } from '../../../../../common/mcpService.js';
import { ThreadList, ThreadItem } from './ThreadList';
import { ForgeBrandMark } from './ForgeBrandMark';
import type { SlashCommandContext } from '../utils/slashCommandRouter';

export interface SimpleSidebarProps {
	threads: ThreadItem[];
	activeThreadId: string | null;
	onSelectThread: (id: string) => void;
	onNewThread: () => void;
	onDeleteThread?: (id: string) => void;
	onSettingsClick?: () => void;
	workspaceName?: string;
	className?: string;
	slashContext?: SlashCommandContext;
}

const RailButton: React.FC<{
	title: string;
	active?: boolean;
	busy?: boolean;
	onClick: () => void;
	children: React.ReactNode;
}> = ({ title, active = false, busy = false, onClick, children }) => (
	<button
		type='button'
		onClick={onClick}
		className={`forge-brand-rail-button ${active ? 'forge-brand-rail-button-active' : ''} ${busy ? 'animate-pulse' : ''}`}
		title={title}
		aria-label={title}
	>
		{children}
	</button>
);

export const SimpleSidebar: React.FC<SimpleSidebarProps> = ({
	threads,
	activeThreadId,
	onSelectThread,
	onNewThread,
	onDeleteThread,
	onSettingsClick,
	workspaceName = 'Workspace',
	className = '',
	slashContext,
}) => {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [busyAction, setBusyAction] = useState<string | null>(null);
	const [query, setQuery] = useState('');

	const handleNewThread = useCallback(() => {
		setIsCollapsed(false);
		onNewThread();
	}, [onNewThread]);

	const openSettings = useCallback(() => {
		if (onSettingsClick) return onSettingsClick();
		void slashContext?.commandService.executeCommand('workbench.action.openVoidSettings');
	}, [onSettingsClick, slashContext]);

	const runWorkbenchCommand = useCallback((command: string) => {
		if (!slashContext) return;
		void slashContext.commandService.executeCommand(command);
	}, [slashContext]);

	const runLocalForgeTool = useCallback(async (toolName: string, params: Record<string, unknown>, label: string) => {
		if (!slashContext) return;
		setBusyAction(toolName);
		try {
			const mcp = slashContext.accessor.get(IMCPService);
			const notification = slashContext.accessor.get(INotificationService);
			const installedTool = mcp.getMCPTools()?.find(tool => tool.name === toolName && tool.mcpServerName === 'forge-super-agent');
			if (!installedTool) {
				notification.warn('Forge Super Agent is not ready yet. Run setup-forge-super-agent.bat and restart Forge.');
				return;
			}
			const { result } = await mcp.callMCPTool({ serverName: 'forge-super-agent', toolName, params });
			const text = mcp.stringifyResult(result).replace(/\s+/g, ' ').trim();
			notification.info(`${label}: ${text.slice(0, 900) || 'Ready'}`);
		} catch (error) {
			try { slashContext.accessor.get(INotificationService).error(`${label} failed: ${error instanceof Error ? error.message : String(error)}`); } catch { /* shutdown */ }
		} finally {
			setBusyAction(null);
		}
	}, [slashContext]);

	const inspectBrowser = useCallback(() => { void runLocalForgeTool('forge_browser', { action: 'snapshot' }, 'Browser'); }, [runLocalForgeTool]);
	const inspectCodeGraph = useCallback(() => {
		if (!slashContext) return;
		const workspace = slashContext.accessor.get(IWorkspaceContextService).getWorkspace().folders[0]?.uri.fsPath;
		void runLocalForgeTool('forge_understand', { action: 'status', ...(workspace ? { workspace } : {}) }, 'Project knowledge');
	}, [runLocalForgeTool, slashContext]);
	const inspectWorkMode = useCallback(() => { void runLocalForgeTool('forge_workflow', { action: 'status' }, 'Work Mode'); }, [runLocalForgeTool]);
	const inspectDesignRuntime = useCallback(() => { void runLocalForgeTool('forge_sidecar', { action: 'status', name: 'open-design' }, 'Design'); }, [runLocalForgeTool]);
	const inspectIntegrations = useCallback(() => { void runLocalForgeTool('forge_integrations', { action: 'doctor' }, 'Forge health'); }, [runLocalForgeTool]);

	const filteredThreads = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (!normalized) return threads;
		return threads.filter(thread => `${thread.title} ${thread.preview}`.toLowerCase().includes(normalized));
	}, [query, threads]);

	const quickButtons = slashContext ? [
		{ id: 'browser', title: 'Browser', icon: <Globe size={13} />, action: inspectBrowser, busy: busyAction === 'forge_browser' },
		{ id: 'understand', title: 'Project knowledge', icon: <Network size={13} />, action: inspectCodeGraph, busy: busyAction === 'forge_understand' },
		{ id: 'work', title: 'Work Mode', icon: <ListChecks size={13} />, action: inspectWorkMode, busy: busyAction === 'forge_workflow' },
		{ id: 'design', title: 'Design', icon: <Palette size={13} />, action: inspectDesignRuntime, busy: busyAction === 'forge_sidecar' },
		{ id: 'health', title: 'Health', icon: <Activity size={13} />, action: inspectIntegrations, busy: busyAction === 'forge_integrations' },
	] : [];

	return (
		<div className={`forge-brand-nav-wrap flex h-full shrink-0 ${className}`}>
			<nav className='forge-brand-rail' aria-label='Forge navigation'>
				<button type='button' onClick={() => setIsCollapsed(false)} className='forge-brand-rail-mark' title='Forge home' aria-label='Forge home'>
					<ForgeBrandMark size={27} />
				</button>

				<div className='forge-brand-rail-group'>
					<RailButton title='Conversations' active={!isCollapsed} onClick={() => setIsCollapsed(false)}><MessageSquare size={16} /></RailButton>
					<RailButton title='New conversation' onClick={handleNewThread}><Plus size={16} /></RailButton>
				</div>

				<div className='forge-brand-rail-divider' />

				<div className='forge-brand-rail-group'>
					<RailButton title='Files' onClick={() => runWorkbenchCommand('workbench.view.explorer')}><FolderOpen size={15} /></RailButton>
					<RailButton title='Search project' onClick={() => runWorkbenchCommand('workbench.action.findInFiles')}><Search size={15} /></RailButton>
					<RailButton title='Terminal' onClick={() => runWorkbenchCommand('workbench.action.terminal.toggleTerminal')}><Terminal size={15} /></RailButton>
				</div>

				{slashContext && <>
					<div className='forge-brand-rail-divider' />
					<div className='forge-brand-rail-group'>
						<RailButton title='Browser' busy={busyAction === 'forge_browser'} onClick={inspectBrowser}><Globe size={15} /></RailButton>
						<RailButton title='Work Mode' busy={busyAction === 'forge_workflow'} onClick={inspectWorkMode}><ListChecks size={15} /></RailButton>
					</div>
				</>}

				<div className='mt-auto forge-brand-rail-group'>
					{slashContext && <RailButton title='System health' busy={busyAction === 'forge_integrations'} onClick={inspectIntegrations}><Activity size={15} /></RailButton>}
					<RailButton title='Preferences' onClick={openSettings}><Settings size={15} /></RailButton>
					<RailButton title={isCollapsed ? 'Show conversations' : 'Hide conversations'} onClick={() => setIsCollapsed(value => !value)}>{isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}</RailButton>
				</div>
			</nav>

			{!isCollapsed && <aside className='forge-brand-sidebar forge-brand-sidebar-expanded w-[228px] flex flex-col shrink-0'>
				<header className='forge-brand-sidebar-header px-3 pt-3 pb-2.5 shrink-0'>
					<div className='flex items-start justify-between gap-2'>
						<div className='min-w-0'>
							<div className='text-[12px] font-semibold text-[var(--forge-text)]'>Conversations</div>
							<div className='text-[9.5px] text-[var(--forge-muted)] mt-0.5 truncate' title={workspaceName}>{workspaceName}</div>
						</div>
						<button type='button' onClick={handleNewThread} className='forge-brand-tool w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer shrink-0' title='New conversation' aria-label='New conversation'><Plus size={13} /></button>
					</div>

					<div className='forge-brand-sidebar-search mt-2.5 flex items-center gap-1.5 px-2'>
						<Search size={11} className='text-[var(--forge-muted-2)] shrink-0' />
						<input value={query} onChange={event => setQuery(event.target.value)} placeholder='Search conversations' className='w-full min-w-0 bg-transparent outline-none text-[10.5px] text-[var(--forge-text-2)] placeholder:text-[var(--forge-muted-2)] py-1.5' aria-label='Search conversations' />
					</div>
				</header>

				<div className='px-3 pt-2.5 pb-1 flex items-center justify-between'>
					<span className='text-[8.5px] uppercase tracking-[0.15em] text-[var(--forge-muted-2)]'>Recent</span>
					<span className='text-[8.5px] text-[var(--forge-muted-2)]'>{filteredThreads.length}</span>
				</div>
				<div className='flex-1 min-h-0 overflow-hidden'>
					<ThreadList threads={filteredThreads} activeThreadId={activeThreadId} onSelectThread={onSelectThread} onNewThread={handleNewThread} onDeleteThread={onDeleteThread} />
				</div>

				<div className='forge-brand-sidebar-footer px-2.5 py-2.5 shrink-0'>
					<div className='flex items-center gap-1.5 px-1 mb-2'>
						<Wrench size={10} className='text-[var(--forge-muted-2)]' />
						<span className='text-[8.5px] uppercase tracking-[0.13em] text-[var(--forge-muted-2)]'>Tools</span>
					</div>
					{quickButtons.length > 0 && <div className='grid grid-cols-5 gap-1'>{quickButtons.map(button => <button key={button.id} type='button' onClick={button.action} disabled={!!busyAction} className={`forge-brand-tool h-8 flex items-center justify-center rounded-lg cursor-pointer disabled:opacity-35 ${button.busy ? 'animate-pulse !text-[var(--forge-cyan)]' : ''}`} title={button.title} aria-label={button.title}>{button.icon}</button>)}</div>}
				</div>
			</aside>}
		</div>
	);
};

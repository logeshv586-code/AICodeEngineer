/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import { Plus, ChevronDown, Network, ListChecks, Palette, Activity, Settings, Globe } from 'lucide-react';
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
	className?: string;
	slashContext?: SlashCommandContext;
}

export const SimpleSidebar: React.FC<SimpleSidebarProps> = ({
	threads,
	activeThreadId,
	onSelectThread,
	onNewThread,
	onDeleteThread,
	onSettingsClick,
	className = '',
	slashContext,
}) => {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [busyAction, setBusyAction] = useState<string | null>(null);

	const handleNewThread = useCallback(() => onNewThread(), [onNewThread]);
	const openSettings = useCallback(() => {
		if (onSettingsClick) return onSettingsClick();
		void slashContext?.commandService.executeCommand('workbench.action.openVoidSettings');
	}, [onSettingsClick, slashContext]);

	const runLocalForgeTool = useCallback(async (toolName: string, params: Record<string, unknown>, label: string) => {
		if (!slashContext) return;
		setBusyAction(toolName);
		try {
			const mcp = slashContext.accessor.get(IMCPService);
			const notification = slashContext.accessor.get(INotificationService);
			const installedTool = mcp.getMCPTools()?.find(tool => tool.name === toolName && tool.mcpServerName === 'forge-super-agent');
			if (!installedTool) {
				notification.warn('Forge Super Agent MCP is not ready. Run setup-forge-super-agent.bat and restart Forge.');
				return;
			}
			const { result } = await mcp.callMCPTool({ serverName: 'forge-super-agent', toolName, params });
			const text = mcp.stringifyResult(result).replace(/\s+/g, ' ').trim();
			notification.info(`${label}: ${text.slice(0, 900) || 'OK'}`);
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
		void runLocalForgeTool('forge_understand', { action: 'status', ...(workspace ? { workspace } : {}) }, 'Code graph');
	}, [runLocalForgeTool, slashContext]);
	const inspectWorkMode = useCallback(() => { void runLocalForgeTool('forge_workflow', { action: 'status' }, 'Work Mode'); }, [runLocalForgeTool]);
	const inspectDesignRuntime = useCallback(() => { void runLocalForgeTool('forge_sidecar', { action: 'status', name: 'open-design' }, 'Open Design'); }, [runLocalForgeTool]);
	const inspectIntegrations = useCallback(() => { void runLocalForgeTool('forge_integrations', { action: 'doctor' }, 'Integrations'); }, [runLocalForgeTool]);

	if (isCollapsed) {
		return (
			<div className={`w-12 forge-brand-sidebar flex flex-col items-center py-2 gap-1 shrink-0 ${className}`}>
				<button type='button' onClick={() => setIsCollapsed(false)} className='w-9 h-9 flex items-center justify-center rounded-xl forge-brand-tool cursor-pointer' title='Expand Forge'><ForgeBrandMark size={26} /></button>
				<button type='button' onClick={handleNewThread} className='w-9 h-9 flex items-center justify-center rounded-lg forge-brand-tool cursor-pointer' title='New conversation'><Plus size={15} /></button>
				{slashContext && <>
					<button type='button' onClick={inspectBrowser} className='w-9 h-9 flex items-center justify-center rounded-lg forge-brand-tool cursor-pointer' title='Browser'><Globe size={14} /></button>
					<button type='button' onClick={inspectWorkMode} className='w-9 h-9 flex items-center justify-center rounded-lg forge-brand-tool cursor-pointer' title='Work Mode'><ListChecks size={14} /></button>
				</>}
				<button type='button' onClick={openSettings} className='w-9 h-9 flex items-center justify-center rounded-lg forge-brand-tool cursor-pointer mt-auto' title='Forge settings'><Settings size={14} /></button>
				<button type='button' onClick={() => setIsCollapsed(false)} className='w-9 h-9 flex items-center justify-center rounded-lg forge-brand-tool cursor-pointer' title='Expand sidebar'><ChevronDown size={14} className='rotate-[-90deg]' /></button>
			</div>
		);
	}

	const quickButtons = slashContext ? [
		{ id: 'browser', title: 'Browser', icon: <Globe size={13} />, action: inspectBrowser, busy: busyAction === 'forge_browser' },
		{ id: 'understand', title: 'Graph', icon: <Network size={13} />, action: inspectCodeGraph, busy: busyAction === 'forge_understand' },
		{ id: 'work', title: 'Work', icon: <ListChecks size={13} />, action: inspectWorkMode, busy: busyAction === 'forge_workflow' },
		{ id: 'design', title: 'Design', icon: <Palette size={13} />, action: inspectDesignRuntime, busy: busyAction === 'forge_sidecar' },
		{ id: 'health', title: 'Health', icon: <Activity size={13} />, action: inspectIntegrations, busy: busyAction === 'forge_integrations' },
	] : [];

	return (
		<div className={`forge-brand-sidebar forge-brand-sidebar-expanded w-60 flex flex-col shrink-0 ${className}`}>
			<div className='forge-brand-sidebar-header px-3 py-3 shrink-0'>
				<div className='flex items-center justify-between gap-2 mb-3'>
					<ForgeBrandMark size={30} withWordmark />
					<button type='button' onClick={() => setIsCollapsed(true)} className='w-7 h-7 flex items-center justify-center rounded-lg forge-brand-tool cursor-pointer' title='Collapse sidebar'><ChevronDown size={13} className='rotate-90' /></button>
				</div>
				<button type='button' onClick={handleNewThread} className='forge-brand-primary w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] font-semibold cursor-pointer'><Plus size={13} /> New conversation</button>
			</div>

			<div className='px-3 pt-3 pb-1 flex items-center justify-between'><span className='text-[9px] uppercase tracking-[0.16em] text-[var(--forge-muted-2)]'>Recent work</span><span className='text-[9px] text-[var(--forge-muted-2)]'>{threads.length}</span></div>
			<div className='flex-1 min-h-0 overflow-hidden'><ThreadList threads={threads} activeThreadId={activeThreadId} onSelectThread={onSelectThread} onNewThread={handleNewThread} onDeleteThread={onDeleteThread} /></div>

			<div className='px-2.5 py-2.5 border-t border-[var(--forge-line)] shrink-0'>
				{quickButtons.length > 0 && <div className='grid grid-cols-5 gap-1 mb-2'>{quickButtons.map(button => <button key={button.id} type='button' onClick={button.action} disabled={!!busyAction} className={`forge-brand-tool h-8 flex flex-col items-center justify-center rounded-lg cursor-pointer disabled:opacity-40 ${button.busy ? 'animate-pulse !text-[var(--forge-cyan)]' : ''}`} title={button.title} aria-label={button.title}>{button.icon}</button>)}</div>}
				<button type='button' onClick={openSettings} className='forge-brand-tool w-full h-8 flex items-center justify-center gap-1.5 rounded-lg text-[10px] cursor-pointer' title='Forge settings'><Settings size={12} /> Preferences</button>
			</div>
		</div>
	);
};

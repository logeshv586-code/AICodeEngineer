/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import { Plus, ChevronDown, Sparkles, Network, ListChecks, Palette, Activity, Settings } from 'lucide-react';
import { INotificationService } from '../../../../../../../platform/notification/common/notification.js';
import { IWorkspaceContextService } from '../../../../../../../platform/workspace/common/workspace.js';
import { IMCPService } from '../../../../../common/mcpService.js';
import { ThreadList, ThreadItem } from './ThreadList';
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
				notification.warn('Forge Super Agent MCP is not ready. Restart Forge after running the bootstrap command.');
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

	const inspectCodeGraph = useCallback(() => {
		if (!slashContext) return;
		const folders = slashContext.accessor.get(IWorkspaceContextService).getWorkspace().folders;
		const workspace = folders[0]?.uri.fsPath;
		void runLocalForgeTool('forge_understand', { action: 'status', ...(workspace ? { workspace } : {}) }, 'Code graph');
	}, [runLocalForgeTool, slashContext]);
	const inspectWorkMode = useCallback(() => { void runLocalForgeTool('forge_workflow', { action: 'list' }, 'Work Mode'); }, [runLocalForgeTool]);
	const inspectDesignRuntime = useCallback(() => { void runLocalForgeTool('forge_sidecar', { action: 'status', name: 'open-design' }, 'Open Design'); }, [runLocalForgeTool]);
	const inspectIntegrations = useCallback(() => { void runLocalForgeTool('forge_integrations', { action: 'doctor' }, 'Integrations'); }, [runLocalForgeTool]);

	if (isCollapsed) {
		return (
			<div className={`w-10 bg-zinc-900/80 border-r border-zinc-800/60 flex flex-col items-center py-2 gap-1 shrink-0 ${className}`}>
				<button type='button' onClick={() => setIsCollapsed(false)} className='w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800/60 border border-zinc-700/40 text-zinc-400 cursor-pointer hover:bg-zinc-700/60 hover:text-zinc-300 transition-colors' title='Forge Assistant'><Sparkles size={14} /></button>
				<button type='button' onClick={handleNewThread} className='w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer' title='New Chat'><Plus size={16} /></button>
				{slashContext && <button type='button' onClick={inspectWorkMode} className='w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer' title='Work Mode'><ListChecks size={14} /></button>}
				<button type='button' onClick={() => setIsCollapsed(false)} className='w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer mt-auto' title='Expand sidebar'><ChevronDown size={14} className='rotate-[-90deg]' /></button>
			</div>
		);
	}

	const quickButtons = slashContext ? [
		{ id: 'understand', title: 'Code graph status', icon: <Network size={12} />, action: inspectCodeGraph, busy: busyAction === 'forge_understand' },
		{ id: 'work', title: 'Work Mode automations', icon: <ListChecks size={12} />, action: inspectWorkMode, busy: busyAction === 'forge_workflow' },
		{ id: 'design', title: 'Open Design runtime', icon: <Palette size={12} />, action: inspectDesignRuntime, busy: busyAction === 'forge_sidecar' },
		{ id: 'health', title: 'Integration health', icon: <Activity size={12} />, action: inspectIntegrations, busy: busyAction === 'forge_integrations' },
	] : [];

	return (
		<div className={`w-56 bg-zinc-900/90 border-r border-zinc-800/60 flex flex-col shrink-0 ${className}`}>
			<div className='px-2.5 py-2 border-b border-zinc-800/60 shrink-0'>
				<div className='flex items-center gap-2 mb-2'>
					<div className='w-7 h-7 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center'><Sparkles size={14} className='text-zinc-400' /></div>
					<div className='flex-1 min-w-0'><div className='text-[11px] font-semibold text-zinc-300'>Forge Assistant</div><div className='text-[9px] text-zinc-600'>Code · Browser · Work · Design</div></div>
				</div>
				<button type='button' onClick={handleNewThread} className='w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 text-[11px] text-zinc-300 font-medium transition-colors cursor-pointer'><Plus size={12} /> New Chat</button>
			</div>

			<div className='flex-1 overflow-hidden'><ThreadList threads={threads} activeThreadId={activeThreadId} onSelectThread={onSelectThread} onNewThread={handleNewThread} onDeleteThread={onDeleteThread} /></div>

			<div className='px-2 py-2 border-t border-zinc-800/60 shrink-0'>
				{quickButtons.length > 0 && <div className='grid grid-cols-4 gap-1 mb-1.5'>{quickButtons.map(button => <button key={button.id} type='button' onClick={button.action} disabled={!!busyAction} className={`h-7 flex items-center justify-center rounded-md border border-zinc-800/60 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/70 transition-colors disabled:opacity-40 ${button.busy ? 'animate-pulse text-emerald-400' : ''}`} title={button.title} aria-label={button.title}>{button.icon}</button>)}</div>}
				<div className='flex items-center justify-between'>
					<button type='button' onClick={openSettings} className='w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer' title='Forge settings' aria-label='Forge settings'><Settings size={13} /></button>
					<button type='button' onClick={() => setIsCollapsed(true)} className='w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer' title='Collapse sidebar'><ChevronDown size={13} className='rotate-90' /></button>
				</div>
			</div>
		</div>
	);
};
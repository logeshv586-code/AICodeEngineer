/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Activity, Globe, ListChecks, Network, Palette, Plus, Settings, Sparkles } from 'lucide-react';
import { useAccessor, useIsDark } from '../util/services.tsx';
import '../styles.css';
import { SidebarChat } from './SidebarChat.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';

const ACTION_TITLES = new Set(['Like', 'Dislike', 'Copy response', 'Fork / Branch thread']);

export const Sidebar = ({ className }: { className: string }) => {
	const isDark = useIsDark();
	const accessor = useAccessor();
	const [busyAction, setBusyAction] = useState<string | null>(null);

	useEffect(() => {
		const workbench = document.querySelector<HTMLElement>('.monaco-workbench');
		if (!workbench) return;
		const tokens: Record<string, string> = {
			'--vscode-editor-background': '#062b5d',
			'--vscode-sideBar-background': '#0e1422',
			'--vscode-activityBar-background': '#062b5d',
			'--vscode-titleBar-activeBackground': '#001d42',
			'--vscode-statusBar-background': '#681878',
			'--vscode-panel-background': '#0e1422',
			'--vscode-foreground': '#edf4ff',
			'--vscode-descriptionForeground': '#9aabc4',
			'--vscode-focusBorder': '#7c83ff',
			'--vscode-button-background': '#7c83ff',
			'--vscode-button-foreground': '#0f172a',
			'--vscode-button-hoverBackground': '#9297ff',
			'--vscode-widget-border': '#29466d',
			'--vscode-input-background': '#111a2b',
			'--vscode-input-foreground': '#edf4ff',
		};
		for (const [name, value] of Object.entries(tokens)) workbench.style.setProperty(name, value);
	}, []);

	const notify = useCallback((kind: 'info' | 'warn' | 'error', message: string) => {
		try {
			const service = accessor.get('INotificationService');
			if (kind === 'error') service.error(message);
			else if (kind === 'warn') service.warn(message);
			else service.info(message);
		} catch {
			console.log(`[Forge] ${message}`);
		}
	}, [accessor]);

	const runForgeTool = useCallback(async (toolName: string, params: Record<string, unknown>, label: string) => {
		setBusyAction(toolName);
		try {
			const mcp = accessor.get('IMCPService');
			const tool = mcp.getMCPTools()?.find(item => item.mcpServerName === 'forge-super-agent' && item.name === toolName);
			if (!tool) {
				notify('warn', 'Forge Super Agent MCP is not ready. Run the bootstrap command and restart Forge.');
				return;
			}
			const { result } = await mcp.callMCPTool({ serverName: 'forge-super-agent', toolName, params });
			const text = mcp.stringifyResult(result).replace(/\s+/g, ' ').trim();
			notify('info', `${label}: ${text.slice(0, 900) || 'OK'}`);
		} catch (error) {
			notify('error', `${label} failed: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			setBusyAction(null);
		}
	}, [accessor, notify]);

	const quickActions = useMemo(() => [
		{
			id: 'new-chat',
			label: 'New',
			title: 'New Forge chat',
			icon: <Plus size={12} />,
			run: () => accessor.get('IChatThreadService').createNewThread(),
		},
		{
			id: 'forge_browser',
			label: 'Browser',
			title: 'Inspect the persistent Forge browser',
			icon: <Globe size={12} />,
			run: () => runForgeTool('forge_browser', { action: 'snapshot' }, 'Browser'),
		},
		{
			id: 'forge_understand',
			label: 'Graph',
			title: 'Inspect code graph status',
			icon: <Network size={12} />,
			run: () => {
				const workspace = accessor.get('IWorkspaceContextService').getWorkspace().folders[0]?.uri.fsPath;
				return runForgeTool('forge_understand', { action: 'status', ...(workspace ? { workspace } : {}) }, 'Code graph');
			},
		},
		{
			id: 'forge_workflow',
			label: 'Work',
			title: 'Inspect Work Mode automations',
			icon: <ListChecks size={12} />,
			run: () => runForgeTool('forge_workflow', { action: 'list' }, 'Work Mode'),
		},
		{
			id: 'forge_sidecar',
			label: 'Design',
			title: 'Inspect Open Design runtime',
			icon: <Palette size={12} />,
			run: () => runForgeTool('forge_sidecar', { action: 'status', name: 'open-design' }, 'Open Design'),
		},
		{
			id: 'forge_integrations',
			label: 'Health',
			title: 'Inspect Forge integration health',
			icon: <Activity size={12} />,
			run: () => runForgeTool('forge_integrations', { action: 'doctor' }, 'Integrations'),
		},
	], [accessor, runForgeTool]);

	const findAssistantText = useCallback((button: HTMLButtonElement): string => {
		let node: HTMLElement | null = button.parentElement;
		for (let depth = 0; node && depth < 6; depth++, node = node.parentElement) {
			const prose = node.querySelector<HTMLElement>('.prose');
			if (prose?.innerText.trim()) return prose.innerText.trim();
		}
		return '';
	}, []);

	const handleResponseActionCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
		const target = event.target as HTMLElement | null;
		const button = target?.closest<HTMLButtonElement>('button[title]');
		if (!button || !ACTION_TITLES.has(button.title)) return;

		event.preventDefault();
		event.stopPropagation();
		const title = button.title;

		if (title === 'Copy response') {
			const text = findAssistantText(button);
			if (!text) return notify('warn', 'Could not locate this response text.');
			void navigator.clipboard.writeText(text)
				.then(() => notify('info', 'Response copied.'))
				.catch(error => notify('error', `Copy failed: ${error instanceof Error ? error.message : String(error)}`));
			return;
		}

		if (title === 'Fork / Branch thread') {
			try {
				const threads = accessor.get('IChatThreadService');
				threads.duplicateThread(threads.state.currentThreadId);
				notify('info', 'Thread duplicated.');
			} catch (error) {
				notify('error', `Could not duplicate thread: ${error instanceof Error ? error.message : String(error)}`);
			}
			return;
		}

		const rating = title === 'Like' ? 'positive' : 'negative';
		try {
			accessor.get('IMetricsService').capture('Forge Assistant Response Feedback', { rating, source: 'compact-sidebar' });
			button.setAttribute('aria-pressed', 'true');
			button.classList.add(rating === 'positive' ? 'text-emerald-400' : 'text-red-400');
			notify('info', rating === 'positive' ? 'Feedback recorded.' : 'Feedback recorded. Forge will use validated outcomes for future improvement.');
		} catch (error) {
			notify('error', `Could not record feedback: ${error instanceof Error ? error.message : String(error)}`);
		}
	}, [accessor, findAssistantText, notify]);

	return <div
		className={`@@void-scope ${isDark ? 'dark' : ''}`}
		style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}
		onClickCapture={handleResponseActionCapture}
	>
		<div className='w-full h-full min-w-0 min-h-0 overflow-hidden bg-void-bg-2 text-void-fg-1 flex flex-col'>
			<div className='shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-zinc-800/60 bg-zinc-950/50'>
				<div className='flex items-center gap-1.5 min-w-0 mr-auto'>
					<Sparkles size={13} className='text-emerald-400 shrink-0' />
					<span className='text-[10px] font-semibold text-zinc-300 truncate'>Forge Super Agent</span>
				</div>
				{quickActions.map(action => (
					<button
						key={action.id}
						type='button'
						onClick={() => { void Promise.resolve(action.run()); }}
						disabled={!!busyAction && action.id !== 'new-chat'}
						className={`h-6 px-1.5 flex items-center gap-1 rounded border border-zinc-800/60 text-[9px] text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/70 transition-colors disabled:opacity-35 ${busyAction === action.id ? 'text-emerald-400 animate-pulse' : ''}`}
						title={action.title}
					>
						{action.icon}<span className='hidden 2xl:inline'>{action.label}</span>
					</button>
				))}
				<button type='button' onClick={() => { void accessor.get('ICommandService').executeCommand('workbench.action.openVoidSettings'); }} className='h-6 w-6 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/70' title='Forge settings' aria-label='Forge settings'><Settings size={12} /></button>
			</div>
			<div className={`w-full flex-1 min-h-0 ${className}`}>
				<ErrorBoundary><SidebarChat /></ErrorBoundary>
			</div>
		</div>
	</div>;
};
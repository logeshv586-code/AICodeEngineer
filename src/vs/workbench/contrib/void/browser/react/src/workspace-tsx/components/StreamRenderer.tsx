/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback, useMemo } from 'react';
import {
	CheckCircle2,
	XCircle,
	Loader2,
	ChevronRight,
	ChevronDown,
	FileText,
	Search,
	Globe,
	Wrench,
	Bot,
	Zap,
	AlertTriangle,
	HardDrive,
	FlaskConical,
	Shield,
	Code2,
	GitBranch,
	Brain,
	ExternalLink,
	Clock,
} from 'lucide-react';
import { StreamEvent, StreamEventKind } from '../utils/streamEvents';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StreamRendererProps {
	events: StreamEvent[];
	className?: string;
}

// ─── Icons by event kind ─────────────────────────────────────────────────────

const kindIcon: Record<StreamEventKind, React.ReactNode> = {
	thinking: <Brain size={12} className='text-zinc-500' />,
	plan_started: <Zap size={12} className='text-amber-400' />,
	plan_step_update: <ChevronRight size={12} className='text-amber-400' />,
	plan_completed: <CheckCircle2 size={12} className='text-emerald-400' />,
	execution_started: <GitBranch size={12} className='text-blue-400' />,
	execution_completed: <CheckCircle2 size={12} className='text-emerald-400' />,
	execution_failed: <XCircle size={12} className='text-red-400' />,
	agent_started: <Bot size={12} className='text-violet-400' />,
	agent_finished: <CheckCircle2 size={12} className='text-emerald-400' />,
	agent_failed: <XCircle size={12} className='text-red-400' />,
	tool_started: <Wrench size={12} className='text-zinc-400' />,
	tool_finished: <CheckCircle2 size={12} className='text-emerald-400' />,
	tool_failed: <XCircle size={12} className='text-red-400' />,
	search_started: <Search size={12} className='text-cyan-400' />,
	search_result: <Search size={12} className='text-cyan-400' />,
	search_completed: <CheckCircle2 size={12} className='text-cyan-400' />,
	workspace_scan_started: <HardDrive size={12} className='text-zinc-400' />,
	workspace_scan_completed: <CheckCircle2 size={12} className='text-zinc-400' />,
	file_read: <FileText size={12} className='text-zinc-400' />,
	file_written: <FileText size={12} className='text-emerald-400' />,
	file_edited: <FileText size={12} className='text-amber-400' />,
	browser_opened: <Globe size={12} className='text-blue-400' />,
	browser_navigated: <ExternalLink size={12} className='text-blue-400' />,
	browser_result: <Globe size={12} className='text-blue-400' />,
	browser_closed: <XCircle size={12} className='text-zinc-500' />,
	memory_used: <Brain size={12} className='text-purple-400' />,
	patch_created: <Code2 size={12} className='text-amber-400' />,
	patch_accepted: <CheckCircle2 size={12} className='text-emerald-400' />,
	patch_rejected: <XCircle size={12} className='text-red-400' />,
	run_completed: <CheckCircle2 size={12} className='text-emerald-400' />,
	run_failed: <XCircle size={12} className='text-red-400' />,
	status: <Clock size={12} className='text-zinc-500' />,
};

// ─── Event row ───────────────────────────────────────────────────────────────

interface EventRowProps {
	event: StreamEvent;
	isExpanded: boolean;
	onToggle: () => void;
	isLast: boolean;
}

const EventRow: React.FC<EventRowProps> = ({ event, isExpanded, onToggle, isLast }) => {
	const isExpandable = !!event.detail || !!event.meta;
	const icon = kindIcon[event.kind];
	const time = new Date(event.timestamp).toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});

	const statusColor = event.status === 'active'
		? 'text-zinc-300'
		: event.status === 'done'
			? 'text-zinc-500'
			: 'text-red-400';

	const detailBg = event.status === 'failed'
		? 'bg-red-500/5 border-red-500/20'
		: 'bg-zinc-900/40 border-zinc-800/60';

	return (
		<div className={`group ${isLast ? '' : 'mb-0.5'}`}>
			<button
				type='button'
				onClick={onToggle}
				className={`
					w-full flex items-center gap-1.5 px-2 py-1 rounded
					text-left cursor-pointer transition-colors
					hover:bg-zinc-800/20
					${isExpanded ? 'bg-zinc-800/15' : ''}
				`}
			>
				{/* Expand toggle */}
				{isExpandable ? (
					<span className='text-zinc-700 shrink-0'>
						{isExpanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
					</span>
				) : (
					<span className='w-2 shrink-0' />
				)}

				{/* Icon */}
				<span className='shrink-0'>{icon}</span>

				{/* Label */}
				<span className={`text-[11px] truncate ${statusColor}`}>
					{event.label}
				</span>

				{/* Spinner for active */}
				{event.status === 'active' && (
					<Loader2 size={9} className='text-blue-400 animate-spin shrink-0' />
				)}
			</button>

			{/* Expanded detail */}
			{isExpanded && (event.detail || event.meta) && (
				<div className={`ml-5 mt-0.5 mb-1 rounded border ${detailBg} overflow-hidden`}>
					{event.detail && (
						<div className='px-2 py-1.5 text-[10px] text-zinc-400 font-mono break-all whitespace-pre-wrap'>
							{event.detail}
						</div>
					)}
					{event.meta && event.kind === 'agent_started' && (
						<div className='px-2 py-1 text-[10px] text-zinc-500'>
							Task: {event.meta.taskId}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

// ─── Stream Renderer ─────────────────────────────────────────────────────────

export const StreamRenderer: React.FC<StreamRendererProps> = ({
	events,
	className = '',
}) => {
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
	const [isCollapsed, setIsCollapsed] = useState(false);

	const toggleExpanded = useCallback((id: string) => {
		setExpandedIds(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	if (events.length === 0) return null;

	const isRunning = events.some(e => e.status === 'active');
	const hasFailures = events.some(e => e.status === 'failed');
	const completedCount = events.filter(e => e.status === 'done').length;
	const totalCount = events.length;

	// Group: plan steps first, then everything else in order
	const planEvents = events.filter(e => e.kind.startsWith('plan_'));
	const otherEvents = events.filter(e => !e.kind.startsWith('plan_'));
	const displayEvents = [...planEvents, ...otherEvents];

	return (
		<div className={`rounded-lg border border-zinc-800/60 bg-zinc-900/30 overflow-hidden ${className}`}>
			{/* Header — subtle, minimal */}
			<button
				type='button'
				onClick={() => setIsCollapsed(v => !v)}
				className='
					w-full flex items-center gap-1.5 px-2 py-1
					text-left cursor-pointer transition-colors
					hover:bg-zinc-800/20
				'
			>
				<span className='text-zinc-700 shrink-0'>
					{isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
				</span>

				{isRunning ? (
					<Loader2 size={10} className='text-blue-400 animate-spin shrink-0' />
				) : hasFailures ? (
					<AlertTriangle size={10} className='text-amber-400 shrink-0' />
				) : (
					<CheckCircle2 size={10} className='text-emerald-400 shrink-0' />
				)}

				<span className='text-[10px] text-zinc-500'>
					{isRunning ? 'Working...' : hasFailures ? 'Completed with issues' : completedCount + ' steps'}
				</span>
			</button>

			{/* Events list */}
			{!isCollapsed && (
				<div className='px-1 py-0.5 max-h-[200px] overflow-y-auto'>
					{displayEvents.map((event, i) => (
						<EventRow
							key={event.id}
							event={event}
							isExpanded={expandedIds.has(event.id)}
							onToggle={() => toggleExpanded(event.id)}
							isLast={i === displayEvents.length - 1}
						/>
					))}
				</div>
			)}
		</div>
	);
};

// ─── Compact Streaming Status ────────────────────────────────────────────────

export const StreamStatus: React.FC<{
	events: StreamEvent[];
	className?: string;
}> = ({ events, className = '' }) => {
	if (events.length === 0) return null;

	const active = events.filter(e => e.status === 'active');
	const completed = events.filter(e => e.status === 'done').length;
	const failed = events.filter(e => e.status === 'failed').length;
	const running = active.length;

	if (running === 0 && events.length <= 2) return null;

	return (
		<div className={`flex items-center gap-1.5 ${className}`}>
			{running > 0 && (
				<span className='flex items-center gap-1 text-[10px] text-blue-400'>
					<Loader2 size={8} className='animate-spin' />
					{running} running
				</span>
			)}
			{failed > 0 && (
				<span className='text-[10px] text-red-400'>
					{failed} failed
				</span>
			)}
			{completed > 0 && (
				<span className='text-[10px] text-zinc-600'>
					{completed} done
				</span>
			)}
		</div>
	);
};

// ─── Agent Chips from Stream ─────────────────────────────────────────────────

export function extractAgentChips(events: StreamEvent[]): { id: string; name: string; role: string; status: string }[] {
	const agents = new Map<string, { name: string; role: string; status: string }>();

	for (const event of events) {
		if (event.kind === 'agent_started' || event.kind === 'agent_finished' || event.kind === 'agent_failed') {
			const role = event.meta?.agentRole || event.label;
			const existing = agents.get(role);
			if (!existing) {
				agents.set(role, {
					name: role,
					role,
					status: event.status === 'active' ? 'running' : event.status === 'done' ? 'completed' : 'failed',
				});
			} else if (event.status === 'active') {
				existing.status = 'running';
			}
		}
	}

	return Array.from(agents.entries()).map(([id, data]) => ({ id, ...data }));
}

// ─── Plan Steps from Stream ──────────────────────────────────────────────────

export function extractPlanSteps(events: StreamEvent[]): { id: string; title: string; status: string; stage: string }[] {
	const planEvent = [...events].reverse().find(e => e.kind === 'plan_started');
	return planEvent?.meta?.steps ?? [];
}

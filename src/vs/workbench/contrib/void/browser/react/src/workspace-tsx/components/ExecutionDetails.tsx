/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import {
	ChevronDown,
	ChevronRight,
	CheckCircle2,
	XCircle,
	Loader2,
	Clock,
	AlertTriangle,
	FileText,
	Code2,
	Terminal,
	MessageSquare,
	Search,
	Wrench,
	Zap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExecutionDetail {
	readonly id: string;
	readonly agent: string;
	readonly role: string;
	readonly task: string;
	readonly status: 'running' | 'completed' | 'failed' | 'pending';
	readonly startedAt?: number;
	readonly completedAt?: number;
	readonly duration?: number;
	readonly input?: string;
	readonly output?: string;
	readonly error?: string;
	readonly filesTouched?: string[];
	readonly commands?: string[];
	readonly steps?: ExecutionStep[];
}

export interface ExecutionStep {
	readonly id: string;
	readonly name: string;
	readonly status: 'running' | 'completed' | 'failed' | 'pending';
	readonly duration?: number;
	readonly output?: string;
}

export interface ExecutionDetailsProps {
	executions: ExecutionDetail[];
	className?: string;
	expandedIds?: Set<string>;
	onToggleExpand?: (id: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const iconMap: Record<string, React.ReactNode> = {
	read: <FileText size={10} />,
	write: <Code2 size={10} />,
	edit: <Wrench size={10} />,
	search: <Search size={10} />,
	terminal: <Terminal size={10} />,
	message: <MessageSquare size={10} />,
};

function formatTime(ms: number | undefined): string {
	if (!ms) return '--';
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatDuration(start?: number, end?: number): string {
	if (!start) return '--';
	const endTime = end ?? Date.now();
	return formatTime(endTime - start);
}

function truncate(str: string | undefined, max: number = 120): string {
	if (!str) return '';
	return str.length > max ? str.slice(0, max) + '...' : str;
}

// ─── Execution Item ───────────────────────────────────────────────────────────

const ExecutionItem: React.FC<{
	detail: ExecutionDetail;
	isExpanded: boolean;
	onToggle: () => void;
}> = ({ detail, isExpanded, onToggle }) => {
	const statusColor = detail.status === 'running'
		? 'border-blue-500/30 bg-blue-500/5'
		: detail.status === 'completed'
			? 'border-emerald-500/20 bg-emerald-500/[0.02]'
			: detail.status === 'failed'
				? 'border-red-500/30 bg-red-500/5'
				: 'border-zinc-800/60 bg-zinc-900/30';

	const statusIndicator = detail.status === 'running'
		? <Loader2 size={10} className='text-blue-400 animate-spin' />
		: detail.status === 'completed'
			? <CheckCircle2 size={10} className='text-emerald-400' />
			: detail.status === 'failed'
				? <XCircle size={10} className='text-red-400' />
				: <Clock size={10} className='text-zinc-600' />;

	return (
		<div className={`rounded-md border ${statusColor}`}>
			{/* Header row */}
			<button
				type='button'
				onClick={onToggle}
				className='
					w-full flex items-center gap-2 px-2 py-1.5
					text-left cursor-pointer transition-colors
					hover:bg-zinc-800/20
				'
			>
				{/* Expand toggle */}
				<span className='text-zinc-600 shrink-0'>
					{isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
				</span>

				{/* Status indicator */}
				<span className='shrink-0'>{statusIndicator}</span>

				{/* Agent info */}
				<span className='text-[11px] font-medium text-zinc-300 truncate'>
					{detail.agent}
				</span>

				<span className='text-[9px] text-zinc-600 bg-zinc-800/60 px-1 py-0.5 rounded capitalize'>
					{detail.role}
				</span>

				{/* Task */}
				<span className='text-[10px] text-zinc-500 truncate flex-1'>
					{truncate(detail.task, 50)}
				</span>

				{/* Duration */}
				<span className='text-[9px] text-zinc-600 shrink-0'>
					{formatDuration(detail.startedAt, detail.completedAt)}
				</span>
			</button>

			{/* Expanded details */}
			{isExpanded && (
				<div className='px-2 pb-2 pt-0.5 border-t border-zinc-800/30'>
					{/* Input */}
					{detail.input && (
						<div className='mt-1.5'>
							<div className='text-[9px] text-zinc-600 uppercase tracking-wider mb-0.5'>Input</div>
							<pre className='text-[10px] text-zinc-400 bg-zinc-900/60 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-all font-mono'>
								{truncate(detail.input, 300)}
							</pre>
						</div>
					)}

					{/* Output */}
					{detail.output && (
						<div className='mt-1.5'>
							<div className='text-[9px] text-zinc-600 uppercase tracking-wider mb-0.5'>Output</div>
							<pre className='text-[10px] text-zinc-400 bg-zinc-900/60 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-all font-mono'>
								{truncate(detail.output, 300)}
							</pre>
						</div>
					)}

					{/* Error */}
					{detail.error && (
						<div className='mt-1.5'>
							<div className='text-[9px] text-red-400 uppercase tracking-wider mb-0.5 flex items-center gap-1'>
								<AlertTriangle size={8} />
								Error
							</div>
							<pre className='text-[10px] text-red-300 bg-red-500/5 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-all font-mono'>
								{truncate(detail.error, 300)}
							</pre>
						</div>
					)}

					{/* Files touched */}
					{detail.filesTouched && detail.filesTouched.length > 0 && (
						<div className='mt-1.5'>
							<div className='text-[9px] text-zinc-600 uppercase tracking-wider mb-0.5'>Files</div>
							<div className='flex flex-wrap gap-1'>
								{detail.filesTouched.map(f => (
									<span key={f} className='text-[9px] text-zinc-400 bg-zinc-800/60 px-1 py-0.5 rounded font-mono'>
										{f}
									</span>
								))}
							</div>
						</div>
					)}

					{/* Commands */}
					{detail.commands && detail.commands.length > 0 && (
						<div className='mt-1.5'>
							<div className='text-[9px] text-zinc-600 uppercase tracking-wider mb-0.5'>Commands</div>
							<div className='space-y-0.5'>
								{detail.commands.map((cmd, i) => (
									<pre key={i} className='text-[10px] text-amber-300/80 bg-zinc-900/60 rounded p-1 overflow-x-auto font-mono'>
										$ {cmd}
									</pre>
								))}
							</div>
						</div>
					)}

					{/* Nested steps */}
					{detail.steps && detail.steps.length > 0 && (
						<div className='mt-1.5 space-y-0.5'>
							{detail.steps.map(step => (
								<div key={step.id} className='flex items-center gap-1.5 py-0.5'>
									{step.status === 'running'
										? <Loader2 size={8} className='text-blue-400 animate-spin' />
										: step.status === 'completed'
											? <CheckCircle2 size={8} className='text-emerald-400' />
											: step.status === 'failed'
												? <XCircle size={8} className='text-red-400' />
												: <Clock size={8} className='text-zinc-600' />
									}
									<span className='text-[10px] text-zinc-400'>{step.name}</span>
									{step.duration && (
										<span className='text-[9px] text-zinc-600'>
											{formatTime(step.duration)}
										</span>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const ExecutionDetails: React.FC<ExecutionDetailsProps> = ({
	executions,
	className = '',
	expandedIds: controlledExpanded,
	onToggleExpand: controlledToggle,
}) => {
	const [internalExpanded, setInternalExpanded] = useState<Set<string>>(new Set());

	const isControlled = controlledExpanded !== undefined && controlledToggle !== undefined;
	const expandedSet = isControlled ? controlledExpanded : internalExpanded;

	const handleToggle = useCallback((id: string) => {
		if (isControlled && controlledToggle) {
			controlledToggle(id);
		} else {
			setInternalExpanded(prev => {
				const next = new Set(prev);
				if (next.has(id)) next.delete(id);
				else next.add(id);
				return next;
			});
		}
	}, [isControlled, controlledToggle]);

	if (executions.length === 0) {
		return (
			<div className={`flex flex-col items-center justify-center py-4 text-zinc-600 ${className}`}>
				<Zap size={16} className='mb-1 opacity-40' />
				<span className='text-[10px]'>No executions yet</span>
			</div>
		);
	}

	return (
		<div className={`flex flex-col gap-1 ${className}`}>
			{executions.map(detail => (
				<ExecutionItem
					key={detail.id}
					detail={detail}
					isExpanded={expandedSet.has(detail.id)}
					onToggle={() => handleToggle(detail.id)}
				/>
			))}
		</div>
	);
};

// ─── Compact Execution Summary ────────────────────────────────────────────────

export const ExecutionSummary: React.FC<{
	executions: ExecutionDetail[];
	className?: string;
	onExpand: () => void;
}> = ({ executions, className = '', onExpand }) => {
	if (executions.length === 0) return null;

	const running = executions.filter(e => e.status === 'running').length;
	const completed = executions.filter(e => e.status === 'completed').length;
	const failed = executions.filter(e => e.status === 'failed').length;

	return (
		<button
			type='button'
			onClick={onExpand}
			className={`
				w-full flex items-center gap-2 px-2 py-1.5
				rounded-md border border-zinc-800/60 bg-zinc-900/40
				text-left cursor-pointer transition-colors
				hover:bg-zinc-800/40
				${className}
			`}
		>
			{/* Animated pulse for running */}
			{running > 0 ? (
				<span className='relative flex h-2 w-2'>
					<span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75' />
					<span className='relative inline-flex rounded-full h-2 w-2 bg-blue-500' />
				</span>
			) : failed > 0 ? (
				<XCircle size={12} className='text-red-400' />
			) : (
				<CheckCircle2 size={12} className='text-emerald-400' />
			)}

			<span className='text-[11px] text-zinc-300 flex-1'>
				{executions.length} execution{executions.length !== 1 ? 's' : ''}
			</span>

			<div className='flex items-center gap-1.5'>
				{running > 0 && (
					<span className='text-[9px] text-blue-400'>{running} running</span>
				)}
				{completed > 0 && (
					<span className='text-[9px] text-emerald-400'>{completed} done</span>
				)}
				{failed > 0 && (
					<span className='text-[9px] text-red-400'>{failed} failed</span>
				)}
			</div>

			<ChevronRight size={10} className='text-zinc-600' />
		</button>
	);
};

/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2, XCircle, SkipForward, ChevronDown, ChevronRight, Zap, Clock } from 'lucide-react';
import { AgentPlanItem, AgentPlanItemStatus } from '../../../../common/chatThreadServiceTypes.js';
import { IsRunningType } from '../../../chatThreadService.js';
import { ToolName } from '../../../../common/toolsServiceTypes.js';

// ---------- Run State Bar ----------

type RunStateBarProps = {
	isRunning: IsRunningType;
	toolName?: ToolName;
	agentRunStartedAt?: number;
	onAbort: () => void;
};

const stateLabel: Record<NonNullable<IsRunningType>, string> = {
	LLM: 'Thinking',
	tool: 'Running',
	awaiting_user: 'Needs approval',
	idle: 'Working',
};

const stateDotColor: Record<NonNullable<IsRunningType>, string> = {
	LLM: 'bg-blue-400',
	tool: 'bg-amber-400',
	awaiting_user: 'bg-yellow-400',
	idle: 'bg-zinc-400',
};

function useElapsedTime(startedAt: number | undefined): string {
	const [elapsed, setElapsed] = useState<string>('');

	useEffect(() => {
		if (!startedAt) {
			setElapsed('');
			return;
		}
		const update = () => {
			const secs = Math.floor((Date.now() - startedAt) / 1000);
			if (secs < 60) setElapsed(`${secs}s`);
			else setElapsed(`${Math.floor(secs / 60)}m ${secs % 60}s`);
		};
		update();
		const id = setInterval(update, 1000);
		return () => clearInterval(id);
	}, [startedAt]);

	return elapsed;
}

export const RunStateBar = ({ isRunning, toolName, agentRunStartedAt, onAbort }: RunStateBarProps) => {
	const elapsed = useElapsedTime(agentRunStartedAt);

	if (!isRunning) return null;

	const label = isRunning ? stateLabel[isRunning] : '';
	const dotColor = isRunning ? stateDotColor[isRunning] : '';

	// Show tool name when running a tool
	const detail = (isRunning === 'tool' && toolName)
		? toolName.replace(/_/g, ' ')
		: '';

	return (
		<div className={`
			flex items-center gap-2 px-3 py-1.5
			text-xs text-zinc-300
			bg-zinc-900/80 border border-zinc-700/60 rounded-lg
			select-none
		`}>
			{/* Animated pulse dot */}
			<span className={`relative flex h-2 w-2 flex-shrink-0`}>
				<span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`} />
				<span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
			</span>

			{/* Label */}
			<span className='font-medium text-zinc-200'>{label}</span>

			{/* Detail (tool name) */}
			{detail && (
				<span className='text-zinc-400 truncate max-w-[120px]'>{detail}</span>
			)}

			{/* Spacer */}
			<div className='flex-1' />

			{/* Elapsed time */}
			{elapsed && (
				<span className='flex items-center gap-0.5 text-zinc-500'>
					<Clock size={10} />
					{elapsed}
				</span>
			)}

			{/* Stop button */}
			<button
				type='button'
				onClick={onAbort}
				className='ml-1 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors'
				title='Stop agent'
			>
				Stop
			</button>
		</div>
	);
};


// ---------- Agent Plan Panel ----------

const statusIcon: Record<AgentPlanItemStatus, React.ReactNode> = {
	pending: <Circle size={13} className='text-zinc-500 flex-shrink-0' />,
	active: <Loader2 size={13} className='text-blue-400 flex-shrink-0 animate-spin' />,
	done: <CheckCircle2 size={13} className='text-emerald-400 flex-shrink-0' />,
	failed: <XCircle size={13} className='text-red-400 flex-shrink-0' />,
	skipped: <SkipForward size={13} className='text-zinc-500 flex-shrink-0' />,
};

const statusTextColor: Record<AgentPlanItemStatus, string> = {
	pending: 'text-zinc-500',
	active: 'text-zinc-200 font-medium',
	done: 'text-zinc-400 line-through opacity-70',
	failed: 'text-red-400',
	skipped: 'text-zinc-600 line-through',
};

type AgentPlanPanelProps = {
	plan: AgentPlanItem[];
};

export const AgentPlanPanel = ({ plan }: AgentPlanPanelProps) => {
	const [isOpen, setIsOpen] = useState(true);

	if (!plan || plan.length === 0) return null;

	const done = plan.filter(p => p.status === 'done').length;
	const total = plan.length;
	const progress = total > 0 ? Math.round((done / total) * 100) : 0;

	return (
		<div className={`
			mx-1 mb-2 rounded-lg border border-zinc-700/60
			bg-zinc-900/60 text-xs overflow-hidden
		`}>
			{/* Header */}
			<button
				type='button'
				className='w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/50 transition-colors select-none'
				onClick={() => setIsOpen(v => !v)}
			>
				<Zap size={12} className='text-emerald-400 flex-shrink-0' />
				<span className='text-zinc-300 font-medium'>Plan</span>
				<span className='text-zinc-500'>{done}/{total}</span>

				{/* Progress bar */}
				<div className='flex-1 h-1 bg-zinc-700/60 rounded-full overflow-hidden mx-1'>
					<div
						className='h-full bg-emerald-500/70 rounded-full transition-all duration-500'
						style={{ width: `${progress}%` }}
					/>
				</div>

				{isOpen
					? <ChevronDown size={12} className='text-zinc-500 flex-shrink-0' />
					: <ChevronRight size={12} className='text-zinc-500 flex-shrink-0' />
				}
			</button>

			{/* Steps */}
			{isOpen && (
				<div className='px-3 pb-2 flex flex-col gap-1'>
					{plan.map((item, i) => (
						<div key={item.id} className='flex items-start gap-2 py-0.5'>
							{/* Status icon */}
							<div className='mt-0.5'>
								{statusIcon[item.status]}
							</div>

							{/* Content */}
							<div className='flex flex-col min-w-0'>
								<span className={`leading-tight ${statusTextColor[item.status]}`}>
									{item.title}
								</span>
								{item.description && item.status === 'active' && (
									<span className='text-zinc-500 text-[10px] leading-tight mt-0.5 truncate'>
										{item.description}
									</span>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
};

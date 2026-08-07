/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useMemo } from 'react';
import {
	ChevronDown,
	ChevronRight,
	Loader2,
	CheckCircle2,
	XCircle,
	Circle,
	SkipForward,
	AlertTriangle,
	Zap,
	Target,
	GitBranch,
	Play,
	RefreshCw,
} from 'lucide-react';
import { PlannerOutput, PlanStep } from '../../../common/forge/planner/planSchema';

// ─── Stage color mapping ──────────────────────────────────────────────────────

const stageColors: Record<string, { bg: string; text: string; border: string }> = {
	Discovery: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
	Design: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
	Build: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
	Test: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
	Review: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
};

const riskConfig = {
	low: { label: 'Low Risk', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
	medium: { label: 'Medium Risk', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
	high: { label: 'High Risk', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

// ─── Step row component ───────────────────────────────────────────────────────

interface PlanStepRowProps {
	step: PlanStep;
	index: number;
	dependsOn?: number[];
}

const PlanStepRow: React.FC<PlanStepRowProps> = ({ step, index, dependsOn }) => {
	const [isExpanded, setIsExpanded] = useState(step.status === 'in_progress' || step.status === 'failed');
	const stageStyle = stageColors[step.stage] || stageColors.Build;
	const isDone = step.status === 'completed';
	const isFailed = step.status === 'failed';
	const isRunning = step.status === 'in_progress';

	return (
		<div className={`
			rounded-lg border transition-all duration-200
			${isRunning ? 'border-blue-500/30 bg-blue-500/5' :
				isFailed ? 'border-red-500/30 bg-red-500/5' :
					isDone ? 'border-emerald-500/15 bg-emerald-500/[0.02]' :
						'border-zinc-700/30 bg-zinc-900/30'}
		`}>
			{/* Main row */}
			<div
				className='flex items-center gap-2 px-2.5 py-2 cursor-pointer select-none'
				onClick={() => setIsExpanded(v => !v)}
			>
				{/* Chevron */}
				<ChevronRight
					size={12}
					className={`text-zinc-500 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
				/>

				{/* Status icon */}
				<div className='flex-shrink-0'>
					{isRunning && <Loader2 size={13} className='text-blue-400 animate-spin' />}
					{isDone && <CheckCircle2 size={13} className='text-emerald-400' />}
					{isFailed && <XCircle size={13} className='text-red-400' />}
					{step.status === 'pending' && <Circle size={13} className='text-zinc-600' />}
					{step.status === 'skipped' && <SkipForward size={13} className='text-zinc-600' />}
				</div>

				{/* Step number */}
				<span className='text-[10px] font-mono text-zinc-600 flex-shrink-0'>#{index + 1}</span>

				{/* Stage badge */}
				<span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider flex-shrink-0 ${stageStyle.bg} ${stageStyle.text} ${stageStyle.border} border`}>
					{step.stage}
				</span>

				{/* Title */}
				<span className={`text-xs truncate flex-1 min-w-0 ${isDone ? 'text-zinc-500 line-through opacity-60' :
						isRunning ? 'text-zinc-200 font-medium' :
							isFailed ? 'text-red-400' :
								'text-zinc-400'}`}>
					{step.title}
				</span>

				{/* Dependency indicator */}
				{dependsOn && dependsOn.length > 0 && (
					<span className='text-[9px] text-zinc-600 flex-shrink-0 hidden sm:inline'>
						depends on #{dependsOn.join(', #')}
					</span>
				)}
			</div>

			{/* Expanded details */}
			{isExpanded && (
				<div className='px-2.5 pb-2.5 ml-6 space-y-1.5'>
					{step.description && (
						<p className='text-[11px] text-zinc-500 leading-relaxed'>{step.description}</p>
					)}

					{/* Tool calls */}
					{step.toolCalls && step.toolCalls.length > 0 && (
						<div className='flex flex-wrap gap-1 mt-1'>
							{step.toolCalls.map((toolCall, i) => (
								<span
									key={i}
									className='text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono border border-zinc-700/50'
								>
									{toolCall.toolName}
								</span>
							))}
						</div>
					)}

					{/* Error */}
					{step.error && (
						<div className='mt-1.5 px-2 py-1.5 rounded bg-red-500/10 border border-red-500/20 flex items-start gap-1.5'>
							<AlertTriangle size={12} className='text-red-400 flex-shrink-0 mt-0.5' />
							<span className='text-[10px] text-red-400 leading-relaxed'>{step.error}</span>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

// ─── PlanViewInWorkspace ─────────────────────────────────────────────────────

interface PlanViewInWorkspaceProps {
	plan: PlannerOutput | null;
	onRerun?: () => void;
	className?: string;
}

export const PlanViewInWorkspace: React.FC<PlanViewInWorkspaceProps> = ({ plan, onRerun, className = '' }) => {
	const [isExpanded, setIsExpanded] = useState(true);

	const stats = useMemo(() => {
		if (!plan) return null;
		const total = plan.steps.length;
		const completed = plan.steps.filter(s => s.status === 'completed').length;
		const failed = plan.steps.filter(s => s.status === 'failed').length;
		const inProgress = plan.steps.filter(s => s.status === 'in_progress').length;
		const pending = plan.steps.filter(s => s.status === 'pending').length;
		const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
		return { total, completed, failed, inProgress, pending, progress };
	}, [plan]);

	if (!plan) {
		return (
			<div className={`flex flex-col items-center justify-center h-full text-zinc-600 ${className}`}>
				<Target size={32} className='mb-2 opacity-30' />
				<span className='text-xs'>No active plan</span>
				<span className='text-[10px] mt-0.5 text-zinc-700'>Start a workflow to generate a plan</span>
			</div>
		);
	}

	const riskInfo = riskConfig[plan.estimatedRisk] || riskConfig.low;

	return (
		<div className={`flex flex-col h-full overflow-hidden ${className}`}>
			{/* Plan header */}
			<div className='px-3 py-2 border-b border-zinc-700/60 shrink-0'>
				<div className='flex items-center justify-between'>
					<div className='flex items-center gap-1.5'>
						<Zap size={13} className='text-emerald-400' />
						<span className='text-xs font-medium text-zinc-300'>Plan</span>
						{stats && (
							<span className='text-[10px] text-zinc-500 font-mono'>
								{stats.completed}/{stats.total}
							</span>
						)}
					</div>
					<div className='flex items-center gap-1'>
						<span className={`text-[10px] px-1.5 py-0.5 rounded border ${riskInfo.bg} ${riskInfo.color} ${riskInfo.border}`}>
							{riskInfo.label}
						</span>
						{onRerun && (
							<button
								type='button'
								onClick={onRerun}
								className='p-1 hover:text-emerald-400 text-zinc-500 transition-colors cursor-pointer'
								title='Rerun plan'
							>
								<RefreshCw size={12} />
							</button>
						)}
					</div>
				</div>

				{/* Goal */}
				<div className='mt-1.5 text-xs text-zinc-300 font-medium truncate'>{plan.goal}</div>

				{/* Summary */}
				{plan.summary && (
					<p className='text-[10px] text-zinc-500 mt-0.5 leading-relaxed line-clamp-2'>{plan.summary}</p>
				)}

				{/* Progress bar */}
				{stats && (
					<div className='mt-2'>
						<div className='flex items-center justify-between text-[10px] text-zinc-500 mb-1'>
							<span>
								{stats.completed} done · {stats.inProgress} running · {stats.failed} failed · {stats.pending} pending
							</span>
							<span>{stats.progress}%</span>
						</div>
						<div className='h-1.5 bg-zinc-700/60 rounded-full overflow-hidden'>
							<div
								className='h-full bg-emerald-500/70 rounded-full transition-all duration-500'
								style={{ width: `${stats.progress}%` }}
							/>
						</div>
					</div>
				)}
			</div>

			{/* Steps */}
			<div className='flex-1 overflow-y-auto p-2 space-y-1.5'>
				{plan.steps.map((step, i) => (
					<PlanStepRow
						key={step.id}
						step={step}
						index={i}
						dependsOn={step.dependsOnStepIds}
					/>
				))}
			</div>

			{/* Dependency graph indicator */}
			{plan.dependencyGraph && plan.dependencyGraph.nodes.length > 0 && (
				<div className='px-3 py-2 border-t border-zinc-700/40 shrink-0'>
					<div className='flex items-center gap-1.5 text-[10px] text-zinc-500'>
						<GitBranch size={10} />
						<span>Dependency graph: {plan.dependencyGraph.nodes.length} nodes</span>
						<span className='text-zinc-600'>
							({plan.dependencyGraph.nodes.filter(n => n.canRunInParallel).length} parallelizable)
						</span>
					</div>
				</div>
			)}
		</div>
	);
};

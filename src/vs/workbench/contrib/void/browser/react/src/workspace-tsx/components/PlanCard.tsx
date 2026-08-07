/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import {
	ChevronRight,
	ChevronDown,
	CheckCircle2,
	Circle,
	Loader2,
	XCircle,
	Clock,
	AlertTriangle,
	ArrowRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanStep {
	readonly id: string;
	readonly title: string;
	readonly description?: string;
	readonly status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
	readonly stage: string;
	readonly risk?: 'low' | 'medium' | 'high';
	readonly dependencies?: string[];
	readonly duration?: number;
}

export interface PlanCardProps {
	steps: PlanStep[];
	className?: string;
	onStepClick?: (step: PlanStep) => void;
	onRerun?: () => void;
	overallStatus?: 'planning' | 'running' | 'completed' | 'failed';
	overallProgress?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const stageColors: Record<string, { bg: string; text: string; border: string }> = {
	Discovery: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
	Design: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
	Build: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
	Test: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
	Review: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
	Deploy: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
	RAG: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
};

const riskColors: Record<string, string> = {
	low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
	medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
	high: 'text-red-400 bg-red-500/10 border-red-500/20',
};

function StatusIcon({ status }: { status: string }) {
	switch (status) {
		case 'completed':
			return <CheckCircle2 size={12} className='text-emerald-400 shrink-0' />;
		case 'running':
			return <Loader2 size={12} className='text-blue-400 animate-spin shrink-0' />;
		case 'failed':
			return <XCircle size={12} className='text-red-400 shrink-0' />;
		case 'skipped':
			return <XCircle size={12} className='text-zinc-600 shrink-0' />;
		default:
			return <Circle size={12} className='text-zinc-600 shrink-0' />;
	}
}

function formatDuration(ms: number | undefined): string {
	if (!ms) return '';
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

// ─── Plan Row ─────────────────────────────────────────────────────────────────

const PlanRow: React.FC<{
	step: PlanStep;
	isLast: boolean;
	isExpanded: boolean;
	onToggle: () => void;
	onClick?: (step: PlanStep) => void;
}> = ({ step, isLast, isExpanded, onToggle, onClick }) => {
	const stageColor = stageColors[step.stage] || stageColors.Build;

	return (
		<div className='relative'>
			{/* Connector line */}
			{!isLast && (
				<div className='absolute left-[7px] top-[20px] w-px h-[calc(100%+4px)] bg-zinc-800/60' />
			)}

			{/* Row */}
			<button
				type='button'
				onClick={() => onClick?.(step)}
				className='
					w-full flex items-start gap-2 py-1.5 px-1.5
					rounded-md transition-colors cursor-pointer text-left
					hover:bg-zinc-800/40
				'
			>
				{/* Status / expand toggle */}
				<button
					type='button'
					onClick={(e) => { e.stopPropagation(); onToggle(); }}
					className='
						w-3.5 h-3.5 flex items-center justify-center rounded-full
						border border-zinc-700/60 bg-zinc-900
						text-zinc-600 hover:text-zinc-400 hover:border-zinc-600
						transition-colors cursor-pointer shrink-0 mt-0.5
					'
				>
					{isExpanded ? <ChevronDown size={8} /> : <ChevronRight size={8} />}
				</button>

				{/* Content */}
				<div className='flex-1 min-w-0'>
					<div className='flex items-center gap-1.5'>
						<StatusIcon status={step.status} />
						<span className={`
							text-[11px] font-medium truncate
							${step.status === 'completed' ? 'text-zinc-400 line-through' :
							  step.status === 'running' ? 'text-zinc-200' :
							  step.status === 'failed' ? 'text-red-400' :
							  'text-zinc-500'}
						`}>
							{step.title}
						</span>
					</div>

					{/* Stage badge + risk */}
					<div className='flex items-center gap-1.5 mt-0.5 ml-[22px]'>
						<span className={`
							text-[9px] font-medium px-1 py-0.5 rounded border
							${stageColor.bg} ${stageColor.text} ${stageColor.border}
						`}>
							{step.stage}
						</span>
						{step.risk && (
							<span className={`
								text-[9px] font-medium px-1 py-0.5 rounded border
								${riskColors[step.risk]}
							`}>
								{step.risk}
							</span>
						)}
						{step.duration !== undefined && (
							<span className='text-[9px] text-zinc-600'>
								{formatDuration(step.duration)}
							</span>
						)}
					</div>

					{/* Expanded details */}
					{isExpanded && step.description && (
						<div className='mt-1 ml-[22px] text-[10px] text-zinc-500 leading-relaxed'>
							{step.description}
						</div>
					)}

					{/* Dependencies */}
					{isExpanded && step.dependencies && step.dependencies.length > 0 && (
						<div className='mt-1 ml-[22px] flex items-center gap-1 text-[9px] text-zinc-600'>
							<span>Depends on:</span>
							{step.dependencies.map(dep => (
								<span key={dep} className='bg-zinc-800/60 px-1 py-0.5 rounded'>
									{dep}
								</span>
							))}
						</div>
					)}
				</div>
			</button>
		</div>
	);
};

// ─── Plan Card ────────────────────────────────────────────────────────────────

export const PlanCard: React.FC<PlanCardProps> = ({
	steps,
	className = '',
	onStepClick,
	onRerun,
	overallStatus = 'planning',
	overallProgress = 0,
}) => {
	const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
	const [showAll, setShowAll] = useState(false);

	const toggleExpanded = useCallback((id: string) => {
		setExpandedSteps(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	const visibleSteps = showAll ? steps : steps.slice(0, 5);
	const hasMore = steps.length > 5;
	const completedCount = steps.filter(s => s.status === 'completed').length;
	const totalCount = steps.length;

	const statusBadge = overallStatus === 'running'
		? <span className='flex items-center gap-1 text-[10px] text-blue-400'><Loader2 size={10} className='animate-spin' /> Running</span>
		: overallStatus === 'completed'
			? <span className='flex items-center gap-1 text-[10px] text-emerald-400'><CheckCircle2 size={10} /> Done</span>
			: overallStatus === 'failed'
				? <span className='flex items-center gap-1 text-[10px] text-red-400'><XCircle size={10} /> Failed</span>
				: <span className='flex items-center gap-1 text-[10px] text-zinc-500'><Clock size={10} /> Planning</span>;

	return (
		<div className={`
			rounded-lg border border-zinc-800/60 bg-zinc-900/60 overflow-hidden
			${className}
		`}>
			{/* Header */}
			<div className='flex items-center justify-between px-3 py-2 border-b border-zinc-800/40'>
				<div className='flex items-center gap-2'>
					<span className='text-[11px] font-medium text-zinc-300'>Execution Plan</span>
					{statusBadge}
				</div>
				<div className='flex items-center gap-1.5'>
					<span className='text-[10px] text-zinc-600'>
						{completedCount}/{totalCount}
					</span>
					{onRerun && overallStatus !== 'running' && (
						<button
							type='button'
							onClick={onRerun}
							className='
								text-[10px] text-zinc-500 hover:text-emerald-400
								px-1.5 py-0.5 rounded hover:bg-zinc-800
								transition-colors cursor-pointer
							'
						>
							Re-run
						</button>
					)}
				</div>
			</div>

			{/* Progress bar */}
			<div className='h-1 bg-zinc-800/60'>
				<div
					className='h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500'
					style={{ width: `${overallProgress}%` }}
				/>
			</div>

			{/* Steps */}
			<div className='px-1.5 py-1'>
				{steps.length === 0 ? (
					<div className='flex items-center justify-center py-4 text-zinc-600'>
						<span className='text-[10px]'>No plan steps yet</span>
					</div>
				) : (
					visibleSteps.map((step, i) => (
						<PlanRow
							key={step.id}
							step={step}
							isLast={i === visibleSteps.length - 1 && !hasMore}
							isExpanded={expandedSteps.has(step.id)}
							onToggle={() => toggleExpanded(step.id)}
							onClick={onStepClick}
						/>
					))
				)}

				{/* Show more */}
				{hasMore && !showAll && (
					<button
						type='button'
						onClick={() => setShowAll(true)}
						className='
							w-full text-center py-1 text-[10px] text-zinc-600
							hover:text-zinc-400 transition-colors cursor-pointer
						'
					>
						Show {steps.length - 5} more steps...
					</button>
				)}
			</div>
		</div>
	);
};

// ─── Inline Plan Summary (compact) ───────────────────────────────────────────

export const InlinePlanSummary: React.FC<{
	steps: PlanStep[];
	className?: string;
	onExpand: () => void;
}> = ({ steps, className = '', onExpand }) => {
	if (steps.length === 0) return null;

	const completed = steps.filter(s => s.status === 'completed').length;
	const running = steps.filter(s => s.status === 'running').length;
	const failed = steps.filter(s => s.status === 'failed').length;
	const progress = Math.round((completed / steps.length) * 100);

	return (
		<div className={`
			rounded-md border border-zinc-800/60 bg-zinc-900/40 p-2
			flex items-center gap-2 cursor-pointer hover:bg-zinc-800/40 transition-colors
			${className}
		`}
			onClick={onExpand}
		>
			{/* Progress indicator */}
			<div className='w-8 h-8 rounded-full border-2 border-zinc-700 flex items-center justify-center relative'>
				<div className='absolute inset-0 rounded-full overflow-hidden'>
					<div
						className='h-full bg-emerald-500/30'
						style={{ clipPath: `polygon(0 0, ${progress}% 0, ${progress}% 100%, 0 100%)` }}
					/>
				</div>
				<span className='text-[9px] font-medium text-zinc-400 relative z-10'>
					{progress}%
				</span>
			</div>

			{/* Info */}
			<div className='flex-1 min-w-0'>
				<div className='text-[11px] font-medium text-zinc-300'>
					{steps.length} step{steps.length !== 1 ? 's' : ''} planned
				</div>
				<div className='flex items-center gap-1.5 mt-0.5'>
					{failed > 0 && <span className='text-[9px] text-red-400'>{failed} failed</span>}
					{running > 0 && <span className='text-[9px] text-blue-400'>{running} running</span>}
					{completed > 0 && <span className='text-[9px] text-emerald-400'>{completed} done</span>}
					{steps.length - completed - running - failed > 0 && (
						<span className='text-[9px] text-zinc-600'>
							{steps.length - completed - running - failed} pending
						</span>
					)}
				</div>
			</div>

			{/* Expand arrow */}
			<ChevronRight size={12} className='text-zinc-600 shrink-0' />
		</div>
	);
};

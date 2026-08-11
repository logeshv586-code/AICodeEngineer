/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import {
	ListChecks,
	Plus,
	X,
	Play,
	Square,
	CheckCircle2,
	Circle,
	Loader2,
	XCircle,
	SkipForward,
	Zap,
	Trash2,
	ChevronRight,
} from 'lucide-react';
import { ForgeWorkflowInfo, WorkflowStepInfo, PlanMode } from '../hooks/useForgeBridge';

// ─── Step status helpers ──────────────────────────────────────────────────────

const statusConfig: Record<WorkflowStepInfo['status'], { icon: React.ReactNode; color: string; bg: string; label: string }> = {
	pending: { icon: <Circle size={12} />, color: 'text-zinc-500', bg: 'bg-zinc-800', label: 'Pending' },
	in_progress: { icon: <Loader2 size={12} className='animate-spin' />, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Running' },
	completed: { icon: <CheckCircle2 size={12} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Done' },
	failed: { icon: <XCircle size={12} />, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Failed' },
	skipped: { icon: <SkipForward size={12} />, color: 'text-zinc-600', bg: 'bg-zinc-800', label: 'Skipped' },
};

const modeConfig: Record<PlanMode, { label: string; color: string; dotColor: string }> = {
	idle: { label: 'Idle', color: 'text-zinc-500', dotColor: 'bg-zinc-500' },
	planning: { label: 'Planning', color: 'text-purple-400', dotColor: 'bg-purple-400' },
	awaiting_approval: { label: 'Awaiting Approval', color: 'text-yellow-400', dotColor: 'bg-yellow-400' },
	running: { label: 'Running', color: 'text-blue-400', dotColor: 'bg-blue-400' },
	paused: { label: 'Paused', color: 'text-amber-400', dotColor: 'bg-amber-400' },
	completed: { label: 'Completed', color: 'text-emerald-400', dotColor: 'bg-emerald-400' },
	failed: { label: 'Failed', color: 'text-red-400', dotColor: 'bg-red-400' },
	cancelled: { label: 'Cancelled', color: 'text-zinc-600', dotColor: 'bg-zinc-600' },
};

// ─── Workflow Step Row ────────────────────────────────────────────────────────

interface WorkflowStepRowProps {
	step: WorkflowStepInfo;
	index: number;
}

const WorkflowStepRow: React.FC<WorkflowStepRowProps> = ({ step, index }) => {
	const config = statusConfig[step.status] || statusConfig.pending;
	const [isExpanded, setIsExpanded] = useState(step.status === 'in_progress' || step.status === 'failed');

	return (
		<div className={`
			rounded-lg border transition-all duration-200
			${step.status === 'in_progress' ? 'border-blue-500/30 bg-blue-500/5' :
				step.status === 'completed' ? 'border-emerald-500/20 bg-emerald-500/5' :
					step.status === 'failed' ? 'border-red-500/30 bg-red-500/5' :
						'border-zinc-700/40 bg-zinc-900/40'}
		`}>
			<div
				className='flex items-center gap-2 px-2.5 py-2 cursor-pointer select-none'
				onClick={() => setIsExpanded(v => !v)}
			>
				{/* Expand chevron */}
				<ChevronRight
					size={12}
					className={`text-zinc-500 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
				/>

				{/* Status icon */}
				<div className={`flex-shrink-0 ${config.color}`}>
					{config.icon}
				</div>

				{/* Step number */}
				<span className='text-[10px] font-mono text-zinc-600 flex-shrink-0'>#{index + 1}</span>

				{/* Stage badge */}
				<span className='text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono uppercase tracking-wider flex-shrink-0'>
					{step.stage}
				</span>

				{/* Title */}
				<span className={`text-xs truncate flex-1 min-w-0 ${step.status === 'completed' ? 'text-zinc-500 line-through opacity-70' :
						step.status === 'in_progress' ? 'text-zinc-200 font-medium' :
							step.status === 'failed' ? 'text-red-400' :
								'text-zinc-400'}`}>
					{step.title}
				</span>

				{/* Status badge */}
				<span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${config.bg} ${config.color}`}>
					{config.label}
				</span>
			</div>

			{/* Expanded detail */}
			{isExpanded && (
				<div className='px-2.5 pb-2.5 pt-0 ml-6'>
					{step.description && (
						<p className='text-[11px] text-zinc-500 leading-relaxed'>{step.description}</p>
					)}
					{step.assignedAgent && (
						<div className='flex items-center gap-1 mt-1.5'>
							<Bot size={10} className='text-zinc-500' />
							<span className='text-[10px] text-zinc-500'>Agent: {step.assignedAgent}</span>
						</div>
					)}
					{step.error && (
						<div className='mt-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/20'>
							<span className='text-[10px] text-red-400'>{step.error}</span>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

// ─── WorkflowsView ───────────────────────────────────────────────────────────

interface WorkflowsViewProps {
	workflows: ForgeWorkflowInfo[];
	activeWorkflowId: string | null;
	planMode: PlanMode;
	onStartWorkflow: (name: string, description: string, goal: string) => void;
	onCancelWorkflow: (id: string) => void;
	onSetActiveWorkflow: (id: string) => void;
	className?: string;
}

export const WorkflowsView: React.FC<WorkflowsViewProps> = ({
	workflows,
	activeWorkflowId,
	planMode,
	onStartWorkflow,
	onCancelWorkflow,
	onSetActiveWorkflow,
	className = '',
}) => {
	const [isStarting, setIsStarting] = useState(false);
	const [newName, setNewName] = useState('');
	const [newGoal, setNewGoal] = useState('');
	const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all');

	const handleStart = useCallback(() => {
		const trimmed = newName.trim();
		if (!trimmed) return;
		onStartWorkflow(trimmed, newGoal.trim() || trimmed, newGoal.trim() || trimmed);
		setNewName('');
		setNewGoal('');
		setIsStarting(false);
	}, [newName, newGoal, onStartWorkflow]);

	const modeInfo = modeConfig[planMode] || modeConfig.idle;

	const filtered = workflows.filter(w => {
		if (filter === 'all') return true;
		if (filter === 'active') return w.status === 'running' || w.status === 'planning';
		if (filter === 'completed') return w.status === 'completed';
		if (filter === 'failed') return w.status === 'failed' || w.status === 'cancelled';
		return true;
	});

	const activeWorkflow = workflows.find(w => w.id === activeWorkflowId);

	return (
		<div className={`flex flex-col h-full overflow-hidden ${className}`}>
			{/* Header */}
			<div className='flex items-center justify-between px-3 py-2 border-b border-zinc-700/60 shrink-0'>
				<div className='flex items-center gap-1.5'>
					<ListChecks size={13} className='text-emerald-400' />
					<span className='text-xs font-medium text-zinc-300'>Workflows</span>
					<span className='text-[10px] text-zinc-500 font-mono'>{workflows.length}</span>
				</div>
				<div className='flex items-center gap-1'>
					{/* Plan mode indicator */}
					<span className={`flex items-center gap-1 text-[10px] ${modeInfo.color}`}>
						<span className={`w-1.5 h-1.5 rounded-full ${modeInfo.dotColor} ${planMode === 'running' ? 'animate-pulse' : ''}`} />
						{modeInfo.label}
					</span>
					<button
						type='button'
						onClick={() => setIsStarting(v => !v)}
						className='p-1 hover:text-emerald-400 text-zinc-500 transition-colors cursor-pointer'
						title='New workflow'
					>
						{isStarting ? <X size={13} /> : <Plus size={13} />}
					</button>
				</div>
			</div>

			{/* Create workflow form */}
			{isStarting && (
				<div className='px-3 py-2 border-b border-zinc-700/40 bg-zinc-800/30 shrink-0'>
					<input
						autoFocus
						value={newName}
						onChange={e => setNewName(e.target.value)}
						onKeyDown={e => { if (e.key === 'Enter') handleStart(); if (e.key === 'Escape') { setIsStarting(false); setNewName(''); setNewGoal(''); } }}
						placeholder='Workflow name...'
						className='w-full px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none'
					/>
					<input
						value={newGoal}
						onChange={e => setNewGoal(e.target.value)}
						onKeyDown={e => { if (e.key === 'Enter') handleStart(); if (e.key === 'Escape') { setIsStarting(false); setNewName(''); setNewGoal(''); } }}
						placeholder='Goal / description...'
						className='w-full px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none mt-1'
					/>
					<div className='flex gap-1 mt-1.5'>
						<button
							type='button'
							onClick={handleStart}
							className='px-2 py-0.5 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors cursor-pointer flex items-center gap-1'
						>
							<Play size={10} /> Start
						</button>
						<button
							type='button'
							onClick={() => { setIsStarting(false); setNewName(''); setNewGoal(''); }}
							className='px-2 py-0.5 text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors cursor-pointer'
						>
							Cancel
						</button>
					</div>
				</div>
			)}

			{/* Filter tabs */}
			<div className='flex items-center gap-0.5 px-3 py-1.5 border-b border-zinc-700/40 shrink-0'>
				{(['all', 'active', 'completed', 'failed'] as const).map(f => (
					<button
						key={f}
						type='button'
						onClick={() => setFilter(f)}
						className={`px-1.5 py-0.5 text-[10px] rounded transition-colors cursor-pointer capitalize ${
							filter === f
								? 'bg-zinc-700 text-zinc-200'
								: 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
						}`}
					>
						{f}
					</button>
				))}
			</div>

			{/* Workflow list */}
			<div className='flex-1 overflow-y-auto p-2 space-y-2'>
				{filtered.length === 0 ? (
					<div className='flex flex-col items-center justify-center py-8 text-zinc-600'>
						<ListChecks size={24} className='mb-2 opacity-40' />
						<span className='text-xs'>No workflows yet</span>
						<span className='text-[10px] mt-0.5'>Create one to get started</span>
					</div>
				) : (
					filtered.map(workflow => {
						const isActive = workflow.id === activeWorkflowId;
						const wfStatusConfig = statusConfig[workflow.status as WorkflowStepInfo['status']] || statusConfig.pending;
						const completedSteps = workflow.steps.filter(s => s.status === 'completed').length;
						const totalSteps = workflow.steps.length;
						const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

						return (
							<div
								key={workflow.id}
								className={`
									rounded-lg border transition-all duration-200 cursor-pointer
									${isActive
										? 'border-emerald-500/30 bg-emerald-500/5 shadow-sm'
										: 'border-zinc-700/40 bg-zinc-900/40 hover:border-zinc-600'
									}
								`}
								onClick={() => onSetActiveWorkflow(workflow.id)}
							>
								{/* Workflow header */}
								<div className='px-3 py-2'>
									<div className='flex items-center justify-between'>
										<div className='flex items-center gap-2 min-w-0'>
											<span className='text-xs font-medium text-zinc-200 truncate'>{workflow.name}</span>
											<span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${wfStatusConfig.bg} ${wfStatusConfig.color}`}>
												{wfStatusConfig.label}
											</span>
										</div>
										<div className='flex items-center gap-1 flex-shrink-0'>
											{(workflow.status === 'running' || workflow.status === 'planning') && (
												<button
													type='button'
													onClick={(e) => { e.stopPropagation(); onCancelWorkflow(workflow.id); }}
													className='p-1 hover:text-red-400 text-zinc-600 transition-colors cursor-pointer'
													title='Cancel workflow'
												>
													<Square size={10} />
												</button>
											)}
											<button
												type='button'
												onClick={(e) => { e.stopPropagation(); }}
												className='p-1 hover:text-red-400 text-zinc-600 opacity-0 group-hover:opacity-100 transition-colors cursor-pointer'
												title='Delete workflow'
											>
												<Trash2 size={10} />
											</button>
										</div>
									</div>

									{workflow.description && (
										<p className='text-[10px] text-zinc-500 mt-0.5 truncate'>{workflow.description}</p>
									)}

									{/* Progress bar */}
									{totalSteps > 0 && (
										<div className='mt-2'>
											<div className='flex items-center justify-between text-[10px] text-zinc-500 mb-1'>
												<span>{completedSteps}/{totalSteps} steps</span>
												<span>{progress}%</span>
											</div>
											<div className='h-1 bg-zinc-700/60 rounded-full overflow-hidden'>
												<div
													className='h-full bg-emerald-500/70 rounded-full transition-all duration-500'
													style={{ width: `${progress}%` }}
												/>
											</div>
										</div>
									)}
								</div>

								{/* Steps */}
								{isActive && workflow.steps.length > 0 && (
									<div className='px-2 pb-2 space-y-1'>
										{workflow.steps.map((step, i) => (
											<WorkflowStepRow key={step.id} step={step} index={i} />
										))}
									</div>
								)}
							</div>
						);
					})
				)}
			</div>
		</div>
	);
};

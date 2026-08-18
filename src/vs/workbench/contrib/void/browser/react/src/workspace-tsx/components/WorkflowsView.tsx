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
	Trash2,
	ChevronRight,
	Bot,
	RotateCcw,
} from 'lucide-react';
import { ForgeWorkflowInfo, WorkflowStepInfo, PlanMode } from '../hooks/useForgeBridge';

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

const WorkflowStepRow: React.FC<{ step: WorkflowStepInfo; index: number }> = ({ step, index }) => {
	const config = statusConfig[step.status] || statusConfig.pending;
	const [isExpanded, setIsExpanded] = useState(step.status === 'in_progress' || step.status === 'failed');
	return (
		<div className={`rounded-lg border transition-all duration-200 ${step.status === 'in_progress' ? 'border-blue-500/30 bg-blue-500/5' : step.status === 'completed' ? 'border-emerald-500/20 bg-emerald-500/5' : step.status === 'failed' ? 'border-red-500/30 bg-red-500/5' : 'border-zinc-700/40 bg-zinc-900/40'}`}>
			<button type='button' className='w-full flex items-center gap-2 px-2.5 py-2 cursor-pointer select-none text-left' onClick={() => setIsExpanded(v => !v)} aria-expanded={isExpanded}>
				<ChevronRight size={12} className={`text-zinc-500 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
				<div className={`flex-shrink-0 ${config.color}`}>{config.icon}</div>
				<span className='text-[10px] font-mono text-zinc-600 flex-shrink-0'>#{index + 1}</span>
				<span className='text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono uppercase tracking-wider flex-shrink-0'>{step.stage}</span>
				<span className={`text-xs truncate flex-1 min-w-0 ${step.status === 'completed' ? 'text-zinc-500 line-through opacity-70' : step.status === 'in_progress' ? 'text-zinc-200 font-medium' : step.status === 'failed' ? 'text-red-400' : 'text-zinc-400'}`}>{step.title}</span>
				<span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${config.bg} ${config.color}`}>{config.label}</span>
			</button>
			{isExpanded && (
				<div className='px-2.5 pb-2.5 pt-0 ml-6'>
					{step.description && <p className='text-[11px] text-zinc-500 leading-relaxed'>{step.description}</p>}
					{step.assignedAgent && <div className='flex items-center gap-1 mt-1.5'><Bot size={10} className='text-zinc-500' /><span className='text-[10px] text-zinc-500'>Agent: {step.assignedAgent}</span></div>}
					{step.error && <div className='mt-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/20'><span className='text-[10px] text-red-400'>{step.error}</span></div>}
				</div>
			)}
		</div>
	);
};

interface WorkflowsViewProps {
	workflows: ForgeWorkflowInfo[];
	activeWorkflowId: string | null;
	planMode: PlanMode;
	onStartWorkflow: (name: string, description: string, goal: string) => void;
	onCancelWorkflow: (id: string) => void;
	onDeleteWorkflow?: (id: string) => void;
	onSetActiveWorkflow: (id: string) => void;
	className?: string;
}

export const WorkflowsView: React.FC<WorkflowsViewProps> = ({
	workflows,
	activeWorkflowId,
	planMode,
	onStartWorkflow,
	onCancelWorkflow,
	onDeleteWorkflow,
	onSetActiveWorkflow,
	className = '',
}) => {
	const [isStarting, setIsStarting] = useState(false);
	const [newName, setNewName] = useState('');
	const [newGoal, setNewGoal] = useState('');
	const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all');
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

	const resetForm = () => { setNewName(''); setNewGoal(''); setIsStarting(false); };
	const handleStart = useCallback(() => {
		const trimmed = newName.trim();
		if (!trimmed) return;
		const goal = newGoal.trim() || trimmed;
		onStartWorkflow(trimmed, goal, goal);
		resetForm();
	}, [newName, newGoal, onStartWorkflow]);

	const filtered = workflows.filter(workflow => {
		if (filter === 'all') return true;
		if (filter === 'active') return ['running', 'planning', 'paused', 'awaiting_approval'].includes(workflow.status);
		if (filter === 'completed') return workflow.status === 'completed';
		return workflow.status === 'failed' || workflow.status === 'cancelled';
	});
	const modeInfo = modeConfig[planMode] || modeConfig.idle;

	return (
		<div className={`flex flex-col h-full overflow-hidden ${className}`}>
			<div className='flex items-center justify-between px-3 py-2 border-b border-zinc-700/60 shrink-0'>
				<div className='flex items-center gap-1.5'><ListChecks size={13} className='text-emerald-400' /><span className='text-xs font-medium text-zinc-300'>Workflows</span><span className='text-[10px] text-zinc-500 font-mono'>{workflows.length}</span></div>
				<div className='flex items-center gap-1'>
					<span className={`flex items-center gap-1 text-[10px] ${modeInfo.color}`}><span className={`w-1.5 h-1.5 rounded-full ${modeInfo.dotColor} ${planMode === 'running' ? 'animate-pulse' : ''}`} />{modeInfo.label}</span>
					<button type='button' onClick={() => setIsStarting(v => !v)} className='p-1 hover:text-emerald-400 text-zinc-500 transition-colors cursor-pointer' title='New workflow'>{isStarting ? <X size={13} /> : <Plus size={13} />}</button>
				</div>
			</div>

			{isStarting && (
				<div className='px-3 py-2 border-b border-zinc-700/40 bg-zinc-800/30 shrink-0'>
					<input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleStart(); if (e.key === 'Escape') resetForm(); }} placeholder='Workflow name…' className='w-full px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none' />
					<input value={newGoal} onChange={e => setNewGoal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleStart(); if (e.key === 'Escape') resetForm(); }} placeholder='Goal / acceptance criteria…' className='w-full px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none mt-1' />
					<div className='flex gap-1 mt-1.5'>
						<button type='button' onClick={handleStart} disabled={!newName.trim()} className='px-2 py-0.5 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-40'><Play size={10} /> Start</button>
						<button type='button' onClick={resetForm} className='px-2 py-0.5 text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors cursor-pointer'>Cancel</button>
					</div>
				</div>
			)}

			<div className='flex items-center gap-0.5 px-3 py-1.5 border-b border-zinc-700/40 shrink-0'>
				{(['all', 'active', 'completed', 'failed'] as const).map(item => <button key={item} type='button' onClick={() => setFilter(item)} className={`px-1.5 py-0.5 text-[10px] rounded transition-colors cursor-pointer capitalize ${filter === item ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}>{item}</button>)}
			</div>

			<div className='flex-1 overflow-y-auto p-2 space-y-2'>
				{filtered.length === 0 ? (
					<div className='flex flex-col items-center justify-center py-8 text-zinc-600'><ListChecks size={24} className='mb-2 opacity-40' /><span className='text-xs'>No workflows here</span><span className='text-[10px] mt-0.5'>Create one or change the filter</span></div>
				) : filtered.map(workflow => {
					const isActive = workflow.id === activeWorkflowId;
					const wfStatusConfig = statusConfig[workflow.status as WorkflowStepInfo['status']] || { icon: <Circle size={12} />, color: 'text-zinc-500', bg: 'bg-zinc-800', label: workflow.status };
					const completedSteps = workflow.steps.filter(step => step.status === 'completed').length;
					const totalSteps = workflow.steps.length;
					const progress = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;
					const running = workflow.status === 'running' || workflow.status === 'planning';
					return (
						<div key={workflow.id} className={`group rounded-lg border transition-all duration-200 cursor-pointer ${isActive ? 'border-emerald-500/30 bg-emerald-500/5 shadow-sm' : 'border-zinc-700/40 bg-zinc-900/40 hover:border-zinc-600'}`} onClick={() => onSetActiveWorkflow(workflow.id)}>
							<div className='px-3 py-2'>
								<div className='flex items-center justify-between gap-2'>
									<div className='flex items-center gap-2 min-w-0'><span className='text-xs font-medium text-zinc-200 truncate'>{workflow.name}</span><span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${wfStatusConfig.bg} ${wfStatusConfig.color}`}>{wfStatusConfig.label}</span></div>
									<div className='flex items-center gap-0.5 flex-shrink-0'>
										{running && <button type='button' onClick={event => { event.stopPropagation(); onCancelWorkflow(workflow.id); }} className='p-1 hover:text-red-400 text-zinc-600 transition-colors cursor-pointer' title='Cancel workflow'><Square size={10} /></button>}
										{!running && <button type='button' onClick={event => { event.stopPropagation(); onStartWorkflow(workflow.name, workflow.description, workflow.plan?.goal || workflow.description || workflow.name); }} className='p-1 hover:text-emerald-400 text-zinc-600 transition-colors cursor-pointer' title='Run again'><RotateCcw size={10} /></button>}
										{onDeleteWorkflow && <button type='button' onClick={event => { event.stopPropagation(); if (confirmDeleteId === workflow.id) { onDeleteWorkflow(workflow.id); setConfirmDeleteId(null); } else { setConfirmDeleteId(workflow.id); } }} onBlur={() => setConfirmDeleteId(current => current === workflow.id ? null : current)} className={`p-1 transition-colors cursor-pointer ${confirmDeleteId === workflow.id ? 'text-red-400 bg-red-500/10' : 'text-zinc-600 hover:text-red-400'}`} title={confirmDeleteId === workflow.id ? 'Click again to delete' : 'Delete workflow'}><Trash2 size={10} /></button>}
									</div>
								</div>
								{workflow.description && <p className='text-[10px] text-zinc-500 mt-0.5 truncate'>{workflow.description}</p>}
								{totalSteps > 0 && <div className='mt-2'><div className='flex items-center justify-between text-[10px] text-zinc-500 mb-1'><span>{completedSteps}/{totalSteps} steps</span><span>{progress}%</span></div><div className='h-1 bg-zinc-700/60 rounded-full overflow-hidden'><div className='h-full bg-emerald-500/70 rounded-full transition-all duration-500' style={{ width: `${progress}%` }} /></div></div>}
							</div>
							{isActive && workflow.steps.length > 0 && <div className='px-2 pb-2 space-y-1'>{workflow.steps.map((step, index) => <WorkflowStepRow key={step.id} step={step} index={index} />)}</div>}
						</div>
					);
				})}
			</div>
		</div>
	);
};
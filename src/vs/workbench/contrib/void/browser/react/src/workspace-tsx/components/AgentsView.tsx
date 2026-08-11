/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import {
	Bot,
	Plus,
	X,
	CheckCircle2,
	Circle,
	Loader2,
	XCircle,
	Zap,
	GitBranch,
	Trash2,
} from 'lucide-react';
import { ForgeAgentInfo, ForgeWorkflowInfo, WorkflowStepInfo } from '../hooks/useForgeBridge';
import { AgentRole } from '../../../../common/forge/types/brainTypes';

// ─── Agent Role display helpers ───────────────────────────────────────────────

const roleLabel: Record<AgentRole, { label: string; color: string; icon: string }> = {
	BrainManager: { label: 'Brain', color: 'text-purple-400', icon: '🧠' },
	CodeEngineer: { label: 'Engineer', color: 'text-emerald-400', icon: '⚙' },
	RAGAgent: { label: 'RAG', color: 'text-cyan-400', icon: '🔍' },
	WebResearchAgent: { label: 'Web', color: 'text-blue-400', icon: '🌐' },
	ReviewAgent: { label: 'Reviewer', color: 'text-amber-400', icon: '👁' },
	TestAgent: { label: 'Tester', color: 'text-rose-400', icon: '🧪' },
	DeploymentAgent: { label: 'Deploy', color: 'text-teal-400', icon: '🚀' },
	UIAutomationAgent: { label: 'UI', color: 'text-pink-400', icon: '🎯' },
};

const stateIcon = (state: string) => {
	switch (state) {
		case 'running':
		case 'planning':
			return <Loader2 size={12} className='text-blue-400 animate-spin flex-shrink-0' />;
		case 'queued':
		case 'waiting':
			return <Circle size={12} className='text-amber-400 flex-shrink-0' />;
		case 'completed':
		case 'done':
			return <CheckCircle2 size={12} className='text-emerald-400 flex-shrink-0' />;
		case 'failed':
			return <XCircle size={12} className='text-red-400 flex-shrink-0' />;
		default:
			return <Circle size={12} className='text-zinc-500 flex-shrink-0' />;
	}
};

// ─── Agent Card ──────────────────────────────────────────────────────────────

interface AgentCardProps {
	agent: ForgeAgentInfo;
	isSelected: boolean;
	onSelect: () => void;
	onDelete?: () => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, isSelected, onSelect, onDelete }) => {
	const roleInfo = roleLabel[agent.role] || { label: agent.role, color: 'text-zinc-400', icon: '🤖' };
	const isActive = agent.state === 'running' || agent.state === 'planning';

	return (
		<div
			className={`
				group flex items-center gap-2.5 px-2.5 py-2 rounded-lg border cursor-pointer
				transition-all duration-150
				${isSelected
					? 'bg-zinc-800/80 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
					: 'bg-zinc-900/40 border-zinc-700/40 hover:border-zinc-600 hover:bg-zinc-800/40'
				}
			`}
			onClick={onSelect}
		>
			{/* Icon */}
			<div className={`
				w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm
				${isActive ? 'bg-blue-500/15 border border-blue-500/30' : 'bg-zinc-800 border border-zinc-700/50'}
			`}>
				{isActive ? <Loader2 size={14} className='text-blue-400 animate-spin' /> : <span>{roleInfo.icon}</span>}
			</div>

			{/* Info */}
			<div className='flex-1 min-w-0'>
				<div className='flex items-center gap-1.5'>
					<span className={`text-xs font-medium truncate ${isSelected ? 'text-zinc-200' : 'text-zinc-300'}`}>
						{agent.name}
					</span>
					{stateIcon(agent.state)}
				</div>
				<div className='flex items-center gap-1.5 mt-0.5'>
					<span className={`text-[10px] ${roleInfo.color}`}>{roleInfo.label}</span>
					{isActive && agent.currentTask && (
						<>
							<span className='text-zinc-600'>·</span>
							<span className='text-[10px] text-zinc-500 truncate max-w-[80px]'>{agent.currentTask}</span>
						</>
					)}
				</div>
			</div>

			{/* Progress bar */}
			{isActive && (
				<div className='w-12 h-1 bg-zinc-700 rounded-full overflow-hidden flex-shrink-0'>
					<div
						className='h-full bg-emerald-500 rounded-full transition-all duration-500'
						style={{ width: `${agent.progress}%` }}
					/>
				</div>
			)}

			{/* Delete button */}
			{onDelete && agent.id !== 'forge-agent' && (
				<button
					type='button'
					onClick={(e) => { e.stopPropagation(); onDelete(); }}
					className='opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all cursor-pointer'
					title='Remove agent'
				>
					<Trash2 size={12} />
				</button>
			)}
		</div>
	);
};

// ─── AgentsView ──────────────────────────────────────────────────────────────

interface AgentsViewProps {
	agents: ForgeAgentInfo[];
	selectedAgentId: string | null;
	workflows: ForgeWorkflowInfo[];
	onSelectAgent: (id: string) => void;
	onCreateAgent: (name: string) => void;
	onDeleteAgent?: (id: string) => void;
	onStartWorkflow: (name: string, description: string, goal: string) => void;
	onCancelWorkflow: (id: string) => void;
	className?: string;
}

export const AgentsView: React.FC<AgentsViewProps> = ({
	agents,
	selectedAgentId,
	workflows,
	onSelectAgent,
	onCreateAgent,
	onDeleteAgent,
	onStartWorkflow,
	onCancelWorkflow,
	className = '',
}) => {
	const [isCreating, setIsCreating] = useState(false);
	const [newName, setNewName] = useState('');
	const [isStarting, setIsStarting] = useState(false);
	const [newWorkflowName, setNewWorkflowName] = useState('');
	const [newWorkflowGoal, setNewWorkflowGoal] = useState('');

	const handleCreate = useCallback(() => {
		const trimmed = newName.trim();
		if (!trimmed) return;
		onCreateAgent(trimmed);
		setNewName('');
		setIsCreating(false);
	}, [newName, onCreateAgent]);

	const handleStartWorkflow = useCallback(() => {
		const trimmed = newWorkflowName.trim();
		if (!trimmed) return;
		onStartWorkflow(trimmed, newWorkflowGoal.trim() || trimmed, newWorkflowGoal.trim() || trimmed);
		setNewWorkflowName('');
		setNewWorkflowGoal('');
		setIsStarting(false);
	}, [newWorkflowName, newWorkflowGoal, onStartWorkflow]);

	const activeWorkflow = workflows.find(w => w.status === 'running' || w.status === 'planning');

	return (
		<div className={`flex flex-col h-full overflow-y-auto ${className}`}>
			{/* Header */}
			<div className='flex items-center justify-between px-3 py-2 border-b border-zinc-700/60 shrink-0'>
				<div className='flex items-center gap-1.5'>
					<Bot size={13} className='text-emerald-400' />
					<span className='text-xs font-medium text-zinc-300'>Agents</span>
					<span className='text-[10px] text-zinc-500 font-mono'>{agents.length}</span>
				</div>
				<button
					type='button'
					onClick={() => setIsCreating(v => !v)}
					className='p-1 hover:text-emerald-400 text-zinc-500 transition-colors cursor-pointer'
					title='Create agent'
				>
					{isCreating ? <X size={13} /> : <Plus size={13} />}
				</button>
			</div>

			{/* Create agent form */}
			{isCreating && (
				<div className='px-3 py-2 border-b border-zinc-700/40 bg-zinc-800/30'>
					<input
						autoFocus
						value={newName}
						onChange={e => setNewName(e.target.value)}
						onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setIsCreating(false); setNewName(''); } }}
						placeholder='Agent name...'
						className='w-full px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none'
					/>
					<div className='flex gap-1 mt-1.5'>
						<button
							type='button'
							onClick={handleCreate}
							className='px-2 py-0.5 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors cursor-pointer'
						>
							Create
						</button>
						<button
							type='button'
							onClick={() => { setIsCreating(false); setNewName(''); }}
							className='px-2 py-0.5 text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors cursor-pointer'
						>
							Cancel
						</button>
					</div>
				</div>
			)}

			{/* Agent list */}
			<div className='flex flex-col gap-1 p-2'>
				{agents.map(agent => (
					<AgentCard
						key={agent.id}
						agent={agent}
						isSelected={agent.id === selectedAgentId}
						onSelect={() => onSelectAgent(agent.id)}
						onDelete={onDeleteAgent}
					/>
				))}
			</div>

			{/* Active workflow section */}
			{activeWorkflow && (
				<div className='px-3 py-2 border-t border-zinc-700/60'>
					<div className='flex items-center gap-1.5 mb-2'>
						<Zap size={12} className='text-amber-400 animate-pulse' />
						<span className='text-[10px] font-medium text-amber-400 uppercase tracking-wider'>Active Workflow</span>
					</div>
					<div className='bg-zinc-900/60 rounded-lg border border-amber-500/20 p-2'>
						<div className='text-xs text-zinc-300 font-medium truncate'>{activeWorkflow.name}</div>
						<div className='text-[10px] text-zinc-500 mt-0.5'>{activeWorkflow.description}</div>
						{/* Mini progress */}
						{activeWorkflow.plan && (
							<div className='mt-2'>
								<div className='flex items-center justify-between text-[10px] text-zinc-500 mb-1'>
									<span>Progress</span>
									<span>{activeWorkflow.plan.steps.filter(s => s.status === 'completed').length}/{activeWorkflow.plan.steps.length}</span>
								</div>
								<div className='h-1 bg-zinc-700 rounded-full overflow-hidden'>
									<div
										className='h-full bg-amber-500 rounded-full transition-all duration-500'
										style={{ width: `${(activeWorkflow.plan.steps.filter(s => s.status === 'completed').length / activeWorkflow.plan.steps.length) * 100}%` }}
									/>
								</div>
							</div>
						)}
						<button
							type='button'
							onClick={() => onCancelWorkflow(activeWorkflow.id)}
							className='mt-2 text-[10px] text-red-400 hover:text-red-300 transition-colors cursor-pointer'
						>
							Stop Workflow
						</button>
					</div>
				</div>
			)}

			{/* Start new workflow */}
			<div className='px-3 py-2 border-t border-zinc-700/60'>
				{!isStarting ? (
					<button
						type='button'
						onClick={() => setIsStarting(true)}
						className='w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg border border-zinc-700/60 transition-all cursor-pointer'
					>
						<Zap size={12} className='text-amber-400' />
						<span>New Workflow</span>
					</button>
				) : (
					<div className='space-y-1.5'>
						<input
							autoFocus
							value={newWorkflowName}
							onChange={e => setNewWorkflowName(e.target.value)}
							onKeyDown={e => { if (e.key === 'Enter') handleStartWorkflow(); if (e.key === 'Escape') { setIsStarting(false); setNewWorkflowName(''); setNewWorkflowGoal(''); } }}
							placeholder='Workflow name...'
							className='w-full px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none'
						/>
						<input
							value={newWorkflowGoal}
							onChange={e => setNewWorkflowGoal(e.target.value)}
							onKeyDown={e => { if (e.key === 'Enter') handleStartWorkflow(); if (e.key === 'Escape') { setIsStarting(false); setNewWorkflowName(''); setNewWorkflowGoal(''); } }}
							placeholder='Goal / task description...'
							className='w-full px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none'
						/>
						<div className='flex gap-1'>
							<button
								type='button'
								onClick={handleStartWorkflow}
								className='px-2 py-0.5 text-[10px] bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors cursor-pointer'
							>
								Start
							</button>
							<button
								type='button'
								onClick={() => { setIsStarting(false); setNewWorkflowName(''); setNewWorkflowGoal(''); }}
								className='px-2 py-0.5 text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors cursor-pointer'
							>
								Cancel
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

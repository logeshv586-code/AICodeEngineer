/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import { Bot, Plus, X, CheckCircle2, Circle, Loader2, XCircle, Zap, Trash2, ShieldCheck } from 'lucide-react';
import { ForgeAgentInfo, ForgeWorkflowInfo } from '../hooks/useForgeBridge';
import type { AgentRole } from '../../../../common/forge/types/brainTypes';

const roleLabel: Record<AgentRole, { label: string; color: string; icon: string }> = {
	BrainManager: { label: 'Brain', color: 'text-purple-400', icon: '🧠' },
	CodeEngineer: { label: 'Engineer', color: 'text-emerald-400', icon: '⚙' },
	RAGAgent: { label: 'RAG', color: 'text-cyan-400', icon: '🔍' },
	WebResearchAgent: { label: 'Web', color: 'text-blue-400', icon: '🌐' },
	ReviewAgent: { label: 'Reviewer', color: 'text-amber-400', icon: '👁' },
	TestAgent: { label: 'Tester', color: 'text-rose-400', icon: '🧪' },
	DeploymentAgent: { label: 'Deploy', color: 'text-teal-400', icon: '🚀' },
	UIAutomationAgent: { label: 'Browser', color: 'text-pink-400', icon: '🎯' },
	DesignAgent: { label: 'Design', color: 'text-fuchsia-400', icon: '🎨' },
	AutomationAgent: { label: 'Automation', color: 'text-orange-400', icon: '⏱' },
	KnowledgeAgent: { label: 'Knowledge', color: 'text-sky-400', icon: '🗺' },
	LearningAgent: { label: 'Learning', color: 'text-lime-400', icon: '↻' },
};

const stateIcon = (state: string) => {
	switch (state) {
		case 'running': case 'planning': return <Loader2 size={12} className='text-blue-400 animate-spin shrink-0' />;
		case 'queued': case 'waiting': return <Circle size={12} className='text-amber-400 shrink-0' />;
		case 'completed': case 'done': return <CheckCircle2 size={12} className='text-emerald-400 shrink-0' />;
		case 'failed': return <XCircle size={12} className='text-red-400 shrink-0' />;
		default: return <Circle size={12} className='text-zinc-500 shrink-0' />;
	}
};

const AgentCard: React.FC<{
	agent: ForgeAgentInfo;
	isSelected: boolean;
	onSelect: () => void;
	onDelete?: () => void;
}> = ({ agent, isSelected, onSelect, onDelete }) => {
	const info = roleLabel[agent.role];
	const active = agent.state === 'running' || agent.state === 'planning';
	return (
		<div className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg border cursor-pointer transition-all duration-150 ${isSelected ? 'bg-zinc-800/80 border-emerald-500/40 shadow-sm shadow-emerald-500/10' : 'bg-zinc-900/40 border-zinc-700/40 hover:border-zinc-600 hover:bg-zinc-800/40'}`} onClick={onSelect}>
			<div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm ${active ? 'bg-blue-500/15 border border-blue-500/30' : 'bg-zinc-800 border border-zinc-700/50'}`}>{active ? <Loader2 size={14} className='text-blue-400 animate-spin' /> : <span>{info.icon}</span>}</div>
			<div className='flex-1 min-w-0'>
				<div className='flex items-center gap-1.5'><span className={`text-xs font-medium truncate ${isSelected ? 'text-zinc-200' : 'text-zinc-300'}`}>{agent.name}</span>{stateIcon(agent.state)}</div>
				<div className='flex items-center gap-1.5 mt-0.5'><span className={`text-[10px] ${info.color}`}>{info.label}</span><span className='text-[9px] text-zinc-600'>{agent.capabilities.length} capabilities</span>{active && agent.currentTask && <><span className='text-zinc-600'>·</span><span className='text-[10px] text-zinc-500 truncate max-w-[80px]'>{agent.currentTask}</span></>}</div>
			</div>
			{active && <div className='w-12 h-1 bg-zinc-700 rounded-full overflow-hidden shrink-0'><div className='h-full bg-emerald-500 rounded-full transition-all duration-500' style={{ width: `${Math.max(0, Math.min(100, agent.progress))}%` }} /></div>}
			{onDelete && agent.id !== 'forge-agent' && !active && <button type='button' onClick={event => { event.stopPropagation(); onDelete(); }} className='opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-zinc-600 transition-all cursor-pointer' title='Remove agent'><Trash2 size={12} /></button>}
		</div>
	);
};

interface AgentsViewProps {
	agents: ForgeAgentInfo[];
	selectedAgentId: string | null;
	workflows: ForgeWorkflowInfo[];
	onSelectAgent: (id: string) => void;
	onCreateAgent: (name: string, role?: AgentRole) => void;
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
	const [newRole, setNewRole] = useState<AgentRole>('CodeEngineer');
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
	const [isStarting, setIsStarting] = useState(false);
	const [newWorkflowName, setNewWorkflowName] = useState('');
	const [newWorkflowGoal, setNewWorkflowGoal] = useState('');

	const resetAgentForm = () => { setIsCreating(false); setNewName(''); setNewRole('CodeEngineer'); };
	const handleCreate = useCallback(() => {
		const name = newName.trim();
		if (!name) return;
		onCreateAgent(name, newRole);
		resetAgentForm();
	}, [newName, newRole, onCreateAgent]);

	const handleStartWorkflow = useCallback(() => {
		const name = newWorkflowName.trim();
		if (!name) return;
		const goal = newWorkflowGoal.trim() || name;
		onStartWorkflow(name, goal, goal);
		setNewWorkflowName(''); setNewWorkflowGoal(''); setIsStarting(false);
	}, [newWorkflowGoal, newWorkflowName, onStartWorkflow]);

	const activeWorkflow = workflows.find(workflow => workflow.status === 'running' || workflow.status === 'planning');

	return (
		<div className={`flex flex-col h-full overflow-y-auto ${className}`}>
			<div className='flex items-center justify-between px-3 py-2 border-b border-zinc-700/60 shrink-0'>
				<div className='flex items-center gap-1.5'><Bot size={13} className='text-emerald-400' /><span className='text-xs font-medium text-zinc-300'>Agents</span><span className='text-[10px] text-zinc-500 font-mono'>{agents.length}</span></div>
				<button type='button' onClick={() => setIsCreating(value => !value)} className='p-1 hover:text-emerald-400 text-zinc-500 transition-colors cursor-pointer' title='Create specialized agent'>{isCreating ? <X size={13} /> : <Plus size={13} />}</button>
			</div>

			{isCreating && (
				<div className='px-3 py-2 border-b border-zinc-700/40 bg-zinc-800/30 space-y-1.5'>
					<input autoFocus value={newName} onChange={event => setNewName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') handleCreate(); if (event.key === 'Escape') resetAgentForm(); }} placeholder='Agent name…' className='w-full px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none' />
					<select value={newRole} onChange={event => setNewRole(event.target.value as AgentRole)} className='w-full px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-300 focus:border-emerald-500/50 focus:outline-none'>{(Object.keys(roleLabel) as AgentRole[]).map(role => <option key={role} value={role}>{roleLabel[role].label} · {role}</option>)}</select>
					<div className='flex gap-1'><button type='button' onClick={handleCreate} disabled={!newName.trim()} className='px-2 py-0.5 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-40'>Create</button><button type='button' onClick={resetAgentForm} className='px-2 py-0.5 text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded'>Cancel</button></div>
				</div>
			)}

			<div className='flex flex-col gap-1 p-2'>
				{agents.map(agent => <AgentCard key={agent.id} agent={agent} isSelected={agent.id === selectedAgentId} onSelect={() => onSelectAgent(agent.id)} onDelete={onDeleteAgent && agent.id !== 'forge-agent' ? () => { if (confirmDeleteId === agent.id) { onDeleteAgent(agent.id); setConfirmDeleteId(null); } else { setConfirmDeleteId(agent.id); } } : undefined} />)}
				{confirmDeleteId && <div className='px-2 py-1 text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded'>Click the trash icon again to remove that idle agent. Running agents cannot be removed.</div>}
			</div>

			<div className='px-3 py-2 border-t border-zinc-700/60'>
				<div className='flex items-center gap-1.5 mb-2'><ShieldCheck size={12} className='text-zinc-500' /><span className='text-[10px] font-medium text-zinc-500 uppercase tracking-wider'>Execution policy</span></div>
				<p className='text-[10px] text-zinc-600 leading-relaxed'>Agents share the workspace safety and tool-approval layer. Their role changes planning and capability routing, not unrestricted filesystem permissions.</p>
			</div>

			{activeWorkflow && (
				<div className='px-3 py-2 border-t border-zinc-700/60'>
					<div className='flex items-center gap-1.5 mb-2'><Zap size={12} className='text-amber-400 animate-pulse' /><span className='text-[10px] font-medium text-amber-400 uppercase tracking-wider'>Active Workflow</span></div>
					<div className='bg-zinc-900/60 rounded-lg border border-amber-500/20 p-2'>
						<div className='text-xs text-zinc-300 font-medium truncate'>{activeWorkflow.name}</div><div className='text-[10px] text-zinc-500 mt-0.5'>{activeWorkflow.description}</div>
						{activeWorkflow.plan && activeWorkflow.plan.steps.length > 0 && <div className='mt-2'><div className='flex items-center justify-between text-[10px] text-zinc-500 mb-1'><span>Progress</span><span>{activeWorkflow.plan.steps.filter(step => step.status === 'completed').length}/{activeWorkflow.plan.steps.length}</span></div><div className='h-1 bg-zinc-700 rounded-full overflow-hidden'><div className='h-full bg-amber-500 rounded-full transition-all duration-500' style={{ width: `${(activeWorkflow.plan.steps.filter(step => step.status === 'completed').length / activeWorkflow.plan.steps.length) * 100}%` }} /></div></div>}
						<button type='button' onClick={() => onCancelWorkflow(activeWorkflow.id)} className='mt-2 text-[10px] text-red-400 hover:text-red-300 transition-colors cursor-pointer'>Stop Workflow</button>
					</div>
				</div>
			)}

			<div className='px-3 py-2 border-t border-zinc-700/60'>
				{!isStarting ? <button type='button' onClick={() => setIsStarting(true)} className='w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg border border-zinc-700/60 transition-all cursor-pointer'><Zap size={12} className='text-amber-400' />New Workflow</button> : <div className='space-y-1.5'><input autoFocus value={newWorkflowName} onChange={event => setNewWorkflowName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') handleStartWorkflow(); if (event.key === 'Escape') setIsStarting(false); }} placeholder='Workflow name…' className='w-full px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none' /><textarea value={newWorkflowGoal} onChange={event => setNewWorkflowGoal(event.target.value)} placeholder='Goal and acceptance criteria…' rows={2} className='w-full px-2 py-1 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none resize-none' /><div className='flex gap-1'><button type='button' onClick={handleStartWorkflow} disabled={!newWorkflowName.trim()} className='px-2 py-0.5 text-[10px] bg-amber-600 hover:bg-amber-500 text-white rounded disabled:opacity-40'>Start</button><button type='button' onClick={() => { setIsStarting(false); setNewWorkflowName(''); setNewWorkflowGoal(''); }} className='px-2 py-0.5 text-[10px] bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded'>Cancel</button></div></div>}
			</div>
		</div>
	);
};
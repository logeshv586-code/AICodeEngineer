/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { Bot, CheckCircle2, Loader2, XCircle, Circle, Zap, Shield, Code2, Search, Globe, MessageSquare, Bug, Wrench, Sparkles } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentChip {
	readonly id: string;
	readonly name: string;
	readonly role: string;
	readonly status: 'idle' | 'running' | 'completed' | 'failed';
	readonly task?: string;
	readonly progress?: number;
}

export interface AgentChipsProps {
	agents: AgentChip[];
	maxVisible?: number;
	className?: string;
	onAgentClick?: (agent: AgentChip) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const roleColors: Record<string, { bg: string; text: string; dot: string }> = {
	Brain: { bg: 'bg-amber-500/15', text: 'text-amber-400', dot: 'bg-amber-400' },
	Engineer: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400' },
	'CodeEngineer': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400' },
	RAG: { bg: 'bg-violet-500/15', text: 'text-violet-400', dot: 'bg-violet-400' },
	'RAGAgent': { bg: 'bg-violet-500/15', text: 'text-violet-400', dot: 'bg-violet-400' },
	Web: { bg: 'bg-blue-500/15', text: 'text-blue-400', dot: 'bg-blue-400' },
	Reviewer: { bg: 'bg-rose-500/15', text: 'text-rose-400', dot: 'bg-rose-400' },
	'ReviewAgent': { bg: 'bg-rose-500/15', text: 'text-rose-400', dot: 'bg-rose-400' },
	Tester: { bg: 'bg-orange-500/15', text: 'text-orange-400', dot: 'bg-orange-400' },
	Deploy: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', dot: 'bg-cyan-400' },
	UI: { bg: 'bg-pink-500/15', text: 'text-pink-400', dot: 'bg-pink-400' },
};

function getRoleIcon(role: string) {
	switch (role) {
		case 'Brain': return <Zap size={10} />;
		case 'Engineer':
		case 'CodeEngineer': return <Code2 size={10} />;
		case 'RAG':
		case 'RAGAgent': return <Search size={10} />;
		case 'Web': return <Globe size={10} />;
		case 'Reviewer':
		case 'ReviewAgent': return <Shield size={10} />;
		case 'Tester': return <Bug size={10} />;
		case 'Deploy': return <Wrench size={10} />;
		case 'UI': return <Sparkles size={10} />;
		default: return <Bot size={10} />;
	}
}

function getStatusIcon(status: string) {
	switch (status) {
		case 'running':
			return <Loader2 size={9} className='animate-spin text-blue-400' />;
		case 'completed':
			return <CheckCircle2 size={9} className='text-emerald-400' />;
		case 'failed':
			return <XCircle size={9} className='text-red-400' />;
		default:
			return <Circle size={9} className='text-zinc-600' />;
	}
}

// ─── Single Chip ──────────────────────────────────────────────────────────────

export const AgentChip: React.FC<{
	agent: AgentChip;
	onClick?: () => void;
	compact?: boolean;
}> = ({ agent, onClick, compact = false }) => {
	const color = roleColors[agent.role] || roleColors.Engineer;

	return (
		<button
			type='button'
			onClick={onClick}
			className={`
				inline-flex items-center gap-1.5 rounded-full border
				transition-colors cursor-pointer
				${color.bg} ${color.text} border-zinc-700/40
				hover:brightness-110
				${compact ? 'px-1.5 py-0.5' : 'px-2 py-1'}
			`}
			title={`${agent.name} (${agent.role}) — ${agent.status}${agent.task ? ': ' + agent.task : ''}`}
		>
			{/* Role icon */}
			<span className={`shrink-0 ${color.dot}`}>
				{getRoleIcon(agent.role)}
			</span>

			{/* Status dot */}
			{getStatusIcon(agent.status)}

			{/* Name */}
			{!compact && (
				<span className='text-[10px] font-medium truncate max-w-[80px]'>
					{agent.name}
				</span>
			)}

			{/* Progress bar for running agents */}
			{agent.status === 'running' && agent.progress !== undefined && (
				<div className='w-8 h-1 rounded-full bg-zinc-800/60 overflow-hidden'>
					<div
						className='h-full bg-emerald-400/60 transition-all'
						style={{ width: `${agent.progress}%` }}
					/>
				</div>
			)}
		</button>
	);
};

// ─── Agent Chips Container ────────────────────────────────────────────────────

export const AgentChips: React.FC<AgentChipsProps> = ({
	agents,
	maxVisible = 4,
	className = '',
	onAgentClick,
}) => {
	if (agents.length === 0) return null;

	const visible = agents.slice(0, maxVisible);
	const hidden = agents.slice(maxVisible);
	const running = agents.filter(a => a.status === 'running').length;

	return (
		<div className={`flex flex-wrap items-center gap-1 ${className}`}>
			{/* Running count badge */}
			{running > 0 && (
				<span className='text-[9px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full border border-blue-500/20'>
					{running} active
				</span>
			)}

			{/* Agent chips */}
			{visible.map(agent => (
				<AgentChip
					key={agent.id}
					agent={agent}
					onClick={() => onAgentClick?.(agent)}
					compact={agents.length > maxVisible}
				/>
			))}

			{/* Hidden agents count */}
			{hidden.length > 0 && (
				<span className='
					text-[9px] text-zinc-500 bg-zinc-800/40
					px-1.5 py-0.5 rounded-full border border-zinc-700/30
				'>
					+{hidden.length}
				</span>
			)}
		</div>
	);
};

// ─── Agent Status Bar (compact horizontal) ────────────────────────────────────

export const AgentStatusBar: React.FC<{
	agents: AgentChip[];
	className?: string;
}> = ({ agents, className = '' }) => {
	if (agents.length === 0) return null;

	const running = agents.filter(a => a.status === 'running');
	const completed = agents.filter(a => a.status === 'completed');
	const failed = agents.filter(a => a.status === 'failed');

	return (
		<div className={`flex items-center gap-2 ${className}`}>
			{/* Active agents */}
			{running.map(agent => (
				<div key={agent.id} className='flex items-center gap-1'>
					<Loader2 size={9} className='text-blue-400 animate-spin' />
					<span className='text-[10px] text-blue-400'>{agent.name}</span>
					{agent.task && (
						<span className='text-[9px] text-zinc-600 truncate max-w-[60px]'>
							{agent.task}
						</span>
					)}
				</div>
			))}

			{/* Separator */}
			{(running.length > 0 && (completed.length > 0 || failed.length > 0)) && (
				<span className='text-zinc-700'>|</span>
			)}

			{/* Completed */}
			{completed.length > 0 && (
				<span className='text-[10px] text-emerald-400'>
					{completed.length} done
				</span>
			)}

			{/* Failed */}
			{failed.length > 0 && (
				<span className='text-[10px] text-red-400'>
					{failed.length} failed
				</span>
			)}
		</div>
	);
};

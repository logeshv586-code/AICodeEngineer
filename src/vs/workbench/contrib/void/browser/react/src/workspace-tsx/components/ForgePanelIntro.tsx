/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { BookOpen, Brain, CheckCircle, HelpCircle, ListChecks, Settings, Sparkles, TrendingUp } from 'lucide-react';

export interface ForgePanelIntroProps {
	workspaceName: string;
	onEvolveProject: () => void;
	onEvolveSkills: () => void;
	onCommand: (command: string) => void;
}

const Capability: React.FC<{
	icon: React.ReactNode;
	title: string;
	description: string;
	onClick: () => void;
}> = ({ icon, title, description, onClick }) => (
	<button type='button' className='forge-panel-capability' onClick={onClick}>
		<span className='forge-panel-capability-icon' aria-hidden='true'>{icon}</span>
		<span className='forge-panel-capability-copy'>
			<span className='forge-panel-capability-title'>{title}</span>
			<span className='forge-panel-capability-description'>{description}</span>
		</span>
	</button>
);

const commands = [
	{ command: '/work', label: 'Work Mode', description: 'Inspect Work Mode or create an automation from natural language', icon: ListChecks },
	{ command: '/work-pending', label: 'Pending Work', description: 'Show queued agent work and approval-gated commands', icon: CheckCircle },
	{ command: '/work-approve', label: 'Approve Work Command', description: 'Approve one queued command by pending id', icon: CheckCircle },
	{ command: '/memory,show', label: 'Show Memory', description: 'Inspect relevant workspace memory', icon: Brain },
	{ command: '/memory,save', label: 'Save Memory', description: 'Save durable workspace findings', icon: Brain },
	{ command: '/workspace,index', label: 'Refresh Code Index', description: 'Refresh the local semantic code index', icon: Sparkles },
	{ command: '/skill', label: 'Search Skills', description: 'Search the skill registry locally', icon: BookOpen },
	{ command: '/skills', label: 'List Skills', description: 'Show registry and workspace skill status', icon: BookOpen },
	{ command: '/models', label: 'Select Model', description: 'Open Forge provider and model settings', icon: Sparkles },
	{ command: '/settings', label: 'Settings', description: 'Open Forge settings', icon: Settings },
	{ command: '/help', label: 'Help', description: 'Show core Forge command groups', icon: HelpCircle },
] as const;

export const ForgePanelIntro: React.FC<ForgePanelIntroProps> = ({ workspaceName, onEvolveProject, onEvolveSkills, onCommand }) => (
	<section className='forge-panel-intro' aria-label='Forge AI project capabilities'>
		<div className='forge-panel-hero'>
			<h1 className='forge-panel-title'>Forge AI</h1>
			<p className='forge-panel-subtitle'>Your AI coding partner</p>
			<p className='forge-panel-workspace' title={workspaceName}>Working with <strong>{workspaceName}</strong></p>
		</div>

		<div className='forge-panel-capabilities'>
			<Capability
				icon={<Sparkles size={16} />}
				title='Self-evolving agents'
				description='Agents adapt to the current code, architecture, patterns, and verified outcomes.'
				onClick={onEvolveProject}
			/>
			<Capability
				icon={<TrendingUp size={16} />}
				title='Project can improve over time'
				description='Forge can apply safe task-related improvements and surface the next useful upgrade.'
				onClick={onEvolveProject}
			/>
			<Capability
				icon={<BookOpen size={16} />}
				title='Skills updated from current workspace'
				description='Project-local skills evolve from proven libraries, scripts, conventions, and workflows.'
				onClick={onEvolveSkills}
			/>
		</div>

		<div className='forge-panel-command-list' aria-label='Forge commands'>
			{commands.map(({ command, label, description, icon: Icon }, index) => (
				<button key={command} type='button' className={`forge-panel-command ${index === 0 ? 'forge-panel-command-active' : ''}`} onClick={() => onCommand(command)}>
					<span className='forge-panel-command-icon' aria-hidden='true'><Icon size={15} /></span>
					<span className='forge-panel-command-copy'><span>{label}</span><small>{description}</small></span>
					<code>{command}</code>
				</button>
			))}
		</div>
	</section>
);

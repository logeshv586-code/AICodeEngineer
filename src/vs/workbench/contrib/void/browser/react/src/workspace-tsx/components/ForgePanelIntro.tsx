/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { BookOpen, Sparkles, TrendingUp } from 'lucide-react';

export interface ForgePanelIntroProps {
	workspaceName: string;
	onEvolveProject: () => void;
	onEvolveSkills: () => void;
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

export const ForgePanelIntro: React.FC<ForgePanelIntroProps> = ({ workspaceName, onEvolveProject, onEvolveSkills }) => (
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

		<div className='forge-panel-command-hint'>
			<span className='forge-panel-command-key'>/</span>
			<span>Type <strong>/</strong> in the composer for Work Mode, memory, indexing, skills, models, settings and more.</span>
		</div>
	</section>
);

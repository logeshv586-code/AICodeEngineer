/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { PlannerOutput } from '../../../../common/forge/planner/planSchema.js';

export const StatusBar: React.FC<{ plan: PlannerOutput | null; activeEventCount: number }> = ({ plan, activeEventCount }) => {
	const completedSteps = plan ? plan.steps.filter(s => s.status === 'completed').length : 0;
	const totalSteps = plan ? plan.steps.length : 0;

	return (
		<div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-t border-zinc-800 text-[11px] text-zinc-400 font-sans">
			<div className="flex items-center space-x-3">
				<span className="flex items-center space-x-1">
					<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
					<span className="font-medium text-zinc-300">Forge Brain</span>
				</span>
				{plan && (
					<span>Progress: {completedSteps}/{totalSteps} steps</span>
				)}
			</div>
			<div className="flex items-center space-x-3">
				<span>Events: {activeEventCount}</span>
				{plan && (
					<span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">
						{plan.estimatedRisk.toUpperCase()} RISK
					</span>
				)}
			</div>
		</div>
	);
};

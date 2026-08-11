/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { PlannerOutput } from '../../../../common/forge/planner/planSchema.js';

export const PlanView: React.FC<{ plan: PlannerOutput | null }> = ({ plan }) => {
	if (!plan) {
		return <div className="p-4 text-gray-400 text-sm">No active plan generated yet.</div>;
	}

	return (
		<div className="p-4 bg-zinc-900 rounded border border-zinc-800 text-white font-sans">
			<div className="flex items-center justify-between mb-2">
				<h3 className="font-semibold text-base text-blue-400">Plan: {plan.goal}</h3>
				<span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
					Risk: {plan.estimatedRisk.toUpperCase()}
				</span>
			</div>
			<p className="text-xs text-zinc-400 mb-4">{plan.summary}</p>
			<div className="space-y-3">
				{plan.steps.map((step) => (
					<div key={step.id} className="p-3 bg-zinc-950 rounded border border-zinc-800 flex items-start justify-between">
						<div>
							<div className="flex items-center space-x-2">
								<span className="text-xs font-mono text-zinc-500">#{step.id}</span>
								<span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 font-medium">{step.stage}</span>
								<h4 className="text-sm font-medium text-zinc-200">{step.title}</h4>
							</div>
							<p className="text-xs text-zinc-400 mt-1">{step.description}</p>
						</div>
						<span className={`text-xs px-2 py-0.5 rounded ${
							step.status === 'completed' ? 'bg-green-900/40 text-green-300' :
							step.status === 'in_progress' ? 'bg-amber-900/40 text-amber-300 animate-pulse' :
							'bg-zinc-800 text-zinc-400'
						}`}>
							{step.status}
						</span>
					</div>
				))}
			</div>
		</div>
	);
};

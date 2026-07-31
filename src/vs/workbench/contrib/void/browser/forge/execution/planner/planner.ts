/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ExecutionPlan } from './executionPlan.js';
import { ExecutionBus } from '../bus/executionBus.js';

export class ExecutionPlanner {
	constructor(
		private readonly bus: ExecutionBus = ExecutionBus.getInstance()
	) { }

	async createPlan(userGoal: string): Promise<ExecutionPlan> {
		const plan: ExecutionPlan = {
			id: `plan-${Math.random().toString(36).substring(2, 7)}`,
			goal: userGoal,
			rawSteps: [
				{
					id: 'step-1',
					title: `Inspect workspace for: ${userGoal}`,
					category: 'workspace',
					dependsOn: [],
					isParallelSafe: true,
					estimatedCostUnits: 10
				},
				{
					id: 'step-2',
					title: `Search web documentation for: ${userGoal}`,
					category: 'browser',
					dependsOn: [],
					isParallelSafe: true,
					estimatedCostUnits: 15
				},
				{
					id: 'step-3',
					title: `Apply code edits for: ${userGoal}`,
					category: 'workspace',
					dependsOn: ['step-1', 'step-2'],
					isParallelSafe: false,
					estimatedCostUnits: 30
				},
				{
					id: 'step-4',
					title: 'Execute test suite and verify build',
					category: 'testing',
					dependsOn: ['step-3'],
					isParallelSafe: false,
					estimatedCostUnits: 20
				},
				{
					id: 'step-5',
					title: 'Run review pipeline and approval gate',
					category: 'review',
					dependsOn: ['step-3', 'step-4'],
					isParallelSafe: false,
					estimatedCostUnits: 10
				}
			],
			estimatedTotalCost: 85,
			createdAt: Date.now()
		};

		this.bus.publish('PLAN_CREATED', { plan });
		return plan;
	}
}

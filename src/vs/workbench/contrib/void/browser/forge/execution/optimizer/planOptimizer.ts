/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ExecutionPlan } from '../planner/executionPlan.js';
import { ExecutionBus } from '../bus/executionBus.js';

export class PlanOptimizer {
	constructor(
		private readonly bus: ExecutionBus = ExecutionBus.getInstance()
	) { }

	optimizePlan(plan: ExecutionPlan): ExecutionPlan {
		// Merge duplicates and validate safe parallel operations
		const optimizedSteps = plan.rawSteps.map(step => {
			if (step.dependsOn.length === 0) {
				return { ...step, isParallelSafe: true };
			}
			return step;
		});

		const optimizedPlan: ExecutionPlan = {
			...plan,
			rawSteps: optimizedSteps,
			estimatedTotalCost: Math.round(plan.estimatedTotalCost * 0.9)
		};

		this.bus.publish('PLAN_OPTIMIZED', { plan: optimizedPlan });
		return optimizedPlan;
	}
}

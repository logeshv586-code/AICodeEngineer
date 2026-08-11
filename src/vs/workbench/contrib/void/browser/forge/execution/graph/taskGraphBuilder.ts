/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ExecutionPlan } from '../planner/executionPlan.js';
import { TaskGraph } from './taskGraph.js';
import { GraphValidator } from './graphValidator.js';
import { ExecutionBus } from '../bus/executionBus.js';

export class TaskGraphBuilder {
	private readonly validator = new GraphValidator();

	constructor(
		private readonly bus: ExecutionBus = ExecutionBus.getInstance()
	) { }

	buildGraph(plan: ExecutionPlan): TaskGraph {
		const graph = new TaskGraph();

		for (const step of plan.rawSteps) {
			graph.addNode({
				id: step.id,
				title: step.title,
				category: step.category,
				dependsOn: step.dependsOn,
				isParallelSafe: step.isParallelSafe,
				status: 'pending'
			});
		}

		const validation = this.validator.validate(graph);
		if (!validation.isValid) {
			throw new Error(`TaskGraph construction failed: ${validation.error}`);
		}

		this.bus.publish('GRAPH_BUILT', { graph });
		return graph;
	}
}

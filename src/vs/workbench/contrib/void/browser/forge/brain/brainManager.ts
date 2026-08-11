/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { DependencyGraph } from './dependencyGraph.js';
import { ExecutionScheduler } from './executionScheduler.js';
import { ForgeEventBus } from '../events/forgeEventBus.js';
import { ForgePlannerService } from '../planner/plannerService.js';
import { TaskDependencyNode } from '../../../common/forge/types/schedulerTypes.js';
import { PlannerOutput } from '../../../common/forge/planner/planSchema.js';

export class BrainManager {
	private static instance?: BrainManager;
	private readonly scheduler = new ExecutionScheduler();

	private constructor(
		private readonly planner: ForgePlannerService = new ForgePlannerService(),
		private readonly eventBus: ForgeEventBus = ForgeEventBus.getInstance()
	) { }

	public static getInstance(): BrainManager {
		if (!this.instance) {
			this.instance = new BrainManager();
		}
		return this.instance;
	}

	async handleUserQuery(
		userQuery: string,
		workerResolver: (node: TaskDependencyNode, token?: CancellationToken) => Promise<any>,
		token?: CancellationToken
	): Promise<PlannerOutput> {
		// 1. Generate plan with dependency graph
		const plan = await this.planner.createPlan(userQuery, token);
		this.eventBus.publish('PLAN_CREATED', { plan });

		// 2. Construct DAG
		const graph = new DependencyGraph();
		if (plan.dependencyGraph?.nodes) {
			for (const node of plan.dependencyGraph.nodes) {
				graph.addNode(node);
			}
		} else {
			// Fallback: convert plan.steps to linear nodes
			plan.steps.forEach(step => {
				graph.addNode({
					id: `step-${step.id}`,
					title: step.title,
					description: step.description,
					assignedAgentRole: step.stage === 'Discovery' ? 'RAGAgent' :
						step.stage === 'Review' ? 'ReviewAgent' :
							step.stage === 'Test' ? 'TestAgent' : 'CodeEngineer',
					dependsOn: step.dependsOnStepIds ? step.dependsOnStepIds.map(i => `step-${i}`) : (step.id > 1 ? [`step-${step.id - 1}`] : []),
					canRunInParallel: step.stage === 'Discovery'
				});
			});
		}

		this.eventBus.publish('GRAPH_BUILT', { nodes: graph.getAllNodes() });

		// 3. Dispatch parallel/sequential execution
		await this.scheduler.executeGraph(graph, workerResolver, token);

		this.eventBus.publish('RUN_COMPLETED', { taskId: userQuery, summary: plan.summary });
		return plan;
	}
}

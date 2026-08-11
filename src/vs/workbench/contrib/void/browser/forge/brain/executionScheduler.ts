/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { DependencyGraph } from './dependencyGraph.js';
import { ForgeEventBus } from '../events/forgeEventBus.js';
import { TaskDependencyNode } from '../../../common/forge/types/schedulerTypes.js';

export interface TaskWorkerResolver {
	(node: TaskDependencyNode, token?: CancellationToken): Promise<any>;
}

export class ExecutionScheduler {
	constructor(
		private readonly eventBus: ForgeEventBus = ForgeEventBus.getInstance()
	) { }

	async executeGraph(
		graph: DependencyGraph,
		workerResolver: TaskWorkerResolver,
		token?: CancellationToken
	): Promise<void> {
		if (graph.detectCycles()) {
			throw new Error('DependencyGraph contains a cycle; execution aborted.');
		}

		while (!graph.isFinished()) {
			if (token?.isCancellationRequested) {
				throw new Error('Execution cancelled by user token.');
			}

			const readyNodes = graph.getReadyNodes();
			if (readyNodes.length === 0) {
				if (graph.hasFailed()) {
					throw new Error('Execution halted due to dependency failure.');
				}
				// Small tick delay to avoid busy loop
				await new Promise(r => setTimeout(r, 50));
				continue;
			}

			this.eventBus.publish('SCHEDULER_TICK', {
				activeCount: readyNodes.length,
				remainingCount: graph.getAllNodes().length
			});

			// Execute ready nodes in parallel using Promise.all
			await Promise.all(
				readyNodes.map(async (node) => {
					graph.markRunning(node.id);
					this.eventBus.publish('TASK_RUNNING', { taskId: node.id, title: node.title });
					try {
						await workerResolver(node, token);
						graph.markCompleted(node.id);
						this.eventBus.publish('TASK_COMPLETED', { taskId: node.id, title: node.title });
					} catch (e: any) {
						graph.markFailed(node.id);
						this.eventBus.publish('TASK_FAILED', { taskId: node.id, error: e?.message || 'Task failed' });
					}
				})
			);
		}
	}
}

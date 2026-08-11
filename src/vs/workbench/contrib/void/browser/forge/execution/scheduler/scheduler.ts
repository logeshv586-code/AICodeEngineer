/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../../../base/common/cancellation.js';
import { TaskGraph } from '../graph/taskGraph.js';
import { ResourceManager } from './resourceManager.js';
import { WorkerManager } from '../workers/workerManager.js';
import { ExecutionBus } from '../bus/executionBus.js';
import { ArtifactStore } from '../artifacts/artifactStore.js';
import { PolicyEngine } from '../policies/policies.js';

export class ExecutionScheduler {
	private readonly resourceManager = new ResourceManager();
	private readonly workerManager = new WorkerManager();
	private readonly artifactStore = ArtifactStore.getInstance();
	private readonly policyEngine = new PolicyEngine();

	constructor(
		private readonly bus: ExecutionBus = ExecutionBus.getInstance()
	) { }

	async runGraph(graph: TaskGraph, token?: CancellationToken): Promise<void> {
		while (!graph.isFinished()) {
			if (token?.isCancellationRequested) {
				throw new Error('Execution cancelled by token');
			}

			const readyNodes = graph.getReadyNodes();
			if (readyNodes.length === 0) {
				if (graph.hasFailed()) {
					throw new Error('Execution halted due to failed task node');
				}
				await new Promise(r => setTimeout(r, 50));
				continue;
			}

			await Promise.all(
				readyNodes.map(async (node) => {
					graph.updateStatus(node.id, 'running');
					this.bus.publish('TASK_STARTED', { taskId: node.id, title: node.title });

					const lease = this.resourceManager.acquire(node.category);
					const worker = this.workerManager.getWorker(node.category);

					let attempt = 0;
					let success = false;
					let lastError: string | undefined;

					while (attempt < this.policyEngine.getConfig().maxRetries && !success) {
						attempt++;
						try {
							const result = await worker.executeTask({
								taskId: node.id,
								title: node.title,
								category: node.category
							}, token);

							if (result.success) {
								success = true;
								// Save execution artifact if output present
								const artifact = this.artifactStore.saveArtifact({
									taskId: node.id,
									type: 'report',
									name: `${node.title} Artifact`,
									content: result.data
								});

								graph.updateStatus(node.id, 'completed', result.data, artifact.id);
								this.bus.publish('TASK_COMPLETED', { taskId: node.id, artifactId: artifact.id });
							} else {
								lastError = result.error || 'Worker execution failed';
							}
						} catch (e: any) {
							lastError = e?.message || 'Worker crash';
						}

						if (!success && this.policyEngine.shouldRetry(attempt)) {
							await new Promise(r => setTimeout(r, this.policyEngine.calculateBackoffMs(attempt)));
						}
					}

					if (!success) {
						graph.updateStatus(node.id, 'failed', undefined, undefined, lastError);
						this.bus.publish('TASK_FAILED', { taskId: node.id, error: lastError });
					}

					if (lease) this.resourceManager.release(lease);
					this.workerManager.releaseWorker(node.category, worker.id);
				})
			);
		}

		this.bus.publish('EXECUTION_FINISHED', { success: !graph.hasFailed() });
	}
}

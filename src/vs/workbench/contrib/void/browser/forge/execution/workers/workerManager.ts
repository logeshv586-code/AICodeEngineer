/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IForgeWorker, WorkerTaskInput, WorkerTaskOutput } from './workerTypes.js';
import { CancellationToken } from '../../../../../../../base/common/cancellation.js';
import { ExecutionBus } from '../bus/executionBus.js';

class WorkspaceWorker implements IForgeWorker {
	readonly id = 'worker-workspace-1';
	readonly name = 'Workspace Worker';
	readonly category = 'workspace';

	async executeTask(input: WorkerTaskInput, _token?: CancellationToken): Promise<WorkerTaskOutput> {
		return { success: true, data: { action: 'workspace_task_executed', title: input.title } };
	}
}

class BrowserWorker implements IForgeWorker {
	readonly id = 'worker-browser-1';
	readonly name = 'Browser Worker';
	readonly category = 'browser';

	async executeTask(input: WorkerTaskInput, _token?: CancellationToken): Promise<WorkerTaskOutput> {
		return { success: true, data: { action: 'browser_task_executed', title: input.title } };
	}
}

class TestingWorker implements IForgeWorker {
	readonly id = 'worker-testing-1';
	readonly name = 'Testing Worker';
	readonly category = 'testing';

	async executeTask(input: WorkerTaskInput, _token?: CancellationToken): Promise<WorkerTaskOutput> {
		return { success: true, data: { action: 'tests_executed', passed: true } };
	}
}

class ReviewWorker implements IForgeWorker {
	readonly id = 'worker-review-1';
	readonly name = 'Review Worker';
	readonly category = 'review';

	async executeTask(input: WorkerTaskInput, _token?: CancellationToken): Promise<WorkerTaskOutput> {
		return { success: true, data: { action: 'diff_reviewed', approved: true } };
	}
}

export class WorkerManager {
	private readonly workers = new Map<string, IForgeWorker>([
		['workspace', new WorkspaceWorker()],
		['browser', new BrowserWorker()],
		['testing', new TestingWorker()],
		['review', new ReviewWorker()]
	]);

	constructor(
		private readonly bus: ExecutionBus = ExecutionBus.getInstance()
	) { }

	getWorker(category: string): IForgeWorker {
		const worker = this.workers.get(category) || this.workers.get('workspace')!;
		this.bus.publish('WORKER_ASSIGNED', { workerId: worker.id, category });
		return worker;
	}

	releaseWorker(category: string, workerId: string): void {
		this.bus.publish('WORKER_RELEASED', { workerId, category });
	}
}

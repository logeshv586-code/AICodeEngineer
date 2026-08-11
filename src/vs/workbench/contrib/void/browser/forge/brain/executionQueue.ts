/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { TaskDependencyNode, ExecutionSlot } from '../../../common/forge/types/schedulerTypes.js';

export class ExecutionQueue {
	private readonly pending: TaskDependencyNode[] = [];
	private readonly slots = new Map<string, ExecutionSlot>();

	enqueue(node: TaskDependencyNode): void {
		this.pending.push(node);
		this.slots.set(node.id, {
			taskId: node.id,
			agentRole: node.assignedAgentRole,
			status: 'pending'
		});
	}

	dequeue(): TaskDependencyNode | undefined {
		const node = this.pending.shift();
		if (node) {
			this.slots.set(node.id, {
				...this.slots.get(node.id)!,
				status: 'running',
				startTime: Date.now()
			});
		}
		return node;
	}

	complete(id: string): void {
		const slot = this.slots.get(id);
		if (slot) {
			this.slots.set(id, { ...slot, status: 'completed', endTime: Date.now() });
		}
	}

	fail(id: string, error: string): void {
		const slot = this.slots.get(id);
		if (slot) {
			this.slots.set(id, { ...slot, status: 'failed', endTime: Date.now(), error });
		}
	}

	getPendingCount(): number {
		return this.pending.length;
	}

	getSlot(id: string): ExecutionSlot | undefined {
		return this.slots.get(id);
	}
}

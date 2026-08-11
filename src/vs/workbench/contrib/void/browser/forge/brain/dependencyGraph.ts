/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { TaskDependencyNode } from '../../../common/forge/types/schedulerTypes.js';

export class DependencyGraph {
	private readonly nodes = new Map<string, TaskDependencyNode>();
	private readonly completed = new Set<string>();
	private readonly running = new Set<string>();
	private readonly failed = new Set<string>();

	addNode(node: TaskDependencyNode): void {
		this.nodes.set(node.id, node);
	}

	getNode(id: string): TaskDependencyNode | undefined {
		return this.nodes.get(id);
	}

	getAllNodes(): TaskDependencyNode[] {
		return Array.from(this.nodes.values());
	}

	getReadyNodes(): TaskDependencyNode[] {
		const ready: TaskDependencyNode[] = [];
		for (const node of this.nodes.values()) {
			if (this.completed.has(node.id) || this.running.has(node.id) || this.failed.has(node.id)) {
				continue;
			}
			const allDepsSatisfied = node.dependsOn.every(depId => this.completed.has(depId));
			if (allDepsSatisfied) {
				ready.push(node);
			}
		}
		return ready;
	}

	markRunning(id: string): void {
		this.running.add(id);
	}

	markCompleted(id: string): void {
		this.running.delete(id);
		this.completed.add(id);
	}

	markFailed(id: string): void {
		this.running.delete(id);
		this.failed.add(id);
	}

	isFinished(): boolean {
		return this.completed.size + this.failed.size >= this.nodes.size;
	}

	hasFailed(): boolean {
		return this.failed.size > 0;
	}

	detectCycles(): boolean {
		const visited = new Set<string>();
		const inStack = new Set<string>();

		const dfs = (id: string): boolean => {
			visited.add(id);
			inStack.add(id);

			const node = this.nodes.get(id);
			if (node) {
				for (const depId of node.dependsOn) {
					if (!visited.has(depId)) {
						if (dfs(depId)) return true;
					} else if (inStack.has(depId)) {
						return true;
					}
				}
			}

			inStack.delete(id);
			return false;
		};

		for (const id of this.nodes.keys()) {
			if (!visited.has(id)) {
				if (dfs(id)) return true;
			}
		}
		return false;
	}
}

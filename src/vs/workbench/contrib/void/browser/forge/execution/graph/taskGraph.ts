/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface GraphTaskNode {
	readonly id: string;
	readonly title: string;
	readonly category: 'workspace' | 'browser' | 'github' | 'terminal' | 'review' | 'testing';
	readonly dependsOn: string[];
	readonly isParallelSafe: boolean;
	status: 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'cancelled';
	readonly resultData?: any;
	readonly artifactId?: string;
	readonly error?: string;
}

export class TaskGraph {
	private readonly nodes = new Map<string, GraphTaskNode>();

	addNode(node: GraphTaskNode): void {
		this.nodes.set(node.id, node);
	}

	getNode(id: string): GraphTaskNode | undefined {
		return this.nodes.get(id);
	}

	getAllNodes(): GraphTaskNode[] {
		return Array.from(this.nodes.values());
	}

	getReadyNodes(): GraphTaskNode[] {
		const ready: GraphTaskNode[] = [];
		for (const node of this.nodes.values()) {
			if (node.status !== 'pending') continue;
			const allDepsCompleted = node.dependsOn.every(depId => {
				const depNode = this.nodes.get(depId);
				return depNode && depNode.status === 'completed';
			});
			if (allDepsCompleted) {
				ready.push(node);
			}
		}
		return ready;
	}

	updateStatus(id: string, status: GraphTaskNode['status'], data?: any, artifactId?: string, error?: string): void {
		const node = this.nodes.get(id);
		if (node) {
			node.status = status;
			if (data !== undefined) (node as any).resultData = data;
			if (artifactId !== undefined) (node as any).artifactId = artifactId;
			if (error !== undefined) (node as any).error = error;
		}
	}

	isFinished(): boolean {
		return Array.from(this.nodes.values()).every(n => n.status === 'completed' || n.status === 'failed' || n.status === 'cancelled');
	}

	hasFailed(): boolean {
		return Array.from(this.nodes.values()).some(n => n.status === 'failed');
	}
}

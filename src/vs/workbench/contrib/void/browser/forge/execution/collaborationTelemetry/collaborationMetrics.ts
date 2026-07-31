/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface AgentUtilizationMetric {
	readonly agentId: string;
	readonly tasksCompleted: number;
	readonly activeTimeMs: number;
}

export class CollaborationMetricsTracker {
	private readonly metrics = new Map<string, AgentUtilizationMetric>();

	recordTaskCompletion(agentId: string, durationMs: number): void {
		const current = this.metrics.get(agentId) || { agentId, tasksCompleted: 0, activeTimeMs: 0 };
		this.metrics.set(agentId, {
			agentId,
			tasksCompleted: current.tasksCompleted + 1,
			activeTimeMs: current.activeTimeMs + durationMs
		});
	}

	getAllMetrics(): AgentUtilizationMetric[] {
		return Array.from(this.metrics.values());
	}
}

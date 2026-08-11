/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { AgentRole } from './brainTypes.js';

export type SchedulerMode = 'sequential' | 'parallel' | 'dependent';

export interface TaskDependencyNode {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly assignedAgentRole: AgentRole;
	readonly dependsOn: string[];
	readonly canRunInParallel: boolean;
	readonly params?: Record<string, any>;
}

export interface DependencyEdge {
	readonly fromId: string;
	readonly toId: string;
}

export interface ExecutionSlot {
	readonly taskId: string;
	readonly agentRole: AgentRole;
	readonly status: 'pending' | 'running' | 'completed' | 'failed';
	readonly startTime?: number;
	readonly endTime?: number;
	readonly error?: string;
}

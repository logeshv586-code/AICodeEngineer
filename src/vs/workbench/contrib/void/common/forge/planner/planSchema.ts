/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ForgeAgentStage } from '../types/brainTypes.js';
import { TaskDependencyNode } from '../types/schedulerTypes.js';

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface ToolInvocationSpec {
	readonly toolName: string;
	readonly params: Record<string, any>;
}

export interface PlanStep {
	readonly id: number;
	readonly stage: ForgeAgentStage;
	readonly title: string;
	readonly description: string;
	readonly status: StepStatus;
	readonly toolCalls?: ToolInvocationSpec[];
	readonly error?: string;
	readonly dependsOnStepIds?: number[];
}

export interface DependencyGraphSpec {
	readonly nodes: TaskDependencyNode[];
}

export interface PlannerOutput {
	readonly goal: string;
	readonly summary: string;
	readonly steps: PlanStep[];
	readonly dependencyGraph?: DependencyGraphSpec;
	readonly estimatedRisk: 'low' | 'medium' | 'high';
}

/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface RawPlanStep {
	readonly id: string;
	readonly title: string;
	readonly category: 'workspace' | 'browser' | 'github' | 'terminal' | 'review' | 'testing';
	readonly dependsOn: string[];
	readonly isParallelSafe: boolean;
	readonly estimatedCostUnits: number;
}

export interface ExecutionPlan {
	readonly id: string;
	readonly goal: string;
	readonly rawSteps: RawPlanStep[];
	readonly estimatedTotalCost: number;
	readonly createdAt: number;
}

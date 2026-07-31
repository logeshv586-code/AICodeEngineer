/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface DelegationRequest {
	readonly taskId: string;
	readonly requiredRole: 'workspace' | 'browser' | 'review' | 'security' | 'testing';
	readonly title: string;
}

export interface DelegationMatch {
	readonly agentId: string;
	readonly agentName: string;
	readonly matchScore: number;
}

export interface ProgressSnapshot {
	readonly overallProgressPct: number;
	readonly activeAgentsCount: number;
	readonly completedTasksCount: number;
	readonly totalTasksCount: number;
}

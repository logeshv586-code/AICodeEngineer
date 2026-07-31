/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type ExecutionEventType =
	| 'PLAN_CREATED'
	| 'PLAN_OPTIMIZED'
	| 'GRAPH_BUILT'
	| 'TASK_CREATED'
	| 'TASK_READY'
	| 'TASK_STARTED'
	| 'TASK_PROGRESS'
	| 'TASK_COMPLETED'
	| 'TASK_FAILED'
	| 'TASK_CANCELLED'
	| 'WORKER_ASSIGNED'
	| 'WORKER_RELEASED'
	| 'REVIEW_REQUIRED'
	| 'REVIEW_APPROVED'
	| 'REVIEW_REJECTED'
	| 'CHECKPOINT_SAVED'
	| 'EXECUTION_FINISHED';

export interface ExecutionEvent<T = any> {
	readonly id: string;
	readonly type: ExecutionEventType;
	readonly timestamp: number;
	readonly payload: T;
}

/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../../../base/common/cancellation.js';

export interface WorkerTaskInput {
	readonly taskId: string;
	readonly title: string;
	readonly category: string;
	readonly params?: Record<string, any>;
}

export interface WorkerTaskOutput {
	readonly success: boolean;
	readonly data?: any;
	readonly artifactId?: string;
	readonly error?: string;
}

export interface IForgeWorker {
	readonly id: string;
	readonly name: string;
	readonly category: string;
	executeTask(input: WorkerTaskInput, token?: CancellationToken): Promise<WorkerTaskOutput>;
}

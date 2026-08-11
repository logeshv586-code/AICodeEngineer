/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface PolicyConfig {
	readonly maxRetries: number;
	readonly timeoutMs: number;
	readonly requireApprovalForHighRisk: boolean;
	readonly autoCheckpointOnComplete: boolean;
}

export class PolicyEngine {
	private readonly defaultConfig: PolicyConfig = {
		maxRetries: 3,
		timeoutMs: 30000,
		requireApprovalForHighRisk: true,
		autoCheckpointOnComplete: true
	};

	getConfig(): PolicyConfig {
		return this.defaultConfig;
	}

	shouldRetry(attemptCount: number): boolean {
		return attemptCount < this.defaultConfig.maxRetries;
	}

	calculateBackoffMs(attemptCount: number): number {
		return Math.min(5000, 500 * Math.pow(2, attemptCount));
	}
}

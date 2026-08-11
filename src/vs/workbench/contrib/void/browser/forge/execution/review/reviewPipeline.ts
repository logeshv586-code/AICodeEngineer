/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ExecutionBus } from '../bus/executionBus.js';

export interface ReviewResult {
	readonly approved: boolean;
	readonly riskLevel: 'low' | 'medium' | 'high';
	readonly issues: string[];
}

export class ReviewPipeline {
	constructor(
		private readonly bus: ExecutionBus = ExecutionBus.getInstance()
	) { }

	async runReview(taskId: string, diff: string): Promise<ReviewResult> {
		this.bus.publish('REVIEW_REQUIRED', { taskId, diff });

		// Perform static checks
		const issues: string[] = [];
		if (diff.includes('console.log')) {
			issues.push('Contains leftover console.log statement');
		}

		const riskLevel = diff.length > 500 ? 'medium' : 'low';
		const approved = issues.length === 0;

		if (approved) {
			this.bus.publish('REVIEW_APPROVED', { taskId });
		} else {
			this.bus.publish('REVIEW_REJECTED', { taskId, issues });
		}

		return { approved, riskLevel, issues };
	}
}

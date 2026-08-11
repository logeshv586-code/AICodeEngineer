/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Vote } from './votingStrategies.js';

export class ConfidenceAggregator {
	aggregateConfidence(votes: Vote[]): number {
		if (votes.length === 0) return 0;
		const sum = votes.reduce((s, v) => s + v.confidence, 0);
		return parseFloat((sum / votes.length).toFixed(2));
	}
}

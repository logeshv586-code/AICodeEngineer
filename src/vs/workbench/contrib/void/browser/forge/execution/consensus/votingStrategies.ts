/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type VotingStrategy = 'Unanimous' | 'Majority' | 'WeightedConfidence' | 'DesignatedAuthority';

export interface Vote {
	readonly agentId: string;
	readonly approved: boolean;
	readonly confidence: number; // 0.0 to 1.0
	readonly reason?: string;
}

export class VotingPolicyEvaluator {
	evaluate(votes: Vote[], strategy: VotingStrategy): boolean {
		if (votes.length === 0) return false;

		switch (strategy) {
			case 'Unanimous':
				return votes.every(v => v.approved);

			case 'Majority': {
				const approvedCount = votes.filter(v => v.approved).length;
				return approvedCount > votes.length / 2;
			}

			case 'WeightedConfidence': {
				const totalScore = votes.reduce((sum, v) => sum + (v.approved ? v.confidence : -v.confidence), 0);
				return totalScore > 0;
			}

			case 'DesignatedAuthority': {
				// First vote is authority
				return votes[0]?.approved || false;
			}
		}
	}
}

/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Vote, VotingStrategy, VotingPolicyEvaluator } from './votingStrategies.js';
import { ConfidenceAggregator } from './confidenceAggregator.js';
import { ExecutionBus } from '../bus/executionBus.js';

export interface ConsensusDecision {
	readonly topic: string;
	readonly approved: boolean;
	readonly averageConfidence: number;
	readonly votes: Vote[];
	readonly strategyUsed: VotingStrategy;
}

export class ConsensusEngine {
	private readonly evaluator = new VotingPolicyEvaluator();
	private readonly aggregator = new ConfidenceAggregator();

	constructor(
		private readonly bus: ExecutionBus = ExecutionBus.getInstance()
	) { }

	requestConsensus(topic: string, votes: Vote[], strategy: VotingStrategy = 'Majority'): ConsensusDecision {
		const approved = this.evaluator.evaluate(votes, strategy);
		const averageConfidence = this.aggregator.aggregateConfidence(votes);

		const decision: ConsensusDecision = {
			topic,
			approved,
			averageConfidence,
			votes,
			strategyUsed: strategy
		};

		if (approved) {
			this.bus.publish('REVIEW_APPROVED', { topic, decision });
		} else {
			this.bus.publish('REVIEW_REJECTED', { topic, decision });
		}

		return decision;
	}
}

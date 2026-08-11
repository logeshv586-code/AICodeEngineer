/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { TokenBudgetAllocation } from '../../../common/forge/types/tokenCompressionTypes.js';

export class TokenBudgetManager {
	private readonly allocation: TokenBudgetAllocation;

	constructor(maxTokens = 4000) {
		this.allocation = {
			totalMaxTokens: maxTokens,
			systemPromptTokens: Math.round(maxTokens * 0.10),
			workspaceTokens: Math.round(maxTokens * 0.30),
			knowledgeTokens: Math.round(maxTokens * 0.20),
			gitHubTokens: Math.round(maxTokens * 0.15),
			browserTokens: Math.round(maxTokens * 0.15),
			memoryTokens: Math.round(maxTokens * 0.10)
		};
	}

	getAllocation(): TokenBudgetAllocation {
		return this.allocation;
	}

	estimateTokens(text: string): number {
		if (!text) return 0;
		// Standard heuristic: ~4 characters per token
		return Math.ceil(text.length / 4);
	}

	truncateToBudget(text: string, allowedTokens: number): string {
		const est = this.estimateTokens(text);
		if (est <= allowedTokens) return text;

		const allowedChars = allowedTokens * 4;
		return text.slice(0, allowedChars) + '\n...[content truncated to fit token budget]';
	}
}

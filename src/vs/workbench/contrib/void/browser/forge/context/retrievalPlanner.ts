/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IntentType, ProviderCost } from '../../../common/forge/types/adaptiveTypes.js';

export class RetrievalPlanner {
	selectProviders(intent: IntentType): string[] {
		switch (intent) {
			case 'Debug':
				return ['workspace', 'knowledge', 'memory'];
			case 'Documentation':
				return ['browser', 'workspace', 'knowledge'];
			case 'TestGeneration':
				return ['workspace', 'browser', 'knowledge'];
			case 'ReviewPR':
				return ['github', 'workspace', 'knowledge'];
			case 'Architecture':
				return ['workspace', 'knowledge', 'browser'];
			default:
				return ['workspace', 'browser', 'knowledge', 'memory'];
		}
	}

	getProviderCost(provider: string): ProviderCost {
		const costs: Record<string, ProviderCost> = {
			workspace: { provider: 'workspace', latencyMs: 12, tokenCost: 350, cacheHit: true },
			browser: { provider: 'browser', latencyMs: 45, tokenCost: 500, cacheHit: false },
			knowledge: { provider: 'knowledge', latencyMs: 8, tokenCost: 200, cacheHit: true },
			github: { provider: 'github', latencyMs: 120, tokenCost: 450, cacheHit: false },
			memory: { provider: 'memory', latencyMs: 5, tokenCost: 150, cacheHit: true }
		};
		return costs[provider] || { provider, latencyMs: 20, tokenCost: 250, cacheHit: false };
	}
}

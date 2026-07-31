/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { AdaptiveBudgetProfile, IntentType } from '../../../common/forge/types/adaptiveTypes.js';

export class AdaptiveBudgetManager {
	private readonly profiles: Record<IntentType, AdaptiveBudgetProfile> = {
		Debug: { intent: 'Debug', workspacePct: 45, knowledgePct: 20, gitHubPct: 10, browserPct: 10, memoryPct: 5, systemPct: 10 },
		Architecture: { intent: 'Architecture', workspacePct: 20, knowledgePct: 35, gitHubPct: 15, browserPct: 20, memoryPct: 10, systemPct: 0 },
		Documentation: { intent: 'Documentation', workspacePct: 20, knowledgePct: 15, gitHubPct: 10, browserPct: 45, memoryPct: 10, systemPct: 0 },
		TestGeneration: { intent: 'TestGeneration', workspacePct: 40, knowledgePct: 20, gitHubPct: 10, browserPct: 20, memoryPct: 10, systemPct: 0 },
		ReviewPR: { intent: 'ReviewPR', workspacePct: 25, knowledgePct: 20, gitHubPct: 35, browserPct: 10, memoryPct: 10, systemPct: 0 },
		Refactor: { intent: 'Refactor', workspacePct: 50, knowledgePct: 20, gitHubPct: 10, browserPct: 10, memoryPct: 10, systemPct: 0 },
		ExplainCode: { intent: 'ExplainCode', workspacePct: 35, knowledgePct: 20, gitHubPct: 15, browserPct: 15, memoryPct: 15, systemPct: 0 },
		GenerateCode: { intent: 'GenerateCode', workspacePct: 40, knowledgePct: 20, gitHubPct: 10, browserPct: 20, memoryPct: 10, systemPct: 0 },
		SecurityAudit: { intent: 'SecurityAudit', workspacePct: 45, knowledgePct: 25, gitHubPct: 10, browserPct: 10, memoryPct: 10, systemPct: 0 },
		PerformanceOptimization: { intent: 'PerformanceOptimization', workspacePct: 45, knowledgePct: 25, gitHubPct: 10, browserPct: 10, memoryPct: 10, systemPct: 0 }
	};

	getProfile(intent: IntentType): AdaptiveBudgetProfile {
		return this.profiles[intent] || this.profiles.ExplainCode;
	}

	calculateTokensForSlot(intent: IntentType, totalBudget: number, slot: keyof Omit<AdaptiveBudgetProfile, 'intent'>): number {
		const profile = this.getProfile(intent);
		const pct = profile[slot];
		return Math.round((totalBudget * pct) / 100);
	}
}

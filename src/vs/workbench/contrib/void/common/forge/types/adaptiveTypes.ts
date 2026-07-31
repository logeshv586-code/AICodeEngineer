/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type IntentType =
	| 'ExplainCode'
	| 'Debug'
	| 'Refactor'
	| 'GenerateCode'
	| 'ReviewPR'
	| 'Architecture'
	| 'Documentation'
	| 'TestGeneration'
	| 'SecurityAudit'
	| 'PerformanceOptimization';

export interface IntentAnalysis {
	readonly intent: IntentType;
	readonly confidence: number; // 0.0 to 1.0
	readonly keywords: string[];
	readonly explanation: string;
}

export interface AdaptiveBudgetProfile {
	readonly intent: IntentType;
	readonly workspacePct: number;
	readonly knowledgePct: number;
	readonly gitHubPct: number;
	readonly browserPct: number;
	readonly memoryPct: number;
	readonly systemPct: number;
}

export interface Evidence {
	readonly provider: 'workspace' | 'browser' | 'github' | 'memory' | 'knowledge';
	readonly entityId: string;
	readonly confidence: number;
	readonly retrievalStage: number;
}

export interface ProviderCost {
	readonly provider: string;
	readonly latencyMs: number;
	readonly tokenCost: number;
	readonly cacheHit: boolean;
}

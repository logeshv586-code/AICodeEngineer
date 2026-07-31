/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type ContextStage = 'Stage1_SymbolsOnly' | 'Stage2_RelatedFiles' | 'Stage3_CodeBlocks' | 'Stage4_FullContent';

export interface GitHubContext {
	readonly repository: string;
	readonly branch: string;
	readonly commit: string;
	readonly filePath?: string;
	readonly summary: string;
	readonly changedSymbols: string[];
	readonly affectedModules: string[];
	readonly relatedWorkspaceEntities: string[];
	readonly relatedKnowledgeEntities: string[];
}

export interface TokenBudgetAllocation {
	readonly totalMaxTokens: number;
	readonly systemPromptTokens: number; // 10%
	readonly workspaceTokens: number;    // 30%
	readonly knowledgeTokens: number;    // 20%
	readonly gitHubTokens: number;       // 15%
	readonly browserTokens: number;      // 15%
	readonly memoryTokens: number;       // 10%
}

export interface CompressionSummary {
	readonly originalTokenEstimate: number;
	readonly compressedTokenEstimate: number;
	readonly savingsPercentage: number;
	readonly stageUsed: ContextStage;
}

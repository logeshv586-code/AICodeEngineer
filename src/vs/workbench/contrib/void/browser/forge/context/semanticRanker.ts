/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { RankedHit } from '../../../common/forge/types/knowledgeGraphTypes.js';
import { SemanticSearchHit } from '../../../common/forge/types/semanticSearchTypes.js';

export interface RankInput {
	readonly query: string;
	readonly searchHits: SemanticSearchHit[];
	readonly activeFileUri?: string;
	readonly openFilesUris?: string[];
	readonly maxHitsToKeep?: number;
}

export class SemanticRanker {
	/** Multi-signal weights */
	private readonly WEIGHTS = {
		semanticVector: 0.35,
		astMatch: 0.25,
		graphProximity: 0.15,
		activeContext: 0.15,
		memory: 0.10
	};

	rankHits(input: RankInput): RankedHit<SemanticSearchHit>[] {
		const maxToKeep = input.maxHitsToKeep || 15;
		const queryTokens = new Set(input.query.toLowerCase().split(/\W+/).filter(Boolean));

		const ranked: RankedHit<SemanticSearchHit>[] = input.searchHits.map(hit => {
			const chunk = hit.chunk;
			const contentLower = chunk.content.toLowerCase();

			// 1. Semantic Vector Score (0.0 - 1.0)
			const semanticScore = Math.min(1.0, Math.max(0.0, hit.score));

			// 2. AST / Exact Symbol Match Score
			let astMatchScore = 0.0;
			if (chunk.symbolHint) {
				if (queryTokens.has(chunk.symbolHint.toLowerCase())) {
					astMatchScore = 1.0;
				} else if (contentLower.includes(chunk.symbolHint.toLowerCase())) {
					astMatchScore = 0.5;
				}
			}

			// 3. Knowledge Graph Proximity
			const graphProximityScore = chunk.moduleHint ? 0.7 : 0.2;

			// 4. Active File Proximity Score
			let activeContextScore = 0.0;
			if (input.activeFileUri && chunk.filePath === input.activeFileUri) {
				activeContextScore = 1.0;
			} else if (input.openFilesUris && input.openFilesUris.includes(chunk.filePath)) {
				activeContextScore = 0.6;
			}

			// 5. Memory Score
			const memoryScore = 0.5;

			// Compute total weighted score
			const totalScore =
				semanticScore * this.WEIGHTS.semanticVector +
				astMatchScore * this.WEIGHTS.astMatch +
				graphProximityScore * this.WEIGHTS.graphProximity +
				activeContextScore * this.WEIGHTS.activeContext +
				memoryScore * this.WEIGHTS.memory;

			return {
				item: hit,
				score: parseFloat(totalScore.toFixed(3)),
				breakdown: {
					semanticScore,
					astMatchScore,
					graphProximityScore,
					activeContextScore,
					memoryScore
				}
			};
		});

		// Sort descending by multi-signal score and prune to token budget
		return ranked.sort((a, b) => b.score - a.score).slice(0, maxToKeep);
	}
}

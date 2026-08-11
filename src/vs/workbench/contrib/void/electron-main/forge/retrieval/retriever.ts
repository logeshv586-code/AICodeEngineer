/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { LanceDBService } from '../storage/lancedbService.js';
import { EmbeddingWorker } from '../embeddings/embeddingWorker.js';
import { SemanticSearchHit } from '../../../common/forge/types/semanticSearchTypes.js';

export interface RetrieveOptions {
	query: string;
	topK?: number;
	workspacePath: string;
}

export class Retriever {
	constructor(
		private readonly lancedb: LanceDBService,
		private readonly embedder: EmbeddingWorker
	) { }

	async retrieve(opts: RetrieveOptions): Promise<SemanticSearchHit[]> {
		const topK = opts.topK || 5;
		const queryVector = await this.embedder.generateEmbedding(opts.query);
		return this.lancedb.queryVector(queryVector, topK);
	}
}

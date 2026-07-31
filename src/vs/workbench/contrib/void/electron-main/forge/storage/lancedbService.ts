/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { VectorChunk, SemanticSearchHit } from '../../../common/forge/types/semanticSearchTypes.js';

export interface RecordWithVector {
	chunk: VectorChunk;
	vector: number[];
}

export class LanceDBService {
	private readonly dbDir: string;
	private records: RecordWithVector[] = [];

	constructor() {
		this.dbDir = path.join(os.homedir(), '.forge', 'lancedb');
		if (!fs.existsSync(this.dbDir)) {
			fs.mkdirSync(this.dbDir, { recursive: true });
		}
	}

	async saveChunks(chunksWithVectors: RecordWithVector[]): Promise<void> {
		const newIds = new Set(chunksWithVectors.map(c => c.chunk.id));
		this.records = [
			...this.records.filter(r => !newIds.has(r.chunk.id)),
			...chunksWithVectors
		];
	}

	async queryVector(queryVector: number[], topK: number = 5): Promise<SemanticSearchHit[]> {
		if (this.records.length === 0) return [];

		const scored = this.records.map(record => {
			const score = this.cosineSimilarity(queryVector, record.vector);
			return { chunk: record.chunk, score };
		});

		scored.sort((a, b) => b.score - a.score);
		return scored.slice(0, topK);
	}

	private cosineSimilarity(a: number[], b: number[]): number {
		let dot = 0;
		let normA = 0;
		let normB = 0;
		for (let i = 0; i < a.length; i++) {
			dot += a[i] * b[i];
			normA += a[i] * a[i];
			normB += b[i] * b[i];
		}
		if (normA === 0 || normB === 0) return 0;
		return dot / (Math.sqrt(normA) * Math.sqrt(normB));
	}

	getChunkCount(): number {
		return this.records.length;
	}
}

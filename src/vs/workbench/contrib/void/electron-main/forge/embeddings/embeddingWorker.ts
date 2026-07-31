/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export class EmbeddingWorker {
	private readonly modelName = 'bge-small-en-v1.5';
	private readonly dimension = 384;

	getModelName(): string {
		return this.modelName;
	}

	getDimension(): number {
		return this.dimension;
	}

	async generateEmbedding(text: string): Promise<number[]> {
		// Mock local embedding pipeline vector generation (or lightweight hash-seeded deterministic projection)
		const vector = new Array(this.dimension).fill(0);
		for (let i = 0; i < text.length; i++) {
			const charCode = text.charCodeAt(i);
			const idx = (i * 31 + charCode) % this.dimension;
			vector[idx] += (charCode / 255.0) * 0.1;
		}

		// Normalize vector
		const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1.0;
		return vector.map(v => v / norm);
	}

	async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
		return Promise.all(texts.map(t => this.generateEmbedding(t)));
	}
}

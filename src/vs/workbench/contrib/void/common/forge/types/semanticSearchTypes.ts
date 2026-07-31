/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface VectorChunk {
	readonly id: string;
	readonly filePath: string;
	readonly startLine: number;
	readonly endLine: number;
	readonly content: string;
	readonly symbol?: string;
	readonly hash: string;
	// Workspace-model enrichment (added Phase 2)
	readonly symbolHint?: string;   // resolved symbol name at this chunk location
	readonly moduleHint?: string;   // module (directory) this chunk belongs to
}

export interface SemanticSearchHit {
	readonly chunk: VectorChunk;
	readonly score: number;
}

export interface SemanticSearchOpts {
	readonly query: string;
	readonly topK?: number;
	readonly pathPattern?: string;
	readonly minScore?: number;
}

export interface IndexStats {
	readonly totalFiles: number;
	readonly totalChunks: number;
	readonly lastIndexedAt: number;
	readonly modelName: string;
	readonly isIndexing: boolean;
	readonly error?: string;
}

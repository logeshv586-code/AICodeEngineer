/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { KnowledgeEntry } from '../../../common/forge/types/memoryTypes.js';

export interface FileMetadata {
	readonly filePath: string;
	readonly hash: string;
	readonly lastIndexedAt: number;
	readonly chunkCount: number;
}

export class MetadataStore {
	private readonly fileMetaMap = new Map<string, FileMetadata>();
	private readonly knowledgeEntries: KnowledgeEntry[] = [];

	setFileMetadata(meta: FileMetadata): void {
		this.fileMetaMap.set(meta.filePath, meta);
	}

	getFileMetadata(filePath: string): FileMetadata | undefined {
		return this.fileMetaMap.get(filePath);
	}

	saveKnowledgeEntry(_workspacePath: string, entry: KnowledgeEntry): KnowledgeEntry {
		this.knowledgeEntries.push(entry);
		return entry;
	}

	getKnowledgeEntries(_workspacePath: string): KnowledgeEntry[] {
		return [...this.knowledgeEntries];
	}
}

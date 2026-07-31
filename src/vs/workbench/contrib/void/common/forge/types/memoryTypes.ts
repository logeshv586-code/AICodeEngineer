/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type MemoryCategory = 'fact' | 'architecture' | 'coding_style' | 'pattern' | 'decision';

export interface KnowledgeEntry {
	readonly id: string;
	readonly category: MemoryCategory;
	readonly title: string;
	readonly content: string;
	readonly tags: string[];
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly sourceFile?: string;
}

export interface MemoryQueryOpts {
	readonly category?: MemoryCategory;
	readonly query?: string;
	readonly limit?: number;
}

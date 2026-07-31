/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { KnowledgeEntry, MemoryQueryOpts } from '../../../common/forge/types/memoryTypes.js';
import { ForgeMainService } from '../services/forgeMainService.js';

export class KnowledgeService {
	constructor(private readonly mainService: ForgeMainService) { }

	async queryKnowledge(workspacePath: string, opts?: MemoryQueryOpts): Promise<KnowledgeEntry[]> {
		const entries: KnowledgeEntry[] = await this.mainService.getMemory(workspacePath) || [];
		if (!opts) return entries;

		return entries.filter(e => {
			if (opts.category && e.category !== opts.category) return false;
			if (opts.query && !e.content.toLowerCase().includes(opts.query.toLowerCase())) return false;
			return true;
		});
	}

	async addKnowledge(workspacePath: string, entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeEntry> {
		const fullEntry: KnowledgeEntry = {
			...entry,
			id: Math.random().toString(36).substring(2, 9),
			createdAt: Date.now(),
			updatedAt: Date.now()
		};
		await this.mainService.saveMemory(workspacePath, fullEntry);
		return fullEntry;
	}
}

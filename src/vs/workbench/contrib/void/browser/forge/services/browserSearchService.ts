/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { BrowserCacheEntry } from '../../../common/forge/types/browserTypes.js';

export class BrowserSearchService {
	private readonly cache = new Map<string, BrowserCacheEntry>();

	addEntry(entry: BrowserCacheEntry): void {
		this.cache.set(entry.url, entry);
	}

	search(query: string): BrowserCacheEntry[] {
		const q = query.toLowerCase();
		return Array.from(this.cache.values()).filter(entry =>
			entry.title.toLowerCase().includes(q) ||
			entry.summary.toLowerCase().includes(q) ||
			entry.markdown.toLowerCase().includes(q)
		);
	}

	getAllEntries(): BrowserCacheEntry[] {
		return Array.from(this.cache.values());
	}
}

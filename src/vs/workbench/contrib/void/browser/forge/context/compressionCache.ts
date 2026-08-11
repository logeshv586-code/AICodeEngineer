/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export class CompressionCache {
	private static instance?: CompressionCache;
	private readonly cache = new Map<string, { summary: string; timestamp: number }>();

	public static getInstance(): CompressionCache {
		if (!this.instance) {
			this.instance = new CompressionCache();
		}
		return this.instance;
	}

	get(key: string): string | undefined {
		const entry = this.cache.get(key);
		return entry ? entry.summary : undefined;
	}

	set(key: string, summary: string): void {
		this.cache.set(key, { summary, timestamp: Date.now() });
	}

	clear(): void {
		this.cache.clear();
	}
}

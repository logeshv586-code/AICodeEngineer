/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceSnapshot } from '../../../common/forge/types/workspaceTypes.js';

const CACHE_VERSION = 2;
const CACHE_FILENAME = '.forge-workspace-cache.json';

interface CacheFile {
	readonly version: number;
	readonly snapshot: WorkspaceSnapshot;
	/** mtime per file at the time of caching — used for incremental change detection */
	readonly mtimes: Record<string, number>;
}

export class WorkspaceCache {
	private readonly cachePath: string;

	constructor(workspacePath: string) {
		this.cachePath = path.join(workspacePath, CACHE_FILENAME);
	}

	/** Persist a snapshot plus mtime index to disk. */
	async save(snapshot: WorkspaceSnapshot): Promise<void> {
		const mtimes: Record<string, number> = {};
		for (const f of snapshot.files) {
			mtimes[f.absolutePath] = f.mtimeMs;
		}
		const cacheFile: CacheFile = { version: CACHE_VERSION, snapshot, mtimes };
		await fs.promises.writeFile(this.cachePath, JSON.stringify(cacheFile, null, 0), 'utf-8');
	}

	/** Load cache from disk. Returns null if missing, version-mismatched, or corrupt. */
	async load(): Promise<CacheFile | null> {
		try {
			const raw = await fs.promises.readFile(this.cachePath, 'utf-8');
			const parsed: CacheFile = JSON.parse(raw);
			if (parsed.version !== CACHE_VERSION) return null;
			return parsed;
		} catch {
			return null;
		}
	}

	/**
	 * Compare current disk mtimes against the cached mtime index.
	 * Returns a set of absolute file paths that have been added/modified since caching.
	 */
	async getChangedFiles(currentFiles: string[]): Promise<Set<string>> {
		const cache = await this.load();
		if (!cache) return new Set(currentFiles); // no cache → all changed

		const changed = new Set<string>();
		for (const fp of currentFiles) {
			try {
				const stat = await fs.promises.stat(fp);
				const cachedMtime = cache.mtimes[fp];
				if (cachedMtime === undefined || stat.mtimeMs > cachedMtime) {
					changed.add(fp);
				}
			} catch {
				changed.add(fp);
			}
		}
		return changed;
	}

	/** True if a cache file exists for this workspace. */
	async exists(): Promise<boolean> {
		try {
			await fs.promises.access(this.cachePath);
			return true;
		} catch {
			return false;
		}
	}

	/** Delete the cache file. */
	async invalidate(): Promise<void> {
		try { await fs.promises.unlink(this.cachePath); } catch { /* ignore */ }
	}
}

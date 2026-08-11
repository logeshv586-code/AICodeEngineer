/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceModel } from './workspaceModel.js';

const DEBOUNCE_MS = 800;
const FULL_REBUILD_THRESHOLD = 20; // files changed → full rebuild

/**
 * WorkspaceWatcher listens to fs events on the workspace root
 * and triggers incremental updates on the WorkspaceModel.
 * Replaces / extends the earlier watcher.ts concept.
 */
export class WorkspaceWatcher {
	private watcher: fs.FSWatcher | null = null;
	private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private pendingChanges = new Set<string>();

	constructor(private readonly model: WorkspaceModel) { }

	/**
	 * Start watching `workspacePath`. The model must already be built.
	 */
	start(workspacePath: string): void {
		if (this.watcher) return;

		this.watcher = fs.watch(workspacePath, { recursive: true }, (eventType, filename) => {
			if (!filename) return;
			const absolute = path.resolve(workspacePath, filename);

			// Skip hidden files and common noise
			if (this._shouldIgnore(filename)) return;

			// Debounce rapid saves
			const existing = this.debounceTimers.get(absolute);
			if (existing) clearTimeout(existing);

			this.pendingChanges.add(absolute);
			const timer = setTimeout(() => this._flush(absolute, workspacePath), DEBOUNCE_MS);
			this.debounceTimers.set(absolute, timer);
		});
	}

	stop(): void {
		this.watcher?.close();
		this.watcher = null;
		for (const t of this.debounceTimers.values()) clearTimeout(t);
		this.debounceTimers.clear();
	}

	private async _flush(absolute: string, workspacePath: string): Promise<void> {
		this.debounceTimers.delete(absolute);

		// If too many files changed at once, do a full rebuild
		if (this.pendingChanges.size > FULL_REBUILD_THRESHOLD) {
			this.pendingChanges.clear();
			await this.model.build(true);
			return;
		}

		this.pendingChanges.delete(absolute);
		try {
			await fs.promises.access(absolute);
			await this.model.updateFile(absolute);
		} catch {
			// File deleted
			await this.model.removeFile(absolute);
		}
	}

	private _shouldIgnore(filename: string): boolean {
		const ignoredParts = ['node_modules', '.git', 'out', 'dist', 'build', '.forge-workspace-cache.json'];
		return ignoredParts.some(p => filename.includes(p)) || filename.startsWith('.');
	}
}

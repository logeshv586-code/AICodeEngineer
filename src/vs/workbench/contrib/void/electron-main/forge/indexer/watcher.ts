/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as fs from 'fs';

export class WorkspaceWatcher {
	private readonly queue = new Set<string>();
	private watcher?: fs.FSWatcher;

	watch(workspacePath: string, onChange: (filePaths: string[]) => void): void {
		if (this.watcher) this.watcher.close();
		try {
			this.watcher = fs.watch(workspacePath, { recursive: true }, (_eventType, filename) => {
				if (filename) {
					this.queue.add(filename);
					this.debouncedFlush(onChange);
				}
			});
		} catch (e) {
			// fs.watch fallback
		}
	}

	private timer?: NodeJS.Timeout;
	private debouncedFlush(onChange: (filePaths: string[]) => void): void {
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			const files = Array.from(this.queue);
			this.queue.clear();
			if (files.length > 0) {
				onChange(files);
			}
		}, 1000);
	}

	dispose(): void {
		if (this.watcher) this.watcher.close();
	}
}

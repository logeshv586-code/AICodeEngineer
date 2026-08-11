/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';

export class WorkspaceScanner {
	private readonly defaultIgnoredDirs = new Set([
		'node_modules',
		'.git',
		'out',
		'dist',
		'build',
		'.vscode',
		'target',
		'coverage',
		'.next'
	]);

	async scanWorkspace(workspacePath: string): Promise<string[]> {
		const files: string[] = [];
		await this.walkDir(workspacePath, files);
		return files;
	}

	private async walkDir(currentPath: string, fileList: string[]): Promise<void> {
		let entries: fs.Dirent[];
		try {
			entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
		} catch (e) {
			return;
		}

		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (!this.defaultIgnoredDirs.has(entry.name)) {
					await this.walkDir(path.join(currentPath, entry.name), fileList);
				}
			} else if (entry.isFile()) {
				const ext = path.extname(entry.name).toLowerCase();
				if (this.isTextExtension(ext)) {
					fileList.push(path.join(currentPath, entry.name));
				}
			}
		}
	}

	private isTextExtension(ext: string): boolean {
		const validExts = new Set([
			'.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html', '.css',
			'.py', '.java', '.c', '.cpp', '.h', '.hpp', '.go', '.rs', '.sh',
			'.yml', '.yaml', '.toml', '.xml', '.sql', '.txt'
		]);
		return validExts.has(ext);
	}
}

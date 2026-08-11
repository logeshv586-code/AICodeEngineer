/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as path from 'path';
import { ImportInfo } from '../../../common/forge/types/workspaceTypes.js';

export class ImportGraph {
	/** filePath → files that filePath imports */
	private readonly forwardEdges = new Map<string, Set<string>>();
	/** filePath → files that import filePath */
	private readonly reverseEdges = new Map<string, Set<string>>();
	/** raw ImportInfo records for richer querying */
	private readonly rawImports = new Map<string, ImportInfo[]>();

	addImports(filePath: string, imports: ImportInfo[], workspacePath: string): void {
		const resolved = imports.map(imp => ({
			...imp,
			resolvedPath: this._resolve(filePath, imp.toModule, workspacePath)
		}));

		this.rawImports.set(filePath, resolved);

		const forward = this.forwardEdges.get(filePath) ?? new Set();
		for (const imp of resolved) {
			const target = imp.resolvedPath;
			if (!target) continue;
			forward.add(target);
			const reverse = this.reverseEdges.get(target) ?? new Set();
			reverse.add(filePath);
			this.reverseEdges.set(target, reverse);
		}
		this.forwardEdges.set(filePath, forward);
	}

	/** Files that `filePath` imports */
	getImports(filePath: string): string[] {
		return Array.from(this.forwardEdges.get(filePath) ?? []);
	}

	/** Files that import `filePath` */
	getImporters(filePath: string): string[] {
		return Array.from(this.reverseEdges.get(filePath) ?? []);
	}

	/** Raw ImportInfo for a file */
	getRawImports(filePath: string): ImportInfo[] {
		return this.rawImports.get(filePath) ?? [];
	}

	getAllRawImports(): ImportInfo[] {
		const all: ImportInfo[] = [];
		for (const imps of this.rawImports.values()) all.push(...imps);
		return all;
	}

	/** Total count of directed import edges */
	edgeCount(): number {
		let count = 0;
		for (const s of this.forwardEdges.values()) count += s.size;
		return count;
	}

	/** Detect circular imports — returns true if any cycle found */
	hasCycles(): boolean {
		const visited = new Set<string>();
		const inStack = new Set<string>();

		const dfs = (node: string): boolean => {
			visited.add(node);
			inStack.add(node);
			for (const next of (this.forwardEdges.get(node) ?? [])) {
				if (!visited.has(next)) { if (dfs(next)) return true; }
				else if (inStack.has(next)) return true;
			}
			inStack.delete(node);
			return false;
		};

		for (const node of this.forwardEdges.keys()) {
			if (!visited.has(node) && dfs(node)) return true;
		}
		return false;
	}

	// ── Resolution ──────────────────────────────────────────────────────────

	private _resolve(fromFile: string, toModule: string, workspacePath: string): string | undefined {
		if (toModule.startsWith('.')) {
			// Relative import
			const dir = path.dirname(fromFile);
			const candidates = this._candidates(path.resolve(dir, toModule));
			return candidates.find(c => {
				try { require('fs').accessSync(c); return true; } catch { return false; }
			}) ?? candidates[0];
		}
		// Bare module or alias — mark as external (not resolved to workspace path)
		return undefined;
	}

	private _candidates(base: string): string[] {
		return [
			base,
			`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`,
			`${base}/index.ts`, `${base}/index.tsx`, `${base}/index.js`
		];
	}
}

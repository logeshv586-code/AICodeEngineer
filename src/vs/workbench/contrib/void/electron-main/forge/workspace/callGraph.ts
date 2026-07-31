/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { CallInfo, SymbolInfo } from '../../../common/forge/types/workspaceTypes.js';
import { ImportGraph } from './importGraph.js';

export class CallGraph {
	/** symbolId → symbols this symbol calls */
	private readonly edges = new Map<string, Set<string>>();
	/** symbolId → symbols that call this symbol (reverse) */
	private readonly reverseEdges = new Map<string, Set<string>>();

	private readonly resolvedCalls: CallInfo[] = [];

	/**
	 * Two-pass resolution:
	 * Pass 1: build a global name → SymbolInfo[] index.
	 * Pass 2: resolve each CallInfo.calleeSymbolName against the index,
	 *         guided by the import graph to narrow which file is the source.
	 */
	build(allSymbols: SymbolInfo[], rawCalls: CallInfo[], importGraph: ImportGraph): void {
		// Pass 1: name → candidates map
		const byName = new Map<string, SymbolInfo[]>();
		for (const sym of allSymbols) {
			const bucket = byName.get(sym.name) ?? [];
			bucket.push(sym);
			byName.set(sym.name, bucket);
		}

		// Pass 2: resolve
		for (const call of rawCalls) {
			const candidates = byName.get(call.calleeSymbolName) ?? [];

			// Prefer candidates from files imported by the caller's file
			const importedFiles = new Set(importGraph.getImports(call.callerFile));
			let resolved = candidates.find(c => importedFiles.has(c.filePath) && c.isExported);
			// Fall back to same file
			if (!resolved) resolved = candidates.find(c => c.filePath === call.callerFile);

			const resolvedCall: CallInfo = resolved
				? { ...call, calleeFile: resolved.filePath, isResolved: true }
				: call;

			this.resolvedCalls.push(resolvedCall);

			if (resolved) {
				const fwd = this.edges.get(call.callerSymbolId) ?? new Set();
				fwd.add(resolved.id);
				this.edges.set(call.callerSymbolId, fwd);

				const rev = this.reverseEdges.get(resolved.id) ?? new Set();
				rev.add(call.callerSymbolId);
				this.reverseEdges.set(resolved.id, rev);
			}
		}
	}

	/** Symbol IDs called by `symbolId` */
	getCallees(symbolId: string): string[] {
		return Array.from(this.edges.get(symbolId) ?? []);
	}

	/** Symbol IDs that call `symbolId` */
	getCallers(symbolId: string): string[] {
		return Array.from(this.reverseEdges.get(symbolId) ?? []);
	}

	getAllResolvedCalls(): CallInfo[] {
		return this.resolvedCalls;
	}

	edgeCount(): number {
		let count = 0;
		for (const s of this.edges.values()) count += s.size;
		return count;
	}
}

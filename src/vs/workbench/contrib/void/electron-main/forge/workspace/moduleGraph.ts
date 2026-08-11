/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as path from 'path';
import { ModuleNode, SymbolInfo } from '../../../common/forge/types/workspaceTypes.js';
import { ImportGraph } from './importGraph.js';

export class ModuleGraph {
	/**
	 * Groups workspace files by directory (module boundary).
	 * Computes coupling score as the number of cross-module import edges.
	 */
	build(allFiles: string[], allSymbols: SymbolInfo[], importGraph: ImportGraph): ModuleNode[] {
		// 1. Group files by directory
		const dirToFiles = new Map<string, string[]>();
		for (const fp of allFiles) {
			const dir = path.dirname(fp);
			const bucket = dirToFiles.get(dir) ?? [];
			bucket.push(fp);
			dirToFiles.set(dir, bucket);
		}

		// 2. Build symbol lookup by file
		const symsByFile = new Map<string, SymbolInfo[]>();
		for (const sym of allSymbols) {
			const bucket = symsByFile.get(sym.filePath) ?? [];
			bucket.push(sym);
			symsByFile.set(sym.filePath, bucket);
		}

		const nodes: ModuleNode[] = [];

		for (const [dir, files] of dirToFiles.entries()) {
			// Exported symbols from files in this module
			const exportedSymbolIds: string[] = [];
			for (const fp of files) {
				const syms = symsByFile.get(fp) ?? [];
				exportedSymbolIds.push(...syms.filter(s => s.isExported).map(s => s.id));
			}

			// Cross-module imports: files in this module importing files in OTHER modules
			const importedModuleIds = new Set<string>();
			let couplingScore = 0;
			for (const fp of files) {
				const imports = importGraph.getImports(fp);
				for (const importedFile of imports) {
					const importedDir = path.dirname(importedFile);
					if (importedDir !== dir) {
						importedModuleIds.add(importedDir);
						couplingScore++;
					}
				}
			}

			nodes.push({
				id: dir,
				dirPath: dir,
				files,
				exportedSymbolIds,
				importedModuleIds: Array.from(importedModuleIds),
				couplingScore
			});
		}

		// Sort by coupling descending (hotspots first)
		return nodes.sort((a, b) => b.couplingScore - a.couplingScore);
	}
}

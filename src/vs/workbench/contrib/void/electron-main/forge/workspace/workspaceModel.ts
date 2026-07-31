/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import {
	WorkspaceSnapshot, WorkspaceFile, WorkspaceStats,
	SymbolInfo, ImportInfo, CallInfo, ModuleNode
} from '../../../common/forge/types/workspaceTypes.js';
import { ParserRegistry } from './parser.js';
import { SymbolExtractor } from './symbolExtractor.js';
import { ImportGraph } from './importGraph.js';
import { CallGraph } from './callGraph.js';
import { ModuleGraph } from './moduleGraph.js';
import { WorkspaceCache } from './workspaceCache.js';
import { WorkspaceScanner } from '../indexer/scanner.js';

const SNAPSHOT_VERSION = 2;

/**
 * WorkspaceModel is the canonical source of truth for all workspace intelligence.
 * Lives in the Electron main process; exposed via IPC.
 */
export class WorkspaceModel {
	private snapshot: WorkspaceSnapshot | null = null;

	private readonly registry = new ParserRegistry();
	private readonly extractor: SymbolExtractor;
	private readonly scanner: WorkspaceScanner;

	constructor(private readonly workspacePath: string) {
		this.extractor = new SymbolExtractor(this.registry);
		this.scanner = new WorkspaceScanner();
	}

	// ── Build ────────────────────────────────────────────────────────────────

	/**
	 * Full or incremental build.
	 * If a cache exists and most files are unchanged, only re-parses the diff.
	 */
	async build(forceRebuild = false): Promise<WorkspaceSnapshot> {
		const t0 = Date.now();
		const cache = new WorkspaceCache(this.workspacePath);

		// Scan current file list
		const allPaths = await this.scanner.scanWorkspace(this.workspacePath);

		// Determine which files need parsing
		const changedFiles = forceRebuild
			? new Set(allPaths)
			: await cache.getChangedFiles(allPaths);

		// Load existing snapshot for re-use of unchanged data
		let existingSnapshot: WorkspaceSnapshot | null = null;
		if (!forceRebuild && changedFiles.size < allPaths.length) {
			existingSnapshot = (await cache.load())?.snapshot ?? null;
		}

		// Parse changed files
		const parsedMap = await this.extractor.extractFromFiles(Array.from(changedFiles));

		// Merge: use cached data for unchanged files, fresh data for changed
		const allSymbols: SymbolInfo[] = [];
		const importsByFile = new Map<string, ImportInfo[]>();
		const rawCalls: CallInfo[] = [];
		const workspaceFiles: WorkspaceFile[] = [];

		for (const fp of allPaths) {
			let stat: fs.Stats;
			try { stat = await fs.promises.stat(fp); } catch { continue; }

			workspaceFiles.push({
				absolutePath: fp,
				relativePath: path.relative(this.workspacePath, fp),
				sizeBytes: stat.size,
				mtimeMs: stat.mtimeMs,
				language: this.registry.getParser(path.extname(fp))?.language ?? 'unknown'
			});

			if (changedFiles.has(fp)) {
				const r = parsedMap.get(fp);
				if (r) {
					allSymbols.push(...r.symbols);
					importsByFile.set(fp, r.parsed.imports);
					rawCalls.push(...r.parsed.calls);
				}
			} else if (existingSnapshot) {
				allSymbols.push(...existingSnapshot.symbols.filter(s => s.filePath === fp));
				const existingImports = existingSnapshot.imports.filter(i => i.fromFile === fp);
				importsByFile.set(fp, existingImports);
				rawCalls.push(...existingSnapshot.calls.filter(c => c.callerFile === fp));
			}
		}

		// Build graphs
		const importGraph = new ImportGraph();
		for (const [fp, imps] of importsByFile.entries()) {
			importGraph.addImports(fp, imps, this.workspacePath);
		}

		const callGraph = new CallGraph();
		callGraph.build(allSymbols, rawCalls, importGraph);

		const moduleGraphBuilder = new ModuleGraph();
		const modules = moduleGraphBuilder.build(allPaths, allSymbols, importGraph);

		const stats: WorkspaceStats = {
			totalFiles: workspaceFiles.length,
			totalSymbols: allSymbols.length,
			totalImportEdges: importGraph.edgeCount(),
			totalCallEdges: callGraph.edgeCount(),
			totalModules: modules.length,
			buildDurationMs: Date.now() - t0
		};

		this.snapshot = {
			workspacePath: this.workspacePath,
			files: workspaceFiles,
			symbols: allSymbols,
			imports: importGraph.getAllRawImports(),
			calls: callGraph.getAllResolvedCalls(),
			modules,
			generatedAt: Date.now(),
			version: SNAPSHOT_VERSION,
			stats
		};

		await cache.save(this.snapshot);
		return this.snapshot;
	}

	// ── Incremental updates ───────────────────────────────────────────────────

	async updateFile(filePath: string): Promise<void> {
		if (!this.snapshot) return;
		const { parsed, symbols } = await this.extractor.extractFromFile(filePath);

		// Replace old data for this file
		const newSymbols = this.snapshot.symbols.filter(s => s.filePath !== filePath).concat(symbols);
		const newImports = this.snapshot.imports.filter(i => i.fromFile !== filePath).concat(parsed.imports);
		const newCalls = this.snapshot.calls.filter(c => c.callerFile !== filePath).concat(parsed.calls);

		// Rebuild graphs from updated data
		const importGraph = new ImportGraph();
		const byFile = new Map<string, ImportInfo[]>();
		for (const imp of newImports) {
			const b = byFile.get(imp.fromFile) ?? [];
			b.push(imp);
			byFile.set(imp.fromFile, b);
		}
		for (const [fp, imps] of byFile.entries()) importGraph.addImports(fp, imps, this.workspacePath);

		const callGraph = new CallGraph();
		callGraph.build(newSymbols, newCalls, importGraph);

		const moduleGraphBuilder = new ModuleGraph();
		const modules = moduleGraphBuilder.build(
			this.snapshot.files.map(f => f.absolutePath),
			newSymbols,
			importGraph
		);

		this.snapshot = {
			...this.snapshot,
			symbols: newSymbols,
			imports: importGraph.getAllRawImports(),
			calls: callGraph.getAllResolvedCalls(),
			modules,
			generatedAt: Date.now()
		};
		await new WorkspaceCache(this.workspacePath).save(this.snapshot);
	}

	async removeFile(filePath: string): Promise<void> {
		if (!this.snapshot) return;
		this.snapshot = {
			...this.snapshot,
			files: this.snapshot.files.filter(f => f.absolutePath !== filePath),
			symbols: this.snapshot.symbols.filter(s => s.filePath !== filePath),
			imports: this.snapshot.imports.filter(i => i.fromFile !== filePath),
			calls: this.snapshot.calls.filter(c => c.callerFile !== filePath && c.calleeFile !== filePath),
			generatedAt: Date.now()
		};
		await new WorkspaceCache(this.workspacePath).save(this.snapshot);
	}

	// ── Query API ─────────────────────────────────────────────────────────────

	getSymbol(name: string): SymbolInfo[] {
		return this.snapshot?.symbols.filter(s => s.name === name) ?? [];
	}

	getImports(filePath: string): ImportInfo[] {
		return this.snapshot?.imports.filter(i => i.fromFile === filePath) ?? [];
	}

	getImporters(filePath: string): string[] {
		const importers: string[] = [];
		if (!this.snapshot) return importers;
		for (const imp of this.snapshot.imports) {
			if (imp.resolvedPath === filePath) importers.push(imp.fromFile);
		}
		return importers;
	}

	findReferences(symbolName: string): SymbolInfo[] {
		return this.snapshot?.symbols.filter(s => s.name === symbolName) ?? [];
	}

	getModuleGraph(): ModuleNode[] {
		return this.snapshot?.modules ?? [];
	}

	getSnapshot(): WorkspaceSnapshot | null {
		return this.snapshot;
	}

	isReady(): boolean {
		return this.snapshot !== null;
	}
}

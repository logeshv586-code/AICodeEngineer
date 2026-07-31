/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// ── Symbol extraction ───────────────────────────────────────────────────────

export type SymbolKind =
	| 'function'
	| 'method'
	| 'class'
	| 'interface'
	| 'type'
	| 'enum'
	| 'const'
	| 'variable'
	| 'property'
	| 'constructor'
	| 'unknown';

export interface SymbolInfo {
	readonly id: string;           // unique: `${filePath}::${name}::${startLine}`
	readonly name: string;
	readonly kind: SymbolKind;
	readonly filePath: string;
	readonly startLine: number;
	readonly endLine: number;
	readonly isExported: boolean;
	readonly docComment?: string;
	readonly signature?: string;
}

// ── Import graph ─────────────────────────────────────────────────────────────

export interface ImportInfo {
	readonly fromFile: string;     // absolute path of the importing file
	readonly toModule: string;     // raw import string (may be relative or bare)
	readonly resolvedPath?: string; // absolute path if resolved
	readonly importedNames: string[]; // named imports; ['*'] for namespace, [] for side-effect
	readonly isDynamic: boolean;
}

// ── Call graph ────────────────────────────────────────────────────────────────

export interface CallInfo {
	readonly callerSymbolId: string;
	readonly callerFile: string;
	readonly calleeSymbolName: string;
	readonly calleeFile?: string;   // resolved file; undefined if unresolved
	readonly line: number;
	readonly isResolved: boolean;
}

// ── Module graph ──────────────────────────────────────────────────────────────

export interface ModuleNode {
	readonly id: string;             // directory path (module boundary)
	readonly dirPath: string;
	readonly files: string[];
	readonly exportedSymbolIds: string[];
	readonly importedModuleIds: string[];  // other ModuleNode ids this module imports from
	readonly couplingScore: number;        // count of inter-module imports
}

// ── Parsed file ───────────────────────────────────────────────────────────────

export interface ParsedFile {
	readonly filePath: string;
	readonly language: string;
	readonly rawLines: string[];
	readonly symbols: SymbolInfo[];
	readonly imports: ImportInfo[];
	readonly calls: CallInfo[];
}

// ── Workspace file descriptor ─────────────────────────────────────────────────

export interface WorkspaceFile {
	readonly absolutePath: string;
	readonly relativePath: string;
	readonly sizeBytes: number;
	readonly mtimeMs: number;
	readonly language: string;
}

// ── Workspace snapshot (serialisable) ─────────────────────────────────────────

export interface WorkspaceSnapshot {
	readonly workspacePath: string;
	readonly files: WorkspaceFile[];
	readonly symbols: SymbolInfo[];
	readonly imports: ImportInfo[];
	readonly calls: CallInfo[];
	readonly modules: ModuleNode[];
	readonly generatedAt: number;
	readonly version: number;
	readonly stats: WorkspaceStats;
}

export interface WorkspaceStats {
	readonly totalFiles: number;
	readonly totalSymbols: number;
	readonly totalImportEdges: number;
	readonly totalCallEdges: number;
	readonly totalModules: number;
	readonly buildDurationMs: number;
}

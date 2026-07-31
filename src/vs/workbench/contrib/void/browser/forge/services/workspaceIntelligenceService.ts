/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import {
	WorkspaceSnapshot, SymbolInfo, ImportInfo, ModuleNode
} from '../../../common/forge/types/workspaceTypes.js';

/**
 * Browser-side proxy to WorkspaceModel.
 * Calls are routed through the Forge IPC channel to the privileged main process.
 */
export class WorkspaceIntelligenceService {
	private static instance?: WorkspaceIntelligenceService;
	private readonly channel: any; // IChannel from VSCode IPC — injected at construction

	/** Snapshot cache so UI can render without re-fetching on every render */
	private cachedSnapshot: WorkspaceSnapshot | null = null;

	private constructor(channel: any) {
		this.channel = channel;
	}

	/**
	 * Dependency-injection entry point.
	 * `channel` should be the browser-side Forge IPC client channel.
	 */
	static create(channel: any): WorkspaceIntelligenceService {
		if (!WorkspaceIntelligenceService.instance) {
			WorkspaceIntelligenceService.instance = new WorkspaceIntelligenceService(channel);
		}
		return WorkspaceIntelligenceService.instance;
	}

	// ── API surface mirrors WorkspaceModel ────────────────────────────────────

	async buildWorkspace(workspacePath: string, forceRebuild = false): Promise<WorkspaceSnapshot> {
		const snapshot = await this._call<WorkspaceSnapshot>('buildWorkspace', { workspacePath, forceRebuild });
		this.cachedSnapshot = snapshot;
		return snapshot;
	}

	async getWorkspaceSnapshot(workspacePath: string): Promise<WorkspaceSnapshot> {
		const snapshot = await this._call<WorkspaceSnapshot>('getWorkspaceSnapshot', { workspacePath });
		this.cachedSnapshot = snapshot;
		return snapshot;
	}

	async getSymbol(workspacePath: string, name: string): Promise<SymbolInfo[]> {
		return this._call<SymbolInfo[]>('getSymbol', { workspacePath, name });
	}

	async getImportGraph(workspacePath: string, filePath: string): Promise<{ imports: ImportInfo[]; importers: string[] }> {
		return this._call<{ imports: ImportInfo[]; importers: string[] }>('getImportGraph', { workspacePath, filePath });
	}

	async findReferences(workspacePath: string, symbolName: string): Promise<SymbolInfo[]> {
		return this._call<SymbolInfo[]>('findReferences', { workspacePath, symbolName });
	}

	async getModuleGraph(workspacePath: string): Promise<ModuleNode[]> {
		return this._call<ModuleNode[]>('getModuleGraph', { workspacePath });
	}

	getCachedSnapshot(): WorkspaceSnapshot | null {
		return this.cachedSnapshot;
	}

	// ── Private ───────────────────────────────────────────────────────────────

	private async _call<T>(command: string, args: Record<string, any>): Promise<T> {
		if (this.channel?.call) {
			return this.channel.call(command, args) as Promise<T>;
		}
		// Fallback for environments where the channel is not yet wired
		console.warn(`[WorkspaceIntelligenceService] IPC channel not ready for command: ${command}`);
		return null as any;
	}
}

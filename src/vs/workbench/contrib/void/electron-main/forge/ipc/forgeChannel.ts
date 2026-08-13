/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IServerChannel } from '../../../../../../base/parts/ipc/common/ipc.js';
import { Event } from '../../../../../../base/common/event.js';
import { MetadataStore } from '../storage/metadataStore.js';
import { WorkspaceModel } from '../workspace/workspaceModel.js';
import { WorkspaceWatcher } from '../workspace/workspaceWatcher.js';
import { KnowledgeGraph } from '../knowledge/knowledgeGraph.js';
import { WorkspaceHealthCalculator } from '../knowledge/workspaceHealth.js';
import { CocoIndexCodeService } from '../indexer/cocoIndexCodeService.js';

export class ForgeIPCChannel implements IServerChannel {
	private readonly workspaceModels = new Map<string, WorkspaceModel>();
	private readonly workspaceWatchers = new Map<string, WorkspaceWatcher>();

	constructor(
		private readonly metadataStore: MetadataStore,
		private readonly cocoIndex: CocoIndexCodeService,
	) { }

	listen(_: any, event: string): Event<any> {
		throw new Error(`Event not supported on ForgeIPCChannel: ${event}`);
	}

	async call(_: any, command: string, arg?: any): Promise<any> {
		switch (command) {

			// ── Existing semantic-search commands ─────────────────────────────

			case 'semanticSearch': {
				const { query, topK, workspacePath } = arg || {};
				return this.cocoIndex.search(workspacePath, query, topK);
			}
			case 'indexWorkspace': {
				const { workspacePath } = arg || {};
				return this.cocoIndex.indexWorkspace(workspacePath);
			}
			case 'rebuildCocoIndexWorkspace': {
				const { workspacePath } = arg || {};
				return this.cocoIndex.rebuildWorkspace(workspacePath);
			}
			case 'getIndexStats': {
				const { workspacePath } = arg || {};
				return this.cocoIndex.getStats(workspacePath);
			}
			case 'getCocoIndexStatus': {
				const { workspacePath } = arg || {};
				return this.cocoIndex.getStatus(workspacePath);
			}
			case 'installCocoIndex': {
				return this.cocoIndex.install();
			}
			case 'initializeCocoIndexProject': {
				const { workspacePath } = arg || {};
				return this.cocoIndex.initializeProject(workspacePath);
			}
			case 'autoPrepareCocoIndexWorkspace': {
				const { workspacePath } = arg || {};
				return this.cocoIndex.autoPrepareWorkspace(workspacePath);
			}
			case 'disableCocoIndexProject': {
				const { workspacePath } = arg || {};
				return this.cocoIndex.disableProject(workspacePath);
			}
			case 'getMemory': {
				const { workspacePath } = arg || {};
				return this.metadataStore.getKnowledgeEntries(workspacePath);
			}
			case 'saveMemory': {
				const { workspacePath, entry } = arg || {};
				return this.metadataStore.saveKnowledgeEntry(workspacePath, entry);
			}

			// ── Phase 2: Workspace Intelligence commands ──────────────────────

			case 'buildWorkspace': {
				const { workspacePath, forceRebuild } = arg || {};
				const model = this._getOrCreateModel(workspacePath);
				const snapshot = await model.build(!!forceRebuild);
				this._ensureWatcher(workspacePath, model);
				return snapshot;
			}
			case 'getWorkspaceSnapshot': {
				const { workspacePath } = arg || {};
				const model = this._getOrCreateModel(workspacePath);
				const snap = model.getSnapshot();
				if (!snap) return model.build();
				return snap;
			}
			case 'getSymbol': {
				const { workspacePath, name } = arg || {};
				const model = this._getOrCreateModel(workspacePath);
				return model.getSymbol(name);
			}
			case 'getImportGraph': {
				const { workspacePath, filePath } = arg || {};
				const model = this._getOrCreateModel(workspacePath);
				return {
					imports: model.getImports(filePath),
					importers: model.getImporters(filePath)
				};
			}
			case 'findReferences': {
				const { workspacePath, symbolName } = arg || {};
				const model = this._getOrCreateModel(workspacePath);
				return model.findReferences(symbolName);
			}
			case 'getModuleGraph': {
				const { workspacePath } = arg || {};
				const model = this._getOrCreateModel(workspacePath);
				return model.getModuleGraph();
			}

			// ── Phase 2.8: Knowledge Graph commands ──────────────────────────

			case 'getKnowledgeGraph': {
				const { workspacePath } = arg || {};
				const model = this._getOrCreateModel(workspacePath);
				const snap = model.getSnapshot();
				const graph = KnowledgeGraph.getInstance();
				if (snap) graph.populateFromWorkspace(snap);
				return graph.getSnapshot();
			}
			case 'getWorkspaceHealth': {
				const { workspacePath } = arg || {};
				const model = this._getOrCreateModel(workspacePath);
				const snap = model.getSnapshot();
				if (!snap) return null;
				const calc = new WorkspaceHealthCalculator();
				return calc.calculateHealth(snap);
			}
			case 'queryKnowledgeNeighbors': {
				const { entityId } = arg || {};
				const graph = KnowledgeGraph.getInstance();
				return graph.getNeighbors(entityId);
			}

			default:
				throw new Error(`Unknown ForgeIPCChannel command: ${command}`);
		}
	}

	// ── Private helpers ────────────────────────────────────────────────────────

	private _getOrCreateModel(workspacePath: string): WorkspaceModel {
		if (!this.workspaceModels.has(workspacePath)) {
			this.workspaceModels.set(workspacePath, new WorkspaceModel(workspacePath));
		}
		return this.workspaceModels.get(workspacePath)!;
	}

	private _ensureWatcher(workspacePath: string, model: WorkspaceModel): void {
		if (!this.workspaceWatchers.has(workspacePath)) {
			const watcher = new WorkspaceWatcher(model);
			watcher.start(workspacePath);
			this.workspaceWatchers.set(workspacePath, watcher);
		}
	}
}

// ── Factory (registered in app.ts) ────────────────────────────────────────────

export function createForgeIPCChannel(): ForgeIPCChannel {
	const metadataStore = new MetadataStore();
	const cocoIndex = new CocoIndexCodeService();
	return new ForgeIPCChannel(metadataStore, cocoIndex);
}

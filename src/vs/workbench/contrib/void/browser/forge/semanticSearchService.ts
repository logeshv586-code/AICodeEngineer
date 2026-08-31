/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { registerSingleton, InstantiationType } from '../../../../../platform/instantiation/common/extensions.js';
import { ISemanticSearchService } from '../../common/forge/contracts/ISemanticSearchService.js';
import { FORGE_CHANNEL_NAME } from '../../common/forge/contracts/forgeIPC.js';
import { IndexStats, SemanticSearchHit, SemanticSearchOpts } from '../../common/forge/types/semanticSearchTypes.js';
import { ForgeMainService } from './services/forgeMainService.js';

/**
 * Kept for backward compatibility with older settings migrations. CocoIndex is now an
 * internal Forge runtime and is always prepared for opened code workspaces.
 */
export const COCOINDEX_AUTO_INDEX_STORAGE_KEY = 'forge.cocoindex.autoIndexCodeProjects';

export class SemanticSearchService implements ISemanticSearchService {
	readonly _serviceBrand: undefined;
	private readonly forgeMainService: ForgeMainService;
	private autoPrepareGeneration = 0;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		const channel = mainProcessService.getChannel(FORGE_CHANNEL_NAME);
		this.forgeMainService = new ForgeMainService(channel);

		// Project knowledge is part of the IDE runtime, not a user-facing toggle.
		// Prepare it shortly after startup and whenever workspace folders change.
		setTimeout(() => { void this._autoPrepareOpenWorkspaces(); }, 750);
		this.workspaceContextService.onDidChangeWorkspaceFolders(() => { void this._autoPrepareOpenWorkspaces(); });
	}

	private async _autoPrepareOpenWorkspaces(): Promise<void> {
		const generation = ++this.autoPrepareGeneration;
		const folders = this.workspaceContextService.getWorkspace().folders;
		if (folders.length === 0) return;

		const results = await Promise.allSettled(
			folders.map(folder => this.forgeMainService.autoPrepareCocoIndexWorkspace(folder.uri.fsPath)),
		);

		// Workspace changes can race a slow first-time install. Ignore stale errors and
		// retry the active workspace once; the main process handles install/init/index.
		if (generation !== this.autoPrepareGeneration) return;
		const failed = results.some(result => result.status === 'rejected');
		if (failed) {
			setTimeout(() => {
				if (generation === this.autoPrepareGeneration) void this._autoPrepareOpenWorkspaces();
			}, 2500);
		}
	}

	private getWorkspacePath(): string {
		const folder = this.workspaceContextService.getWorkspace().folders[0];
		return folder ? folder.uri.fsPath : '';
	}

	async search(opts: SemanticSearchOpts, _token?: CancellationToken): Promise<SemanticSearchHit[]> {
		const folders = this.workspaceContextService.getWorkspace().folders;
		if (folders.length === 0) return [];
		const topK = opts.topK || 5;
		const settled = await Promise.allSettled(folders.map(folder =>
			this.forgeMainService.semanticSearch(opts.query, folder.uri.fsPath, topK)));
		const results = settled
			.filter((result): result is PromiseFulfilledResult<SemanticSearchHit[]> => result.status === 'fulfilled')
			.flatMap(result => result.value)
			.sort((a, b) => b.score - a.score)
			.slice(0, topK);
		if (results.length > 0) return results;
		const failure = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
		if (failure) throw failure.reason;
		return [];
	}

	async indexWorkspace(workspacePath?: string, _token?: CancellationToken): Promise<IndexStats> {
		const path = workspacePath || this.getWorkspacePath();
		return this.forgeMainService.indexWorkspace(path);
	}

	async getStats(workspacePath?: string): Promise<IndexStats> {
		const path = workspacePath || this.getWorkspacePath();
		return this.forgeMainService.getIndexStats(path);
	}
}

registerSingleton(ISemanticSearchService, SemanticSearchService, InstantiationType.Eager);

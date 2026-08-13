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
import { IStorageService, StorageScope } from '../../../../../platform/storage/common/storage.js';

export const COCOINDEX_AUTO_INDEX_STORAGE_KEY = 'forge.cocoindex.autoIndexCodeProjects';

export class SemanticSearchService implements ISemanticSearchService {
	readonly _serviceBrand: undefined;
	private readonly forgeMainService: ForgeMainService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IStorageService private readonly storageService: IStorageService,
	) {
		const channel = mainProcessService.getChannel(FORGE_CHANNEL_NAME);
		this.forgeMainService = new ForgeMainService(channel);
		setTimeout(() => { void this._autoPrepareOpenWorkspaces(); }, 1500);
		this.workspaceContextService.onDidChangeWorkspaceFolders(() => { void this._autoPrepareOpenWorkspaces(); });
	}

	private async _autoPrepareOpenWorkspaces(): Promise<void> {
		if (!this.storageService.getBoolean(COCOINDEX_AUTO_INDEX_STORAGE_KEY, StorageScope.APPLICATION, true)) return;
		await Promise.allSettled(this.workspaceContextService.getWorkspace().folders.map(folder =>
			this.forgeMainService.autoPrepareCocoIndexWorkspace(folder.uri.fsPath)));
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

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
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

export class SemanticSearchService implements ISemanticSearchService {
	readonly _serviceBrand: undefined;
	private readonly forgeMainService: ForgeMainService;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService
	) {
		const channel = mainProcessService.getChannel(FORGE_CHANNEL_NAME);
		this.forgeMainService = new ForgeMainService(channel);
	}

	private getWorkspacePath(): string {
		const folder = this.workspaceContextService.getWorkspace().folders[0];
		return folder ? folder.uri.fsPath : '';
	}

	async search(opts: SemanticSearchOpts, _token?: CancellationToken): Promise<SemanticSearchHit[]> {
		const path = opts.pathPattern || this.getWorkspacePath();
		return this.forgeMainService.semanticSearch(opts.query, path, opts.topK || 5);
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

registerSingleton(ISemanticSearchService, SemanticSearchService, InstantiationType.Delayed);

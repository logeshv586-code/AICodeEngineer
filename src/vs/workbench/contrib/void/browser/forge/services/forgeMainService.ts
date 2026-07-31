/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IChannel } from '../../../../../../base/parts/ipc/common/ipc.js';

export class ForgeMainService {
	constructor(private readonly channel: IChannel) { }

	async semanticSearch(query: string, workspacePath: string, topK = 5): Promise<any> {
		return this.channel.call('semanticSearch', { query, workspacePath, topK });
	}

	async indexWorkspace(workspacePath: string, forceReindex = false): Promise<any> {
		return this.channel.call('indexWorkspace', { workspacePath, forceReindex });
	}

	async getIndexStats(workspacePath: string): Promise<any> {
		return this.channel.call('getIndexStats', { workspacePath });
	}

	async getMemory(workspacePath: string): Promise<any> {
		return this.channel.call('getMemory', { workspacePath });
	}

	async saveMemory(workspacePath: string, entry: any): Promise<any> {
		return this.channel.call('saveMemory', { workspacePath, entry });
	}
}

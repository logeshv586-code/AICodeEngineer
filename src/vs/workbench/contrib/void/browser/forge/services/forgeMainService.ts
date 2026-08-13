/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
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

	async getCocoIndexStatus(workspacePath?: string): Promise<any> {
		return this.channel.call('getCocoIndexStatus', { workspacePath });
	}

	async installCocoIndex(): Promise<any> {
		return this.channel.call('installCocoIndex');
	}

	async initializeCocoIndexProject(workspacePath: string): Promise<any> {
		return this.channel.call('initializeCocoIndexProject', { workspacePath });
	}

	async autoPrepareCocoIndexWorkspace(workspacePath: string): Promise<any> {
		return this.channel.call('autoPrepareCocoIndexWorkspace', { workspacePath });
	}

	async disableCocoIndexProject(workspacePath: string): Promise<any> {
		return this.channel.call('disableCocoIndexProject', { workspacePath });
	}

	async getMemory(workspacePath: string): Promise<any> {
		return this.channel.call('getMemory', { workspacePath });
	}

	async saveMemory(workspacePath: string, entry: any): Promise<any> {
		return this.channel.call('saveMemory', { workspacePath, entry });
	}
}

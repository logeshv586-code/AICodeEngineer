/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export const FORGE_CHANNEL_NAME = 'forgeIPCChannel';

export interface ForgeIPCProtocol {
	semanticSearch(opts: { query: string; topK?: number; workspacePath: string }): Promise<any>;
	indexWorkspace(opts: { workspacePath: string; forceReindex?: boolean }): Promise<any>;
	getIndexStats(opts: { workspacePath: string }): Promise<any>;
	getMemory(opts: { workspacePath: string }): Promise<any>;
	saveMemory(opts: { workspacePath: string; entry: any }): Promise<any>;
}

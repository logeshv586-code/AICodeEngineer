/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { BaseForgeAgent } from '../baseAgent.js';
import { CancellationToken } from '../../../../../../../base/common/cancellation.js';

export class RAGAgent extends BaseForgeAgent {
	constructor() {
		super({
			name: 'RAG Knowledge Agent',
			role: 'RAGAgent',
			systemPrompt: 'You are a repository understanding specialist that performs vector semantic search and project memory retrieval.',
			allowedCapabilities: ['semantic_search', 'project_memory_search', 'get_dir_tree', 'read_file']
		});
	}

	protected async runTask(task: string, _context: Record<string, any>, _token?: CancellationToken): Promise<any> {
		return { action: 'context_retrieved', summary: `Retrieved semantic hits and rules for: ${task}` };
	}
}

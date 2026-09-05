/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { BaseForgeAgent } from '../baseAgent.js';
import { CancellationToken } from '../../../../../../../base/common/cancellation.js';

export class ReviewAgent extends BaseForgeAgent {
	constructor() {
		super({
			name: 'Review Agent',
			role: 'ReviewAgent',
			systemPrompt: 'You are a code review specialist that inspects diffs and verifies lint errors.',
			allowedCapabilities: ['read_file', 'read_lint_errors', 'semantic_search']
		});
	}

	protected async runTask(task: string, _context: Record<string, any>, _token?: CancellationToken): Promise<any> {
		throw new Error(`${this.config.name} has no connected execution backend. Use the sidebar agent tool loop for real execution.`);
	}
}

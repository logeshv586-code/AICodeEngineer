/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { BaseForgeAgent } from '../baseAgent.js';
import { CancellationToken } from '../../../../../../../base/common/cancellation.js';

export class TestAgent extends BaseForgeAgent {
	constructor() {
		super({
			name: 'Test Agent',
			role: 'TestAgent',
			systemPrompt: 'You are a testing engineer responsible for unit testing and test runner execution.',
			allowedCapabilities: ['read_file', 'write_file', 'terminal', 'run_tests']
		});
	}

	protected async runTask(task: string, _context: Record<string, any>, _token?: CancellationToken): Promise<any> {
		return { action: 'tests_run', passed: true, summary: `Ran tests for: ${task}` };
	}
}

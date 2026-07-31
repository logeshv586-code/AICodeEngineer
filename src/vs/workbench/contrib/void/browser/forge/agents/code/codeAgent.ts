/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { BaseForgeAgent } from '../baseAgent.js';
import { CancellationToken } from '../../../../../../../base/common/cancellation.js';

export class CodeEngineerAgent extends BaseForgeAgent {
	constructor() {
		super({
			name: 'Code Engineer',
			role: 'CodeEngineer',
			systemPrompt: 'You are an expert full-stack code engineer responsible for implementing clean, robust, type-safe modifications.',
			allowedCapabilities: ['read_file', 'write_file', 'edit_file', 'rewrite_file', 'semantic_search', 'terminal', 'git', 'read_lint_errors']
		});
	}

	protected async runTask(task: string, _context: Record<string, any>, _token?: CancellationToken): Promise<any> {
		return { action: 'code_engineered', description: `Implemented task: ${task}` };
	}
}

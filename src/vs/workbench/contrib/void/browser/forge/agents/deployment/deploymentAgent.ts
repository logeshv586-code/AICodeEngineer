/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { BaseForgeAgent } from '../baseAgent.js';
import { CancellationToken } from '../../../../../../../base/common/cancellation.js';

export class DeploymentAgent extends BaseForgeAgent {
	constructor() {
		super({
			name: 'Deployment Agent',
			role: 'DeploymentAgent',
			systemPrompt: 'You are a deployment specialist handling git commits, branch management, and CI/CD triggers.',
			allowedCapabilities: ['git', 'terminal', 'mcp']
		});
	}

	protected async runTask(task: string, _context: Record<string, any>, _token?: CancellationToken): Promise<any> {
		throw new Error(`${this.config.name} has no connected execution backend. Use the sidebar agent tool loop for real execution.`);
	}
}

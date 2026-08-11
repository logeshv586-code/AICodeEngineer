/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { BaseForgeAgent } from '../baseAgent.js';
import { CancellationToken } from '../../../../../../../base/common/cancellation.js';

export class WebResearchAgent extends BaseForgeAgent {
	constructor() {
		super({
			name: 'Web Research Agent',
			role: 'WebResearchAgent',
			systemPrompt: 'You are a web crawling and documentation extraction agent.',
			allowedCapabilities: ['web_crawl', 'markdown_extraction']
		});
	}

	protected async runTask(task: string, _context: Record<string, any>, _token?: CancellationToken): Promise<any> {
		return { action: 'web_scraped', content: `Crawled external documentation for query: ${task}` };
	}
}

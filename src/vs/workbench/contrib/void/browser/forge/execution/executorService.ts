/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ToolInvocationSpec } from '../../../common/forge/planner/planSchema.js';
import { ForgeToolRegistry } from './forgeToolRegistry.js';

export class ForgeExecutorService {
	constructor(private readonly toolRegistry: ForgeToolRegistry) { }

	async executeToolCall(spec: ToolInvocationSpec): Promise<any> {
		const tool = this.toolRegistry.getTool(spec.toolName);
		if (!tool) {
			throw new Error(`Tool not registered in ForgeToolRegistry: ${spec.toolName}`);
		}
		return tool.handler(spec.params);
	}
}

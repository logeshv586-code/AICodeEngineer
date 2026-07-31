/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { AgentStatus } from './agentDescriptor.js';
import { ExecutionBus } from '../bus/executionBus.js';

export class AgentLifecycleManager {
	private readonly states = new Map<string, AgentStatus>();

	constructor(
		private readonly bus: ExecutionBus = ExecutionBus.getInstance()
	) { }

	setStatus(agentId: string, status: AgentStatus): void {
		this.states.set(agentId, status);
		this.bus.publish('WORKER_ASSIGNED', { agentId, status });
	}

	getStatus(agentId: string): AgentStatus {
		return this.states.get(agentId) || 'Idle';
	}
}

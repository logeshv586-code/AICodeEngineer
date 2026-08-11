/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { DelegationRequest, DelegationMatch } from './collaborationTypes.js';
import { AgentRegistry } from '../agents/agentRegistry.js';

export class DelegationManager {
	constructor(
		private readonly registry: AgentRegistry = AgentRegistry.getInstance()
	) { }

	findBestAgent(request: DelegationRequest): DelegationMatch | undefined {
		const candidates = this.registry.getAgentsByRole(request.requiredRole);
		if (candidates.length === 0) {
			const fallback = this.registry.getAllAgents()[0];
			if (!fallback) return undefined;
			return { agentId: fallback.id, agentName: fallback.name, matchScore: 0.5 };
		}

		// Pick agent with lowest current load
		const sorted = candidates.sort((a, b) => a.health.currentLoad - b.health.currentLoad);
		const best = sorted[0];
		return {
			agentId: best.id,
			agentName: best.name,
			matchScore: 0.95
		};
	}
}

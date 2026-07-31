/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { AgentDescriptor } from './agentDescriptor.js';

export class AgentRegistry {
	private static instance?: AgentRegistry;
	private readonly agents = new Map<string, AgentDescriptor>();

	public static getInstance(): AgentRegistry {
		if (!this.instance) {
			this.instance = new AgentRegistry();
			this.instance._registerDefaults();
		}
		return this.instance;
	}

	registerAgent(agent: AgentDescriptor): void {
		this.agents.set(agent.id, agent);
	}

	getAgent(id: string): AgentDescriptor | undefined {
		return this.agents.get(id);
	}

	getAllAgents(): AgentDescriptor[] {
		return Array.from(this.agents.values());
	}

	getAgentsByRole(role: AgentDescriptor['role']): AgentDescriptor[] {
		return Array.from(this.agents.values()).filter(a => a.role === role);
	}

	private _registerDefaults(): void {
		const defaults: AgentDescriptor[] = [
			{
				id: 'agent-workspace-code',
				name: 'Workspace Code Specialist',
				role: 'workspace',
				capabilities: ['workspace_edit', 'ast_inspect'],
				maxConcurrency: 3,
				priority: 10,
				health: { isHealthy: true, currentLoad: 15, lastActiveAt: Date.now() }
			},
			{
				id: 'agent-browser-web',
				name: 'Browser Web Specialist',
				role: 'browser',
				capabilities: ['web_browse', 'dom_inspect'],
				maxConcurrency: 2,
				priority: 8,
				health: { isHealthy: true, currentLoad: 5, lastActiveAt: Date.now() }
			},
			{
				id: 'agent-review-gate',
				name: 'Code Review Gatekeeper',
				role: 'review',
				capabilities: ['lint_check', 'diff_review'],
				maxConcurrency: 2,
				priority: 9,
				health: { isHealthy: true, currentLoad: 0, lastActiveAt: Date.now() }
			},
			{
				id: 'agent-[#6C5CE7]-security',
				name: 'Security & Audit Specialist',
				role: 'security',
				capabilities: ['security_scan', 'vulnerability_check'],
				maxConcurrency: 2,
				priority: 9,
				health: { isHealthy: true, currentLoad: 0, lastActiveAt: Date.now() }
			},
			{
				id: 'agent-testing-runner',
				name: 'Testing & Verification Agent',
				role: 'testing',
				capabilities: ['unit_test', 'playwright_test'],
				maxConcurrency: 2,
				priority: 8,
				health: { isHealthy: true, currentLoad: 10, lastActiveAt: Date.now() }
			}
		];

		for (const agent of defaults) {
			this.registerAgent(agent);
		}
	}
}

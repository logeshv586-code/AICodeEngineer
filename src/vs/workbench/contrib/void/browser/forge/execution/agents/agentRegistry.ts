/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
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
		const now = Date.now();
		const defaults: AgentDescriptor[] = [
			{
				id: 'agent-workspace-code',
				name: 'Workspace Code Specialist',
				role: 'workspace',
				capabilities: ['workspace_read', 'workspace_edit', 'ast_inspect', 'terminal', 'git', 'semantic_search'],
				maxConcurrency: 3,
				priority: 10,
				health: { isHealthy: true, currentLoad: 15, lastActiveAt: now }
			},
			{
				id: 'agent-browser-web',
				name: 'Browser & Web Operator',
				role: 'browser',
				capabilities: ['web_browse', 'dom_inspect', 'playwright', 'browser_control', 'screenshot'],
				maxConcurrency: 2,
				priority: 9,
				health: { isHealthy: true, currentLoad: 5, lastActiveAt: now }
			},
			{
				id: 'agent-knowledge-graph',
				name: 'Codebase Knowledge Specialist',
				role: 'knowledge',
				capabilities: ['semantic_search', 'code_graph', 'project_memory_search', 'impact_analysis'],
				maxConcurrency: 2,
				priority: 10,
				health: { isHealthy: true, currentLoad: 0, lastActiveAt: now }
			},
			{
				id: 'agent-design-studio',
				name: 'Design & Prototype Specialist',
				role: 'design',
				capabilities: ['design_generate', 'browser_control', 'screenshot', 'workspace_edit'],
				maxConcurrency: 2,
				priority: 8,
				health: { isHealthy: true, currentLoad: 0, lastActiveAt: now }
			},
			{
				id: 'agent-work-automation',
				name: 'Work Mode Automation Specialist',
				role: 'automation',
				capabilities: ['workflow_automation', 'terminal', 'browser_control', 'mcp'],
				maxConcurrency: 2,
				priority: 8,
				health: { isHealthy: true, currentLoad: 0, lastActiveAt: now }
			},
			{
				id: 'agent-learning-loop',
				name: 'Offline Learning & Skill Evolution',
				role: 'learning',
				capabilities: ['rl_trace', 'skill_evolution', 'diff_review', 'run_tests'],
				maxConcurrency: 1,
				priority: 6,
				health: { isHealthy: true, currentLoad: 0, lastActiveAt: now }
			},
			{
				id: 'agent-review-gate',
				name: 'Code Review Gatekeeper',
				role: 'review',
				capabilities: ['lint_check', 'diff_review'],
				maxConcurrency: 2,
				priority: 9,
				health: { isHealthy: true, currentLoad: 0, lastActiveAt: now }
			},
			{
				id: 'agent-security',
				name: 'Security & Audit Specialist',
				role: 'security',
				capabilities: ['security_scan', 'vulnerability_check', 'diff_review'],
				maxConcurrency: 2,
				priority: 9,
				health: { isHealthy: true, currentLoad: 0, lastActiveAt: now }
			},
			{
				id: 'agent-testing-runner',
				name: 'Testing & Verification Agent',
				role: 'testing',
				capabilities: ['unit_test', 'playwright_test', 'lint_check'],
				maxConcurrency: 2,
				priority: 8,
				health: { isHealthy: true, currentLoad: 10, lastActiveAt: now }
			}
		];

		for (const agent of defaults) {
			this.registerAgent(agent);
		}
	}
}

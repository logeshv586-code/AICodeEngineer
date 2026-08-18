/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { classifyForgeTask } from '../../../common/forge/intelligence/taskProfile.js';
import { PlannerOutput, PlanStep } from '../../../common/forge/planner/planSchema.js';
import { TaskDependencyNode } from '../../../common/forge/types/schedulerTypes.js';

export class ForgePlannerService {
	async createPlan(userQuery: string, _token?: CancellationToken): Promise<PlannerOutput> {
		const profile = classifyForgeTask(userQuery);
		const steps: PlanStep[] = [];
		const nodes: TaskDependencyNode[] = [];
		let stepId = 1;

		const addStep = (step: Omit<PlanStep, 'id' | 'status'>) => {
			const id = stepId++;
			steps.push({ ...step, id, status: 'pending' });
			return id;
		};
		const addNode = (node: TaskDependencyNode) => nodes.push(node);

		const discoveryStep = addStep({
			stage: 'Discovery',
			title: profile.needsCodeGraph ? 'Incremental codebase understanding' : 'Focused workspace discovery',
			description: profile.needsCodeGraph
				? 'Use semantic search and the Understand Anything graph when present; load only the relevant graph slices into context.'
				: 'Read the minimum relevant files and use semantic search before editing.',
			toolCalls: [
				{ toolName: 'semantic_search', params: { query: userQuery } },
				...(profile.needsCodeGraph ? [{ toolName: 'forge_understand', params: { action: 'search', query: userQuery } }] : [])
			]
		});
		addNode({
			id: 'task-discovery',
			title: 'Discover relevant code and project context',
			description: profile.needsCodeGraph ? 'Incremental graph + semantic discovery' : 'Lean semantic discovery',
			assignedAgentRole: profile.needsCodeGraph ? 'KnowledgeAgent' : 'RAGAgent',
			dependsOn: [],
			canRunInParallel: true,
			params: { contextPolicy: profile.contextPolicy }
		});

		let externalStep: number | undefined;
		if (profile.kind === 'research' || profile.needsBrowser) {
			externalStep = addStep({
				stage: 'Discovery',
				title: profile.needsBrowser ? 'Browser inspection & live verification' : 'External documentation research',
				description: profile.needsBrowser
					? 'Use the persistent Playwright browser to inspect the real page, DOM, forms, and screenshots.'
					: 'Collect only the external documentation needed to make the implementation decision.',
				toolCalls: profile.needsBrowser ? [{ toolName: 'forge_browser', params: { action: 'snapshot' } }] : undefined,
			});
			addNode({
				id: 'task-external',
				title: profile.needsBrowser ? 'Inspect live browser state' : 'Research external references',
				description: profile.needsBrowser ? 'Playwright browser operator' : 'Web/documentation research',
				assignedAgentRole: profile.needsBrowser ? 'UIAutomationAgent' : 'WebResearchAgent',
				dependsOn: [],
				canRunInParallel: true,
			});
		}

		const designDependencies = [discoveryStep, ...(externalStep ? [externalStep] : [])];
		const designStep = addStep({
			stage: 'Design',
			title: profile.needsDesign
				? 'Design system & implementation blueprint'
				: profile.needsAutomation
					? 'Automation workflow design'
					: 'Implementation strategy',
			description: profile.needsDesign
				? 'Use Open Design only for visual/design tasks; preserve canonical project files in the workspace.'
				: profile.needsAutomation
					? 'Define triggers, approvals, retries, and safe unattended boundaries before scheduling work.'
					: 'Choose the smallest coherent change set, verification strategy, and rollback boundary.',
			dependsOnStepIds: designDependencies,
			toolCalls: profile.needsDesign
				? [{ toolName: 'forge_sidecar', params: { action: 'status', name: 'open-design' } }]
				: profile.needsAutomation
					? [{ toolName: 'forge_workflow', params: { action: 'list' } }]
					: undefined,
		});
		addNode({
			id: 'task-design',
			title: 'Design the change',
			description: `Task profile: ${profile.kind}; complexity ${profile.complexity.toFixed(2)}`,
			assignedAgentRole: profile.needsDesign ? 'DesignAgent' : profile.needsAutomation ? 'AutomationAgent' : 'BrainManager',
			dependsOn: ['task-discovery', ...(externalStep ? ['task-external'] : [])],
			canRunInParallel: false,
		});

		const buildStep = addStep({
			stage: 'Build',
			title: profile.needsAutomation ? 'Implement code and workflow automation' : 'Implement the requested change',
			description: 'Read before edit, use the workspace tools, keep changes scoped, and continue until the requested task is materially complete.',
			dependsOnStepIds: [designStep],
		});
		addNode({
			id: 'task-build',
			title: 'Implement the change',
			description: 'Workspace edits, terminal operations, and integration calls as required',
			assignedAgentRole: profile.needsAutomation ? 'AutomationAgent' : 'CodeEngineer',
			dependsOn: ['task-design'],
			canRunInParallel: false,
		});

		let testStep: number | undefined;
		if (profile.needsTests || profile.kind !== 'quick') {
			testStep = addStep({
				stage: 'Test',
				title: profile.needsBrowser ? 'Run code tests and browser verification' : 'Run targeted verification',
				description: 'Prefer targeted lint/tests first, then broader build or integration tests when the changed surface requires them.',
				dependsOnStepIds: [buildStep],
			});
			addNode({
				id: 'task-test',
				title: 'Verify the implementation',
				description: profile.needsBrowser ? 'Code tests plus Playwright/browser checks' : 'Tests, lint, and build validation',
				assignedAgentRole: 'TestAgent',
				dependsOn: ['task-build'],
				canRunInParallel: false,
			});
		}

		addStep({
			stage: 'Review',
			title: profile.needsSecurityReview ? 'Security, diff, and regression review' : 'Diff, regression, and completion review',
			description: 'Check the final diff against the user request, remove accidental changes, verify tests, and record a sanitized learning outcome for offline improvement.',
			dependsOnStepIds: [buildStep, ...(testStep ? [testStep] : [])],
			toolCalls: [{ toolName: 'forge_learning', params: { action: 'record' } }]
		});
		addNode({
			id: 'task-review',
			title: 'Review and close the loop',
			description: profile.needsSecurityReview ? 'Security + code review gate' : 'Code review + learning trace',
			assignedAgentRole: profile.needsSecurityReview ? 'ReviewAgent' : 'LearningAgent',
			dependsOn: ['task-build', ...(testStep ? ['task-test'] : [])],
			canRunInParallel: false,
		});

		return {
			goal: userQuery,
			summary: `Adaptive ${profile.kind} plan using ${profile.contextPolicy} context and ${profile.preferredModelClass} model preference. Integrations: ${profile.suggestedIntegrations.join(', ') || 'none'}.`,
			estimatedRisk: profile.needsSecurityReview || profile.needsAutomation || profile.complexity >= 0.8
				? 'high'
				: profile.complexity >= 0.5
					? 'medium'
					: 'low',
			steps,
			dependencyGraph: { nodes },
		};
	}
}

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { PlannerOutput } from '../../../common/forge/planner/planSchema.js';

export class ForgePlannerService {
	async createPlan(userQuery: string, _token?: CancellationToken): Promise<PlannerOutput> {
		return {
			goal: userQuery,
			summary: `Structured multi-agent execution plan for: "${userQuery}"`,
			estimatedRisk: 'low',
			steps: [
				{
					id: 1,
					stage: 'Discovery',
					title: 'Codebase understanding & RAG index search',
					description: 'Query local vector store and project memory for relevant context',
					status: 'pending',
					toolCalls: [
						{ toolName: 'semantic_search', params: { query: userQuery } }
					]
				},
				{
					id: 2,
					stage: 'Discovery',
					title: 'Web research & documentation extraction',
					description: 'Retrieve external docs and reference material',
					status: 'pending'
				},
				{
					id: 3,
					stage: 'Design',
					title: 'Formulate architecture & implementation plan',
					description: 'Synthesize context into concrete file changes',
					status: 'pending',
					dependsOnStepIds: [1, 2]
				},
				{
					id: 4,
					stage: 'Build',
					title: 'Engineer code modifications',
					description: 'Apply code edits to workspace files',
					status: 'pending',
					dependsOnStepIds: [3]
				},
				{
					id: 5,
					stage: 'Test',
					title: 'Execute unit test suite',
					description: 'Run test suite and verify build integrity',
					status: 'pending',
					dependsOnStepIds: [4]
				},
				{
					id: 6,
					stage: 'Review',
					title: 'Code review & diff approval',
					description: 'Validate diff and lint errors before committing',
					status: 'pending',
					dependsOnStepIds: [4, 5]
				}
			],
			dependencyGraph: {
				nodes: [
					{
						id: 'task-1',
						title: 'Codebase understanding & RAG index search',
						description: 'Query vector index',
						assignedAgentRole: 'RAGAgent',
						dependsOn: [],
						canRunInParallel: true
					},
					{
						id: 'task-2',
						title: 'Web research & documentation extraction',
						description: 'Crawl docs',
						assignedAgentRole: 'WebResearchAgent',
						dependsOn: [],
						canRunInParallel: true
					},
					{
						id: 'task-3',
						title: 'Engineer code modifications',
						description: 'Apply code edits',
						assignedAgentRole: 'CodeEngineer',
						dependsOn: ['task-1', 'task-2'],
						canRunInParallel: false
					},
					{
						id: 'task-4',
						title: 'Execute unit test suite',
						description: 'Run test suite',
						assignedAgentRole: 'TestAgent',
						dependsOn: ['task-3'],
						canRunInParallel: false
					},
					{
						id: 'task-5',
						title: 'Code review & diff approval',
						description: 'Validate diffs',
						assignedAgentRole: 'ReviewAgent',
						dependsOn: ['task-3', 'task-4'],
						canRunInParallel: false
					}
				]
			}
		};
	}
}

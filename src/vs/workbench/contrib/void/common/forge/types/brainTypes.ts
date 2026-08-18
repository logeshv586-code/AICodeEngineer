/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type ForgeAgentStage = 'Discovery' | 'Design' | 'Build' | 'Test' | 'Review';

export type ForgeRunStatus = 'idle' | 'planning' | 'waiting_approval' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type AgentRole =
	| 'BrainManager'
	| 'CodeEngineer'
	| 'RAGAgent'
	| 'WebResearchAgent'
	| 'ReviewAgent'
	| 'TestAgent'
	| 'DeploymentAgent'
	| 'UIAutomationAgent'
	| 'DesignAgent'
	| 'AutomationAgent'
	| 'KnowledgeAgent'
	| 'LearningAgent';

export type AgentState =
	| 'idle'
	| 'planning'
	| 'queued'
	| 'running'
	| 'waiting'
	| 'completed'
	| 'review'
	| 'done'
	| 'failed';

export type AgentCapability =
	| 'read_file'
	| 'write_file'
	| 'edit_file'
	| 'rewrite_file'
	| 'semantic_search'
	| 'project_memory_search'
	| 'get_dir_tree'
	| 'terminal'
	| 'git'
	| 'web_crawl'
	| 'markdown_extraction'
	| 'screenshot'
	| 'playwright'
	| 'browser_control'
	| 'mcp'
	| 'read_lint_errors'
	| 'run_tests'
	| 'code_graph'
	| 'design_generate'
	| 'workflow_automation'
	| 'skill_evolution'
	| 'rl_trace';

export interface ForgeTaskContext {
	readonly taskId: string;
	readonly userQuery: string;
	readonly workspacePath: string;
	readonly activeFileUri?: string;
	readonly createdAt: number;
}

export interface ForgeWorkerConfig {
	readonly name: string;
	readonly role: AgentRole;
	readonly systemPrompt: string;
	readonly allowedCapabilities: AgentCapability[];
	readonly maxSteps?: number;
}

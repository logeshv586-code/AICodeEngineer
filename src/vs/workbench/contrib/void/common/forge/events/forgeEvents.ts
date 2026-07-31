/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { PlannerOutput, PlanStep } from '../planner/planSchema.js';
import { SemanticSearchHit } from '../types/semanticSearchTypes.js';
import { TaskDependencyNode } from '../types/schedulerTypes.js';
import { WorkspaceSnapshot } from '../types/workspaceTypes.js';
import { BrowserPage, BrowserTabState, DOMSelection } from '../types/browserTypes.js';

export type ForgeEventType =
	| 'PLAN_CREATED'
	| 'PLAN_STEP_UPDATED'
	| 'GRAPH_BUILT'
	| 'AGENT_STARTED'
	| 'AGENT_FINISHED'
	| 'AGENT_FAILED'
	| 'TASK_QUEUED'
	| 'TASK_RUNNING'
	| 'TASK_COMPLETED'
	| 'TASK_FAILED'
	| 'SCHEDULER_TICK'
	| 'CAPABILITY_INVOKED'
	| 'SEARCH_STARTED'
	| 'SEARCH_FINISHED'
	| 'TOOL_STARTED'
	| 'TOOL_FINISHED'
	| 'PATCH_CREATED'
	| 'PATCH_ACCEPTED'
	| 'PATCH_REJECTED'
	| 'RUN_COMPLETED'
	| 'RUN_FAILED'
	// Workspace Intelligence events (Phase 2)
	| 'WORKSPACE_SCAN_STARTED'
	| 'WORKSPACE_SCAN_COMPLETED'
	| 'WORKSPACE_FILE_UPDATED'
	| 'WORKSPACE_FILE_REMOVED'
	// Browser Intelligence events (Phase 2.5)
	| 'BROWSER_TAB_CREATED'
	| 'BROWSER_TAB_CLOSED'
	| 'BROWSER_URL_CHANGED'
	| 'BROWSER_PAGE_LOADED'
	| 'BROWSER_SELECTION_CHANGED'
	| 'BROWSER_CAPTURE_CREATED'
	| 'BROWSER_CONTEXT_UPDATED'
	| 'BROWSER_PINNED'
	| 'BROWSER_BOOKMARKED';

export interface ForgeEvent<T = any> {
	readonly id: string;
	readonly type: ForgeEventType;
	readonly timestamp: number;
	readonly payload: T;
}

export type PlanCreatedPayload = { plan: PlannerOutput };
export type PlanStepUpdatedPayload = { stepId: number; step: PlanStep };
export type GraphBuiltPayload = { nodes: TaskDependencyNode[] };
export type AgentStartedPayload = { agentRole: string; taskId: string };
export type AgentFinishedPayload = { agentRole: string; taskId: string; result: any };
export type AgentFailedPayload = { agentRole: string; taskId: string; error: string };
export type TaskQueuedPayload = { taskId: string; title: string };
export type TaskRunningPayload = { taskId: string; title: string };
export type TaskCompletedPayload = { taskId: string; title: string };
export type TaskFailedPayload = { taskId: string; error: string };
export type SchedulerTickPayload = { activeCount: number; remainingCount: number };
export type CapabilityInvokedPayload = { capability: string; params: Record<string, any> };
export type SearchStartedPayload = { query: string };
export type SearchFinishedPayload = { query: string; hits: SemanticSearchHit[] };
export type ToolStartedPayload = { toolName: string; params: Record<string, any> };
export type ToolFinishedPayload = { toolName: string; result: any; error?: string };
export type PatchCreatedPayload = { filePath: string; diff: string };
export type PatchAcceptedPayload = { filePath: string };
export type PatchRejectedPayload = { filePath: string };
export type RunCompletedPayload = { taskId: string; summary: string };
export type RunFailedPayload = { taskId: string; error: string };
// Workspace Intelligence payloads
export type WorkspaceScanStartedPayload = { workspacePath: string };
export type WorkspaceScanCompletedPayload = { snapshot: WorkspaceSnapshot };
export type WorkspaceFileUpdatedPayload = { filePath: string };
export type WorkspaceFileRemovedPayload = { filePath: string };
// Browser Intelligence payloads
export type BrowserTabCreatedPayload = { tab: BrowserTabState };
export type BrowserTabClosedPayload = { tabId: string };
export type BrowserUrlChangedPayload = { tabId: string; url: string };
export type BrowserPageLoadedPayload = { tabId: string; page: BrowserPage };
export type BrowserSelectionChangedPayload = { tabId: string; selection: DOMSelection | null };
export type BrowserCaptureCreatedPayload = { tabId: string; captureType: string; data: any };
export type BrowserContextUpdatedPayload = { tabId: string; summary: string };
export type BrowserPinnedPayload = { tabId: string; isPinned: boolean };
export type BrowserBookmarkedPayload = { tabId: string; isBookmarked: boolean };

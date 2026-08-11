/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useCallback } from 'react';
import { ForgeEventBus } from '../../../../forge/events/forgeEventBus.js';
import { ForgeEventType, ForgeEvent } from '../../../../common/forge/events/forgeEvents.js';
import { PlanStep } from '../../../../common/forge/planner/planSchema.js';

// ─── Stream Event Types ──────────────────────────────────────────────────────

// These are the UI-visible events the conversation renders.
// Each one maps 1:1 to a backend ForgeEvent type but is shaped for display.

export type StreamEventKind =
	// Thinking / planning
	| 'thinking'
	| 'plan_started'
	| 'plan_step_update'
	| 'plan_completed'
	// Execution
	| 'execution_started'
	| 'execution_completed'
	| 'execution_failed'
	// Agent activity
	| 'agent_started'
	| 'agent_finished'
	| 'agent_failed'
	// Tool calls
	| 'tool_started'
	| 'tool_finished'
	| 'tool_failed'
	// Search
	| 'search_started'
	| 'search_result'
	| 'search_completed'
	// Workspace
	| 'workspace_scan_started'
	| 'workspace_scan_completed'
	| 'file_read'
	| 'file_written'
	| 'file_edited'
	// Web / Browser
	| 'browser_opened'
	| 'browser_navigated'
	| 'browser_result'
	| 'browser_closed'
	// Memory
	| 'memory_used'
	// System
	| 'patch_created'
	| 'patch_accepted'
	| 'patch_rejected'
	| 'run_completed'
	| 'run_failed'
	| 'status';

export interface StreamEvent {
	readonly id: string;
	readonly kind: StreamEventKind;
	readonly timestamp: number;
	readonly label: string;
	readonly detail?: string;
	readonly status: 'active' | 'done' | 'failed';
	readonly duration?: number;
	readonly meta?: Record<string, any>;
}

export interface StreamState {
	readonly events: StreamEvent[];
	readonly isRunning: boolean;
	readonly currentStep?: StreamEvent;
}

// ─── Event Transformer ───────────────────────────────────────────────────────

let eventCounter = 0;

function nextId(): string {
	return `evt_${Date.now()}_${++eventCounter}`;
}

function transformForgeEvent(event: ForgeEvent): StreamEvent | null {
	const { type, payload, timestamp } = event;
	const startedAt = timestamp;

	switch (type) {
		// ── Plan ───────────────────────────────────────────────────────────
		case 'PLAN_CREATED': {
			const plan = (payload as any)?.plan;
			const steps: PlanStep[] = plan?.steps ?? [];
			return {
				id: nextId(),
				kind: 'plan_started',
				timestamp: startedAt,
				label: `Planning (${steps.length} steps)`,
				status: 'done',
				meta: { steps, plan },
			};
		}

		case 'PLAN_STEP_UPDATED': {
			const { stepId, step } = payload as { stepId: number; step: PlanStep };
			return {
				id: nextId(),
				kind: 'plan_step_update',
				timestamp: startedAt,
				label: step.title || `Step ${stepId}`,
				detail: step.stage,
				status: step.status === 'completed' ? 'done' : step.status === 'failed' ? 'failed' : 'active',
				meta: { stepId, step },
			};
		}

		// ── Execution ──────────────────────────────────────────────────────
		case 'TASK_QUEUED': {
			const { title } = payload as { taskId: string; title: string };
			return {
				id: nextId(),
				kind: 'execution_started',
				timestamp: startedAt,
				label: title || 'Task queued',
				status: 'active',
			};
		}

		case 'TASK_RUNNING': {
			const { title } = payload as { taskId: string; title: string };
			return {
				id: nextId(),
				kind: 'execution_started',
				timestamp: startedAt,
				label: title || 'Running',
				status: 'active',
			};
		}

		case 'TASK_COMPLETED':
		case 'RUN_COMPLETED': {
			const { summary } = payload as { taskId: string; summary?: string };
			return {
				id: nextId(),
				kind: 'execution_completed',
				timestamp: startedAt,
				label: 'Done',
				detail: summary,
				status: 'done',
			};
		}

		case 'TASK_FAILED':
		case 'RUN_FAILED': {
			const { error } = payload as { taskId: string; error?: string };
			return {
				id: nextId(),
				kind: 'execution_failed',
				timestamp: startedAt,
				label: 'Failed',
				detail: error,
				status: 'failed',
			};
		}

		// ── Agents ─────────────────────────────────────────────────────────
		// NEVER expose internal agent names to the user.
		// Map to human-readable activity labels.
		case 'AGENT_STARTED': {
			const { agentRole, taskId } = payload as { agentRole: string; taskId: string };
			return {
				id: nextId(),
				kind: 'agent_started',
				timestamp: startedAt,
				label: humanizeAgentLabel(agentRole),
				detail: undefined,
				status: 'active',
				meta: { agentRole, taskId },
			};
		}

		case 'AGENT_FINISHED': {
			const { agentRole } = payload as { agentRole: string; taskId: string; result: any };
			return {
				id: nextId(),
				kind: 'agent_finished',
				timestamp: startedAt,
				label: humanizeAgentLabel(agentRole),
				detail: undefined,
				status: 'done',
				meta: { agentRole },
			};
		}

		case 'AGENT_FAILED': {
			const { agentRole, error } = payload as { agentRole: string; taskId: string; error: string };
			return {
				id: nextId(),
				kind: 'agent_failed',
				timestamp: startedAt,
				label: humanizeAgentLabel(agentRole),
				detail: undefined,
				status: 'failed',
			};
		}

		// ── Tools ──────────────────────────────────────────────────────────
		case 'TOOL_STARTED': {
			const { toolName, params } = payload as { toolName: string; params: Record<string, any> };
			const detail = params?.filePath || params?.query || params?.url || '';
			return {
				id: nextId(),
				kind: 'tool_started',
				timestamp: startedAt,
				label: formatToolName(toolName),
				detail,
				status: 'active',
				meta: { toolName, params },
			};
		}

		case 'TOOL_FINISHED': {
			const { toolName, result, error } = payload as { toolName: string; result: any; error?: string };
			return {
				id: nextId(),
				kind: error ? 'tool_failed' : 'tool_finished',
				timestamp: startedAt,
				label: formatToolName(toolName),
				detail: typeof result === 'string' ? result?.slice(0, 120) : '',
				status: error ? 'failed' : 'done',
				meta: { toolName, result, error },
			};
		}

		// ── Search ─────────────────────────────────────────────────────────
		case 'SEARCH_STARTED': {
			const { query } = payload as { query: string };
			return {
				id: nextId(),
				kind: 'search_started',
				timestamp: startedAt,
				label: 'Searching',
				detail: query,
				status: 'active',
			};
		}

		case 'SEARCH_FINISHED': {
			const { hits } = payload as { query: string; hits: any[] };
			return {
				id: nextId(),
				kind: 'search_completed',
				timestamp: startedAt,
				label: `${hits?.length ?? 0} results`,
				status: 'done',
				meta: { hitCount: hits?.length ?? 0 },
			};
		}

		// ── Workspace ──────────────────────────────────────────────────────
		case 'WORKSPACE_SCAN_STARTED': {
			return {
				id: nextId(),
				kind: 'workspace_scan_started',
				timestamp: startedAt,
				label: 'Scanning workspace',
				status: 'active',
			};
		}

		case 'WORKSPACE_SCAN_COMPLETED': {
			const snapshot = (payload as any)?.snapshot;
			const fileCount = snapshot?.fileCount ?? 0;
			return {
				id: nextId(),
				kind: 'workspace_scan_completed',
				timestamp: startedAt,
				label: 'Workspace indexed',
				detail: `${fileCount.toLocaleString()} files`,
				status: 'done',
				meta: { fileCount },
			};
		}

		case 'WORKSPACE_FILE_UPDATED': {
			const { filePath } = payload as { filePath: string };
			return {
				id: nextId(),
				kind: 'file_edited',
				timestamp: startedAt,
				label: 'File updated',
				detail: filePath,
				status: 'done',
			};
		}

		case 'WORKSPACE_FILE_REMOVED': {
			const { filePath } = payload as { filePath: string };
			return {
				id: nextId(),
				kind: 'file_edited',
				timestamp: startedAt,
				label: 'File removed',
				detail: filePath,
				status: 'done',
			};
		}

		// ── Browser ────────────────────────────────────────────────────────
		case 'BROWSER_TAB_CREATED':
		case 'BROWSER_URL_CHANGED': {
			const tab = (payload as any)?.tab;
			return {
				id: nextId(),
				kind: 'browser_navigated',
				timestamp: startedAt,
				label: 'Browsing',
				detail: tab?.url ?? '',
				status: 'active',
			};
		}

		case 'BROWSER_PAGE_LOADED': {
			const page = (payload as any)?.page;
			return {
				id: nextId(),
				kind: 'browser_result',
				timestamp: startedAt,
				label: 'Page loaded',
				detail: page?.title ?? page?.url ?? '',
				status: 'done',
			};
		}

		case 'BROWSER_TAB_CLOSED': {
			return {
				id: nextId(),
				kind: 'browser_closed',
				timestamp: startedAt,
				label: 'Browser closed',
				status: 'done',
			};
		}

		case 'BROWSER_CONTEXT_UPDATED': {
			const { summary } = payload as { tabId: string; summary: string };
			return {
				id: nextId(),
				kind: 'browser_result',
				timestamp: startedAt,
				label: 'Browser context',
				detail: summary,
				status: 'done',
			};
		}

		// ── Graph ──────────────────────────────────────────────────────────
		case 'GRAPH_BUILT': {
			const { nodes } = payload as { nodes: any[] };
			return {
				id: nextId(),
				kind: 'execution_completed',
				timestamp: startedAt,
				label: 'Execution graph ready',
				detail: `${nodes?.length ?? 0} nodes`,
				status: 'done',
			};
		}

		// ── Patches ────────────────────────────────────────────────────────
		case 'PATCH_CREATED': {
			const { filePath } = payload as { filePath: string; diff: string };
			return {
				id: nextId(),
				kind: 'tool_finished',
				timestamp: startedAt,
				label: 'Edit',
				detail: filePath,
				status: 'active',
			};
		}

		case 'PATCH_ACCEPTED': {
			const { filePath } = payload as { filePath: string };
			return {
				id: nextId(),
				kind: 'tool_finished',
				timestamp: startedAt,
				label: 'Applied',
				detail: filePath,
				status: 'done',
			};
		}

		case 'PATCH_REJECTED': {
			const { filePath } = payload as { filePath: string };
			return {
				id: nextId(),
				kind: 'tool_failed',
				timestamp: startedAt,
				label: 'Reverted',
				detail: filePath,
				status: 'failed',
			};
		}

		default:
			return null;
	}
}

function formatToolName(toolName: string): string {
	return toolName
		.replace(/_/g, ' ')
		.replace(/\b\w/g, c => c.toUpperCase());
}

// Map internal agent role names to human-readable labels
// The user should NEVER see "ReviewAgent", "WorkspaceAgent", "RAGAgent", etc.
const AGENT_LABEL_MAP: Record<string, string> = {
	Brain: 'Planning',
	Engineer: 'Writing code',
	CodeEngineer: 'Writing code',
	RAG: 'Searching knowledge',
	RAGAgent: 'Searching knowledge',
	Web: 'Browsing',
	Reviewer: 'Reviewing',
	ReviewAgent: 'Reviewing',
	Tester: 'Running tests',
	Deploy: 'Deploying',
	UI: 'Building interface',
	'Workspace Agent': 'Searching workspace',
	'WorkspaceAgent': 'Searching workspace',
	'Browser Agent': 'Browsing',
	'BrowserAgent': 'Browsing',
	'Knowledge Graph': 'Finding related concepts',
	'KnowledgeGraph': 'Finding related concepts',
	'Execution Graph': 'Tracking progress',
	'ExecutionGraph': 'Tracking progress',
	'Forge Agent': 'Working',
	'ForgeAgent': 'Working',
};

function humanizeAgentLabel(role: string): string {
	// Direct match first
	if (AGENT_LABEL_MAP[role]) return AGENT_LABEL_MAP[role];
	// Strip "Agent" suffix and title-case
	const base = role.replace(/Agent$/, '').replace(/_/g, ' ');
	return base.charAt(0).toUpperCase() + base.slice(1);
}

// ─── Hook: Subscribe to ForgeEventBus, produce StreamState ──────────────────

export interface UseStreamEventsOptions {
	/** Maximum events to retain (oldest dropped first). Default 200. */
	maxEvents?: number;
	/** Whether to auto-clear events on a new "run". */
	resetOnRunStart?: boolean;
	/** Called when a new run starts (plan created, task queued). */
	onRunStart?: () => void;
	/** Called when a run completes. */
	onRunComplete?: (summary: string) => void;
}

export interface UseStreamEventsResult {
	readonly state: StreamState;
	readonly clearEvents: () => void;
	readonly getActiveSteps: () => StreamEvent[];
	readonly getPlan: () => PlanStep[] | null;
}

export function useStreamEvents(options: UseStreamEventsOptions = {}): UseStreamEventsResult {
	const { maxEvents = 200, resetOnRunStart = true, onRunStart, onRunComplete } = options;
	const [state, setState] = useState<StreamState>({ events: [], isRunning: false });
	useEffect(() => {
		const bus = ForgeEventBus.getInstance();
		const listener = (event: ForgeEvent) => {
			const streamEvent = transformForgeEvent(event);
			if (!streamEvent) return;

			setState(prev => {
				const nextEvents = [...prev.events, streamEvent];
				if (nextEvents.length > maxEvents) {
					nextEvents.splice(0, nextEvents.length - maxEvents);
				}

				const isRunning = streamEvent.status === 'active' ||
					streamEvent.kind === 'plan_started' ||
					streamEvent.kind === 'execution_started' ||
					streamEvent.kind === 'tool_started' ||
					streamEvent.kind === 'agent_started' ||
					streamEvent.kind === 'search_started' ||
					streamEvent.kind === 'workspace_scan_started' ||
					streamEvent.kind === 'browser_opened';

				const isDone = streamEvent.status === 'done' || streamEvent.kind === 'run_completed';
				const isFailed = streamEvent.status === 'failed' || streamEvent.kind === 'run_failed';

				// Detect run boundaries
				if (resetOnRunStart && (
					streamEvent.kind === 'plan_started' ||
					streamEvent.kind === 'execution_started' ||
					streamEvent.kind === 'plan_step_update' && streamEvent.status === 'active'
				)) {
					onRunStart?.();
				}

				if (isDone && !prev.isRunning && nextEvents.length > 1) {
					onRunComplete?.(
						(typeof streamEvent.detail === 'string' && streamEvent.detail) ||
						streamEvent.label
					);
				}

				return {
					events: nextEvents,
					isRunning: isRunning ? true : isDone ? false : isFailed ? false : prev.isRunning,
					currentStep: streamEvent.status === 'active' ? streamEvent : prev.currentStep,
				};
			});
		};

		const subscription = bus.onEvent(listener);
		return () => { subscription.dispose(); };
	}, [maxEvents, resetOnRunStart, onRunStart, onRunComplete]);

	const clearEvents = useCallback(() => {
		setState({ events: [], isRunning: false });
	}, []);

	const getActiveSteps = useCallback(() => {
		return state.events.filter(e => e.status === 'active');
	}, [state.events]);

	const getPlan = useCallback(() => {
		const planEvent = [...state.events].reverse().find(e => e.kind === 'plan_started');
		return planEvent?.meta?.steps ?? null;
	}, [state.events]);

	return { state, clearEvents, getActiveSteps, getPlan };
}

// ─── Publisher helpers ───────────────────────────────────────────────────────

export function publishPlanCreated(plan: { steps: PlanStep[] }) {
	ForgeEventBus.getInstance().publish('PLAN_CREATED', { plan });
}

export function publishPlanStepUpdate(stepId: number, step: PlanStep) {
	ForgeEventBus.getInstance().publish('PLAN_STEP_UPDATED', { stepId, step });
}

export function publishAgentStarted(agentRole: string, taskId: string) {
	ForgeEventBus.getInstance().publish('AGENT_STARTED', { agentRole, taskId });
}

export function publishAgentFinished(agentRole: string, result: string) {
	ForgeEventBus.getInstance().publish('AGENT_FINISHED', { agentRole, taskId: '', result });
}

export function publishAgentFailed(agentRole: string, error: string) {
	ForgeEventBus.getInstance().publish('AGENT_FAILED', { agentRole, taskId: '', error });
}

export function publishToolStarted(toolName: string, params: Record<string, any> = {}) {
	ForgeEventBus.getInstance().publish('TOOL_STARTED', { toolName, params });
}

export function publishToolFinished(toolName: string, result: any, error?: string) {
	ForgeEventBus.getInstance().publish('TOOL_FINISHED', { toolName, result, error });
}

export function publishSearchStarted(query: string) {
	ForgeEventBus.getInstance().publish('SEARCH_STARTED', { query });
}

export function publishSearchFinished(query: string, hits: any[]) {
	ForgeEventBus.getInstance().publish('SEARCH_FINISHED', { query, hits });
}

export function publishRunCompleted(summary: string) {
	ForgeEventBus.getInstance().publish('RUN_COMPLETED', { taskId: '', summary });
}

export function publishRunFailed(error: string) {
	ForgeEventBus.getInstance().publish('RUN_FAILED', { taskId: '', error });
}

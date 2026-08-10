/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useState, useEffect, useCallback, useRef } from 'react';
import { ForgeEventBus } from '../../../../forge/events/forgeEventBus.js';
import type { ForgeEvent } from '../../../../../common/forge/events/forgeEvents.js';
import type { PlannerOutput, PlanStep } from '../../../../../common/forge/planner/planSchema.js';
import type { AgentRole, AgentState, AgentCapability } from '../../../../../common/forge/types/brainTypes.js';

// ─── Event types for the bridge ───────────────────────────────────────────────

export type PlanMode = 'idle' | 'planning' | 'awaiting_approval' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface ForgeAgentInfo {
	readonly id: string;
	readonly name: string;
	readonly role: AgentRole;
	readonly state: AgentState;
	readonly capabilities: AgentCapability[];
	readonly currentTask?: string;
	readonly progress: number; // 0–100
	readonly createdAt: number;
}

export interface ForgeWorkflowInfo {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly status: PlanMode;
	readonly plan: PlannerOutput | null;
	readonly steps: WorkflowStepInfo[];
	readonly createdAt: number;
	readonly startedAt?: number;
	readonly completedAt?: number;
}

export interface WorkflowStepInfo {
	readonly id: number;
	readonly title: string;
	readonly description: string;
	readonly status: PlanStep['status'];
	readonly stage: string;
	readonly assignedAgent?: string;
	readonly error?: string;
}

export interface ForgeState {
	readonly planMode: PlanMode;
	readonly events: ForgeEvent[];
	readonly plan: PlannerOutput | null;
	readonly agents: ForgeAgentInfo[];
	readonly workflows: ForgeWorkflowInfo[];
	readonly activeWorkflowId: string | null;
	readonly selectedAgentId: string | null;
	readonly isBrainActive: boolean;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export type ForgeAction =
	| { type: 'selectAgent'; agentId: string }
	| { type: 'createAgent'; name: string; role?: AgentRole }
	| { type: 'updateAgentState'; agentId: string; state: AgentState; progress?: number; currentTask?: string }
	| { type: 'startWorkflow'; name: string; description: string; goal: string }
	| { type: 'cancelWorkflow'; workflowId: string }
	| { type: 'setActiveWorkflow'; workflowId: string }
	| { type: 'updateWorkflowStep'; workflowId: string; stepId: number; step: Partial<WorkflowStepInfo> }
	| { type: 'setPlanMode'; mode: PlanMode };

// ─── Reducer ─────────────────────────────────────────────────────────────────

const initialState: ForgeState = {
	planMode: 'idle',
	events: [],
	plan: null,
	agents: [],
	workflows: [],
	activeWorkflowId: null,
	selectedAgentId: null,
	isBrainActive: false,
};

export function forgeReducer(state: ForgeState, action: ForgeAction): ForgeState {
	switch (action.type) {
		case 'selectAgent':
			return { ...state, selectedAgentId: action.agentId };

		case 'createAgent': {
			const id = `agent-${Date.now()}`;
			const newAgent: ForgeAgentInfo = {
				id,
				name: action.name,
				role: action.role ?? 'CodeEngineer',
				state: 'idle',
				capabilities: ['read_file', 'edit_file', 'rewrite_file', 'semantic_search', 'terminal'],
				progress: 0,
				createdAt: Date.now(),
			};
			const agents = [...state.agents, newAgent];
			return {
				...state,
				agents,
				selectedAgentId: state.selectedAgentId ?? id,
			};
		}

		case 'updateAgentState':
			return {
				...state,
				agents: state.agents.map(a =>
					a.id === action.agentId
						? { ...a, state: action.state, progress: action.progress ?? a.progress, currentTask: action.currentTask ?? a.currentTask }
						: a
				),
			};

		case 'startWorkflow': {
			const id = `workflow-${Date.now()}`;
			const workflow: ForgeWorkflowInfo = {
				id,
				name: action.name,
				description: action.description,
				status: 'planning',
				plan: null,
				steps: [],
				createdAt: Date.now(),
				startedAt: Date.now(),
			};
			return {
				...state,
				workflows: [workflow, ...state.workflows],
				activeWorkflowId: id,
				planMode: 'planning',
				isBrainActive: true,
			};
		}

		case 'cancelWorkflow':
			return {
				...state,
				workflows: state.workflows.map(w =>
					w.id === action.workflowId ? { ...w, status: 'cancelled' as const, completedAt: Date.now() } : w
				),
				planMode: 'idle',
				isBrainActive: state.workflows.some(w => w.id !== action.workflowId && w.status === 'running'),
			};

		case 'setActiveWorkflow':
			return { ...state, activeWorkflowId: action.workflowId };

		case 'updateWorkflowStep': {
			const workflows = state.workflows.map(w => {
				if (w.id !== action.workflowId) return w;
				const steps = w.steps.map(s =>
					s.id === action.stepId ? { ...s, ...action.step } : s
				);
				const allDone = steps.every(s => s.status === 'completed' || s.status === 'skipped');
				const anyFailed = steps.some(s => s.status === 'failed');
				const anyRunning = steps.some(s => s.status === 'in_progress' || s.status === 'pending');
				const status: PlanMode = allDone ? 'completed' : anyFailed ? 'failed' : anyRunning ? 'running' : 'completed';
				return { ...w, steps, status, plan: w.plan ? { ...w.plan, steps: steps as PlanStep[] } : null };
			});
			return { ...state, workflows };
		}

		case 'setPlanMode':
			return { ...state, planMode: action.mode };

		default:
			return state;
	}
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useForgeBridge() {
	const [state, setState] = useState<ForgeState>(initialState);
	const dispatchRef = useRef(forgeReducer);
	const stateRef = useRef(state);
	stateRef.current = state;

	// Initialize default agents
	useEffect(() => {
		const defaultAgents: ForgeAgentInfo[] = [
			{
				id: 'forge-agent',
				name: 'Forge Agent',
				role: 'CodeEngineer',
				state: 'idle',
				capabilities: ['read_file', 'edit_file', 'rewrite_file', 'semantic_search', 'terminal'],
				progress: 0,
				createdAt: Date.now(),
			},
			{
				id: 'forge-reviewer',
				name: 'Review Agent',
				role: 'ReviewAgent',
				state: 'idle',
				capabilities: ['read_file', 'read_lint_errors', 'run_tests'],
				progress: 0,
				createdAt: Date.now(),
			},
			{
				id: 'forge-rag',
				name: 'RAG Agent',
				role: 'RAGAgent',
				state: 'idle',
				capabilities: ['semantic_search', 'project_memory_search', 'get_dir_tree'],
				progress: 0,
				createdAt: Date.now(),
			},
		];
		setState(s => ({ ...s, agents: defaultAgents, selectedAgentId: 'forge-agent' }));
	}, []);

	// Subscribe to ForgeEventBus
	useEffect(() => {
		const bus = ForgeEventBus.getInstance();
		const listener = bus.onEvent((evt: ForgeEvent) => {
			setState(prev => {
				const newEvents = [evt, ...prev.events].slice(0, 200);

				let plan = prev.plan;
				let planMode = prev.planMode;
				let isBrainActive = prev.isBrainActive;

				if (evt.type === 'PLAN_CREATED') {
					plan = evt.payload.plan as PlannerOutput;
					planMode = 'running';
					isBrainActive = true;
				} else if (evt.type === 'PLAN_STEP_UPDATED' && plan) {
					const updatedSteps = plan.steps.map((s: PlanStep) =>
						s.id === (evt.payload as any).stepId ? (evt.payload as any).step : s
					);
					plan = { ...plan, steps: updatedSteps };
				} else if (evt.type === 'RUN_COMPLETED') {
					planMode = 'completed';
					isBrainActive = false;
				} else if (evt.type === 'RUN_FAILED') {
					planMode = 'failed';
					isBrainActive = false;
				} else if (evt.type === 'AGENT_STARTED') {
					isBrainActive = true;
				} else if (evt.type === 'AGENT_FINISHED') {
					isBrainActive = prev.agents.some(a => a.state === 'running' || a.state === 'queued');
				} else if (evt.type === 'AGENT_FAILED') {
					isBrainActive = prev.agents.some(a => a.state === 'running' || a.state === 'queued');
				}

				// Update workflow steps from events
				const workflows = prev.workflows.map(w => {
					if (evt.type === 'PLAN_CREATED' && w.status === 'planning') {
						const newPlan = evt.payload.plan as PlannerOutput;
						const steps: WorkflowStepInfo[] = newPlan.steps.map((s: PlanStep) => ({
							id: s.id,
							title: s.title,
							description: s.description,
							status: s.status,
							stage: s.stage,
						}));
						return { ...w, plan: newPlan, steps, status: 'running' as const };
					}
					if (evt.type === 'PLAN_STEP_UPDATED' && w.id === prev.activeWorkflowId) {
						const updated = w.steps.map(s =>
							s.id === (evt.payload as any).stepId ? { ...s, ...(evt.payload as any).step } : s
						);
						return { ...w, steps: updated };
					}
					if (evt.type === 'TASK_COMPLETED' || evt.type === 'RUN_COMPLETED') {
						return { ...w, status: 'completed' as const, completedAt: Date.now() };
					}
					if (evt.type === 'TASK_FAILED' || evt.type === 'RUN_FAILED') {
						return { ...w, status: 'failed' as const };
					}
					return w;
				});

				return { ...prev, events: newEvents, plan, planMode, workflows, isBrainActive };
			});
		});

		return () => { listener.dispose(); };
	}, []);

	const dispatch = useCallback((action: ForgeAction) => {
		setState(prev => dispatchRef.current(prev, action));
	}, []);

	// Action helpers
	const selectAgent = useCallback((agentId: string) => dispatch({ type: 'selectAgent', agentId }), [dispatch]);
	const createAgent = useCallback((name: string, role?: AgentRole) => dispatch({ type: 'createAgent', name, role }), [dispatch]);
	const updateAgentState = useCallback((agentId: string, agentState: AgentState, progress?: number, currentTask?: string) =>
		dispatch({ type: 'updateAgentState', agentId, state: agentState, progress, currentTask }), [dispatch]);
	const startWorkflow = useCallback((name: string, description: string, goal: string) =>
		dispatch({ type: 'startWorkflow', name, description, goal }), [dispatch]);
	const cancelWorkflow = useCallback((workflowId: string) => dispatch({ type: 'cancelWorkflow', workflowId }), [dispatch]);
	const setActiveWorkflow = useCallback((workflowId: string) => dispatch({ type: 'setActiveWorkflow', workflowId }), [dispatch]);
	const updateWorkflowStep = useCallback((workflowId: string, stepId: number, step: Partial<WorkflowStepInfo>) =>
		dispatch({ type: 'updateWorkflowStep', workflowId, stepId, step }), [dispatch]);
	const setPlanMode = useCallback((mode: PlanMode) => dispatch({ type: 'setPlanMode', mode }), [dispatch]);

	const activeWorkflow = state.workflows.find(w => w.id === state.activeWorkflowId) ?? state.workflows[0] ?? null;
	const selectedAgent = state.agents.find(a => a.id === state.selectedAgentId) ?? state.agents[0] ?? null;

	return {
		state,
		activeWorkflow,
		selectedAgent,
		selectAgent,
		createAgent,
		updateAgentState,
		startWorkflow,
		cancelWorkflow,
		setActiveWorkflow,
		updateWorkflowStep,
		setPlanMode,
	};
}

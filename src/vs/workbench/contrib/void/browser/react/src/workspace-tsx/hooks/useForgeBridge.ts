/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useState, useEffect, useCallback, useRef } from 'react';
import { ForgeEventBus } from '../../../../forge/events/forgeEventBus.js';
import type { ForgeEvent } from '../../../../../common/forge/events/forgeEvents.js';
import type { PlannerOutput, PlanStep } from '../../../../../common/forge/planner/planSchema.js';
import type { AgentRole, AgentState, AgentCapability } from '../../../../../common/forge/types/brainTypes.js';

export type PlanMode = 'idle' | 'planning' | 'awaiting_approval' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface ForgeAgentInfo {
	readonly id: string;
	readonly name: string;
	readonly role: AgentRole;
	readonly state: AgentState;
	readonly capabilities: AgentCapability[];
	readonly currentTask?: string;
	readonly progress: number;
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

export type ForgeAction =
	| { type: 'selectAgent'; agentId: string }
	| { type: 'createAgent'; name: string; role?: AgentRole }
	| { type: 'updateAgentState'; agentId: string; state: AgentState; progress?: number; currentTask?: string }
	| { type: 'startWorkflow'; name: string; description: string; goal: string }
	| { type: 'cancelWorkflow'; workflowId: string }
	| { type: 'deleteWorkflow'; workflowId: string }
	| { type: 'setActiveWorkflow'; workflowId: string }
	| { type: 'updateWorkflowStep'; workflowId: string; stepId: number; step: Partial<WorkflowStepInfo> }
	| { type: 'setPlanMode'; mode: PlanMode };

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
			return {
				...state,
				agents: [...state.agents, newAgent],
				selectedAgentId: state.selectedAgentId ?? id,
			};
		}

		case 'updateAgentState':
			return {
				...state,
				agents: state.agents.map(agent => agent.id === action.agentId
					? { ...agent, state: action.state, progress: action.progress ?? agent.progress, currentTask: action.currentTask ?? agent.currentTask }
					: agent),
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

		case 'cancelWorkflow': {
			const workflows = state.workflows.map(workflow => workflow.id === action.workflowId
				? { ...workflow, status: 'cancelled' as const, completedAt: Date.now() }
				: workflow);
			const otherActive = workflows.some(workflow => workflow.id !== action.workflowId && (workflow.status === 'running' || workflow.status === 'planning'));
			return { ...state, workflows, planMode: otherActive ? state.planMode : 'idle', isBrainActive: otherActive };
		}

		case 'deleteWorkflow': {
			const workflows = state.workflows.filter(workflow => workflow.id !== action.workflowId);
			const nextActive = state.activeWorkflowId === action.workflowId ? workflows[0]?.id ?? null : state.activeWorkflowId;
			const activeWorkflow = workflows.find(workflow => workflow.id === nextActive);
			const activeMode = activeWorkflow?.status ?? 'idle';
			return {
				...state,
				workflows,
				activeWorkflowId: nextActive,
				plan: activeWorkflow?.plan ?? (nextActive ? state.plan : null),
				planMode: activeMode,
				isBrainActive: workflows.some(workflow => workflow.status === 'running' || workflow.status === 'planning'),
			};
		}

		case 'setActiveWorkflow': {
			const workflow = state.workflows.find(item => item.id === action.workflowId);
			return {
				...state,
				activeWorkflowId: action.workflowId,
				plan: workflow?.plan ?? state.plan,
				planMode: workflow?.status ?? state.planMode,
			};
		}

		case 'updateWorkflowStep': {
			const workflows = state.workflows.map(workflow => {
				if (workflow.id !== action.workflowId) return workflow;
				const steps = workflow.steps.map(step => step.id === action.stepId ? { ...step, ...action.step } : step);
				const allDone = steps.length > 0 && steps.every(step => step.status === 'completed' || step.status === 'skipped');
				const anyFailed = steps.some(step => step.status === 'failed');
				const anyRunning = steps.some(step => step.status === 'in_progress' || step.status === 'pending');
				const status: PlanMode = allDone ? 'completed' : anyFailed ? 'failed' : anyRunning ? 'running' : workflow.status;
				return { ...workflow, steps, status, plan: workflow.plan ? { ...workflow.plan, steps: steps as PlanStep[] } : null };
			});
			const activeWorkflow = workflows.find(workflow => workflow.id === state.activeWorkflowId);
			return { ...state, workflows, planMode: activeWorkflow?.status ?? state.planMode, plan: activeWorkflow?.plan ?? state.plan };
		}

		case 'setPlanMode':
			return { ...state, planMode: action.mode };

		default:
			return state;
	}
}

export function useForgeBridge() {
	const [state, setState] = useState<ForgeState>(initialState);
	const stateRef = useRef(state);
	stateRef.current = state;

	useEffect(() => {
		const defaultAgents: ForgeAgentInfo[] = [
			{ id: 'forge-agent', name: 'Forge Agent', role: 'CodeEngineer', state: 'idle', capabilities: ['read_file', 'edit_file', 'rewrite_file', 'semantic_search', 'terminal'], progress: 0, createdAt: Date.now() },
			{ id: 'forge-reviewer', name: 'Review Agent', role: 'ReviewAgent', state: 'idle', capabilities: ['read_file', 'read_lint_errors', 'run_tests'], progress: 0, createdAt: Date.now() },
			{ id: 'forge-rag', name: 'RAG Agent', role: 'RAGAgent', state: 'idle', capabilities: ['semantic_search', 'project_memory_search', 'get_dir_tree'], progress: 0, createdAt: Date.now() },
		];
		setState(current => current.agents.length > 0 ? current : { ...current, agents: defaultAgents, selectedAgentId: 'forge-agent' });
	}, []);

	useEffect(() => {
		const bus = ForgeEventBus.getInstance();
		const listener = bus.onEvent((event: ForgeEvent) => {
			setState(previous => {
				const events = [event, ...previous.events].slice(0, 200);
				let plan = previous.plan;
				let planMode = previous.planMode;
				let isBrainActive = previous.isBrainActive;

				if (event.type === 'PLAN_CREATED') {
					plan = event.payload.plan as PlannerOutput;
					planMode = 'running';
					isBrainActive = true;
				} else if (event.type === 'PLAN_STEP_UPDATED' && plan) {
					const updatedSteps = plan.steps.map((step: PlanStep) => step.id === (event.payload as any).stepId ? (event.payload as any).step : step);
					plan = { ...plan, steps: updatedSteps };
				} else if (event.type === 'RUN_COMPLETED') {
					planMode = 'completed';
					isBrainActive = false;
				} else if (event.type === 'RUN_FAILED') {
					planMode = 'failed';
					isBrainActive = false;
				} else if (event.type === 'AGENT_STARTED') {
					isBrainActive = true;
				} else if (event.type === 'AGENT_FINISHED' || event.type === 'AGENT_FAILED') {
					isBrainActive = previous.agents.some(agent => agent.state === 'running' || agent.state === 'queued');
				}

				const workflows = previous.workflows.map(workflow => {
					if (event.type === 'PLAN_CREATED' && workflow.status === 'planning') {
						const newPlan = event.payload.plan as PlannerOutput;
						const steps: WorkflowStepInfo[] = newPlan.steps.map((step: PlanStep) => ({ id: step.id, title: step.title, description: step.description, status: step.status, stage: step.stage }));
						return { ...workflow, plan: newPlan, steps, status: 'running' as const };
					}
					if (event.type === 'PLAN_STEP_UPDATED' && workflow.id === previous.activeWorkflowId) {
						const steps = workflow.steps.map(step => step.id === (event.payload as any).stepId ? { ...step, ...(event.payload as any).step } : step);
						return { ...workflow, steps };
					}
					if ((event.type === 'TASK_COMPLETED' || event.type === 'RUN_COMPLETED') && workflow.id === previous.activeWorkflowId) return { ...workflow, status: 'completed' as const, completedAt: Date.now() };
					if ((event.type === 'TASK_FAILED' || event.type === 'RUN_FAILED') && workflow.id === previous.activeWorkflowId) return { ...workflow, status: 'failed' as const, completedAt: Date.now() };
					return workflow;
				});

				return { ...previous, events, plan, planMode, workflows, isBrainActive };
			});
		});
		return () => listener.dispose();
	}, []);

	const dispatch = useCallback((action: ForgeAction) => setState(previous => forgeReducer(previous, action)), []);
	const selectAgent = useCallback((agentId: string) => dispatch({ type: 'selectAgent', agentId }), [dispatch]);
	const createAgent = useCallback((name: string, role?: AgentRole) => dispatch({ type: 'createAgent', name, role }), [dispatch]);
	const updateAgentState = useCallback((agentId: string, agentState: AgentState, progress?: number, currentTask?: string) => dispatch({ type: 'updateAgentState', agentId, state: agentState, progress, currentTask }), [dispatch]);
	const startWorkflow = useCallback((name: string, description: string, goal: string) => dispatch({ type: 'startWorkflow', name, description, goal }), [dispatch]);
	const cancelWorkflow = useCallback((workflowId: string) => dispatch({ type: 'cancelWorkflow', workflowId }), [dispatch]);
	const deleteWorkflow = useCallback((workflowId: string) => dispatch({ type: 'deleteWorkflow', workflowId }), [dispatch]);
	const setActiveWorkflow = useCallback((workflowId: string) => dispatch({ type: 'setActiveWorkflow', workflowId }), [dispatch]);
	const updateWorkflowStep = useCallback((workflowId: string, stepId: number, step: Partial<WorkflowStepInfo>) => dispatch({ type: 'updateWorkflowStep', workflowId, stepId, step }), [dispatch]);
	const setPlanMode = useCallback((mode: PlanMode) => dispatch({ type: 'setPlanMode', mode }), [dispatch]);

	const activeWorkflow = state.workflows.find(workflow => workflow.id === state.activeWorkflowId) ?? state.workflows[0] ?? null;
	const selectedAgent = state.agents.find(agent => agent.id === state.selectedAgentId) ?? state.agents[0] ?? null;

	return {
		state,
		activeWorkflow,
		selectedAgent,
		selectAgent,
		createAgent,
		updateAgentState,
		startWorkflow,
		cancelWorkflow,
		deleteWorkflow,
		setActiveWorkflow,
		updateWorkflowStep,
		setPlanMode,
	};
}
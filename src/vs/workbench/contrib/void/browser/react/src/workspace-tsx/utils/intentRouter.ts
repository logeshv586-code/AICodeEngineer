/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';

// ─── Intent Router ────────────────────────────────────────────────────────────
//
// Determines how the user's message should be processed.
// This is the single entry point between the UI and the backend.
//
// The chat NEVER talks directly to Planner, Search, Memory, or Agents.
// Everything flows through here.
//
// Routing decisions (lightweight — no LLM call):
//   'direct_chat'     → send straight to LLM with workspace context
//   'plan_and_execute'→ invoke Planner first, then execute the plan
//   'search'          → semantic search the workspace
//   'code_edit'       → code-editing workflow (edit + review + test)
//   'review'          → review current file/s
//   'test'            → run tests
//   'debug'           → debugging workflow
//   'browse'          → open browser for research
//   'memory'          → query/save workspace memory
//   'git'             → git operations
//   'build'           → build the project
//   'system'          → settings, models, help

export interface IntentResult {
	readonly route: string;
	readonly suggestedMessage?: string;
	readonly contextHint?: string;
	readonly autoExecute?: boolean;
}

const PLAN_KEYWORDS = [
	'build', 'create', 'implement', 'add', 'refactor', 'rewrite',
	'design', 'architect', 'migrate', 'convert', 'generate',
	'setup', 'scaffold', 'new feature', 'feature',
];

const SEARCH_KEYWORDS = [
	'find', 'search', 'look for', 'where is', 'locate', 'grep',
	'show me all', 'list all', 'find all',
];

const REVIEW_KEYWORDS = [
	'review', 'audit', 'check for bugs', 'code quality',
	'security review', 'lint', 'static analysis',
];

const TEST_KEYWORDS = [
	'run test', 'run tests', 'test suite', 'unit test',
	'integration test', 'test coverage', 'tests pass',
];

const DEBUG_KEYWORDS = [
	'debug', 'fix', 'bug', 'error', 'crash', 'broken',
	'not working', 'failing', 'issue', 'problem',
];

const BROWSE_KEYWORDS = [
	'search the web', 'look up', 'documentation for',
	'research', 'browse', 'web search', 'find online',
];

const GIT_KEYWORDS = [
	'git status', 'git diff', 'git commit', 'git log',
	'commit', 'push', 'pull', 'branch', 'merge',
];

const BUILD_KEYWORDS = [
	'build', 'compile', 'make', 'npm run', 'yarn build',
	'webpack', 'vite build',
];

const MEMORY_KEYWORDS = [
	'remember', 'recall', 'what did we', 'save this',
	'workspace memory', 'past context',
];

function classifyIntent(message: string): { route: string; confidence: number } {
	const lower = message.toLowerCase().trim();

	// Check specific intents first
	for (const kw of REVIEW_KEYWORDS) {
		if (lower.includes(kw)) return { route: 'review', confidence: 0.9 };
	}
	for (const kw of TEST_KEYWORDS) {
		if (lower.includes(kw)) return { route: 'test', confidence: 0.9 };
	}
	for (const kw of DEBUG_KEYWORDS) {
		if (lower.includes(kw)) return { route: 'debug', confidence: 0.85 };
	}
	for (const kw of BROWSE_KEYWORDS) {
		if (lower.includes(kw)) return { route: 'browse', confidence: 0.9 };
	}
	for (const kw of SEARCH_KEYWORDS) {
		if (lower.includes(kw)) return { route: 'search', confidence: 0.8 };
	}
	for (const kw of GIT_KEYWORDS) {
		if (lower.includes(kw)) return { route: 'git', confidence: 0.85 };
	}
	for (const kw of BUILD_KEYWORDS) {
		if (lower.includes(kw)) return { route: 'build', confidence: 0.85 };
	}
	for (const kw of MEMORY_KEYWORDS) {
		if (lower.includes(kw)) return { route: 'memory', confidence: 0.7 };
	}

	// Plan-and-execute for complex requests
	const wordCount = lower.split(/\s+/).length;
	const hasActionWord = PLAN_KEYWORDS.some(kw => lower.includes(kw));
	const isComplexRequest = wordCount > 8 || (wordCount > 4 && hasActionWord);

	if (isComplexRequest) {
		return { route: 'plan_and_execute', confidence: 0.7 };
	}

	// Code edit for shorter actionable requests
	const codeEditKeywords = ['edit', 'change', 'update', 'fix', 'rename', 'delete', 'remove', 'move', 'extract'];
	if (codeEditKeywords.some(kw => lower.includes(kw))) {
		return { route: 'code_edit', confidence: 0.6 };
	}

	// Default: direct chat (LLM handles it with workspace context)
	return { route: 'direct_chat', confidence: 0.5 };
}

const ROUTE_HINTS: Record<string, string> = {
	plan_and_execute: 'Planning and executing your request...',
	search: 'Searching the workspace...',
	code_edit: 'Editing code...',
	review: 'Reviewing code...',
	test: 'Running tests...',
	debug: 'Debugging...',
	browse: 'Browsing...',
	memory: 'Checking memory...',
	git: 'Running git command...',
	build: 'Building...',
	direct_chat: '',
};

export function routeIntent(message: string): IntentResult {
	const { route, confidence } = classifyIntent(message);

	return {
		route,
		suggestedMessage: confidence > 0.6
			? undefined // let the backend handle it naturally
			: message,
		contextHint: ROUTE_HINTS[route] || '',
		autoExecute: confidence > 0.7,
	};
}

// ─── Context Builder ─────────────────────────────────────────────────────────

export interface ConversationContext {
	workspaceFiles?: string[];
	selectedFile?: string;
	recentErrors?: string[];
	gitStatus?: string;
	memoryEntries?: string[];
}

export async function buildConversationContext(
	accessor: any
): Promise<ConversationContext> {
	const context: ConversationContext = {};

	try {
		// Workspace files
		const fileService = accessor.get('IFileService');
		if (fileService) {
			const workspaceContext = accessor.get('IWorkspaceContextService');
			if (workspaceContext) {
				const roots = workspaceContext.getWorkspace().folders;
				context.workspaceFiles = roots.map((r: any) => r.uri.fsPath);
			}
		}

		// Active editor file
		const codeEditorService = accessor.get('ICodeEditorService');
		if (codeEditorService) {
			const editor = codeEditorService.getFocusedCodeEditor();
			if (editor) {
				context.selectedFile = editor.getModel()?.uri?.fsPath;
			}
		}
	} catch {
		// Non-critical — context is best-effort
	}

	return context;
}

// ─── Conversation Orchestrator ───────────────────────────────────────────────

export class ConversationOrchestrator {
	private static instance: ConversationOrchestrator | null = null;

	static getInstance(): ConversationOrchestrator {
		if (!this.instance) {
			this.instance = new ConversationOrchestrator();
		}
		return this.instance;
	}

	/**
	 * Process a user message through the full pipeline.
	 *
	 * Flow:
	 * 1. Detect intent
	 * 2. Build context
	 * 3. Route to appropriate backend service
	 * 4. Publish stream events as execution progresses
	 * 5. Return the final response
	 *
	 * The UI never sees the routing logic — it just sees a natural conversation.
	 */
	async processMessage(
		message: string,
		accessor: any,
		onStreamEvent: (event: { type: string; label: string; detail?: string }) => void,
	): Promise<string> {
		// 1. Detect intent (no LLM call — instant)
		const intent = routeIntent(message);

		// 2. Build context (best effort)
		const context = await buildConversationContext(accessor);

		// 3. Publish the user's message as a stream event
		onStreamEvent({ type: 'thinking', label: 'Thinking...' });

		// 4. Route based on intent
		switch (intent.route) {
			case 'plan_and_execute':
				return this.handlePlanAndExecute(message, context, onStreamEvent);
			case 'search':
				return this.handleSearch(message, context, onStreamEvent);
			case 'review':
				return this.handleReview(message, context, onStreamEvent);
			case 'test':
				return this.handleTest(message, context, onStreamEvent);
			case 'debug':
				return this.handleDebug(message, context, onStreamEvent);
			case 'code_edit':
				return this.handleCodeEdit(message, context, onStreamEvent);
			default:
				return this.handleDirectChat(message, context, onStreamEvent);
		}
	}

	private async handlePlanAndExecute(
		message: string,
		context: ConversationContext,
		onStream: (e: { type: string; label: string; detail?: string }) => void,
	): Promise<string> {
		onStream({ type: 'plan_started', label: 'Planning...' });

		// Publish to ForgeEventBus — the UI picks this up via useStreamEvents
		const { ForgeEventBus } = await import('../../../../forge/events/forgeEventBus.js');

		// Simulate plan steps (in real impl, the PlannerService generates these)
		const steps = [
			{ title: 'Analyze request', status: 'active' as const },
			{ title: 'Search workspace', status: 'pending' as const },
			{ title: 'Read relevant files', status: 'pending' as const },
			{ title: 'Generate implementation', status: 'pending' as const },
			{ title: 'Run tests', status: 'pending' as const },
			{ title: 'Review changes', status: 'pending' as const },
		];

		ForgeEventBus.getInstance().publish('PLAN_CREATED', { plan: { steps } });

		// Each step would be driven by actual backend execution
		// For now, the existing agent loop in chatThreadService handles execution
		// This orchestrator just provides the intent routing and event publishing

		return message; // The actual response comes from the LLM via chatThreadService
	}

	private async handleSearch(
		message: string,
		_context: ConversationContext,
		onStream: (e: { type: string; label: string; detail?: string }) => void,
	): Promise<string> {
		onStream({ type: 'search_started', label: 'Searching...', detail: message });
		const { ForgeEventBus } = await import('../../../../forge/events/forgeEventBus.js');
		ForgeEventBus.getInstance().publish('SEARCH_STARTED', { query: message });
		// Actual search handled by backend
		return message;
	}

	private async handleReview(
		message: string,
		_context: ConversationContext,
		onStream: (e: { type: string; label: string; detail?: string }) => void,
	): Promise<string> {
		onStream({ type: 'agent_started', label: 'Reviewing code...' });
		const { ForgeEventBus } = await import('../../../../forge/events/forgeEventBus.js');
		ForgeEventBus.getInstance().publish('AGENT_STARTED', { agentRole: 'Reviewer', taskId: 'review' });
		return message;
	}

	private async handleTest(
		message: string,
		_context: ConversationContext,
		onStream: (e: { type: string; label: string; detail?: string }) => void,
	): Promise<string> {
		onStream({ type: 'tool_started', label: 'Running tests...' });
		const { ForgeEventBus } = await import('../../../../forge/events/forgeEventBus.js');
		ForgeEventBus.getInstance().publish('TOOL_STARTED', { toolName: 'run_tests', params: {} });
		return message;
	}

	private async handleDebug(
		message: string,
		_context: ConversationContext,
		onStream: (e: { type: string; label: string; detail?: string }) => void,
	): Promise<string> {
		onStream({ type: 'thinking', label: 'Analyzing the issue...' });
		return message;
	}

	private async handleCodeEdit(
		message: string,
		_context: ConversationContext,
		onStream: (e: { type: string; label: string; detail?: string }) => void,
	): Promise<string> {
		onStream({ type: 'tool_started', label: 'Editing code...' });
		const { ForgeEventBus } = await import('../../../../forge/events/forgeEventBus.js');
		ForgeEventBus.getInstance().publish('TOOL_STARTED', { toolName: 'edit_file', params: {} });
		return message;
	}

	private async handleDirectChat(
		message: string,
		_context: ConversationContext,
		onStream: (e: { type: string; label: string; detail?: string }) => void,
	): Promise<string> {
		// No special routing — just context-aware chat
		onStream({ type: 'thinking', label: '' });
		return message;
	}
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useIntentRouter() {
	const router = React.useMemo(() => ConversationOrchestrator.getInstance(), []);

	const processMessage = React.useCallback(async (
		message: string,
		accessor: any,
		onStreamEvent: (event: { type: string; label: string; detail?: string }) => void,
	): Promise<string> => {
		return router.processMessage(message, accessor, onStreamEvent);
	}, [router]);

	return { processMessage };
}

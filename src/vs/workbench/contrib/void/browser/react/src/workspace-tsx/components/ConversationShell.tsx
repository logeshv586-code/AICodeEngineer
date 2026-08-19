/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useMemo } from 'react';
import { useAccessor, useChatThreadsState, useChatThreadsStreamState, useRawAccessor, useSettingsState } from '../../util/services.tsx';
import { ChatView, ChatViewMessage } from './ChatView.tsx';
import { ForgeChatHeader } from './ForgeChatHeader.tsx';
import { ForgePanelIntro } from './ForgePanelIntro.tsx';
import type { SlashCommandContext } from '../utils/slashCommandRouter.tsx';
import { FORGE_EVOLUTION_POLICY, FORGE_PROJECT_EVOLUTION_TASK, FORGE_SKILL_EVOLUTION_TASK } from '../utils/evolutionPrompts.ts';
import '../forgeBrand.css';
import '../forgeRightPanel.css';

const contentToText = (value: unknown): string => {
	if (typeof value === 'string') return value;
	if (value === null || value === undefined) return '';
	if (Array.isArray(value)) {
		return value.map(item => {
			if (typeof item === 'string') return item;
			if (item && typeof item === 'object') {
				const candidate = item as { text?: unknown; content?: unknown; value?: unknown };
				return contentToText(candidate.text ?? candidate.content ?? candidate.value ?? '');
			}
			return '';
		}).filter(Boolean).join('\n');
	}
	if (typeof value === 'object') {
		const candidate = value as { text?: unknown; content?: unknown; value?: unknown };
		const nested = candidate.text ?? candidate.content ?? candidate.value;
		if (nested !== undefined) return contentToText(nested);
		try { return JSON.stringify(value); } catch { return ''; }
	}
	return String(value);
};

const messageText = (message: any): string => contentToText(message.displayContent ?? message.content ?? '');

// Product actions may carry richer execution guidance to the backend while the visible
// conversation stays concise. Free-form user text is always shown exactly as entered.
const generatedTaskDisplayLabels = new Map<string, string>([
	['Understand this codebase and explain the architecture I need for my task.', 'Understand this project'],
	['Implement this feature end-to-end, run targeted checks, and review the final diff.', 'Build this feature'],
	['Find the root cause of the current bug, fix it, and run a regression check.', 'Fix this problem'],
	['Inspect the app in the browser, fix the UI issue, and verify it visually.', 'Check and improve the app'],
	['Review the current changes for correctness, security, and regressions. Fix actionable issues.', 'Review the current work'],
	['Create a safe Work Mode automation for this recurring requirement.', 'Automate this task'],
	['Find the relevant parts of this project for my current task and continue.', 'Find what matters'],
	['Run the most useful command for my current task and continue.', 'Run a useful check'],
	['Verify the current result and fix anything that is still wrong.', 'Verify the result'],
	['Review the current work and fix anything important before finishing.', 'Review before finish'],
	['Inspect the attached context and complete the requested work. Read relevant files first, make the necessary changes, and verify the result.', 'Use the attached context'],
	['Inspect the attached context and continue with the task.', 'Use the attached context'],
	['Continue with the attached context.', 'Use the attached context'],
	[FORGE_PROJECT_EVOLUTION_TASK, 'Evolve this project'],
	[FORGE_SKILL_EVOLUTION_TASK, 'Evolve project skills'],
]);

const withEvolutionPolicy = (message: string): string => `${message}\n\n${FORGE_EVOLUTION_POLICY}`;

export const ConversationShell: React.FC = () => {
	const accessor = useAccessor();
	const rawAccessor = useRawAccessor();
	const threadsState = useChatThreadsState();
	const settingsState = useSettingsState();
	const chatThreadsService = accessor.get('IChatThreadService');
	const commandService = accessor.get('ICommandService');
	const workspaceService = accessor.get('IWorkspaceContextService');
	const currentThreadId = threadsState.currentThreadId;
	const currentThread = threadsState.allThreads[currentThreadId] ?? chatThreadsService.getCurrentThread();
	const streamState = useChatThreadsStreamState(currentThreadId);
	const isStreaming = !!streamState?.isRunning;
	const workspace = workspaceService.getWorkspace();
	const workspaceReady = workspace.folders.length > 0;
	const workspaceName = workspace.folders[0]?.name ?? 'No workspace open';
	const workspacePath = workspace.folders[0]?.uri.fsPath;

	const messages = useMemo<ChatViewMessage[]>(() => {
		if (!currentThread) return [];
		return currentThread.messages
			.map((message: any, index: number): ChatViewMessage | null => {
				if (message.role !== 'user' && message.role !== 'assistant') return null;
				return {
					id: message.id ?? `${currentThread.id}-${index}`,
					role: message.role,
					content: messageText(message),
					timestamp: typeof message.timestamp === 'number' ? message.timestamp : new Date(currentThread.lastModified || currentThread.createdAt).getTime(),
					messageIndex: index,
				};
			})
			.filter((message): message is ChatViewMessage => message !== null);
	}, [currentThread]);

	const stagedSelections = currentThread?.state.stagingSelections ?? [];
	const stagedFiles = useMemo(() => stagedSelections.filter(selection => selection.type === 'File').map(selection => selection.uri.fsPath), [stagedSelections]);

	const sendMessage = useCallback(async (message: string) => {
		const trimmed = message.trim();
		let threadId = chatThreadsService.state.currentThreadId;
		if (!threadId || !chatThreadsService.state.allThreads[threadId]) threadId = chatThreadsService.createNewThread();
		const selections = chatThreadsService.getCurrentThreadState().stagingSelections.slice();
		const effectiveMessage = trimmed || (selections.length > 0 ? 'Inspect the attached context and continue with the task.' : '');
		if (!effectiveMessage) return;

		const backendMessage = withEvolutionPolicy(effectiveMessage);
		const displayLabel = generatedTaskDisplayLabels.get(effectiveMessage) ?? effectiveMessage;

		const applyVisibleLabel = () => {
			const state = chatThreadsService.state;
			const thread = state.allThreads[threadId];
			if (!thread) return;

			let targetIndex = -1;
			for (let index = thread.messages.length - 1; index >= 0; index--) {
				const candidate = thread.messages[index];
				if (candidate.role === 'user' && (candidate.content === backendMessage || candidate.displayContent === backendMessage)) {
					targetIndex = index;
					break;
				}
			}
			if (targetIndex < 0) return;

			const nextMessages = thread.messages.slice();
			const userMessage = nextMessages[targetIndex];
			if (userMessage.role !== 'user' || userMessage.displayContent === displayLabel) return;
			nextMessages[targetIndex] = { ...userMessage, displayContent: displayLabel };
			chatThreadsService.dangerousSetState({
				...state,
				allThreads: {
					...state.allThreads,
					[threadId]: { ...thread, messages: nextMessages },
				},
			});
		};

		// The service adds the user message synchronously before its first async boundary.
		// Rewrite displayContent immediately so product guidance never appears in the chat UI.
		const responsePromise = chatThreadsService.addUserMessageAndStreamResponse({ userMessage: backendMessage, _chatSelections: selections, threadId });
		applyVisibleLabel();
		queueMicrotask(applyVisibleLabel);
		window.setTimeout(applyVisibleLabel, 0);

		await responsePromise;
		applyVisibleLabel();
		chatThreadsService.setCurrentThreadState({ stagingSelections: [] });
	}, [chatThreadsService]);

	const slashContext = useMemo<SlashCommandContext>(() => ({
		accessor: rawAccessor,
		commandService,
		chatThreadsService,
		args: '',
		onClose: () => {},
		setActiveTool: () => {},
		sendMessage: message => { void sendMessage(message); },
	}), [chatThreadsService, commandService, rawAccessor, sendMessage]);

	const selectedModel = settingsState.modelSelectionOfFeature.Chat;
	const isEmpty = messages.length === 0;

	return (
		<div className='forge-premium-shell forge-ai-panel-right relative h-full w-full min-h-0 min-w-0 overflow-hidden'>
			<div className='forge-brand-aurora' aria-hidden='true' />
			<div className='forge-chat-layout relative z-[1] h-full w-full min-h-0 min-w-0 overflow-hidden'>
				<ForgeChatHeader
					workspaceName={workspaceName}
					workspacePath={workspacePath}
					workspaceReady={workspaceReady}
					isStreaming={isStreaming}
					slashContext={slashContext}
				/>
				{isEmpty && <ForgePanelIntro
					workspaceName={workspaceName}
					onEvolveProject={() => { void sendMessage(FORGE_PROJECT_EVOLUTION_TASK); }}
					onEvolveSkills={() => { void sendMessage(FORGE_SKILL_EVOLUTION_TASK); }}
				/>}
				<ChatView
					messages={messages}
					isStreaming={isStreaming}
					onSendMessage={sendMessage}
					onNewThread={() => { chatThreadsService.createNewThread(); }}
					slashContext={slashContext}
					workspaceReady={workspaceReady}
					selectedFiles={stagedFiles}
					providerName={selectedModel?.providerName ?? ''}
					modelName={selectedModel?.modelName ?? ''}
					onOpenSettings={() => { void commandService.executeCommand('workbench.action.openVoidSettings'); }}
					onRevertMessage={messageIndex => chatThreadsService.revertToMessage({ threadId: currentThreadId, messageIdx: messageIndex })}
					className={isEmpty ? 'forge-chat-with-intro' : ''}
				/>
			</div>
		</div>
	);
};

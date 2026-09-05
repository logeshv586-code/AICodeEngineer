/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../../../base/common/uri.js';
import { StagingSelectionItem } from '../../../../../common/chatThreadServiceTypes.js';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAccessor, useChatThreadsState, useChatThreadsStreamState, useRawAccessor, useSettingsState } from '../../util/services.tsx';
import { ChatView, ChatViewMessage } from './ChatView.tsx';
import { ForgeChatHeader } from './ForgeChatHeader.tsx';
import { type SlashCommandContext } from '../utils/slashCommandRouter.tsx';
import { FORGE_PROJECT_EVOLUTION_TASK, FORGE_SKILL_EVOLUTION_TASK } from '../utils/evolutionPrompts.ts';
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

export const ConversationShell: React.FC = () => {
	const hasPreparedWelcomeRef = useRef(false);
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

	useEffect(() => {
		if (hasPreparedWelcomeRef.current) return;
		hasPreparedWelcomeRef.current = true;
		const restoredThread = chatThreadsService.getCurrentThread();
		if (restoredThread?.messages.length) chatThreadsService.createNewThread();
	}, [chatThreadsService]);

	useEffect(() => {
		const addContext = (event: Event) => {
			const detail = (event as CustomEvent<{ kind?: string; content?: string }>).detail;
			if (typeof detail?.content !== 'string' || !detail.content.trim()) return;
			chatThreadsService.addNewStagingSelection({ type: 'BrowserComponent', title: detail.kind || 'Browser context', content: detail.content,
				uri: URI.from({ scheme: 'forge-context', path: `/${Date.now()}-${Math.random().toString(36).slice(2)}` }) });
		};
		window.addEventListener('forge:add-context', addContext);
		return () => window.removeEventListener('forge:add-context', addContext);
	}, [chatThreadsService]);

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

	const sendMessage = useCallback(async (message: string, displayLabelOverride?: string) => {
		const trimmed = message.trim();
		let threadId = chatThreadsService.state.currentThreadId;
		if (!threadId || !chatThreadsService.state.allThreads[threadId]) threadId = chatThreadsService.createNewThread();
		const selections = chatThreadsService.getCurrentThreadState().stagingSelections.slice();
		const effectiveMessage = trimmed || (selections.length > 0 ? 'Inspect the attached context and continue with the task.' : '');
		if (!effectiveMessage) return;

		// Normal coding/run/test requests should not carry the large Forge Evolution
		// policy as user content. The core Agent system prompt already owns workspace
		// execution rules. Evolution stays explicit through /evolve commands.
		const backendMessage = effectiveMessage;
		const displayLabel = displayLabelOverride ?? generatedTaskDisplayLabels.get(effectiveMessage) ?? effectiveMessage;

		await chatThreadsService.addUserMessageAndStreamResponse({ userMessage: backendMessage, displayLabelOverride: displayLabel, _chatSelections: selections, threadId });
		// Only clear the selections consumed by this send, and never another thread's draft.
		if (chatThreadsService.state.currentThreadId === threadId) {
			const current = chatThreadsService.getCurrentThreadState().stagingSelections;
			chatThreadsService.setCurrentThreadState({ stagingSelections: current.filter(item => !selections.includes(item)) });
		}

	}, [chatThreadsService]);

	const slashContext = useMemo<SlashCommandContext>(() => ({
		accessor: rawAccessor,
		commandService,
		chatThreadsService,
		args: '',
		onClose: () => {},
		setActiveTool: () => {},
		sendMessage: (message, displayLabel) => { void sendMessage(message, displayLabel); },
	}), [chatThreadsService, commandService, rawAccessor, sendMessage]);

	const selectedModel = settingsState.modelSelectionOfFeature.Chat;
	const newThread = useCallback(() => { chatThreadsService.createNewThread(); }, [chatThreadsService]);
	const openSettings = useCallback(() => { void commandService.executeCommand('workbench.action.openVoidSettings'); }, [commandService]);
	const closeSidebar = useCallback(() => { void commandService.executeCommand('workbench.action.toggleAuxiliaryBar'); }, [commandService]);

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
					onNewThread={newThread}
					onOpenSettings={openSettings}
					onClose={closeSidebar}
				/>
				<ChatView
					key={currentThreadId}
					messages={messages}
					isStreaming={isStreaming}
					onSendMessage={sendMessage}
					onNewThread={newThread}
					slashContext={slashContext}
					workspaceReady={workspaceReady}
					selectedFiles={stagedFiles}
					browserSelections={stagedSelections.filter((s): s is Extract<StagingSelectionItem, { type: 'BrowserComponent' }> => s.type === 'BrowserComponent')}
					onRemoveBrowserSelection={uri => chatThreadsService.setCurrentThreadState({ stagingSelections: stagedSelections.filter(s => s.type !== 'BrowserComponent' || s.uri.toString() !== uri) })}
					providerName={selectedModel?.providerName ?? ''}
					modelName={selectedModel?.modelName ?? ''}
					onOpenSettings={openSettings}
					onRevertMessage={messageIndex => chatThreadsService.revertToMessage({ threadId: currentThreadId, messageIdx: messageIndex })}
				/>
			</div>
		</div>
	);
};

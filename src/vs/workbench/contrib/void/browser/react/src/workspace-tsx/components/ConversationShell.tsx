/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useMemo } from 'react';
import { useAccessor, useChatThreadsState, useChatThreadsStreamState, useRawAccessor, useSettingsState } from '../../util/services.tsx';
import { ChatView, ChatViewMessage } from './ChatView.tsx';
import { SimpleSidebar } from './SimpleSidebar.tsx';
import { ForgeContextPanel } from './ForgeContextPanel.tsx';
import type { SlashCommandContext } from '../utils/slashCommandRouter.tsx';
import '../forgeBrand.css';

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

const privateSessionTitle = (createdAt: string): string => {
	const date = new Date(createdAt);
	if (Number.isNaN(date.getTime())) return 'Conversation';
	return `Session ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
};

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

	const threadItems = useMemo(() => Object.values(threadsState.allThreads)
		.filter((thread): thread is NonNullable<typeof thread> => !!thread)
		.map(thread => {
			const visibleMessages = thread.messages.filter((message: any) => message.role === 'user' || message.role === 'assistant');
			return {
				id: thread.id,
				title: visibleMessages.length > 0 ? privateSessionTitle(thread.createdAt) : 'New conversation',
				preview: visibleMessages.length > 0 ? `${visibleMessages.length} messages` : 'Ready for a new task',
				timestamp: new Date(thread.lastModified || thread.createdAt).getTime(),
				isActive: thread.id === currentThreadId,
			};
		})
		.sort((a, b) => b.timestamp - a.timestamp), [currentThreadId, threadsState.allThreads]);

	const stagedSelections = currentThread?.state.stagingSelections ?? [];
	const stagedFiles = useMemo(() => stagedSelections.filter(selection => selection.type === 'File').map(selection => selection.uri.fsPath), [stagedSelections]);
	const stagedImages = useMemo(() => stagedSelections.filter(selection => selection.type === 'Image').map(selection => selection.uri.fsPath.split(/[\\/]/).pop() || selection.uri.fsPath), [stagedSelections]);

	const sendMessage = useCallback(async (message: string) => {
		const trimmed = message.trim();
		let threadId = chatThreadsService.state.currentThreadId;
		if (!threadId || !chatThreadsService.state.allThreads[threadId]) threadId = chatThreadsService.createNewThread();
		const selections = chatThreadsService.getCurrentThreadState().stagingSelections.slice();
		const effectiveMessage = trimmed || (selections.length > 0 ? 'Continue with the attached context.' : '');
		if (!effectiveMessage) return;
		await chatThreadsService.addUserMessageAndStreamResponse({ userMessage: effectiveMessage, _chatSelections: selections, threadId });
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

	return (
		<div className='forge-premium-shell relative h-full w-full min-h-0 min-w-0 overflow-hidden'>
			<div className='forge-brand-aurora' aria-hidden='true' />
			<div className='relative z-[1] flex h-full w-full min-h-0 min-w-0 overflow-hidden'>
				<SimpleSidebar
					threads={threadItems}
					activeThreadId={currentThreadId}
					onSelectThread={threadId => chatThreadsService.switchToThread(threadId)}
					onNewThread={() => { chatThreadsService.createNewThread(); }}
					onDeleteThread={threadId => chatThreadsService.deleteThread(threadId)}
					onSettingsClick={() => { void commandService.executeCommand('workbench.action.openVoidSettings'); }}
					workspaceName={workspaceName}
					slashContext={slashContext}
				/>

				<ChatView
					messages={messages}
					isStreaming={isStreaming}
					onSendMessage={sendMessage}
					slashContext={slashContext}
					workspaceReady={workspaceReady}
					selectedFiles={stagedFiles}
					providerName={selectedModel?.providerName ?? ''}
					modelName={selectedModel?.modelName ?? ''}
					onOpenSettings={() => { void commandService.executeCommand('workbench.action.openVoidSettings'); }}
					onRevertMessage={messageIndex => chatThreadsService.revertToMessage({ threadId: currentThreadId, messageIdx: messageIndex })}
				/>

				<ForgeContextPanel files={stagedFiles} images={stagedImages} workspaceReady={workspaceReady} onSendMessage={message => { void sendMessage(message); }} />
			</div>
		</div>
	);
};

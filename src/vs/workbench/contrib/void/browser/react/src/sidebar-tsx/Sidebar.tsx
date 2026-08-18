/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useRef } from 'react';
import { useAccessor, useIsDark } from '../util/services.tsx';
import '../styles.css';
import { ConversationShell } from '../workspace-tsx/components/ConversationShell.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';

const WORK_CLAIM_LEASE_MS = 60 * 60_000;
const WORK_CLAIM_RENEW_MS = 10 * 60_000;

type PendingWorkItem = {
	id: string;
	workflowId: string;
	kind: 'prompt' | 'command';
	title: string;
	prompt?: string;
	command?: string;
	cwd?: string;
	scheduledFor?: string;
	status: 'agent_required' | 'approval_required';
	claim?: { claimant: string; claimedAt: string; expiresAt: string } | null;
};

export const Sidebar = ({ className }: { className: string }) => {
	const isDark = useIsDark();
	const accessor = useAccessor();
	const seenApprovalIds = useRef(new Set<string>());
	const workModeConsumerId = useRef(`forge-sidebar-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

	const notify = useCallback((kind: 'info' | 'warn' | 'error', message: string) => {
		try {
			const service = accessor.get('INotificationService');
			if (kind === 'error') service.error(message);
			else if (kind === 'warn') service.warn(message);
			else service.info(message);
		} catch {
			console.log(`[Forge] ${message}`);
		}
	}, [accessor]);

	const getForgeMcp = useCallback(() => {
		const mcp = accessor.get('IMCPService');
		return mcp.getMCPTools()?.some(item => item.mcpServerName === 'forge-super-agent') ? mcp : null;
	}, [accessor]);

	const callForgeToolJson = useCallback(async <T,>(toolName: string, params: Record<string, unknown>): Promise<T | null> => {
		const mcp = getForgeMcp();
		if (!mcp) return null;
		if (!mcp.getMCPTools()?.some(item => item.mcpServerName === 'forge-super-agent' && item.name === toolName)) return null;
		const { result } = await mcp.callMCPTool({ serverName: 'forge-super-agent', toolName, params });
		const text = mcp.stringifyResult(result).trim();
		try { return JSON.parse(text) as T; } catch { return null; }
	}, [getForgeMcp]);

	// Work Mode remains hosted at the active sidebar shell so scheduled prompts
	// continue to run even though the visible UI is now the conversation-first shell.
	useEffect(() => {
		let disposed = false;
		let polling = false;

		const renewClaim = async (id: string) => {
			const renewed = await callForgeToolJson<PendingWorkItem>('forge_workflow', {
				action: 'claim', id, claimant: workModeConsumerId.current, leaseMs: WORK_CLAIM_LEASE_MS,
			});
			if (!renewed) throw new Error('Work Mode claim lease could not be renewed.');
		};

		const poll = async () => {
			if (disposed || polling) return;
			polling = true;
			try {
				const pending = await callForgeToolJson<PendingWorkItem[]>('forge_workflow', { action: 'pending' });
				if (!pending || !Array.isArray(pending)) return;

				for (const queuedItem of pending) {
					if (disposed) return;
					if (queuedItem.status === 'approval_required') {
						if (!seenApprovalIds.current.has(queuedItem.id)) {
							seenApprovalIds.current.add(queuedItem.id);
							notify('warn', `Work Mode task "${queuedItem.title}" is waiting for approval. Use /work-pending and /work-approve <pending-id>.`);
						}
						continue;
					}
					if (queuedItem.status !== 'agent_required' || !queuedItem.prompt) continue;

					const item = await callForgeToolJson<PendingWorkItem>('forge_workflow', {
						action: 'claim', id: queuedItem.id, claimant: workModeConsumerId.current, leaseMs: WORK_CLAIM_LEASE_MS,
					});
					if (!item || item.status !== 'agent_required' || !item.prompt) continue;

					const chat = accessor.get('IChatThreadService');
					const threadId = chat.createNewThread();
					const scheduledPrompt = [
						`Scheduled Work Mode task: ${item.title}`,
						item.scheduledFor ? `Scheduled for: ${item.scheduledFor}` : '',
						item.prompt,
						'Complete this autonomously using normal Forge safety and approval boundaries. Inspect only the context you need, use tools, verify the outcome, and report what changed.',
					].filter(Boolean).join('\n\n');

					let renewalTimer: number | undefined;
					try {
						notify('info', `Work Mode started: ${item.title}`);
						renewalTimer = window.setInterval(() => { void renewClaim(item.id).catch(error => console.warn('[Forge Work Mode] claim renewal failed', error)); }, WORK_CLAIM_RENEW_MS);
						await chat.addUserMessageAndStreamResponse({ threadId, userMessage: scheduledPrompt });
						await callForgeToolJson('forge_workflow', { action: 'ack', id: item.id, result: { status: 'completed', completedAt: new Date().toISOString(), threadId, claimant: workModeConsumerId.current } });
						notify('info', `Work Mode completed: ${item.title}`);
					} catch (error) {
						await callForgeToolJson('forge_workflow', { action: 'ack', id: item.id, result: { status: 'failed', completedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error), threadId, claimant: workModeConsumerId.current } });
						notify('error', `Work Mode failed: ${item.title}`);
					} finally {
						if (renewalTimer !== undefined) window.clearInterval(renewalTimer);
					}
				}
			} catch (error) {
				console.warn('[Forge Work Mode] Pending-work poll failed:', error);
			} finally {
				polling = false;
			}
		};

		const initialTimer = window.setTimeout(() => { void poll(); }, 5_000);
		const interval = window.setInterval(() => { void poll(); }, 60_000);
		return () => {
			disposed = true;
			window.clearTimeout(initialTimer);
			window.clearInterval(interval);
		};
	}, [accessor, callForgeToolJson, notify]);

	return (
		<div className={`@@void-scope ${isDark ? 'dark' : ''}`} style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
			<div className={`w-full h-full min-w-0 min-h-0 overflow-hidden ${className}`}>
				<ErrorBoundary><ConversationShell /></ErrorBoundary>
			</div>
		</div>
	);
};

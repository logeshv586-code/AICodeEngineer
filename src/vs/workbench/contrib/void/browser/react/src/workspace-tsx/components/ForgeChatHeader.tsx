/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ISkillsService } from '../../../skillsService.js';
import { ISemanticSearchService } from '../../../../../common/forge/contracts/ISemanticSearchService.js';
import type { SlashCommandContext } from '../utils/slashCommandRouter';

type KnowledgeState = 'idle' | 'syncing' | 'ready' | 'preparing';

type KnowledgeSnapshot = {
	registrySkills: number;
	workspaceSkills: number;
	totalFiles?: number;
	totalChunks?: number;
};

export interface ForgeChatHeaderProps {
	workspaceName: string;
	workspacePath?: string;
	workspaceReady: boolean;
	isStreaming: boolean;
	slashContext?: SlashCommandContext;
}

export const ForgeChatHeader: React.FC<ForgeChatHeaderProps> = ({
	workspaceName,
	workspacePath,
	workspaceReady,
	isStreaming,
	slashContext,
}) => {
	const [knowledgeState, setKnowledgeState] = useState<KnowledgeState>('idle');
	const [snapshot, setSnapshot] = useState<KnowledgeSnapshot>({ registrySkills: 0, workspaceSkills: 0 });
	const disposedRef = useRef(false);
	const wasStreamingRef = useRef(false);
	const refreshInFlightRef = useRef(false);

	useEffect(() => {
		disposedRef.current = false;
		return () => { disposedRef.current = true; };
	}, []);

	const refreshKnowledge = useCallback(async (forceReindex: boolean) => {
		if (!slashContext || refreshInFlightRef.current) return;
		if (!workspaceReady || !workspacePath) {
			setKnowledgeState('idle');
			return;
		}

		refreshInFlightRef.current = true;
		setKnowledgeState('syncing');
		try {
			const skillsService = slashContext.accessor.get(ISkillsService);
			await skillsService.reloadSkills();
			const semanticSearch = slashContext.accessor.get(ISemanticSearchService);
			const stats = forceReindex
				? await semanticSearch.indexWorkspace(workspacePath)
				: await semanticSearch.getStats(workspacePath);
			if (disposedRef.current) return;
			setSnapshot({
				registrySkills: skillsService.getRegistrySkillCount(),
				workspaceSkills: skillsService.getAllSkills().length,
				totalFiles: stats.totalFiles,
				totalChunks: stats.totalChunks,
			});
			setKnowledgeState('ready');
		} catch (error) {
			// First launch can legitimately be here while the internal CocoIndex runtime
			// installs and initializes in the main process. Do not present that as a
			// broken project; retry quietly and keep the agent usable meanwhile.
			console.debug('[Forge Project Knowledge] Background preparation still in progress:', error);
			if (!disposedRef.current) setKnowledgeState('preparing');
		} finally {
			refreshInFlightRef.current = false;
		}
	}, [slashContext, workspacePath, workspaceReady]);

	// Initial snapshot for a newly opened/switched workspace. This effect deliberately
	// does not depend on knowledgeState, so a syncing -> ready transition cannot create
	// a render-driven refresh loop.
	useEffect(() => {
		if (!workspaceReady || !workspacePath) {
			setKnowledgeState('idle');
			return;
		}
		void refreshKnowledge(false);
	}, [refreshKnowledge, workspacePath, workspaceReady]);

	// Re-index once an agent run finishes so edits made by the model become searchable
	// immediately. While the agent is running, avoid competing index work.
	useEffect(() => {
		if (isStreaming) {
			wasStreamingRef.current = true;
			return;
		}
		if (wasStreamingRef.current) {
			wasStreamingRef.current = false;
			void refreshKnowledge(true);
		}
	}, [isStreaming, refreshKnowledge]);

	// First-time installation can take a little while. Poll status quietly until ready,
	// then back off to a low-frequency health refresh. There is no immediate call here;
	// the initial/work-complete effects above own immediate refreshes.
	useEffect(() => {
		if (!workspaceReady || !workspacePath || isStreaming) return;
		const delay = knowledgeState === 'ready' ? 30_000 : 3_000;
		const timer = window.setInterval(() => { void refreshKnowledge(false); }, delay);
		return () => window.clearInterval(timer);
	}, [isStreaming, knowledgeState, refreshKnowledge, workspacePath, workspaceReady]);

	const statusText = !workspaceReady
		? 'Open a folder to enable project context'
		: knowledgeState === 'syncing'
			? 'Syncing project context…'
			: knowledgeState === 'preparing'
				? 'Preparing project context in background…'
				: snapshot.totalFiles !== undefined
					? `${snapshot.totalFiles} files indexed`
					: 'Project context ready';

	return <header className='forge-chat-header shrink-0'>
		<div className='forge-chat-header-main'>
			<div className='forge-chat-workspace min-w-0'>
				<span className='forge-chat-section-label'>FORGE AI</span>
				<span className='forge-chat-workspace-name truncate' title={workspaceName}>{workspaceName}</span>
			</div>
			<div className='forge-chat-header-actions'>
				<button type='button' className='forge-chat-icon-action' onClick={() => { void refreshKnowledge(true); }} disabled={!workspaceReady || knowledgeState === 'syncing'} title='Refresh current project context' aria-label='Refresh current project context'>
					<RefreshCw size={13} className={knowledgeState === 'syncing' ? 'animate-spin' : ''} />
				</button>
			</div>
		</div>
		<div className='forge-chat-healthline' aria-live='polite'>
			<span className={`forge-chat-health-dot forge-chat-health-${knowledgeState === 'preparing' ? 'syncing' : knowledgeState}`} />
			<span className='truncate'>{statusText}</span>
			{snapshot.workspaceSkills > 0 && <><span className='forge-chat-health-separator'>•</span><span className='truncate' title={`${snapshot.workspaceSkills} project-local workspace skills`}>{snapshot.workspaceSkills} workspace skills</span></>}
		</div>
	</header>;
};

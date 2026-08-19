/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, RefreshCw, Sparkles } from 'lucide-react';
import { ISkillsService } from '../../../skillsService.js';
import { ISemanticSearchService } from '../../../../../common/forge/contracts/ISemanticSearchService.js';
import type { SlashCommandContext } from '../utils/slashCommandRouter';
import { FORGE_PROJECT_EVOLUTION_TASK, FORGE_SKILL_EVOLUTION_TASK } from '../utils/evolutionPrompts';

type KnowledgeState = 'idle' | 'syncing' | 'ready' | 'error';

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
	const wasStreamingRef = useRef(false);
	const disposedRef = useRef(false);

	useEffect(() => {
		disposedRef.current = false;
		return () => { disposedRef.current = true; };
	}, []);

	const refreshKnowledge = useCallback(async (refreshIndex: boolean) => {
		if (!slashContext) return;
		setKnowledgeState('syncing');
		try {
			const skillsService = slashContext.accessor.get(ISkillsService);
			await skillsService.reloadSkills();

			let indexStats: { totalFiles: number; totalChunks: number } | undefined;
			if (refreshIndex && workspaceReady && workspacePath) {
				const stats = await slashContext.accessor.get(ISemanticSearchService).indexWorkspace(workspacePath);
				indexStats = { totalFiles: stats.totalFiles, totalChunks: stats.totalChunks };
			}

			if (disposedRef.current) return;
			setSnapshot(previous => ({
				...previous,
				registrySkills: skillsService.getRegistrySkillCount(),
				workspaceSkills: skillsService.getAllSkills().length,
				...(indexStats ?? {}),
			}));
			setKnowledgeState('ready');
		} catch (error) {
			console.warn('[Forge Evolution] Could not refresh project knowledge:', error);
			if (!disposedRef.current) setKnowledgeState('error');
		}
	}, [slashContext, workspacePath, workspaceReady]);

	useEffect(() => {
		void refreshKnowledge(false);
	}, [refreshKnowledge]);

	useEffect(() => {
		if (isStreaming) {
			wasStreamingRef.current = true;
			return;
		}
		if (!wasStreamingRef.current) return;
		wasStreamingRef.current = false;
		void refreshKnowledge(true);
	}, [isStreaming, refreshKnowledge]);

	const runProjectEvolution = useCallback(() => {
		if (!slashContext || isStreaming) return;
		slashContext.sendMessage(FORGE_PROJECT_EVOLUTION_TASK);
	}, [isStreaming, slashContext]);

	const runSkillEvolution = useCallback(() => {
		if (!slashContext || isStreaming) return;
		slashContext.sendMessage(FORGE_SKILL_EVOLUTION_TASK);
	}, [isStreaming, slashContext]);

	const statusText = !workspaceReady
		? 'Open a folder to enable project knowledge'
		: knowledgeState === 'syncing'
			? 'Refreshing project knowledge…'
			: knowledgeState === 'error'
				? 'Project knowledge needs refresh'
				: snapshot.totalFiles !== undefined
					? `${snapshot.totalFiles} files indexed`
					: 'Project ready';

	const skillText = snapshot.registrySkills > 0
		? `${snapshot.registrySkills} skills · ${snapshot.workspaceSkills} workspace`
		: `${snapshot.workspaceSkills} workspace skills`;

	return (
		<header className='forge-chat-header shrink-0'>
			<div className='forge-chat-header-main'>
				<div className='forge-chat-workspace min-w-0'>
					<span className='forge-chat-section-label'>CHAT</span>
					<span className='forge-chat-workspace-name truncate' title={workspaceName}>{workspaceName}</span>
				</div>
				<div className='forge-chat-header-actions'>
					<button type='button' className='forge-chat-action' onClick={runProjectEvolution} disabled={!workspaceReady || isStreaming} title='Analyze the current project and propose or apply the next safe evolution'>
						<Sparkles size={13} />
						<span>Evolution</span>
					</button>
					<button type='button' className='forge-chat-action' onClick={runSkillEvolution} disabled={!workspaceReady || isStreaming} title='Evolve project-local skills from proven patterns in the current code'>
						<BookOpen size={13} />
						<span>Skills</span>
					</button>
					<button type='button' className='forge-chat-icon-action' onClick={() => { void refreshKnowledge(true); }} disabled={!workspaceReady || knowledgeState === 'syncing'} title='Refresh project knowledge and workspace skills' aria-label='Refresh project knowledge'>
						<RefreshCw size={13} className={knowledgeState === 'syncing' ? 'animate-spin' : ''} />
					</button>
				</div>
			</div>
			<div className='forge-chat-healthline' aria-live='polite'>
				<span className={`forge-chat-health-dot forge-chat-health-${knowledgeState}`} />
				<span className='truncate'>{statusText}</span>
				<span className='forge-chat-health-separator'>•</span>
				<span className='truncate' title={`${snapshot.registrySkills} registry skills, ${snapshot.workspaceSkills} active workspace skills`}>{skillText}</span>
			</div>
		</header>
	);
};

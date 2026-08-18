/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback, useMemo } from 'react';
import { useForgeBridge } from '../hooks/useForgeBridge';
import { useAccessor, useSettingsState } from '../../util/services.tsx';
import { getCapabilityManifest, ModelCapability } from '../utils/modelCapabilityManifest.js';
import { TopBar } from './TopBar';
import { LeftToolbar } from './LeftToolbar';
import { RightPanel, RightPanelTab } from './RightPanel';
import { BottomStatusBar } from './BottomStatusBar';
import { AgentsView } from './AgentsView';
import { WorkflowsView } from './WorkflowsView';
import { PlanViewInWorkspace } from './PlanViewInWorkspace';

const noModelCapabilities: ModelCapability = {
	canReason: false,
	canEdit: false,
	canUseTools: false,
	canAcceptAttachments: true,
	canUseVoice: false,
	canUseImages: false,
	canUseArt: false,
	canUseCodeExecution: false,
	maxContextTokens: null,
	supportsStreaming: false,
	supportsMultiAgent: false,
	supportsTaskMode: false,
	reasoningBudgetSlider: null,
	reasoningEffortOptions: null,
};

export const AgentWorkspace: React.FC = () => {
	const bridge = useForgeBridge();
	const accessor = useAccessor();
	const settingsState = useSettingsState();
	const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('agents');
	const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
	const [activeTool, setActiveTool] = useState<'agents' | 'workflows' | 'plan'>('agents');
	const [activeFeature, setActiveFeature] = useState('Agent');

	const chatModel = settingsState.modelSelectionOfFeature.Chat;
	const modelCapabilities = useMemo(() => chatModel
		? getCapabilityManifest(chatModel.providerName, chatModel.modelName, settingsState.overridesOfModel)
		: noModelCapabilities,
	[chatModel, settingsState.overridesOfModel]);

	const notify = useCallback((message: string, error = false) => {
		try {
			const notifications = accessor.get('INotificationService');
			if (error) notifications.error(message); else notifications.info(message);
		} catch { /* optional during shutdown */ }
	}, [accessor]);

	const handleToolChange = useCallback((tool: string) => {
		if (tool !== 'agents' && tool !== 'workflows' && tool !== 'plan') return;
		setActiveTool(tool);
		setRightPanelTab(tool);
		setIsRightPanelOpen(true);
	}, []);

	const handleStartWorkflow = useCallback((name: string, description: string, goal: string) => {
		bridge.startWorkflow(name, description, goal);
		handleToolChange('plan');

		const chat = accessor.get('IChatThreadService');
		let threadId = chat.state.currentThreadId;
		if (!threadId) threadId = chat.createNewThread();
		const prompt = [
			`Run this as a Forge workflow: ${name}.`,
			description ? `Description: ${description}` : '',
			`Goal: ${goal}`,
			'Create an executable plan, inspect the minimum necessary workspace context, implement the task with tools, run targeted verification, fix failures, review the final diff, and continue until the goal is materially complete. Use browser/design/Work Mode integrations only when the task requires them.',
		].filter(Boolean).join('\n\n');

		void chat.addUserMessageAndStreamResponse({ threadId, userMessage: prompt })
			.then(() => notify(`Workflow "${name}" finished its current agent run.`))
			.catch(error => notify(`Workflow "${name}" failed to start: ${error instanceof Error ? error.message : String(error)}`, true));
		void chat.focusCurrentChat();
	}, [accessor, bridge, handleToolChange, notify]);

	const handleCancelWorkflow = useCallback((workflowId: string) => {
		bridge.cancelWorkflow(workflowId);
		const chat = accessor.get('IChatThreadService');
		const threadId = chat.state.currentThreadId;
		if (threadId) void chat.abortRunning(threadId).catch(error => notify(`Could not stop the active agent run: ${error instanceof Error ? error.message : String(error)}`, true));
	}, [accessor, bridge, notify]);

	const rerunActivePlan = useCallback(() => {
		const workflow = bridge.activeWorkflow;
		if (!workflow) return;
		handleStartWorkflow(workflow.name, workflow.description, workflow.plan?.goal || workflow.description || workflow.name);
	}, [bridge.activeWorkflow, handleStartWorkflow]);

	const handleFeatureChange = useCallback((feature: string) => {
		setActiveFeature(feature);
		if (feature === 'Chat' || feature === 'Agent') {
			handleToolChange('agents');
			return;
		}
		if (feature === 'Edit' || feature === 'Code') {
			handleToolChange('workflows');
			return;
		}
		if (feature === 'Art') {
			setRightPanelTab('forge');
			setIsRightPanelOpen(true);
		}
	}, [handleToolChange]);

	const renderMainContent = () => {
		switch (activeTool) {
			case 'agents':
				return <AgentsView agents={bridge.state.agents} selectedAgentId={bridge.state.selectedAgentId} workflows={bridge.state.workflows} onSelectAgent={bridge.selectAgent} onCreateAgent={bridge.createAgent} onDeleteAgent={bridge.deleteAgent} onStartWorkflow={handleStartWorkflow} onCancelWorkflow={handleCancelWorkflow} />;
			case 'workflows':
				return <WorkflowsView workflows={bridge.state.workflows} activeWorkflowId={bridge.state.activeWorkflowId} planMode={bridge.state.planMode} onStartWorkflow={handleStartWorkflow} onCancelWorkflow={handleCancelWorkflow} onDeleteWorkflow={bridge.deleteWorkflow} onSetActiveWorkflow={bridge.setActiveWorkflow} />;
			case 'plan':
				return <PlanViewInWorkspace plan={bridge.activeWorkflow?.plan ?? bridge.state.plan ?? null} onRerun={bridge.activeWorkflow ? rerunActivePlan : undefined} />;
		}
	};

	return (
		<div className='flex flex-col h-full bg-void-bg-2 text-void-fg-1'>
			<TopBar
				providerName={chatModel?.providerName ?? null}
				modelName={chatModel?.modelName ?? 'No model'}
				capabilities={modelCapabilities}
				isConnected={!!chatModel}
				isStreaming={bridge.state.planMode === 'running'}
				activeFeature={activeFeature}
				onFeatureChange={handleFeatureChange}
			/>

			<div className='flex flex-1 overflow-hidden'>
				<LeftToolbar activeTool={activeTool} onToolChange={handleToolChange} hasActiveThread={!!bridge.activeWorkflow} threadCount={bridge.state.workflows.length} isRightPanelOpen={isRightPanelOpen} onToggleRightPanel={() => setIsRightPanelOpen(value => !value)} />

				<div className='flex-1 flex flex-col overflow-hidden min-w-0'>
					<div className='flex items-center gap-0.5 px-2 py-1 border-b border-zinc-700/40 bg-zinc-900/40 shrink-0'>
						{(['agents', 'workflows', 'plan'] as const).map(tab => (
							<button key={tab} type='button' onClick={() => handleToolChange(tab)} className={`px-2.5 py-1 text-[10px] font-medium rounded transition-colors cursor-pointer capitalize ${activeTool === tab ? 'bg-zinc-700 text-zinc-200 border border-zinc-600' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border border-transparent'}`}>{tab}</button>
						))}
					</div>
					<div className='flex-1 overflow-hidden'>{renderMainContent()}</div>
				</div>

				<RightPanel
					isOpen={isRightPanelOpen}
					activeTab={rightPanelTab}
					onTabChange={tab => {
						setRightPanelTab(tab);
						if (tab === 'agents' || tab === 'workflows' || tab === 'plan') handleToolChange(tab);
					}}
					onClose={() => setIsRightPanelOpen(false)}
					agents={bridge.state.agents}
					activeAgentName={bridge.state.selectedAgentId ? bridge.state.agents.find(agent => agent.id === bridge.state.selectedAgentId)?.name : undefined}
					providerName={chatModel?.providerName ?? 'No provider'}
					modelName={chatModel?.modelName ?? 'No model'}
				/>
			</div>

			<BottomStatusBar contextTokens={0} maxContextTokens={modelCapabilities.maxContextTokens} gpuMemoryUsage={null} gpuMemoryTotal={null} cpuUsage={null} latencyMs={null} isRunning={bridge.state.planMode === 'running'} activeTool={activeTool} threadId={bridge.state.activeWorkflowId ?? undefined} />
		</div>
	);
};
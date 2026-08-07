/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0 See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import { useForgeBridge, ForgeState } from '../hooks/useForgeBridge';
import { TopBar } from './TopBar';
import { LeftToolbar } from './LeftToolbar';
import { RightPanel } from './RightPanel';
import { BottomStatusBar } from './BottomStatusBar';
import { AgentsView } from './AgentsView';
import { WorkflowsView } from './WorkflowsView';
import { PlanViewInWorkspace } from './PlanViewInWorkspace';

// ─── Sub-toolbar views ───────────────────────────────────────────────────────

const ToolsView: React.FC<{ state: ForgeState; bridge: ReturnType<typeof useForgeBridge> }> = ({ bridge }) => {
	const { createAgent, startWorkflow, cancelWorkflow, setActiveWorkflow } = bridge;
	return (
		<AgentsView
			agents={bridge.state.agents}
			selectedAgentId={bridge.state.selectedAgentId}
			workflows={bridge.state.workflows}
			onSelectAgent={bridge.selectAgent}
			onCreateAgent={createAgent}
			onStartWorkflow={startWorkflow}
			onCancelWorkflow={cancelWorkflow}
		/>
	);
};

const SubWorkflowsView: React.FC<{ state: ForgeState; bridge: ReturnType<typeof useForgeBridge> }> = ({ bridge }) => {
	const { cancelWorkflow, setActiveWorkflow } = bridge;
	return (
		<WorkflowsView
			workflows={bridge.state.workflows}
			activeWorkflowId={bridge.state.activeWorkflowId}
			planMode={bridge.state.planMode}
			onStartWorkflow={bridge.startWorkflow}
			onCancelWorkflow={cancelWorkflow}
			onSetActiveWorkflow={setActiveWorkflow}
		/>
	);
};

const SubPlanView: React.FC<{ state: ForgeState; bridge: ReturnType<typeof useForgeBridge> }> = ({ bridge }) => {
	const activeWorkflow = bridge.activeWorkflow;
	return (
		<PlanViewInWorkspace
			plan={activeWorkflow?.plan ?? null}
		/>
	);
};

// ─── Main AgentWorkspace ─────────────────────────────────────────────────────

export const AgentWorkspace: React.FC = () => {
	const bridge = useForgeBridge();
	const [rightPanelTab, setRightPanelTab] = useState<'agents' | 'workflows' | 'plan' | 'forge'>('agents');
	const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
	const [activeTool, setActiveTool] = useState<'agents' | 'workflows' | 'plan'>('agents');

	const handleToolChange = useCallback((tool: string) => {
		setActiveTool(tool as 'agents' | 'workflows' | 'plan');
		if (tool === 'agents' || tool === 'workflows' || tool === 'plan') {
			setRightPanelTab(tool);
			setIsRightPanelOpen(true);
		}
	}, []);

	// Determine what to show in the right panel
	const renderRightPanelContent = () => {
		switch (rightPanelTab) {
			case 'agents':
				return <AgentsView
					agents={bridge.state.agents}
					selectedAgentId={bridge.state.selectedAgentId}
					workflows={bridge.state.workflows}
					onSelectAgent={bridge.selectAgent}
					onCreateAgent={bridge.createAgent}
					onStartWorkflow={bridge.startWorkflow}
					onCancelWorkflow={bridge.cancelWorkflow}
				/>;
			case 'workflows':
				return <WorkflowsView
					workflows={bridge.state.workflows}
					activeWorkflowId={bridge.state.activeWorkflowId}
					planMode={bridge.state.planMode}
					onStartWorkflow={bridge.startWorkflow}
					onCancelWorkflow={bridge.cancelWorkflow}
					onSetActiveWorkflow={bridge.setActiveWorkflow}
				/>;
			case 'plan':
				return <PlanViewInWorkspace
					plan={bridge.activeWorkflow?.plan ?? bridge.state.plan ?? null}
				/>;
			case 'forge':
				return <div className='flex flex-col items-center justify-center h-full text-zinc-600 p-4'>
					<span className='text-xs'>Forge Agent Panel</span>
					<span className='text-[10px] mt-1 text-zinc-700'>Use Agents, Workflows, or Plan tabs</span>
				</div>;
			default:
				return null;
		}
	};

	// Main content area based on active tool
	const renderMainContent = () => {
		switch (activeTool) {
			case 'agents':
				return <ToolsView state={bridge.state} bridge={bridge} />;
			case 'workflows':
				return <SubWorkflowsView state={bridge.state} bridge={bridge} />;
			case 'plan':
				return <SubPlanView state={bridge.state} bridge={bridge} />;
			default:
				return <div className='flex flex-col items-center justify-center h-full text-zinc-600'>
					<span className='text-xs'>Select a tool from the left toolbar</span>
				</div>;
		}
	};

	return (
		<div className='flex flex-col h-full bg-void-bg-2 text-void-fg-1'>
			{/* Top Bar */}
			<TopBar
				providerName={null}
				modelName='Forge'
				capabilities={{ canReason: true, canUseTools: true, canUseVoice: false, canUseImages: false }}
				isConnected={true}
				isStreaming={bridge.state.planMode === 'running'}
				activeFeature='Forge'
				onFeatureChange={() => {}}
			/>

			<div className='flex flex-1 overflow-hidden'>
				{/* Left Toolbar */}
				<LeftToolbar
					activeTool={activeTool}
					onToolChange={handleToolChange}
					hasActiveThread={!!bridge.activeWorkflow}
					threadCount={bridge.state.workflows.length}
					isRightPanelOpen={isRightPanelOpen}
					onToggleRightPanel={() => setIsRightPanelOpen(v => !v)}
				/>

				{/* Main content area */}
				<div className='flex-1 flex flex-col overflow-hidden min-w-0'>
					{/* Sub-tool tabs for agents/workflows/plan */}
					{['agents', 'workflows', 'plan'].includes(activeTool) && (
						<div className='flex items-center gap-0.5 px-2 py-1 border-b border-zinc-700/40 bg-zinc-900/40 shrink-0'>
							{(['agents', 'workflows', 'plan'] as const).map(tab => (
								<button
									key={tab}
									type='button'
									onClick={() => {
										setActiveTool(tab);
										setRightPanelTab(tab);
										setIsRightPanelOpen(true);
									}}
									className={`
										px-2.5 py-1 text-[10px] font-medium rounded transition-colors cursor-pointer capitalize
										${rightPanelTab === tab && activeTool === tab
											? 'bg-zinc-700 text-zinc-200 border border-zinc-600'
											: 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border border-transparent'
										}
									`}
								>
									{tab}
								</button>
							))}
						</div>
					)}

					<div className='flex-1 overflow-hidden'>
						{renderMainContent()}
					</div>
				</div>

				{/* Right Panel */}
				<RightPanel
					isOpen={isRightPanelOpen}
					activeTab={rightPanelTab}
					onTabChange={(tab) => {
						setRightPanelTab(tab as 'agents' | 'workflows' | 'plan' | 'forge');
						if (tab !== 'forge') {
							setActiveTool(tab as 'agents' | 'workflows' | 'plan');
						}
					}}
					onClose={() => setIsRightPanelOpen(false)}
					agents={bridge.state.agents}
					activeAgentName={bridge.state.selectedAgentId ? bridge.state.agents.find(a => a.id === bridge.state.selectedAgentId)?.name : undefined}
					providerName='Forge'
					modelName={bridge.selectedAgent?.name ?? 'Forge Agent'}
				/>
			</div>

			{/* Bottom Status Bar */}
			<BottomStatusBar
				contextTokens={0}
				maxContextTokens={null}
				gpuMemoryUsage={null}
				gpuMemoryTotal={null}
				cpuUsage={null}
				latencyMs={null}
				isRunning={bridge.state.planMode === 'running'}
				activeTool={activeTool}
				threadId={bridge.state.activeWorkflowId ?? undefined}
			/>
		</div>
	);
};

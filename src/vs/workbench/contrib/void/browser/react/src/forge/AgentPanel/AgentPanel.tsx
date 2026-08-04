import React, { useEffect, useState } from 'react';
import { PlanView } from '../components/Plan/PlanView';
import { DiffView } from '../components/Diff/DiffView';
import { Timeline } from '../components/Timeline/Timeline';
import { LogsView } from '../components/Logs/LogsView';
import { WorkspaceView } from '../components/Workspace/WorkspaceView';
import { BrowserPanel } from '../components/Browser/BrowserPanel';
import { WorkspaceHealthDashboard } from '../components/Knowledge/WorkspaceHealthDashboard';
import { KnowledgeGraphView } from '../components/Knowledge/KnowledgeGraphView';
import { MultiAgentView } from '../components/Collaboration/MultiAgentView';
import { AdaptiveContextInspector } from '../components/Adaptive/AdaptiveContextInspector';
import { TokenBudgetInspector } from '../components/Compression/TokenBudgetInspector';
import { StatusBar } from '../components/StatusBar/StatusBar';
import { PlannerOutput } from '../../../../common/forge/planner/planSchema';
import { ForgeEvent } from '../../../../common/forge/events/forgeEvents';
import { WorkspaceSnapshot } from '../../../../common/forge/types/workspaceTypes';
import { WorkspaceHealthStats, KnowledgeGraphSnapshot } from '../../../../common/forge/types/knowledgeGraphTypes';
import { ForgeEventBus } from '../../../../forge/events/forgeEventBus';
import { ExecutionBus } from '../../../../forge/execution/bus/executionBus';
import { WorkspaceIntelligenceService } from '../../../../forge/services/workspaceIntelligenceService';
import { KnowledgeService } from '../../../../forge/services/knowledgeService';
import { useAccessor } from '../../util/services.tsx';
import { FORGE_CHANNEL_NAME } from '../../../../common/forge/contracts/forgeIPC.js';

export const AgentPanel: React.FC = () => {
	const accessor = useAccessor();
	const forgeChannel = accessor.get('IMainProcessService').getChannel(FORGE_CHANNEL_NAME);
	const [activeTab, setActiveTab] = useState<'plan' | 'diff' | 'timeline' | 'logs' | 'workspace' | 'browser' | 'health' | 'collaboration'>('plan');
	const [plan, setPlan] = useState<PlannerOutput | null>(null);
	const [events, setEvents] = useState<ForgeEvent[]>([]);
	const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
	const [health, setHealth] = useState<WorkspaceHealthStats | null>(null);
	const [graphSnapshot, setGraphSnapshot] = useState<KnowledgeGraphSnapshot | null>(null);

	useEffect(() => {
		const bus = ForgeEventBus.getInstance();
		const listener = bus.onEvent((evt: ForgeEvent) => {
			setEvents(prev => [evt, ...prev]);

			if (evt.type === 'PLAN_CREATED') {
				setPlan(evt.payload.plan);
			} else if (evt.type === 'PLAN_STEP_UPDATED' && plan) {
				const updatedSteps = plan.steps.map(s =>
					s.id === evt.payload.stepId ? evt.payload.step : s
				);
				setPlan({ ...plan, steps: updatedSteps });
			} else if (evt.type === 'WORKSPACE_SCAN_COMPLETED') {
				setSnapshot(evt.payload.snapshot);
			}
		});

		const execBus = ExecutionBus.getInstance();
		const execListener = execBus.onEvent((evt) => {
			setEvents(prev => [{
				id: evt.id,
				type: evt.type as any,
				timestamp: evt.timestamp,
				payload: evt.payload
			}, ...prev]);
		});

		return () => {
			listener.dispose();
			execListener.dispose();
		};
	}, [plan]);

	const handleBuildWorkspace = async () => {
		const service = WorkspaceIntelligenceService.create(forgeChannel);
		const result = await service.buildWorkspace('.', true);
		if (result) {
			setSnapshot(result);
			const ks = KnowledgeService.create(forgeChannel);
			const h = await ks.getWorkspaceHealth('.');
			const g = await ks.getKnowledgeGraph('.');
			setHealth(h);
			setGraphSnapshot(g);
		}
	};

	return (
		<div className="flex flex-col h-full bg-[#070B14] text-white font-sans">
			<div className="flex items-center space-x-2 border-b border-white/5 p-2 overflow-x-auto">
				<button
					onClick={() => setActiveTab('plan')}
					className={`px-3 py-1 text-xs rounded font-medium ${activeTab === 'plan' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
				>
					Plan {plan ? `(${plan.steps.filter(s => s.status === 'completed').length}/${plan.steps.length})` : ''}
				</button>
				<button
					onClick={() => setActiveTab('diff')}
					className={`px-3 py-1 text-xs rounded font-medium ${activeTab === 'diff' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
				>
					Diff
				</button>
				<button
					onClick={() => setActiveTab('timeline')}
					className={`px-3 py-1 text-xs rounded font-medium ${activeTab === 'timeline' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
				>
					Timeline {events.length > 0 ? `(${events.length})` : ''}
				</button>
				<button
					onClick={() => setActiveTab('logs')}
					className={`px-3 py-1 text-xs rounded font-medium ${activeTab === 'logs' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
				>
					Logs
				</button>
				<button
					onClick={() => setActiveTab('workspace')}
					className={`px-3 py-1 text-xs rounded font-medium transition-colors ${activeTab === 'workspace'
							? 'bg-teal-600 text-white shadow-sm shadow-teal-500/30'
							: 'text-teal-400 hover:text-teal-200 hover:bg-teal-950/40'
						}`}
				>
					🧠 Workspace {snapshot ? `(${snapshot.stats.totalSymbols})` : ''}
				</button>
				<button
					onClick={() => setActiveTab('browser')}
					className={`px-3 py-1 text-xs rounded font-medium transition-colors ${activeTab === 'browser'
							? 'bg-[#6C5CE7] text-white shadow-sm shadow-[#6C5CE7]/40'
							: 'text-[#00D4FF] hover:text-white hover:bg-[#6C5CE7]/20'
						}`}
				>
					🌐 Browser
				</button>
				<button
					onClick={() => setActiveTab('health')}
					className={`px-3 py-1 text-xs rounded font-medium transition-colors ${activeTab === 'health'
							? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/40'
							: 'text-emerald-400 hover:text-white hover:bg-emerald-950/40'
						}`}
				>
					📊 Health & Graph
				</button>
				<button
					onClick={() => setActiveTab('collaboration')}
					className={`px-3 py-1 text-xs rounded font-medium transition-colors ${activeTab === 'collaboration'
							? 'bg-purple-600 text-white shadow-sm shadow-purple-500/40'
							: 'text-purple-400 hover:text-white hover:bg-purple-950/40'
						}`}
				>
					👥 Multi-Agent
				</button>
			</div>

			<div className="flex-1 overflow-y-auto p-3">
				{activeTab === 'plan' && <PlanView plan={plan} />}
				{activeTab === 'diff' && <DiffView patches={[]} />}
				{activeTab === 'timeline' && <Timeline events={events} />}
				{activeTab === 'logs' && <LogsView events={events} />}
				{activeTab === 'workspace' && (
					<WorkspaceView snapshot={snapshot} onBuildWorkspace={handleBuildWorkspace} />
				)}
				{activeTab === 'browser' && <BrowserPanel />}
				{activeTab === 'health' && (
					<div className="space-y-4">
						<WorkspaceHealthDashboard health={health} />
						<KnowledgeGraphView snapshot={graphSnapshot} />
					</div>
				)}
				{activeTab === 'collaboration' && <MultiAgentView />}
			</div>

			<AdaptiveContextInspector />
			<TokenBudgetInspector />
			<StatusBar plan={plan} activeEventCount={events.length} />
		</div>
	);
};

import React from 'react';
import { AgentRegistry } from '../../../../../browser/forge/execution/agents/agentRegistry';
import { SharedBlackboard } from '../../../../../browser/forge/execution/blackboard/blackboard';

export const MultiAgentView: React.FC = () => {
	const agents = AgentRegistry.getInstance().getAllAgents();
	const artifacts = SharedBlackboard.getInstance().getAllArtifacts();

	return (
		<div className="space-y-4 font-sans text-xs text-slate-200">
			{/* Active Agent Roster */}
			<div className="p-3 bg-[#111827] rounded-lg border border-white/5 space-y-2">
				<div className="flex items-center justify-between border-b border-white/5 pb-2">
					<span className="font-bold text-[#00D4FF] flex items-center space-x-1">
						<span>👥</span>
						<span>Specialized Multi-Agent Roster</span>
					</span>
					<span className="text-[10px] text-slate-400 font-mono">{agents.length} Agents Online</span>
				</div>

				<div className="grid grid-cols-2 gap-2 font-mono">
					{agents.map(a => (
						<div key={a.id} className="p-2 rounded bg-[#182233] border border-white/5 space-y-1">
							<div className="flex items-center justify-between">
								<span className="font-semibold text-slate-100 text-[11px]">{a.name}</span>
								<span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
									{a.health.isHealthy ? 'HEALTHY' : 'DEGRADED'}
								</span>
							</div>
							<div className="flex justify-between text-[10px] text-slate-400">
								<span>Role: {a.role}</span>
								<span>Load: {a.health.currentLoad}%</span>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Shared Blackboard State */}
			<div className="p-3 bg-[#111827] rounded-lg border border-white/5 space-y-2">
				<div className="flex items-center justify-between border-b border-white/5 pb-2">
					<span className="font-bold text-[#14F195] flex items-center space-x-1">
						<span>📋</span>
						<span>Shared Blackboard (Artifact Bus)</span>
					</span>
					<span className="text-[10px] text-slate-400 font-mono">{artifacts.length} Shared Artifacts</span>
				</div>

				{artifacts.length === 0 ? (
					<p className="text-slate-500 text-[11px] font-mono text-center py-2">
						No shared artifacts published on blackboard yet.
					</p>
				) : (
					<div className="space-y-1.5 font-mono text-[11px]">
						{artifacts.map(art => (
							<div key={art.id} className="p-2 rounded bg-[#182233] border border-white/5 flex items-center justify-between">
								<div>
									<div className="text-slate-200 font-semibold">{art.title}</div>
									<div className="text-[10px] text-slate-400">Producer: {art.producerAgentId}</div>
								</div>
								<span className="px-2 py-0.5 rounded text-[9px] bg-[#6C5CE7]/20 text-[#00D4FF] border border-[#6C5CE7]/30">
									{art.state.toUpperCase()}
								</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

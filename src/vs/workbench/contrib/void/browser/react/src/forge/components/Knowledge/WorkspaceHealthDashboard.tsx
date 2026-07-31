/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { WorkspaceHealthStats } from '../../../../../common/forge/types/knowledgeGraphTypes';

export const WorkspaceHealthDashboard: React.FC<{ health: WorkspaceHealthStats | null }> = ({ health }) => {
	if (!health) {
		return (
			<div className="p-4 text-xs text-slate-500 font-mono text-center">
				No health metrics available. Build the workspace model to inspect health.
			</div>
		);
	}

	const gradeColors: Record<string, string> = {
		A: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
		B: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
		C: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
		D: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
		F: 'text-rose-400 border-rose-500/30 bg-rose-500/10'
	};

	return (
		<div className="p-3 bg-[#111827] rounded-lg border border-white/5 space-y-3 font-sans text-xs text-slate-200">
			<div className="flex items-center justify-between border-b border-white/5 pb-2">
				<span className="font-bold text-[#6C5CE7] flex items-center space-x-1">
					<span>📊</span>
					<span>Workspace Health</span>
				</span>
				<span className={`px-2 py-0.5 rounded font-mono font-bold text-sm border ${gradeColors[health.healthGrade] || gradeColors.A}`}>
					GRADE {health.healthGrade}
				</span>
			</div>

			<div className="grid grid-cols-3 gap-2 font-mono">
				<div className="p-2 rounded bg-[#182233] border border-white/5">
					<div className="text-slate-400 text-[10px] uppercase">Complexity Score</div>
					<div className="text-base font-bold text-[#00D4FF] mt-0.5">{health.complexityScore} / 100</div>
				</div>
				<div className="p-2 rounded bg-[#182233] border border-white/5">
					<div className="text-slate-400 text-[10px] uppercase">Circular Imports</div>
					<div className={`text-base font-bold mt-0.5 ${health.circularImportCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
						{health.circularImportCount}
					</div>
				</div>
				<div className="p-2 rounded bg-[#182233] border border-white/5">
					<div className="text-slate-400 text-[10px] uppercase">Dead Code Candidates</div>
					<div className="text-base font-bold text-slate-300 mt-0.5">{health.deadCodeCount}</div>
				</div>
			</div>

			<div className="p-2.5 rounded bg-[#182233] border border-white/5 space-y-1">
				<div className="flex justify-between text-[11px]">
					<span className="text-slate-400">Most Coupled Module:</span>
					<span className="font-mono text-[#14F195] font-semibold">{health.mostCoupledModule}</span>
				</div>
				<div className="flex justify-between text-[11px]">
					<span className="text-slate-400">Total Indexed Files:</span>
					<span className="font-mono text-slate-200">{health.totalFiles} files</span>
				</div>
				<div className="flex justify-between text-[11px]">
					<span className="text-slate-400">Total Indexed Symbols:</span>
					<span className="font-mono text-slate-200">{health.totalSymbols} symbols</span>
				</div>
			</div>
		</div>
	);
};

/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { WorkspaceMatch } from '../../../../common/forge/types/browserTypes.js';

export const WorkspaceMatches: React.FC<{ matches: WorkspaceMatch[] }> = ({ matches }) => {
	return (
		<div className="w-64 bg-[#070B14] border-l border-white/5 p-3 text-xs space-y-3 overflow-y-auto">
			<div className="flex items-center space-x-1 text-[#6C5CE7] font-bold text-xs uppercase tracking-wider">
				<span>🔗</span>
				<span>Workspace Matches</span>
			</div>

			{matches.length === 0 ? (
				<p className="text-slate-600 text-[11px]">No active workspace matches for this web page.</p>
			) : (
				matches.map((m, i) => (
					<div
						key={i}
						className="p-2 rounded bg-[#111827] border border-[#6C5CE7]/20 hover:border-[#00D4FF] transition-all space-y-1"
					>
						<div className="flex items-center justify-between">
							<span className="font-semibold text-slate-200 text-[11px] truncate">{m.symbolName}</span>
							<span className="px-1 py-0.2 text-[9px] rounded bg-[#6C5CE7]/30 text-[#00D4FF] font-mono">{m.kind}</span>
						</div>
						<div className="text-slate-500 font-mono text-[10px] truncate">{m.filePath.split('/').slice(-2).join('/')}</div>
						<div className="text-slate-400 text-[10px] leading-tight">{m.reason}</div>
					</div>
				))
			)}
		</div>
	);
};

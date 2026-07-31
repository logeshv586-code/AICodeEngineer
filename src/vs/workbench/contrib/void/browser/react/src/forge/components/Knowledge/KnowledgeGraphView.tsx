/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { KnowledgeGraphSnapshot } from '../../../../../common/forge/types/knowledgeGraphTypes';

export const KnowledgeGraphView: React.FC<{ snapshot: KnowledgeGraphSnapshot | null }> = ({ snapshot }) => {
	if (!snapshot || snapshot.totalEntities === 0) {
		return (
			<div className="p-4 text-xs text-slate-500 font-mono text-center">
				No Knowledge Graph data available. Index workspace and browse web pages to build graph nodes.
			</div>
		);
	}

	return (
		<div className="p-3 bg-[#070B14] rounded-lg border border-white/5 space-y-3 font-sans text-xs">
			<div className="flex items-center justify-between border-b border-white/5 pb-2">
				<span className="font-bold text-[#00D4FF] flex items-center space-x-1">
					<span>🕸️</span>
					<span>Knowledge Graph Inspector</span>
				</span>
				<span className="text-[10px] text-slate-400 font-mono">
					{snapshot.totalEntities} entities · {snapshot.totalEdges} relations
				</span>
			</div>

			<div className="space-y-1.5 max-h-64 overflow-y-auto font-mono text-[11px]">
				{snapshot.entities.slice(0, 30).map(entity => (
					<div
						key={entity.id}
						className="flex items-center justify-between p-2 rounded bg-[#111827] border border-white/5 hover:border-[#6C5CE7] transition-all"
					>
						<div className="flex items-center space-x-2 truncate">
							<span className="px-1.5 py-0.5 rounded text-[9px] bg-[#6C5CE7]/30 text-[#00D4FF] font-semibold">
								{entity.type}
							</span>
							<span className="text-slate-200 truncate">{entity.title}</span>
						</div>
						<span className="text-[10px] text-slate-500">{entity.source}</span>
					</div>
				))}
			</div>
		</div>
	);
};

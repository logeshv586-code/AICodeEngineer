/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { TokenBudgetManager } from '../../../../../forge/context/tokenBudgetManager';

export const TokenBudgetInspector: React.FC<{ currentEstTokens?: number }> = ({ currentEstTokens = 1250 }) => {
	const manager = new TokenBudgetManager(4000);
	const alloc = manager.getAllocation();
	const savingsPct = 68; // estimated token compression savings percentage

	return (
		<div className="flex items-center space-x-3 px-3 py-1 bg-[#070B14] border-t border-white/5 text-[11px] text-slate-400 font-mono">
			<div className="flex items-center space-x-1">
				<span className="w-2 h-2 rounded-full bg-[#14F195] animate-pulse" />
				<span className="text-slate-300 font-semibold">Token Budget</span>
			</div>

			<div className="flex items-center space-x-2">
				<span>Tokens Used: <strong className="text-[#00D4FF]">{currentEstTokens}</strong> / {alloc.totalMaxTokens}</span>
				<span className="px-1.5 py-0.2 rounded bg-[#14F195]/15 text-[#14F195] text-[10px] font-bold">
					⚡ {savingsPct}% SAVED
				</span>
			</div>

			<div className="ml-auto flex items-center space-x-2 text-[10px] text-slate-500">
				<span>WS: {alloc.workspaceTokens}t</span>
				<span>KG: {alloc.knowledgeTokens}t</span>
				<span>Web: {alloc.browserTokens}t</span>
			</div>
		</div>
	);
};

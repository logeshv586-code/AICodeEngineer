/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { BrowserPage } from '../../../../common/forge/types/browserTypes.js';

export const BrowserOverlay: React.FC<{ page?: BrowserPage }> = ({ page }) => {
	if (!page) return null;

	return (
		<div className="p-3 bg-[#111827]/90 backdrop-blur-md border-t border-white/5 text-xs text-slate-300 space-y-2">
			<div className="flex items-center justify-between border-b border-white/5 pb-2">
				<span className="font-bold text-[#6C5CE7] flex items-center space-x-1">
					<span>🧠</span>
					<span>AI Web Overlay</span>
				</span>
				<span className="text-[10px] text-slate-500 font-mono">{page.url}</span>
			</div>

			<div className="grid grid-cols-4 gap-2">
				<div className="p-2 rounded bg-[#182233] border border-white/5">
					<div className="text-[#00D4FF] font-semibold text-[11px]">Headings</div>
					<div className="text-slate-400 font-mono text-[10px] mt-0.5">{page.headings.length} headings found</div>
				</div>
				<div className="p-2 rounded bg-[#182233] border border-white/5">
					<div className="text-[#14F195] font-semibold text-[11px]">Code Blocks</div>
					<div className="text-slate-400 font-mono text-[10px] mt-0.5">{page.codeBlocks.length} code blocks</div>
				</div>
				<div className="p-2 rounded bg-[#182233] border border-white/5">
					<div className="text-amber-400 font-semibold text-[11px]">Tables</div>
					<div className="text-slate-400 font-mono text-[10px] mt-0.5">{page.tables.length} tables</div>
				</div>
				<div className="p-2 rounded bg-[#182233] border border-white/5">
					<div className="text-rose-400 font-semibold text-[11px]">Forms</div>
					<div className="text-slate-400 font-mono text-[10px] mt-0.5">{page.forms.length} forms</div>
				</div>
			</div>
		</div>
	);
};

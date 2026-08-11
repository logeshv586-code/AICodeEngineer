/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { BrowserTabState } from '../../../../common/forge/types/browserTypes.js';
import { ForgeTheme } from '../../theme/theme';

export const BrowserTabs: React.FC<{
	tabs: BrowserTabState[];
	activeTabId: string | null;
	onSelectTab: (id: string) => void;
	onCloseTab: (id: string) => void;
	onNewTab: (url: string) => void;
}> = ({ tabs, activeTabId, onSelectTab, onCloseTab, onNewTab }) => {
	const presets = [
		{ name: 'Localhost', url: 'http://localhost:3000' },
		{ name: 'React Docs', url: 'https://react.dev' },
		{ name: 'MDN', url: 'https://developer.mozilla.org' },
		{ name: 'GitHub', url: 'https://github.com' }
	];

	return (
		<div className="flex items-center justify-between px-2 py-1.5 bg-[#070B14] border-b border-white/5 overflow-x-auto">
			<div className="flex items-center space-x-1">
				{tabs.map(tab => {
					const isActive = tab.id === activeTabId;
					return (
						<div
							key={tab.id}
							onClick={() => onSelectTab(tab.id)}
							className={`group flex items-center space-x-2 px-3 py-1 text-xs rounded-t cursor-pointer transition-all ${isActive
									? 'bg-[#111827] text-slate-100 border-t-2 border-[#6C5CE7] font-semibold'
									: 'text-slate-400 hover:text-slate-200 hover:bg-[#111827]/40'
								}`}
						>
							{tab.isPinned && <span className="text-[10px] text-[#00D4FF]">📌</span>}
							<span className="truncate max-w-[120px]">{tab.title}</span>
							<button
								onClick={e => {
									e.stopPropagation();
									onCloseTab(tab.id);
								}}
								className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 text-xs px-1"
							>
								✕
							</button>
						</div>
					);
				})}
			</div>

			<div className="flex items-center space-x-1 pl-2 border-l border-white/5">
				{presets.map(p => (
					<button
						key={p.name}
						onClick={() => onNewTab(p.url)}
						className="px-2 py-0.5 text-[10px] rounded bg-[#182233] text-slate-300 hover:text-[#00D4FF] hover:bg-[#6C5CE7]/20 transition-all font-mono"
					>
						+ {p.name}
					</button>
				))}
			</div>
		</div>
	);
};

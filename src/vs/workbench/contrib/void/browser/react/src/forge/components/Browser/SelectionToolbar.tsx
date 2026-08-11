/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { DOMSelection } from '../../../../common/forge/types/browserTypes.js';

export const SelectionToolbar: React.FC<{
	selection: DOMSelection | null;
	onAction: (action: string) => void;
}> = ({ selection, onAction }) => {
	if (!selection || !selection.text) return null;

	const actions = [
		{ label: 'Explain', icon: '💬', id: 'explain' },
		{ label: 'Summarize', icon: '📑', id: 'summarize' },
		{ label: 'Copy Markdown', icon: '📋', id: 'copy_md' },
		{ label: 'Generate Playwright', icon: '🎭', id: 'playwright' },
		{ label: 'Search Workspace', icon: '🔍', id: 'search_ws' },
		{ label: 'Add to Prompt', icon: '⚡', id: 'add_prompt' }
	];

	return (
		<div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center space-x-1 p-1.5 bg-[#111827]/90 backdrop-blur-xl border border-[#6C5CE7]/50 rounded-lg shadow-2xl shadow-[#6C5CE7]/30 text-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
			<div className="px-2 text-slate-400 font-mono text-[11px] truncate max-w-[120px]">
				"{selection.text.slice(0, 20)}..."
			</div>

			<div className="h-4 w-px bg-white/10" />

			{actions.map(act => (
				<button
					key={act.id}
					type="button"
					draggable={act.id === 'add_prompt'}
					onDragStart={event => {
						if (act.id === 'add_prompt') {
							event.dataTransfer.setData('text/plain', selection.text);
							event.dataTransfer.effectAllowed = 'copy';
						}
					}}
					onClick={() => onAction(act.id)}
					className="flex items-center space-x-1 px-2.5 py-1 rounded hover:bg-[#6C5CE7]/20 text-slate-200 hover:text-[#00D4FF] transition-all font-medium"
				>
					<span>{act.icon}</span>
					<span>{act.label}</span>
				</button>
			))}
		</div>
	);
};

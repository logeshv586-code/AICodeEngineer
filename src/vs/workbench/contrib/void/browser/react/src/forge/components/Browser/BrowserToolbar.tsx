/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';

export const BrowserToolbar: React.FC<{
	currentUrl: string;
	onNavigate: (url: string) => void;
	onBack: () => void;
	onForward: () => void;
	onReload: () => void;
	onAnalyze: () => void;
	onSummarize: () => void;
	onCapture: () => void;
	onTogglePin: () => void;
	isPinned: boolean;
}> = ({ currentUrl, onNavigate, onBack, onForward, onReload, onAnalyze, onSummarize, onCapture, onTogglePin, isPinned }) => {
	const [urlInput, setUrlInput] = useState(currentUrl);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key !== 'Enter') return;
		let target = urlInput.trim();
		if (!target.startsWith('http')) target = `https://${target}`;
		onNavigate(target);
	};

	return (
		<div className="flex items-center space-x-2 px-3 py-2 bg-[#111827] border-b border-white/5">
			<div className="flex items-center space-x-1">
				<button type="button" onClick={onBack} title="Back" className="p-1 text-slate-400 hover:text-slate-200 text-xs">{'<-'}</button>
				<button type="button" onClick={onForward} title="Forward" className="p-1 text-slate-400 hover:text-slate-200 text-xs">{'->'}</button>
				<button type="button" onClick={onReload} title="Reload" className="p-1 text-slate-400 hover:text-slate-200 text-xs">{'R'}</button>
			</div>
			<input
				type="text"
				value={urlInput}
				onChange={e => setUrlInput(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder="Enter URL or localhost:3000..."
				className="flex-1 px-3 py-1 bg-[#070B14] border border-[#6C5CE7]/30 rounded text-xs text-slate-200 focus:outline-none focus:border-[#00D4FF] font-mono"
			/>
			<div className="flex items-center space-x-1.5">
				<button type="button" onClick={onAnalyze} className="px-2.5 py-1 text-xs rounded font-semibold text-white bg-gradient-to-r from-[#6C5CE7] to-[#00D4FF] hover:opacity-90">Analyze</button>
				<button type="button" onClick={onSummarize} className="px-2 py-1 text-xs rounded bg-[#182233] text-slate-300 hover:text-[#14F195] border border-white/5 font-medium">Summarize</button>
				<button type="button" onClick={onCapture} className="px-2 py-1 text-xs rounded bg-[#182233] text-slate-300 hover:text-[#00D4FF] border border-white/5 font-medium">Capture</button>
				<button type="button" onClick={onTogglePin} className={`px-2 py-1 text-xs rounded font-medium border border-white/5 ${isPinned ? 'bg-[#6C5CE7]/30 text-[#00D4FF]' : 'bg-[#182233] text-slate-400 hover:text-slate-200'}`}>{isPinned ? 'Pinned' : 'Pin'}</button>
			</div>
		</div>
	);
};

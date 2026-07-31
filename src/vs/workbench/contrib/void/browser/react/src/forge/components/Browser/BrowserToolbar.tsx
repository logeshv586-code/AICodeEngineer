/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { ForgeTheme } from '../../theme/theme';

export const BrowserToolbar: React.FC<{
	currentUrl: string;
	onNavigate: (url: string) => void;
	onAnalyze: () => void;
	onSummarize: () => void;
	onCapture: () => void;
	onTogglePin: () => void;
	isPinned: boolean;
}> = ({ currentUrl, onNavigate, onAnalyze, onSummarize, onCapture, onTogglePin, isPinned }) => {
	const [urlInput, setUrlInput] = useState(currentUrl);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			let target = urlInput.trim();
			if (!target.startsWith('http')) target = `https://${target}`;
			onNavigate(target);
		}
	};

	return (
		<div className="flex items-center space-x-2 px-3 py-2 bg-[#111827] border-b border-white/5">
			<div className="flex items-center space-x-1">
				<button className="p-1 text-slate-400 hover:text-slate-200 text-xs">←</button>
				<button className="p-1 text-slate-400 hover:text-slate-200 text-xs">→</button>
				<button className="p-1 text-slate-400 hover:text-slate-200 text-xs">⟳</button>
			</div>

			<input
				type="text"
				value={urlInput}
				onChange={e => setUrlInput(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder="Enter URL or localhost:3000..."
				className="flex-1 px-3 py-1 bg-[#070B14] border border-[#6C5CE7]/30 rounded text-xs text-slate-200 focus:outline-none focus:border-[#00D4FF] font-mono"
			/>

			{/* 1-Click AI Actions */}
			<div className="flex items-center space-x-1.5">
				<button
					onClick={onAnalyze}
					className="px-2.5 py-1 text-xs rounded font-semibold text-white bg-gradient-to-r from-[#6C5CE7] to-[#00D4FF] hover:opacity-90 shadow-sm shadow-[#6C5CE7]/40 flex items-center space-x-1"
				>
					<span>🧠</span>
					<span>Analyze</span>
				</button>
				<button
					onClick={onSummarize}
					className="px-2 py-1 text-xs rounded bg-[#182233] text-slate-300 hover:text-[#14F195] hover:bg-[#14F195]/10 border border-white/5 font-medium flex items-center space-x-1"
				>
					<span>📑</span>
					<span>Summarize</span>
				</button>
				<button
					onClick={onCapture}
					className="px-2 py-1 text-xs rounded bg-[#182233] text-slate-300 hover:text-[#00D4FF] hover:bg-[#00D4FF]/10 border border-white/5 font-medium"
				>
					📸 Capture
				</button>
				<button
					onClick={onTogglePin}
					className={`px-2 py-1 text-xs rounded font-medium border border-white/5 ${isPinned ? 'bg-[#6C5CE7]/30 text-[#00D4FF]' : 'bg-[#182233] text-slate-400 hover:text-slate-200'}`}
				>
					📌 {isPinned ? 'Pinned' : 'Pin'}
				</button>
			</div>
		</div>
	);
};

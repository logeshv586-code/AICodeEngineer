/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { IntentAnalysis } from '../../../../common/forge/types/adaptiveTypes.js';

export const AdaptiveContextInspector: React.FC<{ analysis?: IntentAnalysis }> = ({
	analysis = { intent: 'Debug', confidence: 0.92, keywords: ['debug'], explanation: 'User troubleshooting error' }
}) => {
	const intentColors: Record<string, string> = {
		Debug: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
		TestGeneration: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
		Documentation: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
		Architecture: 'bg-[#6C5CE7]/20 text-[#00D4FF] border-[#6C5CE7]/40',
		ReviewPR: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
		Refactor: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
		ExplainCode: 'bg-blue-500/20 text-blue-400 border-blue-500/40'
	};

	return (
		<div className="flex items-center space-x-2 px-3 py-1 bg-[#111827] border-t border-white/5 text-[11px] font-mono text-slate-300">
			<span className="text-slate-500">Intent:</span>
			<span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${intentColors[analysis.intent] || intentColors.ExplainCode}`}>
				🎯 {analysis.intent.toUpperCase()} ({Math.round(analysis.confidence * 100)}%)
			</span>
			<span className="text-slate-500 text-[10px] truncate max-w-[200px]">{analysis.explanation}</span>
		</div>
	);
};

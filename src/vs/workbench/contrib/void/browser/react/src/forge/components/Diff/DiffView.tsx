/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';

export interface PatchInfo {
	filePath: string;
	diff: string;
}

export const DiffView: React.FC<{ patches: PatchInfo[]; onAccept?: (path: string) => void; onReject?: (path: string) => void }> = ({ patches, onAccept, onReject }) => {
	if (patches.length === 0) {
		return <div className="p-4 text-zinc-500 text-sm">No active code diffs pending approval.</div>;
	}

	return (
		<div className="space-y-4">
			{patches.map((patch, idx) => (
				<div key={idx} className="bg-zinc-900 border border-zinc-800 rounded p-3 text-white font-mono text-xs">
					<div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800 font-sans">
						<span className="font-medium text-zinc-200">{patch.filePath}</span>
						<div className="space-x-2">
							<button onClick={() => onAccept?.(patch.filePath)} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs">Accept</button>
							<button onClick={() => onReject?.(patch.filePath)} className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs">Reject</button>
						</div>
					</div>
					<pre className="whitespace-pre-wrap text-zinc-300 font-mono text-xs overflow-x-auto">{patch.diff}</pre>
				</div>
			))}
		</div>
	);
};

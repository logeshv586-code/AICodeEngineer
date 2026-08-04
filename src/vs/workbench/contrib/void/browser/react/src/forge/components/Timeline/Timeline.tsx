/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { ForgeEvent } from '../../../../common/forge/events/forgeEvents.js';

export const Timeline: React.FC<{ events: ForgeEvent[] }> = ({ events }) => {
	return (
		<div className="p-3 bg-zinc-950 rounded border border-zinc-800 space-y-2 text-xs font-sans">
			<h4 className="text-zinc-400 font-medium mb-2">Execution Timeline</h4>
			{events.length === 0 ? (
				<p className="text-zinc-600">No execution events recorded.</p>
			) : (
				events.map((evt) => (
					<div key={evt.id} className="flex items-start space-x-2 text-zinc-300">
						<span className="text-zinc-500 font-mono text-[10px]">
							{new Date(evt.timestamp).toLocaleTimeString()}
						</span>
						<span className="px-1.5 py-0.5 rounded bg-zinc-800 text-blue-300 text-[10px] font-mono">
							{evt.type}
						</span>
						<span className="truncate text-zinc-300">
							{JSON.stringify(evt.payload)}
						</span>
					</div>
				))
			)}
		</div>
	);
};

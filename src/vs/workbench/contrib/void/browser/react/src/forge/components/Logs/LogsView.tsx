/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { ForgeEvent } from '../../../../common/forge/events/forgeEvents.js';

export const LogsView: React.FC<{ events: ForgeEvent[] }> = ({ events }) => {
	return (
		<div className="p-3 bg-zinc-950 font-mono text-xs space-y-1.5 overflow-x-auto">
			{events.length === 0 ? (
				<p className="text-zinc-600 font-sans">No diagnostic logs recorded.</p>
			) : (
				events.map(evt => (
					<div key={evt.id} className="flex items-start space-x-2 text-zinc-400 hover:text-zinc-200">
						<span className="text-zinc-600 text-[10px]">[{new Date(evt.timestamp).toISOString().split('T')[1].slice(0, 8)}]</span>
						<span className="text-blue-400 font-semibold text-[11px]">{evt.type}</span>
						<span className="truncate text-zinc-300 text-[11px]">{JSON.stringify(evt.payload)}</span>
					</div>
				))
			)}
		</div>
	);
};

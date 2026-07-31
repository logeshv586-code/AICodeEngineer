/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProgressSnapshot } from './collaborationTypes.js';

export class ProgressAggregator {
	computeSnapshot(completedTasks: number, totalTasks: number, activeAgents: number): ProgressSnapshot {
		const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
		return {
			overallProgressPct: pct,
			activeAgentsCount: activeAgents,
			completedTasksCount: completedTasks,
			totalTasksCount: totalTasks
		};
	}
}

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface CollaborationTimelineEntry {
	readonly id: string;
	readonly agentName: string;
	readonly action: string;
	readonly timestamp: number;
}

export class CollaborationTimeline {
	private readonly entries: CollaborationTimelineEntry[] = [];

	logEvent(agentName: string, action: string): void {
		this.entries.push({
			id: `tl-${Math.random().toString(36).substring(2, 7)}`,
			agentName,
			action,
			timestamp: Date.now()
		});
	}

	getEntries(): CollaborationTimelineEntry[] {
		return [...this.entries];
	}
}

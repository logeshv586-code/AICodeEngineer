/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface MetricSpan {
	readonly id: string;
	readonly name: string;
	readonly durationMs: number;
	readonly timestamp: number;
}

export class TelemetryTracker {
	private static instance?: TelemetryTracker;
	private readonly spans: MetricSpan[] = [];

	public static getInstance(): TelemetryTracker {
		if (!this.instance) {
			this.instance = new TelemetryTracker();
		}
		return this.instance;
	}

	recordSpan(name: string, durationMs: number): void {
		this.spans.push({
			id: `span-${Math.random().toString(36).substring(2, 7)}`,
			name,
			durationMs,
			timestamp: Date.now()
		});
	}

	getSpans(): MetricSpan[] {
		return [...this.spans];
	}
}

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface ExecutionRecord {
	readonly id: string;
	readonly goal: string;
	readonly status: string;
	readonly artifactIds: string[];
	readonly timestamp: number;
}

export class ExecutionMemory {
	private static instance?: ExecutionMemory;
	private readonly records: ExecutionRecord[] = [];

	public static getInstance(): ExecutionMemory {
		if (!this.instance) {
			this.instance = new ExecutionMemory();
		}
		return this.instance;
	}

	saveRecord(record: ExecutionRecord): void {
		this.records.push(record);
	}

	getRecords(): ExecutionRecord[] {
		return [...this.records];
	}
}

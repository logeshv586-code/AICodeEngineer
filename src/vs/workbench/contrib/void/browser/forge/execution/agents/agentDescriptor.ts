/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type AgentStatus = 'Idle' | 'Scheduled' | 'Running' | 'Blocked' | 'Completed' | 'Released';

export interface AgentHealth {
	readonly isHealthy: boolean;
	readonly currentLoad: number; // 0 to 100
	readonly lastActiveAt: number;
}

export interface AgentDescriptor {
	readonly id: string;
	readonly name: string;
	readonly role:
		| 'workspace'
		| 'browser'
		| 'review'
		| 'security'
		| 'testing'
		| 'coordinator'
		| 'design'
		| 'automation'
		| 'knowledge'
		| 'learning';
	readonly capabilities: string[];
	readonly maxConcurrency: number;
	readonly priority: number;
	readonly health: AgentHealth;
}

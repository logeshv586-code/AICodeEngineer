/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { SharedArtifact, SharedArtifactState } from './artifactReference.js';
import { ExecutionBus } from '../bus/executionBus.js';

export class SharedBlackboard {
	private static instance?: SharedBlackboard;
	private readonly sharedArtifacts = new Map<string, SharedArtifact>();

	private constructor(
		private readonly bus: ExecutionBus = ExecutionBus.getInstance()
	) { }

	public static getInstance(): SharedBlackboard {
		if (!this.instance) {
			this.instance = new SharedBlackboard();
		}
		return this.instance;
	}

	publishArtifact(artifact: Omit<SharedArtifact, 'id' | 'timestamp'>): SharedArtifact {
		const full: SharedArtifact = {
			...artifact,
			id: `shared-${Math.random().toString(36).substring(2, 7)}`,
			timestamp: Date.now()
		};
		this.sharedArtifacts.set(full.id, full);
		this.bus.publish('CHECKPOINT_SAVED', { artifact: full, action: 'published' });
		return full;
	}

	updateState(id: string, newState: SharedArtifactState): void {
		const artifact = this.sharedArtifacts.get(id);
		if (artifact) {
			const updated: SharedArtifact = { ...artifact, state: newState };
			this.sharedArtifacts.set(id, updated);
			this.bus.publish('CHECKPOINT_SAVED', { artifact: updated, action: 'state_changed' });
		}
	}

	getArtifact(id: string): SharedArtifact | undefined {
		return this.sharedArtifacts.get(id);
	}

	getAllArtifacts(): SharedArtifact[] {
		return Array.from(this.sharedArtifacts.values());
	}

	getArtifactsByType(type: SharedArtifact['type']): SharedArtifact[] {
		return Array.from(this.sharedArtifacts.values()).filter(a => a.type === type);
	}
}

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface ExecutionArtifact {
	readonly id: string;
	readonly taskId: string;
	readonly type: 'patch' | 'report' | 'screenshot' | 'test_log' | 'summary';
	readonly name: string;
	readonly content: any;
	readonly createdAt: number;
}

export class ArtifactStore {
	private static instance?: ArtifactStore;
	private readonly artifacts = new Map<string, ExecutionArtifact>();

	public static getInstance(): ArtifactStore {
		if (!this.instance) {
			this.instance = new ArtifactStore();
		}
		return this.instance;
	}

	saveArtifact(artifact: Omit<ExecutionArtifact, 'id' | 'createdAt'>): ExecutionArtifact {
		const fullArtifact: ExecutionArtifact = {
			...artifact,
			id: `artifact-${Math.random().toString(36).substring(2, 7)}`,
			createdAt: Date.now()
		};
		this.artifacts.set(fullArtifact.id, fullArtifact);
		return fullArtifact;
	}

	getArtifact(id: string): ExecutionArtifact | undefined {
		return this.artifacts.get(id);
	}

	getAllArtifacts(): ExecutionArtifact[] {
		return Array.from(this.artifacts.values());
	}
}

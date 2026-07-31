/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface CapabilityInput {
	readonly target: string;
	readonly params?: Record<string, any>;
	readonly contextId?: string;
}

export interface CapabilityOutput {
	readonly success: boolean;
	readonly data?: any;
	readonly artifactId?: string;
	readonly error?: string;
}

export interface CapabilityDescriptor {
	readonly id: string;
	readonly name: string;
	readonly category: 'workspace' | 'browser' | 'github' | 'terminal' | 'review' | 'testing';
	readonly description: string;
	readonly estimatedLatencyMs: number;
	readonly costUnits: number;
}

export interface Capability {
	readonly descriptor: CapabilityDescriptor;
	execute(input: CapabilityInput): Promise<CapabilityOutput>;
}

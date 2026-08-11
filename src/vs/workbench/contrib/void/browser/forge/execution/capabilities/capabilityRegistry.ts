/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Capability } from './capabilityTypes.js';

export class CapabilityRegistry {
	private static instance?: CapabilityRegistry;
	private readonly capabilities = new Map<string, Capability>();

	public static getInstance(): CapabilityRegistry {
		if (!this.instance) {
			this.instance = new CapabilityRegistry();
		}
		return this.instance;
	}

	register(capability: Capability): void {
		this.capabilities.set(capability.descriptor.id, capability);
	}

	get(id: string): Capability | undefined {
		return this.capabilities.get(id);
	}

	getAll(): Capability[] {
		return Array.from(this.capabilities.values());
	}
}

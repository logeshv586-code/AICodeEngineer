/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { CapabilityRegistry } from './capabilityRegistry.js';
import { Capability } from './capabilityTypes.js';

export class CapabilityMatcher {
	constructor(
		private readonly registry: CapabilityRegistry = CapabilityRegistry.getInstance()
	) { }

	matchCapability(category: string, taskDescription: string): Capability | undefined {
		const all = this.registry.getAll();
		const categoryMatches = all.filter(c => c.descriptor.category === category);
		if (categoryMatches.length > 0) {
			return categoryMatches[0];
		}
		return all[0];
	}
}

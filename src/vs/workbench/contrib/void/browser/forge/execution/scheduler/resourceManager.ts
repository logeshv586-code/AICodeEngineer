/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface ResourceLease {
	readonly id: string;
	readonly category: string;
	readonly acquiredAt: number;
}

export class ResourceManager {
	private readonly limits: Record<string, number> = {
		workspace: 4,
		browser: 2,
		github: 2,
		terminal: 2,
		review: 2,
		testing: 2
	};

	private readonly activeLeases = new Map<string, ResourceLease[]>();

	canAcquire(category: string): boolean {
		const leases = this.activeLeases.get(category) || [];
		const max = this.limits[category] || 2;
		return leases.length < max;
	}

	acquire(category: string): ResourceLease | undefined {
		if (!this.canAcquire(category)) return undefined;

		const lease: ResourceLease = {
			id: `lease-${Math.random().toString(36).substring(2, 7)}`,
			category,
			acquiredAt: Date.now()
		};

		const leases = this.activeLeases.get(category) || [];
		leases.push(lease);
		this.activeLeases.set(category, leases);
		return lease;
	}

	release(lease: ResourceLease): void {
		const leases = this.activeLeases.get(lease.category) || [];
		const filtered = leases.filter(l => l.id !== lease.id);
		this.activeLeases.set(lease.category, filtered);
	}
}

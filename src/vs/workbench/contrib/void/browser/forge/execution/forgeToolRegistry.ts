/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { AgentCapability } from '../../../common/forge/types/brainTypes.js';
import { AgentCapabilityDescriptor } from '../../../common/forge/types/agentTypes.js';

export interface ForgeToolDescriptor {
	name: string;
	description: string;
	paramsSchema: Record<string, any>;
	handler: (params: any) => Promise<any>;
}

export class ForgeToolRegistry {
	private readonly tools = new Map<string, ForgeToolDescriptor>();
	private readonly capabilities = new Map<AgentCapability, AgentCapabilityDescriptor>();

	registerTool(descriptor: ForgeToolDescriptor): void {
		this.tools.set(descriptor.name, descriptor);
	}

	getTool(name: string): ForgeToolDescriptor | undefined {
		return this.tools.get(name);
	}

	listTools(): ForgeToolDescriptor[] {
		return Array.from(this.tools.values());
	}

	registerCapability(desc: AgentCapabilityDescriptor): void {
		this.capabilities.set(desc.capability, desc);
	}

	getCapability(capability: AgentCapability): AgentCapabilityDescriptor | undefined {
		return this.capabilities.get(capability);
	}

	listCapabilities(): AgentCapabilityDescriptor[] {
		return Array.from(this.capabilities.values());
	}
}

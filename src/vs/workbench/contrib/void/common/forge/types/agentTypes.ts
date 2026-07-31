import { AgentCapability, AgentState, ForgeWorkerConfig } from './brainTypes.js';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';

export interface AgentCapabilityDescriptor {
	readonly capability: AgentCapability;
	readonly description: string;
	readonly requiredPermissions?: string[];
	readonly timeoutMs?: number;
}

export interface AgentExecutionResult<T = any> {
	readonly success: boolean;
	readonly data?: T;
	readonly error?: string;
	readonly stepsTaken: number;
}

export interface IForgeAgent {
	readonly id: string;
	readonly config: ForgeWorkerConfig;
	readonly state: AgentState;
	execute(task: string, context: Record<string, any>, token?: CancellationToken): Promise<AgentExecutionResult>;
	cancel(): void;
}

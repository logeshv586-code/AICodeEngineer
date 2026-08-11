/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { AgentExecutionResult, IForgeAgent } from '../../../common/forge/types/agentTypes.js';
import { AgentState, ForgeWorkerConfig } from '../../../common/forge/types/brainTypes.js';
import { ForgeEventBus } from '../events/forgeEventBus.js';

export abstract class BaseForgeAgent implements IForgeAgent {
	public readonly id: string;
	private _state: AgentState = 'idle';

	constructor(
		public readonly config: ForgeWorkerConfig,
		protected readonly eventBus: ForgeEventBus = ForgeEventBus.getInstance()
	) {
		this.id = `${config.role}-${Math.random().toString(36).substring(2, 7)}`;
	}

	get state(): AgentState {
		return this._state;
	}

	protected setState(newState: AgentState): void {
		this._state = newState;
	}

	async execute(task: string, context: Record<string, any>, token?: CancellationToken): Promise<AgentExecutionResult> {
		this.setState('running');
		this.eventBus.publish('AGENT_STARTED', { agentRole: this.config.role, taskId: task });

		try {
			const result = await this.runTask(task, context, token);
			this.setState('completed');
			this.eventBus.publish('AGENT_FINISHED', { agentRole: this.config.role, taskId: task, result });
			return { success: true, data: result, stepsTaken: 1 };
		} catch (e: any) {
			this.setState('failed');
			this.eventBus.publish('AGENT_FAILED', { agentRole: this.config.role, taskId: task, error: e?.message });
			return { success: false, error: e?.message || 'Agent task execution failed', stepsTaken: 1 };
		}
	}

	cancel(): void {
		this.setState('done');
	}

	protected abstract runTask(task: string, context: Record<string, any>, token?: CancellationToken): Promise<any>;
}

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../../../base/common/event.js';
import { ExecutionEvent, ExecutionEventType } from './executionEvents.js';

export class ExecutionBus {
	private static instance?: ExecutionBus;
	private readonly _onEvent = new Emitter<ExecutionEvent>();
	public readonly onEvent: Event<ExecutionEvent> = this._onEvent.event;

	public static getInstance(): ExecutionBus {
		if (!this.instance) {
			this.instance = new ExecutionBus();
		}
		return this.instance;
	}

	publish<T>(type: ExecutionEventType, payload: T): void {
		const event: ExecutionEvent<T> = {
			id: `exec-evt-${Math.random().toString(36).substring(2, 7)}`,
			type,
			timestamp: Date.now(),
			payload
		};
		this._onEvent.fire(event);
	}
}

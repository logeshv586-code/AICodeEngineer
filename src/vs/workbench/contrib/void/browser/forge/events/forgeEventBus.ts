/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../../base/common/event.js';
import { ForgeEvent, ForgeEventType } from '../../../common/forge/events/forgeEvents.js';

export class ForgeEventBus {
	private static instance?: ForgeEventBus;
	private readonly _onEvent = new Emitter<ForgeEvent>();
	public readonly onEvent: Event<ForgeEvent> = this._onEvent.event;

	public static getInstance(): ForgeEventBus {
		if (!this.instance) {
			this.instance = new ForgeEventBus();
		}
		return this.instance;
	}

	public publish<T>(type: ForgeEventType, payload: T): void {
		const event: ForgeEvent<T> = {
			id: Math.random().toString(36).substring(2, 9),
			type,
			timestamp: Date.now(),
			payload
		};
		this._onEvent.fire(event);
	}
}

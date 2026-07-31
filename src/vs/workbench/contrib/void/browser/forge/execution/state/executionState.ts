/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type ExecutionState =
	| 'Pending'
	| 'Running'
	| 'Waiting'
	| 'Blocked'
	| 'Completed'
	| 'Failed'
	| 'Cancelled'
	| 'Reviewed';

export class ExecutionStateMachine {
	private _state: ExecutionState = 'Pending';

	get state(): ExecutionState {
		return this._state;
	}

	transitionTo(nextState: ExecutionState): void {
		this._state = nextState;
	}
}

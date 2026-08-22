/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { ChatMode } from '../common/voidSettingsTypes.js';

export const VOID_SET_CHAT_MODE_ACTION_ID = 'void.setChatMode';

const isChatMode = (value: unknown): value is ChatMode => {
	return value === 'agent' || value === 'gather' || value === 'normal';
};

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: VOID_SET_CHAT_MODE_ACTION_ID,
			title: 'Forge AI: Set Chat Mode',
		});
	}

	run(accessor: ServicesAccessor, mode: unknown): void {
		if (!isChatMode(mode)) {
			throw new Error(`Invalid Forge chat mode: ${String(mode)}`);
		}

		accessor.get(IVoidSettingsService).setGlobalSetting('chatMode', mode);
	}
});

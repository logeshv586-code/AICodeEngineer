/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { DOMSelection } from '../../../common/forge/types/browserTypes.js';
import { ForgeEventBus } from '../events/forgeEventBus.js';

export class SelectionService {
	private activeSelection: DOMSelection | null = null;

	constructor(
		private readonly eventBus: ForgeEventBus = ForgeEventBus.getInstance()
	) { }

	setSelection(tabId: string, text: string, html: string, xpath = '/body'): DOMSelection {
		const selection: DOMSelection = {
			id: `sel-${Math.random().toString(36).substring(2, 7)}`,
			text,
			html,
			xpath,
			timestamp: Date.now()
		};
		this.activeSelection = selection;
		this.eventBus.publish('BROWSER_SELECTION_CHANGED', { tabId, selection });
		return selection;
	}

	clearSelection(tabId: string): void {
		this.activeSelection = null;
		this.eventBus.publish('BROWSER_SELECTION_CHANGED', { tabId, selection: null });
	}

	getActiveSelection(): DOMSelection | null {
		return this.activeSelection;
	}

	generateDragPayload(): string {
		if (!this.activeSelection) return '';
		return `<drag_context xpath="${this.activeSelection.xpath}">\n${this.activeSelection.text}\n</drag_context>`;
	}
}

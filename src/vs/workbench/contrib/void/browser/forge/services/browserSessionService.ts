/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { BrowserTabState } from '../../../common/forge/types/browserTypes.js';
import { ForgeEventBus } from '../events/forgeEventBus.js';

export class BrowserSessionService {
	private static instance?: BrowserSessionService;
	private readonly tabs = new Map<string, BrowserTabState>();
	private activeTabId: string | null = null;

	private constructor(
		private readonly eventBus: ForgeEventBus = ForgeEventBus.getInstance()
	) {
		// Initialize default starter tab
		this.createTab('https://react.dev', 'React Documentation');
	}

	public static getInstance(): BrowserSessionService {
		if (!this.instance) {
			this.instance = new BrowserSessionService();
		}
		return this.instance;
	}

	createTab(url: string, title = 'New Tab'): BrowserTabState {
		const id = `tab-${Math.random().toString(36).substring(2, 7)}`;
		const tab: BrowserTabState = {
			id,
			url,
			title,
			isLoading: false,
			isPinned: false,
			isBookmarked: false
		};
		this.tabs.set(id, tab);
		this.activeTabId = id;
		this.eventBus.publish('BROWSER_TAB_CREATED', { tab });
		return tab;
	}

	closeTab(id: string): void {
		if (this.tabs.has(id)) {
			this.tabs.delete(id);
			if (this.activeTabId === id) {
				const keys = Array.from(this.tabs.keys());
				this.activeTabId = keys.length > 0 ? keys[keys.length - 1] : null;
			}
			this.eventBus.publish('BROWSER_TAB_CLOSED', { tabId: id });
		}
	}

	setActiveTab(id: string): void {
		if (this.tabs.has(id)) {
			this.activeTabId = id;
		}
	}

	getActiveTab(): BrowserTabState | undefined {
		return this.activeTabId ? this.tabs.get(this.activeTabId) : undefined;
	}

	getAllTabs(): BrowserTabState[] {
		return Array.from(this.tabs.values());
	}

	updateUrl(id: string, url: string): void {
		const tab = this.tabs.get(id);
		if (tab) {
			const updated = { ...tab, url, isLoading: true };
			this.tabs.set(id, updated);
			this.eventBus.publish('BROWSER_URL_CHANGED', { tabId: id, url });
		}
	}

	togglePin(id: string): void {
		const tab = this.tabs.get(id);
		if (tab) {
			const updated = { ...tab, isPinned: !tab.isPinned };
			this.tabs.set(id, updated);
			this.eventBus.publish('BROWSER_PINNED', { tabId: id, isPinned: updated.isPinned });
		}
	}

	toggleBookmark(id: string): void {
		const tab = this.tabs.get(id);
		if (tab) {
			const updated = { ...tab, isBookmarked: !tab.isBookmarked };
			this.tabs.set(id, updated);
			this.eventBus.publish('BROWSER_BOOKMARKED', { tabId: id, isBookmarked: updated.isBookmarked });
		}
	}
}

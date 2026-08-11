/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { BrowserPage, BrowserCacheEntry, WorkspaceMatch } from '../../../common/forge/types/browserTypes.js';

export class BrowserModel {
	private static instance?: BrowserModel;
	private readonly pages = new Map<string, BrowserPage>();
	private readonly cache = new Map<string, BrowserCacheEntry>();

	public static getInstance(): BrowserModel {
		if (!this.instance) {
			this.instance = new BrowserModel();
		}
		return this.instance;
	}

	savePage(page: BrowserPage): void {
		this.pages.set(page.url, page);
		// Cache for cross-session knowledge search
		this.cache.set(page.url, {
			url: page.url,
			title: page.title,
			markdown: page.markdown,
			summary: this._generateSummary(page),
			codeBlocks: page.codeBlocks,
			timestamp: page.timestamp
		});
	}

	getPage(url: string): BrowserPage | undefined {
		return this.pages.get(url);
	}

	getCacheEntry(url: string): BrowserCacheEntry | undefined {
		return this.cache.get(url);
	}

	getAllCachedEntries(): BrowserCacheEntry[] {
		return Array.from(this.cache.values());
	}

	searchPages(query: string): BrowserCacheEntry[] {
		const q = query.toLowerCase();
		return Array.from(this.cache.values()).filter(entry =>
			entry.title.toLowerCase().includes(q) ||
			entry.markdown.toLowerCase().includes(q) ||
			entry.summary.toLowerCase().includes(q)
		);
	}

	findWorkspaceMatches(page: BrowserPage, workspaceSymbols: { name: string; kind: string; filePath: string }[]): WorkspaceMatch[] {
		const matches: WorkspaceMatch[] = [];
		const pageContent = (page.title + ' ' + page.markdown).toLowerCase();

		for (const sym of workspaceSymbols) {
			if (sym.name.length < 3) continue;
			if (pageContent.includes(sym.name.toLowerCase())) {
				matches.push({
					symbolName: sym.name,
					kind: sym.kind,
					filePath: sym.filePath,
					matchScore: 0.9,
					reason: `Symbol '${sym.name}' referenced in web page text`
				});
			}
		}
		return matches.slice(0, 15);
	}

	private _generateSummary(page: BrowserPage): string {
		const headingText = page.headings.map(h => h.text).join(' · ');
		const codeSummary = page.codeBlocks.length > 0 ? `${page.codeBlocks.length} code blocks` : '';
		const tableSummary = page.tables.length > 0 ? `${page.tables.length} tables` : '';
		const formSummary = page.forms.length > 0 ? `${page.forms.length} forms` : '';
		const extras = [codeSummary, tableSummary, formSummary].filter(Boolean).join(', ');

		return `Page titled "${page.title}". Headings: ${headingText || 'None'}. ${extras ? 'Contains ' + extras : ''}`.trim();
	}
}

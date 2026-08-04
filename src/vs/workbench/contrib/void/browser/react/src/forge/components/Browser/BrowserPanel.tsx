/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect } from 'react';
import { BrowserTabs } from './BrowserTabs';
import { BrowserToolbar } from './BrowserToolbar';
import { BrowserOverlay } from './BrowserOverlay';
import { SelectionToolbar } from './SelectionToolbar';
import { WorkspaceMatches } from './WorkspaceMatches';
import { BrowserTabState, DOMSelection, WorkspaceMatch, BrowserPage } from '../../../../common/forge/types/browserTypes.js';
import { BrowserSessionService } from '../../../services/browserSessionService';
import { DOMCaptureService } from '../../../services/domCaptureService';
import { SelectionService } from '../../../services/selectionService';

export const BrowserPanel: React.FC = () => {
	const sessionService = BrowserSessionService.getInstance();
	const domService = new DOMCaptureService();
	const selectionService = new SelectionService();

	const [tabs, setTabs] = useState<BrowserTabState[]>(sessionService.getAllTabs());
	const [activeTabId, setActiveTabId] = useState<string | null>(sessionService.getActiveTab()?.id || null);
	const [selection, setSelection] = useState<DOMSelection | null>(null);
	const [matches, setMatches] = useState<WorkspaceMatch[]>([]);

	const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

	const handleNavigate = (url: string) => {
		if (!activeTab) return;
		sessionService.updateUrl(activeTab.id, url);

		// Simulate page load and structured DOM capture
		const mockHtml = `<html><body><h1>${url} Documentation</h1><p>Sample documentation page loaded for ${url}.</p><pre><code class="language-typescript">const sample = true;</code></pre></body></html>`;
		const page = domService.extractPageModel(url, `${url} Docs`, mockHtml);

		const updatedTabs = tabs.map(t => t.id === activeTab.id ? { ...t, url, title: page.title, page, isLoading: false } : t);
		setTabs(updatedTabs);
	};

	const handleNewTab = (url: string) => {
		const newTab = sessionService.createTab(url, 'Loading...');
		setTabs(sessionService.getAllTabs());
		setActiveTabId(newTab.id);
		handleNavigate(url);
	};

	const handleCloseTab = (id: string) => {
		sessionService.closeTab(id);
		setTabs(sessionService.getAllTabs());
	};

	const handleSelectText = () => {
		// Mock selection event for demonstration
		const sel = selectionService.setSelection(
			activeTab?.id || 'tab-1',
			'const sample = true;',
			'<code>const sample = true;</code>',
			'/body/pre/code'
		);
		setSelection(sel);
	};

	return (
		<div className="relative flex flex-col h-full bg-[#070B14] text-slate-100 font-sans overflow-hidden">
			<BrowserTabs
				tabs={tabs}
				activeTabId={activeTabId}
				onSelectTab={setActiveTabId}
				onCloseTab={handleCloseTab}
				onNewTab={handleNewTab}
			/>

			<BrowserToolbar
				currentUrl={activeTab?.url || 'https://react.dev'}
				onNavigate={handleNavigate}
				onAnalyze={() => { }}
				onSummarize={() => { }}
				onCapture={() => { }}
				onTogglePin={() => activeTab && sessionService.togglePin(activeTab.id)}
				isPinned={activeTab?.isPinned || false}
			/>

			<div className="flex flex-1 overflow-hidden relative">
				<div className="flex-1 flex flex-col relative bg-slate-950">
					{/* Embedded Web View */}
					{activeTab?.url ? (
						<webview
							src={activeTab.url}
							className="flex-1 w-full border-none"
							allowpopups
						/>
					) : (
						<div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
							No tab open. Click + to open a web page.
						</div>
					)}

					<BrowserOverlay page={activeTab?.page} />
					<SelectionToolbar selection={selection} onAction={action => console.log('Action:', action)} />
				</div>

				<WorkspaceMatches matches={matches} />
			</div>
		</div>
	);
};

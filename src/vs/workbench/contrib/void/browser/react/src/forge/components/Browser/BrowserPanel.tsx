/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useRef, useState } from 'react';
import { BrowserTabs } from './BrowserTabs';
import { BrowserToolbar } from './BrowserToolbar';
import { BrowserOverlay } from './BrowserOverlay';
import { SelectionToolbar } from './SelectionToolbar';
import { WorkspaceMatches } from './WorkspaceMatches';
import { BrowserTabState, DOMSelection, WorkspaceMatch, BrowserPage } from '../../../../common/forge/types/browserTypes.js';
import { BrowserSessionService } from '../../../../../forge/services/browserSessionService';
import { DOMCaptureService } from '../../../../../forge/services/domCaptureService';
import { SelectionService } from '../../../../../forge/services/selectionService';

export const BrowserPanel: React.FC = () => {
	const sessionService = BrowserSessionService.getInstance();
	const domService = new DOMCaptureService();
	const selectionService = new SelectionService();

	const [tabs, setTabs] = useState<BrowserTabState[]>(sessionService.getAllTabs());
	const [activeTabId, setActiveTabId] = useState<string | null>(sessionService.getActiveTab()?.id || null);
	const [selection, setSelection] = useState<DOMSelection | null>(null);
	const [matches, setMatches] = useState<WorkspaceMatch[]>([]);
	const webviewRef = useRef<any>(null);

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

	const sendAgentContext = (kind: string, content: string) => {
		window.dispatchEvent(new CustomEvent('forge:add-context', {
			detail: { kind, content, url: activeTab?.url, title: activeTab?.title }
		}));
	};

	const handleSelectionAction = (action: string) => {
		if (!selection) return;
		if (action === 'copy_md') {
			void navigator.clipboard?.writeText(selection.text);
			return;
		}
		if (action === 'add_prompt') {
			sendAgentContext('browser-selection', `<browser_selection url="${activeTab?.url ?? ''}" xpath="${selection.xpath}">\n${selection.text}\n</browser_selection>`);
			return;
		}
		sendAgentContext(action, `Use this browser context for ${action}:\n${selection.text}`);
	};

	const handleAnalyze = () => {
		sendAgentContext('browser-analysis', `Analyze this page for the coding agent:\n${activeTab?.page?.title ?? activeTab?.url}\nURL: ${activeTab?.url ?? ''}`);
	};

	const handleSummarize = () => {
		sendAgentContext('browser-summary', `Summarize this page for the coding agent:\n${activeTab?.page?.title ?? activeTab?.url}\nURL: ${activeTab?.url ?? ''}`);
	};

	const handleCapture = () => {
		const page = activeTab?.page;
		sendAgentContext('browser-capture', `Capture this design as implementation context:\nURL: ${activeTab?.url ?? ''}\nTitle: ${page?.title ?? ''}\nHeadings: ${page?.headings.map(h => h.text).join(' | ') ?? 'unknown'}`);
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
				onBack={() => webviewRef.current?.goBack()}
				onForward={() => webviewRef.current?.goForward()}
				onReload={() => webviewRef.current?.reload()}
				onAnalyze={handleAnalyze}
				onSummarize={handleSummarize}
				onCapture={handleCapture}
				onTogglePin={() => activeTab && sessionService.togglePin(activeTab.id)}
				isPinned={activeTab?.isPinned || false}
			/>

			<div className="flex flex-1 overflow-hidden relative">
				<div className="flex-1 flex flex-col relative bg-slate-950">
					{/* Embedded Web View */}
					{activeTab?.url ? (
						<webview
							ref={webviewRef}
							src={activeTab.url}
							className="flex-1 w-full border-none"
							allowpopups
							onMouseUp={() => {
								void webviewRef.current?.executeJavaScript('window.getSelection ? window.getSelection().toString() : ""').then((text: unknown) => {
									if (typeof text === 'string' && text.trim()) {
										setSelection(selectionService.setSelection(activeTab.id, text.trim(), text.trim()));
									}
								});
							}}
						/>
					) : (
						<div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
							No tab open. Click + to open a web page.
						</div>
					)}

					<BrowserOverlay page={activeTab?.page} />
					<SelectionToolbar selection={selection} onAction={handleSelectionAction} />
				</div>

				<WorkspaceMatches matches={matches} />
			</div>
		</div>
	);
};

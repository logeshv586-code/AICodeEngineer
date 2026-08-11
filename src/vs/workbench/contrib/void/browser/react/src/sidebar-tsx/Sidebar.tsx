/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useEffect } from 'react';
import { useIsDark } from '../util/services.tsx';
// import { SidebarThreadSelector } from './SidebarThreadSelector.js';
// import { SidebarChat } from './SidebarChat.tsx';

import '../styles.css'
import { SidebarChat } from './SidebarChat.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';

export const Sidebar = ({ className }: { className: string }) => {

	const isDark = useIsDark()
	useEffect(() => {
		// The sidebar lives inside the workbench, so put the same design tokens on
		// the workbench root as well. This avoids a light IDE beside a dark AI panel.
		const workbench = document.querySelector<HTMLElement>('.monaco-workbench');
		if (!workbench) return;
		const tokens: Record<string, string> = {
			'--vscode-editor-background': '#062b5d',
			'--vscode-sideBar-background': '#0e1422',
			'--vscode-activityBar-background': '#062b5d',
			'--vscode-titleBar-activeBackground': '#001d42',
			'--vscode-statusBar-background': '#681878',
			'--vscode-panel-background': '#0e1422',
			'--vscode-foreground': '#edf4ff',
			'--vscode-descriptionForeground': '#9aabc4',
			'--vscode-focusBorder': '#7c83ff',
			'--vscode-button-background': '#7c83ff',
			'--vscode-button-foreground': '#0f172a',
			'--vscode-button-hoverBackground': '#9297ff',
			'--vscode-widget-border': '#29466d',
			'--vscode-input-background': '#111a2b',
			'--vscode-input-foreground': '#edf4ff',
		};
		for (const [name, value] of Object.entries(tokens)) workbench.style.setProperty(name, value);
	}, []);

	return <div
		className={`@@void-scope ${isDark ? 'dark' : ''}`}
		style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}
	>
		<div
			// default background + text styles for sidebar
			className={`
				w-full h-full min-w-0 min-h-0 overflow-hidden
				bg-void-bg-2
				text-void-fg-1
			`}
		>

			<div className={`w-full h-full`}>
				<ErrorBoundary>
					<SidebarChat />
				</ErrorBoundary>

			</div>
		</div>
	</div>


}


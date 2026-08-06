/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
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
			'--vscode-editor-background': '#4a0000',
			'--vscode-sideBar-background': '#4a0000',
			'--vscode-activityBar-background': '#4a0000',
			'--vscode-titleBar-activeBackground': '#4a0000',
			'--vscode-statusBar-background': '#4a0000',
			'--vscode-panel-background': '#4a0000',
			'--vscode-foreground': '#e2e8f0',
			'--vscode-descriptionForeground': '#a1a1aa',
			'--vscode-focusBorder': '#ff4000',
			'--vscode-button-background': '#ff4000',
			'--vscode-button-foreground': '#000000',
			'--vscode-button-hoverBackground': '#ff3f02',
			'--vscode-widget-border': '#27272a',
			'--vscode-input-background': '#27272a',
			'--vscode-input-foreground': '#e2e8f0',
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


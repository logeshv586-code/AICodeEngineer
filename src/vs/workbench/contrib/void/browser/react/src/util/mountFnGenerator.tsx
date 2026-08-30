/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import * as ReactDOM from 'react-dom/client'
import { _registerServices } from './services.js';


import { ServicesAccessor } from '../../../../../../../editor/browser/editorExtensions.js';

export const mountFnGenerator = (Component: (params: any) => React.ReactNode) => (rootElement: HTMLElement, accessor: ServicesAccessor, props?: any) => {
	if (typeof document === 'undefined') {
		console.error('index.tsx error: document was undefined')
		return
	}

	// The workbench may reuse the sidebar host while the React bundle is loading.
	// Clear any DOM left by the previous/legacy Forge view before registering
	// services or creating the new root so removed starter cards never flash.
	rootElement.replaceChildren();

	// ╔══════════════════════════════════════════════════════════════╗
	// ║  TEMPORARY DEBUG INSTRUMENTATION — REMOVE AFTER DIAGNOSIS  ║
	// ╚══════════════════════════════════════════════════════════════╝
	console.log('[Forge Debug] ▶ mountFnGenerator: Starting mount...');

	// Step 1: Register services
	let disposables: ReturnType<typeof _registerServices>;
	try {
		console.log('[Forge Debug]   Step 1: Calling _registerServices()...');
		disposables = _registerServices(accessor);
		console.log('[Forge Debug]   Step 1: ✅ _registerServices() succeeded');
	} catch (e) {
		console.error('[Forge Debug]   Step 1: ❌ _registerServices() THREW:', e);
		rootElement.innerHTML = `<div style="padding:24px;color:#ff6b6b;font-family:monospace;white-space:pre-wrap;background:#1e1e1e;height:100%;overflow:auto;">
<h3 style="color:#ff6b6b;margin:0 0 12px 0;">⚠️ Forge Debug: Service Registration Failed</h3>
<p style="color:#ccc;">_registerServices() threw an exception before React could mount.</p>
<pre style="color:#ffaa00;background:#2d2d2d;padding:12px;border-radius:4px;overflow:auto;">${e instanceof Error ? e.stack || e.message : String(e)}</pre>
<p style="color:#888;margin-top:16px;">Check DevTools Console (Ctrl+Shift+I) for full details.</p>
</div>`;
		return { rerender: () => {}, dispose: () => {} };
	}

	// Step 2: Create React root
	let root: ReactDOM.Root;
	try {
		console.log('[Forge Debug]   Step 2: Creating ReactDOM root...');
		root = ReactDOM.createRoot(rootElement);
		console.log('[Forge Debug]   Step 2: ✅ ReactDOM.createRoot() succeeded');
	} catch (e) {
		console.error('[Forge Debug]   Step 2: ❌ ReactDOM.createRoot() THREW:', e);
		rootElement.innerHTML = `<div style="padding:24px;color:#ff6b6b;font-family:monospace;white-space:pre-wrap;background:#1e1e1e;height:100%;overflow:auto;">
<h3 style="color:#ff6b6b;margin:0 0 12px 0;">⚠️ Forge Debug: React Root Creation Failed</h3>
<pre style="color:#ffaa00;background:#2d2d2d;padding:12px;border-radius:4px;overflow:auto;">${e instanceof Error ? e.stack || e.message : String(e)}</pre>
</div>`;
		return { rerender: () => {}, dispose: () => { disposables.forEach(d => d.dispose()); } };
	}

	// Step 3: Render
	const rerender = (props?: any) => {
		try {
			console.log('[Forge Debug]   Step 3: Calling root.render(<Component />)...');
			root.render(<Component {...props} />);
			console.log('[Forge Debug]   Step 3: ✅ root.render() synchronous call completed');
		} catch (e) {
			console.error('[Forge Debug]   Step 3: ❌ root.render() THREW:', e);
		}
	}
	const dispose = () => {
		root.unmount();
		disposables.forEach(d => d.dispose());
	}

	rerender(props)
	console.log('[Forge Debug] ✅ mountFnGenerator: Mount sequence completed');
	// ═══════════════════ END DEBUG INSTRUMENTATION ════════════════

	const returnVal = {
		rerender,
		dispose,
	}
	return returnVal
}

/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Forge. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { addDisposableListener, Dimension, EventType } from '../../../../base/browser/dom.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { URI } from '../../../../base/common/uri.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import * as nls from '../../../../nls.js';
import { EditorExtensions } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorGroup, IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';

type NativeWebview = HTMLElement & {
	src: string;
	canGoBack(): boolean;
	canGoForward(): boolean;
	goBack(): void;
	goForward(): void;
	reload(): void;
	getURL(): string;
};

export class NativeBrowserInput extends EditorInput {
	static readonly ID = 'workbench.input.forgeNativeBrowser';
	readonly resource: URI;

	constructor(readonly url: string) {
		super();
		this.resource = URI.from({ scheme: 'forge-browser', path: '/page', query: encodeURIComponent(url) });
	}

	override get typeId(): string { return NativeBrowserInput.ID; }
	override getName(): string { return nls.localize('nativeBrowserName', 'Browser'); }
	override getIcon() { return Codicon.eye; }
	override matches(other: EditorInput): boolean { return other instanceof NativeBrowserInput && other.url === this.url; }
}

class NativeBrowserPane extends EditorPane {
	static readonly ID = 'workbench.pane.forgeNativeBrowser';
	private inputBox!: HTMLInputElement;
	private webview!: NativeWebview;
	private isWebviewReady = false;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super(NativeBrowserPane.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		parent.style.cssText = 'height:100%;width:100%;display:flex;flex-direction:column;overflow:hidden;background:var(--vscode-editor-background);';
		const toolbar = document.createElement('form');
		toolbar.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid var(--vscode-panel-border);flex:none;';
		const button = (text: string, title: string) => {
			const element = document.createElement('button');
			element.type = 'button';
			element.textContent = text;
			element.title = title;
			element.style.cssText = 'min-width:28px;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:0;border-radius:3px;padding:5px;cursor:pointer;';
			return element;
		};
		const back = button('←', nls.localize('nativeBrowserBack', 'Back'));
		const forward = button('→', nls.localize('nativeBrowserForward', 'Forward'));
		const reload = button('↻', nls.localize('nativeBrowserReload', 'Reload'));
		this.inputBox = document.createElement('input');
		this.inputBox.type = 'url';
		this.inputBox.setAttribute('aria-label', nls.localize('nativeBrowserUrl', 'Browser URL'));
		this.inputBox.style.cssText = 'min-width:0;flex:1;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border, transparent);border-radius:3px;padding:6px 8px;';
		const go = button(nls.localize('nativeBrowserGo', 'Go'), nls.localize('nativeBrowserGoTitle', 'Open URL'));
		go.type = 'submit';
		toolbar.append(back, forward, reload, this.inputBox, go);
		parent.appendChild(toolbar);

		this.webview = document.createElement('webview') as NativeWebview;
		this.webview.setAttribute('partition', 'persist:forge-browser');
		this.webview.setAttribute('webpreferences', 'contextIsolation=yes, sandbox=yes, nodeIntegration=no');
		this.webview.setAttribute('allowpopups', '');
		this.webview.style.cssText = 'display:flex;flex:1;width:100%;height:100%;border:0;background:white;';
		parent.appendChild(this.webview);

		const navigate = () => {
			const value = this.inputBox.value.trim();
			if (value) {
				this.webview.src = value;
			}
		};
		this._register(addDisposableListener(toolbar, EventType.SUBMIT, event => { event.preventDefault(); navigate(); }));
		this._register(addDisposableListener(back, EventType.CLICK, () => { if (this.isWebviewReady && this.webview.canGoBack()) { this.webview.goBack(); } }));
		this._register(addDisposableListener(forward, EventType.CLICK, () => { if (this.isWebviewReady && this.webview.canGoForward()) { this.webview.goForward(); } }));
		this._register(addDisposableListener(reload, EventType.CLICK, () => { if (this.isWebviewReady) { this.webview.reload(); } }));
		this._register(addDisposableListener(this.webview, 'dom-ready', () => this.isWebviewReady = true));
		this._register(addDisposableListener(this.webview, 'did-navigate', () => this.inputBox.value = this.webview.getURL()));
		this._register(addDisposableListener(this.webview, 'did-navigate-in-page', () => this.inputBox.value = this.webview.getURL()));
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		if (input instanceof NativeBrowserInput) {
			this.inputBox.value = input.url;
			this.webview.src = input.url;
		}
	}

	override layout(_dimension: Dimension): void { }
	override get minimumWidth(): number { return 500; }
}

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(NativeBrowserPane, NativeBrowserPane.ID, nls.localize('nativeBrowserPane', 'Browser')),
	[new SyncDescriptor(NativeBrowserInput)]
);

export async function openNativeBrowser(url: string, editorService: IEditorService, instantiationService: IInstantiationService, editorGroupsService: IEditorGroupsService): Promise<void> {
	const input = instantiationService.createInstance(NativeBrowserInput, url);
	await editorGroupsService.activeGroup.openEditor(input);
}

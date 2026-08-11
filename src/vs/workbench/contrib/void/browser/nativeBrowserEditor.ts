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
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import * as nls from '../../../../nls.js';
import { EditorExtensions, IEditorOpenContext } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorGroup, IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IChatThreadService } from './chatThreadService.js';
import { VOID_VIEW_CONTAINER_ID } from './sidebarPane.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

type NativeWebview = HTMLElement & {
	src: string;
	canGoBack(): boolean;
	canGoForward(): boolean;
	goBack(): void;
	goForward(): void;
	reload(): void;
	getURL(): string;
	openDevTools(): void;
	executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
};

type BrowserComponentSelection = {
	name: string;
	tagName: string;
	id: string;
	className: string;
	text: string;
	selector: string;
	url: string;
	html: string;
	css: string;
	attributes: Record<string, string>;
	hierarchy: string[];
	assets: string[];
	page: {
		title: string;
		description: string;
		viewport: { width: number; height: number };
		headings: Array<{ level: number; text: string }>;
		links: Array<{ text: string; href: string }>;
		forms: Array<{ action: string; method: string; fields: string[] }>;
		text: string;
	};
	bounds: { x: number; y: number; width: number; height: number };
};

const INSPECTOR_SCRIPT = `
(() => {
	const existing = window.__forgeBrowserInspector;
	if (existing && existing.finish) {
		existing.finish(null);
	}

	const overlay = document.createElement('div');
	const label = document.createElement('div');
	overlay.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #2dd4bf;background:rgba(45,212,191,.18);box-sizing:border-box;display:none;';
	label.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;background:#2dd4bf;color:#05201d;font:11px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:2px 6px;border-radius:3px;display:none;';
	document.documentElement.appendChild(overlay);
	document.documentElement.appendChild(label);

	let current = null;
	const styleNames = [
		'display','position','box-sizing','width','height','margin','padding','border','border-radius',
		'background','background-color','color','font','font-size','font-weight','line-height',
		'letter-spacing','text-align','box-shadow','opacity','transform','gap','align-items',
		'justify-content','grid-template-columns','flex-direction'
	];

	const esc = value => {
		if (window.CSS && CSS.escape) {
			return CSS.escape(value);
		}
		return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\\\$&');
	};

	const selectorOf = element => {
		const parts = [];
		let node = element;
		while (node && node.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
			let part = node.tagName.toLowerCase();
			if (node.id) {
				part += '#' + esc(node.id);
				parts.unshift(part);
				break;
			}
			const classes = Array.from(node.classList || []).slice(0, 3);
			if (classes.length) {
				part += '.' + classes.map(esc).join('.');
			}
			const parent = node.parentElement;
			if (parent) {
				const siblings = Array.from(parent.children).filter(child => child.tagName === node.tagName);
				if (siblings.length > 1) {
					part += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
				}
			}
			parts.unshift(part);
			node = parent;
		}
		return parts.join(' > ');
	};

	const matchingRules = element => {
		const result = [];
		for (const sheet of Array.from(document.styleSheets)) {
			let rules;
			try {
				rules = sheet.cssRules;
			} catch {
				continue;
			}
			if (!rules) {
				continue;
			}
			for (const rule of Array.from(rules)) {
				if (!rule.selectorText) {
					continue;
				}
				try {
					if (element.matches(rule.selectorText)) {
						result.push(rule.cssText);
					}
				} catch {
				}
			}
		}
		return result.slice(-20).join('\\n\\n');
	};

	const componentName = element => {
		const explicit = element.getAttribute('aria-label') || element.getAttribute('data-component') || element.getAttribute('data-testid');
		if (explicit) return explicit;
		const tag = element.tagName.toLowerCase();
		const names = { p: 'Paragraph', h1: 'Heading', h2: 'Heading', h3: 'Heading', h4: 'Heading', h5: 'Heading', h6: 'Heading', img: 'Image', nav: 'Navigation', footer: 'Footer', form: 'Form', input: 'Input', button: 'Button', section: 'Section', article: 'Article', main: 'Main', header: 'Header', aside: 'Aside', ul: 'List', li: 'List item' };
		return names[tag] || (element.classList[0] ? element.classList[0].replace(/[-_]+(.)?/g, (_, c) => c ? c.toUpperCase() : '').replace(/^./, c => c.toUpperCase()) : 'Div');
	};

	const capture = element => {
		const computed = getComputedStyle(element);
		const computedCss = styleNames
			.map(name => [name, computed.getPropertyValue(name)])
			.filter(pair => pair[1])
			.map(pair => pair[0] + ': ' + pair[1] + ';')
			.join('\\n');
		const rules = matchingRules(element);
		const rect = element.getBoundingClientRect();
		const attributes = {};
		for (const attribute of Array.from(element.attributes)) attributes[attribute.name] = attribute.value;
		const hierarchy = [];
		let parent = element;
		while (parent && parent !== document.documentElement && hierarchy.length < 8) {
			hierarchy.unshift(componentName(parent) + ' <' + parent.tagName.toLowerCase() + '>');
			parent = parent.parentElement;
		}
		const assets = Array.from(element.querySelectorAll('img,source,video,svg use'))
			.map(asset => asset.getAttribute('src') || asset.getAttribute('href') || (typeof asset.currentSrc === 'string' ? asset.currentSrc : '') || (typeof asset.src === 'string' ? asset.src : ''))
			.filter(Boolean)
			.slice(0, 20);
		const page = {
			title: document.title || '',
			description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
			viewport: { width: window.innerWidth, height: window.innerHeight },
			headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).slice(0, 30).map(heading => ({ level: Number(heading.tagName.slice(1)), text: (heading.innerText || heading.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 240) })).filter(heading => heading.text),
			links: Array.from(document.links).slice(0, 50).map(link => ({ text: (link.innerText || link.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 160), href: link.href })).filter(link => link.href),
			forms: Array.from(document.forms).slice(0, 10).map(form => ({ action: form.action || '', method: form.method || 'get', fields: Array.from(form.elements).slice(0, 30).map(field => field.name || field.id || field.type || field.tagName.toLowerCase()) })),
			text: (document.body?.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 12000)
		};
		const result = {
			name: componentName(element),
			tagName: element.tagName.toLowerCase(),
			id: element.id || '',
			className: typeof element.className === 'string' ? element.className : '',
			text: (element.innerText || element.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 1200),
			selector: selectorOf(element),
			url: location.href,
			html: element.outerHTML.slice(0, 12000),
			css: (rules ? rules + '\\n\\n/* Computed styles */\\n' : '/* Computed styles */\\n') + computedCss,
			attributes,
			hierarchy,
			assets,
			page,
			bounds: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
		};
		// executeJavaScript crosses an Electron IPC boundary: return only cloneable JSON primitives.
		return JSON.parse(JSON.stringify(result));
	};

	const show = element => {
		if (!element || !(element instanceof Element) || element === overlay || element === label || element === document.documentElement) {
			return;
		}
		current = element;
		const rect = element.getBoundingClientRect();
		overlay.style.display = 'block';
		overlay.style.left = rect.left + 'px';
		overlay.style.top = rect.top + 'px';
		overlay.style.width = rect.width + 'px';
		overlay.style.height = rect.height + 'px';
		label.textContent = componentName(element) + ' <' + element.tagName.toLowerCase() + '>';
		label.style.display = 'block';
		label.style.left = rect.left + 'px';
		label.style.top = Math.max(0, rect.top - 22) + 'px';
	};

	const finish = element => {
		document.removeEventListener('mousemove', onMove, true);
		document.removeEventListener('click', onClick, true);
		document.removeEventListener('keydown', onKeyDown, true);
		overlay.remove();
		label.remove();
		window.__forgeBrowserInspector = { result: element ? JSON.stringify(capture(element)) : '__forge_cancelled__' };
	};

	const onMove = event => {
		const target = event.composedPath ? event.composedPath().find(node => node instanceof Element) : event.target;
		show(target);
	};
	const onClick = event => {
		const target = event.composedPath ? event.composedPath().find(node => node instanceof Element) : event.target;
		if (target instanceof Element) show(target);
		if (!current) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		finish(current);
	};
	const onKeyDown = event => {
		if (event.key === 'Escape') {
			event.preventDefault();
			finish(null);
		}
	};

	window.__forgeBrowserInspector = { finish, result: null };
	document.addEventListener('mousemove', onMove, true);
	document.addEventListener('click', onClick, true);
	document.addEventListener('keydown', onKeyDown, true);
	return true;
})();
`;

const CANCEL_INSPECTOR_SCRIPT = `
(() => {
	const inspector = window.__forgeBrowserInspector;
	if (inspector && inspector.finish) {
		inspector.finish(null);
	}
})();
`;

const READ_INSPECTOR_RESULT_SCRIPT = `
(() => {
	const inspector = window.__forgeBrowserInspector;
	if (!inspector || typeof inspector.result !== 'string') return null;
	const result = inspector.result;
	delete window.__forgeBrowserInspector;
	return result;
})();
`;

function selectionOverlayScript(selector: string, name: string): string {
	return `(() => {
		window.__forgeBrowserSelectionOverlay?.remove?.();
		const element = document.querySelector(${JSON.stringify(selector)});
		if (!element) return;
		const overlay = document.createElement('div');
		overlay.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #2dd4bf;background:rgba(45,212,191,.12);box-sizing:border-box;';
		const label = document.createElement('div');
		label.textContent = ${JSON.stringify(name)};
		label.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;background:#0f766e;color:white;font:11px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:2px 6px;border-radius:3px;';
		const update = () => { const rect = element.getBoundingClientRect(); overlay.style.left = rect.left + 'px'; overlay.style.top = rect.top + 'px'; overlay.style.width = rect.width + 'px'; overlay.style.height = rect.height + 'px'; label.style.left = rect.left + 'px'; label.style.top = Math.max(0, rect.top - 22) + 'px'; };
		window.__forgeBrowserSelectionOverlay = { remove: () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); overlay.remove(); label.remove(); } };
		document.documentElement.append(overlay, label); update(); window.addEventListener('scroll', update, true); window.addEventListener('resize', update);
	})();`;
}

export function normalizeBrowserUrl(value: string): string | undefined {
	const candidate = value.trim();
	if (!candidate) {
		return undefined;
	}
	const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
	try {
		const url = new URL(withProtocol);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
	} catch {
		return undefined;
	}
}

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
	private toolbar!: HTMLElement;
	private browserLayout!: HTMLElement;
	private inputBox!: HTMLInputElement;
	private webview!: NativeWebview;
	private inspectButton!: HTMLButtonElement;
	private inspectorPanel!: HTMLElement;
	private collapseButton!: HTMLButtonElement;
	private inspectorTitle!: HTMLElement;
	private inspectorMeta!: HTMLElement;
	private hierarchyPreview!: HTMLElement;
	private designPreview!: HTMLElement;
	private htmlPreview!: HTMLTextAreaElement;
	private cssPreview!: HTMLTextAreaElement;
	private addToChatButton!: HTMLButtonElement;
	private scrapePageButton!: HTMLButtonElement;
	private collectionLabel!: HTMLElement;
	private inspectorTabs!: Record<'design' | 'css' | 'dom', { button: HTMLButtonElement; panel: HTMLElement }>;
	private isWebviewReady = false;
	private isInspecting = false;
	private selectionPollVersion = 0;
	private selectedComponent: BrowserComponentSelection | undefined;
	private readonly addedComponentKeys = new Set<string>();
	private addedComponentCount = 0;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IChatThreadService private readonly chatThreadService: IChatThreadService,
		@IViewsService private readonly viewsService: IViewsService,
		@INotificationService private readonly notificationService: INotificationService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(NativeBrowserPane.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		parent.style.cssText = 'height:100%;width:100%;display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden;background:var(--vscode-editor-background);box-sizing:border-box;';
		const toolbar = document.createElement('form');
		this.toolbar = toolbar;
		toolbar.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid var(--vscode-panel-border);flex:none;';
		const button = (text: string, title: string) => {
			const element = document.createElement('button');
			element.type = 'button';
			element.textContent = text;
			element.title = title;
			element.style.cssText = 'min-width:28px;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:0;border-radius:3px;padding:5px 8px;cursor:pointer;';
			return element;
		};
		const back = button('<', nls.localize('nativeBrowserBack', 'Back'));
		const forward = button('>', nls.localize('nativeBrowserForward', 'Forward'));
		const reload = button('Reload', nls.localize('nativeBrowserReload', 'Reload'));
		this.inputBox = document.createElement('input');
		this.inputBox.type = 'text';
		this.inputBox.setAttribute('aria-label', nls.localize('nativeBrowserUrl', 'Browser URL'));
		this.inputBox.style.cssText = 'min-width:0;flex:1;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border, transparent);border-radius:3px;padding:6px 8px;';
		const go = button(nls.localize('nativeBrowserGo', 'Go'), nls.localize('nativeBrowserGoTitle', 'Open URL'));
		go.type = 'submit';
		this.inspectButton = button('Select', nls.localize('nativeBrowserSelect', 'Select any component from the page (Escape to cancel)'));
		const devTools = button('DevTools', nls.localize('nativeBrowserDevTools', 'Open browser DevTools'));
		const fullscreenBtn = button('⛶', nls.localize('nativeBrowserFullscreen', 'Toggle Fullscreen'));
		toolbar.append(back, forward, reload, this.inputBox, go, this.inspectButton, devTools, fullscreenBtn);
		parent.appendChild(toolbar);

		this.browserLayout = document.createElement('div');
		this.browserLayout.style.cssText = 'display:flex;flex:1;min-height:0;min-width:0;overflow:hidden;';
		parent.appendChild(this.browserLayout);

		this.webview = document.createElement('webview') as NativeWebview;
		this.webview.setAttribute('partition', 'persist:forge-browser');
		this.webview.setAttribute('webpreferences', 'contextIsolation=yes, sandbox=yes, nodeIntegration=no');
		this.webview.setAttribute('allowpopups', '');
		this.webview.style.cssText = 'flex:1;min-width:0;min-height:0;width:100%;height:100%;border:0;background:white;display:flex;';
		this.browserLayout.appendChild(this.webview);

		this.createInspectorPanel(this.browserLayout);

		const navigate = () => {
			const url = normalizeBrowserUrl(this.inputBox.value);
			if (url) {
				this.inputBox.value = url;
				this.webview.src = url;
			}
		};
		this._register(addDisposableListener(toolbar, EventType.SUBMIT, event => { event.preventDefault(); navigate(); }));
		this._register(addDisposableListener(back, EventType.CLICK, () => { if (this.isWebviewReady && this.webview.canGoBack()) { this.webview.goBack(); } }));
		this._register(addDisposableListener(forward, EventType.CLICK, () => { if (this.isWebviewReady && this.webview.canGoForward()) { this.webview.goForward(); } }));
		this._register(addDisposableListener(reload, EventType.CLICK, () => { if (this.isWebviewReady) { this.webview.reload(); } }));
		this._register(addDisposableListener(this.inspectButton, EventType.CLICK, () => this.toggleInspector()));
		this._register(addDisposableListener(devTools, EventType.CLICK, () => { if (this.isWebviewReady) { this.webview.openDevTools(); } }));
		this._register(addDisposableListener(this.webview, 'dom-ready', () => this.isWebviewReady = true));
		this._register(addDisposableListener(this.webview, 'did-navigate', () => this.onNavigate()));
		this._register(addDisposableListener(this.webview, 'did-navigate-in-page', () => this.inputBox.value = this.webview.getURL()));
		this._register(addDisposableListener(fullscreenBtn, EventType.CLICK, () => {
			this.commandService.executeCommand('workbench.action.toggleMaximizeEditorGroup');
		}));
	}

	private createInspectorPanel(parent: HTMLElement): void {
		this.inspectorPanel = document.createElement('section');
		this.inspectorPanel.style.cssText = 'display:none;position:relative;flex:0 0 380px;min-width:300px;max-width:80%;height:100%;border-left:1px solid var(--vscode-panel-border);background:var(--vscode-sideBar-background);color:var(--vscode-sideBar-foreground);overflow:hidden;flex-direction:column;';

		const resizer = document.createElement('div');
		resizer.style.cssText = 'position:absolute;left:-2px;top:0;bottom:0;width:5px;cursor:ew-resize;z-index:100;background:transparent;';
		let isResizing = false;
		let startX = 0;
		let startWidth = 0;

		const onMouseMove = (e: MouseEvent) => {
			if (!isResizing) return;
			const delta = startX - e.clientX;
			const newWidth = Math.max(200, startWidth + delta);
			this.inspectorPanel.style.flex = `0 0 ${newWidth}px`;
		};
		const onMouseUp = () => {
			if (isResizing) {
				isResizing = false;
				document.removeEventListener('mousemove', onMouseMove);
				document.removeEventListener('mouseup', onMouseUp);
				document.body.style.cursor = '';
			}
		};
		this._register(addDisposableListener(resizer, EventType.MOUSE_DOWN, (e) => {
			isResizing = true;
			startX = e.clientX;
			startWidth = this.inspectorPanel.getBoundingClientRect().width;
			document.addEventListener('mousemove', onMouseMove);
			document.addEventListener('mouseup', onMouseUp);
			document.body.style.cursor = 'ew-resize';
			e.preventDefault();
		}));
		this.inspectorPanel.appendChild(resizer);

		this.collapseButton = document.createElement('button');
		this.collapseButton.type = 'button';
		this.collapseButton.textContent = '▼';
		this.collapseButton.title = nls.localize('nativeBrowserCollapse', 'Toggle Inspector Panel');
		this.collapseButton.style.cssText = 'background:none;border:none;color:var(--vscode-icon-foreground);cursor:pointer;padding:4px;display:flex;align-items:center;justify-content:center;';

		const header = document.createElement('div');
		header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--vscode-panel-border);';
		this.inspectorTitle = document.createElement('strong');
		this.inspectorTitle.textContent = nls.localize('nativeBrowserComponents', 'Components');
		this.inspectorTitle.style.cssText = 'font-size:12px;';
		this.inspectorMeta = document.createElement('span');
		this.inspectorMeta.style.cssText = 'min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--vscode-descriptionForeground);font-size:12px;';

		this.addToChatButton = document.createElement('button');
		this.addToChatButton.type = 'button';
		this.addToChatButton.textContent = nls.localize('nativeBrowserAddToChat', 'Add to Chat ▾');
		this.addToChatButton.title = nls.localize('nativeBrowserAddToChatTitle', 'Add this reusable component to the Forge AI chat bar');
		this.addToChatButton.style.cssText = 'background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:0;border-radius:3px;padding:5px 10px;cursor:pointer;';

		const addMenu = document.createElement('div');
		addMenu.style.cssText = 'display:none;position:absolute;right:8px;top:40px;background:var(--vscode-dropdown-background);border:1px solid var(--vscode-dropdown-border);border-radius:3px;box-shadow:0 2px 8px rgba(0,0,0,0.15);z-index:100;flex-direction:column;';
		const createMenuItem = (label: string, onClick: () => void) => {
			const item = document.createElement('button');
			item.type = 'button';
			item.textContent = label;
			item.style.cssText = 'background:none;border:none;color:var(--vscode-dropdown-foreground);padding:6px 12px;text-align:left;cursor:pointer;white-space:nowrap;';
			item.onmouseover = () => item.style.background = 'var(--vscode-list-activeSelectionBackground)';
			item.onmouseout = () => item.style.background = 'none';
			this._register(addDisposableListener(item, EventType.CLICK, () => {
				addMenu.style.display = 'none';
				onClick();
			}));
			return item;
		};
		addMenu.append(
			createMenuItem('Page Content', () => this.addSelectionToChat('page')),
			createMenuItem('Full Component', () => this.addSelectionToChat('full'))
		);
		header.append(this.collapseButton, this.inspectorTitle, this.inspectorMeta, this.addToChatButton, addMenu);

		this._register(addDisposableListener(this.addToChatButton, EventType.CLICK, (e) => {
			addMenu.style.display = addMenu.style.display === 'none' ? 'flex' : 'none';
			e.stopPropagation();
		}));
		this._register(addDisposableListener(document, EventType.CLICK, (e) => {
			if (e.target !== this.addToChatButton) {
				addMenu.style.display = 'none';
			}
		}));

		const actions = document.createElement('div');
		actions.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid var(--vscode-panel-border);';
		this.collectionLabel = document.createElement('span');
		this.collectionLabel.textContent = nls.localize('nativeBrowserCollectionEmpty', 'No components added to chat');
		this.collectionLabel.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--vscode-descriptionForeground);font-size:12px;';
		this.scrapePageButton = document.createElement('button');
		this.scrapePageButton.type = 'button';
		this.scrapePageButton.textContent = nls.localize('nativeBrowserScrapePage', 'Scrape Page');
		this.scrapePageButton.title = nls.localize('nativeBrowserScrapePageTitle', 'Use the local Crawl4AI service to add clean page content to Forge AI');
		this.scrapePageButton.style.cssText = 'background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:0;border-radius:3px;padding:5px 8px;cursor:pointer;';
		actions.append(this.collectionLabel, this.scrapePageButton);

		this.hierarchyPreview = document.createElement('div');
		this.hierarchyPreview.setAttribute('aria-label', nls.localize('nativeBrowserHierarchy', 'Component hierarchy'));
		this.hierarchyPreview.style.cssText = 'max-height:145px;overflow:auto;padding:8px 10px;border-bottom:1px solid var(--vscode-panel-border);font:12px/1.7 var(--vscode-editor-font-family);';

		const tabs = document.createElement('div');
		tabs.style.cssText = 'display:flex;gap:4px;padding:8px 8px 0;';
		const details = document.createElement('div');
		details.style.cssText = 'flex:1;min-height:0;position:relative;overflow:hidden;';
		const createTab = (id: 'design' | 'css' | 'dom', label: string): { button: HTMLButtonElement; panel: HTMLElement } => {
			const tab = document.createElement('button');
			tab.type = 'button';
			tab.textContent = label;
			tab.style.cssText = 'flex:1;border:0;border-radius:3px;padding:5px 8px;cursor:pointer;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);';
			const panel = document.createElement('div');
			panel.style.cssText = 'display:none;height:100%;box-sizing:border-box;padding:8px;overflow:auto;';
			tabs.appendChild(tab);
			details.appendChild(panel);
			this._register(addDisposableListener(tab, EventType.CLICK, () => this.showInspectorTab(id)));
			return { button: tab, panel };
		};
		this.inspectorTabs = {
			design: createTab('design', nls.localize('nativeBrowserDesign', 'Design')),
			css: createTab('css', nls.localize('nativeBrowserCss', 'CSS')),
			dom: createTab('dom', nls.localize('nativeBrowserDom', 'DOM')),
		};

		this.designPreview = document.createElement('div');
		this.designPreview.style.cssText = 'font:12px/1.5 var(--vscode-editor-font-family);';
		this.htmlPreview = this.previewBox(nls.localize('nativeBrowserHtmlPreview', 'Selected HTML'));
		this.cssPreview = this.previewBox(nls.localize('nativeBrowserCssPreview', 'Matched and computed CSS'));
		this.inspectorTabs.design.panel.appendChild(this.designPreview);
		this.inspectorTabs.css.panel.appendChild(this.cssPreview);
		this.inspectorTabs.dom.panel.appendChild(this.htmlPreview);
		
		const panelBody = document.createElement('div');
		panelBody.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;';
		panelBody.append(actions, this.hierarchyPreview, tabs, details);
		
		this.inspectorPanel.append(header, panelBody);
		parent.appendChild(this.inspectorPanel);

		this._register(addDisposableListener(this.collapseButton, EventType.CLICK, () => {
			const isCollapsed = panelBody.style.display === 'none';
			panelBody.style.display = isCollapsed ? 'flex' : 'none';
			this.collapseButton.textContent = isCollapsed ? '▼' : '▶';
		}));
		this._register(addDisposableListener(this.scrapePageButton, EventType.CLICK, () => this.scrapePageToChat()));
	}

	private showInspectorTab(activeTab: 'design' | 'css' | 'dom'): void {
		for (const [tabId, tab] of Object.entries(this.inspectorTabs) as Array<[keyof NativeBrowserPane['inspectorTabs'], { button: HTMLButtonElement; panel: HTMLElement }]>) {
			const active = tabId === activeTab;
			tab.panel.style.display = active ? 'block' : 'none';
			tab.button.style.background = active ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)';
			tab.button.style.color = active ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)';
		}
	}

	private renderDesignDetails(selection: BrowserComponentSelection): void {
		const createRow = (label: string, value: string): HTMLElement => {
			const row = document.createElement('div');
			row.style.cssText = 'display:grid;grid-template-columns:86px minmax(0,1fr);gap:8px;padding:5px 0;border-bottom:1px solid var(--vscode-panel-border);';
			const key = document.createElement('span');
			key.textContent = label;
			key.style.color = 'var(--vscode-descriptionForeground)';
			const content = document.createElement('span');
			content.textContent = value || '—';
			content.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
			row.append(key, content);
			return row;
		};
		this.designPreview.replaceChildren(
			createRow('Component', selection.name),
			createRow('Element', `<${selection.tagName}>`),
			createRow('Selector', selection.selector),
			createRow('Size', `${selection.bounds.width} × ${selection.bounds.height}px`),
			createRow('Classes', selection.className),
			createRow('ID', selection.id),
			createRow('Attributes', Object.entries(selection.attributes).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(' ')),
			createRow('Assets', selection.assets.join(', ')),
		);
	}

	private renderHierarchy(selection: BrowserComponentSelection): void {
		this.hierarchyPreview.replaceChildren();
		selection.hierarchy.forEach((item, index) => {
			const row = document.createElement('div');
			row.textContent = `${index === selection.hierarchy.length - 1 ? '⌙' : '⌄'}  ${item}`;
			row.style.cssText = `padding-left:${index * 12}px;${index === selection.hierarchy.length - 1 ? 'color:var(--vscode-button-foreground);background:color-mix(in srgb, var(--vscode-button-background) 22%, transparent);border-radius:3px;' : ''}`;
			this.hierarchyPreview.appendChild(row);
		});
	}

	private previewBox(label: string): HTMLTextAreaElement {
		const result = document.createElement('textarea');
		result.readOnly = true;
		result.setAttribute('aria-label', label);
		result.style.cssText = 'width:100%;height:100%;resize:none;box-sizing:border-box;background:var(--vscode-editor-background);color:var(--vscode-editor-foreground);border:1px solid var(--vscode-input-border, transparent);border-radius:3px;padding:8px;font:12px/1.45 var(--vscode-editor-font-family);';
		return result;
	}

	private onNavigate(): void {
		this.inputBox.value = this.webview.getURL();
		this.isWebviewReady = true;
		this.isInspecting = false;
		this.selectedComponent = undefined;
		this.inspectorPanel.style.display = 'none';
		this.addedComponentKeys.clear();
		this.addedComponentCount = 0;
		this.updateCollectionLabel();
		this.updateInspectButton();
	}

	private async toggleInspector(): Promise<void> {
		if (!this.isWebviewReady) {
			this.notificationService.notify({ severity: Severity.Info, message: nls.localize('nativeBrowserWaitReady', 'Wait for the page to finish loading before selecting a component.') });
			return;
		}
		if (this.isInspecting) {
			this.selectionPollVersion++;
			await this.webview.executeJavaScript(CANCEL_INSPECTOR_SCRIPT, true);
			this.isInspecting = false;
			this.updateInspectButton();
			return;
		}

		this.isInspecting = true;
		this.updateInspectButton();
		try {
			const started = await this.webview.executeJavaScript(INSPECTOR_SCRIPT, true);
			if (started !== true) {
				throw new Error('The page did not start selection mode.');
			}
			const pollVersion = ++this.selectionPollVersion;
			void this.waitForSelection(pollVersion);
		} catch (error) {
			this.notificationService.notify({ severity: Severity.Error, message: nls.localize('nativeBrowserSelectionFailed', 'Could not start component selection. Reload the page and try again.'), actions: { primary: [] } });
			console.error('[Forge Browser] Component selection failed', error);
			this.isInspecting = false;
			this.updateInspectButton();
		}
	}

	private async waitForSelection(pollVersion: number): Promise<void> {
		while (this.isInspecting && pollVersion === this.selectionPollVersion) {
			await new Promise<void>(resolve => setTimeout(resolve, 100));
			try {
				const result = await this.webview.executeJavaScript(READ_INSPECTOR_RESULT_SCRIPT);
				if (typeof result !== 'string') {
					continue;
				}
				this.isInspecting = false;
				this.updateInspectButton();
				if (result !== '__forge_cancelled__') {
					this.showSelection(JSON.parse(result) as BrowserComponentSelection);
				}
				return;
			} catch (error) {
				if (pollVersion === this.selectionPollVersion) {
					this.isInspecting = false;
					this.updateInspectButton();
					this.notificationService.notify({ severity: Severity.Error, message: nls.localize('nativeBrowserSelectionFailed', 'Could not read the selected component. Reload the page and try again.') });
					console.error('[Forge Browser] Component selection polling failed', error);
				}
				return;
			}
		}
	}

	private updateInspectButton(): void {
		this.inspectButton.textContent = this.isInspecting ? nls.localize('nativeBrowserSelecting', 'Selecting...') : nls.localize('nativeBrowserSelectButton', 'Select');
		this.inspectButton.style.background = this.isInspecting ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)';
		this.inspectButton.style.color = this.isInspecting ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)';
	}

	private showSelection(selection: BrowserComponentSelection): void {
		this.selectedComponent = selection;
		this.inspectorPanel.style.display = 'flex';
		this.inspectorTitle.textContent = `<${selection.tagName}>`;
		this.inspectorTitle.textContent = selection.name;
		this.inspectorMeta.textContent = `${selection.selector}  ${selection.bounds.width}x${selection.bounds.height}`;
		this.renderHierarchy(selection);
		this.renderDesignDetails(selection);
		this.htmlPreview.value = selection.html;
		this.cssPreview.value = selection.css;
		this.showInspectorTab('design');
		void this.webview.executeJavaScript(selectionOverlayScript(selection.selector, selection.name));
	}

	private addSelectionToChat(mode: 'page' | 'full' = 'full'): void {
		const selection = this.selectedComponent;
		if (!selection) {
			return;
		}

		this.addedComponentCount++;
		this.updateCollectionLabel();

		let userMessage: string[] = [];
		if (mode === 'page') {
			userMessage = [
				`[Browser Page Content: ${selection.page.title}]`,
				selection.page.description ? `Description: ${selection.page.description}` : '',
				selection.page.headings.length ? `Headings: ${selection.page.headings.map(heading => `H${heading.level} ${heading.text}`).join(' | ')}` : '',
				selection.page.text ? `Page text: ${selection.page.text}` : ''
			];
		} else {
			userMessage = [
				`[Browser Component: ${selection.name}]`,
				`Page: ${selection.url}`,
				`Selector: ${selection.selector}`,
				`Element: <${selection.tagName}${selection.id ? ` id="${selection.id}"` : ''}${selection.className ? ` class="${selection.className}"` : ''}>`,
				`Hierarchy: ${selection.hierarchy.join(' > ')}`,
				`Attributes: ${JSON.stringify(selection.attributes)}`,
				selection.assets.length ? `Assets: ${selection.assets.join(', ')}` : '',
				`Bounds: ${selection.bounds.width}x${selection.bounds.height}`,
				selection.text ? `Text: ${selection.text}` : '',
				'',
				'HTML:',
				'```html',
				selection.html,
				'```',
				'',
				'CSS:',
				'```css',
				selection.css,
				'```'
			];
		}

		const uriString = `forge-browser-component://page/${encodeURIComponent(selection.name)}_${Date.now()}`;
		const event = new CustomEvent('forge:add-staging-selection', {
			detail: {
				type: 'BrowserComponent',
				title: mode === 'page' ? `Page Content: ${selection.page.title || 'Untitled'}` : `Component: ${selection.name}`,
				content: userMessage.filter(Boolean).join('\n'),
				uri: URI.parse(uriString)
			}
		});
		window.dispatchEvent(event);
		
		this.notificationService.notify({ severity: Severity.Info, message: nls.localize('nativeBrowserAdded', 'Component added to chat.') });
	}

	private updateCollectionLabel(): void {
		if (!this.collectionLabel) {
			return;
		}
		this.collectionLabel.textContent = this.addedComponentCount === 0
			? nls.localize('nativeBrowserCollectionEmpty', 'No components added to chat')
			: nls.localize('nativeBrowserCollectionCount', '{0} component(s) added to chat', this.addedComponentCount);
	}

	private async scrapePageToChat(): Promise<void> {
		if (!this.isWebviewReady) {
			return;
		}
		const url = this.webview.getURL();
		if (!url) {
			return;
		}
		this.scrapePageButton.disabled = true;
		this.scrapePageButton.textContent = nls.localize('nativeBrowserScraping', 'Scraping…');
		try {
			// Crawl4AI exposes this loopback API when run with its official Docker image.
			const response = await fetch('http://127.0.0.1:11235/crawl', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ urls: [url], priority: 10 })
			});
			if (!response.ok) {
				throw new Error(`Crawl4AI returned ${response.status}.`);
			}
			let payload = await response.json() as { results?: unknown[]; task_id?: string };
			for (let attempt = 0; !payload.results && payload.task_id && attempt < 60; attempt++) {
				await new Promise<void>(resolve => setTimeout(resolve, 500));
				const taskResponse = await fetch(`http://127.0.0.1:11235/task/${encodeURIComponent(payload.task_id)}`);
				if (!taskResponse.ok) {
					throw new Error(`Crawl4AI task returned ${taskResponse.status}.`);
				}
				payload = await taskResponse.json() as { results?: unknown[]; task_id?: string };
			}
			const result = payload.results?.[0] as { markdown?: { fit_markdown?: string; raw_markdown?: string } | string; metadata?: unknown; links?: unknown; cleaned_html?: string } | undefined;
			const markdown = typeof result?.markdown === 'string' ? result.markdown : result?.markdown?.fit_markdown || result?.markdown?.raw_markdown || result?.cleaned_html || '';
			if (!markdown) {
				throw new Error('Crawl4AI returned no page content.');
			}
			const content = [
				'CRAWL4AI PAGE RESEARCH',
				`URL: ${url}`,
				'Use this research as supporting context for the user’s request. Prefer the selected browser components when recreating UI.',
				'',
				'```markdown',
				markdown.slice(0, 30000),
				'```',
				result?.metadata ? `Metadata: ${JSON.stringify(result.metadata)}` : '',
				result?.links ? `Links: ${JSON.stringify(result.links)}` : '',
			].filter(Boolean).join('\n');
			await this.viewsService.openViewContainer(VOID_VIEW_CONTAINER_ID);
			await this.chatThreadService.focusCurrentChat();
			window.dispatchEvent(new CustomEvent('forge:add-context', { detail: { kind: 'Crawl4AI page research', content } }));
			this.notificationService.notify({ severity: Severity.Info, message: nls.localize('nativeBrowserScraped', 'Crawl4AI page research added to the Forge AI chat bar.') });
		} catch (error) {
			this.notificationService.notify({ severity: Severity.Error, message: nls.localize('nativeBrowserScrapeFailed', 'Crawl4AI could not reach its local server at http://127.0.0.1:11235. Start the Crawl4AI service, then try again.') });
			console.error('[Forge Browser] Crawl4AI scrape failed', error);
		} finally {
			this.scrapePageButton.disabled = false;
			this.scrapePageButton.textContent = nls.localize('nativeBrowserScrapePage', 'Scrape Page');
		}
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		if (input instanceof NativeBrowserInput) {
			const url = normalizeBrowserUrl(input.url);
			if (url) {
				this.inputBox.value = url;
				this.webview.src = url;
			}
		}
	}

	override layout(dimension: Dimension): void {
		if (this.browserLayout && this.toolbar) {
			this.browserLayout.style.height = `${Math.max(0, dimension.height - this.toolbar.offsetHeight)}px`;
		}
	}
	override get minimumWidth(): number { return 500; }
}

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(NativeBrowserPane, NativeBrowserPane.ID, nls.localize('nativeBrowserPane', 'Browser')),
	[new SyncDescriptor(NativeBrowserInput)]
);

export async function openNativeBrowser(url: string, instantiationService: IInstantiationService, editorGroupsService: IEditorGroupsService): Promise<void> {
	const input = instantiationService.createInstance(NativeBrowserInput, url);
	await editorGroupsService.activeGroup.openEditor(input);
}

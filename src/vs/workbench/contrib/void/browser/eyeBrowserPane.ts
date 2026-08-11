/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Forge. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { addDisposableListener, EventType } from '../../../../base/browser/dom.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import {
	Extensions as ViewContainerExtensions,
	Extensions as ViewExtensions,
	IViewContainersRegistry,
	IViewsRegistry,
	ViewContainerLocation,
} from '../../../common/views.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { IViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { openNativeBrowser } from './nativeBrowserEditor.js';
import * as nls from '../../../../nls.js';

export const EYE_BROWSER_VIEW_CONTAINER_ID = 'workbench.view.eyeBrowser';
export const EYE_BROWSER_VIEW_ID = EYE_BROWSER_VIEW_CONTAINER_ID;

function normalizeUrl(value: string): string | undefined {
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

class EyeBrowserPane extends ViewPane {
	private input!: HTMLInputElement;
	private frame!: HTMLIFrameElement;

	constructor(
		options: IViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IHoverService hoverService: IHoverService,
		@IEditorService private readonly editorService: IEditorService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent);
		parent.style.display = 'flex';
		parent.style.flexDirection = 'column';
		parent.style.height = '100%';

		const toolbar = document.createElement('form');
		toolbar.style.cssText = 'display:flex;gap:4px;padding:8px;border-bottom:1px solid var(--vscode-panel-border);flex:none;';

		const button = (label: string, title: string): HTMLButtonElement => {
			const result = document.createElement('button');
			result.type = 'button';
			result.textContent = label;
			result.title = title;
			result.style.cssText = 'background:transparent;color:var(--vscode-foreground);border:0;padding:2px 6px;cursor:pointer;font-size:14px;';
			return result;
		};
		const back = button('‹', nls.localize('eyeBrowserBack', 'Back'));
		const forward = button('›', nls.localize('eyeBrowserForward', 'Forward'));
		const reload = button('↻', nls.localize('eyeBrowserReload', 'Reload'));
		this.input = document.createElement('input');
		this.input.type = 'text';
		this.input.placeholder = nls.localize('eyeBrowserPlaceholder', 'Enter a URL (https://...)');
		this.input.setAttribute('aria-label', nls.localize('eyeBrowserUrl', 'Browser URL'));
		this.input.style.cssText = 'min-width:0;flex:1;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border, transparent);padding:4px 7px;';
		const go = button(nls.localize('eyeBrowserGo', 'Go'), nls.localize('eyeBrowserGoTitle', 'Open URL'));
		go.type = 'submit';
		toolbar.append(back, forward, reload, this.input, go);
		parent.appendChild(toolbar);

		this.frame = document.createElement('iframe');
		this.frame.title = nls.localize('eyeBrowserFrame', 'Embedded browser');
		this.frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-read; clipboard-write; fullscreen; geolocation; microphone; camera; payment');
		this.frame.setAttribute('allowfullscreen', 'true');
		this.frame.style.cssText = 'border:0;flex:1;width:100%;background:var(--vscode-editor-background);';
		parent.appendChild(this.frame);

		const navigate = () => {
			const url = normalizeUrl(this.input.value);
			if (url) {
				this.input.value = url;
				void openNativeBrowser(url, this.editorService, this.instantiationService, this.editorGroupsService);
			}
		};
		this._register(addDisposableListener(toolbar, EventType.SUBMIT, event => {
			event.preventDefault();
			navigate();
		}));
		this._register(addDisposableListener(back, EventType.CLICK, () => this.frame.contentWindow?.history.back()));
		this._register(addDisposableListener(forward, EventType.CLICK, () => this.frame.contentWindow?.history.forward()));
		this._register(addDisposableListener(reload, EventType.CLICK, () => this.frame.contentWindow?.location.reload()));

		this.input.focus();
	}
}

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const container = viewContainerRegistry.registerViewContainer({
	id: EYE_BROWSER_VIEW_CONTAINER_ID,
	title: nls.localize2('eyeBrowserContainer', 'Browser'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [EYE_BROWSER_VIEW_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
	hideIfEmpty: false,
	order: 2,
	icon: Codicon.eye,
}, ViewContainerLocation.Sidebar);

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: EYE_BROWSER_VIEW_ID,
	hideByDefault: false,
	name: nls.localize2('eyeBrowserView', 'Browser'),
	ctorDescriptor: new SyncDescriptor(EyeBrowserPane),
	canToggleVisibility: false,
	canMoveView: false,
}], container);

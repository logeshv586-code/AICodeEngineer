/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Forge. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { addDisposableListener, EventType } from '../../../../base/browser/dom.js';
import { Codicon } from '../../../../base/common/codicons.js';
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
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { normalizeBrowserUrl, openNativeBrowser } from './nativeBrowserEditor.js';
import * as nls from '../../../../nls.js';

export const EYE_BROWSER_VIEW_CONTAINER_ID = 'workbench.view.eyeBrowser';
export const EYE_BROWSER_VIEW_ID = EYE_BROWSER_VIEW_CONTAINER_ID;

class EyeBrowserPane extends ViewPane {
	private input!: HTMLInputElement;

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

		this.input = document.createElement('input');
		this.input.type = 'text';
		this.input.placeholder = nls.localize('eyeBrowserPlaceholder', 'Enter a URL');
		this.input.setAttribute('aria-label', nls.localize('eyeBrowserUrl', 'Browser URL'));
		this.input.style.cssText = 'min-width:0;flex:1;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border, transparent);padding:4px 7px;';

		const go = document.createElement('button');
		go.type = 'submit';
		go.textContent = nls.localize('eyeBrowserGo', 'Go');
		go.title = nls.localize('eyeBrowserGoTitle', 'Open URL');
		go.style.cssText = 'background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:0;border-radius:3px;padding:4px 8px;cursor:pointer;';
		toolbar.append(this.input, go);
		parent.appendChild(toolbar);

		const hint = document.createElement('div');
	 hint.textContent = nls.localize('eyeBrowserHint', 'Open any URL in the full Browser tab, then use Select to choose page components and send them to chat.');
		hint.style.cssText = 'padding:10px 12px;color:var(--vscode-descriptionForeground);font-size:12px;line-height:1.5;';
		parent.appendChild(hint);

		const navigate = () => {
			const url = normalizeBrowserUrl(this.input.value);
			if (url) {
				this.input.value = url;
				void openNativeBrowser(url, this.instantiationService, this.editorGroupsService);
			}
		};
		this._register(addDisposableListener(toolbar, EventType.SUBMIT, event => {
			event.preventDefault();
			navigate();
		}));

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

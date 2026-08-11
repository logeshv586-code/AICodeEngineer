/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import {
	Extensions as ViewContainerExtensions, IViewContainersRegistry,
	ViewContainerLocation, IViewsRegistry, Extensions as ViewExtensions,
	IViewDescriptorService,
} from '../../../common/views.js';

import * as nls from '../../../../nls.js';

// import { Codicon } from '../../../../base/common/codicons.js';
// import { localize } from '../../../../nls.js';
// import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';

import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
// import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';


import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';

import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
// import { IDisposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { mountSidebar } from './react/out/sidebar-tsx/index.js';

import { Codicon } from '../../../../base/common/codicons.js';
import { Orientation } from '../../../../base/browser/ui/sash/sash.js';
// import { IDisposable } from '../../../../base/common/lifecycle.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { forgeLog } from './forge/debug/diagnostics.js';

// compare against search.contribution.ts and debug.contribution.ts, scm.contribution.ts (source control)

// ---------- Define viewpane ----------

class SidebarViewPane extends ViewPane {

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
	) {
		forgeLog('4. SidebarViewPane constructor executed');
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(parent: HTMLElement): void {
		forgeLog('4.1 SidebarViewPane renderBody executed');
		super.renderBody(parent);
		parent.style.userSelect = 'text';

		this.instantiationService.invokeFunction(accessor => {
			forgeLog('5. Checking DI Services before mount...');
			const keybindingService = accessor.get(IKeybindingService);
			const configurationService = accessor.get(IConfigurationService);
			const themeService = accessor.get(IThemeService);
			forgeLog('5.1 Services resolved:', {
				keybindingService: !!keybindingService,
				configurationService: !!configurationService,
				themeService: !!themeService,
			});

			try {
				forgeLog('6. Invoking mountSidebar...');
				const res = mountSidebar(parent, accessor);
				forgeLog('6.1 mountSidebar completed successfully', res);
				const disposeFn: (() => void) | undefined = res?.dispose;
				this._register(toDisposable(() => disposeFn?.()));
			} catch (err) {
				console.error('[Forge Debug] ❌ SidebarViewPane: mountSidebar THREW:', err);
				parent.innerHTML = `<div style="padding:16px;color:#ff6b6b;font-family:monospace;white-space:pre-wrap;background:#1e1e1e;height:100%;overflow:auto;">
<h4 style="color:#ff6b6b;margin:0 0 8px 0;">⚠️ Forge Debug: Sidebar Mount Failed</h4>
<pre style="color:#ffaa00;background:#2d2d2d;padding:8px;border-radius:4px;overflow:auto;font-size:11px;">${err instanceof Error ? err.stack || err.message : String(err)}</pre>
</div>`;
			}
		});
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.element.style.height = `${height}px`;
		this.element.style.width = `${width}px`;
	}

}



// ---------- Register viewpane inside the void container ----------

export const VOID_VIEW_CONTAINER_ID = 'workbench.view.void';
export const VOID_VIEW_ID = VOID_VIEW_CONTAINER_ID;

forgeLog('3. Registering view container:', VOID_VIEW_CONTAINER_ID);

// Register view container
const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const container = viewContainerRegistry.registerViewContainer({
	id: VOID_VIEW_CONTAINER_ID,
	title: nls.localize2('voidContainer', 'Forge AI'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [VOID_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	order: 1,
	rejectAddedViews: true,
	icon: Codicon.flame,
}, ViewContainerLocation.AuxiliaryBar, { doNotRegisterOpenCommand: true, isDefault: true });

forgeLog('3.1 View container registered successfully', container.id);

// Register view to the container
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
forgeLog('3.2 Registering view into container:', { viewId: VOID_VIEW_ID, containerId: container.id });
viewsRegistry.registerViews([{
	id: VOID_VIEW_ID,
	hideByDefault: false,
	name: nls.localize2('voidChat', ''),
	ctorDescriptor: new SyncDescriptor(SidebarViewPane),
	canToggleVisibility: false,
	canMoveView: false,
	weight: 80,
	order: 1,
}], container);
forgeLog('3.3 View registered successfully into viewsRegistry');


// open sidebar
export const VOID_OPEN_SIDEBAR_ACTION_ID = 'void.openSidebar'
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: VOID_OPEN_SIDEBAR_ACTION_ID,
			title: 'Open Forge AI Sidebar',
		})
	}
	run(accessor: ServicesAccessor): void {
		const viewsService = accessor.get(IViewsService)
		viewsService.openViewContainer(VOID_VIEW_CONTAINER_ID);
	}
});

export class SidebarStartContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.startupVoidSidebar';
	constructor(
		@ICommandService private readonly commandService: ICommandService,
	) {
		this.commandService.executeCommand(VOID_OPEN_SIDEBAR_ACTION_ID)
	}
}
registerWorkbenchContribution2(SidebarStartContribution.ID, SidebarStartContribution, WorkbenchPhase.AfterRestored);

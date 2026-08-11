/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import * as nls from '../../../../nls.js';
import { EditorExtensions } from '../../../common/editor.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorGroup, IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { Dimension } from '../../../../base/browser/dom.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { URI } from '../../../../base/common/uri.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';


import { mountVoidSettings } from './react/out/void-settings-tsx/index.js'
import { Codicon } from '../../../../base/common/codicons.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';


// refer to preferences.contribution.ts keybindings editor

class VoidSettingsInput extends EditorInput {

	static readonly ID: string = 'workbench.input.void.settings';

	static readonly RESOURCE = URI.from({
		scheme: 'void',
		path: '/settings'
	});
	readonly resource = VoidSettingsInput.RESOURCE;

	constructor() {
		super();
	}

	override get typeId(): string {
		return VoidSettingsInput.ID;
	}

	override getName(): string {
		return nls.localize('voidSettingsInputsName', 'Forge AI Settings');
	}

	override getIcon() {
		return Codicon.checklist;
	}

	override matches(otherInput: EditorInput): boolean {
		if (super.matches(otherInput)) {
			return true;
		}
		return otherInput instanceof VoidSettingsInput;
	}
}


class VoidSettingsPane extends EditorPane {
	static readonly ID = 'workbench.test.myCustomPane';

	// private _scrollbar: DomScrollableElement | undefined;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		console.log('[Forge Debug] ▶ VoidSettingsPane: constructor called');
		super(VoidSettingsPane.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		console.log('[Forge Debug] ▶ VoidSettingsPane: createEditor called');
		parent.style.height = '100%';
		parent.style.width = '100%';

		const settingsElt = document.createElement('div');
		settingsElt.style.height = '100%';
		settingsElt.style.width = '100%';

		parent.appendChild(settingsElt);

		// Mount React into the scrollable content
		this.instantiationService.invokeFunction(accessor => {
			console.log('[Forge Debug] ▶ VoidSettingsPane: invoking mountVoidSettings...');
			try {
				const res = mountVoidSettings(settingsElt, accessor);
				console.log('[Forge Debug] ✅ VoidSettingsPane: mountVoidSettings completed', res);
				const disposeFn = res?.dispose;
				this._register(toDisposable(() => disposeFn?.()));
			} catch (err) {
				console.error('[Forge Debug] ❌ VoidSettingsPane: mountVoidSettings THREW:', err);
				settingsElt.innerHTML = `<div style="padding:24px;color:#ff6b6b;font-family:monospace;white-space:pre-wrap;background:#1e1e1e;height:100%;overflow:auto;">
<h3 style="color:#ff6b6b;margin:0 0 12px 0;">⚠️ Forge Debug: Settings Mount Threw Exception</h3>
<pre style="color:#ffaa00;background:#2d2d2d;padding:12px;border-radius:4px;overflow:auto;">${err instanceof Error ? err.stack || err.message : String(err)}</pre>
</div>`;
			}
		});
	}

	layout(dimension: Dimension): void {
		// if (!settingsElt) return
		// settingsElt.style.height = `${dimension.height}px`;
		// settingsElt.style.width = `${dimension.width}px`;
	}


	override get minimumWidth() { return 700 }

}

// register Settings pane
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(VoidSettingsPane, VoidSettingsPane.ID, nls.localize('VoidSettingsPane', "Forge AI Settings Pane")),
	[new SyncDescriptor(VoidSettingsInput)]
);


// register the gear on the top right
export const VOID_TOGGLE_SETTINGS_ACTION_ID = 'workbench.action.toggleVoidSettings'
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: VOID_TOGGLE_SETTINGS_ACTION_ID,
			title: nls.localize2('voidSettings', "Forge AI: Toggle Settings"),
			icon: Codicon.settingsGear,
			menu: [
				{
					id: MenuId.LayoutControlMenuSubmenu,
					group: 'z_end',
				},
				{
					id: MenuId.LayoutControlMenu,
					when: ContextKeyExpr.equals('config.workbench.layoutControl.type', 'both'),
					group: 'z_end'
				}
			]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const editorGroupService = accessor.get(IEditorGroupsService);

		const instantiationService = accessor.get(IInstantiationService);

		// if is open, close it
		const openEditors = editorService.findEditors(VoidSettingsInput.RESOURCE); // should only have 0 or 1 elements...
		if (openEditors.length !== 0) {
			const openEditor = openEditors[0].editor
			const isCurrentlyOpen = editorService.activeEditor?.resource?.fsPath === openEditor.resource?.fsPath
			if (isCurrentlyOpen)
				await editorService.closeEditors(openEditors)
			else
				await editorGroupService.activeGroup.openEditor(openEditor)
			return;
		}


		// else open it
		const input = instantiationService.createInstance(VoidSettingsInput);

		await editorGroupService.activeGroup.openEditor(input);
	}
})



export const VOID_OPEN_SETTINGS_ACTION_ID = 'workbench.action.openVoidSettings'
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: VOID_OPEN_SETTINGS_ACTION_ID,
			title: nls.localize2('voidSettingsAction2', "Forge AI: Open Settings"),
			f1: true,
			icon: Codicon.settingsGear,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const instantiationService = accessor.get(IInstantiationService);

		// close all instances if found
		const openEditors = editorService.findEditors(VoidSettingsInput.RESOURCE);
		if (openEditors.length > 0) {
			await editorService.closeEditors(openEditors);
		}

		// then, open one single editor
		const input = instantiationService.createInstance(VoidSettingsInput);
		await editorService.openEditor(input);
	}
})





// add to settings gear on bottom left
MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
	group: '0_command',
	command: {
		id: VOID_TOGGLE_SETTINGS_ACTION_ID,
		title: nls.localize('voidSettingsActionGear', "Forge AI Settings")
	},
	order: 1
});

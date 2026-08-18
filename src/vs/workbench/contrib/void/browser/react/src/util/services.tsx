/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useState, useEffect, useCallback } from 'react'
import { MCPUserState, RefreshableProviderName, SettingsOfProvider } from '../../../../../../../workbench/contrib/void/common/voidSettingsTypes.js'
import { DisposableStore, IDisposable } from '../../../../../../../base/common/lifecycle.js'
import { VoidSettingsState } from '../../../../../../../workbench/contrib/void/common/voidSettingsService.js'
import { ColorScheme } from '../../../../../../../platform/theme/common/theme.js'
import { RefreshModelStateOfProvider } from '../../../../../../../workbench/contrib/void/common/refreshModelService.js'
import { ServicesAccessor } from '../../../../../../../editor/browser/editorExtensions.js'
import { IExplorerService } from '../../../../../../../workbench/contrib/files/browser/files.js'
import { IModelService } from '../../../../../../../editor/common/services/model.js'
import { IClipboardService } from '../../../../../../../platform/clipboard/common/clipboardService.js'
import { IContextViewService, IContextMenuService } from '../../../../../../../platform/contextview/browser/contextView.js'
import { IFileService } from '../../../../../../../platform/files/common/files.js'
import { IHoverService } from '../../../../../../../platform/hover/browser/hover.js'
import { IThemeService } from '../../../../../../../platform/theme/common/themeService.js'
import { ILLMMessageService } from '../../../../common/sendLLMMessageService.js'
import { IRefreshModelService } from '../../../../../../../workbench/contrib/void/common/refreshModelService.js'
import { IVoidSettingsService } from '../../../../../../../workbench/contrib/void/common/voidSettingsService.js'
import { IExtensionTransferService } from '../../../../../../../workbench/contrib/void/browser/extensionTransferService.js'
import { IInstantiationService } from '../../../../../../../platform/instantiation/common/instantiation.js'
import { ICodeEditorService } from '../../../../../../../editor/browser/services/codeEditorService.js'
import { ICommandService } from '../../../../../../../platform/commands/common/commands.js'
import { IContextKeyService } from '../../../../../../../platform/contextkey/common/contextkey.js'
import { INotificationService } from '../../../../../../../platform/notification/common/notification.js'
import { IAccessibilityService } from '../../../../../../../platform/accessibility/common/accessibility.js'
import { ILanguageConfigurationService } from '../../../../../../../editor/common/languages/languageConfigurationRegistry.js'
import { ILanguageFeaturesService } from '../../../../../../../editor/common/services/languageFeatures.js'
import { ILanguageDetectionService } from '../../../../../../services/languageDetection/common/languageDetectionWorkerService.js'
import { IKeybindingService } from '../../../../../../../platform/keybinding/common/keybinding.js'
import { IEnvironmentService } from '../../../../../../../platform/environment/common/environment.js'
import { IConfigurationService } from '../../../../../../../platform/configuration/common/configuration.js'
import { IPathService } from '../../../../../../../workbench/services/path/common/pathService.js'
import { IMetricsService } from '../../../../../../../workbench/contrib/void/common/metricsService.js'
import { URI } from '../../../../../../../base/common/uri.js'
import { IChatThreadService, ThreadsState, ThreadStreamState } from '../../../chatThreadService.js'
import { ITerminalToolService } from '../../../terminalToolService.js'
import { ILanguageService } from '../../../../../../../editor/common/languages/language.js'
import { IVoidModelService } from '../../../../common/voidModelService.js'
import { IWorkspaceContextService } from '../../../../../../../platform/workspace/common/workspace.js'
import { IVoidCommandBarService } from '../../../voidCommandBarService.js'
import { INativeHostService } from '../../../../../../../platform/native/common/native.js'
import { IEditCodeService } from '../../../editCodeServiceInterface.js'
import { IToolsService } from '../../../toolsService.js'
import { IConvertToLLMMessageService } from '../../../convertToLLMMessageService.js'
import { ITerminalService } from '../../../../../terminal/browser/terminal.js'
import { ISearchService } from '../../../../../../services/search/common/search.js'
import { IExtensionManagementService } from '../../../../../../../platform/extensionManagement/common/extensionManagement.js'
import { IMCPService } from '../../../../common/mcpService.js'
import { ISkillsService } from '../../../skillsService.js'
import { IStorageService, StorageScope } from '../../../../../../../platform/storage/common/storage.js'
import { OPT_OUT_KEY } from '../../../../common/storageKeys.js'
import { IMainProcessService } from '../../../../../../../platform/ipc/common/mainProcessService.js'

let chatThreadsState: ThreadsState
const chatThreadsStateListeners = new Set<(s: ThreadsState) => void>()

let chatThreadsStreamState: ThreadStreamState
const chatThreadsStreamStateListeners = new Set<(threadId: string) => void>()

let settingsState: VoidSettingsState
const settingsStateListeners = new Set<(s: VoidSettingsState) => void>()

let refreshModelState: RefreshModelStateOfProvider
const refreshModelStateListeners = new Set<(s: RefreshModelStateOfProvider) => void>()
const refreshModelProviderListeners = new Set<(p: RefreshableProviderName, s: RefreshModelStateOfProvider) => void>()

let colorThemeState: ColorScheme
const colorThemeStateListeners = new Set<(s: ColorScheme) => void>()

const ctrlKZoneStreamingStateListeners = new Set<(diffareaid: number, s: boolean) => void>()
const commandBarURIStateListeners = new Set<(uri: URI) => void>()
const activeURIListeners = new Set<(uri: URI | null) => void>()
const mcpListeners = new Set<() => void>()

/**
 * Register the workbench services used by the Forge React surfaces.
 * This must run once before any hook below is used. Keep this bridge quiet:
 * per-service debug logging here is extremely noisy and runs on every React mount.
 */
export const _registerServices = (accessor: ServicesAccessor) => {
	const disposables: IDisposable[] = []
	_registerAccessor(accessor)

	const chatThreadsStateService = accessor.get(IChatThreadService)
	const settingsStateService = accessor.get(IVoidSettingsService)
	const refreshModelService = accessor.get(IRefreshModelService)
	const themeService = accessor.get(IThemeService)
	const editCodeService = accessor.get(IEditCodeService)
	const voidCommandBarService = accessor.get(IVoidCommandBarService)
	const modelService = accessor.get(IModelService)
	const mcpService = accessor.get(IMCPService)

	chatThreadsState = chatThreadsStateService.state
	disposables.push(chatThreadsStateService.onDidChangeCurrentThread(() => {
		chatThreadsState = chatThreadsStateService.state
		chatThreadsStateListeners.forEach(listener => listener(chatThreadsState))
	}))

	chatThreadsStreamState = chatThreadsStateService.streamState
	disposables.push(chatThreadsStateService.onDidChangeStreamState(({ threadId }) => {
		chatThreadsStreamState = chatThreadsStateService.streamState
		chatThreadsStreamStateListeners.forEach(listener => listener(threadId))
	}))

	settingsState = settingsStateService.state
	disposables.push(settingsStateService.onDidChangeState(() => {
		settingsState = settingsStateService.state
		settingsStateListeners.forEach(listener => listener(settingsState))
	}))

	refreshModelState = refreshModelService.state
	disposables.push(refreshModelService.onDidChangeState(providerName => {
		refreshModelState = refreshModelService.state
		refreshModelStateListeners.forEach(listener => listener(refreshModelState))
		refreshModelProviderListeners.forEach(listener => listener(providerName, refreshModelState))
	}))

	colorThemeState = themeService.getColorTheme().type
	disposables.push(themeService.onDidColorThemeChange(({ type }) => {
		colorThemeState = type
		colorThemeStateListeners.forEach(listener => listener(colorThemeState))
	}))

	disposables.push(editCodeService.onDidChangeStreamingInCtrlKZone(({ diffareaid }) => {
		const isStreaming = editCodeService.isCtrlKZoneStreaming({ diffareaid })
		ctrlKZoneStreamingStateListeners.forEach(listener => listener(diffareaid, isStreaming))
	}))

	disposables.push(voidCommandBarService.onDidChangeState(({ uri }) => {
		commandBarURIStateListeners.forEach(listener => listener(uri))
	}))

	disposables.push(voidCommandBarService.onDidChangeActiveURI(({ uri }) => {
		activeURIListeners.forEach(listener => listener(uri))
	}))

	disposables.push(mcpService.onDidChangeState(() => {
		mcpListeners.forEach(listener => listener())
	}))

	// Keep modelService eagerly resolved here because older Forge mounts rely on
	// registration-time model initialization even when no hook reads it directly.
	void modelService
	return disposables
}

const getReactAccessor = (accessor: ServicesAccessor) => ({
	IModelService: accessor.get(IModelService),
	IClipboardService: accessor.get(IClipboardService),
	IContextViewService: accessor.get(IContextViewService),
	IContextMenuService: accessor.get(IContextMenuService),
	IFileService: accessor.get(IFileService),
	IHoverService: accessor.get(IHoverService),
	IThemeService: accessor.get(IThemeService),
	ILLMMessageService: accessor.get(ILLMMessageService),
	IRefreshModelService: accessor.get(IRefreshModelService),
	IVoidSettingsService: accessor.get(IVoidSettingsService),
	IEditCodeService: accessor.get(IEditCodeService),
	IChatThreadService: accessor.get(IChatThreadService),
	IInstantiationService: accessor.get(IInstantiationService),
	ICodeEditorService: accessor.get(ICodeEditorService),
	ICommandService: accessor.get(ICommandService),
	IContextKeyService: accessor.get(IContextKeyService),
	INotificationService: accessor.get(INotificationService),
	IAccessibilityService: accessor.get(IAccessibilityService),
	ILanguageConfigurationService: accessor.get(ILanguageConfigurationService),
	ILanguageDetectionService: accessor.get(ILanguageDetectionService),
	ILanguageFeaturesService: accessor.get(ILanguageFeaturesService),
	IKeybindingService: accessor.get(IKeybindingService),
	ISearchService: accessor.get(ISearchService),
	IExplorerService: accessor.get(IExplorerService),
	IEnvironmentService: accessor.get(IEnvironmentService),
	IConfigurationService: accessor.get(IConfigurationService),
	IPathService: accessor.get(IPathService),
	IMetricsService: accessor.get(IMetricsService),
	ITerminalToolService: accessor.get(ITerminalToolService),
	ILanguageService: accessor.get(ILanguageService),
	IVoidModelService: accessor.get(IVoidModelService),
	IWorkspaceContextService: accessor.get(IWorkspaceContextService),
	IVoidCommandBarService: accessor.get(IVoidCommandBarService),
	INativeHostService: accessor.get(INativeHostService),
	IToolsService: accessor.get(IToolsService),
	IConvertToLLMMessageService: accessor.get(IConvertToLLMMessageService),
	ITerminalService: accessor.get(ITerminalService),
	IExtensionManagementService: accessor.get(IExtensionManagementService),
	IExtensionTransferService: accessor.get(IExtensionTransferService),
	IMCPService: accessor.get(IMCPService),
	ISkillsService: accessor.get(ISkillsService),
	IStorageService: accessor.get(IStorageService),
	IMainProcessService: accessor.get(IMainProcessService),
} as const)

type ReactAccessor = ReturnType<typeof getReactAccessor>
let reactAccessor_: ReactAccessor | null = null

const _registerAccessor = (accessor: ServicesAccessor) => {
	reactAccessor_ = getReactAccessor(accessor)
}

export const useAccessor = () => {
	if (!reactAccessor_) throw new Error('Forge useAccessor was called before _registerServices.')
	return { get: <S extends keyof ReactAccessor>(service: S): ReactAccessor[S] => reactAccessor_![service] }
}

export const useSettingsState = () => {
	const [state, setState] = useState(settingsState)
	useEffect(() => {
		setState(settingsState)
		settingsStateListeners.add(setState)
		return () => { settingsStateListeners.delete(setState) }
	}, [setState])
	return state
}

export const useChatThreadsState = () => {
	const [state, setState] = useState(chatThreadsState)
	useEffect(() => {
		setState(chatThreadsState)
		chatThreadsStateListeners.add(setState)
		return () => { chatThreadsStateListeners.delete(setState) }
	}, [setState])
	return state
}

export const useChatThreadsStreamState = (threadId: string) => {
	const [state, setState] = useState<ThreadStreamState[string] | undefined>(chatThreadsStreamState[threadId])
	useEffect(() => {
		setState(chatThreadsStreamState[threadId])
		const listener = (changedThreadId: string) => {
			if (changedThreadId === threadId) setState(chatThreadsStreamState[threadId])
		}
		chatThreadsStreamStateListeners.add(listener)
		return () => { chatThreadsStreamStateListeners.delete(listener) }
	}, [threadId])
	return state
}

export const useFullChatThreadsStreamState = () => {
	const [state, setState] = useState(chatThreadsStreamState)
	useEffect(() => {
		setState(chatThreadsStreamState)
		const listener = () => setState(chatThreadsStreamState)
		chatThreadsStreamStateListeners.add(listener)
		return () => { chatThreadsStreamStateListeners.delete(listener) }
	}, [])
	return state
}

export const useRefreshModelState = () => {
	const [state, setState] = useState(refreshModelState)
	useEffect(() => {
		setState(refreshModelState)
		refreshModelStateListeners.add(setState)
		return () => { refreshModelStateListeners.delete(setState) }
	}, [setState])
	return state
}

export const useRefreshModelListener = (listener: (providerName: RefreshableProviderName, state: RefreshModelStateOfProvider) => void) => {
	useEffect(() => {
		refreshModelProviderListeners.add(listener)
		return () => { refreshModelProviderListeners.delete(listener) }
	}, [listener])
}

export const useCtrlKZoneStreamingState = (listener: (diffareaid: number, streaming: boolean) => void) => {
	useEffect(() => {
		ctrlKZoneStreamingStateListeners.add(listener)
		return () => { ctrlKZoneStreamingStateListeners.delete(listener) }
	}, [listener])
}

export const useIsDark = () => {
	const [state, setState] = useState(colorThemeState)
	useEffect(() => {
		setState(colorThemeState)
		colorThemeStateListeners.add(setState)
		return () => { colorThemeStateListeners.delete(setState) }
	}, [setState])
	return state === ColorScheme.DARK || state === ColorScheme.HIGH_CONTRAST_DARK
}

export const useCommandBarURIListener = (listener: (uri: URI) => void) => {
	useEffect(() => {
		commandBarURIStateListeners.add(listener)
		return () => { commandBarURIStateListeners.delete(listener) }
	}, [listener])
}

export const useCommandBarState = () => {
	const commandBarService = useAccessor().get('IVoidCommandBarService')
	const [state, setState] = useState({ stateOfURI: commandBarService.stateOfURI, sortedURIs: commandBarService.sortedURIs })
	const listener = useCallback(() => {
		setState({ stateOfURI: commandBarService.stateOfURI, sortedURIs: commandBarService.sortedURIs })
	}, [commandBarService])
	useCommandBarURIListener(listener)
	return state
}

export const useActiveURI = () => {
	const commandBarService = useAccessor().get('IVoidCommandBarService')
	const [state, setState] = useState(commandBarService.activeURI)
	useEffect(() => {
		const listener = () => setState(commandBarService.activeURI)
		activeURIListeners.add(listener)
		return () => { activeURIListeners.delete(listener) }
	}, [commandBarService])
	return { uri: state }
}

export const useMCPServiceState = () => {
	const mcpService = useAccessor().get('IMCPService')
	const [state, setState] = useState(mcpService.state)
	useEffect(() => {
		const listener = () => setState(mcpService.state)
		mcpListeners.add(listener)
		return () => { mcpListeners.delete(listener) }
	}, [mcpService])
	return state
}

export const useIsOptedOut = () => {
	const storageService = useAccessor().get('IStorageService')
	const getValue = useCallback(() => storageService.getBoolean(OPT_OUT_KEY, StorageScope.APPLICATION, false), [storageService])
	const [state, setState] = useState(getValue())
	useEffect(() => {
		const disposables = new DisposableStore()
		const disposable = storageService.onDidChangeValue(StorageScope.APPLICATION, OPT_OUT_KEY, disposables)(() => setState(getValue()))
		disposables.add(disposable)
		return () => disposables.clear()
	}, [storageService, getValue])
	return state
}

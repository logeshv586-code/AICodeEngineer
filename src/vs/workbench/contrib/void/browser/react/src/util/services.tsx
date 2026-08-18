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
let rawAccessor_: ServicesAccessor | null = null

const _registerAccessor = (accessor: ServicesAccessor) => {
	rawAccessor_ = accessor
	reactAccessor_ = getReactAccessor(accessor)
}

export const useAccessor = () => {
	if (!reactAccessor_) throw new Error('Forge useAccessor was called before _registerServices.')
	return { get: <S extends keyof ReactAccessor>(service: S): ReactAccessor[S] => reactAccessor_![service] }
}

/**
 * Token-aware workbench accessor for modern Forge surfaces that consume services
 * through VS Code decorators (for example accessor.get(INotificationService)).
 * Keep the lightweight string-key useAccessor() for legacy components.
 */
export const useRawAccessor = (): ServicesAccessor => {
	if (!rawAccessor_) throw new Error('Forge useRawAccessor was called before _registerServices.')
	return rawAccessor_
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
		const listener = (newState: ThreadsState) => setState({ ...newState, allThreads: { ...newState.allThreads } })
		chatThreadsStateListeners.add(listener)
		return () => { chatThreadsStateListeners.delete(listener) }
	}, [])
	return state
}

export const useChatThreadsStreamState = (threadId: string) => {
	const [state, setState] = useState(() => chatThreadsStreamState?.[threadId])
	useEffect(() => {
		setState(chatThreadsStreamState?.[threadId])
		const listener = (changedThreadId: string) => {
			if (changedThreadId === threadId) setState(chatThreadsStreamState?.[threadId])
		}
		chatThreadsStreamStateListeners.add(listener)
		return () => { chatThreadsStreamStateListeners.delete(listener) }
	}, [threadId])
	return state
}

export const useFullChatThreadsStreamState = () => {
	const [, force] = useState(0)
	useEffect(() => {
		const listener = () => force(value => value + 1)
		chatThreadsStreamStateListeners.add(listener)
		return () => { chatThreadsStreamStateListeners.delete(listener) }
	}, [])
	return chatThreadsStreamState
}

export const useRefreshModelState = () => {
	const [state, setState] = useState(refreshModelState)
	useEffect(() => {
		setState(refreshModelState)
		refreshModelStateListeners.add(setState)
		return () => { refreshModelStateListeners.delete(setState) }
	}, [])
	return state
}

export const useRefreshModelProviderState = (providerName: RefreshableProviderName) => {
	const [state, setState] = useState(() => refreshModelState?.[providerName])
	useEffect(() => {
		setState(refreshModelState?.[providerName])
		const listener = (changedProvider: RefreshableProviderName, fullState: RefreshModelStateOfProvider) => {
			if (changedProvider === providerName) setState(fullState?.[providerName])
		}
		refreshModelProviderListeners.add(listener)
		return () => { refreshModelProviderListeners.delete(listener) }
	}, [providerName])
	return state
}

export const useIsDark = () => {
	const [isDark, setIsDark] = useState(() => colorThemeState === ColorScheme.DARK || colorThemeState === ColorScheme.HIGH_CONTRAST_DARK)
	useEffect(() => {
		const listener = (scheme: ColorScheme) => setIsDark(scheme === ColorScheme.DARK || scheme === ColorScheme.HIGH_CONTRAST_DARK)
		colorThemeStateListeners.add(listener)
		return () => { colorThemeStateListeners.delete(listener) }
	}, [])
	return isDark
}

export const useCtrlKZoneStreaming = (diffareaid: number) => {
	const accessor = useAccessor()
	const [isStreaming, setIsStreaming] = useState(() => accessor.get('IEditCodeService').isCtrlKZoneStreaming({ diffareaid }))
	useEffect(() => {
		const listener = (changedDiffareaid: number, state: boolean) => {
			if (changedDiffareaid === diffareaid) setIsStreaming(state)
		}
		ctrlKZoneStreamingStateListeners.add(listener)
		return () => { ctrlKZoneStreamingStateListeners.delete(listener) }
	}, [diffareaid])
	return isStreaming
}

export const useCommandBarState = () => {
	const accessor = useAccessor()
	const service = accessor.get('IVoidCommandBarService')
	const [state, setState] = useState(service.state)
	useEffect(() => service.onDidChangeState(() => setState({ ...service.state })), [service])
	return state
}

export const useActiveURI = () => {
	const accessor = useAccessor()
	const [uri, setUri] = useState<URI | null>(() => accessor.get('IVoidCommandBarService').state.uri ?? null)
	useEffect(() => {
		activeURIListeners.add(setUri)
		return () => { activeURIListeners.delete(setUri) }
	}, [])
	return uri
}

export const useMCPState = () => {
	const accessor = useAccessor()
	const service = accessor.get('IMCPService')
	const [, refresh] = useState(0)
	useEffect(() => {
		const listener = () => refresh(value => value + 1)
		mcpListeners.add(listener)
		return () => { mcpListeners.delete(listener) }
	}, [])
	return service.state
}

export const useStorageBoolean = (key: string, defaultValue: boolean) => {
	const accessor = useAccessor()
	const service = accessor.get('IStorageService')
	const [value, setValue] = useState(() => service.getBoolean(key, StorageScope.PROFILE, defaultValue))
	const update = useCallback((next: boolean) => {
		service.store(key, next, StorageScope.PROFILE, 0)
		setValue(next)
	}, [service, key])
	return [value, update] as const
}

export const useOptOut = () => useStorageBoolean(OPT_OUT_KEY, false)

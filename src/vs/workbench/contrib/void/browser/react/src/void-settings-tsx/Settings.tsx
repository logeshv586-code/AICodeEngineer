/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'; // Added useRef import just in case it was missed, though likely already present
import { ProviderName, SettingName, displayInfoOfSettingName, providerNames, VoidStatefulModelInfo, customSettingNamesOfProvider, RefreshableProviderName, refreshableProviderNames, displayInfoOfProviderName, GlobalSettingName, featureNames, displayInfoOfFeatureName, isProviderNameDisabled, FeatureName, hasDownloadButtonsOnModelsProviderNames, subTextMdOfProviderName, ModelConnectionSettings, isModelConfigured } from '../../../../common/voidSettingsTypes.js'
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.tsx'
import { VoidButtonBgDarken, VoidCustomDropdownBox, VoidInputBox2, VoidSimpleInputBox, VoidSwitch } from '../util/inputs.tsx'
import { useAccessor, useIsDark, useIsOptedOut, useRefreshModelListener, useRefreshModelState, useSettingsState } from '../util/services.tsx'
import { X, RefreshCw, Loader2, Check, Asterisk, Plus } from 'lucide-react'
import { URI } from '../../../../../../../base/common/uri.js'
import { ModelDropdown } from './ModelDropdown.js'
import { ChatMarkdownRender } from '../markdown/ChatMarkdownRender.tsx'
import { WarningBox } from './WarningBox.js'
import { os } from '../../../../common/helpers/systemInfo.js'
import { IconLoading } from '../sidebar-tsx/SidebarChat.tsx'
import { ToolApprovalType, toolApprovalTypes } from '../../../../common/toolsServiceTypes.js'
import Severity from '../../../../../../../base/common/severity.js'
import { getModelCapabilities, modelOverrideKeys, ModelOverrides, defaultProviderSettings } from '../../../../common/modelCapabilities.js';
import { TransferEditorType, TransferFilesInfo } from '../../../extensionTransferTypes.js';
import { MCPConfigFileEntryJSON, MCPServer } from '../../../../common/mcpServiceTypes.js';
import { useMCPServiceState } from '../util/services.tsx';
import { OPT_OUT_KEY } from '../../../../common/storageKeys.js';
import { StorageScope, StorageTarget } from '../../../../../../../platform/storage/common/storage.js';
import { FORGE_CHANNEL_NAME } from '../../../../common/forge/contracts/forgeIPC.js';
import { COCOINDEX_AUTO_INDEX_STORAGE_KEY } from '../../../forge/semanticSearchService.js';

type Tab =
	| 'general'
	| 'account'
	| 'permissions'
	| 'appearance'
	| 'notifications'
	| 'models'
	| 'featureOptions'
	| 'customizations'
	| 'browser'
	| 'tab'
	| 'editor'
	| 'ws_workspace'
	| 'codeIndex'
	| 'mcp'
	;


const ButtonLeftTextRightOption = ({ text, leftButton }: { text: string, leftButton?: React.ReactNode }) => {

	return <div className='flex items-center text-void-fg-3 px-3 py-0.5 rounded-sm overflow-hidden gap-2'>
		{leftButton ? leftButton : null}
		<span>
			{text}
		</span>
	</div>
}

// models
const RefreshModelButton = ({ providerName }: { providerName: RefreshableProviderName }) => {

	const refreshModelState = useRefreshModelState()

	const accessor = useAccessor()
	const refreshModelService = accessor.get('IRefreshModelService')
	const metricsService = accessor.get('IMetricsService')

	const [justFinished, setJustFinished] = useState<null | 'finished' | 'error'>(null)

	useRefreshModelListener(
		useCallback((providerName2, refreshModelState) => {
			if (providerName2 !== providerName) return
			const { state } = refreshModelState[providerName]
			if (!(state === 'finished' || state === 'error')) return
			// now we know we just entered 'finished' state for this providerName
			setJustFinished(state)
			const tid = setTimeout(() => { setJustFinished(null) }, 2000)
			return () => clearTimeout(tid)
		}, [providerName])
	)

	const { state } = refreshModelState[providerName]

	const { title: providerTitle } = displayInfoOfProviderName(providerName)

	return <ButtonLeftTextRightOption

		leftButton={
			<button
				className='flex items-center'
				disabled={state === 'refreshing' || justFinished !== null}
				onClick={() => {
					refreshModelService.startRefreshingModels(providerName, { enableProviderOnSuccess: false, doNotFire: false })
					metricsService.capture('Click', { providerName, action: 'Refresh Models' })
				}}
			>
				{justFinished === 'finished' ? <Check className='stroke-green-500 size-3' />
					: justFinished === 'error' ? <X className='stroke-red-500 size-3' />
						: state === 'refreshing' ? <Loader2 className='size-3 animate-spin' />
							: <RefreshCw className='size-3' />}
			</button>
		}

		text={justFinished === 'finished' ? `${providerTitle} Models are up-to-date!`
			: justFinished === 'error' ? `${providerTitle} not found!`
				: `Manually refresh ${providerTitle} models.`}
	/>
}

const RefreshableModels = () => {
	const settingsState = useSettingsState()


	const buttons = refreshableProviderNames.map(providerName => {
		if (!settingsState.settingsOfProvider[providerName]._didFillInProviderSettings) return null
		return <RefreshModelButton key={providerName} providerName={providerName} />
	})

	return <>
		{buttons}
	</>

}



export const AnimatedCheckmarkButton = ({ text, className }: { text?: string, className?: string }) => {
	const [dashOffset, setDashOffset] = useState(40);

	useEffect(() => {
		const startTime = performance.now();
		const duration = 500; // 500ms animation

		const animate = (currentTime: number) => {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const newOffset = 40 - (progress * 40);

			setDashOffset(newOffset);

			if (progress < 1) {
				requestAnimationFrame(animate);
			}
		};

		const animationId = requestAnimationFrame(animate);
		return () => cancelAnimationFrame(animationId);
	}, []);

	return <div
		className={`flex items-center gap-1.5 w-fit
			${className ? className : `px-2 py-0.5 text-xs text-zinc-900 bg-zinc-100 rounded-sm`}
		`}
	>
		<svg className="size-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path
				d="M5 13l4 4L19 7"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				style={{
					strokeDasharray: 40,
					strokeDashoffset: dashOffset
				}}
			/>
		</svg>
		{text}
	</div>
}


const AddButton = ({ disabled, text = 'Add', ...props }: { disabled?: boolean, text?: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {

	return <button
		disabled={disabled}
		className={`bg-[#0e70c0] px-3 py-1 text-white rounded-sm ${!disabled ? 'hover:bg-[#1177cb] cursor-pointer' : 'opacity-50 cursor-not-allowed bg-opacity-70'}`}
		{...props}
	>{text}</button>

}

// ConfirmButton prompts for a second click to confirm an action, cancels if clicking outside
const ConfirmButton = ({ children, onConfirm, className }: { children: React.ReactNode, onConfirm: () => void, className?: string }) => {
	const [confirm, setConfirm] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!confirm) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setConfirm(false);
			}
		};
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	}, [confirm]);
	return (
		<div ref={ref} className={`inline-block`}>
			<VoidButtonBgDarken className={className} onClick={() => {
				if (!confirm) {
					setConfirm(true);
				} else {
					onConfirm();
					setConfirm(false);
				}
			}}>
				{confirm ? `Confirm Reset` : children}
			</VoidButtonBgDarken>
		</div>
	);
};

// ---------------- Simplified Model Settings Dialog ------------------

// keys of ModelOverrides we allow the user to override



// This new dialog replaces the verbose UI with a single JSON override box.
const SimpleModelSettingsDialogContent = ({
	isOpen,
	onClose,
	modelInfo,
}: {
	isOpen: boolean;
	onClose: () => void;
	modelInfo: { modelName: string; providerName: ProviderName; type: 'autodetected' | 'custom' | 'default' };
}) => {
	const { modelName, providerName, type } = modelInfo;
	const accessor = useAccessor()
	const settingsState = useSettingsState()
	const mouseDownInsideModal = useRef(false); // Ref to track mousedown origin
	const settingsStateService = accessor.get('IVoidSettingsService')

	// current overrides and defaults
	const defaultModelCapabilities = getModelCapabilities(providerName, modelName, undefined);
	const currentOverrides = settingsState.overridesOfModel?.[providerName]?.[modelName] ?? undefined;
	const { recognizedModelName, isUnrecognizedModel } = defaultModelCapabilities

	// Create the placeholder with the default values for allowed keys
	const partialDefaults: Partial<ModelOverrides> = {};
	for (const k of modelOverrideKeys) { if (defaultModelCapabilities[k]) partialDefaults[k] = defaultModelCapabilities[k] as any; }
	const placeholder = JSON.stringify(partialDefaults, null, 2);

	const [overrideEnabled, setOverrideEnabled] = useState<boolean>(() => !!currentOverrides);

	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [connectionSettings, setConnectionSettings] = useState<ModelConnectionSettings>({});

	const textAreaRef = useRef<HTMLTextAreaElement | null>(null)

	// reset when dialog toggles
	useEffect(() => {
		if (!isOpen) return;
		const cur = settingsState.overridesOfModel?.[providerName]?.[modelName];
		setOverrideEnabled(!!cur);
		setErrorMsg(null);
		const model = settingsState.settingsOfProvider[providerName].models.find(model => model.modelName === modelName);
		setConnectionSettings(model?.connectionSettings ?? {});
	}, [isOpen, providerName, modelName, settingsState.overridesOfModel, placeholder]);

	const onSave = async () => {
		const cleanedConnectionSettings: ModelConnectionSettings = {};
		for (const settingName of customSettingNamesOfProvider(providerName)) {
			const value = connectionSettings[settingName as keyof ModelConnectionSettings];
			if (value) cleanedConnectionSettings[settingName as keyof ModelConnectionSettings] = value;
		}
		await settingsStateService.setModelConnectionSettings(providerName, modelName, cleanedConnectionSettings);

		// if disabled override, reset overrides
		if (!overrideEnabled) {
			await settingsStateService.setOverridesOfModel(providerName, modelName, undefined);
			onClose();
			return;
		}

		// enabled overrides
		// parse json
		let parsedInput: Record<string, unknown>

		if (textAreaRef.current?.value) {
			try {
				parsedInput = JSON.parse(textAreaRef.current.value);
			} catch (e) {
				setErrorMsg('Invalid JSON');
				return;
			}
		} else {
			setErrorMsg('Invalid JSON');
			return;
		}

		// only keep allowed keys
		const cleaned: Partial<ModelOverrides> = {};
		for (const k of modelOverrideKeys) {
			if (!(k in parsedInput)) continue
			const isEmpty = parsedInput[k] === '' || parsedInput[k] === null || parsedInput[k] === undefined;
			if (!isEmpty) {
				cleaned[k] = parsedInput[k] as any;
			}
		}
		await settingsStateService.setOverridesOfModel(providerName, modelName, cleaned);
		onClose();
	};

	const sourcecodeOverridesLink = `https://github.com/voideditor/void/blob/2e5ecb291d33afbe4565921664fb7e183189c1c5/src/vs/workbench/contrib/void/common/modelCapabilities.ts#L146-L172`

	return (
		<div // Backdrop
			className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999999]"
			onMouseDown={() => {
				mouseDownInsideModal.current = false;
			}}
			onMouseUp={() => {
				if (!mouseDownInsideModal.current) {
					onClose();
				}
				mouseDownInsideModal.current = false;
			}}
		>
			{/* MODAL */}
			<div
				className="bg-void-bg-1 rounded-md p-4 max-w-xl w-full shadow-xl overflow-y-auto max-h-[90vh]"
				onClick={(e) => e.stopPropagation()} // Keep stopping propagation for normal clicks inside
				onMouseDown={(e) => {
					mouseDownInsideModal.current = true;
					e.stopPropagation();
				}}
			>
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-lg font-medium">
						Change Defaults for {modelName} ({displayInfoOfProviderName(providerName).title})
					</h3>
					<button
						onClick={onClose}
						className="text-void-fg-3 hover:text-void-fg-1"
					>
						<X className="size-5" />
					</button>
				</div>

				{/* Display model recognition status */}
				<div className="text-sm text-void-fg-3 mb-4">
					{type === 'default' ? `${modelName} comes packaged with Forge AI, so you shouldn't need to change these settings.`
						: isUnrecognizedModel
							? `Model not recognized by Forge AI.`
							: `Forge AI recognizes ${modelName} ("${recognizedModelName}").`}
				</div>

				<div className="border border-void-border-2 rounded-md p-3 mb-4">
					<div className="text-sm font-medium mb-2">Connection for this model</div>
					<div className="text-xs text-void-fg-3 mb-2">These values override the provider defaults, so one provider can use multiple API keys or endpoints.</div>
					{customSettingNamesOfProvider(providerName).map(settingName => {
						const info = displayInfoOfSettingName(providerName, settingName);
						const value = connectionSettings[settingName as keyof ModelConnectionSettings] ?? '';
						return <VoidSimpleInputBox
							key={settingName}
							value={value}
							onChangeValue={(newValue) => setConnectionSettings(current => ({ ...current, [settingName]: newValue }))}
							placeholder={`${info.title} (provider default)`}
							passwordBlur={info.isPasswordField}
							compact={true}
						/>;
					})}
				</div>


				{/* override toggle */}
				<div className="flex items-center gap-2 mb-4">
					<VoidSwitch size='xs' value={overrideEnabled} onChange={setOverrideEnabled} />
					<span className="text-void-fg-3 text-sm">Override model defaults</span>
				</div>

				{/* Informational link */}
				{overrideEnabled && <div className="text-sm text-void-fg-3 mb-4">
					<ChatMarkdownRender string={`See the [sourcecode](${sourcecodeOverridesLink}) for a reference on how to set this JSON (advanced).`} chatMessageLocation={undefined} />
				</div>}

				<textarea
					key={overrideEnabled + ''}
					ref={textAreaRef}
					className={`w-full min-h-[200px] p-2 rounded-sm border border-void-border-2 bg-void-bg-2 resize-none font-mono text-sm ${!overrideEnabled ? 'text-void-fg-3' : ''}`}
					defaultValue={overrideEnabled && currentOverrides ? JSON.stringify(currentOverrides, null, 2) : placeholder}
					placeholder={placeholder}
					readOnly={!overrideEnabled}
				/>
				{errorMsg && (
					<div className="text-red-500 mt-2 text-sm">{errorMsg}</div>
				)}


				<div className="flex justify-end gap-2 mt-4">
					<VoidButtonBgDarken onClick={onClose} className="px-3 py-1">
						Cancel
					</VoidButtonBgDarken>
					<VoidButtonBgDarken
						onClick={onSave}
						className="px-3 py-1 bg-[#0e70c0] text-white"
					>
						Save
					</VoidButtonBgDarken>
				</div>
			</div>
		</div>
	);
};

const SimpleModelSettingsDialog = (props: {
	isOpen: boolean;
	onClose: () => void;
	modelInfo: { modelName: string; providerName: ProviderName; type: 'autodetected' | 'custom' | 'default' } | null;
}) => props.isOpen && props.modelInfo
	? <SimpleModelSettingsDialogContent isOpen={props.isOpen} onClose={props.onClose} modelInfo={props.modelInfo} />
	: null;




export const ModelDump = ({ filteredProviders }: { filteredProviders?: ProviderName[] }) => {
	const accessor = useAccessor()
	const settingsStateService = accessor.get('IVoidSettingsService')
	const llmMessageService = accessor.get('ILLMMessageService')
	const settingsState = useSettingsState()

	// State to track which model's settings dialog is open
	const [openSettingsModel, setOpenSettingsModel] = useState<{
		modelName: string,
		providerName: ProviderName,
		type: 'autodetected' | 'custom' | 'default'
	} | null>(null);

	// States for add model functionality
	const [isAddModelOpen, setIsAddModelOpen] = useState(false);
	const [showCheckmark, setShowCheckmark] = useState(false);
	const [userChosenProviderName, setUserChosenProviderName] = useState<ProviderName | null>(null);
	const [modelName, setModelName] = useState<string>('');
	const [newModelConnectionSettings, setNewModelConnectionSettings] = useState<ModelConnectionSettings>({});
	const [errorString, setErrorString] = useState('');
	const [isTestingConnection, setIsTestingConnection] = useState(false);
	const [connectionTestPassed, setConnectionTestPassed] = useState(false);
	const addModelRef = useRef<HTMLDivElement>(null);
	const requiredConnectionSettings = userChosenProviderName
		? (Object.keys(defaultProviderSettings[userChosenProviderName]) as string[]).filter(name => !defaultProviderSettings[userChosenProviderName][name as keyof typeof defaultProviderSettings[typeof userChosenProviderName]])
		: [];

	useEffect(() => {
		if (isAddModelOpen) addModelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}, [isAddModelOpen]);

	// a dump of all the enabled providers' models
	const modelDump: (VoidStatefulModelInfo & { providerName: ProviderName, providerEnabled: boolean })[] = []

	// Use either filtered providers or all providers
	const providersToShow = filteredProviders || providerNames;

	for (let providerName of providersToShow) {
		const providerSettings = settingsState.settingsOfProvider[providerName]
		// if (!providerSettings.enabled) continue
		modelDump.push(...providerSettings.models.map(model => ({ ...model, providerName, providerEnabled: !!providerSettings._didFillInProviderSettings })))
	}

	// sort by hidden
	modelDump.sort((a, b) => {
		return Number(b.providerEnabled) - Number(a.providerEnabled)
	})

	// Add model handler
	const handleAddModel = () => {
		if (!userChosenProviderName) {
			setErrorString('Please select a provider.');
			return;
		}
		if (!modelName) {
			setErrorString('Please enter a model name.');
			return;
		}
		const missingSetting = requiredConnectionSettings.find(name => !newModelConnectionSettings[name as keyof ModelConnectionSettings]?.trim());
		if (missingSetting) {
			setErrorString(`${displayInfoOfSettingName(userChosenProviderName, missingSetting as any).title} is required.`);
			return;
		}
		if (!connectionTestPassed) {
			setErrorString('Test the API connection successfully before adding this model.');
			return;
		}

		// Check if model already exists
		if (settingsState.settingsOfProvider[userChosenProviderName].models.find(m => m.modelName === modelName)) {
			setErrorString(`This model already exists.`);
			return;
		}

		settingsStateService.addModel(userChosenProviderName, modelName, newModelConnectionSettings);
		setShowCheckmark(true);
		setTimeout(() => {
			setShowCheckmark(false);
			setIsAddModelOpen(false);
			setUserChosenProviderName(null);
			setModelName('');
			setNewModelConnectionSettings({});
		}, 1500);
		setErrorString('');
	};

	const handleTestConnection = async () => {
		if (!userChosenProviderName || !modelName.trim()) {
			setErrorString('Select a provider and enter a model name first.');
			return;
		}
		const missingSetting = requiredConnectionSettings.find(name => !newModelConnectionSettings[name as keyof ModelConnectionSettings]?.trim());
		if (missingSetting) {
			setErrorString(`${displayInfoOfSettingName(userChosenProviderName, missingSetting as any).title} is required.`);
			return;
		}
		setIsTestingConnection(true);
		setConnectionTestPassed(false);
		setErrorString('');
		try {
			const result = await llmMessageService.testConnection({ providerName: userChosenProviderName, modelName: modelName.trim(), connectionSettings: newModelConnectionSettings as Record<string, string> });
			if (result.ok) setConnectionTestPassed(true);
			else setErrorString(result.error ?? 'The API connection failed.');
		} catch (error) {
			setErrorString(error instanceof Error ? error.message : String(error));
		} finally {
			setIsTestingConnection(false);
		}
	};

	return <div className=''>
		<div className="flex items-center justify-between mb-4 p-3 rounded-md border border-void-border-2 bg-void-bg-2/40">
			<div>
				<div className="text-sm font-medium text-void-fg-1">Add a model and API connection</div>
				<div className="text-xs text-void-fg-3">Choose a provider, model name, and its API key or endpoint.</div>
			</div>
			{!isAddModelOpen && <button type="button" onClick={() => setIsAddModelOpen(true)} className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#0e70c0] text-white text-xs hover:brightness-110">
				<Plus size={14} /> Add model
			</button>}
		</div>
		{modelDump.map((m, i) => {
			const { isHidden, type, modelName, providerName, providerEnabled } = m

			const isNewProviderName = (i > 0 ? modelDump[i - 1] : undefined)?.providerName !== providerName

			const providerTitle = displayInfoOfProviderName(providerName).title

			const disabled = !isModelConfigured(providerName, m, settingsState.settingsOfProvider)
			const value = disabled ? false : !isHidden

			const tooltipName = (
				disabled ? `Add ${providerTitle} to enable`
					: value === true ? 'Show in Dropdown'
						: 'Hide from Dropdown'
			)


			const detailAboutModel = type === 'autodetected' ?
				<Asterisk size={14} className="inline-block align-text-top brightness-115 stroke-[2] text-[#0e70c0]" data-tooltip-id='void-tooltip' data-tooltip-place='right' data-tooltip-content='Detected locally' />
				: type === 'custom' ?
					<Asterisk size={14} className="inline-block align-text-top brightness-115 stroke-[2] text-[#0e70c0]" data-tooltip-id='void-tooltip' data-tooltip-place='right' data-tooltip-content='Custom model' />
					: undefined

			const hasOverrides = !!settingsState.overridesOfModel?.[providerName]?.[modelName]

			return <div key={`${modelName}${providerName}`}
				className={`flex items-center justify-between gap-4 hover:bg-black/10 dark:hover:bg-gray-300/10 py-1 px-3 rounded-sm overflow-hidden cursor-default truncate group
				`}
			>
				{/* left part is width:full */}
				<div className={`flex flex-grow items-center gap-4`}>
					<span className='w-full max-w-32'>{isNewProviderName ? providerTitle : ''}</span>
					<span className='w-fit max-w-[400px] truncate'>{modelName}</span>
				</div>

				{/* right part is anything that fits */}
				<div className="flex items-center gap-2 w-fit">

					{/* Advanced Settings button (gear). Hide entirely when provider/model disabled. */}
					{disabled ? null : (
						<div className="w-5 flex items-center justify-center">
							<button
								onClick={() => { setOpenSettingsModel({ modelName, providerName, type }) }}
								data-tooltip-id='void-tooltip'
								data-tooltip-place='right'
								data-tooltip-content='Advanced Settings'
								className={`${hasOverrides ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
							>
								<Plus size={12} className="text-void-fg-3 opacity-50" />
							</button>
						</div>
					)}

					{/* Blue star */}
					{detailAboutModel}


					{/* Switch */}
					<VoidSwitch
						value={value}
						onChange={() => { settingsStateService.toggleModelHidden(providerName, modelName); }}
						disabled={disabled}
						size='sm'

						data-tooltip-id='void-tooltip'
						data-tooltip-place='right'
						data-tooltip-content={tooltipName}
					/>

					{/* X button */}
					<div className={`w-5 flex items-center justify-center`}>
						{type === 'default' || type === 'autodetected' ? null : <button
							onClick={() => { settingsStateService.deleteModel(providerName, modelName); }}
							data-tooltip-id='void-tooltip'
							data-tooltip-place='right'
							data-tooltip-content='Delete'
							className={`${hasOverrides ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
						>
							<X size={12} className="text-void-fg-3 opacity-50" />
						</button>}
					</div>
				</div>
			</div>
		})}

		{/* Add Model Section */}
		{showCheckmark ? (
			<div className="mt-4">
				<AnimatedCheckmarkButton text='Added' className="bg-[#0e70c0] text-white px-3 py-1 rounded-sm" />
			</div>
		) : isAddModelOpen ? (
			<div ref={addModelRef} className="mt-4">
				<form className="flex items-center gap-2">

					{/* Provider dropdown */}
					<ErrorBoundary>
						<VoidCustomDropdownBox
							options={providersToShow}
							selectedOption={userChosenProviderName}
							onChangeOption={(pn) => { setUserChosenProviderName(pn); setNewModelConnectionSettings({}); setConnectionTestPassed(false); setErrorString(''); }}
							getOptionDisplayName={(pn) => pn ? displayInfoOfProviderName(pn).title : 'Provider Name'}
							getOptionDropdownName={(pn) => pn ? displayInfoOfProviderName(pn).title : 'Provider Name'}
							getOptionsEqual={(a, b) => a === b}
							className="max-w-32 mx-2 w-full resize-none bg-void-bg-1 text-void-fg-1 placeholder:text-void-fg-3 border border-void-border-2 focus:border-void-border-1 py-1 px-2 rounded"
							arrowTouchesText={false}
						/>
					</ErrorBoundary>

					{/* Model name input */}
					<ErrorBoundary>
						<VoidSimpleInputBox
							value={modelName}
							compact={true}
							onChangeValue={(value) => { setModelName(value); setConnectionTestPassed(false); }}
							placeholder='Model Name'
							className='max-w-32'
						/>
					</ErrorBoundary>

					{userChosenProviderName && customSettingNamesOfProvider(userChosenProviderName).map(settingName => {
						const info = displayInfoOfSettingName(userChosenProviderName, settingName);
						return <VoidSimpleInputBox
							key={settingName}
							value={newModelConnectionSettings[settingName as keyof ModelConnectionSettings] ?? ''}
							onChangeValue={(newValue) => { setNewModelConnectionSettings(current => ({ ...current, [settingName]: newValue })); setConnectionTestPassed(false); }}
							placeholder={`${info.title}${requiredConnectionSettings.includes(settingName) ? ' (required)' : ' (optional)'}`}
							passwordBlur={info.isPasswordField}
							compact={true}
							className='max-w-40'
						/>;
					})}

					<button type='button' onClick={handleTestConnection} disabled={isTestingConnection || !modelName || !userChosenProviderName} className='px-2 py-1 rounded bg-void-bg-2 border border-void-border-2 text-xs text-void-fg-1 disabled:opacity-50'>
						{isTestingConnection ? 'Testing…' : connectionTestPassed ? 'API works' : 'Test API'}
					</button>

					{/* Add button */}
					<ErrorBoundary>
						<AddButton
							type='button'
						disabled={!modelName || !userChosenProviderName || !connectionTestPassed}
							onClick={handleAddModel}
						/>
					</ErrorBoundary>

					{/* X button to cancel */}
					<button
						type="button"
						onClick={() => {
							setIsAddModelOpen(false);
							setErrorString('');
							setModelName('');
							setUserChosenProviderName(null);
							setNewModelConnectionSettings({});
						}}
						className='text-void-fg-4'
					>
						<X className='size-4' />
					</button>
				</form>

				{errorString && (
					<div className='text-red-500 truncate whitespace-nowrap mt-1'>
						{errorString}
					</div>
				)}
			</div>
		) : (
			<div
				className="text-void-fg-4 flex flex-nowrap text-nowrap items-center hover:brightness-110 cursor-pointer mt-4"
				onClick={() => setIsAddModelOpen(true)}
			>
				<div className="flex items-center gap-1">
					<Plus size={16} />
					<span>Add a model</span>
				</div>
			</div>
		)}

		{/* Model Settings Dialog */}
		<SimpleModelSettingsDialog
			isOpen={openSettingsModel !== null}
			onClose={() => setOpenSettingsModel(null)}
			modelInfo={openSettingsModel}
		/>
	</div>
}



// providers

const ProviderSetting = ({ providerName, settingName, subTextMd }: { providerName: ProviderName, settingName: SettingName, subTextMd: React.ReactNode }) => {

	const { title: settingTitle, placeholder, isPasswordField } = displayInfoOfSettingName(providerName, settingName)

	const accessor = useAccessor()
	const voidSettingsService = accessor.get('IVoidSettingsService')
	const settingsState = useSettingsState()

	const settingValue = settingsState.settingsOfProvider[providerName][settingName] as string // this should always be a string in this component
	if (typeof settingValue !== 'string') {
		console.log('Error: Provider setting had a non-string value.')
		return
	}

	// Create a stable callback reference using useCallback with proper dependencies
	const handleChangeValue = useCallback((newVal: string) => {
		voidSettingsService.setSettingOfProvider(providerName, settingName, newVal)
	}, [voidSettingsService, providerName, settingName]);

	return <ErrorBoundary>
		<div className='my-1'>
			<VoidSimpleInputBox
				value={settingValue}
				onChangeValue={handleChangeValue}
				placeholder={`${settingTitle} (${placeholder})`}
				passwordBlur={isPasswordField}
				compact={true}
			/>
			{!subTextMd ? null : <div className='py-1 px-3 opacity-50 text-sm'>
				{subTextMd}
			</div>}
		</div>
					</ErrorBoundary>

}

// const OldSettingsForProvider = ({ providerName, showProviderTitle }: { providerName: ProviderName, showProviderTitle: boolean }) => {
// 	const voidSettingsState = useSettingsState()

// 	const needsModel = isProviderNameDisabled(providerName, voidSettingsState) === 'addModel'

// 	// const accessor = useAccessor()
// 	// const voidSettingsService = accessor.get('IVoidSettingsService')

// 	// const { enabled } = voidSettingsState.settingsOfProvider[providerName]
// 	const settingNames = customSettingNamesOfProvider(providerName)

// 	const { title: providerTitle } = displayInfoOfProviderName(providerName)

// 	return <div className='my-4'>

// 		<div className='flex items-center w-full gap-4'>
// 			{showProviderTitle && <h3 className='text-xl truncate'>{providerTitle}</h3>}

// 			{/* enable provider switch */}
// 			{/* <VoidSwitch
// 				value={!!enabled}
// 				onChange={
// 					useCallback(() => {
// 						const enabledRef = voidSettingsService.state.settingsOfProvider[providerName].enabled
// 						voidSettingsService.setSettingOfProvider(providerName, 'enabled', !enabledRef)
// 					}, [voidSettingsService, providerName])}
// 				size='sm+'
// 			/> */}
// 		</div>

// 		<div className='px-0'>
// 			{/* settings besides models (e.g. api key) */}
// 			{settingNames.map((settingName, i) => {
// 				return <ProviderSetting key={settingName} providerName={providerName} settingName={settingName} />
// 			})}

// 			{needsModel ?
// 				providerName === 'ollama' ?
// 					<WarningBox text={`Please install an Ollama model. We'll auto-detect it.`} />
// 					: <WarningBox text={`Please add a model for ${providerTitle} (Models section).`} />
// 				: null}
// 		</div>
// 	</div >
// }


export const SettingsForProvider = ({ providerName, showProviderTitle, showProviderSuggestions }: { providerName: ProviderName, showProviderTitle: boolean, showProviderSuggestions: boolean }) => {
	const voidSettingsState = useSettingsState()

	const needsModel = isProviderNameDisabled(providerName, voidSettingsState) === 'addModel'

	// const accessor = useAccessor()
	// const voidSettingsService = accessor.get('IVoidSettingsService')

	// const { enabled } = voidSettingsState.settingsOfProvider[providerName]
	const settingNames = customSettingNamesOfProvider(providerName)

	const { title: providerTitle } = displayInfoOfProviderName(providerName)

	return <div>

		<div className='flex items-center w-full gap-4'>
			{showProviderTitle && <h3 className='text-xl truncate'>{providerTitle}</h3>}

			{/* enable provider switch */}
			{/* <VoidSwitch
				value={!!enabled}
				onChange={
					useCallback(() => {
						const enabledRef = voidSettingsService.state.settingsOfProvider[providerName].enabled
						voidSettingsService.setSettingOfProvider(providerName, 'enabled', !enabledRef)
					}, [voidSettingsService, providerName])}
				size='sm+'
			/> */}
		</div>

		<div className='px-0'>
			{/* settings besides models (e.g. api key) */}
			{settingNames.map((settingName, i) => {

				return <ProviderSetting
					key={settingName}
					providerName={providerName}
					settingName={settingName}
					subTextMd={i !== settingNames.length - 1 ? null
						: <ChatMarkdownRender string={subTextMdOfProviderName(providerName)} chatMessageLocation={undefined} />}
				/>
			})}

			{showProviderSuggestions && needsModel ?
				providerName === 'ollama' ?
					<WarningBox className="pl-2 mb-4" text={`Please install an Ollama model. We'll auto-detect it.`} />
					: <WarningBox className="pl-2 mb-4" text={`Please add a model for ${providerTitle} (Models section).`} />
				: null}
		</div>
	</div >
}


export const VoidProviderSettings = ({ providerNames }: { providerNames: ProviderName[] }) => {
	return <>
		{providerNames.map(providerName =>
			<SettingsForProvider key={providerName} providerName={providerName} showProviderTitle={true} showProviderSuggestions={true} />
		)}
	</>
}


type TabName = 'models' | 'general'
export const AutoDetectLocalModelsToggle = () => {
	const settingName: GlobalSettingName = 'autoRefreshModels'

	const accessor = useAccessor()
	const voidSettingsService = accessor.get('IVoidSettingsService')
	const metricsService = accessor.get('IMetricsService')

	const voidSettingsState = useSettingsState()

	// right now this is just `enabled_autoRefreshModels`
	const enabled = voidSettingsState.globalSettings[settingName]

	return <ButtonLeftTextRightOption
		leftButton={<VoidSwitch
			size='xxs'
			value={enabled}
			onChange={(newVal) => {
				voidSettingsService.setGlobalSetting(settingName, newVal)
				metricsService.capture('Click', { action: 'Autorefresh Toggle', settingName, enabled: newVal })
			}}
		/>}
		text={`Automatically detect local providers and models (${refreshableProviderNames.map(providerName => displayInfoOfProviderName(providerName).title).join(', ')}).`}
	/>


}

export const AIInstructionsBox = () => {
	const accessor = useAccessor()
	const voidSettingsService = accessor.get('IVoidSettingsService')
	const voidSettingsState = useSettingsState()
	return <VoidInputBox2
		className='min-h-[81px] p-3 rounded-sm'
		initValue={voidSettingsState.globalSettings.aiInstructions}
		placeholder={`Do not change my indentation or delete my comments. When writing TS or JS, do not add ;'s. Write new code using Rust if possible. `}
		multiline
		onChangeText={(newText) => {
			voidSettingsService.setGlobalSetting('aiInstructions', newText)
		}}
	/>
}

const FastApplyMethodDropdown = () => {
	const accessor = useAccessor()
	const voidSettingsService = accessor.get('IVoidSettingsService')

	const options = useMemo(() => [true, false], [])

	const onChangeOption = useCallback((newVal: boolean) => {
		voidSettingsService.setGlobalSetting('enableFastApply', newVal)
	}, [voidSettingsService])

	return <VoidCustomDropdownBox
		className='text-xs text-void-fg-3 bg-void-bg-1 border border-void-border-1 rounded p-0.5 px-1'
		options={options}
		selectedOption={voidSettingsService.state.globalSettings.enableFastApply}
		onChangeOption={onChangeOption}
		getOptionDisplayName={(val) => val ? 'Fast Apply' : 'Slow Apply'}
		getOptionDropdownName={(val) => val ? 'Fast Apply' : 'Slow Apply'}
		getOptionDropdownDetail={(val) => val ? 'Output Search/Replace blocks' : 'Rewrite whole files'}
		getOptionsEqual={(a, b) => a === b}
	/>

}


export const OllamaSetupInstructions = ({ sayWeAutoDetect }: { sayWeAutoDetect?: boolean }) => {
	return <div className='prose-p:my-0 prose-ol:list-decimal prose-p:py-0 prose-ol:my-0 prose-ol:py-0 prose-span:my-0 prose-span:py-0 text-void-fg-3 text-sm list-decimal select-text'>
		<div className=''><ChatMarkdownRender string={`Ollama Setup Instructions`} chatMessageLocation={undefined} /></div>
		<div className=' pl-6'><ChatMarkdownRender string={`1. Download [Ollama](https://ollama.com/download).`} chatMessageLocation={undefined} /></div>
		<div className=' pl-6'><ChatMarkdownRender string={`2. Open your terminal.`} chatMessageLocation={undefined} /></div>
		<div
			className='pl-6 flex items-center w-fit'
			data-tooltip-id='void-tooltip-ollama-settings'
		>
			<ChatMarkdownRender string={`3. Run \`ollama pull your_model\` to install a model.`} chatMessageLocation={undefined} />
		</div>
		{sayWeAutoDetect && <div className=' pl-6'><ChatMarkdownRender string={`Forge AI automatically detects locally running models and enables them.`} chatMessageLocation={undefined} /></div>}
	</div>
}


const RedoOnboardingButton = ({ className }: { className?: string }) => {
	const accessor = useAccessor()
	const voidSettingsService = accessor.get('IVoidSettingsService')
	return <div
		className={`text-void-fg-4 flex flex-nowrap text-nowrap items-center hover:brightness-110 cursor-pointer ${className}`}
		onClick={() => { voidSettingsService.setGlobalSetting('isOnboardingComplete', false) }}
	>
		See onboarding screen?
	</div>

}







export const ToolApprovalTypeSwitch = ({ approvalType, size, desc }: { approvalType: ToolApprovalType, size: "xxs" | "xs" | "sm" | "sm+" | "md", desc: string }) => {
	const accessor = useAccessor()
	const voidSettingsService = accessor.get('IVoidSettingsService')
	const voidSettingsState = useSettingsState()
	const metricsService = accessor.get('IMetricsService')

	const onToggleAutoApprove = useCallback((approvalType: ToolApprovalType, newValue: boolean) => {
		voidSettingsService.setGlobalSetting('autoApprove', {
			...voidSettingsService.state.globalSettings.autoApprove,
			[approvalType]: newValue
		})
		metricsService.capture('Tool Auto-Accept Toggle', { enabled: newValue })
	}, [voidSettingsService, metricsService])

	return <>
		<VoidSwitch
			size={size}
			value={voidSettingsState.globalSettings.autoApprove[approvalType] ?? false}
			onChange={(newVal) => onToggleAutoApprove(approvalType, newVal)}
		/>
		<span className="text-void-fg-3 text-xs">{desc}</span>
	</>
}



export const OneClickSwitchButton = ({ fromEditor = 'VS Code', className = '' }: { fromEditor?: TransferEditorType, className?: string }) => {
	const accessor = useAccessor()
	const extensionTransferService = accessor.get('IExtensionTransferService')

	const [transferState, setTransferState] = useState<{ type: 'done', error?: string } | { type: | 'loading' | 'justfinished' }>({ type: 'done' })



	const onClick = async () => {
		if (transferState.type !== 'done') return

		setTransferState({ type: 'loading' })

		const errAcc = await extensionTransferService.transferExtensions(os, fromEditor)

		// Even if some files were missing, consider it a success if no actual errors occurred
		const hadError = !!errAcc
		if (hadError) {
			setTransferState({ type: 'done', error: errAcc })
		}
		else {
			setTransferState({ type: 'justfinished' })
			setTimeout(() => { setTransferState({ type: 'done' }); }, 3000)
		}
	}

	return <>
		<VoidButtonBgDarken className={`max-w-48 p-4 ${className}`} disabled={transferState.type !== 'done'} onClick={onClick}>
			{transferState.type === 'done' ? `Transfer from ${fromEditor}`
				: transferState.type === 'loading' ? <span className='text-nowrap flex flex-nowrap'>Transferring<IconLoading /></span>
					: transferState.type === 'justfinished' ? <AnimatedCheckmarkButton text='Settings Transferred' className='bg-none' />
						: null
			}
		</VoidButtonBgDarken>
		{transferState.type === 'done' && transferState.error ? <WarningBox text={transferState.error} /> : null}
	</>
}


// full settings

// MCP Server component
const MCPServerComponent = ({ name, server }: { name: string, server: MCPServer }) => {
	const accessor = useAccessor();
	const mcpService = accessor.get('IMCPService');

	const voidSettings = useSettingsState()
	const isOn = voidSettings.mcpUserStateOfName[name]?.isOn

	const removeUniquePrefix = (name: string) => name.split('_').slice(1).join('_')

	return (
		<div className="border border-void-border-2 bg-void-bg-1 py-3 px-4 rounded-sm my-2">
			<div className="flex items-center justify-between">
				{/* Left side - status and name */}
				<div className="flex items-center gap-2">
					{/* Status indicator */}
					<div className={`w-2 h-2 rounded-full
						${server.status === 'success' ? 'bg-green-500'
							: server.status === 'error' ? 'bg-red-500'
								: server.status === 'loading' ? 'bg-yellow-500'
									: server.status === 'offline' ? 'bg-void-fg-3'
										: ''}
					`}></div>

					{/* Server name */}
					<div className="text-sm font-medium text-void-fg-1">{name}</div>
				</div>

				{/* Right side - power toggle switch */}
				<VoidSwitch
					value={isOn ?? false}
					size='xs'
					onChange={() => mcpService.toggleServerIsOn(name, !isOn)}
				/>
			</div>

			{/* Tools section */}
			{isOn && (
				<div className="mt-3">
					<div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
						{(server.tools ?? []).length > 0 ? (
							(server.tools ?? []).map((tool: { name: string; description?: string }) => (
								<span
									key={tool.name}
									className="px-2 py-0.5 bg-void-bg-2 text-void-fg-3 rounded-sm text-xs"

									data-tooltip-id='void-tooltip'
									data-tooltip-content={tool.description || ''}
									data-tooltip-class-name='void-max-w-[300px]'
								>
									{removeUniquePrefix(tool.name)}
								</span>
							))
						) : (
							<span className="text-xs text-void-fg-3">No tools available</span>
						)}
					</div>
				</div>
			)}

			{/* Command badge */}
			{isOn && server.command && (
				<div className="mt-3">
					<div className="text-xs text-void-fg-3 mb-1">Command:</div>
					<div className="px-2 py-1 bg-void-bg-2 text-xs font-mono overflow-x-auto whitespace-nowrap text-void-fg-2 rounded-sm">
						{server.command}
					</div>
				</div>
			)}

			{/* Error message if present */}
			{server.error && (
				<div className="mt-3">
					<WarningBox text={server.error} />
				</div>
			)}

			<div className='mt-3 flex flex-wrap gap-2'>
				{server.status === 'error' && <VoidButtonBgDarken className='px-3 py-1' onClick={() => { void mcpService.retryServer(name) }}>
					Retry
				</VoidButtonBgDarken>}
				<VoidButtonBgDarken className='px-3 py-1' onClick={() => { void mcpService.revealMCPConfigFile() }}>
					Edit configuration
				</VoidButtonBgDarken>
				<VoidButtonBgDarken className='px-3 py-1 text-red-400' onClick={() => {
					if (window.confirm(`Remove MCP server "${name}"?`)) void mcpService.removeServer(name)
				}}>
					Remove
				</VoidButtonBgDarken>
			</div>
		</div>
	);
};

const splitCommandArguments = (value: string): string[] => {
	const args: string[] = []
	for (const match of value.matchAll(/"([^"]*)"|'([^']*)'|([^\s]+)/g)) args.push(match[1] ?? match[2] ?? match[3])
	return args
}

const parseRecordJSON = (label: string, value: string): Record<string, string> | undefined => {
	if (!value.trim()) return undefined
	const parsed = JSON.parse(value)
	if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(`${label} must be a JSON object.`)
	return Object.fromEntries(Object.entries(parsed).map(([key, item]) => [key, String(item)]))
}

type CocoIndexUIStatus = {
	installed: boolean;
	initialized: boolean;
	runtimePath?: string;
	embeddingProvider?: string;
	embeddingModel?: string;
	sentenceTransformersAvailable: boolean;
	eligible: boolean;
	disabled: boolean;
	isIndexing: boolean;
	error?: string;
};
type CocoIndexUIStats = { totalFiles: number; totalChunks: number; lastIndexedAt: number; error?: string };

const CocoIndexLocalPanel = () => {
	const accessor = useAccessor();
	const mainProcessService = accessor.get('IMainProcessService');
	const workspaceContextService = accessor.get('IWorkspaceContextService');
	const storageService = accessor.get('IStorageService');
	const workspaceRoot = workspaceContextService.getWorkspace().folders[0]?.uri.fsPath ?? '';
	const channel = useMemo(() => mainProcessService.getChannel(FORGE_CHANNEL_NAME), [mainProcessService]);
	const [status, setStatus] = useState<CocoIndexUIStatus | null>(null);
	const [stats, setStats] = useState<CocoIndexUIStats | null>(null);
	const [busy, setBusy] = useState<'install' | 'enable' | 'refresh' | 'rebuild' | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [autoIndex, setAutoIndex] = useState(() => storageService.getBoolean(COCOINDEX_AUTO_INDEX_STORAGE_KEY, StorageScope.APPLICATION, true));

	const refreshStatus = useCallback(async () => {
		const nextStatus = await channel.call<CocoIndexUIStatus>('getCocoIndexStatus', { workspacePath: workspaceRoot });
		setStatus(nextStatus);
		setStats(workspaceRoot && nextStatus.initialized
			? await channel.call<CocoIndexUIStats>('getIndexStats', { workspacePath: workspaceRoot })
			: null);
	}, [channel, workspaceRoot]);

	useEffect(() => {
		void refreshStatus();
		const interval = setInterval(() => { void refreshStatus(); }, status?.isIndexing ? 1500 : 5000);
		return () => clearInterval(interval);
	}, [refreshStatus, status?.isIndexing]);

	const installRuntime = async () => {
		setBusy('install');
		setError(null);
		try {
			await channel.call('installCocoIndex');
			if (autoIndex && workspaceRoot) await channel.call('autoPrepareCocoIndexWorkspace', { workspacePath: workspaceRoot });
			await refreshStatus();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(null);
		}
	};

	const setAutomaticIndexing = async (enabled: boolean) => {
		setAutoIndex(enabled);
		storageService.store(COCOINDEX_AUTO_INDEX_STORAGE_KEY, enabled, StorageScope.APPLICATION, StorageTarget.MACHINE);
		try {
			if (enabled && workspaceRoot) {
				await channel.call('autoPrepareCocoIndexWorkspace', { workspacePath: workspaceRoot });
				await refreshStatus();
			}
		} catch (err) { setError(err instanceof Error ? err.message : String(err)); }
	};

	const disableProject = async () => {
		if (!workspaceRoot) return;
		setError(null);
		try {
			await channel.call('disableCocoIndexProject', { workspacePath: workspaceRoot });
			await refreshStatus();
		} catch (err) { setError(err instanceof Error ? err.message : String(err)); }
	};

	const enableProject = async () => {
		if (!workspaceRoot) return;
		setBusy('enable');
		setError(null);
		try {
			await channel.call('initializeCocoIndexProject', { workspacePath: workspaceRoot });
			await channel.call('indexWorkspace', { workspacePath: workspaceRoot });
			await refreshStatus();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(null);
		}
	};

	const updateIndex = async (rebuild: boolean) => {
		if (!workspaceRoot) return;
		setBusy(rebuild ? 'rebuild' : 'refresh');
		setError(null);
		try {
			await channel.call(rebuild ? 'rebuildCocoIndexWorkspace' : 'indexWorkspace', { workspacePath: workspaceRoot });
			await refreshStatus();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(null);
		}
	};

	const lastRefresh = !stats?.lastIndexedAt ? 'Not indexed yet' : new Date(stats.lastIndexedAt).toLocaleString();

	return <div className='my-3 rounded-sm border border-void-border-2 bg-void-bg-1 p-4'>
		<div className='flex flex-wrap items-center justify-between gap-3'>
			<div>
				<div className='text-sm font-medium text-void-fg-1'>Local CocoIndex code search</div>
				<div className='mt-1 text-xs text-void-fg-3'>Project-scoped, incremental semantic index. It does not use MCP and stops its local daemon after inactivity.</div>
			</div>
			<div className={`text-xs ${status?.isIndexing ? 'text-yellow-500' : status?.initialized && !status.disabled ? 'text-green-500' : status?.installed ? 'text-yellow-500' : 'text-void-fg-3'}`}>
				{status?.isIndexing ? 'Indexing…' : status?.disabled ? 'Disabled for this project' : status?.initialized ? 'Ready for this project' : status?.installed ? 'Installed; project setup needed' : 'Not installed'}
			</div>
		</div>
		<div className='mt-3 flex items-center gap-2 text-xs text-void-fg-2'>
			<VoidSwitch size='xs' value={autoIndex} onChange={(value) => { void setAutomaticIndexing(value); }} />
			<span>Automatically index opened code projects</span>
		</div>
		<div className='mt-4 grid gap-3 text-xs text-void-fg-3 sm:grid-cols-2'>
			<div className='rounded-sm bg-void-bg-2 p-3'>
				<div className='mb-2 font-medium text-void-fg-1'>Shared runtime</div>
				<div>{status?.installed ? '✓ Installed' : '• Not installed'}</div>
				<div>{status?.sentenceTransformersAvailable ? '✓ SentenceTransformers available' : '• SentenceTransformers unavailable'}</div>
				<div className='break-all'>{status?.embeddingModel ? `✓ ${status.embeddingModel}` : '• Embedding model not configured'}</div>
				{status?.runtimePath && <div className='mt-1 break-all opacity-70'>{status.runtimePath}</div>}
				{!status?.installed && <VoidButtonBgDarken className='mt-3 px-4 py-1' disabled={busy !== null} onClick={() => { void installRuntime(); }}>
					{busy === 'install' ? 'Installing CocoIndex…' : 'Install CocoIndex'}
				</VoidButtonBgDarken>}
				<div className='mt-2 opacity-70'>The runtime and embedding model are shared by all projects.</div>
			</div>
			<div className='rounded-sm bg-void-bg-2 p-3'>
				<div className='mb-2 font-medium text-void-fg-1'>Current project</div>
				<div className='break-all'>{workspaceRoot || 'No project open'}</div>
				<div>{status?.isIndexing ? '● Indexing…' : status?.disabled ? '○ Disabled' : status?.initialized ? '● Ready' : status?.eligible ? '○ Waiting to enable' : '○ Not recognized as a code project'}</div>
				{stats && <>
					<div>Files indexed: {stats.totalFiles.toLocaleString()}</div>
					<div>Code chunks: {stats.totalChunks.toLocaleString()}</div>
					<div>Last refresh: {lastRefresh}</div>
				</>}
				{status?.installed && (!status.initialized || status.disabled) && <VoidButtonBgDarken className='mt-3 px-4 py-1' disabled={!workspaceRoot || busy !== null} onClick={() => { void enableProject(); }}>
					{busy === 'enable' ? 'Enabling and indexing…' : 'Enable CocoIndex for this project'}
				</VoidButtonBgDarken>}
				{status?.initialized && !status.disabled && <div className='mt-3 flex flex-wrap gap-2'>
					<VoidButtonBgDarken className='px-4 py-1' disabled={busy !== null} onClick={() => { void updateIndex(false); }}>{busy === 'refresh' ? 'Refreshing…' : 'Refresh Index'}</VoidButtonBgDarken>
					<VoidButtonBgDarken className='px-4 py-1' disabled={busy !== null} onClick={() => { if (window.confirm('Delete and rebuild this project\'s CocoIndex database?')) void updateIndex(true); }}>{busy === 'rebuild' ? 'Rebuilding…' : 'Rebuild Index'}</VoidButtonBgDarken>
					<VoidButtonBgDarken className='px-4 py-1 text-red-400' disabled={busy !== null} onClick={() => { void disableProject(); }}>Disable for this project</VoidButtonBgDarken>
				</div>}
			</div>
		</div>
		{!workspaceRoot && <div className='mt-2 text-xs text-yellow-500'>Open a project to enable its code index.</div>}
		{status?.error && <div className='mt-2'><WarningBox text={status.error} /></div>}
		{error && <div className='mt-2'><WarningBox text={error} /></div>}
	</div>;
};

const MCPAddServerPanel = () => {
	const accessor = useAccessor()
	const mcpService = accessor.get('IMCPService')
	const workspaceContextService = accessor.get('IWorkspaceContextService')
	const workspaceRoot = workspaceContextService.getWorkspace().folders[0]?.uri.fsPath ?? ''
	const [isOpen, setIsOpen] = useState(false)
	const [transport, setTransport] = useState<'stdio' | 'http'>('stdio')
	const [name, setName] = useState('')
	const [command, setCommand] = useState('')
	const [args, setArgs] = useState('')
	const [cwd, setCwd] = useState(workspaceRoot)
	const [url, setUrl] = useState('')
	const [environment, setEnvironment] = useState('')
	const [headers, setHeaders] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)

	const save = async (serverName: string, config: MCPConfigFileEntryJSON) => {
		setSaving(true)
		setError(null)
		try {
			await mcpService.addOrUpdateServer(serverName, config)
			setIsOpen(false)
			setName('')
			setCommand('')
			setArgs('')
			setUrl('')
			setEnvironment('')
			setHeaders('')
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err))
		} finally {
			setSaving(false)
		}
	}

	const addConfiguredServer = async () => {
		try {
			const config: MCPConfigFileEntryJSON = transport === 'stdio'
				? { command: command.trim(), args: splitCommandArguments(args), cwd: cwd.trim() || undefined, env: parseRecordJSON('Environment', environment) }
				: { url: url.trim(), headers: parseRecordJSON('Headers', headers) }
			await save(name.trim(), config)
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err))
		}
	}

	const inputClass = 'w-full rounded-sm border border-void-border-2 bg-void-bg-1 px-2 py-1.5 text-sm text-void-fg-1 outline-none focus:border-void-fg-3'
	return <div className='my-3'>
		<div className='flex flex-wrap gap-2'>
			<VoidButtonBgDarken className='px-4 py-1' onClick={() => setIsOpen(value => !value)}>{isOpen ? 'Cancel' : 'Add MCP Server'}</VoidButtonBgDarken>
			<VoidButtonBgDarken className='px-4 py-1' onClick={() => { void mcpService.revealMCPConfigFile() }}>Open JSON</VoidButtonBgDarken>
		</div>
		{isOpen && <div className='mt-3 max-w-2xl space-y-3 rounded-sm border border-void-border-2 bg-void-bg-1 p-4'>
			<div className='flex gap-4 text-sm text-void-fg-2'>
				<label><input type='radio' checked={transport === 'stdio'} onChange={() => setTransport('stdio')} /> Local command</label>
				<label><input type='radio' checked={transport === 'http'} onChange={() => setTransport('http')} /> HTTP / SSE</label>
			</div>
			<label className='block text-xs text-void-fg-3'>Server name<input className={`${inputClass} mt-1`} value={name} onChange={event => setName(event.target.value)} placeholder='my-mcp-server' /></label>
			{transport === 'stdio' ? <>
				<label className='block text-xs text-void-fg-3'>Command<input className={`${inputClass} mt-1`} value={command} onChange={event => setCommand(event.target.value)} placeholder='npx, uvx, python, or executable path' /></label>
				<label className='block text-xs text-void-fg-3'>Arguments<input className={`${inputClass} mt-1`} value={args} onChange={event => setArgs(event.target.value)} placeholder='-y @example/mcp-server' /></label>
				<label className='block text-xs text-void-fg-3'>Working directory<input className={`${inputClass} mt-1`} value={cwd} onChange={event => setCwd(event.target.value)} /></label>
				<label className='block text-xs text-void-fg-3'>Environment variables (JSON)<textarea className={`${inputClass} mt-1 min-h-20 font-mono`} value={environment} onChange={event => setEnvironment(event.target.value)} placeholder={'{"API_KEY":"..."}'} /></label>
			</> : <>
				<label className='block text-xs text-void-fg-3'>MCP URL<input className={`${inputClass} mt-1`} value={url} onChange={event => setUrl(event.target.value)} placeholder='https://example.com/mcp' /></label>
				<label className='block text-xs text-void-fg-3'>Request headers (JSON)<textarea className={`${inputClass} mt-1 min-h-20 font-mono`} value={headers} onChange={event => setHeaders(event.target.value)} placeholder={'{"Authorization":"Bearer ..."}'} /></label>
			</>}
			<VoidButtonBgDarken className='px-4 py-1' disabled={saving} onClick={() => { void addConfiguredServer() }}>{saving ? 'Connecting...' : 'Save and connect'}</VoidButtonBgDarken>
		</div>}
		{error && <div className='mt-2'><WarningBox text={error} /></div>}
	</div>
}

// Main component that renders the list of servers
const MCPServersList = () => {
	const mcpServiceState = useMCPServiceState()

	let content: React.ReactNode
	if (mcpServiceState.error) {
		content = <div className="text-void-fg-3 text-sm mt-2">
			{mcpServiceState.error}
		</div>
	}
	else {
		const entries = Object.entries(mcpServiceState.mcpServerOfName)
		if (entries.length === 0) {
			content = <div className="text-void-fg-3 text-sm mt-2">
				No servers found
			</div>
		}
		else {
			content = entries.map(([name, server]) => (
				<MCPServerComponent key={name} name={name} server={server} />
			))
		}
	}

	return <div className="my-2">{content}</div>
};

export const Settings = () => {
	const isDark = useIsDark()
	// ─── sidebar nav ──────────────────────────
	const [selectedSection, setSelectedSection] =
		useState<Tab>('models');

	const [enableBrowserTools, setEnableBrowserTools] = useState(true);
	const [enableNotifications, setEnableNotifications] = useState(false);
	const [enableSounds, setEnableSounds] = useState(false);
	const [browserJsPolicy, setBrowserJsPolicy] = useState('Disabled');

	const accessor = useAccessor();
	const workspaceContextService = accessor.get('IWorkspaceContextService');
	const workspaceFolders = workspaceContextService.getWorkspace().folders;
	const workspaceNavItems = useMemo(() => {
		const seen = new Set<string>();
		return workspaceFolders.map((folder, idx) => {
			let name = folder.name;
			if (!name) {
				name = folder.uri.fsPath.split(/[\\/]/).filter(Boolean).pop() || 'Workspace ' + (idx + 1);
			}
			let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'ws_' + idx;
			let tabKey = 'ws_' + slug;
			let counter = 1;
			while (seen.has(tabKey)) { tabKey = 'ws_' + slug + '_' + counter; counter++; }
			seen.add(tabKey);
			return { tab: tabKey as Tab, label: name };
		});
	}, [workspaceFolders]);

	const navItems: { tab: Tab; label: string; isHeader?: boolean }[] = [
		{ tab: 'general', label: 'General' },
		{ tab: 'account', label: 'Account' },
		{ tab: 'permissions', label: 'Permissions' },
		{ tab: 'appearance', label: 'Appearance' },
		{ tab: 'notifications', label: 'Notifications' },
		{ tab: 'models', label: 'Models' },
		{ tab: 'customizations', label: 'Customizations' },
		{ tab: 'browser', label: 'Browser' },
		{ tab: 'tab', label: 'Tab' },
		{ tab: 'editor', label: 'Editor' },
		...(workspaceNavItems.length > 0 ? [{ tab: 'ws_workspace' as Tab, label: 'Workspaces', isHeader: true }, ...workspaceNavItems.map(w => ({ tab: w.tab, label: w.label }))] : []),
		{ tab: 'codeIndex', label: 'Code Index' },
		{ tab: 'mcp', label: 'MCP' },
	];
	const shouldShowTab = (tab: Tab) => {
		if (tab === selectedSection) return true;
		if (tab.startsWith('ws_') && selectedSection.startsWith('ws_')) {
			return tab === selectedSection;
		}
		return false;
	};
	const commandService = accessor.get('ICommandService')
	const environmentService = accessor.get('IEnvironmentService')
	const nativeHostService = accessor.get('INativeHostService')
	const settingsState = useSettingsState()
	const voidSettingsService = accessor.get('IVoidSettingsService')
	const chatThreadsService = accessor.get('IChatThreadService')
	const notificationService = accessor.get('INotificationService')
	const storageService = accessor.get('IStorageService')
	const metricsService = accessor.get('IMetricsService')
	const isOptedOut = useIsOptedOut()

	const onDownload = (t: 'Chats' | 'Settings') => {
		let dataStr: string
		let downloadName: string
		if (t === 'Chats') {
			// Export chat threads
			dataStr = JSON.stringify(chatThreadsService.state, null, 2)
			downloadName = 'void-chats.json'
		}
		else if (t === 'Settings') {
			// Export user settings
			dataStr = JSON.stringify(voidSettingsService.state, null, 2)
			downloadName = 'void-settings.json'
		}
		else {
			dataStr = ''
			downloadName = ''
		}

		const blob = new Blob([dataStr], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = downloadName
		a.click()
		URL.revokeObjectURL(url)
	}


	// Add file input refs
	const fileInputSettingsRef = useRef<HTMLInputElement>(null)
	const fileInputChatsRef = useRef<HTMLInputElement>(null)

	const [s, ss] = useState(0)

	const handleUpload = (t: 'Chats' | 'Settings') => (e: React.ChangeEvent<HTMLInputElement>,) => {
		const files = e.target.files
		if (!files) return;
		const file = files[0]
		if (!file) return

		const reader = new FileReader();
		reader.onload = () => {
			try {
				const json = JSON.parse(reader.result as string);

				if (t === 'Chats') {
					chatThreadsService.dangerousSetState(json as any)
				}
				else if (t === 'Settings') {
					voidSettingsService.dangerousSetState(json as any)
				}

				notificationService.info(`${t} imported successfully!`)
			} catch (err) {
				notificationService.notify({ message: `Failed to import ${t}`, source: err + '', severity: Severity.Error, })
			}
		};
		reader.readAsText(file);
		e.target.value = '';

		ss(s => s + 1)
	}


	return (
		<div className={`@@void-scope ${isDark ? 'dark' : ''}`} style={{ height: '100%', width: '100%', overflow: 'auto' }}>
			<div className="flex flex-col md:flex-row w-full gap-6 max-w-[950px] mx-auto mb-32" style={{ minHeight: '80vh' }}>
				{/* ──────────────  SIDEBAR  ────────────── */}

				<aside className="md:w-1/4 w-full p-4 shrink-0">
					{/* vertical tab list */}
					<div className="flex flex-col gap-1 mt-8">
						{navItems.map(({ tab, label, isHeader }, idx) => (
							isHeader ? (
								<div key={'header-' + idx} className="text-xs font-bold text-void-fg-3 uppercase tracking-wider px-3 pt-4 pb-1">
									{label}
								</div>
							) : (
								<button
									key={tab + '-' + idx}
									onClick={() => {
										setSelectedSection(tab);
									}}
									className={`
										py-1.5 px-3 rounded-md text-left text-sm transition-all duration-150
										${selectedSection === tab
											? 'bg-[#0e70c0]/80 text-white font-medium shadow-sm'
											: 'hover:bg-void-bg-2/80 text-void-fg-2 hover:text-void-fg-1'}
									`}
								>
									{label}
								</button>
							)
						))}
					</div>
				</aside>

				{/* ───────────── MAIN PANE ───────────── */}
				<main className="flex-1 p-6 select-none">



					<div className='max-w-3xl'>

						<h1 className='text-2xl w-full'>{`Forge AI Settings`}</h1>

						<div className='w-full h-[1px] my-2' />

						{/* Models section (formerly FeaturesTab) */}
						<ErrorBoundary>
							<RedoOnboardingButton />
						</ErrorBoundary>

						<div className='w-full h-[1px] my-4' />

						{/* All sections in flex container with gap-12 */}
						<div className='flex flex-col gap-12'>
							{/* General Section */}
							<div className={shouldShowTab('general') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className="text-2xl font-bold mb-1 text-void-fg-1">General Settings</h2>
									<p className="text-sm text-void-fg-3 mb-6">Configure general environment and agent runtime options.</p>
									<div className="bg-void-bg-2/70 border border-void-border-2 rounded-lg p-5 flex flex-col gap-4">
										<div className="flex items-center justify-between">
											<span className="font-medium text-void-fg-1 text-sm">Automatically Check for Updates</span>
											<VoidSwitch size='xs' value={true} onChange={() => {}} />
										</div>
										<div className="flex items-center justify-between pt-4 border-t border-void-border-2">
											<span className="font-medium text-void-fg-1 text-sm">Telemetry and Usage Metrics</span>
											<VoidSwitch size='xs' value={false} onChange={() => {}} />
										</div>
									</div>
								</ErrorBoundary>
							</div>

							{/* Account Section */}
							<div className={shouldShowTab('account') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className="text-2xl font-bold mb-1 text-void-fg-1">Account & Profile</h2>
									<p className="text-sm text-void-fg-3 mb-6">Manage user profile, authentication tokens, and credentials.</p>
									<div className="bg-void-bg-2/70 border border-void-border-2 rounded-lg p-5">
										<span className="text-sm text-void-fg-2">Currently logged in as Local Developer.</span>
									</div>
								</ErrorBoundary>
							</div>

							{/* Permissions Section */}
							<div className={shouldShowTab('permissions') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className="text-2xl font-bold mb-1 text-void-fg-1">Agent Permissions</h2>
									<p className="text-sm text-void-fg-3 mb-6">Manage allowed shell execution, file read/write, and network actuation scope.</p>
									<div className="bg-void-bg-2/70 border border-void-border-2 rounded-lg p-5 flex flex-col gap-4">
										<div className="flex items-center justify-between">
											<span className="font-medium text-void-fg-1 text-sm">Require Approval for Shell Commands</span>
											<VoidSwitch size='xs' value={true} onChange={() => {}} />
										</div>
										<div className="flex items-center justify-between pt-4 border-t border-void-border-2">
											<span className="font-medium text-void-fg-1 text-sm">Require Approval for File Modifications</span>
											<VoidSwitch size='xs' value={false} onChange={() => {}} />
										</div>
									</div>
								</ErrorBoundary>
							</div>

							{/* Appearance Section */}
							<div className={shouldShowTab('appearance') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className="text-2xl font-bold mb-1 text-void-fg-1">Appearance</h2>
									<p className="text-sm text-void-fg-3 mb-6">Customize UI themes, font sizes, and layout density.</p>
								</ErrorBoundary>
							</div>

							{/* Notifications Section */}
							<div className={shouldShowTab('notifications') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className="text-2xl font-bold mb-1 text-void-fg-1">Notifications</h2>
									<p className="text-sm text-void-fg-3 mb-6">Configure notification alerts and sound triggers.</p>
								</ErrorBoundary>
							</div>

							{/* Customizations Section */}
							<div className={shouldShowTab('customizations') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className="text-2xl font-bold mb-1 text-void-fg-1">Customizations</h2>
									<p className="text-sm text-void-fg-3 mb-6">Configure prompt rules and custom skill extensions.</p>
								</ErrorBoundary>
							</div>

							{/* Browser Settings Section (matching Image 3) */}
							<div className={shouldShowTab('browser') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className="text-2xl font-bold mb-1 text-void-fg-1">Browser Settings</h2>
									<p className="text-sm text-void-fg-3 mb-6">
										Configure the browser subagent. It requires <a href="https://www.google.com/chrome/" target="_blank" rel="noreferrer" className="text-blue-400 underline">Google Chrome</a> to be installed.
									</p>

									<h3 className="text-base font-semibold mb-3 text-void-fg-1">General</h3>
									<div className="bg-void-bg-2/70 border border-void-border-2 rounded-lg p-5 flex flex-col gap-6 mb-6">
										{/* Enable Browser Tools */}
										<div className="flex items-start justify-between gap-4">
											<div className="flex flex-col gap-1">
												<span className="font-medium text-void-fg-1 text-sm">Enable Browser Tools</span>
												<span className="text-xs text-void-fg-3 max-w-xl leading-relaxed">
													When enabled, Agent can use browser tools to open URLs, read web pages, and interact with browser content. This allows the Agent access to important (and often critical) knowledge and methods of validation, but any browser integration does increase exposure to external malicious parties for security exploits.
												</span>
											</div>
											<VoidSwitch size='xs' value={enableBrowserTools} onChange={setEnableBrowserTools} />
										</div>

										{/* Browser Javascript Execution Policy */}
										<div className="flex items-center justify-between gap-4 pt-4 border-t border-void-border-2">
											<div className="flex flex-col gap-1">
												<span className="font-medium text-void-fg-1 text-sm">Browser Javascript Execution Policy</span>
												<span className="text-xs text-void-fg-3">Controls whether the agent can run custom JavaScript to automate complex browser actions.</span>
											</div>
											<select
												value={browserJsPolicy}
												onChange={(e) => setBrowserJsPolicy(e.target.value)}
												className="bg-void-bg-1 border border-void-border-2 text-void-fg-1 text-xs rounded px-3 py-1.5 focus:outline-none min-w-[110px]"
											>
												<option value="Disabled">Disabled</option>
												<option value="Enabled">Enabled</option>
												<option value="Ask">Ask First</option>
											</select>
										</div>

										{/* Enable Notifications for Agent */}
										<div className="flex items-center justify-between gap-4 pt-4 border-t border-void-border-2">
											<div className="flex flex-col gap-1">
												<span className="font-medium text-void-fg-1 text-sm">Enable Notifications for Agent</span>
												<span className="text-xs text-void-fg-3">When enabled, Agent will show browser notifications when user action is needed or execution finishes.</span>
											</div>
											<VoidSwitch size='xs' value={enableNotifications} onChange={setEnableNotifications} />
										</div>

										{/* Enable Sounds for Agent */}
										<div className="flex items-center justify-between gap-4 pt-4 border-t border-void-border-2">
											<div className="flex flex-col gap-1">
												<span className="font-medium text-void-fg-1 text-sm">Enable Sounds for Agent</span>
												<span className="text-xs text-void-fg-3">When enabled, Antigravity will play a sound when Agent finishes generating a response.</span>
											</div>
											<VoidSwitch size='xs' value={enableSounds} onChange={setEnableSounds} />
										</div>
									</div>

									<h3 className="text-base font-semibold mb-3 text-void-fg-1">Actuation Permissions</h3>
									<div className="bg-void-bg-2/70 border border-void-border-2 rounded-lg p-5 flex items-center justify-between">
										<div className="flex flex-col gap-1">
											<span className="font-medium text-void-fg-1 text-sm">Browser Actuation Rules</span>
											<span className="text-xs text-void-fg-3">Configure allowed and denied URLs for browser actuation.</span>
										</div>
										<button className="px-4 py-1 bg-void-bg-1 hover:bg-void-bg-2 border border-void-border-2 rounded text-xs text-void-fg-1 transition-all">Edit</button>
									</div>
								</ErrorBoundary>
							</div>

							{/* Tab Section */}
							<div className={shouldShowTab('tab') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className="text-2xl font-bold mb-1 text-void-fg-1">Tab & Autocomplete Settings</h2>
									<p className="text-sm text-void-fg-3 mb-6">Configure inline completion triggers and delay options.</p>
								</ErrorBoundary>
							</div>

							{/* Editor Section */}
							<div className={shouldShowTab('editor') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className="text-2xl font-bold mb-1 text-void-fg-1">Editor Settings</h2>
									<p className="text-sm text-void-fg-3 mb-6">Configure code editor integrations and inline edit decorations.</p>
								</ErrorBoundary>
							</div>

							{/* Workspace Settings */}
							{workspaceNavItems.map((wsItem) => {
								const wsLabel = wsItem.label;
								return <div key={wsItem.tab} className={shouldShowTab(wsItem.tab) ? `` : 'hidden'}>
									<ErrorBoundary>
										<h2 className="text-2xl font-bold mb-1 text-void-fg-1">Workspace: {wsLabel}</h2>
										<p className="text-sm text-void-fg-3 mb-6">Configure workspace-specific indexing rules and agent settings for {wsLabel}.</p>
									</ErrorBoundary>
								</div>
							})}

							{/* Models section (formerly FeaturesTab) */}
							<div className={shouldShowTab('models') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className={`text-3xl mb-2`}>Models & API Connections</h2>
									<p className="text-sm text-void-fg-3 mb-4">Add as many models as you need from each provider. Every model can have its own API key, endpoint, and connection settings. Select a model in the chat dropdown to use it.</p>
									<ModelDump />
									<div className='w-full h-[1px] my-4' />
									<AutoDetectLocalModelsToggle />
									<RefreshableModels />
								</ErrorBoundary>
							</div>

							{/* Feature Options section */}
							<div className={shouldShowTab('featureOptions') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className={`text-3xl mb-2`}>Feature Options</h2>

									<div className='flex flex-col gap-y-8 my-4'>
										<ErrorBoundary>
											{/* FIM */}
											<div>
												<h4 className={`text-base`}>{displayInfoOfFeatureName('Autocomplete')}</h4>
												<div className='text-sm text-void-fg-3 mt-1'>
													<span>
														Experimental.{' '}
													</span>
													<span
														className='hover:brightness-110'
														data-tooltip-id='void-tooltip'
														data-tooltip-content='We recommend using the largest qwen2.5-coder model you can with Ollama (try qwen2.5-coder:3b).'
														data-tooltip-class-name='void-max-w-[20px]'
													>
														Only works with FIM models.*
													</span>
												</div>

												<div className='my-2'>
													{/* Enable Switch */}
													<ErrorBoundary>
														<div className='flex items-center gap-x-2 my-2'>
															<VoidSwitch
																size='xs'
																value={settingsState.globalSettings.enableAutocomplete}
																onChange={(newVal) => voidSettingsService.setGlobalSetting('enableAutocomplete', newVal)}
															/>
															<span className='text-void-fg-3 text-xs pointer-events-none'>{settingsState.globalSettings.enableAutocomplete ? 'Enabled' : 'Disabled'}</span>
														</div>
													</ErrorBoundary>

													{/* Model Dropdown */}
													<ErrorBoundary>
														<div className={`my-2 ${!settingsState.globalSettings.enableAutocomplete ? 'hidden' : ''}`}>
															<ModelDropdown featureName={'Autocomplete'} className='text-xs text-void-fg-3 bg-void-bg-1 border border-void-border-1 rounded p-0.5 px-1' />
														</div>
													</ErrorBoundary>

												</div>

											</div>
										</ErrorBoundary>

										{/* Apply */}
										<ErrorBoundary>

											<div className='w-full'>
												<h4 className={`text-base`}>{displayInfoOfFeatureName('Apply')}</h4>
												<div className='text-sm text-void-fg-3 mt-1'>Settings that control the behavior of the Apply button.</div>

												<div className='my-2'>
													{/* Sync to Chat Switch */}
													<div className='flex items-center gap-x-2 my-2'>
														<VoidSwitch
															size='xs'
															value={settingsState.globalSettings.syncApplyToChat}
															onChange={(newVal) => voidSettingsService.setGlobalSetting('syncApplyToChat', newVal)}
														/>
														<span className='text-void-fg-3 text-xs pointer-events-none'>{settingsState.globalSettings.syncApplyToChat ? 'Same as Chat model' : 'Different model'}</span>
													</div>

													{/* Model Dropdown */}
													<div className={`my-2 ${settingsState.globalSettings.syncApplyToChat ? 'hidden' : ''}`}>
														<ModelDropdown featureName={'Apply'} className='text-xs text-void-fg-3 bg-void-bg-1 border border-void-border-1 rounded p-0.5 px-1' />
													</div>
												</div>


												<div className='my-2'>
													{/* Fast Apply Method Dropdown */}
													<div className='flex items-center gap-x-2 my-2'>
														<FastApplyMethodDropdown />
													</div>
												</div>

											</div>
										</ErrorBoundary>




										{/* Tools Section */}
										<div>
											<h4 className={`text-base`}>Tools</h4>
											<div className='text-sm text-void-fg-3 mt-1'>{`Tools are functions that LLMs can call. Some tools require user approval.`}</div>

											<div className='my-2'>
												{/* Auto Accept Switch */}
												<ErrorBoundary>
													{[...toolApprovalTypes].map((approvalType) => {
														return <div key={approvalType} className="flex items-center gap-x-2 my-2">
															<ToolApprovalTypeSwitch size='xs' approvalType={approvalType} desc={`Auto-approve ${approvalType}`} />
														</div>
													})}

												</ErrorBoundary>

												{/* Tool Lint Errors Switch */}
												<ErrorBoundary>

													<div className='flex items-center gap-x-2 my-2'>
														<VoidSwitch
															size='xs'
															value={settingsState.globalSettings.includeToolLintErrors}
															onChange={(newVal) => voidSettingsService.setGlobalSetting('includeToolLintErrors', newVal)}
														/>
														<span className='text-void-fg-3 text-xs pointer-events-none'>{settingsState.globalSettings.includeToolLintErrors ? 'Fix lint errors' : `Fix lint errors`}</span>
													</div>
												</ErrorBoundary>

												{/* Auto Accept LLM Changes Switch */}
												<ErrorBoundary>
													<div className='flex items-center gap-x-2 my-2'>
														<VoidSwitch
															size='xs'
															value={settingsState.globalSettings.autoAcceptLLMChanges}
															onChange={(newVal) => voidSettingsService.setGlobalSetting('autoAcceptLLMChanges', newVal)}
														/>
														<span className='text-void-fg-3 text-xs pointer-events-none'>Auto-accept LLM changes</span>
													</div>
												</ErrorBoundary>
											</div>
										</div>



										<div className='w-full'>
											<h4 className={`text-base`}>Editor</h4>
											<div className='text-sm text-void-fg-3 mt-1'>{`Settings that control the visibility of Void suggestions in the code editor.`}</div>

											<div className='my-2'>
												{/* Auto Accept Switch */}
												<ErrorBoundary>
													<div className='flex items-center gap-x-2 my-2'>
														<VoidSwitch
															size='xs'
															value={settingsState.globalSettings.showInlineSuggestions}
															onChange={(newVal) => voidSettingsService.setGlobalSetting('showInlineSuggestions', newVal)}
														/>
														<span className='text-void-fg-3 text-xs pointer-events-none'>{settingsState.globalSettings.showInlineSuggestions ? 'Show suggestions on select' : 'Show suggestions on select'}</span>
													</div>
												</ErrorBoundary>
											</div>
										</div>

										{/* SCM */}
										<ErrorBoundary>

											<div className='w-full'>
												<h4 className={`text-base`}>{displayInfoOfFeatureName('SCM')}</h4>
												<div className='text-sm text-void-fg-3 mt-1'>Settings that control the behavior of the commit message generator.</div>

												<div className='my-2'>
													{/* Sync to Chat Switch */}
													<div className='flex items-center gap-x-2 my-2'>
														<VoidSwitch
															size='xs'
															value={settingsState.globalSettings.syncSCMToChat}
															onChange={(newVal) => voidSettingsService.setGlobalSetting('syncSCMToChat', newVal)}
														/>
														<span className='text-void-fg-3 text-xs pointer-events-none'>{settingsState.globalSettings.syncSCMToChat ? 'Same as Chat model' : 'Different model'}</span>
													</div>

													{/* Model Dropdown */}
													<div className={`my-2 ${settingsState.globalSettings.syncSCMToChat ? 'hidden' : ''}`}>
														<ModelDropdown featureName={'SCM'} className='text-xs text-void-fg-3 bg-void-bg-1 border border-void-border-1 rounded p-0.5 px-1' />
													</div>
												</div>

											</div>
										</ErrorBoundary>
									</div>
								</ErrorBoundary>
							</div>

							{/* General section */}
							<div className={`${shouldShowTab('general') ? `` : 'hidden'} flex flex-col gap-12`}>
								{/* One-Click Switch section */}
								<div>
									<ErrorBoundary>
										<h2 className='text-3xl mb-2'>One-Click Switch</h2>
										<h4 className='text-void-fg-3 mb-4'>{`Transfer your editor settings into Void.`}</h4>

										<div className='flex flex-col gap-2'>
											<OneClickSwitchButton className='w-48' fromEditor="VS Code" />
											<OneClickSwitchButton className='w-48' fromEditor="Cursor" />
											<OneClickSwitchButton className='w-48' fromEditor="Windsurf" />
										</div>
									</ErrorBoundary>
								</div>

								{/* Import/Export section */}
								<div>
									<h2 className='text-3xl mb-2'>Import/Export</h2>
									<h4 className='text-void-fg-3 mb-4'>{`Transfer Void's settings and chats in and out of Void.`}</h4>
									<div className='flex flex-col gap-8'>
										{/* Settings Subcategory */}
										<div className='flex flex-col gap-2 max-w-48 w-full'>
											<input key={2 * s} ref={fileInputSettingsRef} type='file' accept='.json' className='hidden' onChange={handleUpload('Settings')} />
											<VoidButtonBgDarken className='px-4 py-1 w-full' onClick={() => { fileInputSettingsRef.current?.click() }}>
												Import Settings
											</VoidButtonBgDarken>
											<VoidButtonBgDarken className='px-4 py-1 w-full' onClick={() => onDownload('Settings')}>
												Export Settings
											</VoidButtonBgDarken>
											<ConfirmButton className='px-4 py-1 w-full' onConfirm={() => { voidSettingsService.resetState(); }}>
												Reset Settings
											</ConfirmButton>
										</div>

										{/* Chats Subcategory */}
										<div className='flex flex-col gap-2 max-w-48 w-full'>
											<input key={2 * s + 1} ref={fileInputChatsRef} type='file' accept='.json' className='hidden' onChange={handleUpload('Chats')} />
											<VoidButtonBgDarken className='px-4 py-1 w-full' onClick={() => { fileInputChatsRef.current?.click() }}>
												Import Chats
											</VoidButtonBgDarken>
											<VoidButtonBgDarken className='px-4 py-1 w-full' onClick={() => onDownload('Chats')}>
												Export Chats
											</VoidButtonBgDarken>
											<ConfirmButton className='px-4 py-1 w-full' onConfirm={() => { chatThreadsService.resetState(); }}>
												Reset Chats
											</ConfirmButton>
										</div>
									</div>
								</div>



								{/* Built-in Settings section */}
								<div>
									<h2 className={`text-3xl mb-2`}>Built-in Settings</h2>
									<h4 className={`text-void-fg-3 mb-4`}>{`IDE settings, keyboard settings, and theme customization.`}</h4>

									<ErrorBoundary>
										<div className='flex flex-col gap-2 justify-center max-w-48 w-full'>
											<VoidButtonBgDarken className='px-4 py-1' onClick={() => { commandService.executeCommand('workbench.action.openSettings') }}>
												General Settings
											</VoidButtonBgDarken>
											<VoidButtonBgDarken className='px-4 py-1' onClick={() => { commandService.executeCommand('workbench.action.openGlobalKeybindings') }}>
												Keyboard Settings
											</VoidButtonBgDarken>
											<VoidButtonBgDarken className='px-4 py-1' onClick={() => { commandService.executeCommand('workbench.action.selectTheme') }}>
												Theme Settings
											</VoidButtonBgDarken>
											<VoidButtonBgDarken className='px-4 py-1' onClick={() => { nativeHostService.showItemInFolder(environmentService.logsHome.fsPath) }}>
												Open Logs
											</VoidButtonBgDarken>
										</div>
									</ErrorBoundary>
								</div>


								{/* Metrics section */}
								<div className='max-w-[600px]'>
									<h2 className={`text-3xl mb-2`}>Metrics</h2>
									<h4 className={`text-void-fg-3 mb-4`}>Very basic anonymous usage tracking helps us keep Void running smoothly. You may opt out below. Regardless of this setting, Void never sees your code, messages, or API keys.</h4>

									<div className='my-2'>
										{/* Disable All Metrics Switch */}
										<ErrorBoundary>
											<div className='flex items-center gap-x-2 my-2'>
												<VoidSwitch
													size='xs'
													value={isOptedOut}
													onChange={(newVal) => {
														storageService.store(OPT_OUT_KEY, newVal, StorageScope.APPLICATION, StorageTarget.MACHINE)
														metricsService.capture(`Set metrics opt-out to ${newVal}`, {}) // this only fires if it's enabled, so it's fine to have here
													}}
												/>
												<span className='text-void-fg-3 text-xs pointer-events-none'>{'Opt-out (requires restart)'}</span>
											</div>
										</ErrorBoundary>
									</div>
								</div>

								{/* AI Instructions section */}
								<div className='max-w-[600px]'>
									<h2 className={`text-3xl mb-2`}>AI Instructions</h2>
									<h4 className={`text-void-fg-3 mb-4`}>
										<ChatMarkdownRender inPTag={true} string={`
System instructions to include with all AI requests.
Alternatively, place a \`.voidrules\` file in the root of your workspace.
								`} chatMessageLocation={undefined} />
									</h4>
									<ErrorBoundary>
										<AIInstructionsBox />
									</ErrorBoundary>
									{/* --- Disable System Message Toggle --- */}
									<div className='my-4'>
										<ErrorBoundary>
											<div className='flex items-center gap-x-2'>
												<VoidSwitch
													size='xs'
													value={!!settingsState.globalSettings.disableSystemMessage}
													onChange={(newValue) => {
														voidSettingsService.setGlobalSetting('disableSystemMessage', newValue);
													}}
												/>
												<span className='text-void-fg-3 text-xs pointer-events-none'>
													{'Disable system message'}
												</span>
											</div>
										</ErrorBoundary>
										<div className='text-void-fg-3 text-xs mt-1'>
											{`When disabled, Forge AI will not include anything in the system message except for content you specified above.`}
										</div>
									</div>
								</div>

							</div>



							{/* Local code index section */}
							<div className={shouldShowTab('codeIndex') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className='text-3xl mb-2'>Code Index</h2>
									<h4 className='text-void-fg-3 mb-4'>Local semantic code search for Agent and Gather workflows.</h4>
									<CocoIndexLocalPanel />
								</ErrorBoundary>
							</div>

							{/* MCP section */}
							<div className={shouldShowTab('mcp') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className='text-3xl mb-2'>MCP</h2>
									<h4 className={`text-void-fg-3 mb-4`}>
										<ChatMarkdownRender inPTag={true} string={`
Use Model Context Protocol to provide Agent mode with more tools.
							`} chatMessageLocation={undefined} />
									</h4>
									<MCPAddServerPanel />

									<ErrorBoundary>
										<MCPServersList />
									</ErrorBoundary>
								</ErrorBoundary>
							</div>





						</div>

					</div>
				</main>
			</div>
		</div>
	);
}

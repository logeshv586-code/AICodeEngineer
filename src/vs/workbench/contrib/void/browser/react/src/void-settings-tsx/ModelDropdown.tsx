/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { displayInfoOfProviderName, FeatureName, featureNames, isFeatureNameDisabled, ModelSelection, modelSelectionsEqual, ProviderName, providerNames } from '../../../../../../../workbench/contrib/void/common/voidSettingsTypes.js';
import { useSettingsState, useRefreshModelState, useAccessor } from '../util/services.tsx';
import { VoidSwitch } from '../util/inputs.tsx';
import { VOID_OPEN_SETTINGS_ACTION_ID } from '../../../voidSettingsPane.js';
import { modelFilterOfFeatureName, ModelOption } from '../../../../../../../workbench/contrib/void/common/voidSettingsService.js';
import { WarningBox } from './WarningBox.js';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.tsx';
import { Check, ChevronDown, ChevronUp, Info, Lock, Plus, Sparkles } from 'lucide-react';

const builtInModelPresets: { modelName: string; providerName: ProviderName; tag?: string }[] = [
	{ modelName: 'GPT-5.4', providerName: 'openAI', tag: 'Beta' },
	{ modelName: 'GPT-5.2', providerName: 'openAI' },
	{ modelName: 'z-ai/glm-5.2', providerName: 'nvidia', tag: 'NVIDIA' },
	{ modelName: 'nvidia/llama-3.3-nemotron-70b-instruct', providerName: 'nvidia', tag: 'NVIDIA' },
	{ modelName: 'nvidia/llama-3.1-nemotron-70b-instruct', providerName: 'nvidia' },
	{ modelName: 'nvidia/llama-3.1-nemotron-8b-instruct', providerName: 'nvidia' },
	{ modelName: 'nvidia/nemotron-4-340b-instruct', providerName: 'nvidia' },
	{ modelName: 'Seed-2.1-Turbo', providerName: 'openRouter' },
	{ modelName: 'MiniMax-M3', providerName: 'openRouter' },
	{ modelName: 'MiniMax-M2.7', providerName: 'openRouter' },
	{ modelName: 'Kimi-K2.5', providerName: 'openRouter' },
	{ modelName: 'Gemini-3.1-Pro-Preview', providerName: 'gemini' },
	{ modelName: 'Gemini-3-Flash-Preview', providerName: 'gemini' },
];

export const ModelDropdown = ({ featureName, className }: { featureName: FeatureName; className: string }) => {
	const settingsState = useSettingsState();
	const accessor = useAccessor();
	const voidSettingsService = accessor.get('IVoidSettingsService');
	const commandService = accessor.get('ICommandService');

	const [isOpen, setIsOpen] = useState(false);
	const [autoMode, setAutoMode] = useState(true);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const [menuPosition, setMenuPosition] = useState({ left: 8, top: 8, width: 280 });

	// Use the reactive settings snapshot for both the label and list state.  Reading
	// the service directly here could leave the button on an older provider/model.
	const selection = settingsState.modelSelectionOfFeature[featureName];
	const configuredProviderNames = useMemo(
		() => providerNames.filter(providerName => !!settingsState.settingsOfProvider[providerName]?._didFillInProviderSettings),
		[settingsState.settingsOfProvider]
	);
	const currentModelName = selection?.modelName || (configuredProviderNames.length === 0 ? 'Connect API in Settings' : 'Select a model');
	const portalTarget = typeof document === 'undefined'
		? null
		: document.querySelector('.void-scope') ?? document.body;

	const openSettings = () => {
		commandService.executeCommand(VOID_OPEN_SETTINGS_ACTION_ID);
		setIsOpen(false);
	};

	// Close on outside click
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (!dropdownRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};
		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;
		const updatePosition = () => {
			const rect = triggerRef.current?.getBoundingClientRect();
			if (!rect) return;
			const width = Math.min(280, Math.max(220, window.innerWidth - 16));
			setMenuPosition({
				left: Math.min(Math.max(8, rect.right - width), Math.max(8, window.innerWidth - width - 8)),
				top: Math.max(8, rect.top - 330),
				width,
			});
		};
		updatePosition();
		window.addEventListener('resize', updatePosition);
		window.addEventListener('scroll', updatePosition, true);
		return () => {
			window.removeEventListener('resize', updatePosition);
			window.removeEventListener('scroll', updatePosition, true);
		};
	}, [isOpen]);

	const toggleMenu = () => setIsOpen(open => !open);

	const selectModel = async (modelName: string, providerName: ProviderName) => {
		const providerSettings = settingsState.settingsOfProvider[providerName];
		if (!providerSettings?._didFillInProviderSettings) {
			openSettings();
			return;
		}
		const existing = providerSettings.models.find(model => model.modelName === modelName);
		if (!existing || existing.isHidden) {
			const models = existing
				? providerSettings.models.map(model => model.modelName === modelName ? { ...model, isHidden: false } : model)
				: [...providerSettings.models, { modelName, type: 'custom' as const, isHidden: false }];
			await voidSettingsService.setSettingOfProvider(providerName, 'models', models);
		}

		await voidSettingsService.setModelSelectionOfFeature(featureName, { modelName, providerName });
		setAutoMode(false);
		setIsOpen(false);
	};

	// Collect user configured models dynamically across all providers
	const allAvailableModels = useMemo(() => {
		const result: { modelName: string; providerName: ProviderName; tag?: string; isConfigured: boolean }[] = [];
		const seen = new Set<string>();

		// 1. Gather models configured by user in settings
		for (const pName of providerNames) {
			const providerSettings = settingsState.settingsOfProvider[pName];
			if (providerSettings && providerSettings.models) {
				const activeModels = providerSettings.models.filter(m => !m.isHidden);
				const providerTitle = displayInfoOfProviderName(pName)?.title || pName;
				for (const m of activeModels) {
					const key = `${pName}:${m.modelName}`;
					if (!seen.has(key)) {
						seen.add(key);
						result.push({
							modelName: m.modelName,
							providerName: pName,
							tag: providerTitle,
										isConfigured: !!providerSettings._didFillInProviderSettings,
						});
					}
				}
			}
		}

		// 2. Add built-in presets as secondary fallbacks if not already present
		for (const preset of builtInModelPresets) {
			const key = `${preset.providerName}:${preset.modelName}`;
			if (!seen.has(key)) {
				seen.add(key);
				result.push({
					...preset,
					isConfigured: false,
				});
			}
		}

		// Keep the active selection visible even when it is temporarily hidden in
		// provider settings, so a stale label can always be corrected from here.
		if (selection && !seen.has(`${selection.providerName}:${selection.modelName}`)) {
			result.unshift({
				modelName: selection.modelName,
				providerName: selection.providerName,
				tag: displayInfoOfProviderName(selection.providerName)?.title || selection.providerName,
				isConfigured: !!settingsState.settingsOfProvider[selection.providerName]?._didFillInProviderSettings,
			});
		}

		return result;
	}, [settingsState.settingsOfProvider, selection]);

	return (
		<div className="relative inline-block text-left shrink-0" ref={dropdownRef}>
			{/* Trigger Button matching Image 4 */}
			<button
				type="button"
				ref={triggerRef}
				onClick={toggleMenu}
				className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 border border-zinc-700/60 transition-all cursor-pointer max-w-[150px] shrink-0 min-w-0 ${className || ''}`}
				title={currentModelName}
			>
				<span className="truncate max-w-[110px] shrink min-w-0">{currentModelName}</span>
				{isOpen ? <ChevronUp size={12} className="opacity-70 shrink-0" /> : <ChevronDown size={12} className="opacity-70 shrink-0" />}
			</button>

			{/* Dropdown Panel matching Image 4 */}
			{isOpen && portalTarget && createPortal((
				<div ref={menuRef} className="fixed rounded-none bg-[#162238] border border-[#7c83ff]/60 shadow-2xl z-[9999] overflow-hidden text-[#edf4ff] animate-in fade-in zoom-in-95 duration-150" style={{ position: 'fixed', zIndex: 9999, left: menuPosition.left, top: menuPosition.top, width: menuPosition.width, maxHeight: 'calc(100vh - 16px)', background: '#162238', border: '1px solid #7c83ff', color: '#edf4ff', overflow: 'hidden', boxShadow: '0 16px 40px rgba(0, 0, 0, .5)' }}>
					{/* Header: Auto Mode Toggle */}
					<div className="p-2.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
						<div className="flex items-center gap-1.5">
							<Sparkles size={14} className="text-[#7c83ff]" />
							<span className="text-xs font-semibold text-zinc-200">Auto Mode</span>
						</div>
						<VoidSwitch size="xs" value={autoMode} onChange={setAutoMode} />
					</div>

					{/* Section Header */}
				<div className="px-3 pt-2 pb-1 flex items-center justify-between text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
					<span>Available Models ({allAvailableModels.length})</span>
					<Info size={11} className="text-zinc-500 cursor-help" />
				</div>

				{/* Model Items List */}
					<div className="max-h-56 overflow-y-auto py-1">
						{allAvailableModels.map((m) => {
							const isSelected = selection?.modelName === m.modelName && selection?.providerName === m.providerName;
							return (
								<button
									key={`${m.providerName}:${m.modelName}`}
									type="button"
								disabled={!m.isConfigured}
								onClick={() => { void selectModel(m.modelName, m.providerName); }}
									className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between transition-colors ${
										isSelected
											? 'bg-zinc-800/80 text-white font-medium'
											: m.isConfigured ? 'hover:bg-zinc-800/40 text-zinc-300' : 'text-zinc-600 cursor-not-allowed'
									}`}
									title={m.isConfigured ? `Use ${m.modelName}` : 'Add this provider API key in Settings first'}
								>
									<div className="flex items-center gap-1.5 min-w-0 pr-1">
										<span className="truncate">{m.modelName}</span>
										{m.tag && (
											<span className={`text-[9px] px-1 py-0.1 rounded shrink-0 font-normal ${
												m.isConfigured
													? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
													: 'bg-zinc-700/50 text-zinc-400'
											}`}>
												{m.tag}
											</span>
										)}
									</div>
									{isSelected ? <Check size={13} className="text-emerald-400 shrink-0" /> : !m.isConfigured ? <Lock size={11} className="text-zinc-600 shrink-0" /> : null}
								</button>
							);
						})}
					</div>

					{/* Footer: Add Model Button */}
					<div className="p-2 border-t border-zinc-800 bg-zinc-900/40">
						<button
							type="button"
							onClick={openSettings}
							className="w-full py-1 px-2.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-center text-zinc-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
						>
							<Plus size={12} />
							<span>Add / Manage Models</span>
						</button>
					</div>
				</div>
			), portalTarget)}
		</div>
	);
};

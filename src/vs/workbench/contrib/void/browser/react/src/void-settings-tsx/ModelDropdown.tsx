/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { displayInfoOfProviderName, FeatureName, featureNames, isFeatureNameDisabled, ModelSelection, modelSelectionsEqual, ProviderName, providerNames } from '../../../../../../../workbench/contrib/void/common/voidSettingsTypes.js';
import { useSettingsState, useRefreshModelState, useAccessor } from '../util/services.js';
import { VoidSwitch } from '../util/inputs.js';
import { VOID_OPEN_SETTINGS_ACTION_ID } from '../../../voidSettingsPane.js';
import { modelFilterOfFeatureName, ModelOption } from '../../../../../../../workbench/contrib/void/common/voidSettingsService.js';
import { WarningBox } from './WarningBox.js';
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js';
import { Check, ChevronDown, ChevronUp, Info, Plus, Sparkles } from 'lucide-react';

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

	const selection = voidSettingsService.state.modelSelectionOfFeature[featureName];
	const currentModelName = selection?.modelName || 'Claude 3.5 Sonnet';

	const openSettings = () => {
		commandService.executeCommand(VOID_OPEN_SETTINGS_ACTION_ID);
		setIsOpen(false);
	};

	// Close on outside click
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

	const selectModel = (modelName: string, providerName: ProviderName) => {
		voidSettingsService.setModelSelectionOfFeature(featureName, { modelName, providerName });
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
							isConfigured: true,
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

		return result;
	}, [settingsState.settingsOfProvider]);

	return (
		<div className="relative inline-block text-left shrink-0" ref={dropdownRef}>
			{/* Trigger Button matching Image 4 */}
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 border border-zinc-700/60 transition-all cursor-pointer max-w-[150px] shrink-0 min-w-0 ${className || ''}`}
				title={currentModelName}
			>
				<span className="truncate max-w-[110px] shrink min-w-0">{currentModelName}</span>
				{isOpen ? <ChevronUp size={12} className="opacity-70 shrink-0" /> : <ChevronDown size={12} className="opacity-70 shrink-0" />}
			</button>

			{/* Dropdown Panel matching Image 4 */}
			{isOpen && (
				<div className="absolute right-0 bottom-full mb-2 w-68 rounded-xl bg-[#18181b] border border-zinc-700/80 shadow-2xl z-[9999] overflow-hidden text-zinc-200 animate-in fade-in zoom-in-95 duration-150">
					{/* Header: Auto Mode Toggle */}
					<div className="p-2.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
						<div className="flex items-center gap-1.5">
							<Sparkles size={14} className="text-emerald-400" />
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
									onClick={() => selectModel(m.modelName, m.providerName)}
									className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between transition-colors ${
										isSelected
											? 'bg-zinc-800/80 text-white font-medium'
											: 'hover:bg-zinc-800/40 text-zinc-300'
									}`}
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
									{isSelected && <Check size={13} className="text-emerald-400 shrink-0" />}
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
			)}
		</div>
	);
};

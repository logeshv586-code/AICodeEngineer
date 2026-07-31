/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FeatureName, featureNames, isFeatureNameDisabled, ModelSelection, modelSelectionsEqual, ProviderName, providerNames } from '../../../../../../../workbench/contrib/void/common/voidSettingsTypes.js';
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
	const currentModelName = selection?.modelName || 'GPT-5.4';

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

	return (
		<div className="relative inline-block text-left" ref={dropdownRef}>
			{/* Trigger Button matching Image 4 */}
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-void-bg-2 hover:bg-void-bg-2/80 text-void-fg-1 border border-void-border-2 transition-all cursor-pointer ${className || ''}`}
			>
				<span>{currentModelName}</span>
				{isOpen ? <ChevronUp size={13} className="opacity-70" /> : <ChevronDown size={13} className="opacity-70" />}
			</button>

			{/* Dropdown Panel matching Image 4 */}
			{isOpen && (
				<div className="absolute right-0 bottom-full mb-2 w-72 rounded-xl bg-[#18181b] border border-zinc-700/80 shadow-2xl z-[9999] overflow-hidden text-zinc-200 animate-in fade-in zoom-in-95 duration-150">
					{/* Header: Auto Mode Toggle */}
					<div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
						<div className="flex items-center gap-2">
							<Sparkles size={15} className="text-emerald-400" />
							<span className="text-xs font-semibold text-zinc-200">Auto Mode</span>
						</div>
						<VoidSwitch size="xs" value={autoMode} onChange={setAutoMode} />
					</div>

					{/* Section Header: Built-in Models */}
					<div className="px-3 pt-3 pb-1.5 flex items-center gap-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
						<span>Built-in Models</span>
						<Info size={12} className="text-zinc-500 cursor-help" />
					</div>

					{/* Model Items List */}
					<div className="max-h-60 overflow-y-auto py-1">
						{builtInModelPresets.map((m) => {
							const isSelected = currentModelName === m.modelName;
							return (
								<button
									key={m.modelName}
									type="button"
									onClick={() => selectModel(m.modelName, m.providerName)}
									className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors ${
										isSelected
											? 'bg-zinc-800/80 text-white font-medium'
											: 'hover:bg-zinc-800/40 text-zinc-300'
									}`}
								>
									<div className="flex items-center gap-2">
										<span>{m.modelName}</span>
										{m.tag && (
											<span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-normal">
												{m.tag}
											</span>
										)}
									</div>
									{isSelected && <Check size={14} className="text-emerald-400" />}
								</button>
							);
						})}
					</div>

					{/* Footer: Add Model Button */}
					<div className="p-2 border-t border-zinc-800 bg-zinc-900/40">
						<button
							type="button"
							onClick={openSettings}
							className="w-full py-1.5 px-3 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-center text-zinc-200 transition-colors flex items-center justify-center gap-1.5"
						>
							<Plus size={13} />
							<span>Add Model</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

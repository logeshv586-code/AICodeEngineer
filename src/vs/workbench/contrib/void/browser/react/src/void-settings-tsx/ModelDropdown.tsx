/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { displayInfoOfProviderName, FeatureName, ProviderName, providerNames, isModelConfigured } from '../../../../../../../workbench/contrib/void/common/voidSettingsTypes.js';
import { useSettingsState, useAccessor } from '../util/services.tsx';
import { VoidSwitch } from '../util/inputs.tsx';
import { VOID_OPEN_SETTINGS_ACTION_ID } from '../../../voidSettingsPane.js';
import { Check, ChevronDown, ChevronUp, Info, Lock, Plus, Sparkles } from 'lucide-react';

const builtInModelPresets: { modelName: string; providerName: ProviderName; tag?: string }[] = [
	{ modelName: 'GPT-5.4', providerName: 'openAI', tag: 'Beta' },
	{ modelName: 'GPT-5.2', providerName: 'openAI' },
	{ modelName: 'z-ai/glm-5.2', providerName: 'nvidia', tag: 'NVIDIA' },
	{ modelName: 'Nemotron 3B Ultra', providerName: 'nvidia', tag: 'NVIDIA' },
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

type MenuPosition = {
	left: number;
	top: number;
	width: number;
	maxHeight: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const ModelDropdown = ({ featureName, className }: { featureName: FeatureName; className: string }) => {
	const settingsState = useSettingsState();
	const accessor = useAccessor();
	const voidSettingsService = accessor.get('IVoidSettingsService');
	const commandService = accessor.get('ICommandService');
	const [searchQuery, setSearchQuery] = useState('');
	const [isOpen, setIsOpen] = useState(false);
	const autoMode = settingsState.globalSettings.autoModelSelection;
	const dropdownRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const [menuPosition, setMenuPosition] = useState<MenuPosition>({ left: 8, top: 8, width: 280, maxHeight: 420 });
	const selection = settingsState.modelSelectionOfFeature[featureName];

	const configuredProviderNames = useMemo(
		() => providerNames.filter(providerName => settingsState.settingsOfProvider[providerName].models.some(model => isModelConfigured(providerName, model, settingsState.settingsOfProvider))),
		[settingsState.settingsOfProvider],
	);
	const currentModelName = autoMode
		? 'Auto'
		: selection?.modelName || (configuredProviderNames.length === 0 ? 'Connect API in Settings' : 'Select a model');

	// React utility classes are scoped under .void-scope. Keep the popup in that
	// scope so it does not lose layout/scroll styles when rendered as a portal.
	const portalTarget = typeof document === 'undefined' ? null : (document.querySelector<HTMLElement>('.void-scope') ?? document.body);

	const openSettings = () => {
		void commandService.executeCommand(VOID_OPEN_SETTINGS_ACTION_ID);
		setIsOpen(false);
	};

	const updatePosition = () => {
		const rect = triggerRef.current?.getBoundingClientRect();
		if (!rect) return;
		const padding = 10;
		const gap = 7;
		const width = Math.min(300, Math.max(236, window.innerWidth - padding * 2));
		const spaceAbove = Math.max(0, rect.top - padding - gap);
		const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - padding - gap);
		const openAbove = spaceAbove >= 260 || spaceAbove >= spaceBelow;
		const availableHeight = openAbove ? spaceAbove : spaceBelow;
		const maxHeight = Math.max(210, Math.min(440, availableHeight || window.innerHeight - padding * 2));
		const left = clamp(rect.right - width, padding, Math.max(padding, window.innerWidth - width - padding));
		const top = openAbove
			? clamp(rect.top - gap - maxHeight, padding, Math.max(padding, window.innerHeight - maxHeight - padding))
			: clamp(rect.bottom + gap, padding, Math.max(padding, window.innerHeight - maxHeight - padding));
		setMenuPosition({ left, top, width, maxHeight });
	};

	useEffect(() => {
		if (!isOpen) return;
		updatePosition();
		const focusId = window.setTimeout(() => searchRef.current?.focus(), 0);
		const onResize = () => updatePosition();
		window.addEventListener('resize', onResize);
		window.addEventListener('scroll', onResize, true);
		return () => {
			window.clearTimeout(focusId);
			window.removeEventListener('resize', onResize);
			window.removeEventListener('scroll', onResize, true);
		};
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;
		const handleClickOutside = (event: MouseEvent) => {
			if (!dropdownRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setIsOpen(false);
		};
		document.addEventListener('mousedown', handleClickOutside, true);
		return () => document.removeEventListener('mousedown', handleClickOutside, true);
	}, [isOpen]);

	const toggleMenu = () => {
		if (!isOpen) setSearchQuery('');
		setIsOpen(open => !open);
	};

	const selectModel = async (modelName: string, providerName: ProviderName) => {
		const providerSettings = settingsState.settingsOfProvider[providerName];
		const existing = providerSettings?.models.find(model => model.modelName === modelName);
		const tempModel = existing ?? { modelName, type: 'custom' as const, isHidden: false };
		if (!isModelConfigured(providerName, tempModel, settingsState.settingsOfProvider)) {
			openSettings();
			return;
		}
		if (!existing || existing.isHidden) {
			const models = existing
				? providerSettings.models.map(model => model.modelName === modelName ? { ...model, isHidden: false } : model)
				: [...providerSettings.models, { modelName, type: 'custom' as const, isHidden: false }];
			await voidSettingsService.setSettingOfProvider(providerName, 'models', models);
		}
		await voidSettingsService.setModelSelectionOfFeature(featureName, { modelName, providerName });
		await voidSettingsService.setGlobalSetting('autoModelSelection', false);
		setIsOpen(false);
	};

	const allAvailableModels = useMemo(() => {
		const result: { modelName: string; providerName: ProviderName; tag?: string; isConfigured: boolean }[] = [];
		const seen = new Set<string>();
		for (const providerName of providerNames) {
			const providerSettings = settingsState.settingsOfProvider[providerName];
			for (const model of providerSettings?.models?.filter(model => !model.isHidden) ?? []) {
				const key = `${providerName}:${model.modelName}`;
				if (seen.has(key)) continue;
				seen.add(key);
				result.push({
					modelName: model.modelName,
					providerName,
					tag: displayInfoOfProviderName(providerName)?.title || providerName,
					isConfigured: isModelConfigured(providerName, model, settingsState.settingsOfProvider),
				});
			}
		}
		for (const preset of builtInModelPresets) {
			const key = `${preset.providerName}:${preset.modelName}`;
			if (seen.has(key)) continue;
			seen.add(key);
			const existing = settingsState.settingsOfProvider[preset.providerName]?.models.find(model => model.modelName === preset.modelName)
				?? { modelName: preset.modelName, type: 'custom' as const, isHidden: false };
			result.push({ ...preset, isConfigured: isModelConfigured(preset.providerName, existing, settingsState.settingsOfProvider) });
		}
		if (selection && !seen.has(`${selection.providerName}:${selection.modelName}`)) {
			const model = settingsState.settingsOfProvider[selection.providerName].models.find(item => item.modelName === selection.modelName)
				?? { modelName: selection.modelName, type: 'custom' as const, isHidden: false };
			result.unshift({
				modelName: selection.modelName,
				providerName: selection.providerName,
				tag: displayInfoOfProviderName(selection.providerName)?.title || selection.providerName,
				isConfigured: isModelConfigured(selection.providerName, model, settingsState.settingsOfProvider),
			});
		}
		return result;
	}, [settingsState.settingsOfProvider, selection]);

	const filteredModels = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		if (!query) return allAvailableModels;
		return allAvailableModels.filter(model => `${model.modelName} ${model.providerName} ${model.tag ?? ''}`.toLowerCase().includes(query));
	}, [allAvailableModels, searchQuery]);

	return <div className='relative inline-block text-left shrink-0' ref={dropdownRef}>
		<button
			type='button'
			ref={triggerRef}
			onClick={toggleMenu}
			className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 border border-zinc-700/60 transition-all cursor-pointer max-w-[150px] shrink-0 min-w-0 ${className || ''}`}
			title={currentModelName}
			aria-expanded={isOpen}
		>
			<span className='truncate max-w-[110px] shrink min-w-0'>{currentModelName}</span>
			{isOpen ? <ChevronUp size={12} className='opacity-70 shrink-0' /> : <ChevronDown size={12} className='opacity-70 shrink-0' />}
		</button>

		{isOpen && portalTarget && createPortal(
			<div
				ref={menuRef}
				className='fixed z-[10040] flex flex-col overflow-hidden rounded-xl border border-[#7c83ff]/55 bg-[#111827] text-[#edf4ff] shadow-2xl'
				style={{ position: 'fixed', zIndex: 10040, left: menuPosition.left, top: menuPosition.top, width: menuPosition.width, maxHeight: menuPosition.maxHeight }}
				onWheel={event => event.stopPropagation()}
			>
				<div className='shrink-0 p-2.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60'>
					<div className='flex items-center gap-1.5'><Sparkles size={14} className='text-[#7c83ff]' /><span className='text-xs font-semibold text-zinc-200'>Auto Mode</span></div>
					<VoidSwitch size='xs' value={autoMode} onChange={enabled => { void voidSettingsService.setGlobalSetting('autoModelSelection', enabled); }} />
				</div>
				{autoMode && <div className='shrink-0 px-3 py-1.5 border-b border-zinc-800 text-[10px] text-emerald-300'>Auto selects the best configured model. Current: {selection?.modelName || 'waiting for a task'}</div>}
				<div className='shrink-0 px-3 pt-2 pb-1 flex items-center justify-between text-[10px] font-semibold text-zinc-400 uppercase tracking-wider'>
					<span>Available Models</span><Info size={11} className='text-zinc-500' title='Configured models are selectable. Locked models need provider credentials.' />
				</div>
				<div className='shrink-0 px-2 py-1.5 border-b border-zinc-800'>
					<input ref={searchRef} type='text' placeholder='Search model…' value={searchQuery} onChange={event => setSearchQuery(event.target.value)} className='w-full bg-zinc-900 border border-zinc-700/60 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#7c83ff]' />
				</div>
				<div className='min-h-0 flex-1 overflow-y-auto overscroll-contain py-1' style={{ scrollbarGutter: 'stable', overscrollBehavior: 'contain' }}>
					{filteredModels.length === 0 ? <div className='px-3 py-5 text-center text-xs text-zinc-500'>No models match this search.</div> : filteredModels.map(model => {
						const isSelected = selection?.modelName === model.modelName && selection?.providerName === model.providerName;
						return <button
							key={`${model.providerName}:${model.modelName}`}
							type='button'
							disabled={!model.isConfigured}
							onClick={() => { void selectModel(model.modelName, model.providerName); }}
							className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 transition-colors ${isSelected ? 'bg-zinc-800/90 text-white font-medium' : model.isConfigured ? 'hover:bg-zinc-800/60 text-zinc-300' : 'text-zinc-600 cursor-not-allowed'}`}
							title={model.isConfigured ? `Use ${model.modelName}` : 'Add this provider API key in Settings first'}
						>
							<div className='flex min-w-0 items-center gap-1.5'><span className='truncate'>{model.modelName}</span>{model.tag && <span className={`shrink-0 rounded px-1 text-[9px] font-normal ${model.isConfigured ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{model.tag}</span>}</div>
							{isSelected ? <Check size={13} className='text-emerald-400 shrink-0' /> : !model.isConfigured ? <Lock size={11} className='text-zinc-600 shrink-0' /> : null}
						</button>;
					})}
				</div>
				<div className='shrink-0 p-2 border-t border-zinc-800 bg-zinc-950/50'>
					<button type='button' onClick={openSettings} className='w-full py-1.5 px-2.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-center text-zinc-200 transition-colors flex items-center justify-center gap-1.5'><Plus size={12} /><span>Add / Manage Models</span></button>
				</div>
			</div>,
			portalTarget,
		)}
	</div>;
};

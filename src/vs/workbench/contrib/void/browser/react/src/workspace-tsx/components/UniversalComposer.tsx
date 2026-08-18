/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Send, Square, Paperclip, Mic, Image as ImageIcon, AtSign, WandSparkles, Code2, Palette, ChevronDown, ChevronUp } from 'lucide-react';
import { VoidInputBox2, TextAreaFns } from '../../util/inputs.tsx';
import { SlashCommand, getSlashCommands } from '../utils/slashCommands.js';
import { ModelCapability } from '../utils/modelCapabilityManifest.js';
import { ModelDropdown } from '../../void-settings-tsx/ModelDropdown.tsx';
import { FeatureName } from '../../../../common/voidSettingsTypes.js';
import { useAccessor, useSettingsState } from '../../util/services.tsx';

const FILE_ACCEPT = 'image/*,.pdf,.txt,.md,.js,.mjs,.cjs,.ts,.tsx,.jsx,.py,.json,.jsonl,.css,.scss,.html,.svg,.xml,.yaml,.yml,.toml,.rs,.go,.java,.kt,.kts,.c,.h,.cpp,.hpp,.cs,.php,.rb,.sh,.ps1,.sql';

interface UniversalComposerProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	onAbort: () => void;
	isStreaming: boolean;
	isDisabled?: boolean;
	placeholder?: string;
	featureName: FeatureName;
	capabilities: ModelCapability;
	attachments: { uri: string; dataUrl: string; mimeType: string }[];
	onAddAttachment: (attachment: { uri: string; dataUrl: string; mimeType: string }) => void;
	onRemoveAttachment: (index: number) => void;
	textAreaFnsRef: React.MutableRefObject<TextAreaFns | null>;
	agentName?: string;
	agentOptions?: { id: string; name: string }[];
	selectedAgentId?: string;
	onAgentChange?: (id: string) => void;
	tokenCount?: number;
	maxTokens?: number;
	slashCommandsEnabled?: boolean;
	voiceEnabled?: boolean;
	isListening?: boolean;
	onVoiceToggle?: () => void;
	artEnabled?: boolean;
	onArtToggle?: () => void;
	codeEnabled?: boolean;
	onCodeToggle?: () => void;
}

export const UniversalComposer: React.FC<UniversalComposerProps> = ({
	value,
	onChange,
	onSubmit,
	onAbort,
	isStreaming,
	isDisabled = false,
	placeholder = 'Type a message...',
	featureName = 'Chat',
	attachments,
	onAddAttachment,
	onRemoveAttachment,
	textAreaFnsRef,
	agentName = 'Forge Agent',
	agentOptions = [],
	selectedAgentId,
	onAgentChange,
	tokenCount,
	maxTokens,
	slashCommandsEnabled = true,
	voiceEnabled = false,
	isListening = false,
	onVoiceToggle,
	artEnabled = false,
	codeEnabled = false,
}) => {
	const accessor = useAccessor();
	const settingsState = useSettingsState();
	const [isSlashOpen, setIsSlashOpen] = useState(false);
	const [slashQuery, setSlashQuery] = useState('');
	const [isExpanded, setIsExpanded] = useState(false);
	const [showArtPanel, setShowArtPanel] = useState(false);
	const [showCodePanel, setShowCodePanel] = useState(false);
	const [artPrompt, setArtPrompt] = useState('');
	const [codeSnippet, setCodeSnippet] = useState('');
	const [attachmentAccept, setAttachmentAccept] = useState(FILE_ACCEPT);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const openAttachmentPicker = useCallback((kind: 'file' | 'image' = 'file') => {
		setAttachmentAccept(kind === 'image' ? 'image/*' : FILE_ACCEPT);
		window.setTimeout(() => fileInputRef.current?.click(), 0);
	}, []);

	useEffect(() => {
		const handler = (event: Event) => {
			const detail = (event as CustomEvent<{ kind?: 'file' | 'image' }>).detail;
			openAttachmentPicker(detail?.kind === 'image' ? 'image' : 'file');
		};
		window.addEventListener('forge:open-attachment-picker', handler);
		return () => window.removeEventListener('forge:open-attachment-picker', handler);
	}, [openAttachmentPicker]);

	const slashCommands = getSlashCommands();
	const filteredCommands = slashQuery
		? slashCommands.filter(command => command.name.toLowerCase().includes(slashQuery.toLowerCase()) || command.label.toLowerCase().includes(slashQuery.toLowerCase()) || command.category.toLowerCase().includes(slashQuery.toLowerCase()))
		: slashCommands;

	const handleSlashSelect = useCallback(async (command: SlashCommand) => {
		try { await command.execute('', accessor); }
		catch (error) { accessor.get('INotificationService').error(`/${command.name} failed: ${error instanceof Error ? error.message : String(error)}`); }
		setIsSlashOpen(false);
		setSlashQuery('');
	}, [accessor]);

	const handleTextareaKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === '/' && !value && !isSlashOpen) {
			event.preventDefault(); setIsSlashOpen(true); setSlashQuery(''); return;
		}
		if (event.key === 'Escape' && isSlashOpen) {
			setIsSlashOpen(false); setSlashQuery(''); return;
		}
		if (isSlashOpen && filteredCommands.length > 0 && event.key === 'Enter') {
			event.preventDefault(); void handleSlashSelect(filteredCommands[0]); return;
		}
		if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
			event.preventDefault();
			if (!isDisabled && (value.trim() || attachments.length > 0)) onSubmit();
		}
	}, [attachments.length, filteredCommands, handleSlashSelect, isDisabled, isSlashOpen, onSubmit, value]);

	const tokenPercentage = maxTokens && tokenCount !== undefined ? Math.min((tokenCount / maxTokens) * 100, 100) : 0;
	const tokenColor = tokenPercentage > 90 ? 'bg-red-500' : tokenPercentage > 70 ? 'bg-amber-500' : 'bg-emerald-500';

	const addFiles = useCallback((files: File[]) => {
		files.forEach(file => {
			const reader = new FileReader();
			reader.onload = event => onAddAttachment({ uri: (file as File & { path?: string }).path || file.name, dataUrl: String(event.target?.result || ''), mimeType: file.type || 'application/octet-stream' });
			reader.readAsDataURL(file);
		});
	}, [onAddAttachment]);

	const handleFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		addFiles(Array.from(event.target.files || []));
		event.target.value = '';
	}, [addFiles]);

	const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault(); addFiles(Array.from(event.dataTransfer.files || []));
	}, [addFiles]);

	const preparePrompt = useCallback((prompt: string) => {
		onChange(prompt); textAreaFnsRef.current?.setValue(prompt); textAreaFnsRef.current?.focus();
	}, [onChange, textAreaFnsRef]);

	const enhancePrompt = useCallback(() => {
		if (!value.trim()) return;
		preparePrompt(`Improve and execute this coding request. Preserve the intent, add precise acceptance criteria, identify likely files or symbols, make the changes, and verify them:\n\n${value.trim()}`);
	}, [preparePrompt, value]);

	const prepareArtTask = useCallback(() => {
		const prompt = artPrompt.trim(); if (!prompt) return;
		preparePrompt(`Create this visual/design task using Open Design and the available Forge design/browser tools. Keep editable source artifacts in the workspace, preview the result, and verify it visually:\n\n${prompt}`);
		setArtPrompt(''); setShowArtPanel(false);
	}, [artPrompt, preparePrompt]);

	const prepareCodeRun = useCallback(() => {
		const code = codeSnippet.trim(); if (!code) return;
		preparePrompt(`Execute and verify the following code using the appropriate terminal/runtime tools. Do not use unsafe in-renderer evaluation. Explain any failure, fix it if appropriate, and show the verified result:\n\n\`\`\`\n${code}\n\`\`\``);
		setCodeSnippet(''); setShowCodePanel(false);
	}, [codeSnippet, preparePrompt]);

	const canSubmit = !isDisabled && (value.trim().length > 0 || attachments.length > 0);

	return (
		<div className='relative w-full forge-coco-composer' onDragOver={event => event.preventDefault()} onDrop={handleDrop}>
			<input ref={fileInputRef} type='file' multiple accept={attachmentAccept} className='hidden' onChange={handleFileInput} />

			{isSlashOpen && (
				<div className='absolute bottom-full left-0 mb-2 w-72 bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-xl z-50 overflow-hidden'>
					<div className='px-3 py-2 border-b border-zinc-700/60'><input type='text' value={slashQuery} onChange={event => setSlashQuery(event.target.value)} placeholder='Type a command…' className='w-full bg-transparent text-zinc-200 text-sm outline-none placeholder:text-zinc-600' autoFocus /></div>
					<div className='max-h-64 overflow-y-auto'>{filteredCommands.length === 0 ? <div className='px-3 py-2 text-xs text-zinc-500'>No commands found</div> : filteredCommands.map(command => <button key={command.name} type='button' onClick={() => void handleSlashSelect(command)} className='w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 transition-colors text-left'><span className='text-xs font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded'>/{command.name}</span><span className='text-xs text-zinc-300'>{command.label}</span></button>)}</div>
				</div>
			)}

			{showArtPanel && artEnabled && (
				<div className='mb-2 p-2 rounded-lg bg-zinc-900/60 border border-zinc-700/60'>
					<div className='flex items-center justify-between mb-1'><span className='text-xs font-medium text-zinc-300'>Design task</span><button type='button' onClick={() => setShowArtPanel(false)} className='text-zinc-500 hover:text-zinc-300 text-xs'><ChevronUp size={12} /></button></div>
					<textarea value={artPrompt} onChange={event => setArtPrompt(event.target.value)} placeholder='Describe the prototype, visual, deck, or design…' className='w-full bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700/60 focus:border-zinc-500 outline-none placeholder:text-zinc-600 resize-none h-16' />
					<button type='button' onClick={prepareArtTask} disabled={!artPrompt.trim()} className='mt-1 px-3 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors cursor-pointer disabled:opacity-40'>Use in task</button>
				</div>
			)}

			{showCodePanel && codeEnabled && (
				<div className='mb-2 p-2 rounded-lg bg-zinc-900/60 border border-zinc-700/60'>
					<div className='flex items-center justify-between mb-1'><span className='text-xs font-medium text-zinc-300'>Safe code execution task</span><button type='button' onClick={() => setShowCodePanel(false)} className='text-zinc-500 hover:text-zinc-300 text-xs'><ChevronUp size={12} /></button></div>
					<textarea value={codeSnippet} onChange={event => setCodeSnippet(event.target.value)} placeholder='Enter code or a command for the agent to execute and verify…' className='w-full bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700/60 focus:border-zinc-500 outline-none placeholder:text-zinc-600 resize-none h-16 font-mono' />
					<button type='button' onClick={prepareCodeRun} disabled={!codeSnippet.trim()} className='mt-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors cursor-pointer disabled:opacity-40'>Prepare run</button>
				</div>
			)}

			{attachments.length > 0 && <div className='flex flex-wrap gap-1 mb-2'>{attachments.map((attachment, index) => <div key={`${attachment.uri}-${index}`} className='forge-coco-attachment flex items-center gap-1 px-2 py-0.5 rounded text-xs'>{attachment.mimeType.startsWith('image/') && attachment.dataUrl ? <img src={attachment.dataUrl} alt='' className='h-5 w-5 rounded object-cover' /> : <Paperclip size={10} />}<span className='truncate max-w-[120px]'>{attachment.uri.split(/[\\/]/).pop()}</span><button type='button' onClick={() => onRemoveAttachment(index)} className='forge-coco-remove text-zinc-600 hover:text-zinc-400'>×</button></div>)}</div>}

			{maxTokens && tokenCount !== undefined && <div className='flex items-center gap-2 mb-1'><div className='flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden'><div className={`h-full rounded-full transition-all duration-300 ${tokenColor}`} style={{ width: `${tokenPercentage}%` }} /></div><span className='text-[10px] text-zinc-500 shrink-0'>{tokenCount} / {maxTokens} tokens</span></div>}

			<div className='relative rounded-xl bg-zinc-900/80 border border-zinc-700/60 focus-within:border-zinc-500/60 transition-colors'>
				<div className='flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800/80'>
					<label className='flex min-w-0 items-center gap-1 text-xs text-zinc-300'><AtSign size={13} className='text-[var(--forge-coco-cloud)]' /><span className='text-zinc-500'>Agent</span>{agentOptions.length > 0 ? <select value={selectedAgentId ?? agentOptions[0].id} onChange={event => onAgentChange?.(event.target.value)} className='max-w-[150px] truncate bg-transparent font-medium text-zinc-200 outline-none'>{agentOptions.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select> : <span className='truncate font-medium'>{agentName}</span>}</label>
					<span className='shrink-0 text-[10px] text-zinc-500'>{settingsState.globalSettings.chatMode === 'normal' ? 'Chat' : settingsState.globalSettings.chatMode === 'gather' ? 'Gather' : 'Agent'} <span className='text-[var(--forge-coco-accent)]'>✦</span></span>
				</div>

				{isExpanded && <div className='flex items-center gap-1 px-2 pt-1.5 border-b border-zinc-800/50 pb-1.5'>
					{slashCommandsEnabled && <button type='button' onClick={() => setIsSlashOpen(!isSlashOpen)} className='px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded' title='Slash commands'>/</button>}
					<button type='button' onClick={() => textAreaFnsRef.current?.triggerMention()} className='p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded' title='Reference files or folders'><AtSign size={14} /></button>
					<button type='button' onClick={() => openAttachmentPicker('file')} className='p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded' title='Attach file'><Paperclip size={14} /></button>
					<button type='button' onClick={enhancePrompt} disabled={!value.trim()} className='p-1 text-lime-300/70 hover:text-lime-200 hover:bg-lime-300/10 rounded disabled:opacity-30' title='Enhance prompt'><WandSparkles size={14} /></button>
					{voiceEnabled && onVoiceToggle && <button type='button' onClick={onVoiceToggle} className={`p-1 rounded ${isListening ? 'bg-red-600 text-white animate-pulse' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`} title={isListening ? 'Stop voice input' : 'Voice input'}><Mic size={14} /></button>}
					{artEnabled && <button type='button' onClick={() => setShowArtPanel(value => !value)} className={`p-1 rounded ${showArtPanel ? 'bg-purple-600/30 text-purple-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`} title='Design task'><Palette size={14} /></button>}
					{codeEnabled && <button type='button' onClick={() => setShowCodePanel(value => !value)} className={`p-1 rounded ${showCodePanel ? 'bg-blue-600/30 text-blue-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`} title='Code execution task'><Code2 size={14} /></button>}
				</div>}

				<VoidInputBox2 className='w-full min-h-[40px] max-h-[200px] px-3 py-2 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 resize-none text-zinc-200 placeholder:text-zinc-600' placeholder={placeholder} multiline={true} enableAtToMention={true} fnsRef={textAreaFnsRef} onChangeText={onChange} onKeyDown={handleTextareaKeyDown} />

				<div className='flex items-center justify-between px-2 py-1.5 border-t border-zinc-700/60'>
					<div className='flex items-center gap-1'>
						<button type='button' onClick={() => textAreaFnsRef.current?.triggerMention()} className='p-1 text-zinc-500 hover:text-zinc-300 rounded' title='Reference files or folders'><AtSign size={13} /></button>
						<button type='button' onClick={() => openAttachmentPicker('image')} className='p-1 text-zinc-500 hover:text-zinc-300 rounded' title='Attach image'><ImageIcon size={13} /></button>
						<button type='button' onClick={() => setIsExpanded(value => !value)} className='p-1 text-zinc-500 hover:text-zinc-300 rounded' title={isExpanded ? 'Hide tools' : 'More tools'}>{isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
						<ModelDropdown featureName={featureName} className='forge-coco-model-trigger max-w-[155px]' />
					</div>
					<div className='flex items-center gap-1'>
						{isStreaming && <button type='button' onClick={onAbort} data-action='abort' className='flex items-center gap-1 px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg'><Square size={12} />Stop</button>}
						<button type='button' onClick={onSubmit} data-action='submit' disabled={!canSubmit} className='flex items-center gap-1 px-3 py-1 text-xs bg-[var(--forge-coco-accent)] hover:bg-[#9297ff] text-slate-950 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed'><Send size={12} />{isStreaming ? 'Queue' : 'Send'}</button>
					</div>
				</div>
			</div>
		</div>
	);
};
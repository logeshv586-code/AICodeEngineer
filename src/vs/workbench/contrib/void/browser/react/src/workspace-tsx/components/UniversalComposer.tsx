/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Send, Square, Upload, Paperclip, Mic, Image as ImageIcon, AtSign, WandSparkles, Code2, Palette, Zap, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { VoidInputBox2 } from '../../util/inputs.tsx';
import { TextAreaFns } from '../../util/inputs.tsx';
import { SlashCommand, getSlashCommands } from '../utils/slashCommands.js';
import { ModelCapability } from '../utils/modelCapabilityManifest.js';
import { ModelDropdown } from '../../void-settings-tsx/ModelDropdown.tsx';
import { FeatureName } from '../../../../common/voidSettingsTypes.js';
import { useAccessor } from '../../util/services.tsx';

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
  capabilities,
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
  onArtToggle,
  codeEnabled = false,
  onCodeToggle,
}) => {
	const accessor = useAccessor();
  const [isSlashOpen, setIsSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showArtPanel, setShowArtPanel] = useState(false);
  const [showCodePanel, setShowCodePanel] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const slashCommands = getSlashCommands();
  const filteredCommands = slashQuery
    ? slashCommands.filter(cmd =>
        cmd.name.toLowerCase().includes(slashQuery.toLowerCase()) ||
        cmd.label.toLowerCase().includes(slashQuery.toLowerCase()) ||
        cmd.category.toLowerCase().includes(slashQuery.toLowerCase())
      )
    : slashCommands;

  const handleSlashSelect = useCallback((command: SlashCommand) => {
    command.execute('', accessor);
    setIsSlashOpen(false);
    setSlashQuery('');
  }, [accessor]);

  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === '/' && !value && !isSlashOpen) {
      e.preventDefault();
      setIsSlashOpen(true);
      setSlashQuery('');
      return;
    }
    if (e.key === 'Escape' && isSlashOpen) {
      setIsSlashOpen(false);
      setSlashQuery('');
      return;
    }
    if (isSlashOpen && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSlashSelect(filteredCommands[0]);
        return;
      }
    }
		if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault();
			if (!isStreaming && !isDisabled && value.trim()) onSubmit();
		}
	}, [value, isSlashOpen, filteredCommands, handleSlashSelect, isStreaming, isDisabled, onSubmit]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (isSlashOpen && newValue.startsWith('/')) {
      setSlashQuery(newValue.slice(1));
    } else if (isSlashOpen) {
      setIsSlashOpen(false);
      setSlashQuery('');
    }
  }, [onChange, isSlashOpen]);

  const tokenPercentage = maxTokens && tokenCount !== undefined
    ? Math.min((tokenCount / maxTokens) * 100, 100)
    : 0;

  const tokenColor = tokenPercentage > 90 ? 'bg-red-500' : tokenPercentage > 70 ? 'bg-amber-500' : 'bg-emerald-500';

  const addFiles = useCallback((files: File[]) => {
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = event => onAddAttachment({
        uri: (file as File & { path?: string }).path || file.name,
        dataUrl: String(event.target?.result || ''),
        mimeType: file.type || 'application/octet-stream',
      });
      reader.readAsDataURL(file);
    });
  }, [onAddAttachment]);

  const handleFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files || []));
    event.target.value = '';
  }, [addFiles]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files || []));
  }, [addFiles]);

  const enhancePrompt = useCallback(() => {
    if (!value.trim()) return;
    onChange(`Improve this request for a coding agent. Preserve the intent, add precise acceptance criteria, and identify the files or symbols likely involved:\n\n${value.trim()}`);
  }, [onChange, value]);

  return (
    <div ref={containerRef} className="relative w-full forge-coco-composer" onDragOver={event => event.preventDefault()} onDrop={handleDrop}>
      <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.js,.ts,.tsx,.jsx,.py,.json,.css,.html,.svg" className="hidden" onChange={handleFileInput} />
      {/* Slash command palette */}
      {isSlashOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-700/60">
            <input
              type="text"
              value={slashQuery}
              onChange={(e) => setSlashQuery(e.target.value)}
              placeholder="Type a command..."
              className="w-full bg-transparent text-zinc-200 text-sm outline-none placeholder:text-zinc-600"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredCommands.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-500">No commands found</div>
            ) : (
              filteredCommands.map(cmd => (
                <button
                  key={cmd.name}
                  type="button"
                  onClick={() => handleSlashSelect(cmd)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 transition-colors text-left"
                >
                  <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">/{cmd.name}</span>
                  <span className="text-xs text-zinc-300">{cmd.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Art panel */}
      {showArtPanel && artEnabled && (
        <div className="mb-2 p-2 rounded-lg bg-zinc-900/60 border border-zinc-700/60">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-zinc-300">Art Generation</span>
            <button type="button" onClick={() => setShowArtPanel(false)} className="text-zinc-500 hover:text-zinc-300 text-xs">
              <ChevronUp size={12} />
            </button>
          </div>
          <textarea
            placeholder="Describe the art you want to generate..."
            className="w-full bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700/60 focus:border-zinc-500 outline-none placeholder:text-zinc-600 resize-none h-16"
          />
          <button
            type="button"
            className="mt-1 px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors cursor-pointer"
          >
            Generate
          </button>
        </div>
      )}

      {/* Code panel */}
      {showCodePanel && codeEnabled && (
        <div className="mb-2 p-2 rounded-lg bg-zinc-900/60 border border-zinc-700/60">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-zinc-300">Code Execution</span>
            <button type="button" onClick={() => setShowCodePanel(false)} className="text-zinc-500 hover:text-zinc-300 text-xs">
              <ChevronUp size={12} />
            </button>
          </div>
          <textarea
            placeholder="Enter code to execute..."
            className="w-full bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700/60 focus:border-zinc-500 outline-none placeholder:text-zinc-600 resize-none h-16 font-mono"
          />
          <button
            type="button"
            className="mt-1 px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors cursor-pointer"
          >
            Run
          </button>
        </div>
      )}

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {attachments.map((att, i) => (
            <div
              key={i}
              className="forge-coco-attachment flex items-center gap-1 px-2 py-0.5 rounded text-xs"
            >
              {att.mimeType.startsWith('image/') && att.dataUrl ? <img src={att.dataUrl} alt="" className="h-5 w-5 rounded object-cover" /> : <Paperclip size={10} />}
              <span className="truncate max-w-[120px]">{att.uri.split(/[\\/]/).pop()}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(i)}
                className="forge-coco-remove text-zinc-600 hover:text-zinc-400"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Token counter */}
      {maxTokens && tokenCount !== undefined && (
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${tokenColor}`}
              style={{ width: `${tokenPercentage}%` }}
            />
          </div>
          <span className="text-[10px] text-zinc-500 shrink-0">
            {tokenCount} / {maxTokens} tokens
          </span>
        </div>
      )}

      {/* Main input area */}
      <div className="relative rounded-xl bg-zinc-900/80 border border-zinc-700/60 focus-within:border-zinc-500/60 transition-colors">
        {/* Trae-style agent header: one source of truth for the active agent. */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800/80">
          <label className="flex min-w-0 items-center gap-1 text-xs text-zinc-300">
            <AtSign size={13} className="text-[var(--forge-coco-cloud)]" />
            <span className="text-zinc-500">Agent</span>
            {agentOptions.length > 0 ? (
              <select value={selectedAgentId ?? agentOptions[0].id} onChange={event => onAgentChange?.(event.target.value)} className="max-w-[150px] truncate bg-transparent font-medium text-zinc-200 outline-none">
                {agentOptions.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
              </select>
            ) : <span className="truncate font-medium">{agentName}</span>}
          </label>
          <span className="shrink-0 text-[10px] text-zinc-500">Auto <span className="text-[var(--forge-coco-accent)]">✦</span></span>
        </div>

        {/* Legacy optional tools stay implemented but are hidden from the primary chat surface. */}
        <div className="hidden flex items-center gap-1 px-2 pt-1.5">
          {/* Slash command trigger */}
          {slashCommandsEnabled && (
            <button
              type="button"
              onClick={() => setIsSlashOpen(!isSlashOpen)}
              className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
              title="Slash commands (/)"
            >
              /
            </button>
          )}

          <button
            type="button"
            onClick={() => textAreaFnsRef.current?.triggerMention()}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
            title="Reference files or folders"
          >
            <AtSign size={14} />
          </button>

          {/* Attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
            title="Attach file"
          >
            <Paperclip size={14} />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
            title="Add image"
          >
            <ImageIcon size={14} />
          </button>

          <button
            type="button"
            onClick={enhancePrompt}
            disabled={!value.trim()}
            className="p-1 text-lime-300/70 hover:text-lime-200 hover:bg-lime-300/10 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="Enhance prompt"
          >
            <WandSparkles size={14} />
          </button>

          {/* Voice button */}
          {voiceEnabled && onVoiceToggle && (
            <button
              type="button"
              onClick={onVoiceToggle}
              className={`p-1 rounded transition-colors cursor-pointer ${
                isListening
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
              title={isListening ? 'Stop voice input' : 'Voice input'}
            >
              <Mic size={14} />
            </button>
          )}

          {/* Art toggle */}
          {artEnabled && onArtToggle && (
            <button
              type="button"
              onClick={() => { setShowArtPanel(!showArtPanel); onArtToggle(); }}
              className={`p-1 rounded transition-colors cursor-pointer ${
                showArtPanel ? 'bg-purple-600/30 text-purple-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
              title="Art mode"
            >
              <Palette size={14} />
            </button>
          )}

          {/* Code toggle */}
          {codeEnabled && onCodeToggle && (
            <button
              type="button"
              onClick={() => { setShowCodePanel(!showCodePanel); onCodeToggle(); }}
              className={`p-1 rounded transition-colors cursor-pointer ${
                showCodePanel ? 'bg-blue-600/30 text-blue-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
              title="Code execution"
            >
              <Code2 size={14} />
            </button>
          )}

          <div className="flex-1" />

          {/* Expand/collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Textarea */}
        <VoidInputBox2
          className="w-full min-h-[40px] max-h-[200px] px-3 py-2 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 resize-none text-zinc-200 placeholder:text-zinc-600"
          placeholder={placeholder}
          multiline={true}
          enableAtToMention={true}
          fnsRef={textAreaFnsRef}
          onChangeText={onChange}
          onKeyDown={handleTextareaKeyDown}
        />

        {/* Bottom action bar */}
        <div className="flex items-center justify-between px-2 py-1.5 border-t border-zinc-700/60">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => textAreaFnsRef.current?.triggerMention()} className="p-1 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer" title="Reference files or folders">
              <AtSign size={13} />
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer" title="Attach image or file">
              <ImageIcon size={13} />
            </button>
            <ModelDropdown featureName={featureName} className="forge-coco-model-trigger max-w-[155px]" />
          </div>

          <div className="flex items-center gap-1">
            {isStreaming ? (
              <button
                type="button"
                onClick={onAbort}
                data-action="abort"
                className="flex items-center gap-1 px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors cursor-pointer"
              >
                <Square size={12} />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={onSubmit}
                data-action="submit"
                disabled={isDisabled || !value.trim()}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-[var(--forge-coco-accent)] hover:bg-[#9297ff] text-slate-950 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send size={12} />
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import {
  MessageSquare,
  FolderOpen,
  Search,
  Settings,
  Sparkles,
  GitBranch,
  Terminal,
  BookOpen,
  Brain,
  PanelRightOpen,
  PanelRightClose,
} from 'lucide-react';

interface LeftToolbarProps {
  activeTool: string;
  onToolChange: (tool: string) => void;
  hasActiveThread: boolean;
  threadCount: number;
  isRightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  disabled?: boolean;
}

const tools = [
  { id: 'chat', label: 'Chat', icon: MessageSquare, shortcut: 'Ctrl+K' },
  { id: 'files', label: 'Files', icon: FolderOpen, shortcut: 'Ctrl+P' },
  { id: 'search', label: 'Search', icon: Search, shortcut: 'Ctrl+Shift+F' },
  { id: 'terminal', label: 'Terminal', icon: Terminal, shortcut: 'Ctrl+`' },
  { id: 'agents', label: 'Agents', icon: GitBranch, shortcut: 'Ctrl+Shift+A' },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen, shortcut: 'Ctrl+Shift+K' },
  { id: 'reasoning', label: 'Reasoning', icon: Brain, shortcut: 'Ctrl+Shift+R' },
];

export const LeftToolbar: React.FC<LeftToolbarProps> = ({
  activeTool,
  onToolChange,
  hasActiveThread,
  threadCount,
  isRightPanelOpen,
  onToggleRightPanel,
  disabled = false,
}) => {
  return (
    <div className="void-left-toolbar flex flex-col items-center py-2 px-1 gap-0.5 border-r border-zinc-700/60 bg-zinc-900/40 shrink-0">
      {/* Logo / App name */}
      <div className="w-8 h-8 mb-2 flex items-center justify-center">
        <div className="w-6 h-6 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
          <Sparkles size={14} className="text-emerald-400" />
        </div>
      </div>

      {/* Tool buttons */}
      {tools.map(tool => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => onToolChange(tool.id)}
            disabled={disabled}
            className={`relative w-8 h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer group ${
              isActive
                ? 'bg-zinc-700 text-zinc-200'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
            title={`${tool.label} (${tool.shortcut})`}
          >
            <Icon size={16} />
            {/* Tooltip */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 border border-zinc-700/60 rounded text-[10px] text-zinc-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {tool.label}
              <span className="ml-1 text-zinc-500">{tool.shortcut}</span>
            </div>
          </button>
        );
      })}

      {/* Divider */}
      <div className="w-6 h-px bg-zinc-700/60 my-1" />

      {/* Thread indicator */}
      {hasActiveThread && (
        <button
          type="button"
          className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
          title={`${threadCount} thread(s)`}
        >
          <MessageSquare size={16} />
          {threadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full text-[8px] text-white flex items-center justify-center font-medium">
              {threadCount}
            </span>
          )}
        </button>
      )}

      {/* Right panel toggle */}
      <button
        type="button"
        onClick={onToggleRightPanel}
        disabled={disabled}
        className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
          isRightPanelOpen
            ? 'bg-zinc-700 text-zinc-200'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
        } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        title="Toggle right panel"
      >
        {isRightPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
      </button>

      {/* Settings */}
      <button
        type="button"
        className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
        title="Settings"
      >
        <Settings size={16} />
      </button>
    </div>
  );
};

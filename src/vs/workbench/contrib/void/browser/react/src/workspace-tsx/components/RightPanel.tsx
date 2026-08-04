/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import {
  PlayCircle,
  ImageIcon,
  FileText,
  Brain,
  Clock,
  Folder,
  GitBranch,
  Settings,
  ChevronDown,
  ChevronRight,
  Zap,
  Code2,
  Palette,
  MessageSquare,
  Terminal,
  BookOpen,
  Search,
  Sparkles,
} from 'lucide-react';
import { AgentPanel } from '../../forge/AgentPanel/AgentPanel';

type RightPanelTab = 'tasks' | 'artifacts' | 'context' | 'memory' | 'agents' | 'code' | 'search' | 'forge';

interface RightPanelProps {
  isOpen: boolean;
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  onClose: () => void;
  tasks?: { id: string; title: string; status: string }[];
  artifacts?: { id: string; name: string; type: string }[];
  contextItems?: { id: string; name: string; type: string }[];
  memoryItems?: { id: string; content: string }[];
  agents?: { id: string; name: string; status: string }[];
  activeAgentName?: string;
  providerName?: string;
  modelName?: string;
  disabled?: boolean;
}

const tabs: { id: RightPanelTab; label: string; icon: React.ReactNode }[] = [
  { id: 'tasks', label: 'Tasks', icon: <Zap size={14} /> },
  { id: 'artifacts', label: 'Artifacts', icon: <Code2 size={14} /> },
  { id: 'context', label: 'Context', icon: <Folder size={14} /> },
  { id: 'memory', label: 'Memory', icon: <Brain size={14} /> },
  { id: 'agents', label: 'Agents', icon: <GitBranch size={14} /> },
  { id: 'code', label: 'Code', icon: <Code2 size={14} /> },
  { id: 'search', label: 'Search', icon: <Search size={14} /> },
  { id: 'forge', label: 'Forge Agent', icon: <Sparkles size={14} /> },
];

export const RightPanel: React.FC<RightPanelProps> = ({
  isOpen,
  activeTab,
  onTabChange,
  onClose,
  tasks = [],
  artifacts = [],
  contextItems = [],
  memoryItems = [],
  agents = [],
  activeAgentName = 'Forge Agent',
  providerName = 'Auto',
  modelName = 'Auto',
  disabled = false,
}) => {
  if (!isOpen) return null;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'forge':
        return <AgentPanel />;
      case 'tasks':
        return (
          <div className="flex flex-col gap-2 p-3">
            {tasks.length === 0 ? (
              <div className="text-xs text-zinc-500 text-center py-4">No tasks yet</div>
            ) : (
              tasks.map(task => (
                <div key={task.id} className="flex items-center gap-2 py-1">
                  <div className={`w-2 h-2 rounded-full ${
                    task.status === 'done' ? 'bg-emerald-400' :
                    task.status === 'running' ? 'bg-blue-400 animate-pulse' :
                    task.status === 'failed' ? 'bg-red-400' :
                    'bg-zinc-500'
                  }`} />
                  <span className="text-xs text-zinc-300 flex-1 truncate">{task.title}</span>
                  <span className="text-[10px] text-zinc-500 capitalize">{task.status}</span>
                </div>
              ))
            )}
          </div>
        );

      case 'artifacts':
        return (
          <div className="flex flex-col gap-2 p-3">
            {artifacts.length === 0 ? (
              <div className="text-xs text-zinc-500 text-center py-4">No artifacts yet</div>
            ) : (
              artifacts.map(artifact => (
                <div key={artifact.id} className="flex items-center gap-2 py-1">
                  <Code2 size={12} className="text-zinc-500 flex-shrink-0" />
                  <span className="text-xs text-zinc-300 flex-1 truncate">{artifact.name}</span>
                  <span className="text-[10px] text-zinc-500">{artifact.type}</span>
                </div>
              ))
            )}
          </div>
        );

      case 'context':
        return (
          <div className="flex flex-col gap-2 p-3">
            {contextItems.length === 0 ? (
              <div className="text-xs text-zinc-500 text-center py-4">No context items</div>
            ) : (
              contextItems.map(item => (
                <div key={item.id} className="flex items-center gap-2 py-1">
                  <Folder size={12} className="text-zinc-500 flex-shrink-0" />
                  <span className="text-xs text-zinc-300 flex-1 truncate">{item.name}</span>
                  <span className="text-[10px] text-zinc-500">{item.type}</span>
                </div>
              ))
            )}
          </div>
        );

      case 'memory':
        return (
          <div className="flex flex-col gap-2 p-3">
            {memoryItems.length === 0 ? (
              <div className="text-xs text-zinc-500 text-center py-4">No memory entries</div>
            ) : (
              memoryItems.map(item => (
                <div key={item.id} className="py-1">
                  <p className="text-xs text-zinc-300">{item.content}</p>
                </div>
              ))
            )}
          </div>
        );

      case 'agents':
        return (
          <div className="flex flex-col gap-2 p-3">
            {agents.length === 0 ? (
              <div className="text-xs text-zinc-500 text-center py-4">No agents active</div>
            ) : (
              agents.map(agent => (
                <div key={agent.id} className="flex items-center gap-2 py-1">
                  <GitBranch size={12} className="text-purple-400 flex-shrink-0" />
                  <span className="text-xs text-zinc-300 flex-1 truncate">{agent.name}</span>
                  <span className="text-[10px] text-zinc-500 capitalize">{agent.status}</span>
                </div>
              ))
            )}
          </div>
        );

      case 'code':
        return (
          <div className="flex flex-col gap-2 p-3">
            <div className="text-xs text-zinc-500 text-center py-4">Code execution panel</div>
          </div>
        );

      case 'search':
        return (
          <div className="flex flex-col gap-2 p-3">
            <div className="text-xs text-zinc-500 text-center py-4">Search panel</div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="void-right-panel w-72 min-w-0 min-h-0 border-l border-zinc-700/60 bg-zinc-900/60 backdrop-blur-sm flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700/60">
        <span className="text-xs font-medium text-zinc-300">Panel</span>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="mx-2 mt-2 rounded-lg border border-lime-300/15 bg-lime-300/[0.04] p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-lime-300/70">Active agent</div>
        <div className="mb-2 text-sm font-medium text-zinc-100">{activeAgentName}</div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div><div className="text-zinc-500">Provider</div><div className="truncate text-zinc-300">{providerName}</div></div>
          <div><div className="text-zinc-500">Model</div><div className="truncate text-zinc-300">{modelName}</div></div>
          <div><div className="text-zinc-500">Context</div><div className="text-zinc-300">Ready</div></div>
          <div><div className="text-zinc-500">Memory</div><div className="text-lime-300">Enabled</div></div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex flex-col gap-0.5 px-2 py-2 border-b border-zinc-700/60">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              disabled={disabled}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                isActive
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {renderTabContent()}
      </div>
    </div>
  );
};

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import { GitFork, Users, ChevronDown, ChevronRight, Circle, CheckCircle2, XCircle } from 'lucide-react';

export interface AgentRole {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'active' | 'done' | 'error';
  assignedTasks: string[];
}

export interface MultiAgentConfig {
  enabled: boolean;
  agents: AgentRole[];
  collaborationMode: 'sequential' | 'parallel' | 'debate';
}

interface MultiAgentProps {
  config: MultiAgentConfig;
  onToggle: () => void;
  onUpdateConfig?: (config: MultiAgentConfig) => void;
  disabled?: boolean;
}

const statusColor: Record<string, string> = {
  idle: 'bg-zinc-500',
  active: 'bg-blue-400',
  done: 'bg-emerald-400',
  error: 'bg-red-400',
};

export const MultiAgent: React.FC<MultiAgentProps> = ({
  config,
  onToggle,
  onUpdateConfig,
  disabled = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleModeChange = useCallback((mode: 'sequential' | 'parallel' | 'debate') => {
    if (onUpdateConfig) {
      onUpdateConfig({ ...config, collaborationMode: mode });
    }
  }, [config, onUpdateConfig]);

  if (!config.enabled) {
    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors cursor-pointer disabled:opacity-30"
        title="Enable Multi-Agent"
      >
        <GitFork size={14} />
        <span>Multi-Agent</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2 rounded-lg bg-zinc-900/60 border border-zinc-700/60">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(v => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <GitFork size={12} className="text-purple-400" />
          <span>Multi-Agent</span>
          <span className="text-zinc-500">{config.agents.length} agents</span>
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Collaboration mode */}
          <div className="flex gap-1">
            {(['sequential', 'parallel', 'debate'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => handleModeChange(mode)}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors cursor-pointer ${
                  config.collaborationMode === mode
                    ? 'bg-zinc-700 text-zinc-200 border border-zinc-600'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700/60 hover:text-zinc-300'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Agent list */}
          <div className="flex flex-col gap-1">
            {config.agents.map(agent => (
              <div
                key={agent.id}
                className="flex items-center gap-2 py-0.5"
              >
                <div className={`w-2 h-2 rounded-full ${statusColor[agent.status]}`} />
                <span className="text-xs text-zinc-300 flex-1 truncate">{agent.name}</span>
                <span className="text-[10px] text-zinc-500">{agent.assignedTasks.length} tasks</span>
                {agent.status === 'done' && <CheckCircle2 size={10} className="text-emerald-400" />}
                {agent.status === 'error' && <XCircle size={10} className="text-red-400" />}
              </div>
            ))}
          </div>

          {/* Add agent */}
          {onUpdateConfig && (
            <button
              type="button"
              onClick={() => {
                const newAgent: AgentRole = {
                  id: `agent-${Date.now()}`,
                  name: `Agent ${config.agents.length + 1}`,
                  description: '',
                  status: 'idle',
                  assignedTasks: [],
                };
                onUpdateConfig({
                  ...config,
                  agents: [...config.agents, newAgent],
                });
              }}
              disabled={disabled}
              className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors cursor-pointer disabled:opacity-30"
            >
              <Circle size={10} />
              Add Agent
            </button>
          )}
        </>
      )}
    </div>
  );
};
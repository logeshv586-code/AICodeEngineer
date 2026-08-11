/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { Cpu, MemoryStick, Clock, Zap, Wifi, Activity } from 'lucide-react';

interface BottomStatusBarProps {
  contextTokens: number;
  maxContextTokens: number | null;
  gpuMemoryUsage: number | null;
  gpuMemoryTotal: number | null;
  cpuUsage: number | null;
  latencyMs: number | null;
  isRunning: boolean;
  activeTool?: string;
  threadId?: string;
}

export const BottomStatusBar: React.FC<BottomStatusBarProps> = ({
  contextTokens,
  maxContextTokens,
  gpuMemoryUsage,
  gpuMemoryTotal,
  cpuUsage,
  latencyMs,
  isRunning,
  activeTool,
  threadId,
}) => {
  const contextPercentage = maxContextTokens
    ? Math.min((contextTokens / maxContextTokens) * 100, 100)
    : 0;

  const contextColor = contextPercentage > 90 ? 'bg-red-500' : contextPercentage > 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-t border-zinc-700/60 bg-zinc-900/80 backdrop-blur-sm shrink-0 text-[10px] text-zinc-500">
      {/* Left: Context tokens */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Activity size={10} />
          <span className="text-zinc-400">Context</span>
          <span className="text-zinc-300 font-mono">{contextTokens}</span>
          {maxContextTokens && (
            <>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-500">{maxContextTokens}</span>
            </>
          )}
          <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${contextColor}`}
              style={{ width: `${contextPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Center: System metrics */}
      <div className="flex items-center gap-3">
        {gpuMemoryUsage !== null && gpuMemoryTotal !== null && (
          <div className="flex items-center gap-1">
            <MemoryStick size={10} />
            <span className="text-zinc-400">GPU</span>
            <span className="text-zinc-300 font-mono">{gpuMemoryUsage}MB</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-500">{gpuMemoryTotal}MB</span>
          </div>
        )}

        {cpuUsage !== null && (
          <div className="flex items-center gap-1">
            <Cpu size={10} />
            <span className="text-zinc-400">CPU</span>
            <span className="text-zinc-300 font-mono">{cpuUsage}%</span>
          </div>
        )}

        {latencyMs !== null && (
          <div className="flex items-center gap-1">
            <Clock size={10} />
            <span className="text-zinc-400">{latencyMs}ms</span>
          </div>
        )}
      </div>

      {/* Right: Status */}
      <div className="flex items-center gap-3">
        {isRunning && (
          <div className="flex items-center gap-1">
            <Zap size={10} className="text-amber-400 animate-pulse" />
            <span className="text-amber-400">Running</span>
            {activeTool && (
              <span className="text-zinc-600">|</span>
            )}
            {activeTool && (
              <span className="text-zinc-400 font-mono">{activeTool}</span>
            )}
          </div>
        )}

        {threadId && (
          <div className="flex items-center gap-1">
            <Wifi size={10} />
            <span className="text-zinc-500 font-mono">{threadId.slice(0, 8)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

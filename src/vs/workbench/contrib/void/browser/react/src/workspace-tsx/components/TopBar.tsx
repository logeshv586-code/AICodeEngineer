/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { Activity, Wifi, WifiOff, Clock, Zap } from 'lucide-react';
import { ProviderName } from '../../../../common/voidSettingsTypes.js';
import { ModelCapability } from '../utils/modelCapabilityManifest.js';

interface TopBarProps {
  providerName: ProviderName | null;
  modelName: string;
  capabilities: ModelCapability;
  isConnected: boolean;
  isStreaming: boolean;
  activeFeature: string;
  onFeatureChange: (feature: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  providerName,
  modelName,
  capabilities,
  isConnected,
  isStreaming,
  activeFeature,
  onFeatureChange,
}) => {
  const features = ['Chat', 'Agent', 'Edit', 'Code', 'Art'];

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700/60 bg-zinc-900/80 backdrop-blur-sm shrink-0">
      {/* Left: Status indicators */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {isConnected ? (
            <Wifi size={12} className="text-emerald-400" />
          ) : (
            <WifiOff size={12} className="text-red-400" />
          )}
          <span className={`text-[10px] font-medium ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {isStreaming && (
          <div className="flex items-center gap-1">
            <Activity size={12} className="text-blue-400 animate-pulse" />
            <span className="text-[10px] text-blue-400 font-medium">Streaming</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Zap size={12} className="text-amber-400" />
          <span className="text-[10px] text-zinc-400">
            {providerName ? `${providerName} / ${modelName}` : 'No model selected'}
          </span>
        </div>
      </div>

      {/* Center: Feature tabs */}
      <div className="flex items-center gap-1">
        {features.map(feature => (
          <button
            key={feature}
            type="button"
            onClick={() => onFeatureChange(feature)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors cursor-pointer ${
              activeFeature === feature
                ? 'bg-zinc-700 text-zinc-200 border border-zinc-600'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border border-transparent'
            }`}
          >
            {feature}
          </button>
        ))}
      </div>

      {/* Right: Capability indicators */}
      <div className="flex items-center gap-2">
        {capabilities.canReason && (
          <div className="flex items-center gap-1" title="Reasoning enabled">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            <span className="text-[10px] text-zinc-500">Reason</span>
          </div>
        )}
        {capabilities.canUseTools && (
          <div className="flex items-center gap-1" title="Tools enabled">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[10px] text-zinc-500">Tools</span>
          </div>
        )}
        {capabilities.canUseVoice && (
          <div className="flex items-center gap-1" title="Voice enabled">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="text-[10px] text-zinc-500">Voice</span>
          </div>
        )}
        {capabilities.canUseImages && (
          <div className="flex items-center gap-1" title="Images enabled">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-zinc-500">Images</span>
          </div>
        )}
      </div>
    </div>
  );
};

/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { Palette, X } from 'lucide-react';

interface ArtSupportProps {
  enabled: boolean;
  onToggle: () => void;
  onGenerate?: (prompt: string) => void;
  disabled?: boolean;
}

export const ArtSupport: React.FC<ArtSupportProps> = ({
  enabled,
  onToggle,
  onGenerate,
  disabled = false,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    if (!prompt.trim() || !onGenerate) return;
    setIsGenerating(true);
    onGenerate(prompt);
    setPrompt('');
    setTimeout(() => setIsGenerating(false), 1000);
  };

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors cursor-pointer disabled:opacity-30"
        title="Enable Art Mode"
      >
        <Palette size={14} />
        <span>Art</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2 rounded-lg bg-zinc-900/60 border border-zinc-700/60">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300">Art Mode</span>
        <button
          type="button"
          onClick={onToggle}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
      <div className="flex gap-1">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the art you want..."
          className="flex-1 bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700/60 focus:border-zinc-500 outline-none placeholder:text-zinc-600"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleGenerate();
            }
          }}
          disabled={disabled || isGenerating}
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={disabled || isGenerating || !prompt.trim()}
          className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-30 cursor-pointer"
        >
          {isGenerating ? '...' : 'Generate'}
        </button>
      </div>
    </div>
  );
};

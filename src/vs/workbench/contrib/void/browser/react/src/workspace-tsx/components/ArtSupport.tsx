/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { Palette, X, Loader2, AlertCircle } from 'lucide-react';

interface ArtSupportProps {
  enabled: boolean;
  onToggle: () => void;
  onGenerate?: (prompt: string) => void | Promise<void>;
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
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    const request = prompt.trim();
    if (!request || !onGenerate || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      await Promise.resolve(onGenerate(request));
      setPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  if (!enabled) {
    return (
      <button
        type='button'
        onClick={onToggle}
        disabled={disabled}
        className='flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors cursor-pointer disabled:opacity-30'
        title='Enable Art Mode'
      >
        <Palette size={14} />
        <span>Art</span>
      </button>
    );
  }

  return (
    <div className='flex flex-col gap-1 p-2 rounded-lg bg-zinc-900/60 border border-zinc-700/60'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-1.5'>
          <Palette size={12} className='text-fuchsia-400' />
          <span className='text-xs font-medium text-zinc-300'>Design / Art</span>
        </div>
        <button type='button' onClick={onToggle} disabled={isGenerating} className='text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-30' title='Close design controls' aria-label='Close design controls'>
          <X size={12} />
        </button>
      </div>
      <div className='flex gap-1'>
        <input
          type='text'
          value={prompt}
          onChange={event => setPrompt(event.target.value)}
          placeholder='Describe the prototype, visual, deck, or design…'
          className='flex-1 bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700/60 focus:border-fuchsia-500/50 outline-none placeholder:text-zinc-600'
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void handleGenerate();
            }
          }}
          disabled={disabled || isGenerating}
        />
        <button
          type='button'
          onClick={() => { void handleGenerate(); }}
          disabled={disabled || isGenerating || !prompt.trim() || !onGenerate}
          className='min-w-[76px] flex items-center justify-center gap-1 px-2 py-1 text-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded transition-colors disabled:opacity-30 cursor-pointer'
          title={onGenerate ? 'Send design task' : 'Design adapter unavailable'}
        >
          {isGenerating ? <><Loader2 size={11} className='animate-spin' /> Working</> : 'Generate'}
        </button>
      </div>
      {error && <div className='flex items-start gap-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1'><AlertCircle size={10} className='mt-0.5 shrink-0' /><span>{error}</span></div>}
      <div className='text-[9px] text-zinc-600'>Use the Forge design agent/Open Design adapter; completion state follows the real task instead of a timer.</div>
    </div>
  );
};
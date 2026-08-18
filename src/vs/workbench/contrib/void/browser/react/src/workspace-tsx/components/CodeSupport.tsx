/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useRef, useState } from 'react';
import { Code2, Play, Square, X, Loader2, AlertCircle } from 'lucide-react';

export type CodeExecutionResult = string | { output?: string; error?: string } | void;

interface CodeSupportProps {
  enabled: boolean;
  onToggle: () => void;
  /** Execute through the normal Forge terminal/agent adapter. Honor signal when supported. */
  onExecute?: (code: string, language: string, signal: AbortSignal) => CodeExecutionResult | Promise<CodeExecutionResult>;
  disabled?: boolean;
}

export const CodeSupport: React.FC<CodeSupportProps> = ({
  enabled,
  onToggle,
  onExecute,
  disabled = false,
}) => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [isExecuting, setIsExecuting] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleExecute = async () => {
    const source = code.trim();
    if (!source || !onExecute || isExecuting) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsExecuting(true);
    setOutput('');
    setError(null);
    try {
      const result = await Promise.resolve(onExecute(source, language, controller.signal));
      if (controller.signal.aborted) {
        setOutput('Execution cancelled.');
      } else if (typeof result === 'string') {
        setOutput(result);
      } else if (result && typeof result === 'object') {
        setOutput(result.output || 'Execution completed.');
        if (result.error) setError(result.error);
      } else {
        setOutput('Execution completed.');
      }
    } catch (err) {
      if (controller.signal.aborted) setOutput('Execution cancelled.');
      else setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsExecuting(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setOutput('Cancelling…');
  };

  if (!enabled) {
    return (
      <button
        type='button'
        onClick={onToggle}
        disabled={disabled}
        className='flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors cursor-pointer disabled:opacity-30'
        title='Enable Code Execution'
      >
        <Code2 size={14} />
        <span>Code</span>
      </button>
    );
  }

  return (
    <div className='flex flex-col gap-1 p-2 rounded-lg bg-zinc-900/60 border border-zinc-700/60'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-1.5'><Code2 size={12} className='text-blue-400' /><span className='text-xs font-medium text-zinc-300'>Verified Code Execution</span></div>
        <button type='button' onClick={onToggle} disabled={isExecuting} className='text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-30' title='Close code controls' aria-label='Close code controls'><X size={12} /></button>
      </div>
      <select
        value={language}
        onChange={event => setLanguage(event.target.value)}
        className='bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700/60 focus:border-blue-500/50 outline-none'
        disabled={disabled || isExecuting}
      >
        <option value='javascript'>JavaScript</option>
        <option value='typescript'>TypeScript</option>
        <option value='python'>Python</option>
        <option value='bash'>Bash</option>
        <option value='powershell'>PowerShell</option>
        <option value='json'>JSON</option>
      </select>
      <textarea
        value={code}
        onChange={event => setCode(event.target.value)}
        placeholder='Enter code or a command for Forge to execute through the approved runtime…'
        className='w-full bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700/60 focus:border-blue-500/50 outline-none placeholder:text-zinc-600 resize-none h-20 font-mono'
        disabled={disabled || isExecuting}
      />
      <div className='flex gap-1'>
        <button
          type='button'
          onClick={() => { void handleExecute(); }}
          disabled={disabled || isExecuting || !code.trim() || !onExecute}
          className='flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-30 cursor-pointer'
          title={onExecute ? 'Execute through Forge' : 'Execution adapter unavailable'}
        >
          {isExecuting ? <Loader2 size={12} className='animate-spin' /> : <Play size={12} />}
          {isExecuting ? 'Running…' : 'Run'}
        </button>
        {isExecuting && (
          <button type='button' onClick={handleStop} className='flex items-center gap-1 px-2 py-1 text-xs bg-zinc-700 hover:bg-red-500/20 hover:text-red-300 text-white rounded transition-colors cursor-pointer'>
            <Square size={12} /> Stop
          </button>
        )}
      </div>
      {output && <div className='text-xs text-zinc-400 bg-zinc-800/60 rounded px-2 py-1 font-mono whitespace-pre-wrap max-h-28 overflow-auto'>{output}</div>}
      {error && <div className='flex items-start gap-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1'><AlertCircle size={10} className='mt-0.5 shrink-0' /><span>{error}</span></div>}
      <div className='text-[9px] text-zinc-600'>No in-renderer eval: the caller should use Forge terminal/tool execution so approvals, logs, and cancellation stay visible.</div>
    </div>
  );
};
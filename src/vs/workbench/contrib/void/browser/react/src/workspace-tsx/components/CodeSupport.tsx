/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { Code2, Play, Square, X } from 'lucide-react';

interface CodeSupportProps {
  enabled: boolean;
  onToggle: () => void;
  onExecute?: (code: string, language: string) => void;
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

  const handleExecute = () => {
    if (!code.trim() || !onExecute) return;
    setIsExecuting(true);
    setOutput('');
    onExecute(code, language);
    setTimeout(() => {
      setIsExecuting(false);
      setOutput('Execution completed');
    }, 500);
  };

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors cursor-pointer disabled:opacity-30"
        title="Enable Code Execution"
      >
        <Code2 size={14} />
        <span>Code</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2 rounded-lg bg-zinc-900/60 border border-zinc-700/60">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300">Code Execution</span>
        <button
          type="button"
          onClick={onToggle}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700/60 focus:border-zinc-500 outline-none"
        disabled={disabled}
      >
        <option value="javascript">JavaScript</option>
        <option value="python">Python</option>
        <option value="typescript">TypeScript</option>
        <option value="bash">Bash</option>
        <option value="json">JSON</option>
      </select>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter code to execute..."
        className="w-full bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700/60 focus:border-zinc-500 outline-none placeholder:text-zinc-600 resize-none h-16 font-mono"
        disabled={disabled || isExecuting}
      />
      <div className="flex gap-1">
        <button
          type="button"
          onClick={handleExecute}
          disabled={disabled || isExecuting || !code.trim()}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-30 cursor-pointer"
        >
          <Play size={12} />
          {isExecuting ? 'Running...' : 'Run'}
        </button>
        {isExecuting && (
          <button
            type="button"
            onClick={() => setIsExecuting(false)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors cursor-pointer"
          >
            <Square size={12} />
            Stop
          </button>
        )}
      </div>
      {output && (
        <div className="text-xs text-zinc-400 bg-zinc-800/60 rounded px-2 py-1 font-mono">
          {output}
        </div>
      )}
    </div>
  );
};
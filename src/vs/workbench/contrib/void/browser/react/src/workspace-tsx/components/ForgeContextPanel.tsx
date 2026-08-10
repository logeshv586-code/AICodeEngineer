/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { FileCode2, Image as ImageIcon, Search, Terminal, TestTube2, GitBranch, FolderOpen } from 'lucide-react';

export interface ForgeContextPanelProps {
	files?: string[];
	images?: string[];
	workspaceReady?: boolean;
	onSendMessage: (message: string) => void;
}

const ContextSection: React.FC<{ title: string; count?: number; children: React.ReactNode }> = ({ title, count, children }) => (
	<section className='border-b border-zinc-800/70 px-3 py-3'>
		<div className='flex items-center justify-between mb-2'>
			<span className='text-[10px] font-semibold tracking-wide text-zinc-500 uppercase'>{title}</span>
			{count !== undefined && <span className='text-[9px] text-zinc-600 bg-zinc-800/70 px-1.5 py-0.5 rounded'>{count}</span>}
		</div>
		{children}
	</section>
);

export const ForgeContextPanel: React.FC<ForgeContextPanelProps> = ({ files = [], images = [], workspaceReady = false, onSendMessage }) => (
	<aside className='w-60 shrink-0 min-h-0 overflow-y-auto border-l border-zinc-800/70 bg-zinc-950/35 text-zinc-300'>
		<div className='px-3 py-3 border-b border-zinc-800/70'>
			<div className='text-[11px] font-semibold text-zinc-300'>Chat context</div>
			<div className='text-[10px] text-zinc-600 mt-0.5'>Files and actions used by this conversation</div>
		</div>

		<ContextSection title='Files' count={files.length}>
			{files.length > 0 ? files.map(file => (
				<div key={file} className='flex items-center gap-2 py-1 text-[11px] text-zinc-400 min-w-0'>
					<FileCode2 size={12} className='text-violet-400 shrink-0' />
					<span className='truncate' title={file}>{file.split(/[\\/]/).pop()}</span>
				</div>
			)) : (
				<div className='flex items-center gap-2 text-[10px] text-zinc-600'>
					<FolderOpen size={12} />
					{workspaceReady ? 'No files attached yet' : 'Open a workspace to add files'}
				</div>
			)}
		</ContextSection>

		{images.length > 0 && (
			<ContextSection title='Images' count={images.length}>
				{images.map(image => (
					<div key={image} className='flex items-center gap-2 py-1 text-[11px] text-zinc-400 min-w-0'>
						<ImageIcon size={12} className='text-violet-400 shrink-0' />
						<span className='truncate'>{image}</span>
					</div>
				))}
			</ContextSection>
		)}

		<ContextSection title='Tools'>
			<div className='space-y-1'>
				{[
					{ icon: Terminal, label: 'Run terminal', prompt: 'Run the relevant terminal command for this task and show me the output.' },
					{ icon: Search, label: 'Search code', prompt: 'Search the workspace for the files and symbols relevant to my request.' },
					{ icon: TestTube2, label: 'Run tests', prompt: 'Run the relevant tests for this task and diagnose any failures.' },
					{ icon: GitBranch, label: 'Git status', prompt: 'Show the current git status and summarize the changes.' },
				].map(({ icon: Icon, label, prompt }) => (
					<button key={label} type='button' onClick={() => onSendMessage(prompt)}
						className='w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors text-left'>
						<Icon size={13} className='text-zinc-600 shrink-0' />
						{label}
					</button>
				))}
			</div>
		</ContextSection>
	</aside>
);

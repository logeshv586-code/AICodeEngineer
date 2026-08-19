/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { FileCode2, Image as ImageIcon, Search, Terminal, TestTube2, GitBranch, FolderOpen, Layers3 } from 'lucide-react';

export interface ForgeContextPanelProps {
	files?: string[];
	images?: string[];
	workspaceReady?: boolean;
	onSendMessage: (message: string) => void;
}

const ContextSection: React.FC<{ title: string; count?: number; children: React.ReactNode }> = ({ title, count, children }) => (
	<section className='px-3 py-3'>
		<div className='flex items-center justify-between mb-2'>
			<span className='text-[8.5px] font-semibold tracking-[0.15em] text-[var(--forge-muted-2)] uppercase'>{title}</span>
			{count !== undefined && <span className='forge-brand-chip text-[8px] px-1.5 py-0.5 rounded-md'>{count}</span>}
		</div>
		<div className='forge-brand-context-card p-2'>{children}</div>
	</section>
);

export const ForgeContextPanel: React.FC<ForgeContextPanelProps> = ({ files = [], images = [], workspaceReady = false, onSendMessage }) => (
	<aside className='forge-brand-context-panel forge-brand-scroll w-60 shrink-0 min-h-0 overflow-y-auto text-[var(--forge-text-2)]'>
		<div className='px-3 py-3.5 border-b border-[var(--forge-line)]'>
			<div className='flex items-center gap-2'>
				<div className='w-7 h-7 rounded-lg forge-brand-tool flex items-center justify-center'><Layers3 size={13} /></div>
				<div>
					<div className='text-[11px] font-semibold text-[var(--forge-text)]'>Current context</div>
					<div className='text-[9px] text-[var(--forge-muted)] mt-0.5'>Only the items added to this task</div>
				</div>
			</div>
		</div>

		<ContextSection title='Attached files' count={files.length}>
			{files.length > 0 ? <div className='space-y-0.5'>{files.map(file => (
				<div key={file} className='flex items-center gap-2 px-1.5 py-1.5 text-[10px] text-[var(--forge-text-2)] min-w-0 rounded-lg hover:bg-white/[0.025]'>
					<FileCode2 size={12} className='text-[var(--forge-iris-2)] shrink-0' />
					<span className='truncate' title={file}>{file.split(/[\\/]/).pop()}</span>
				</div>
			))}</div> : <div className='flex items-center gap-2 px-1.5 py-2 text-[9.5px] leading-relaxed text-[var(--forge-muted)]'><FolderOpen size={12} className='shrink-0' />{workspaceReady ? 'Add a file only when Forge needs extra context.' : 'Open a project to work with local files.'}</div>}
		</ContextSection>

		{images.length > 0 && <ContextSection title='Images' count={images.length}><div className='space-y-0.5'>{images.map(image => (
			<div key={image} className='flex items-center gap-2 px-1.5 py-1.5 text-[10px] text-[var(--forge-text-2)] min-w-0 rounded-lg'><ImageIcon size={12} className='text-[var(--forge-cyan)] shrink-0' /><span className='truncate'>{image}</span></div>
		))}</div></ContextSection>}

		<ContextSection title='Quick actions'>
			<div className='space-y-1'>
				{[
					{ icon: Search, label: 'Find what matters', message: 'Find the relevant parts of this project for my current task and continue.' },
					{ icon: Terminal, label: 'Run a useful check', message: 'Run the most useful command for my current task and continue.' },
					{ icon: TestTube2, label: 'Verify the result', message: 'Verify the current result and fix anything that is still wrong.' },
					{ icon: GitBranch, label: 'Review before finish', message: 'Review the current work and fix anything important before finishing.' },
				].map(({ icon: Icon, label, message }) => <button key={label} type='button' onClick={() => onSendMessage(message)} className='forge-brand-tool w-full flex items-center gap-2 px-2 py-2 rounded-lg text-[10px] text-left cursor-pointer'><Icon size={13} className='shrink-0' />{label}</button>)}
			</div>
		</ContextSection>
	</aside>
);

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { WorkspaceSnapshot, SymbolInfo, ModuleNode } from '../../../../common/forge/types/workspaceTypes.js';

// ── Colour tokens for the workspace accent (teal / cyan) ─────────────────────
const accent = '#14b8a6';       // teal-500
const accentDim = '#0f766e';    // teal-700
const accentBg = 'rgba(20, 184, 166, 0.08)';

// ── Icon helpers ──────────────────────────────────────────────────────────────
const KIND_ICON: Record<string, string> = {
	class: '🅒', interface: '🅘', function: 'ƒ', method: 'ƒ',
	type: '𝕋', enum: '⊕', const: '𝐂', variable: '𝐯', unknown: '?'
};

// ── Sub-components ────────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: string | number; accent?: boolean }> = ({ label, value, accent: isAccent }) => (
	<div style={{
		background: isAccent ? accentBg : 'rgba(255,255,255,0.04)',
		border: `1px solid ${isAccent ? accent : 'rgba(255,255,255,0.08)'}`,
		borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 80
	}}>
		<div style={{ fontSize: 20, fontWeight: 700, color: isAccent ? accent : '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{value.toLocaleString()}</div>
		<div style={{ fontSize: 11, color: '#64748b', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
	</div>
);

const SymbolRow: React.FC<{ sym: SymbolInfo; onClick: () => void }> = ({ sym, onClick }) => (
	<div onClick={onClick} style={{
		display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
		borderRadius: 5, cursor: 'pointer', fontSize: 12,
		transition: 'background 0.15s'
	}}
		onMouseEnter={e => (e.currentTarget.style.background = accentBg)}
		onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
	>
		<span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>{KIND_ICON[sym.kind] ?? '?'}</span>
		<span style={{ color: '#e2e8f0', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sym.name}</span>
		<span style={{ color: '#475569', fontSize: 10, flexShrink: 0, fontFamily: 'monospace' }}>{sym.kind}</span>
		<span style={{ color: '#334155', fontSize: 10, flexShrink: 0, fontFamily: 'monospace', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
			{sym.filePath.split('/').slice(-2).join('/')}:{sym.startLine}
		</span>
	</div>
);

const ModuleBar: React.FC<{ module: ModuleNode; maxScore: number }> = ({ module, maxScore }) => {
	const pct = maxScore > 0 ? (module.couplingScore / maxScore) * 100 : 0;
	const name = module.dirPath.split('/').slice(-2).join('/');
	return (
		<div style={{ marginBottom: 6 }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
				<span style={{ color: '#94a3b8', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{name}</span>
				<span style={{ color: accent, fontWeight: 600, flexShrink: 0 }}>{module.couplingScore} imports</span>
			</div>
			<div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
				<div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${accent}, ${accentDim})`, borderRadius: 3, transition: 'width 0.6s ease' }} />
			</div>
		</div>
	);
};

// ── Web Preview Panel ─────────────────────────────────────────────────────────

const WebviewPreview: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => (
	<div style={{
		position: 'absolute', inset: 0, zIndex: 100,
		background: '#0f172a', display: 'flex', flexDirection: 'column'
	}}>
		<div style={{
			display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
			background: '#1e293b', borderBottom: `1px solid ${accentDim}`
		}}>
			<span style={{ fontSize: 10, color: accent, fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{url}</span>
			<button onClick={onClose} style={{
				background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
				color: '#f87171', padding: '2px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11
			}}>Close</button>
		</div>
		{/* Electron webview for embedded page preview */}
		<webview
			src={url}
			style={{ flex: 1, border: 'none' }}
			allowpopups
		/>
	</div>
);

// ── Main WorkspaceView ────────────────────────────────────────────────────────

export const WorkspaceView: React.FC<{
	snapshot: WorkspaceSnapshot | null;
	onBuildWorkspace?: () => void;
}> = ({ snapshot, onBuildWorkspace }) => {
	const [symbolFilter, setSymbolFilter] = useState('');
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [previewInput, setPreviewInput] = useState('');
	const [activeSection, setActiveSection] = useState<'symbols' | 'modules'>('symbols');
	const inputRef = useRef<HTMLInputElement>(null);

	const filteredSymbols = useMemo(() => {
		if (!snapshot) return [];
		const q = symbolFilter.toLowerCase();
		return snapshot.symbols
			.filter(s => s.isExported && (!q || s.name.toLowerCase().includes(q)))
			.sort((a, b) => a.name.localeCompare(b.name))
			.slice(0, 200);
	}, [snapshot, symbolFilter]);

	const topModules = useMemo(() => snapshot?.modules.slice(0, 15) ?? [], [snapshot]);
	const maxCoupling = useMemo(() => topModules.reduce((m, n) => Math.max(m, n.couplingScore), 0), [topModules]);

	const handlePreview = useCallback(() => {
		const url = previewInput.trim();
		if (!url) return;
		const prefixed = url.startsWith('http') ? url : `https://${url}`;
		setPreviewUrl(prefixed);
	}, [previewInput]);

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<div style={{
			position: 'relative', display: 'flex', flexDirection: 'column',
			height: '100%', background: '#0f172a', color: '#e2e8f0',
			fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", overflow: 'hidden'
		}}>
			{/* Webview overlay */}
			{previewUrl && <WebviewPreview url={previewUrl} onClose={() => setPreviewUrl(null)} />}

			{/* Header */}
			<div style={{
				padding: '12px 16px 10px',
				background: 'linear-gradient(135deg, rgba(20,184,166,0.12), rgba(6,182,212,0.06))',
				borderBottom: `1px solid rgba(20,184,166,0.2)`
			}}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
					<span style={{ fontSize: 16 }}>🧠</span>
					<span style={{ fontWeight: 700, fontSize: 14, color: accent, letterSpacing: '-0.02em' }}>Workspace Intelligence</span>
					{snapshot && (
						<span style={{
							marginLeft: 'auto', fontSize: 10, color: accentDim, fontFamily: 'monospace',
							background: accentBg, padding: '2px 8px', borderRadius: 10, border: `1px solid ${accentDim}`
						}}>
							{new Date(snapshot.generatedAt).toLocaleTimeString()}
						</span>
					)}
				</div>

				{/* Stats row */}
				{snapshot ? (
					<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
						<StatCard label="Files" value={snapshot.stats.totalFiles} accent />
						<StatCard label="Symbols" value={snapshot.stats.totalSymbols} />
						<StatCard label="Imports" value={snapshot.stats.totalImportEdges} />
						<StatCard label="Calls" value={snapshot.stats.totalCallEdges} />
						<StatCard label="Modules" value={snapshot.stats.totalModules} />
					</div>
				) : (
					<button onClick={onBuildWorkspace} style={{
						background: accent, border: 'none', borderRadius: 7,
						color: '#fff', padding: '8px 18px', cursor: 'pointer',
						fontWeight: 600, fontSize: 13, width: '100%',
						boxShadow: `0 0 16px rgba(20,184,166,0.3)`
					}}>
						⚙ Build Workspace Index
					</button>
				)}
			</div>

			{/* Section tabs */}
			<div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 16px' }}>
				{(['symbols', 'modules'] as const).map(sec => (
					<button key={sec} onClick={() => setActiveSection(sec)} style={{
						background: 'none', border: 'none', cursor: 'pointer',
						padding: '8px 14px', fontSize: 12, fontWeight: 600,
						color: activeSection === sec ? accent : '#475569',
						borderBottom: activeSection === sec ? `2px solid ${accent}` : '2px solid transparent',
						transition: 'all 0.2s', textTransform: 'capitalize', marginBottom: -1
					}}>
						{sec === 'symbols' ? `Symbols (${filteredSymbols.length})` : `Modules (${topModules.length})`}
					</button>
				))}
			</div>

			{/* Content */}
			<div style={{ flex: 1, overflow: 'auto', padding: '10px 12px' }}>
				{activeSection === 'symbols' ? (
					<>
						<input
							ref={inputRef}
							value={symbolFilter}
							onChange={e => setSymbolFilter(e.target.value)}
							placeholder="Filter symbols…"
							style={{
								width: '100%', boxSizing: 'border-box',
								background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(20,184,166,0.25)`,
								borderRadius: 6, color: '#e2e8f0', padding: '7px 12px', fontSize: 12,
								outline: 'none', marginBottom: 8, fontFamily: 'monospace'
							}}
						/>
						{filteredSymbols.length === 0 ? (
							<p style={{ color: '#334155', fontSize: 12, textAlign: 'center', paddingTop: 24 }}>
								{snapshot ? 'No exported symbols match your filter.' : 'Build the workspace index to view symbols.'}
							</p>
						) : (
							filteredSymbols.map(sym => (
								<SymbolRow key={sym.id} sym={sym} onClick={() => { }} />
							))
						)}
					</>
				) : (
					<>
						{topModules.length === 0 ? (
							<p style={{ color: '#334155', fontSize: 12, textAlign: 'center', paddingTop: 24 }}>
								No module data. Build the workspace index first.
							</p>
						) : (
							<>
								<p style={{ fontSize: 11, color: '#475569', marginBottom: 10, marginTop: 0 }}>
									Coupling hotspots — directories with the most cross-module import edges
								</p>
								{topModules.map(m => (
									<ModuleBar key={m.id} module={m} maxScore={maxCoupling} />
								))}
							</>
						)}
					</>
				)}
			</div>

			{/* Web Preview bar */}
			<div style={{
				padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)',
				background: 'rgba(20,184,166,0.04)',
				display: 'flex', gap: 6, alignItems: 'center'
			}}>
				<span style={{ fontSize: 12, color: '#475569', flexShrink: 0 }}>🌐</span>
				<input
					value={previewInput}
					onChange={e => setPreviewInput(e.target.value)}
					onKeyDown={e => e.key === 'Enter' && handlePreview()}
					placeholder="Paste URL to preview docs…"
					style={{
						flex: 1, background: 'rgba(255,255,255,0.04)',
						border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5,
						color: '#94a3b8', padding: '5px 10px', fontSize: 11,
						outline: 'none', fontFamily: 'monospace'
					}}
				/>
				<button onClick={handlePreview} style={{
					background: accentBg, border: `1px solid ${accentDim}`,
					color: accent, padding: '5px 12px', borderRadius: 5,
					cursor: 'pointer', fontSize: 11, fontWeight: 600, flexShrink: 0
				}}>Preview</button>
			</div>
		</div>
	);
};

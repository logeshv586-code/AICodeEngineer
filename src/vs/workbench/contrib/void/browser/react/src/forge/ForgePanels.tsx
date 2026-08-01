/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccessor } from '../util/services';
import { ForgeEventBus } from '../events/forgeEventBus';
import { ExecutionBus } from '../../execution/bus/executionBus';
import { WorkspaceIntelligenceService } from '../services/workspaceIntelligenceService';
import { KnowledgeService } from '../services/knowledgeService';
import { ForgeMainService } from '../services/forgeMainService';
import { BrowserSessionService } from '../services/browserSessionService';

import { INotificationService } from '../../../../../../platform/notification/common/notification.js';
import { ICodeEditorService } from '../../../../../../editor/browser/services/codeEditorService.js';
import { ISearchService } from '../../../../../../services/search/common/search.js';
import { IStorageService, StorageScope } from '../../../../../../platform/storage/common/storage.js';

import { ForgeEvent } from '../../../common/forge/events/forgeEvents.js';
import { PlannerOutput } from '../../../common/forge/planner/planSchema.js';
import { WorkspaceSnapshot, SymbolInfo, ModuleNode } from '../../../common/forge/types/workspaceTypes.js';
import { WorkspaceHealthStats, KnowledgeGraphSnapshot, KnowledgeEntity } from '../../../common/forge/types/knowledgeGraphTypes.js';
import { SemanticSearchHit, IndexStats } from '../../../common/forge/types/semanticSearchTypes.js';
import { ExecutionEvent } from '../../execution/bus/executionEvents.js';

type TabId = 'brain' | 'search' | 'diagnostics' | 'memory' | 'workspace' | 'browser';

interface TabDef {
    id: TabId;
    label: string;
    icon: string;
    activeBg: string;
    hoverBg: string;
    textColor: string;
}

const TABS: TabDef[] = [
    { id: 'brain', label: 'Brain', icon: '🧠', activeBg: 'bg-teal-600', hoverBg: 'hover:bg-teal-950/40', textColor: 'text-teal-400' },
    { id: 'search', label: 'Search', icon: '🔍', activeBg: 'bg-[#6C5CE7]', hoverBg: 'hover:bg-[#6C5CE7]/20', textColor: 'text-[#00D4FF]' },
    { id: 'diagnostics', label: 'Diag', icon: '🩺', activeBg: 'bg-amber-600', hoverBg: 'hover:bg-amber-950/40', textColor: 'text-amber-400' },
    { id: 'memory', label: 'Memory', icon: '📚', activeBg: 'bg-purple-600', hoverBg: 'hover:bg-purple-950/40', textColor: 'text-purple-400' },
    { id: 'workspace', label: 'Work', icon: '⚙', activeBg: 'bg-teal-600', hoverBg: 'hover:bg-teal-950/40', textColor: 'text-teal-400' },
    { id: 'browser', label: 'Browser', icon: '🌐', activeBg: 'bg-[#6C5CE7]', hoverBg: 'hover:bg-[#6C5CE7]/20', textColor: 'text-[#00D4FF]' },
];

const TabButton: React.FC<{
    tab: TabDef;
    isActive: boolean;
    onClick: () => void;
    count?: number;
}> = ({ tab, isActive, onClick, count }) => (
    <button
        onClick={onClick}
        className={`
            px-2.5 py-1 text-[11px] rounded font-medium transition-all duration-150 flex items-center space-x-1 whitespace-nowrap
            ${isActive
                ? `${tab.activeBg} text-white shadow-sm`
                : `text-zinc-400 ${tab.hoverBg}`
            }
        `}
    >
        <span>{tab.icon}</span>
        <span>{tab.label}</span>
        {count !== undefined && count > 0 && (
            <span className={`ml-0.5 px-1 py-0 rounded text-[9px] font-mono ${
                isActive ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}>
                {count}
            </span>
        )}
    </button>
);

const BrainPanel: React.FC = () => {
    const [events, setEvents] = useState<ForgeEvent[]>([]);
    const [execEvents, setExecEvents] = useState<ExecutionEvent[]>([]);
    const [plan, setPlan] = useState<PlannerOutput | null>(null);

    useEffect(() => {
        const bus = ForgeEventBus.getInstance();
        const listener = bus.onEvent((evt: ForgeEvent) => {
            setEvents(prev => [evt, ...prev].slice(0, 200));
            if (evt.type === 'PLAN_CREATED') {
                setPlan(evt.payload.plan as PlannerOutput);
            } else if (evt.type === 'PLAN_STEP_UPDATED' && plan) {
                setPlan(prev => prev ? {
                    ...prev,
                    steps: prev.steps.map(s =>
                        s.id === evt.payload.stepId ? evt.payload.step : s
                    )
                } : null);
            }
        });

        const execBus = ExecutionBus.getInstance();
        const execListener = execBus.onEvent((evt: ExecutionEvent) => {
            setExecEvents(prev => [evt, ...prev].slice(0, 200));
        });

        return () => {
            listener.dispose();
            execListener.dispose();
        };
    }, [plan]);

    const clearEvents = useCallback(() => {
        setEvents([]);
        setExecEvents([]);
    }, []);

    const totalSteps = plan?.steps.length || 0;
    const completedSteps = plan?.steps.filter(s => s.status === 'completed').length || 0;

    return (
        <div className="flex flex-col h-full space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-medium text-zinc-300">Forge Brain Active</span>
                </div>
                <button
                    onClick={clearEvents}
                    className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded text-[10px] transition-colors"
                >
                    Clear
                </button>
            </div>

            {plan && (
                <div className="p-2 bg-zinc-900/50 rounded border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 mb-1">Plan Progress</div>
                    <div className="flex items-center space-x-2">
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-teal-500 transition-all duration-500"
                                style={{ width: totalSteps > 0 ? `${(completedSteps / totalSteps) * 100}%` : '0%' }}
                            />
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono">
                            {completedSteps}/{totalSteps}
                        </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1 truncate">{plan.goal}</div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-1">
                {events.length === 0 && execEvents.length === 0 ? (
                    <p className="text-zinc-600 text-xs text-center py-8">No brain events recorded.</p>
                ) : (
                    <>
                        {execEvents.slice(0, 50).map(evt => (
                            <div key={evt.id} className="flex items-start space-x-2 text-[11px] p-1.5 rounded bg-zinc-900/30 border border-white/5">
                                <span className="text-zinc-600 text-[9px] font-mono shrink-0">
                                    {new Date(evt.timestamp).toLocaleTimeString()}
                                </span>
                                <span className="px-1 py-0.5 rounded bg-[#6C5CE7]/20 text-[#00D4FF] text-[9px] font-mono shrink-0">
                                    {evt.type}
                                </span>
                                <span className="text-zinc-400 truncate">
                                    {JSON.stringify(evt.payload).slice(0, 80)}
                                </span>
                            </div>
                        ))}
                        {events.slice(0, 50).map(evt => (
                            <div key={evt.id} className="flex items-start space-x-2 text-[11px] p-1.5 rounded bg-zinc-900/30 border border-white/5">
                                <span className="text-zinc-600 text-[9px] font-mono shrink-0">
                                    {new Date(evt.timestamp).toLocaleTimeString()}
                                </span>
                                <span className="px-1 py-0.5 rounded bg-teal-900/30 text-teal-400 text-[9px] font-mono shrink-0">
                                    {evt.type}
                                </span>
                                <span className="text-zinc-400 truncate">
                                    {JSON.stringify(evt.payload).slice(0, 80)}
                                </span>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
};

const SearchPanel: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SemanticSearchHit[]>([]);
    const [stats, setStats] = useState<IndexStats | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isIndexing, setIsIndexing] = useState(false);

    const forgeService = useMemo(() => new ForgeMainService(null as any), []);
    const wsService = useMemo(() => WorkspaceIntelligenceService.create(null), []);

    const handleSearch = useCallback(async () => {
        if (!query.trim()) return;
        setIsSearching(true);
        try {
            const hits = await forgeService.semanticSearch(query, '', 5);
            setResults(hits || []);
        } catch (e) {
            console.error('Search failed:', e);
        } finally {
            setIsSearching(false);
        }
    }, [query, forgeService]);

    const handleIndex = useCallback(async () => {
        setIsIndexing(true);
        try {
            const result = await wsService.buildWorkspace('.', true);
            if (result) {
                const indexStats = await forgeService.getIndexStats('.');
                setStats(indexStats);
            }
        } catch (e) {
            console.error('Index failed:', e);
        } finally {
            setIsIndexing(false);
        }
    }, [forgeService, wsService]);

    const handleGetStats = useCallback(async () => {
        try {
            const indexStats = await forgeService.getIndexStats('.');
            setStats(indexStats);
        } catch (e) {
            console.error('Get stats failed:', e);
        }
    }, [forgeService]);

    return (
        <div className="flex flex-col h-full space-y-3">
            <div className="flex space-x-2">
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Semantic search query..."
                    className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-[#6C5CE7] transition-colors"
                />
                <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="px-3 py-1.5 bg-[#6C5CE7] hover:bg-[#6C5CE7]/80 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                >
                    {isSearching ? '...' : 'Search'}
                </button>
            </div>

            <div className="flex space-x-2">
                <button
                    onClick={handleIndex}
                    disabled={isIndexing}
                    className="px-3 py-1.5 bg-teal-700 hover:bg-teal-600 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                >
                    {isIndexing ? 'Indexing...' : 'Index Workspace'}
                </button>
                <button
                    onClick={handleGetStats}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs font-medium transition-colors"
                >
                    Get Stats
                </button>
            </div>

            {stats && (
                <div className="p-2 bg-zinc-900/50 rounded border border-zinc-800 text-[11px] space-y-1">
                    <div className="text-zinc-400 font-medium">Index Stats</div>
                    <div className="flex justify-between">
                        <span className="text-zinc-500">Files</span>
                        <span className="text-zinc-300 font-mono">{stats.totalFiles}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-zinc-500">Chunks</span>
                        <span className="text-zinc-300 font-mono">{stats.totalChunks}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-zinc-500">Model</span>
                        <span className="text-zinc-300 font-mono">{stats.modelName}</span>
                    </div>
                    {stats.error && (
                        <div className="text-rose-400 text-[10px]">{stats.error}</div>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-1.5">
                {results.length === 0 ? (
                    <p className="text-zinc-600 text-xs text-center py-4">No search results yet.</p>
                ) : (
                    results.map((hit, idx) => (
                        <div key={idx} className="p-2 bg-zinc-900/50 rounded border border-zinc-800 hover:border-[#6C5CE7]/50 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] text-zinc-300 font-mono truncate flex-1">
                                    {hit.chunk.filePath}:{hit.chunk.startLine}-{hit.chunk.endLine}
                                </span>
                                <span className="text-[10px] text-[#00D4FF] font-mono ml-2">
                                    {(hit.score * 100).toFixed(1)}%
                                </span>
                            </div>
                            <p className="text-[10px] text-zinc-500 line-clamp-2">
                                {hit.chunk.content.slice(0, 120)}
                            </p>
                            {hit.chunk.symbolHint && (
                                <span className="inline-block mt-1 px-1 py-0.5 bg-[#6C5CE7]/10 text-[#00D4FF] text-[9px] rounded font-mono">
                                    {hit.chunk.symbolHint}
                                </span>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const DiagnosticsPanel: React.FC = () => {
    const accessor = useAccessor();
    const codeEditorService = accessor.get('ICodeEditorService');
    const searchService = accessor.get('ISearchService');
    const notificationService = accessor.get('INotificationService');
    const storageService = accessor.get('IStorageService');

    const [openEditors, setOpenEditors] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<string[]>([]);
    const [storageCount, setStorageCount] = useState(0);

    useEffect(() => {
        const editors = codeEditorService.getVisibleEditors();
        setOpenEditors(editors.map(e => e.document.uri.toString()));
    }, [codeEditorService]);

    const handleSearchFiles = useCallback(async () => {
        if (!searchQuery.trim()) return;
        try {
            const result = await searchService.search({
                query: searchQuery,
                filePattern: '*',
                maxResults: 20,
            } as any);
            const uris = result?.results?.map((r: any) => r?.resource?.fsPath || r?.uri?.fsPath || String(r)) || [];
            setSearchResults(uris);
        } catch (e) {
            console.error('Search failed:', e);
        }
    }, [searchQuery, searchService]);

    const handleNotify = useCallback(() => {
        notificationService.info('Forge Diagnostics Panel is active.');
    }, [notificationService]);

    const handleClearStorage = useCallback(() => {
        storageService.clear(StorageScope.APPLICATION);
        setStorageCount(0);
    }, [storageService]);

    useEffect(() => {
        let count = 0;
        storageService.keys(StorageScope.APPLICATION).forEach(() => count++);
        setStorageCount(count);
    }, [storageService]);

    return (
        <div className="flex flex-col h-full space-y-3">
            <div className="p-2 bg-zinc-900/50 rounded border border-zinc-800">
                <div className="text-[10px] text-zinc-400 font-medium mb-2">Verified Services Active</div>
                <div className="flex flex-wrap gap-1">
                    {['ICodeEditorService', 'ISearchService', 'INotificationService', 'IStorageService'].map(s => (
                        <span key={s} className="px-1.5 py-0.5 bg-emerald-900/30 text-emerald-400 text-[9px] rounded font-mono border border-emerald-500/20">
                            {s}
                        </span>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">
                    Open Editors: <span className="text-zinc-200 font-mono">{openEditors.length}</span>
                </span>
                <button
                    onClick={handleNotify}
                    className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] transition-colors"
                >
                    Test Notification
                </button>
            </div>

            <div className="flex space-x-2">
                <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearchFiles()}
                    placeholder="Search files in workspace..."
                    className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-amber-500 transition-colors"
                />
                <button
                    onClick={handleSearchFiles}
                    className="px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded text-xs font-medium transition-colors"
                >
                    Search
                </button>
            </div>

            {searchResults.length > 0 && (
                <div className="space-y-1">
                    <div className="text-[10px] text-zinc-500">Results ({searchResults.length})</div>
                    {searchResults.slice(0, 10).map((r, i) => (
                        <div key={i} className="text-[11px] text-zinc-400 font-mono px-2 py-1 bg-zinc-900/30 rounded truncate">
                            {r}
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between p-2 bg-zinc-900/30 rounded border border-zinc-800">
                <span className="text-[11px] text-zinc-400">
                    Storage Keys: <span className="text-zinc-200 font-mono">{storageCount}</span>
                </span>
                <button
                    onClick={handleClearStorage}
                    className="px-2 py-0.5 bg-rose-900/30 hover:bg-rose-800/40 text-rose-400 rounded text-[10px] transition-colors border border-rose-500/20"
                >
                    Clear Storage
                </button>
            </div>
        </div>
    );
};

const MemoryPanel: React.FC = () => {
    const [graph, setGraph] = useState<KnowledgeGraphSnapshot | null>(null);
    const [health, setHealth] = useState<WorkspaceHealthStats | null>(null);
    const [selectedEntity, setSelectedEntity] = useState<KnowledgeEntity | null>(null);
    const [neighbors, setNeighbors] = useState<KnowledgeEntity[]>([]);

    const knowledgeService = useMemo(() => KnowledgeService.create(null), []);

    const loadData = useCallback(async () => {
        try {
            const [g, h] = await Promise.all([
                knowledgeService.getKnowledgeGraph('.'),
                knowledgeService.getWorkspaceHealth('.'),
            ]);
            setGraph(g);
            setHealth(h);
        } catch (e) {
            console.error('Memory load failed:', e);
        }
    }, [knowledgeService]);

    const handleEntityClick = useCallback(async (entity: KnowledgeEntity) => {
        setSelectedEntity(entity);
        try {
            const ns = await knowledgeService.queryKnowledgeNeighbors(entity.id);
            setNeighbors(ns);
        } catch (e) {
            console.error('Neighbor query failed:', e);
        }
    }, [knowledgeService]);

    return (
        <div className="flex flex-col h-full space-y-3">
            <button
                onClick={loadData}
                className="w-full px-3 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded text-xs font-medium transition-colors"
            >
                📚 Load Knowledge Graph & Health
            </button>

            {health && (
                <div className="p-2 bg-zinc-900/50 rounded border border-zinc-800 space-y-1.5">
                    <div className="text-[10px] text-zinc-400 font-medium">Workspace Health</div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="text-center p-1.5 bg-zinc-900 rounded">
                            <div className="text-sm font-bold text-zinc-200">{health.grade || 'N/A'}</div>
                            <div className="text-[9px] text-zinc-500">Grade</div>
                        </div>
                        <div className="text-center p-1.5 bg-zinc-900 rounded">
                            <div className="text-sm font-bold text-amber-400">{health.complexityScore || 0}</div>
                            <div className="text-[9px] text-zinc-500">Complexity</div>
                        </div>
                        <div className="text-center p-1.5 bg-zinc-900 rounded">
                            <div className="text-sm font-bold text-rose-400">{health.circularDependencies || 0}</div>
                            <div className="text-[9px] text-zinc-500">Circular Deps</div>
                        </div>
                        <div className="text-center p-1.5 bg-zinc-900 rounded">
                            <div className="text-sm font-bold text-emerald-400">{health.healthyFiles || 0}</div>
                            <div className="text-[9px] text-zinc-500">Healthy Files</div>
                        </div>
                    </div>
                </div>
            )}

            {graph && (
                <div className="flex-1 overflow-y-auto space-y-1">
                    <div className="text-[10px] text-zinc-500">
                        {graph.totalEntities} entities · {graph.totalEdges} relations
                    </div>
                    {graph.entities.slice(0, 30).map(entity => (
                        <div
                            key={entity.id}
                            onClick={() => handleEntityClick(entity)}
                            className={`flex items-center justify-between p-2 rounded border transition-all cursor-pointer ${
                                selectedEntity?.id === entity.id
                                    ? 'bg-purple-900/30 border-purple-500/30'
                                    : 'bg-zinc-900/30 border-white/5 hover:border-purple-500/20'
                            }`}
                        >
                            <div className="flex items-center space-x-2 truncate">
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-900/30 text-purple-300 font-semibold">
                                    {entity.type}
                                </span>
                                <span className="text-zinc-200 text-[11px] truncate">{entity.title}</span>
                            </div>
                            <span className="text-[9px] text-zinc-500">{entity.source}</span>
                        </div>
                    ))}
                </div>
            )}

            {selectedEntity && (
                <div className="p-2 bg-zinc-900/50 rounded border border-purple-500/20 space-y-1.5">
                    <div className="text-[10px] text-purple-400 font-medium">Neighbors of {selectedEntity.title}</div>
                    {neighbors.length === 0 ? (
                        <p className="text-zinc-600 text-[10px]">No neighbors found.</p>
                    ) : (
                        neighbors.map(n => (
                            <div key={n.id} className="text-[11px] text-zinc-400 px-2 py-1 bg-zinc-900/50 rounded">
                                {n.title} <span className="text-zinc-600">({n.type})</span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

const WorkspacePanel: React.FC = () => {
    const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
    const [symbolFilter, setSymbolFilter] = useState('');
    const [activeSection, setActiveSection] = useState<'symbols' | 'modules'>('symbols');
    const [isBuilding, setIsBuilding] = useState(false);

    const wsService = useMemo(() => WorkspaceIntelligenceService.create(null), []);

    const handleBuild = useCallback(async () => {
        setIsBuilding(true);
        try {
            const result = await wsService.buildWorkspace('.', true);
            if (result) setSnapshot(result);
        } catch (e) {
            console.error('Build workspace failed:', e);
        } finally {
            setIsBuilding(false);
        }
    }, [wsService]);

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

    return (
        <div className="flex flex-col h-full space-y-2">
            {!snapshot ? (
                <button
                    onClick={handleBuild}
                    disabled={isBuilding}
                    className="w-full px-4 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold transition-colors disabled:opacity-50"
                >
                    {isBuilding ? 'Building Workspace Index...' : '⚙ Build Workspace Index'}
                </button>
            ) : (
                <>
                    <div className="flex space-x-1 bg-zinc-900/50 p-1 rounded border border-zinc-800">
                        {(['symbols', 'modules'] as const).map(sec => (
                            <button
                                key={sec}
                                onClick={() => setActiveSection(sec)}
                                className={`flex-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                                    activeSection === sec
                                        ? 'bg-teal-600 text-white'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                {sec === 'symbols' ? `Symbols (${filteredSymbols.length})` : `Modules (${topModules.length})`}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {activeSection === 'symbols' ? (
                            <>
                                <input
                                    value={symbolFilter}
                                    onChange={e => setSymbolFilter(e.target.value)}
                                    placeholder="Filter symbols..."
                                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-teal-500 mb-2 transition-colors"
                                />
                                {filteredSymbols.length === 0 ? (
                                    <p className="text-zinc-600 text-[11px] text-center py-4">No exported symbols match your filter.</p>
                                ) : (
                                    <div className="space-y-1">
                                        {filteredSymbols.map(sym => (
                                            <div
                                                key={sym.id}
                                                className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                            >
                                                <span className="text-[11px] text-zinc-500 w-5 text-center">
                                                    {sym.kind === 'function' || sym.kind === 'method' ? 'ƒ' : sym.kind === 'class' ? 'C' : sym.kind === 'interface' ? 'I' : '?'}
                                                </span>
                                                <span className="text-[11px] text-zinc-200 flex-1 truncate">{sym.name}</span>
                                                <span className="text-[9px] text-zinc-600 font-mono">{sym.kind}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="space-y-2">
                                {topModules.length === 0 ? (
                                    <p className="text-zinc-600 text-[11px] text-center py-4">No module data.</p>
                                ) : (
                                    topModules.map(m => {
                                        const pct = maxCoupling > 0 ? (m.couplingScore / maxCoupling) * 100 : 0;
                                        const name = m.dirPath.split('/').slice(-2).join('/');
                                        return (
                                            <div key={m.id} style={{ marginBottom: 6 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
                                                    <span style={{ color: '#94a3b8', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{name}</span>
                                                    <span style={{ color: '#14b8a6', fontWeight: 600, flexShrink: 0 }}>{m.couplingScore} imports</span>
                                                </div>
                                                <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #14b8a6, #0f766e)', borderRadius: 3, transition: 'width 0.6s ease' }} />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    <div className="p-2 bg-zinc-900/30 rounded border border-zinc-800">
                        <div className="text-[10px] text-zinc-400 font-medium mb-1">Snapshot Info</div>
                        <div className="flex justify-between text-[10px]">
                            <span className="text-zinc-500">Generated</span>
                            <span className="text-zinc-300 font-mono">{new Date(snapshot.generatedAt).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                            <span className="text-zinc-500">Total Files</span>
                            <span className="text-zinc-300 font-mono">{snapshot.stats.totalFiles}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                            <span className="text-zinc-500">Total Symbols</span>
                            <span className="text-zinc-300 font-mono">{snapshot.stats.totalSymbols}</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const BrowserPanel: React.FC = () => {
    const sessionService = useMemo(() => BrowserSessionService.getInstance(), []);
    const [tabs, setTabs] = useState(sessionService.getAllTabs());
    const [activeTabId, setActiveTabId] = useState<string | null>(sessionService.getActiveTab()?.id || null);
    const [urlInput, setUrlInput] = useState('');

    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

    const handleNavigate = useCallback((url: string) => {
        if (!activeTab) return;
        sessionService.updateUrl(activeTab.id, url);
        setTabs(sessionService.getAllTabs());
    }, [activeTab, sessionService]);

    const handleNewTab = useCallback(() => {
        const url = urlInput.trim() || 'https://react.dev';
        const newTab = sessionService.createTab(url, 'Loading...');
        setTabs(sessionService.getAllTabs());
        setActiveTabId(newTab.id);
        handleNavigate(url);
    }, [urlInput, sessionService, handleNavigate]);

    const handleCloseTab = useCallback((id: string) => {
        sessionService.closeTab(id);
        setTabs(sessionService.getAllTabs());
        if (activeTabId === id) {
            const remaining = sessionService.getAllTabs();
            setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
        }
    }, [activeTabId, sessionService]);

    const handleTogglePin = useCallback(() => {
        if (activeTab) {
            sessionService.togglePin(activeTab.id);
            setTabs(sessionService.getAllTabs());
        }
    }, [activeTab, sessionService]);

    const handleToggleBookmark = useCallback(() => {
        if (activeTab) {
            sessionService.toggleBookmark(activeTab.id);
            setTabs(sessionService.getAllTabs());
        }
    }, [activeTab, sessionService]);

    return (
        <div className="flex flex-col h-full space-y-2">
            <div className="flex space-x-2">
                <input
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleNewTab()}
                    placeholder="Enter URL..."
                    className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-[#6C5CE7] transition-colors"
                />
                <button
                    onClick={handleNewTab}
                    className="px-3 py-1.5 bg-[#6C5CE7] hover:bg-[#6C5CE7]/80 text-white rounded text-xs font-medium transition-colors"
                >
                    + New Tab
                </button>
            </div>

            <div className="flex space-x-1 overflow-x-auto pb-1">
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        onClick={() => setActiveTabId(tab.id)}
                        className={`flex items-center space-x-1 px-2 py-1 rounded text-[10px] cursor-pointer transition-colors whitespace-nowrap border ${
                            activeTabId === tab.id
                                ? 'bg-[#6C5CE7]/20 border-[#6C5CE7]/40 text-white'
                                : 'bg-zinc-900/30 border-white/5 text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        <span>{tab.isPinned ? '📌' : '📄'}</span>
                        <span className="truncate max-w-[100px]">{tab.title}</span>
                        <button
                            onClick={e => { e.stopPropagation(); handleCloseTab(tab.id); }}
                            className="text-zinc-600 hover:text-rose-400 ml-1"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>

            {activeTab && (
                <div className="flex-1 overflow-y-auto space-y-2">
                    <div className="p-2 bg-zinc-900/50 rounded border border-zinc-800">
                        <div className="text-[10px] text-zinc-400 font-medium mb-1">Active Tab</div>
                        <div className="text-[11px] text-zinc-200 font-mono truncate">{activeTab.url}</div>
                        <div className="text-[10px] text-zinc-500 mt-1">{activeTab.title}</div>
                    </div>

                    <div className="flex space-x-2">
                        <button
                            onClick={handleTogglePin}
                            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                                activeTab.isPinned
                                    ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            }`}
                        >
                            {activeTab.isPinned ? '📌 Pinned' : '📌 Pin'}
                        </button>
                        <button
                            onClick={handleToggleBookmark}
                            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                                activeTab.isBookmarked
                                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            }`}
                        >
                            {activeTab.isBookmarked ? '🔖 Bookmarked' : '🔖 Bookmark'}
                        </button>
                    </div>

                    {activeTab.page && (
                        <div className="p-2 bg-zinc-900/30 rounded border border-zinc-800">
                            <div className="text-[10px] text-zinc-400 font-medium mb-1">Page Model</div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                                Title: {activeTab.page.title}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                                URL: {activeTab.page.url}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const ForgePanels: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabId>('brain');

    const tabCounts = useMemo(() => {
        const bus = ForgeEventBus.getInstance();
        return { brain: 0 };
    }, []);

    return (
        <div className="flex flex-col h-full bg-[#070B14] text-white font-sans">
            <div className="flex items-center space-x-1 border-b border-white/5 p-1.5 overflow-x-auto">
                {TABS.map(tab => (
                    <TabButton
                        key={tab.id}
                        tab={tab}
                        isActive={activeTab === tab.id}
                        onClick={() => setActiveTab(tab.id)}
                    />
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
                {activeTab === 'brain' && <BrainPanel />}
                {activeTab === 'search' && <SearchPanel />}
                {activeTab === 'diagnostics' && <DiagnosticsPanel />}
                {activeTab === 'memory' && <MemoryPanel />}
                {activeTab === 'workspace' && <WorkspacePanel />}
                {activeTab === 'browser' && <BrowserPanel />}
            </div>
        </div>
    );
};
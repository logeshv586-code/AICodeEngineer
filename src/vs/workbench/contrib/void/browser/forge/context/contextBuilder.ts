/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { SemanticSearchHit } from '../../../common/forge/types/semanticSearchTypes.js';
import { KnowledgeEntry } from '../../../common/forge/types/memoryTypes.js';
import { WorkspaceSnapshot } from '../../../common/forge/types/workspaceTypes.js';
import { BrowserPage, DOMSelection } from '../../../common/forge/types/browserTypes.js';
import { SemanticRanker } from './semanticRanker.js';
import { ContextOrchestrator } from './contextOrchestrator.js';

export interface ContextBuildOptions {
	query: string;
	searchHits?: SemanticSearchHit[];
	memoryEntries?: KnowledgeEntry[];
	activeFileContext?: string;
	openFilesContext?: string[];
	diagnosticsContext?: string;
	gitStatusContext?: string;
	terminalOutputContext?: string;
	/** Phase 2: workspace intelligence */
	workspaceSnapshot?: WorkspaceSnapshot | null;
	workspaceActiveFilePath?: string;
	/** Phase 2.5: browser intelligence */
	browserPage?: BrowserPage | null;
	browserSelection?: DOMSelection | null;
}

export interface BuiltContext {
	readonly query: string;
	readonly searchHits: SemanticSearchHit[];
	readonly memoryEntries: KnowledgeEntry[];
	readonly activeFileContext?: string;
	readonly formattedPromptBlock: string;
}

export class ForgeContextBuilder {
	private readonly ranker = new SemanticRanker();
	private readonly orchestrator = new ContextOrchestrator();

	buildContext(options: ContextBuildOptions): BuiltContext {
		const rawHits = options.searchHits || [];
		const memory = options.memoryEntries || [];

		// Pass hits through multi-signal SemanticRanker
		const rankedHits = this.ranker.rankHits({
			query: options.query,
			searchHits: rawHits,
			activeFileUri: options.workspaceActiveFilePath,
			openFilesUris: options.openFilesContext
		});

		// Run Adaptive Orchestration (Intent -> Budget Profile -> Staged Compression -> Prompt)
		const orchResult = this.orchestrator.orchestrate(
			options.query,
			options.workspaceSnapshot,
			options.browserPage,
			options.browserSelection
		);

		const hitsFormatted = rankedHits
			.map(rh => {
				const h = rh.item;
				return `- ${h.chunk.filePath} [L${h.chunk.startLine}-${h.chunk.endLine}] (RankScore: ${rh.score}):\n${h.chunk.content}`;
			})
			.join('\n\n');

		const memoryFormatted = memory
			.map(m => `[${m.category.toUpperCase()}] ${m.title}: ${m.content}`)
			.join('\n');

		const openFilesFormatted = options.openFilesContext ? options.openFilesContext.join('\n---\n') : '';

		const block = `
<forge_context intent="${orchResult.analysis.intent}" confidence="${orchResult.analysis.confidence}">
<semantic_search_hits>
${hitsFormatted || 'No search hits.'}
</semantic_search_hits>

<project_knowledge>
${memoryFormatted || 'No project rules.'}
</project_knowledge>

${orchResult.promptBlock}

${options.activeFileContext ? `<active_file>\n${options.activeFileContext}\n</active_file>` : ''}
${openFilesFormatted ? `<open_files>\n${openFilesFormatted}\n</open_files>` : ''}
${options.diagnosticsContext ? `<diagnostics>\n${options.diagnosticsContext}\n</diagnostics>` : ''}
${options.gitStatusContext ? `<git_status>\n${options.gitStatusContext}\n</git_status>` : ''}
${options.terminalOutputContext ? `<terminal_output>\n${options.terminalOutputContext}\n</terminal_output>` : ''}
</forge_context>`.trim();

		return {
			query: options.query,
			searchHits: rankedHits.map(r => r.item),
			memoryEntries: memory,
			activeFileContext: options.activeFileContext,
			formattedPromptBlock: block
		};
	}
}

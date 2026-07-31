import { ContextStage, CompressionSummary, GitHubContext } from '../../../common/forge/types/tokenCompressionTypes.js';
import { WorkspaceSnapshot } from '../../../common/forge/types/workspaceTypes.js';
import { BrowserPage, DOMSelection } from '../../../common/forge/types/browserTypes.js';
import { TokenBudgetManager } from './tokenBudgetManager.js';
import { CompressionCache } from './compressionCache.js';

export class ContextCompressor {
	private readonly budgetManager = new TokenBudgetManager();
	private readonly cache = CompressionCache.getInstance();

	compressWorkspace(snapshot: WorkspaceSnapshot | null | undefined, stage: ContextStage = 'Stage1_SymbolsOnly'): { text: string; estTokens: number } {
		if (!snapshot) return { text: '', estTokens: 0 };

		const cacheKey = `ws:${snapshot.generatedAt}:${stage}`;
		const cached = this.cache.get(cacheKey);
		if (cached) {
			return { text: cached, estTokens: this.budgetManager.estimateTokens(cached) };
		}

		let result = '';

		if (stage === 'Stage1_SymbolsOnly') {
			// Symbol-first compression: export signatures only
			const topSymbols = snapshot.symbols
				.filter(s => s.isExported)
				.slice(0, 20)
				.map(s => `  ${s.kind} ${s.name} (${s.filePath.split('/').slice(-1)[0]}:${s.startLine})`)
				.join('\n');

			result = `<workspace_compressed stage="Stage1_SymbolsOnly">
Active Symbols:
${topSymbols}
Total Files: ${snapshot.stats.totalFiles} | Total Symbols: ${snapshot.stats.totalSymbols}
</workspace_compressed>`;
		} else {
			// Full module block
			const modules = snapshot.modules.slice(0, 5)
				.map(m => `  ${m.dirPath} [coupling: ${m.couplingScore}]`)
				.join('\n');

			result = `<workspace_compressed stage="${stage}">
Modules:
${modules}
</workspace_compressed>`;
		}

		// Enforce token budget for workspace slot (30% = ~1200 tokens)
		const budget = this.budgetManager.getAllocation().workspaceTokens;
		const truncated = this.budgetManager.truncateToBudget(result, budget);

		this.cache.set(cacheKey, truncated);
		return { text: truncated, estTokens: this.budgetManager.estimateTokens(truncated) };
	}

	compressBrowser(page?: BrowserPage | null, selection?: DOMSelection | null): { text: string; estTokens: number } {
		if (!page && !selection) return { text: '', estTokens: 0 };

		let result = '';
		if (selection) {
			result = `<browser_selection xpath="${selection.xpath}">\n${selection.text}\n</browser_selection>`;
		} else if (page) {
			result = `<browser_summary url="${page.url}">
Title: ${page.title}
Headings: ${page.headings.map(h => h.text).join(' · ')}
Code Blocks Count: ${page.codeBlocks.length}
</browser_summary>`;
		}

		const budget = this.budgetManager.getAllocation().browserTokens;
		const truncated = this.budgetManager.truncateToBudget(result, budget);
		return { text: truncated, estTokens: this.budgetManager.estimateTokens(truncated) };
	}

	compressGitHub(gitHubContext?: GitHubContext | null): { text: string; estTokens: number } {
		if (!gitHubContext) return { text: '', estTokens: 0 };

		const result = `<github_context>
Repository: ${gitHubContext.repository} [${gitHubContext.branch}@${gitHubContext.commit.slice(0, 7)}]
Summary: ${gitHubContext.summary}
Changed Symbols: ${gitHubContext.changedSymbols.join(', ')}
Affected Modules: ${gitHubContext.affectedModules.join(', ')}
</github_context>`;

		const budget = this.budgetManager.getAllocation().gitHubTokens;
		const truncated = this.budgetManager.truncateToBudget(result, budget);
		return { text: truncated, estTokens: this.budgetManager.estimateTokens(truncated) };
	}

	calculateSummary(originalLength: number, compressedLength: number, stage: ContextStage): CompressionSummary {
		const origEst = this.budgetManager.estimateTokens(' '.repeat(originalLength));
		const compEst = this.budgetManager.estimateTokens(' '.repeat(compressedLength));
		const savings = origEst > 0 ? Math.round(((origEst - compEst) / origEst) * 100) : 0;

		return {
			originalTokenEstimate: origEst,
			compressedTokenEstimate: compEst,
			savingsPercentage: Math.max(0, savings),
			stageUsed: stage
		};
	}
}

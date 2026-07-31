import { IntentAnalyzer } from './intentAnalyzer.js';
import { RetrievalPlanner } from './retrievalPlanner.js';
import { ContextCompressor } from './contextCompressor.js';
import { IntentAnalysis, Evidence } from '../../../common/forge/types/adaptiveTypes.js';
import { WorkspaceSnapshot } from '../../../common/forge/types/workspaceTypes.js';
import { BrowserPage, DOMSelection } from '../../../common/forge/types/browserTypes.js';

export interface OrchestratorResult {
	readonly analysis: IntentAnalysis;
	readonly activeProviders: string[];
	readonly evidenceList: Evidence[];
	readonly promptBlock: string;
}

export class ContextOrchestrator {
	private readonly analyzer = new IntentAnalyzer();
	private readonly planner = new RetrievalPlanner();
	private readonly compressor = new ContextCompressor();

	orchestrate(
		query: string,
		workspaceSnapshot?: WorkspaceSnapshot | null,
		browserPage?: BrowserPage | null,
		browserSelection?: DOMSelection | null
	): OrchestratorResult {
		// 1. Analyze intent
		const analysis = this.analyzer.analyzeIntent(query);

		// 2. Select providers
		const activeProviders = this.planner.selectProviders(analysis.intent);

		// 3. Confidence-based escalation (Stage 1 vs Stage 2)
		const stage = analysis.confidence >= 0.85 ? 'Stage1_SymbolsOnly' : 'Stage2_RelatedFiles';

		// 4. Compress context blocks
		const wsComp = activeProviders.includes('workspace') ? this.compressor.compressWorkspace(workspaceSnapshot, stage) : { text: '', estTokens: 0 };
		const brComp = activeProviders.includes('browser') ? this.compressor.compressBrowser(browserPage, browserSelection) : { text: '', estTokens: 0 };

		// 5. Track evidence
		const evidenceList: Evidence[] = [];
		if (wsComp.text) {
			evidenceList.push({
				provider: 'workspace',
				entityId: 'workspace_snapshot',
				confidence: analysis.confidence,
				retrievalStage: stage === 'Stage1_SymbolsOnly' ? 1 : 2
			});
		}
		if (brComp.text) {
			evidenceList.push({
				provider: 'browser',
				entityId: browserPage?.url || 'browser_selection',
				confidence: 0.9,
				retrievalStage: 1
			});
		}

		// 6. Compose final prompt block
		const promptBlock = `
<adaptive_context intent="${analysis.intent}" confidence="${analysis.confidence}">
${wsComp.text}
${brComp.text}
</adaptive_context>`.trim();

		return {
			analysis,
			activeProviders,
			evidenceList,
			promptBlock
		};
	}
}

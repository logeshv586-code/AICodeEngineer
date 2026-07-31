import { IntentAnalysis } from '../../../common/forge/types/adaptiveTypes.js';

export class IntentAnalyzer {
	analyzeIntent(query: string): IntentAnalysis {
		const q = query.toLowerCase();

		if (q.includes('debug') || q.includes('failing') || q.includes('error') || q.includes('bug') || q.includes('fix') || q.includes('exception')) {
			return {
				intent: 'Debug',
				confidence: 0.92,
				keywords: ['debug', 'error', 'failing'],
				explanation: 'User is troubleshooting an error or failure'
			};
		}

		if (q.includes('test') || q.includes('playwright') || q.includes('jest') || q.includes('unittest') || q.includes('cypress')) {
			return {
				intent: 'TestGeneration',
				confidence: 0.95,
				keywords: ['test', 'playwright', 'unit'],
				explanation: 'User requests unit or end-to-end test generation'
			};
		}

		if (q.includes('doc') || q.includes('mdn') || q.includes('api reference') || q.includes('how to use') || q.includes('react.dev')) {
			return {
				intent: 'Documentation',
				confidence: 0.90,
				keywords: ['documentation', 'api', 'mdn'],
				explanation: 'User requires external or API documentation search'
			};
		}

		if (q.includes('architecture') || q.includes('design') || q.includes('module') || q.includes('structure') || q.includes('coupling')) {
			return {
				intent: 'Architecture',
				confidence: 0.88,
				keywords: ['architecture', 'module', 'structure'],
				explanation: 'User asks for high-level architectural overview'
			};
		}

		if (q.includes('pr') || q.includes('pull request') || q.includes('review') || q.includes('diff')) {
			return {
				intent: 'ReviewPR',
				confidence: 0.91,
				keywords: ['review', 'diff', 'pr'],
				explanation: 'User requests code review or diff analysis'
			};
		}

		if (q.includes('refactor') || q.includes('clean') || q.includes('simplify') || q.includes('optimiz')) {
			return {
				intent: 'Refactor',
				confidence: 0.85,
				keywords: ['refactor', 'clean', 'simplify'],
				explanation: 'User requests code refactoring or cleanup'
			};
		}

		return {
			intent: 'ExplainCode',
			confidence: 0.80,
			keywords: ['explain'],
			explanation: 'Default code explanation or query intent'
		};
	}
}

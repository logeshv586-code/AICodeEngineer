import { createDecorator } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IndexStats, SemanticSearchHit, SemanticSearchOpts } from '../types/semanticSearchTypes.js';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';

export const ISemanticSearchService = createDecorator<ISemanticSearchService>('semanticSearchService');

export interface ISemanticSearchService {
	readonly _serviceBrand: undefined;
	search(opts: SemanticSearchOpts, token?: CancellationToken): Promise<SemanticSearchHit[]>;
	indexWorkspace(workspacePath: string, token?: CancellationToken): Promise<IndexStats>;
	getStats(workspacePath: string): Promise<IndexStats>;
}

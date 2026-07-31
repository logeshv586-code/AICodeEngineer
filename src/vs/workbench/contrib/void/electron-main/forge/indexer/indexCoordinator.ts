import * as fs from 'fs';
import { WorkspaceScanner } from './scanner.js';
import { CodeChunker } from './chunker.js';
import { EmbeddingWorker } from '../embeddings/embeddingWorker.js';
import { LanceDBService } from '../storage/lancedbService.js';
import { MetadataStore } from '../storage/metadataStore.js';
import { IndexStats } from '../../../common/forge/types/semanticSearchTypes.js';

export class IndexCoordinator {
	private readonly scanner = new WorkspaceScanner();
	private readonly chunker = new CodeChunker();
	private isIndexing = false;
	private indexedFilesCount = 0;
	private lastIndexedAt = 0;

	constructor(
		private readonly embedder: EmbeddingWorker,
		private readonly lancedb: LanceDBService,
		private readonly metadataStore: MetadataStore
	) { }

	async startIndexing(workspacePath: string, _forceReindex = false): Promise<IndexStats> {
		if (this.isIndexing) {
			return this.getStats(workspacePath);
		}

		this.isIndexing = true;
		try {
			const files = await this.scanner.scanWorkspace(workspacePath);
			let totalChunks = 0;

			for (const filePath of files) {
				try {
					const content = await fs.promises.readFile(filePath, 'utf-8');
					const chunks = this.chunker.chunkFile(filePath, content);
					if (chunks.length > 0) {
						const contents = chunks.map(c => c.content);
						const vectors = await this.embedder.generateEmbeddingsBatch(contents);
						const records = chunks.map((chunk, i) => ({ chunk, vector: vectors[i] }));
						await this.lancedb.saveChunks(records);
						totalChunks += chunks.length;

						this.metadataStore.setFileMetadata({
							filePath,
							hash: chunks[0]?.hash || '',
							lastIndexedAt: Date.now(),
							chunkCount: chunks.length
						});
					}
				} catch (e) {
					// Skip unreadable files
				}
			}

			this.indexedFilesCount = files.length;
			this.lastIndexedAt = Date.now();
			return {
				totalFiles: this.indexedFilesCount,
				totalChunks,
				lastIndexedAt: this.lastIndexedAt,
				modelName: this.embedder.getModelName(),
				isIndexing: false
			};
		} finally {
			this.isIndexing = false;
		}
	}

	getStats(workspacePath: string): IndexStats {
		return {
			totalFiles: this.indexedFilesCount,
			totalChunks: this.lancedb.getChunkCount(),
			lastIndexedAt: this.lastIndexedAt,
			modelName: this.embedder.getModelName(),
			isIndexing: this.isIndexing
		};
	}
}

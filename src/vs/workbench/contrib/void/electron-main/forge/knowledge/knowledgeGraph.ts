/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { KnowledgeEntity, KnowledgeEdge, KnowledgeGraphSnapshot } from '../../../common/forge/types/knowledgeGraphTypes.js';
import { WorkspaceSnapshot } from '../../../common/forge/types/workspaceTypes.js';
import { BrowserPage } from '../../../common/forge/types/browserTypes.js';

export class KnowledgeGraph {
	private static instance?: KnowledgeGraph;
	private readonly entities = new Map<string, KnowledgeEntity>();
	private readonly edges = new Map<string, KnowledgeEdge>();
	private readonly adjacency = new Map<string, Set<string>>();

	public static getInstance(): KnowledgeGraph {
		if (!this.instance) {
			this.instance = new KnowledgeGraph();
		}
		return this.instance;
	}

	addEntity(entity: KnowledgeEntity): void {
		this.entities.set(entity.id, entity);
	}

	addEdge(edge: KnowledgeEdge): void {
		this.edges.set(edge.id, edge);
		const neighbors = this.adjacency.get(edge.fromId) || new Set();
		neighbors.add(edge.toId);
		this.adjacency.set(edge.fromId, neighbors);
	}

	getEntity(id: string): KnowledgeEntity | undefined {
		return this.entities.get(id);
	}

	getNeighbors(entityId: string): KnowledgeEntity[] {
		const targetIds = this.adjacency.get(entityId);
		if (!targetIds) return [];
		const result: KnowledgeEntity[] = [];
		for (const id of targetIds) {
			const e = this.entities.get(id);
			if (e) result.push(e);
		}
		return result;
	}

	findPath(fromId: string, toId: string): KnowledgeEdge[] {
		const queue: string[] = [fromId];
		const visited = new Set<string>([fromId]);
		const parentEdge = new Map<string, KnowledgeEdge>();

		while (queue.length > 0) {
			const curr = queue.shift()!;
			if (curr === toId) {
				const path: KnowledgeEdge[] = [];
				let step = toId;
				while (step !== fromId) {
					const edge = parentEdge.get(step);
					if (!edge) break;
					path.unshift(edge);
					step = edge.fromId;
				}
				return path;
			}

			const neighborIds = this.adjacency.get(curr) || new Set();
			for (const nid of neighborIds) {
				if (!visited.has(nid)) {
					visited.add(nid);
					for (const edge of this.edges.values()) {
						if (edge.fromId === curr && edge.toId === nid) {
							parentEdge.set(nid, edge);
							break;
						}
					}
					queue.push(nid);
				}
			}
		}
		return [];
	}

	populateFromWorkspace(snapshot: WorkspaceSnapshot): void {
		// Index files as entities
		for (const file of snapshot.files) {
			this.addEntity({
				id: `file:${file.absolutePath}`,
				type: 'workspace_file',
				title: file.relativePath,
				metadata: { sizeBytes: file.sizeBytes, language: file.language },
				source: 'workspace',
				timestamp: snapshot.generatedAt
			});
		}

		// Index symbols as entities
		for (const sym of snapshot.symbols) {
			const symEntityId = `symbol:${sym.id}`;
			this.addEntity({
				id: symEntityId,
				type: 'workspace_symbol',
				title: sym.name,
				metadata: { kind: sym.kind, filePath: sym.filePath, line: sym.startLine },
				source: 'workspace',
				timestamp: snapshot.generatedAt
			});

			// Edge: file contains symbol
			this.addEdge({
				id: `contains:${fileId(sym.filePath)}->${symEntityId}`,
				fromId: `file:${sym.filePath}`,
				toId: symEntityId,
				relation: 'contains',
				weight: 1.0
			});
		}

		// Import edges
		for (const imp of snapshot.imports) {
			if (imp.resolvedPath) {
				this.addEdge({
					id: `imports:${imp.fromFile}->${imp.resolvedPath}`,
					fromId: `file:${imp.fromFile}`,
					toId: `file:${imp.resolvedPath}`,
					relation: 'imports',
					weight: 0.8
				});
			}
		}
	}

	crossLinkWorkspaceAndBrowser(workspaceSymbols: { id: string; name: string; filePath: string }[], pages: BrowserPage[]): void {
		for (const page of pages) {
			const pageEntityId = `browser:${page.id}`;
			this.addEntity({
				id: pageEntityId,
				type: 'browser_page',
				title: page.title,
				metadata: { url: page.url },
				source: 'browser',
				timestamp: page.timestamp
			});

			const textContent = (page.title + ' ' + page.markdown).toLowerCase();

			for (const sym of workspaceSymbols) {
				if (sym.name.length >= 3 && textContent.includes(sym.name.toLowerCase())) {
					this.addEdge({
						id: `documents:${pageEntityId}->symbol:${sym.id}`,
						fromId: pageEntityId,
						toId: `symbol:${sym.id}`,
						relation: 'documents',
						weight: 0.9
					});
				}
			}
		}
	}

	getSnapshot(): KnowledgeGraphSnapshot {
		const entitiesList = Array.from(this.entities.values());
		const edgesList = Array.from(this.edges.values());
		return {
			entities: entitiesList,
			edges: edgesList,
			totalEntities: entitiesList.length,
			totalEdges: edgesList.length,
			generatedAt: Date.now()
		};
	}
}

function fileId(fp: string): string {
	return `file:${fp}`;
}

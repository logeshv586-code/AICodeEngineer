/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type EntityType =
	| 'workspace_symbol'
	| 'workspace_file'
	| 'module'
	| 'browser_page'
	| 'dom_node'
	| 'code_block'
	| 'memory'
	| 'issue'
	| 'commit';

export type RelationType =
	| 'uses'
	| 'imports'
	| 'extends'
	| 'implements'
	| 'references'
	| 'documents'
	| 'calls'
	| 'contains'
	| 'related_to'
	| 'tested_by'
	| 'mentions';

export interface KnowledgeEntity {
	readonly id: string;
	readonly type: EntityType;
	readonly title: string;
	readonly metadata: Record<string, any>;
	readonly source: string; // e.g. 'workspace', 'browser', 'memory'
	readonly timestamp: number;
}

export interface KnowledgeEdge {
	readonly id: string;
	readonly fromId: string;
	readonly toId: string;
	readonly relation: RelationType;
	readonly weight: number; // 0.0 to 1.0
}

export interface KnowledgeGraphSnapshot {
	readonly entities: KnowledgeEntity[];
	readonly edges: KnowledgeEdge[];
	readonly totalEntities: number;
	readonly totalEdges: number;
	readonly generatedAt: number;
}

export interface WorkspaceHealthStats {
	readonly totalFiles: number;
	readonly totalSymbols: number;
	readonly complexityScore: number;
	readonly circularImportCount: number;
	readonly mostCoupledModule: string;
	readonly deadCodeCount: number;
	readonly unusedExportCount: number;
	readonly healthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface RankedHit<T = any> {
	readonly item: T;
	readonly score: number; // 0.0 to 1.0
	readonly breakdown: {
		readonly semanticScore: number;
		readonly astMatchScore: number;
		readonly graphProximityScore: number;
		readonly activeContextScore: number;
		readonly memoryScore: number;
	};
}

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface DOMNode {
	readonly tag: string;
	readonly id?: string;
	readonly className?: string;
	readonly textContent?: string;
	readonly xpath: string;
	readonly attributes: Record<string, string>;
}

export interface Heading {
	readonly level: number; // 1 to 6
	readonly text: string;
	readonly id?: string;
}

export interface CodeBlock {
	readonly id: string;
	readonly language: string;
	readonly code: string;
	readonly lineCount: number;
}

export interface TableInfo {
	readonly id: string;
	readonly headers: string[];
	readonly rowCount: number;
	readonly sampleRows: string[][];
}

export interface FormField {
	readonly name: string;
	readonly type: string;
	readonly label?: string;
	readonly placeholder?: string;
}

export interface FormInfo {
	readonly id: string;
	readonly action?: string;
	readonly method?: string;
	readonly fields: FormField[];
}

export interface DOMSelection {
	readonly id: string;
	readonly text: string;
	readonly html: string;
	readonly xpath: string;
	readonly startContainerTag?: string;
	readonly timestamp: number;
}

export interface BrowserPage {
	readonly id: string;
	readonly url: string;
	readonly title: string;
	readonly favicon?: string;
	readonly html: string;
	readonly markdown: string;
	readonly screenshot?: string;
	readonly domTree: DOMNode[];
	readonly headings: Heading[];
	readonly codeBlocks: CodeBlock[];
	readonly tables: TableInfo[];
	readonly forms: FormInfo[];
	readonly selectedNodes: DOMSelection[];
	readonly timestamp: number;
}

export interface BrowserTabState {
	readonly id: string;
	readonly url: string;
	readonly title: string;
	readonly isLoading: boolean;
	readonly page?: BrowserPage;
	readonly isPinned: boolean;
	readonly isBookmarked: boolean;
}

export interface BrowserCacheEntry {
	readonly url: string;
	readonly title: string;
	readonly markdown: string;
	readonly summary: string;
	readonly codeBlocks: CodeBlock[];
	readonly timestamp: number;
}

export interface WorkspaceMatch {
	readonly symbolName: string;
	readonly kind: string;
	readonly filePath: string;
	readonly matchScore: number;
	readonly reason: string;
}

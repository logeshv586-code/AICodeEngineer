/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as fs from 'fs';
import { SymbolInfo, ParsedFile } from '../../../common/forge/types/workspaceTypes.js';
import { ParserRegistry } from './parser.js';

export class SymbolExtractor {
	constructor(private readonly registry: ParserRegistry) { }

	/**
	 * Parse a single file and return its symbols.
	 * Returns empty array if no suitable parser is found.
	 */
	async extractFromFile(filePath: string): Promise<{ parsed: ParsedFile; symbols: SymbolInfo[] }> {
		const ext = path.extname(filePath).toLowerCase();
		const parser = this.registry.getParser(ext);
		if (!parser) return { parsed: { filePath, language: 'unknown', rawLines: [], symbols: [], imports: [], calls: [] }, symbols: [] };

		let content: string;
		try {
			content = await fs.promises.readFile(filePath, 'utf-8');
		} catch {
			return { parsed: { filePath, language: 'unknown', rawLines: [], symbols: [], imports: [], calls: [] }, symbols: [] };
		}

		const parsed = parser.parse(filePath, content);
		return { parsed, symbols: parsed.symbols };
	}

	/**
	 * Batch extraction for a file list. Returns a Map from filePath → symbols.
	 */
	async extractFromFiles(filePaths: string[]): Promise<Map<string, { parsed: ParsedFile; symbols: SymbolInfo[] }>> {
		const result = new Map<string, { parsed: ParsedFile; symbols: SymbolInfo[] }>();
		await Promise.all(
			filePaths.map(async fp => {
				const r = await this.extractFromFile(fp);
				result.set(fp, r);
			})
		);
		return result;
	}
}

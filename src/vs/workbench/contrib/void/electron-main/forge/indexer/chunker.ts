/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as crypto from 'crypto';
import { VectorChunk } from '../../../common/forge/types/semanticSearchTypes.js';

export interface ChunkOptions {
	maxLines?: number;
	overlapLines?: number;
}

export class CodeChunker {
	chunkFile(filePath: string, fileContent: string, options: ChunkOptions = {}): VectorChunk[] {
		const maxLines = options.maxLines || 40;
		const overlap = options.overlapLines || 10;

		const lines = fileContent.split(/\r?\n/);
		if (lines.length === 0) return [];

		const chunks: VectorChunk[] = [];
		let start = 0;

		while (start < lines.length) {
			const end = Math.min(start + maxLines, lines.length);
			const chunkLines = lines.slice(start, end);
			const content = chunkLines.join('\n');

			if (content.trim().length > 0) {
				const hash = crypto.createHash('sha256').update(`${filePath}:${start}:${end}:${content}`).digest('hex');
				chunks.push({
					id: `${filePath}#L${start + 1}-${end}`,
					filePath,
					startLine: start + 1,
					endLine: end,
					content,
					hash
				});
			}

			if (end >= lines.length) break;
			start += maxLines - overlap;
		}

		return chunks;
	}
}

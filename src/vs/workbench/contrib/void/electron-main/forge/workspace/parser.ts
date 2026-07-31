/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ParsedFile, SymbolInfo, ImportInfo, CallInfo } from '../../../common/forge/types/workspaceTypes.js';

// ── Language-agnostic parser interface ────────────────────────────────────────

export interface IWorkspaceParser {
	readonly language: string;
	readonly supportedExtensions: string[];
	parse(filePath: string, content: string): ParsedFile;
	extractSymbols(parsed: ParsedFile): SymbolInfo[];
	extractImports(parsed: ParsedFile): ImportInfo[];
	extractCalls(parsed: ParsedFile): CallInfo[];
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function makeSymbolId(filePath: string, name: string, startLine: number): string {
	return `${filePath}::${name}::${startLine}`;
}

// ── TypeScript / JavaScript parser ────────────────────────────────────────────

export class TypeScriptParser implements IWorkspaceParser {
	readonly language = 'typescript';
	readonly supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

	parse(filePath: string, content: string): ParsedFile {
		const rawLines = content.split('\n');
		const symbols = this._extractSymbols(filePath, rawLines);
		const imports = this._extractImports(filePath, rawLines);
		const calls = this._extractCalls(filePath, rawLines, symbols);
		return { filePath, language: this.language, rawLines, symbols, imports, calls };
	}

	extractSymbols(parsed: ParsedFile): SymbolInfo[] { return parsed.symbols; }
	extractImports(parsed: ParsedFile): ImportInfo[] { return parsed.imports; }
	extractCalls(parsed: ParsedFile): CallInfo[] { return parsed.calls; }

	private _extractSymbols(filePath: string, lines: string[]): SymbolInfo[] {
		const symbols: SymbolInfo[] = [];
		// Patterns: exported or unexported declarations
		const patterns: { re: RegExp; kind: SymbolInfo['kind'] }[] = [
			{ re: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/, kind: 'class' },
			{ re: /^(?:export\s+)?(?:default\s+)?function\s*\*?\s*(\w+)\s*[(<]/, kind: 'function' },
			{ re: /^(?:export\s+)?interface\s+(\w+)/, kind: 'interface' },
			{ re: /^(?:export\s+)?type\s+(\w+)\s*=/, kind: 'type' },
			{ re: /^(?:export\s+)?enum\s+(\w+)/, kind: 'enum' },
			{ re: /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*\S+\s*)?=\s*(?:async\s+)?(?:\(|function|\(.*\)\s*=>)/, kind: 'function' },
			{ re: /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?=/, kind: 'const' },
		];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line || line.startsWith('//') || line.startsWith('*')) continue;

			// Collect doc comment above this line
			let docComment: string | undefined;
			if (i > 0 && lines[i - 1].trim().endsWith('*/')) {
				const commentLines: string[] = [];
				let j = i - 1;
				while (j >= 0 && !lines[j].includes('/**')) j--;
				commentLines.push(...lines.slice(j, i).map(l => l.trim().replace(/^\*\/?/, '').trim()));
				docComment = commentLines.join(' ').replace(/\s+/g, ' ').trim();
			}

			for (const { re, kind } of patterns) {
				const match = re.exec(line);
				if (match && match[1]) {
					const name = match[1];
					symbols.push({
						id: makeSymbolId(filePath, name, i + 1),
						name,
						kind,
						filePath,
						startLine: i + 1,
						endLine: i + 1, // single-line approximation; block scanning below refines this
						isExported: line.startsWith('export'),
						docComment,
						signature: line.slice(0, 120)
					});
					break;
				}
			}

			// Detect class methods (indented function-like declarations)
			const methodRe = /^\s+(?:public|private|protected|static|async|override)?\s*(?:get|set|async\s+)?(\w+)\s*[(<]/;
			const methodMatch = methodRe.exec(lines[i]);
			if (methodMatch && methodMatch[1] && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(methodMatch[1])) {
				const name = methodMatch[1];
				symbols.push({
					id: makeSymbolId(filePath, name, i + 1),
					name,
					kind: name === 'constructor' ? 'constructor' : 'method',
					filePath,
					startLine: i + 1,
					endLine: i + 1,
					isExported: false,
					signature: lines[i].trim().slice(0, 120)
				});
			}
		}

		return symbols;
	}

	private _extractImports(filePath: string, lines: string[]): ImportInfo[] {
		const imports: ImportInfo[] = [];

		for (const line of lines) {
			const trimmed = line.trim();

			// Static: import { a, b } from 'mod' | import * as x from 'mod' | import 'mod'
			const staticRe = /^import\s+(?:type\s+)?(.+?)\s+from\s+['"](.+?)['"]/;
			const sideEffectRe = /^import\s+['"](.+?)['"]/;
			// Dynamic: import('mod') or require('mod')
			const dynamicRe = /(?:import|require)\s*\(\s*['"](.+?)['"]\s*\)/g;

			let m = staticRe.exec(trimmed);
			if (m) {
				const namesRaw = m[1];
				const toModule = m[2];
				const importedNames = this._parseImportedNames(namesRaw);
				imports.push({ fromFile: filePath, toModule, importedNames, isDynamic: false });
				continue;
			}

			m = sideEffectRe.exec(trimmed);
			if (m) {
				imports.push({ fromFile: filePath, toModule: m[1], importedNames: [], isDynamic: false });
				continue;
			}

			let dm: RegExpExecArray | null;
			while ((dm = dynamicRe.exec(trimmed)) !== null) {
				imports.push({ fromFile: filePath, toModule: dm[1], importedNames: ['*'], isDynamic: true });
			}
		}

		return imports;
	}

	private _parseImportedNames(raw: string): string[] {
		raw = raw.trim();
		if (raw.startsWith('* as')) return ['*'];
		if (raw.startsWith('{')) {
			return raw.replace(/[{}]/g, '').split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
		}
		// default import
		return [raw.split(',')[0].trim()].filter(Boolean);
	}

	private _extractCalls(filePath: string, lines: string[], symbols: SymbolInfo[]): CallInfo[] {
		const calls: CallInfo[] = [];
		const symbolNames = new Set(symbols.map(s => s.name));
		// Simple heuristic: find `identifer(` patterns in non-declaration lines
		const callRe = /\b([A-Za-z_]\w*)\s*\(/g;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (/^\s*(function|class|interface|type|enum|const|let|var|import|export)\b/.test(line.trim())) continue;
			let m: RegExpExecArray | null;
			while ((m = callRe.exec(line)) !== null) {
				const calleeName = m[1];
				if (['if', 'for', 'while', 'switch', 'catch', 'new', 'return', 'typeof', 'instanceof', 'await'].includes(calleeName)) continue;
				if (symbolNames.size > 0 && !symbolNames.has(calleeName)) continue;
				// Find enclosing symbol (nearest symbol whose startLine ≤ i+1)
				const enclosing = symbols.slice().reverse().find(s => s.startLine <= i + 1);
				calls.push({
					callerSymbolId: enclosing?.id ?? `${filePath}::__module__::0`,
					callerFile: filePath,
					calleeSymbolName: calleeName,
					isResolved: false, // resolved later by CallGraph
					line: i + 1
				});
			}
		}

		return calls;
	}
}

// ── Stub parsers for other languages ──────────────────────────────────────────

abstract class StubParser implements IWorkspaceParser {
	abstract readonly language: string;
	abstract readonly supportedExtensions: string[];

	parse(filePath: string, content: string): ParsedFile {
		return { filePath, language: this.language, rawLines: content.split('\n'), symbols: [], imports: [], calls: [] };
	}
	extractSymbols(parsed: ParsedFile): SymbolInfo[] { return parsed.symbols; }
	extractImports(parsed: ParsedFile): ImportInfo[] { return parsed.imports; }
	extractCalls(parsed: ParsedFile): CallInfo[] { return parsed.calls; }
}

export class PythonParser extends StubParser {
	readonly language = 'python';
	readonly supportedExtensions = ['.py', '.pyi'];
}

export class GoParser extends StubParser {
	readonly language = 'go';
	readonly supportedExtensions = ['.go'];
}

export class RustParser extends StubParser {
	readonly language = 'rust';
	readonly supportedExtensions = ['.rs'];
}

export class JavaParser extends StubParser {
	readonly language = 'java';
	readonly supportedExtensions = ['.java'];
}

// ── Parser registry ────────────────────────────────────────────────────────────

export class ParserRegistry {
	private readonly parsers: IWorkspaceParser[] = [
		new TypeScriptParser(),
		new PythonParser(),
		new GoParser(),
		new RustParser(),
		new JavaParser()
	];

	private readonly extMap = new Map<string, IWorkspaceParser>();

	constructor() {
		for (const p of this.parsers) {
			for (const ext of p.supportedExtensions) {
				this.extMap.set(ext, p);
			}
		}
	}

	getParser(ext: string): IWorkspaceParser | undefined {
		return this.extMap.get(ext.toLowerCase());
	}

	getSupportedExtensions(): string[] {
		return Array.from(this.extMap.keys());
	}
}

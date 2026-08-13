/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'fs/promises';
import { homedir, platform } from 'os';
import { dirname, isAbsolute, join } from 'path';
import { IndexStats, SemanticSearchHit } from '../../../common/forge/types/semanticSearchTypes.js';

type CommandResult = { stdout: string; stderr: string };
type CocoSearchResponse = {
	success: boolean;
	results?: Array<{ file_path: string; content: string; start_line: number; end_line: number; score: number }>;
	message?: string;
};

export type CocoIndexLocalStatus = {
	installed: boolean;
	initialized: boolean;
	runtimePath?: string;
	projectPath?: string;
	embeddingProvider?: string;
	embeddingModel?: string;
	sentenceTransformersAvailable: boolean;
	eligible: boolean;
	disabled: boolean;
	isIndexing: boolean;
	error?: string;
};

const LOCAL_SETTINGS = `embedding:
  provider: sentence-transformers
  model: Snowflake/snowflake-arctic-embed-xs
  indexing_params: {}
  query_params:
    prompt_name: query
daemon:
  idle_timeout_minutes: 15
  keep_alive_with_mcp: false
`;

export class CocoIndexCodeService {
	private readonly runtimeDirectory = join(homedir(), '.forge-ai', 'cocoindex-runtime');
	private readonly lastIndexedAt = new Map<string, number>();
	private readonly indexing = new Map<string, Promise<IndexStats>>();
	private readonly errors = new Map<string, string>();
	private sentenceTransformersAvailable: boolean | undefined;
	private executablePromise: Promise<string | undefined> | undefined;

	async getStatus(workspacePath?: string): Promise<CocoIndexLocalStatus> {
		const executable = await this._findExecutable();
		const projectSettings = workspacePath ? join(workspacePath, '.cocoindex_code', 'settings.yml') : undefined;
		const embedding = await this._readEmbeddingSettings();
		const eligible = workspacePath ? await this._isEligibleCodeProject(workspacePath) : false;
		return {
			installed: !!executable,
			initialized: !!executable && !!projectSettings && existsSync(this._globalSettingsPath()) && existsSync(projectSettings),
			runtimePath: executable,
			projectPath: workspacePath,
			embeddingProvider: embedding.provider,
			embeddingModel: embedding.model,
			sentenceTransformersAvailable: !!executable && await this._hasSentenceTransformers(executable),
			eligible,
			disabled: !!workspacePath && existsSync(this._disabledMarker(workspacePath)),
			isIndexing: !!workspacePath && this.indexing.has(workspacePath),
			error: workspacePath ? this.errors.get(workspacePath) : undefined,
		};
	}

	async install(): Promise<CocoIndexLocalStatus> {
		const existing = await this._findExecutable();
		if (!existing) {
			const python = await this._findPython();
			if (!python) throw new Error('Python 3.11-3.13 is required to install local CocoIndex.');
			await mkdir(this.runtimeDirectory, { recursive: true });
			await this._run(python.command, [...python.prefixArgs, '-m', 'venv', this.runtimeDirectory], undefined, 10 * 60_000);
			const runtimePython = this._runtimePython();
			await this._run(runtimePython, ['-m', 'pip', 'install', '--upgrade', 'pip'], undefined, 10 * 60_000);
			await this._run(runtimePython, ['-m', 'pip', 'install', '--upgrade', 'cocoindex-code[full]'], undefined, 30 * 60_000);
			this.executablePromise = undefined;
		}
		await this._ensureGlobalSettings();
		return this.getStatus();
	}

	async initializeProject(workspacePath: string): Promise<CocoIndexLocalStatus> {
		const executable = await this._requireExecutable();
		await this._ensureGlobalSettings();
		const settingsPath = join(workspacePath, '.cocoindex_code', 'settings.yml');
		await rm(this._disabledMarker(workspacePath), { force: true });
		if (!existsSync(settingsPath)) await this._run(executable, ['init', '--force'], workspacePath, 2 * 60_000);
		return this.getStatus(workspacePath);
	}

	async indexWorkspace(workspacePath: string): Promise<IndexStats> {
		const existing = this.indexing.get(workspacePath);
		if (existing) return existing;
		const operation = this._indexWorkspace(workspacePath);
		this.indexing.set(workspacePath, operation);
		try {
			const result = await operation;
			this.errors.delete(workspacePath);
			return result;
		} catch (error) {
			this.errors.set(workspacePath, error instanceof Error ? error.message : String(error));
			throw error;
		} finally {
			this.indexing.delete(workspacePath);
		}
	}

	private async _indexWorkspace(workspacePath: string): Promise<IndexStats> {
		const executable = await this._requireExecutable();
		await this.initializeProject(workspacePath);
		await this._run(executable, ['index'], workspacePath, 30 * 60_000);
		this.lastIndexedAt.set(workspacePath, Date.now());
		return this.getStats(workspacePath);
	}

	async autoPrepareWorkspace(workspacePath: string): Promise<CocoIndexLocalStatus> {
		const status = await this.getStatus(workspacePath);
		if (!status.installed || !status.eligible || status.disabled) return status;
		void this.indexWorkspace(workspacePath).catch(() => { /* status exposes the error */ });
		return this.getStatus(workspacePath);
	}

	async disableProject(workspacePath: string): Promise<CocoIndexLocalStatus> {
		const marker = this._disabledMarker(workspacePath);
		await mkdir(dirname(marker), { recursive: true });
		await writeFile(marker, 'Disabled from Forge Settings > Code Index.\n', 'utf8');
		return this.getStatus(workspacePath);
	}

	async rebuildWorkspace(workspacePath: string): Promise<IndexStats> {
		const executable = await this._requireExecutable();
		await this.initializeProject(workspacePath);
		await this._run(executable, ['reset', '--force'], workspacePath, 2 * 60_000);
		return this.indexWorkspace(workspacePath);
	}

	async search(workspacePath: string, query: string, topK = 5): Promise<SemanticSearchHit[]> {
		if (existsSync(this._disabledMarker(workspacePath))) {
			throw new Error('CocoIndex is disabled for this project. Use exact workspace search, or enable it in Forge Settings > Code Index.');
		}
		const executable = await this._requireExecutable();
		await this.initializeProject(workspacePath);
		const { stdout } = await this._run(executable, ['search', query, '--limit', String(Math.max(1, Math.min(100, topK))), '--refresh', '--json'], workspacePath, 30 * 60_000);
		let response: CocoSearchResponse;
		try { response = JSON.parse(stdout.trim()) as CocoSearchResponse; }
		catch { throw new Error(`CocoIndex returned invalid search output: ${stdout.slice(0, 500)}`); }
		if (!response.success) throw new Error(response.message || 'CocoIndex search failed.');
		this.lastIndexedAt.set(workspacePath, Date.now());
		return (response.results ?? []).map((result, index) => {
			const filePath = isAbsolute(result.file_path) ? result.file_path : join(workspacePath, result.file_path);
			return {
				score: result.score,
				chunk: {
					id: `cocoindex:${filePath}:${result.start_line}:${result.end_line}:${index}`,
					filePath,
					startLine: result.start_line,
					endLine: result.end_line,
					content: result.content,
					hash: '',
				},
			};
		});
	}

	async getStats(workspacePath: string): Promise<IndexStats> {
		const executable = await this._findExecutable();
		if (!executable || !existsSync(join(workspacePath, '.cocoindex_code', 'settings.yml'))) {
			return { totalFiles: 0, totalChunks: 0, lastIndexedAt: 0, modelName: 'CocoIndex (not installed)', isIndexing: false };
		}
		try {
			const { stdout } = await this._run(executable, ['status'], workspacePath, 60_000);
			const totalChunks = Number(/Chunks:\s*(\d+)/i.exec(stdout)?.[1] ?? 0);
			const totalFiles = Number(/Files:\s*(\d+)/i.exec(stdout)?.[1] ?? 0);
			let lastIndexedAt = this.lastIndexedAt.get(workspacePath) ?? 0;
			if (!lastIndexedAt) {
				for (const name of ['cocoindex.db', 'target_sqlite.db']) {
					try { lastIndexedAt = Math.max(lastIndexedAt, (await stat(join(workspacePath, '.cocoindex_code', name))).mtimeMs); } catch { /* not created yet */ }
				}
			}
			return { totalFiles, totalChunks, lastIndexedAt, modelName: 'CocoIndex local embeddings', isIndexing: false };
		} catch (error) {
			return { totalFiles: 0, totalChunks: 0, lastIndexedAt: 0, modelName: 'CocoIndex local embeddings', isIndexing: false, error: error instanceof Error ? error.message : String(error) };
		}
	}

	private async _ensureGlobalSettings(): Promise<void> {
		const settingsPath = this._globalSettingsPath();
		if (existsSync(settingsPath)) return;
		await mkdir(join(settingsPath, '..'), { recursive: true });
		await writeFile(settingsPath, LOCAL_SETTINGS, { encoding: 'utf8', flag: 'wx' }).catch(error => {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		});
	}

	private _globalSettingsPath(): string {
		return join(process.env.COCOINDEX_CODE_DIR || join(homedir(), '.cocoindex_code'), 'global_settings.yml');
	}

	private async _readEmbeddingSettings(): Promise<{ provider?: string; model?: string }> {
		try {
			const content = await readFile(this._globalSettingsPath(), 'utf8');
			const embeddingBlock = /embedding:\s*\r?\n((?:[ \t]+.*(?:\r?\n|$))*)/i.exec(content)?.[1] ?? '';
			return {
				provider: /^\s+provider:\s*["']?([^\r\n"']+)/mi.exec(embeddingBlock)?.[1]?.trim(),
				model: /^\s+model:\s*["']?([^\r\n"']+)/mi.exec(embeddingBlock)?.[1]?.trim(),
			};
		} catch { return {}; }
	}

	private async _hasSentenceTransformers(executable: string): Promise<boolean> {
		if (this.sentenceTransformersAvailable !== undefined) return this.sentenceTransformersAvailable;
		const candidates = executable === this._runtimeExecutable()
			? [{ command: this._runtimePython(), prefixArgs: [] }]
			: platform() === 'win32'
				? [{ command: 'py', prefixArgs: ['-3'] }, { command: 'python', prefixArgs: [] }]
				: [{ command: 'python3', prefixArgs: [] }, { command: 'python', prefixArgs: [] }];
		for (const candidate of candidates) {
			try {
				await this._run(candidate.command, [...candidate.prefixArgs, '-c', 'import importlib.util; raise SystemExit(0 if importlib.util.find_spec("sentence_transformers") else 1)'], undefined, 30_000);
				return this.sentenceTransformersAvailable = true;
			} catch { /* try next interpreter */ }
		}
		return this.sentenceTransformersAvailable = false;
	}

	private _disabledMarker(workspacePath: string): string {
		return join(workspacePath, '.cocoindex_code', 'forge-disabled');
	}

	private async _isEligibleCodeProject(workspacePath: string): Promise<boolean> {
		if (!workspacePath || !existsSync(workspacePath)) return false;
		const normalized = workspacePath.replace(/\\/g, '/').toLowerCase();
		const rejectedSegments = ['/node_modules/', '/.git/', '/windows/', '/program files/', '/appdata/local/temp/'];
		if (rejectedSegments.some(segment => `${normalized}/`.includes(segment))) return false;
		const projectMarkers = new Set(['.git', 'package.json', 'pyproject.toml', 'cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'composer.json', 'gemfile', 'makefile', 'cmakelists.txt', 'tsconfig.json']);
		const codeExtensions = /\.(?:ts|tsx|js|jsx|py|rs|go|java|kt|kts|c|cc|cpp|h|hpp|cs|php|rb|swift|scala|dart|vue|svelte)$/i;
		try {
			const entries = await readdir(workspacePath, { withFileTypes: true });
			if (entries.some(entry => projectMarkers.has(entry.name.toLowerCase()) || (entry.isFile() && codeExtensions.test(entry.name)))) return true;
			const sourceDirs = new Set(['src', 'source', 'app', 'apps', 'packages', 'lib', 'server', 'client']);
			return entries.some(entry => entry.isDirectory() && sourceDirs.has(entry.name.toLowerCase()));
		} catch { return false; }
	}

	private _runtimePython(): string {
		return platform() === 'win32' ? join(this.runtimeDirectory, 'Scripts', 'python.exe') : join(this.runtimeDirectory, 'bin', 'python');
	}

	private _runtimeExecutable(): string {
		return platform() === 'win32' ? join(this.runtimeDirectory, 'Scripts', 'ccc.exe') : join(this.runtimeDirectory, 'bin', 'ccc');
	}

	private async _findExecutable(): Promise<string | undefined> {
		if (!this.executablePromise) this.executablePromise = (async () => {
			const local = this._runtimeExecutable();
			if (existsSync(local)) return local;
			try { await this._run('ccc', ['--help'], undefined, 20_000); return 'ccc'; } catch { return undefined; }
		})();
		return this.executablePromise;
	}

	private async _requireExecutable(): Promise<string> {
		const executable = await this._findExecutable();
		if (!executable) throw new Error('Local CocoIndex is not installed. Open Forge Settings > Code Index and select Install locally for this project.');
		return executable;
	}

	private async _findPython(): Promise<{ command: string; prefixArgs: string[] } | undefined> {
		const candidates = platform() === 'win32'
			? [{ command: 'py', prefixArgs: ['-3'] }, { command: 'python', prefixArgs: [] }]
			: [{ command: 'python3', prefixArgs: [] }, { command: 'python', prefixArgs: [] }];
		for (const candidate of candidates) {
			try { await this._run(candidate.command, [...candidate.prefixArgs, '--version'], undefined, 20_000); return candidate; } catch { /* try next */ }
		}
		return undefined;
	}

	private _run(command: string, args: string[], cwd?: string, timeout = 120_000): Promise<CommandResult> {
		return new Promise((resolve, reject) => {
			execFile(command, args, {
				cwd,
				timeout,
				windowsHide: true,
				maxBuffer: 16 * 1024 * 1024,
				env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', NO_COLOR: '1' },
			}, (error, stdout, stderr) => {
				if (error) reject(new Error(`${error.message}${stderr ? `\n${stderr.trim()}` : ''}`));
				else resolve({ stdout, stderr });
			});
		});
	}
}

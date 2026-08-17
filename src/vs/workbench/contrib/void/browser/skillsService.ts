/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INativeEnvironmentService } from '../../../../platform/environment/common/environment.js';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

/** Shape of a single entry inside skill_registry.json */
export interface RegistrySkillEntry {
	id: string;
	name: string;
	short_description: string;
	category: string;
	tags: string[];
	aliases: string[];
	path: string;          // e.g. "skill_library/ai_ml/aiq-deploy/SKILL.md"
	checksum: string;      // "sha256:..."
	source: string;
	enabled: boolean;
	workspace_default: boolean;
	version?: number;
}

/** Skill_registry.json root shape */
interface SkillRegistry {
	schemaVersion: number;
	generatedAt: string;
	skillCount: number;
	skills: RegistrySkillEntry[];
}

/**
 * A skill definition parsed from a .md file in .agents/skills/
 * Kept for backward compat with existing UI code.
 */
export interface SkillDef {
	name: string;
	description: string;
	triggerKeywords: string[];
	body: string;
	filePath: string;
}

/** Unified routing candidate combining registry and workspace sources */
export interface RoutableSkill {
	id: string;
	name: string;
	short_description: string;
	category: string;
	tags: string[];
	aliases: string[];
	checksum: string;
	enabled: boolean;

	/** 'registry' = from skill_registry.json, 'workspace' = from .agents/skills/ */
	source: 'registry' | 'workspace';

	/** Registry skills: relative path like "skill_library/ai_ml/aiq-deploy/SKILL.md" */
	registryPath?: string;

	/** Workspace skills: trusted URI produced by IFileService scan */
	resolvedUri?: URI;
}

export interface SkillResolution {
	skill: RoutableSkill;
	matchType: 'exact_id' | 'exact_alias' | 'exact_name' | 'prefix' | 'keyword_ranking';
	confidence: number;
	candidates?: SkillCandidate[];
}

export interface SkillCandidate {
	skill: RoutableSkill;
	score: number;
	confidence: number;
}

export interface LoadedSkill {
	skill: RoutableSkill;
	body: string;
	matchType: string;
	confidence: number;
}

export interface SkillSearchResult {
	id: string;
	name: string;
	category: string;
	short_description: string;
	score: number;
	source: 'registry' | 'workspace';
}

export interface AutocompleteSuggestion {
	id: string;
	name: string;
	match: 'id_prefix' | 'alias_prefix' | 'name_substring';
	description: string;
}

export interface RoutingResult {
	type: 'natural' | 'explicit' | 'search' | 'none';
	loadedSkills: LoadedSkill[];
	candidates: SkillCandidate[];
	searchResults?: SkillSearchResult[];
	originalPrompt: string;
	effectivePrompt: string;
	suppressLLM: boolean;
}

export interface SkillPromptContext {
	routing: RoutingResult;
	systemPromptAddition: string;
}


// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLDS = {
	AUTO_LOAD: 0.85,
	CANDIDATE: 0.65,
	MAX_AUTO_COMPOSITE: 3,
	MAX_SKILL_CONTEXT_TOKENS: 4_000,
};


// ──────────────────────────────────────────────────────────────────────────────
// Interface
// ──────────────────────────────────────────────────────────────────────────────

export interface ISkillsService {
	readonly _serviceBrand: undefined;

	/** Returns workspace .agents/skills/ definitions (State 2) for UI listing. */
	getAllSkills(): SkillDef[];

	/** Number of skills in the registry (State 1). Returns 0 if not yet loaded. */
	getRegistrySkillCount(): number;

	/** Whether the registry has finished its initial load. */
	isRegistryLoaded(): boolean;

	/** Reload registry from app resources + workspace skills from .agents/skills/. */
	reloadSkills(): Promise<void>;

	/** Deterministic resolution: exact ID > alias > name > prefix > keyword. */
	resolveSkill(query: string): SkillResolution | null;

	/** Ranked search across all routing candidates. Async: waits for registry. */
	searchSkills(query: string): Promise<SkillSearchResult[]>;

	/** Synchronous autocomplete for chat input. Returns [] while loading. */
	autocompleteSkills(prefix: string, limit?: number): AutocompleteSuggestion[];

	/** Full routing: slash commands, explicit invocation, or confidence-based. */
	routeSkills(userMessage: string): Promise<RoutingResult>;

	/** Single entry point for ConvertToLLMMessageService. */
	prepareSkillContext(userMessage: string): Promise<SkillPromptContext>;

	/** Convenience wrapper returning only the system prompt addition string. */
	getSkillsSystemPromptAddition(userMessage: string): Promise<string>;
}

export const ISkillsService = createDecorator<ISkillsService>('voidSkillsService');


// ──────────────────────────────────────────────────────────────────────────────
// YAML frontmatter parsing (kept for workspace .agents/skills/)
// ──────────────────────────────────────────────────────────────────────────────

function parseFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
	const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
	const match = content.match(frontmatterRegex);

	if (!match) {
		return { frontmatter: {}, body: content };
	}

	const yamlStr = match[1];
	const body = match[2];

	// Minimal YAML parsing for our simple frontmatter format
	const frontmatter: Record<string, any> = {};
	for (const line of yamlStr.split('\n')) {
		const colonIdx = line.indexOf(':');
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		const rawVal = line.slice(colonIdx + 1).trim();

		// Parse array values like [react, component, hook]
		if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
			frontmatter[key] = rawVal
				.slice(1, -1)
				.split(',')
				.map(s => s.trim())
				.filter(Boolean);
		} else {
			frontmatter[key] = rawVal;
		}
	}

	return { frontmatter, body };
}


// ──────────────────────────────────────────────────────────────────────────────
// Service Implementation
// ──────────────────────────────────────────────────────────────────────────────

class SkillsService extends Disposable implements ISkillsService {
	_serviceBrand: undefined;

	// ── State ─────────────────────────────────────────────────────────────
	private _registrySkills: RoutableSkill[] = [];
	private _workspaceSkills: RoutableSkill[] = [];
	private _workspaceSkillDefs: SkillDef[] = [];    // backward compat for getAllSkills()
	private _routingCandidates: RoutableSkill[] = [];
	private _registryLoaded = false;
	private _loadPromise: Promise<void>;

	// Cached SKILL.md bodies keyed by "id:checksum"
	private readonly _skillContentCache = new Map<string, string>();

	constructor(
		@IWorkspaceContextService private readonly _workspaceContextService: IWorkspaceContextService,
		@IFileService private readonly _fileService: IFileService,
		@INativeEnvironmentService private readonly _environmentService: INativeEnvironmentService,
	) {
		super();
		// Start loading immediately; routeSkills() will await _ensureLoaded()
		this._loadPromise = this._reloadSkillsInternal();
	}


	// ── Public API ────────────────────────────────────────────────────────

	getAllSkills(): SkillDef[] {
		return this._workspaceSkillDefs;
	}

	getRegistrySkillCount(): number {
		return this._registrySkills.length;
	}

	isRegistryLoaded(): boolean {
		return this._registryLoaded;
	}

	async reloadSkills(): Promise<void> {
		this._loadPromise = this._reloadSkillsInternal();
		await this._loadPromise;
	}

	resolveSkill(query: string): SkillResolution | null {
		if (!query || typeof query !== 'string') return null;
		const clean = query.trim().replace(/^\//, '').toLowerCase();
		const pool = this._routingCandidates.filter(s => s.enabled !== false);

		// 1. Exact ID
		const exactId = pool.find(s => s.id.toLowerCase() === clean);
		if (exactId) return { skill: exactId, matchType: 'exact_id', confidence: 1.0 };

		// 2. Exact Alias
		const exactAlias = pool.find(s => (s.aliases || []).some(a => a.toLowerCase() === clean));
		if (exactAlias) return { skill: exactAlias, matchType: 'exact_alias', confidence: 0.98 };

		// 3. Exact Name (case-insensitive)
		const exactName = pool.find(s => (s.name || '').toLowerCase() === clean);
		if (exactName) return { skill: exactName, matchType: 'exact_name', confidence: 0.95 };

		// 4. Prefix
		const prefixMatch = pool.find(s => s.id.toLowerCase().startsWith(clean));
		if (prefixMatch) return { skill: prefixMatch, matchType: 'prefix', confidence: 0.85 };

		// 5. Keyword / tag multi-match ranking
		const tokens = clean.split(/\s+/).filter(Boolean);
		const scored: SkillCandidate[] = [];

		for (const skill of pool) {
			let score = 0;
			const sid = skill.id.toLowerCase();
			const sname = (skill.name || '').toLowerCase();
			const sdesc = (skill.short_description || '').toLowerCase();
			const tags = (skill.tags || []).map(t => t.toLowerCase());
			const aliases = (skill.aliases || []).map(a => a.toLowerCase());

			for (const t of tokens) {
				if (sid === t) score += 50;
				else if (sid.includes(t)) score += 20;
				if (aliases.some(a => a.includes(t))) score += 25;
				if (tags.includes(t)) score += 15;
				if (sname.includes(t)) score += 15;
				if (sdesc.includes(t)) score += 8;
			}

			if (score > 0) {
				scored.push({ skill, score, confidence: Math.min(score / 100, 0.94) });
			}
		}

		scored.sort((a, b) => b.score - a.score);

		if (scored.length > 0) {
			return {
				skill: scored[0].skill,
				matchType: 'keyword_ranking',
				confidence: scored[0].confidence,
				candidates: scored.slice(0, 5),
			};
		}

		return null;
	}

	async searchSkills(query: string): Promise<SkillSearchResult[]> {
		await this._ensureLoaded();

		if (!query || query.trim() === '') return [];

		const clean = query.trim().replace(/^\//, '').toLowerCase();
		const tokens = clean.split(/\s+/).filter(Boolean);
		const pool = this._routingCandidates.filter(s => s.enabled !== false);
		const scored: SkillSearchResult[] = [];

		for (const skill of pool) {
			let score = 0;
			const sid = skill.id.toLowerCase();
			const sname = (skill.name || '').toLowerCase();
			const sdesc = (skill.short_description || '').toLowerCase();
			const tags = (skill.tags || []).map(t => t.toLowerCase());
			const aliases = (skill.aliases || []).map(a => a.toLowerCase());

			if (sid === clean) score += 200;
			else if (sid.startsWith(clean)) score += 100;
			else if (aliases.includes(clean)) score += 150;

			for (const t of tokens) {
				if (sid.includes(t)) score += 30;
				if (aliases.some(a => a.includes(t))) score += 25;
				if (tags.includes(t)) score += 20;
				if (sname.includes(t)) score += 20;
				if (sdesc.includes(t)) score += 10;
			}

			if (score > 0) {
				scored.push({
					id: skill.id,
					name: skill.name,
					category: skill.category,
					short_description: skill.short_description,
					score,
					source: skill.source,
				});
			}
		}

		scored.sort((a, b) => b.score - a.score);
		return scored;
	}

	autocompleteSkills(prefix: string, limit: number = 8): AutocompleteSuggestion[] {
		if (!this._registryLoaded || !prefix) return [];

		const clean = prefix.trim().replace(/^\//, '').toLowerCase();
		const pool = this._routingCandidates.filter(s => s.enabled !== false);
		const results: AutocompleteSuggestion[] = [];

		for (const s of pool) {
			const sid = s.id.toLowerCase();
			const sname = (s.name || '').toLowerCase();
			const aliases = (s.aliases || []).map(a => a.toLowerCase());

			if (sid.startsWith(clean)) {
				results.push({ id: s.id, name: s.name, match: 'id_prefix', description: s.short_description });
			} else if (aliases.some(a => a.startsWith(clean))) {
				results.push({ id: s.id, name: s.name, match: 'alias_prefix', description: s.short_description });
			} else if (sname.includes(clean)) {
				results.push({ id: s.id, name: s.name, match: 'name_substring', description: s.short_description });
			}

			if (results.length >= limit) break;
		}

		return results;
	}

	async routeSkills(userMessage: string): Promise<RoutingResult> {
		await this._ensureLoaded();

		const trimmed = (userMessage || '').trim();
		if (!trimmed) {
			return this._emptyResult(trimmed);
		}

		// 1. /skill <query> → search only, no LLM
		if (trimmed.startsWith('/skill ') || trimmed === '/skill') {
			const query = trimmed.replace(/^\/skill\s*/, '').trim();
			const searchResults = query ? await this.searchSkills(query) : [];
			return {
				type: 'search',
				loadedSkills: [],
				candidates: [],
				searchResults,
				originalPrompt: trimmed,
				effectivePrompt: trimmed,
				suppressLLM: true,
			};
		}

		// 2. /<skill-id> <prompt> → explicit skill invocation (bypass confidence)
		if (trimmed.startsWith('/')) {
			const parts = trimmed.slice(1).split(/\s+/);
			const slashCmd = parts[0];
			const remainder = parts.slice(1).join(' ');

			const resolution = this.resolveSkill(slashCmd);
			if (resolution) {
				const body = await this._loadSkillContent(resolution.skill);
				if (body !== null) {
					return {
						type: 'explicit',
						loadedSkills: [{
							skill: resolution.skill,
							body,
							matchType: resolution.matchType,
							confidence: resolution.confidence,
						}],
						candidates: [],
						originalPrompt: trimmed,
						effectivePrompt: remainder || trimmed,
						suppressLLM: false,
					};
				}
			}
			// Unknown slash skill — fall through to natural routing
		}

		// 3. Natural language → confidence-based multi-skill composition
		const pool = this._routingCandidates.filter(s => s.enabled !== false);
		const scored: SkillCandidate[] = [];

		const msgLower = trimmed.toLowerCase();
		const tokens = msgLower.split(/\s+/).filter(t => t.length > 2);

		for (const skill of pool) {
			let score = 0;
			const sid = skill.id.toLowerCase();
			const sname = (skill.name || '').toLowerCase();
			const sdesc = (skill.short_description || '').toLowerCase();
			const tags = (skill.tags || []).map(t => t.toLowerCase());

			for (const t of tokens) {
				if (sid.includes(t)) score += 25;
				if (tags.includes(t)) score += 18;
				if (sname.includes(t)) score += 15;
				if (sdesc.includes(t)) score += 8;
			}

			if (score > 0) {
				const confidence = Math.min(score / 100, 0.96);
				scored.push({ skill, score, confidence });
			}
		}

		scored.sort((a, b) => b.confidence - a.confidence);

		// Confidence gating
		const autoLoadList = scored
			.filter(s => s.confidence >= CONFIDENCE_THRESHOLDS.AUTO_LOAD)
			.slice(0, CONFIDENCE_THRESHOLDS.MAX_AUTO_COMPOSITE);

		// Load skill bodies with token budget
		const loadedSkills: LoadedSkill[] = [];
		let totalEstimatedTokens = 0;

		for (const candidate of autoLoadList) {
			const body = await this._loadSkillContent(candidate.skill);
			if (body === null) continue;

			const estimatedTokens = Math.ceil(body.length / 4);
			if (totalEstimatedTokens + estimatedTokens > CONFIDENCE_THRESHOLDS.MAX_SKILL_CONTEXT_TOKENS) {
				break;
			}

			totalEstimatedTokens += estimatedTokens;
			loadedSkills.push({
				skill: candidate.skill,
				body,
				matchType: 'keyword_ranking',
				confidence: candidate.confidence,
			});
		}

		return {
			type: loadedSkills.length > 0 ? 'natural' : 'none',
			loadedSkills,
			candidates: scored.slice(0, 5),
			originalPrompt: trimmed,
			effectivePrompt: trimmed,
			suppressLLM: false,
		};
	}

	async prepareSkillContext(userMessage: string): Promise<SkillPromptContext> {
		const routing = await this.routeSkills(userMessage);

		if (routing.suppressLLM || routing.loadedSkills.length === 0) {
			return { routing, systemPromptAddition: '' };
		}

		const sections = routing.loadedSkills.map(ls =>
			`### Skill: ${ls.skill.name}\n> ${ls.skill.short_description}\n\n${ls.body}`
		);

		const systemPromptAddition =
			`\n\n## Domain Skills\nThe following domain-specific guidelines are relevant to this task:\n\n${sections.join('\n\n---\n\n')}`;

		return { routing, systemPromptAddition };
	}

	async getSkillsSystemPromptAddition(userMessage: string): Promise<string> {
		const ctx = await this.prepareSkillContext(userMessage);
		return ctx.systemPromptAddition;
	}


	// ── Private: Initialization ───────────────────────────────────────────

	private async _ensureLoaded(): Promise<void> {
		await this._loadPromise;
	}

	private async _reloadSkillsInternal(): Promise<void> {
		this._skillContentCache.clear();

		// Load registry from app resources (State 0 + 1)
		this._registrySkills = await this._loadRegistry();

		// Scan workspace .agents/skills/ (State 2)
		const { routableSkills, skillDefs } = await this._scanWorkspace();
		this._workspaceSkills = routableSkills;
		this._workspaceSkillDefs = skillDefs;

		// Merge: workspace overrides registry duplicates
		this._mergeRoutingCandidates();

		this._registryLoaded = true;
	}


	// ── Private: App Root ─────────────────────────────────────────────────

	private _getAppRoot(): string {
		const appRoot = this._environmentService.appRoot;

		if (!appRoot) {
			throw new Error(
				'Forge Skills requires a native Electron environment with appRoot available.'
			);
		}

		return appRoot;
	}


	// ── Private: Registry Loader ──────────────────────────────────────────

	private async _loadRegistry(): Promise<RoutableSkill[]> {
		try {
			const appRoot = this._getAppRoot();
			const registryUri = URI.joinPath(URI.file(appRoot), 'skill_registry.json');

			const content = await this._fileService.readFile(registryUri);
			const raw: SkillRegistry = JSON.parse(content.value.toString());

			if (!raw || !Array.isArray(raw.skills)) {
				console.warn('[SkillsService] Malformed skill_registry.json — falling back to workspace-only');
				return [];
			}

			const skills: RoutableSkill[] = [];
			for (const entry of raw.skills) {
				// Validate path containment
				if (!this._validateRegistryPath(entry.path)) {
					console.warn(`[SkillsService] Rejected registry skill "${entry.id}" — path escapes skill_library/`);
					continue;
				}

				skills.push({
					id: entry.id,
					name: entry.name,
					short_description: entry.short_description,
					category: entry.category,
					tags: entry.tags || [],
					aliases: entry.aliases || [],
					checksum: entry.checksum || '',
					enabled: entry.enabled !== false,
					source: 'registry',
					registryPath: entry.path,
				});
			}

			console.log(`[SkillsService] Loaded ${skills.length} skills from registry (schemaVersion: ${raw.schemaVersion})`);
			return skills;

		} catch (err) {
			console.warn('[SkillsService] Failed to load skill_registry.json — falling back to workspace-only:', err);
			return [];
		}
	}

	/** Validates that a registry path resolves under skill_library/ */
	private _validateRegistryPath(registryPath: string): boolean {
		if (!registryPath) return false;

		try {
			const appRoot = this._getAppRoot();
			const libraryRoot = URI.joinPath(URI.file(appRoot), 'skill_library').fsPath;
			const candidate = URI.joinPath(URI.file(appRoot), registryPath).fsPath;

			// Normalize for comparison
			const normalizedLibrary = libraryRoot.replace(/\\/g, '/').toLowerCase();
			const normalizedCandidate = candidate.replace(/\\/g, '/').toLowerCase();

			// Must start with skill_library/ and not use path traversal
			if (!normalizedCandidate.startsWith(normalizedLibrary + '/')) {
				return false;
			}

			// Extra: reject if the raw path contains obvious traversal
			if (registryPath.includes('..')) {
				return false;
			}

			return true;
		} catch {
			return false;
		}
	}


	// ── Private: Workspace Scanner ────────────────────────────────────────

	private async _scanWorkspace(): Promise<{
		routableSkills: RoutableSkill[];
		skillDefs: SkillDef[];
	}> {
		const routableSkills: RoutableSkill[] = [];
		const skillDefs: SkillDef[] = [];

		try {
			const workspaceFolders = this._workspaceContextService.getWorkspace().folders;
			for (const folder of workspaceFolders) {
				const skillsDir = URI.joinPath(folder.uri, '.agents', 'skills');
				try {
					const stat = await this._fileService.resolve(skillsDir);
					if (!stat.isDirectory || !stat.children) continue;

					for (const child of stat.children) {
						if (child.isDirectory) {
							// Folder-based: .agents/skills/<name>/SKILL.md
							const skillMdUri = URI.joinPath(child.resource, 'SKILL.md');
							try {
								const fileContent = await this._fileService.readFile(skillMdUri);
								const text = fileContent.value.toString();
								const { frontmatter, body } = parseFrontmatter(text);

								const name: string = frontmatter['name'] || child.name;
								const description: string = frontmatter['description'] || '';
								let triggerKeywords: string[] = Array.isArray(frontmatter['triggerKeywords'])
									? frontmatter['triggerKeywords'].map((k: string) => k.toLowerCase())
									: [];

								if (triggerKeywords.length === 0) {
									const words = new Set<string>();
									name.toLowerCase().split(/[\s\-_]+/).forEach(w => { if (w.length > 2) words.add(w); });
									description.toLowerCase().split(/\W+/).forEach(w => { if (w.length > 3) words.add(w); });
									triggerKeywords = Array.from(words);
								}

								// SkillDef for backward compat
								skillDefs.push({
									name,
									description,
									triggerKeywords,
									body: body.trim(),
									filePath: skillMdUri.fsPath,
								});

								// RoutableSkill for unified routing
								routableSkills.push({
									id: child.name,
									name,
									short_description: description,
									category: frontmatter['category'] || 'workspace',
									tags: triggerKeywords,
									aliases: [],
									checksum: '',
									enabled: true,
									source: 'workspace',
									resolvedUri: skillMdUri,
								});
							} catch { /* SKILL.md missing in folder */ }

						} else if (child.name.endsWith('.md')) {
							// Flat markdown: .agents/skills/<name>.md
							try {
								const fileContent = await this._fileService.readFile(child.resource);
								const text = fileContent.value.toString();
								const { frontmatter, body } = parseFrontmatter(text);

								const name: string = frontmatter['name'] || child.name.replace(/\.md$/, '');
								const description: string = frontmatter['description'] || '';
								let triggerKeywords: string[] = Array.isArray(frontmatter['triggerKeywords'])
									? frontmatter['triggerKeywords'].map((k: string) => k.toLowerCase())
									: [];

								if (triggerKeywords.length === 0) {
									const words = new Set<string>();
									name.toLowerCase().split(/[\s\-_]+/).forEach(w => { if (w.length > 2) words.add(w); });
									description.toLowerCase().split(/\W+/).forEach(w => { if (w.length > 3) words.add(w); });
									triggerKeywords = Array.from(words);
								}

								const skillId = child.name.replace(/\.md$/, '');

								skillDefs.push({
									name,
									description,
									triggerKeywords,
									body: body.trim(),
									filePath: child.resource.fsPath,
								});

								routableSkills.push({
									id: skillId,
									name,
									short_description: description,
									category: frontmatter['category'] || 'workspace',
									tags: triggerKeywords,
									aliases: [],
									checksum: '',
									enabled: true,
									source: 'workspace',
									resolvedUri: child.resource,
								});
							} catch { /* unreadable file */ }
						}
					}
				} catch { /* .agents/skills/ doesn't exist */ }
			}
		} catch { /* workspace errors */ }

		return { routableSkills, skillDefs };
	}


	// ── Private: Merge ────────────────────────────────────────────────────

	private _mergeRoutingCandidates(): void {
		const mergedIndex = new Map<string, RoutableSkill>();

		// Registry first
		for (const entry of this._registrySkills) {
			mergedIndex.set(entry.id, entry);
		}

		// Workspace overrides registry duplicates
		for (const entry of this._workspaceSkills) {
			mergedIndex.set(entry.id, entry);
		}

		this._routingCandidates = Array.from(mergedIndex.values());
	}


	// ── Private: Content Loader ───────────────────────────────────────────

	private async _loadSkillContent(skill: RoutableSkill): Promise<string | null> {
		const cacheKey = `${skill.id}:${skill.checksum || ''}`;
		const cached = this._skillContentCache.get(cacheKey);
		if (cached !== undefined) return cached;

		try {
			let uri: URI;

			if (skill.source === 'workspace' && skill.resolvedUri) {
				// Workspace: use trusted URI from scan
				uri = skill.resolvedUri;
			} else if (skill.source === 'registry' && skill.registryPath) {
				// Registry: resolve against app root
				const resolved = this._resolveRegistrySkillUri(skill.registryPath);
				if (!resolved) return null;
				uri = resolved;
			} else {
				return null;
			}

			const content = await this._fileService.readFile(uri);
			const text = content.value.toString();
			const { body } = parseFrontmatter(text);
			const trimmed = body.trim();

			this._skillContentCache.set(cacheKey, trimmed);
			return trimmed;

		} catch {
			return null;
		}
	}

	/** Resolves a registry path to a validated URI under skill_library/ */
	private _resolveRegistrySkillUri(registryPath: string): URI | null {
		if (!this._validateRegistryPath(registryPath)) return null;

		try {
			const appRoot = this._getAppRoot();
			return URI.joinPath(URI.file(appRoot), registryPath);
		} catch {
			return null;
		}
	}


	// ── Private: Helpers ──────────────────────────────────────────────────

	private _emptyResult(prompt: string): RoutingResult {
		return {
			type: 'none',
			loadedSkills: [],
			candidates: [],
			originalPrompt: prompt,
			effectivePrompt: prompt,
			suppressLLM: false,
		};
	}
}

registerSingleton(ISkillsService, SkillsService, InstantiationType.Eager);

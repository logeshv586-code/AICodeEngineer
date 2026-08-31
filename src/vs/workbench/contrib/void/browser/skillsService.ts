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

export interface RegistrySkillEntry {
	id: string;
	name: string;
	short_description: string;
	category: string;
	tags: string[];
	aliases: string[];
	path: string;
	checksum: string;
	source: string;
	enabled: boolean;
	workspace_default: boolean;
	version?: number;
}

interface SkillRegistry {
	schemaVersion: number;
	generatedAt: string;
	skillCount: number;
	skills: RegistrySkillEntry[];
}

export interface SkillDef {
	name: string;
	description: string;
	triggerKeywords: string[];
	body: string;
	filePath: string;
}

export interface RoutableSkill {
	id: string;
	name: string;
	short_description: string;
	category: string;
	tags: string[];
	aliases: string[];
	checksum: string;
	enabled: boolean;
	source: 'registry' | 'workspace';
	registryPath?: string;
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

const CONFIDENCE_THRESHOLDS = {
	AUTO_LOAD: 0.85,
	CANDIDATE: 0.65,
	MAX_AUTO_COMPOSITE: 3,
	MAX_SKILL_CONTEXT_TOKENS: 4_000,
};

export interface ISkillsService {
	readonly _serviceBrand: undefined;
	getAllSkills(): SkillDef[];
	getRegistrySkillCount(): number;
	isRegistryLoaded(): boolean;
	reloadSkills(): Promise<void>;
	resolveSkill(query: string): SkillResolution | null;
	searchSkills(query: string): Promise<SkillSearchResult[]>;
	autocompleteSkills(prefix: string, limit?: number): AutocompleteSuggestion[];
	routeSkills(userMessage: string): Promise<RoutingResult>;
	prepareSkillContext(userMessage: string): Promise<SkillPromptContext>;
	getSkillsSystemPromptAddition(userMessage: string): Promise<string>;
}

export const ISkillsService = createDecorator<ISkillsService>('voidSkillsService');

function parseFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
	if (!match) return { frontmatter: {}, body: content };
	const frontmatter: Record<string, any> = {};
	for (const line of match[1].split('\n')) {
		const colonIdx = line.indexOf(':');
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		const rawVal = line.slice(colonIdx + 1).trim();
		frontmatter[key] = rawVal.startsWith('[') && rawVal.endsWith(']')
			? rawVal.slice(1, -1).split(',').map(value => value.trim()).filter(Boolean)
			: rawVal;
	}
	return { frontmatter, body: match[2] };
}

const normalizedTokens = (value: string) => value.toLowerCase().split(/\s+/).map(token => token.replace(/[^a-z0-9_+.#-]/g, '')).filter(token => token.length > 2);

class SkillsService extends Disposable implements ISkillsService {
	_serviceBrand: undefined;
	private _registrySkills: RoutableSkill[] = [];
	private _workspaceSkills: RoutableSkill[] = [];
	private _workspaceSkillDefs: SkillDef[] = [];
	private _routingCandidates: RoutableSkill[] = [];
	private _registryLoaded = false;
	private _loadPromise: Promise<void>;
	private readonly _skillContentCache = new Map<string, string>();

	constructor(
		@IWorkspaceContextService private readonly _workspaceContextService: IWorkspaceContextService,
		@IFileService private readonly _fileService: IFileService,
		@INativeEnvironmentService private readonly _environmentService: INativeEnvironmentService,
	) {
		super();
		this._loadPromise = this._reloadSkillsInternal();
	}

	getAllSkills(): SkillDef[] { return this._workspaceSkillDefs; }
	getRegistrySkillCount(): number { return this._registrySkills.length; }
	isRegistryLoaded(): boolean { return this._registryLoaded; }

	async reloadSkills(): Promise<void> {
		this._loadPromise = this._reloadSkillsInternal();
		await this._loadPromise;
	}

	resolveSkill(query: string): SkillResolution | null {
		if (!query || typeof query !== 'string') return null;
		const clean = query.trim().replace(/^\//, '').toLowerCase();
		const pool = this._routingCandidates.filter(skill => skill.enabled !== false);
		const exactId = pool.find(skill => skill.id.toLowerCase() === clean);
		if (exactId) return { skill: exactId, matchType: 'exact_id', confidence: 1 };
		const exactAlias = pool.find(skill => (skill.aliases || []).some(alias => alias.toLowerCase() === clean));
		if (exactAlias) return { skill: exactAlias, matchType: 'exact_alias', confidence: 0.98 };
		const exactName = pool.find(skill => (skill.name || '').toLowerCase() === clean);
		if (exactName) return { skill: exactName, matchType: 'exact_name', confidence: 0.95 };
		const prefixMatch = pool.find(skill => skill.id.toLowerCase().startsWith(clean));
		if (prefixMatch) return { skill: prefixMatch, matchType: 'prefix', confidence: 0.85 };
		const scored = this._rankSkills(clean, pool, true);
		if (!scored.length) return null;
		return { skill: scored[0].skill, matchType: 'keyword_ranking', confidence: scored[0].confidence, candidates: scored.slice(0, 5) };
	}

	async searchSkills(query: string): Promise<SkillSearchResult[]> {
		await this._ensureLoaded();
		if (!query?.trim()) return [];
		const clean = query.trim().replace(/^\//, '').toLowerCase();
		const tokens = normalizedTokens(clean);
		const results: SkillSearchResult[] = [];
		for (const skill of this._routingCandidates.filter(item => item.enabled !== false)) {
			let score = 0;
			const id = skill.id.toLowerCase();
			const name = skill.name.toLowerCase();
			const description = skill.short_description.toLowerCase();
			const aliases = skill.aliases.map(alias => alias.toLowerCase());
			const tags = skill.tags.map(tag => tag.toLowerCase());
			if (id === clean) score += 200;
			else if (id.startsWith(clean)) score += 100;
			if (aliases.includes(clean)) score += 150;
			for (const token of tokens) {
				if (id.includes(token)) score += 30;
				if (aliases.some(alias => alias.includes(token))) score += 25;
				if (tags.includes(token)) score += 20;
				if (name.includes(token)) score += 20;
				if (description.includes(token)) score += 10;
			}
			if (score > 0) results.push({ id: skill.id, name: skill.name, category: skill.category, short_description: skill.short_description, score, source: skill.source });
		}
		return results.sort((a, b) => b.score - a.score);
	}

	autocompleteSkills(prefix: string, limit = 8): AutocompleteSuggestion[] {
		if (!this._registryLoaded || !prefix) return [];
		const clean = prefix.trim().replace(/^\//, '').toLowerCase();
		const results: AutocompleteSuggestion[] = [];
		for (const skill of this._routingCandidates.filter(item => item.enabled !== false)) {
			const id = skill.id.toLowerCase();
			const name = skill.name.toLowerCase();
			const aliases = skill.aliases.map(alias => alias.toLowerCase());
			if (id.startsWith(clean)) results.push({ id: skill.id, name: skill.name, match: 'id_prefix', description: skill.short_description });
			else if (aliases.some(alias => alias.startsWith(clean))) results.push({ id: skill.id, name: skill.name, match: 'alias_prefix', description: skill.short_description });
			else if (name.includes(clean)) results.push({ id: skill.id, name: skill.name, match: 'name_substring', description: skill.short_description });
			if (results.length >= limit) break;
		}
		return results;
	}

	async routeSkills(userMessage: string): Promise<RoutingResult> {
		await this._ensureLoaded();
		const trimmed = (userMessage || '').trim();
		if (!trimmed) return this._emptyResult(trimmed);

		if (trimmed.startsWith('/skill ') || trimmed === '/skill') {
			const query = trimmed.replace(/^\/skill\s*/, '').trim();
			return {
				type: 'search', loadedSkills: [], candidates: [],
				searchResults: query ? await this.searchSkills(query) : [],
				originalPrompt: trimmed, effectivePrompt: trimmed, suppressLLM: true,
			};
		}

		// Registry skills are opt-in. This prevents generic coding prompts such as
		// "run the current project" from accidentally injecting an unrelated vendor
		// skill as a system instruction. Users can still invoke any registry skill
		// explicitly with /<skill-id>, /skill <query>, or a product command that does so.
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
						loadedSkills: [{ skill: resolution.skill, body, matchType: resolution.matchType, confidence: resolution.confidence }],
						candidates: [], originalPrompt: trimmed, effectivePrompt: remainder || trimmed, suppressLLM: false,
					};
				}
			}
		}

		// Only project-local workspace skills may auto-load from natural language.
		// App-wide registry skills remain searchable and explicitly invokable, but can
		// no longer hijack ordinary IDE execution/edit/test requests.
		const scored = this._rankSkills(trimmed, this._workspaceSkills.filter(skill => skill.enabled !== false), false);
		const autoLoadList = scored.filter(candidate => candidate.confidence >= CONFIDENCE_THRESHOLDS.AUTO_LOAD).slice(0, CONFIDENCE_THRESHOLDS.MAX_AUTO_COMPOSITE);
		const loadedSkills: LoadedSkill[] = [];
		let totalEstimatedTokens = 0;
		for (const candidate of autoLoadList) {
			const body = await this._loadSkillContent(candidate.skill);
			if (body === null) continue;
			const estimatedTokens = Math.ceil(body.length / 4);
			if (totalEstimatedTokens + estimatedTokens > CONFIDENCE_THRESHOLDS.MAX_SKILL_CONTEXT_TOKENS) break;
			totalEstimatedTokens += estimatedTokens;
			loadedSkills.push({ skill: candidate.skill, body, matchType: 'keyword_ranking', confidence: candidate.confidence });
		}
		return {
			type: loadedSkills.length ? 'natural' : 'none',
			loadedSkills,
			candidates: scored.filter(candidate => candidate.confidence >= CONFIDENCE_THRESHOLDS.CANDIDATE).slice(0, 5),
			originalPrompt: trimmed,
			effectivePrompt: trimmed,
			suppressLLM: false,
		};
	}

	async prepareSkillContext(userMessage: string): Promise<SkillPromptContext> {
		const routing = await this.routeSkills(userMessage);
		if (routing.suppressLLM || routing.loadedSkills.length === 0) return { routing, systemPromptAddition: '' };
		const sections = routing.loadedSkills.map(loaded => `### Skill: ${loaded.skill.name}\n> ${loaded.skill.short_description}\n\n${loaded.body}`);
		return {
			routing,
			systemPromptAddition: `\n\n## Project-local Skills\nThe following workspace-specific guidance is relevant to this task:\n\n${sections.join('\n\n---\n\n')}`,
		};
	}

	async getSkillsSystemPromptAddition(userMessage: string): Promise<string> {
		return (await this.prepareSkillContext(userMessage)).systemPromptAddition;
	}

	private _rankSkills(query: string, pool: RoutableSkill[], resolverMode: boolean): SkillCandidate[] {
		const clean = query.trim().replace(/^\//, '').toLowerCase();
		const tokens = normalizedTokens(clean);
		const scored: SkillCandidate[] = [];
		for (const skill of pool) {
			let score = 0;
			const id = skill.id.toLowerCase();
			const name = skill.name.toLowerCase();
			const description = skill.short_description.toLowerCase();
			const tags = skill.tags.map(tag => tag.toLowerCase());
			const aliases = skill.aliases.map(alias => alias.toLowerCase());
			for (const token of tokens) {
				if (id === token) score += resolverMode ? 50 : 25;
				else if (id.includes(token)) score += resolverMode ? 20 : 25;
				if (aliases.some(alias => alias.includes(token))) score += resolverMode ? 25 : 18;
				if (tags.includes(token)) score += resolverMode ? 15 : 18;
				if (name.includes(token)) score += 15;
				if (description.includes(token)) score += 8;
			}
			if (score > 0) scored.push({ skill, score, confidence: Math.min(score / 100, resolverMode ? 0.94 : 0.96) });
		}
		return scored.sort((a, b) => b.confidence - a.confidence);
	}

	private async _ensureLoaded(): Promise<void> { await this._loadPromise; }

	private async _reloadSkillsInternal(): Promise<void> {
		this._skillContentCache.clear();
		this._registrySkills = await this._loadRegistry();
		const { routableSkills, skillDefs } = await this._scanWorkspace();
		this._workspaceSkills = routableSkills;
		this._workspaceSkillDefs = skillDefs;
		this._mergeRoutingCandidates();
		this._registryLoaded = true;
	}

	private _getAppRoot(): string {
		const appRoot = this._environmentService.appRoot;
		if (!appRoot) throw new Error('Forge Skills requires a native Electron environment with appRoot available.');
		return appRoot;
	}

	private async _loadRegistry(): Promise<RoutableSkill[]> {
		try {
			const appRoot = this._getAppRoot();
			const registryUri = URI.joinPath(URI.file(appRoot), 'skill_registry.json');
			const raw: SkillRegistry = JSON.parse((await this._fileService.readFile(registryUri)).value.toString());
			if (!raw || !Array.isArray(raw.skills)) return [];
			const skills: RoutableSkill[] = [];
			for (const entry of raw.skills) {
				if (!this._validateRegistryPath(entry.path)) continue;
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
			console.log(`[SkillsService] Loaded ${skills.length} explicit registry skills (schemaVersion: ${raw.schemaVersion})`);
			return skills;
		} catch (error) {
			console.warn('[SkillsService] Failed to load skill_registry.json — using workspace-only skills:', error);
			return [];
		}
	}

	private _validateRegistryPath(registryPath: string): boolean {
		if (!registryPath || registryPath.includes('..')) return false;
		try {
			const appRoot = this._getAppRoot();
			const libraryRoot = URI.joinPath(URI.file(appRoot), 'skill_library').fsPath.replace(/\\/g, '/').toLowerCase();
			const candidate = URI.joinPath(URI.file(appRoot), registryPath).fsPath.replace(/\\/g, '/').toLowerCase();
			return candidate.startsWith(libraryRoot + '/');
		} catch { return false; }
	}

	private _deriveTriggerKeywords(name: string, description: string, supplied: unknown): string[] {
		if (Array.isArray(supplied)) return supplied.map(String).map(value => value.toLowerCase()).filter(Boolean);
		const words = new Set<string>();
		name.toLowerCase().split(/[\s\-_]+/).forEach(word => { if (word.length > 2) words.add(word); });
		description.toLowerCase().split(/\W+/).forEach(word => { if (word.length > 3) words.add(word); });
		return [...words];
	}

	private async _readWorkspaceSkill(resource: URI, fallbackName: string, id: string): Promise<{ routable: RoutableSkill; def: SkillDef } | null> {
		try {
			const text = (await this._fileService.readFile(resource)).value.toString();
			const { frontmatter, body } = parseFrontmatter(text);
			const name = String(frontmatter['name'] || fallbackName);
			const description = String(frontmatter['description'] || '');
			const triggerKeywords = this._deriveTriggerKeywords(name, description, frontmatter['triggerKeywords']);
			return {
				def: { name, description, triggerKeywords, body: body.trim(), filePath: resource.fsPath },
				routable: {
					id,
					name,
					short_description: description,
					category: String(frontmatter['category'] || 'workspace'),
					tags: triggerKeywords,
					aliases: [],
					checksum: '',
					enabled: true,
					source: 'workspace',
					resolvedUri: resource,
				},
			};
		} catch { return null; }
	}

	private async _scanWorkspace(): Promise<{ routableSkills: RoutableSkill[]; skillDefs: SkillDef[] }> {
		const routableSkills: RoutableSkill[] = [];
		const skillDefs: SkillDef[] = [];
		try {
			for (const folder of this._workspaceContextService.getWorkspace().folders) {
				const skillsDir = URI.joinPath(folder.uri, '.agents', 'skills');
				try {
					const stat = await this._fileService.resolve(skillsDir);
					if (!stat.isDirectory || !stat.children) continue;
					for (const child of stat.children) {
						const target = child.isDirectory ? URI.joinPath(child.resource, 'SKILL.md') : child.resource;
						if (!child.isDirectory && !child.name.endsWith('.md')) continue;
						const id = child.isDirectory ? child.name : child.name.replace(/\.md$/, '');
						const parsed = await this._readWorkspaceSkill(target, id, id);
						if (!parsed) continue;
						routableSkills.push(parsed.routable);
						skillDefs.push(parsed.def);
					}
				} catch { /* workspace has no skills directory */ }
			}
		} catch { /* workspace unavailable */ }
		return { routableSkills, skillDefs };
	}

	private _mergeRoutingCandidates(): void {
		const merged = new Map<string, RoutableSkill>();
		for (const entry of this._registrySkills) merged.set(entry.id, entry);
		for (const entry of this._workspaceSkills) merged.set(entry.id, entry);
		this._routingCandidates = [...merged.values()];
	}

	private async _loadSkillContent(skill: RoutableSkill): Promise<string | null> {
		const cacheKey = `${skill.id}:${skill.checksum || ''}`;
		const cached = this._skillContentCache.get(cacheKey);
		if (cached !== undefined) return cached;
		try {
			let uri: URI | null = null;
			if (skill.source === 'workspace' && skill.resolvedUri) uri = skill.resolvedUri;
			else if (skill.source === 'registry' && skill.registryPath) uri = this._resolveRegistrySkillUri(skill.registryPath);
			if (!uri) return null;
			const { body } = parseFrontmatter((await this._fileService.readFile(uri)).value.toString());
			const trimmed = body.trim();
			this._skillContentCache.set(cacheKey, trimmed);
			return trimmed;
		} catch { return null; }
	}

	private _resolveRegistrySkillUri(registryPath: string): URI | null {
		if (!this._validateRegistryPath(registryPath)) return null;
		try { return URI.joinPath(URI.file(this._getAppRoot()), registryPath); }
		catch { return null; }
	}

	private _emptyResult(prompt: string): RoutingResult {
		return { type: 'none', loadedSkills: [], candidates: [], originalPrompt: prompt, effectivePrompt: prompt, suppressLLM: false };
	}
}

registerSingleton(ISkillsService, SkillsService, InstantiationType.Eager);

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';

/**
 * A skill definition parsed from a .md file in .agents/skills/
 *
 * Format of the markdown file:
 * ---
 * name: React Refactor
 * description: Best practices for React component refactoring
 * triggerKeywords: [react, component, hook, jsx, tsx, refactor]
 * ---
 * ... skill body content ...
 */
export interface SkillDef {
	name: string;
	description: string;
	triggerKeywords: string[];
	body: string;
	filePath: string;
}

export interface ISkillsService {
	readonly _serviceBrand: undefined;

	/**
	 * Returns all loaded skills.
	 */
	getAllSkills(): SkillDef[];

	/**
	 * Returns skills relevant to the given user message based on keyword matching.
	 * Skills are sorted by relevance (most keyword hits first).
	 */
	getRelevantSkills(userMessage: string): SkillDef[];

	/**
	 * Returns a formatted string to append to the system prompt with all relevant skill content.
	 * Returns empty string if no relevant skills are found.
	 */
	getSkillsSystemPromptAddition(userMessage: string): string;

	/**
	 * Reload skills from disk (e.g., after file changes).
	 */
	reloadSkills(): Promise<void>;
}

export const ISkillsService = createDecorator<ISkillsService>('voidSkillsService');


// ---------- YAML frontmatter parsing ----------

function parseFrontmatter(content: string): { frontmatter: Record<string, any>, body: string } {
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

function parseSkillFile(content: string, filePath: string): SkillDef | null {
	try {
		const { frontmatter, body } = parseFrontmatter(content);
		const name: string = frontmatter['name'] || '';
		const description: string = frontmatter['description'] || '';
		const triggerKeywords: string[] = Array.isArray(frontmatter['triggerKeywords'])
			? frontmatter['triggerKeywords'].map((k: string) => k.toLowerCase())
			: [];

		if (!name) return null;

		return { name, description, triggerKeywords, body: body.trim(), filePath };
	} catch {
		return null;
	}
}


// ---------- Bundled default skills ----------

const BUNDLED_SKILLS: SkillDef[] = [
	{
		name: 'React Refactor',
		description: 'Best practices for React component refactoring, hooks, and performance.',
		triggerKeywords: ['react', 'component', 'hook', 'jsx', 'tsx', 'refactor', 'useState', 'useEffect', 'props', 'render'],
		filePath: '(bundled)',
		body: `## React Refactoring Guidelines

- Prefer function components over class components.
- Extract complex logic into custom hooks (e.g. \`useXxx\`).
- Keep components small and focused — aim for under 100 lines per component.
- Use \`React.memo\` and \`useMemo\` / \`useCallback\` only when profiling shows a real perf issue.
- Prefer composition over prop-drilling: use Context or component composition patterns.
- Co-locate state as close to where it's used as possible.
- When lifting state, prefer a single source of truth.
- Always clean up effects: return a cleanup function from \`useEffect\` when subscribing to external events.
- Name event handler props \`onXxx\` and handler functions \`handleXxx\`.`,
	},
	{
		name: 'Debugging',
		description: 'Systematic debugging approach for tracing errors and root cause analysis.',
		triggerKeywords: ['debug', 'error', 'bug', 'crash', 'exception', 'traceback', 'stack trace', 'undefined', 'null', 'fix'],
		filePath: '(bundled)',
		body: `## Debugging Guidelines

- Start from the error message and stack trace — identify the exact file, function, and line number.
- Form a hypothesis about the root cause before changing code.
- Verify the hypothesis with a minimal reproduction if possible.
- Use binary search to narrow down the problem: comment out halves of the code to isolate the issue.
- Check recent git changes that might have introduced the regression.
- Add targeted logging/assertions rather than guessing and changing code.
- Validate assumptions: check data types, null/undefined values, and API response shapes.
- After fixing, add a test that would have caught the bug.`,
	},
	{
		name: 'Testing',
		description: 'Best practices for writing unit tests, integration tests, and test-driven development.',
		triggerKeywords: ['test', 'spec', 'unit test', 'jest', 'vitest', 'mocha', 'describe', 'it(', 'expect', 'mock', 'assert', 'tdd'],
		filePath: '(bundled)',
		body: `## Testing Guidelines

- Write tests before or alongside new code (TDD/BDD).
- Each test should test one behavior — use descriptive test names.
- Use the Arrange-Act-Assert (AAA) pattern for clarity.
- Mock external dependencies (APIs, file system, timers) to keep tests deterministic.
- Prefer integration tests that cover user-visible behavior over unit tests of implementation details.
- Test edge cases: empty input, null, boundary values, error conditions.
- Keep test setup (beforeEach/afterEach) minimal; prefer factory functions.
- Aim for test coverage of the "happy path" plus all meaningful error paths.
- Don't assert on implementation details — assert on observable outputs.`,
	},
];


// ---------- Service Implementation ----------

class SkillsService extends Disposable implements ISkillsService {
	_serviceBrand: undefined;

	private _skills: SkillDef[] = [];
	private _loaded = false;

	constructor(
		@IWorkspaceContextService private readonly _workspaceContextService: IWorkspaceContextService,
		@IFileService private readonly _fileService: IFileService,
	) {
		super();
		// Eagerly load on construction
		this.reloadSkills().catch(() => { /* ignore */ });
	}

	getAllSkills(): SkillDef[] {
		return this._skills;
	}

	getRelevantSkills(userMessage: string): SkillDef[] {
		const msgLower = userMessage.toLowerCase();
		const words = new Set(msgLower.split(/\W+/).filter(w => w.length > 2));

		// Score each skill by number of keyword hits
		const scored = this._skills
			.map(skill => {
				const hits = skill.triggerKeywords.filter(kw => {
					// Check for exact keyword or word-boundary match
					return msgLower.includes(kw) || words.has(kw);
				}).length;
				return { skill, hits };
			})
			.filter(({ hits }) => hits > 0)
			.sort((a, b) => b.hits - a.hits);

		// Return top 3 most relevant skills to avoid bloating the prompt
		return scored.slice(0, 3).map(({ skill }) => skill);
	}

	getSkillsSystemPromptAddition(userMessage: string): string {
		const relevant = this.getRelevantSkills(userMessage);
		if (relevant.length === 0) return '';

		const sections = relevant.map(skill =>
			`### Skill: ${skill.name}\n${skill.description ? `> ${skill.description}\n\n` : ''}${skill.body}`
		);

		return `\n\n## Domain Skills\nThe following domain-specific guidelines are relevant to this task:\n\n${sections.join('\n\n---\n\n')}`;
	}

	async reloadSkills(): Promise<void> {
		const skills: SkillDef[] = [...BUNDLED_SKILLS];

		// Scan workspace .agents/skills/ folders
		try {
			const workspaceFolders = this._workspaceContextService.getWorkspace().folders;
			for (const folder of workspaceFolders) {
				const skillsDir = URI.joinPath(folder.uri, '.agents', 'skills');
				try {
					const stat = await this._fileService.resolve(skillsDir);
					if (!stat.isDirectory || !stat.children) continue;
					for (const child of stat.children) {
						if (!child.name.endsWith('.md')) continue;
						try {
							const content = await this._fileService.readFile(child.resource);
							const text = content.value.toString();
							const skill = parseSkillFile(text, child.resource.fsPath);
							if (skill) skills.push(skill);
						} catch { /* ignore unreadable files */ }
					}
				} catch { /* ignore if .agents/skills/ doesn't exist */ }
			}
		} catch { /* ignore workspace errors */ }

		this._skills = skills;
		this._loaded = true;
	}
}

registerSingleton(ISkillsService, SkillsService, InstantiationType.Eager);

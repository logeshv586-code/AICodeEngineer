/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type ForgeTaskKind =
	| 'quick'
	| 'coding'
	| 'debug'
	| 'refactor'
	| 'architecture'
	| 'research'
	| 'browser'
	| 'design'
	| 'automation'
	| 'security'
	| 'testing'
	| 'data';

export type ForgeContextPolicy = 'lean' | 'balanced' | 'deep';
export type ForgeModelClass = 'fast' | 'coder' | 'reasoning' | 'vision';

export interface ForgeTaskProfile {
	readonly kind: ForgeTaskKind;
	readonly complexity: number;
	readonly contextPolicy: ForgeContextPolicy;
	readonly preferredModelClass: ForgeModelClass;
	readonly needsBrowser: boolean;
	readonly needsDesign: boolean;
	readonly needsCodeGraph: boolean;
	readonly needsAutomation: boolean;
	readonly needsDeepReasoning: boolean;
	readonly needsVision: boolean;
	readonly needsSecurityReview: boolean;
	readonly needsTests: boolean;
	readonly suggestedIntegrations: readonly string[];
	readonly reasons: readonly string[];
}

const includesAny = (text: string, words: readonly string[]) => words.some(word => text.includes(word));

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const classifyForgeTask = (prompt: string): ForgeTaskProfile => {
	const text = prompt.trim().toLowerCase();
	const words = text.split(/\s+/).filter(Boolean);
	const reasons: string[] = [];

	const needsBrowser = includesAny(text, [
		'browser', 'website', 'web page', 'webpage', 'dom', 'playwright', 'login', 'click', 'form',
		'screenshot', 'chrome', 'firefox', 'edge browser', 'scrape', 'crawl', 'url', 'frontend e2e'
	]);
	const needsDesign = includesAny(text, [
		'design', 'ui ', 'ux ', 'mockup', 'prototype', 'figma', 'landing page', 'dashboard', 'visual',
		'brand', 'wireframe', 'slide', 'deck', 'poster', 'flyer', 'animation', 'responsive layout'
	]);
	const needsAutomation = includesAny(text, [
		'automate', 'automation', 'workflow', 'schedule', 'scheduled', 'cron', 'recurring', 'repeat',
		'every day', 'every hour', 'background task', 'work mode', 'unattended'
	]);
	const needsSecurityReview = includesAny(text, [
		'security', 'vulnerability', 'cve', 'secret', 'credential', 'permission', 'auth', 'authorization',
		'injection', 'xss', 'csrf', 'audit'
	]);
	const needsTests = includesAny(text, [
		'test', 'tests', 'testing', 'spec', 'coverage', 'playwright', 'vitest', 'jest', 'pytest',
		'regression', 'verify', 'validation'
	]);
	const needsCodeGraph = includesAny(text, [
		'codebase', 'repository', 'repo ', 'architecture', 'dependency', 'dependencies', 'call graph',
		'understand project', 'understand the project', 'whole project', 'multi-file', 'across files',
		'impact analysis', 'large project', 'monorepo'
	]) || words.length > 90;
	const needsVision = needsDesign || includesAny(text, ['image', 'screenshot', 'visual compare', 'pixel', 'canvas']);

	const isDebug = includesAny(text, ['bug', 'debug', 'fix error', 'exception', 'stack trace', 'crash', 'not working', 'fails']);
	const isRefactor = includesAny(text, ['refactor', 'cleanup', 'restructure', 'simplify', 'technical debt', 'migrate']);
	const isArchitecture = includesAny(text, ['architecture', 'system design', 'scalable', 'distributed', 'design pattern', 'rewrite']);
	const isResearch = includesAny(text, ['research', 'compare', 'investigate', 'latest', 'documentation', 'docs', 'benchmark']);
	const isData = includesAny(text, ['dataset', 'sql', 'database', 'etl', 'pipeline', 'analytics', 'pandas', 'dataframe']);
	const isCoding = includesAny(text, [
		'code', 'implement', 'build', 'create', 'edit', 'update', 'function', 'class', 'component', 'api',
		'typescript', 'javascript', 'python', 'rust', 'go ', 'java', 'c++', 'react', 'electron'
	]);

	let kind: ForgeTaskKind = 'quick';
	if (needsSecurityReview) kind = 'security';
	else if (needsAutomation) kind = 'automation';
	else if (needsDesign) kind = 'design';
	else if (needsBrowser) kind = 'browser';
	else if (isArchitecture) kind = 'architecture';
	else if (isDebug) kind = 'debug';
	else if (isRefactor) kind = 'refactor';
	else if (needsTests && isCoding) kind = 'testing';
	else if (isResearch) kind = 'research';
	else if (isData) kind = 'data';
	else if (isCoding) kind = 'coding';

	let complexity = 0.18;
	complexity += Math.min(0.22, words.length / 350);
	if (needsCodeGraph) complexity += 0.18;
	if (isArchitecture) complexity += 0.22;
	if (needsSecurityReview) complexity += 0.16;
	if (needsAutomation) complexity += 0.12;
	if (needsBrowser) complexity += 0.08;
	if (needsDesign) complexity += 0.08;
	if (includesAny(text, ['entire', 'complete', 'end-to-end', 'production', 'multi-agent', 'multiple services', 'full project'])) complexity += 0.16;
	complexity = clamp01(complexity);

	const needsDeepReasoning = complexity >= 0.62 || isArchitecture || needsSecurityReview;
	const contextPolicy: ForgeContextPolicy = complexity >= 0.72 ? 'deep' : complexity >= 0.38 ? 'balanced' : 'lean';
	const preferredModelClass: ForgeModelClass = needsVision
		? 'vision'
		: needsDeepReasoning
			? 'reasoning'
			: isCoding || isDebug || isRefactor || needsTests
				? 'coder'
				: 'fast';

	const suggestedIntegrations: string[] = [];
	if (needsCodeGraph) suggestedIntegrations.push('understand-anything');
	if (needsDesign) suggestedIntegrations.push('open-design');
	if (needsAutomation) suggestedIntegrations.push('aionui');
	if (needsBrowser) suggestedIntegrations.push('forge-browser');
	if (isCoding || isDebug || isRefactor || isArchitecture) suggestedIntegrations.push('skillopt');

	if (needsCodeGraph) reasons.push('large or cross-file code context');
	if (needsBrowser) reasons.push('browser interaction or web verification');
	if (needsDesign) reasons.push('visual/design artifact requested');
	if (needsAutomation) reasons.push('persistent or scheduled workflow requested');
	if (needsSecurityReview) reasons.push('security-sensitive task');
	if (needsDeepReasoning) reasons.push('high reasoning complexity');
	if (reasons.length === 0) reasons.push('focused task suitable for lean execution');

	return {
		kind,
		complexity,
		contextPolicy,
		preferredModelClass,
		needsBrowser,
		needsDesign,
		needsCodeGraph,
		needsAutomation,
		needsDeepReasoning,
		needsVision,
		needsSecurityReview,
		needsTests,
		suggestedIntegrations,
		reasons,
	};
};

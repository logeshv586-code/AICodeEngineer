/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { ModelSelection } from '../../voidSettingsTypes.js';
import { classifyForgeTask, ForgeTaskProfile } from './taskProfile.js';

export interface AdaptiveModelCandidate {
	readonly name: string;
	readonly selection: ModelSelection;
}

export interface AdaptiveModelDecision {
	readonly selection: ModelSelection | null;
	readonly profile: ForgeTaskProfile;
	readonly score: number;
	readonly previousScore: number | null;
	readonly switched: boolean;
	readonly reason: string;
}

const includesAny = (text: string, patterns: readonly string[]) => patterns.some(pattern => text.includes(pattern));

const isSameSelection = (a: ModelSelection | null, b: ModelSelection | null) =>
	a?.providerName === b?.providerName && a?.modelName === b?.modelName;

const modelScore = (candidate: AdaptiveModelCandidate, profile: ForgeTaskProfile): number => {
	const model = candidate.selection.modelName.toLowerCase();
	const provider = candidate.selection.providerName.toLowerCase();
	let score = 50;

	const isFast = includesAny(model, ['mini', 'flash', 'haiku', 'lite', 'small', '20b', 'turbo']);
	const isCoder = includesAny(model, ['coder', 'codex', 'code', 'qwen', 'deepseek', 'sonnet', 'gpt-5', 'gpt-oss']);
	const isReasoner = includesAny(model, ['gpt-5', 'o3', 'o4', 'opus', 'sonnet', 'reason', 'thinking', 'pro', 'r1', 'gpt-oss-120b']);
	const isVision = includesAny(model, ['vision', 'vl', '4o', 'gemini', 'gpt-5', 'sonnet', 'opus']);
	const isLarge = includesAny(model, ['120b', '70b', '72b', '405b', 'opus', 'pro', 'max']);
	const isLocal = includesAny(provider, ['ollama', 'vllm', 'lmstudio']);

	if (profile.preferredModelClass === 'fast') {
		if (isFast) score += 28;
		if (isLocal) score += 10;
		if (isLarge) score -= 12;
	}
	if (profile.preferredModelClass === 'coder') {
		if (isCoder) score += 30;
		if (isReasoner) score += 8;
		if (isFast && profile.complexity < 0.45) score += 10;
	}
	if (profile.preferredModelClass === 'reasoning') {
		if (isReasoner) score += 34;
		if (isCoder) score += 12;
		if (isFast && !isReasoner) score -= 12;
	}
	if (profile.preferredModelClass === 'vision') {
		if (isVision) score += 36;
		if (isCoder) score += 8;
	}

	if (profile.needsDeepReasoning && isLarge) score += 10;
	if (profile.needsSecurityReview && isReasoner) score += 8;
	if (profile.needsTests && isCoder) score += 6;
	if (profile.contextPolicy === 'lean' && isFast) score += 6;
	if (profile.contextPolicy === 'deep' && isLarge) score += 8;

	return score;
};

const explicitModelSelection = (prompt: string, candidates: readonly AdaptiveModelCandidate[]): AdaptiveModelCandidate | undefined => {
	const lower = prompt.toLowerCase();
	return candidates.find(candidate => {
		const modelName = candidate.selection.modelName.toLowerCase();
		return modelName.length >= 4 && lower.includes(modelName);
	});
};

/**
 * Deterministic, zero-token model selection. It only considers models the user has
 * already configured and exposed in Forge settings. The current model is retained
 * when it is close to the best score to avoid provider churn and cache misses.
 */
export const chooseAdaptiveModel = (options: {
	readonly prompt: string;
	readonly candidates: readonly AdaptiveModelCandidate[];
	readonly currentSelection: ModelSelection | null;
	readonly switchMargin?: number;
}): AdaptiveModelDecision => {
	const { prompt, candidates, currentSelection } = options;
	const profile = classifyForgeTask(prompt);
	const switchMargin = options.switchMargin ?? 8;

	if (candidates.length === 0) {
		return {
			selection: currentSelection,
			profile,
			score: 0,
			previousScore: null,
			switched: false,
			reason: 'No configured model candidates are available.',
		};
	}

	const explicit = explicitModelSelection(prompt, candidates);
	if (explicit) {
		return {
			selection: explicit.selection,
			profile,
			score: 1000,
			previousScore: currentSelection
				? modelScore(candidates.find(candidate => isSameSelection(candidate.selection, currentSelection)) ?? explicit, profile)
				: null,
			switched: !isSameSelection(explicit.selection, currentSelection),
			reason: `The request explicitly names ${explicit.selection.modelName}.`,
		};
	}

	const ranked = candidates
		.map(candidate => ({ candidate, score: modelScore(candidate, profile) }))
		.sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name));

	const best = ranked[0];
	const current = currentSelection
		? ranked.find(item => isSameSelection(item.candidate.selection, currentSelection))
		: undefined;

	if (current && best.score - current.score < switchMargin) {
		return {
			selection: current.candidate.selection,
			profile,
			score: current.score,
			previousScore: current.score,
			switched: false,
			reason: `Current model is within ${switchMargin} points of the best fit; keeping it avoids unnecessary model churn.`,
		};
	}

	return {
		selection: best.candidate.selection,
		profile,
		score: best.score,
		previousScore: current?.score ?? null,
		switched: !isSameSelection(best.candidate.selection, currentSelection),
		reason: `Selected ${best.candidate.selection.modelName} for ${profile.kind} work (${profile.contextPolicy} context, complexity ${profile.complexity.toFixed(2)}).`,
	};
};

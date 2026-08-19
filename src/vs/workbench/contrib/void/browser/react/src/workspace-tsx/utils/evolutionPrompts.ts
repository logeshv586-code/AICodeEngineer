/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Product-level guidance appended to normal Forge tasks. It keeps the agent continuously
 * aware of project/skill evolution without allowing unrelated broad refactors to happen
 * silently. The visible chat message remains the user's original request.
 */
export const FORGE_EVOLUTION_POLICY = `
<forge_evolution_policy>
Treat the current workspace code, tests, local project memory, semantic index and active skills as the source of truth for every task.

After completing the requested work, perform a bounded evolution pass on only the code and workflows that were relevant to the task:
- Re-read the changed or important files and validate the result with the most useful targeted checks.
- Prefer existing registry skills before inventing new project-local guidance.
- If a reusable project-specific pattern has been proven by the code, you may create or improve a concise workspace skill under .agents/skills so future runs handle that pattern better. Never rewrite the global skill registry automatically.
- Keep the local code index and workspace skills refreshable after changes so the next agent run starts from current knowledge.
- Apply only low-risk improvements that are directly required for the user's requested outcome. Do not silently expand scope into framework migrations, broad dependency upgrades, destructive operations, credential changes, large unrelated refactors or product-direction changes.
- When a broader upgrade would materially improve the project, do not perform it silently. End with a short "Next evolution" suggestion (maximum two items) explaining the benefit and what would change, so the user can choose whether to proceed.
- If there is no meaningful follow-up improvement, omit the evolution suggestion entirely.
</forge_evolution_policy>
`.trim();

export const FORGE_PROJECT_EVOLUTION_TASK = `Perform a focused Project Evolution pass on this workspace. Read the current code first, use the local semantic project knowledge and relevant skills, identify the highest-impact maintainability, reliability, performance, security or developer-experience improvement that is justified by the actual code, and verify your reasoning. Implement only changes that are low-risk and clearly compatible with the current project. For any broader upgrade, do not change it yet; give me an approval-ready recommendation with expected benefit, affected areas and verification plan. Refresh project knowledge after safe code changes.`;

export const FORGE_SKILL_EVOLUTION_TASK = `Perform a focused Skills Evolution pass for this workspace. Inspect the current project patterns and recent task context, compare them with the available skill registry and existing .agents/skills, and reuse existing skills wherever possible. If the project has a repeated, validated pattern that is not covered well, create or improve only the necessary project-local SKILL.md guidance under .agents/skills. Keep it concise, evidence-based and reusable, validate it, then reload the workspace skills. Do not modify the global registry automatically. Summarize which skills were reused, added or improved and why.`;

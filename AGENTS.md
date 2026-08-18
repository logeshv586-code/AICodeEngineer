# Forge IDE agent build contract

This repository is a VS Code/Void fork with Forge React UI and Electron runtime artifacts. Generated files under `out/` are not source of truth.

## Required workflow

- Make source changes under `src/`.
- Run `npm run compile` after core TypeScript/Electron changes.
- Run `npm run buildreact` after React or Forge browser changes.
- Launch through `run-forge-ide.bat`, which runs `scripts/forge-runtime-guard.mjs`.
- Never launch Electron when the runtime guard reports missing artifacts.
- Read before editing, keep changes scoped, run targeted verification, then review the final diff against the user request.

## Super Agent execution contract

Forge is designed to complete user tasks rather than only suggest code.

1. Classify the task locally first. Prefer lean context and fast configured models for simple work; use stronger coding/reasoning/vision models only when task complexity requires them.
2. Route only relevant skills from the 333-skill registry and workspace overrides. Never inject the whole registry or whole code graph into the prompt.
3. For unfamiliar, large, multi-language, or cross-file repositories, use semantic search and the Understand Anything graph when available.
4. Use workspace read/edit/rewrite/create/delete tools and terminal execution to implement the task. Continue through verification unless user approval is required.
5. Use `forge_browser` for real browser/DOM validation and screenshots instead of guessing UI state. Prefer selectors returned by `snapshot` and batched `run_steps` to keep browser context compact.
6. Use Open Design only for design/prototype tasks and AionUi/Forge Work Mode only for automation tasks. Heavy integrations stay outside the base prompt.
7. For Work Mode, use `forge_workflow pending` to inspect scheduled prompt/approval work. Unattended shell tasks may execute in the local scheduler; prompt tasks still flow through the normal Forge model/tool loop.
8. Record sanitized task outcomes through `forge_learning`; SkillOpt-Sleep is the active validated improvement path.
9. Agent Lightning is deferred until a later dedicated GPU/RL phase. Do not require, start, or assume Agent Lightning during normal Forge execution or verification.
10. Do not expose secrets in learning traces, logs, screenshots, generated workflow definitions, or browser snapshots.

## Local integration commands

- `install-forge-super-agent.bat` — install the current active integrations (SkillOpt, Understand Anything, Open Design, AionUi) plus Chromium under `%USERPROFILE%\.forge\integrations`.
- `install-forge-super-agent.bat setup` — additionally install supported local dependency sets.
- `node scripts/forge-integrations.mjs verify active` — strict current-phase source verification.
- `node scripts/forge-super-agent-self-test.mjs --require-active` — strict current-phase Super Agent health check.
- `node scripts/forge-integrations.mjs doctor` — inspect local integration health.
- `node scripts/forge-work.mjs list` / `pending` — inspect Work Mode tasks and queued work.
- Later only: `node scripts/forge-super-agent-bootstrap.mjs --with-lightning --browser` — add Agent Lightning source when the dedicated training environment is ready.

## Important runtime paths

The React bundle is emitted under `out/vs/workbench/contrib/void/browser/react/out`. Forge TypeScript output is emitted under `browser/forge`, while flattened React imports also require the compatibility copy under `void/forge`. The React build must keep both locations synchronized.

The Super Agent MCP server is registered in `~/.forge-ai-editor/mcp.json`. Active integration source lives under `~/.forge/integrations`. Browser profiles, artifacts, workflows, scheduler state, and sanitized learning traces are stored under `~/.forge/`.

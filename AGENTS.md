# Forge IDE agent build contract

This repository is a VS Code/Void fork with Forge React UI and Electron runtime
artifacts. Generated files under `out/` are not source of truth.

## Required workflow

- Make source changes under `src/`.
- Run `npm run compile` after core TypeScript/Electron changes.
- Run `npm run buildreact` after React or Forge browser changes.
- Launch through `run-forge-ide.bat`, which runs `scripts/forge-runtime-guard.mjs`.
- Never launch Electron when the runtime guard reports missing artifacts.
- Read before editing, keep changes scoped, run targeted verification, then review the final diff against the user request.

The runtime guard repairs a clean or partially generated `out/` directory by
compiling the core and rebuilding the React/Forge bundles. If a new dynamic
import is introduced, add its expected runtime artifact to the guard and update
the bundle synchronization in `src/vs/workbench/contrib/void/browser/react/build.js`.

## Super Agent execution contract

Forge is designed to complete user tasks rather than only suggest code.

1. Classify the task locally first. Prefer lean context and fast configured models for simple work; use stronger coding/reasoning/vision models only when task complexity requires them.
2. For unfamiliar, large, multi-language, or cross-file repositories, use semantic search and the Understand Anything graph when available. Never inject the entire graph into a prompt.
3. Use workspace read/edit/rewrite/create/delete tools and terminal execution to implement the task. Continue through verification unless user approval is required.
4. Use `forge_browser` for real browser/DOM validation and screenshots instead of guessing UI state.
5. Use Open Design only for design/prototype tasks and AionUi/Forge Work Mode only for automation tasks. Heavy integrations stay outside the base prompt.
6. Record sanitized task outcomes through `forge_learning`; SkillOpt-Sleep and Agent Lightning are offline improvement systems, not permission to mutate live skills without validation.
7. Do not expose secrets in learning traces, logs, screenshots, or generated workflow definitions.

## Local integration commands

- `node scripts/forge-super-agent-bootstrap.mjs` — install core pinned source integrations and register the Forge MCP server.
- `node scripts/forge-super-agent-bootstrap.mjs --full` — clone the full pinned source trees for SkillOpt, Understand Anything, Agent Lightning, Open Design, and AionUi under `~/.forge/integrations`.
- Add `--setup` only when dependency installation is desired; heavyweight GPU/design/desktop environments are intentionally opt-in.
- `node scripts/forge-integrations.mjs doctor` — inspect local integration health.
- `node scripts/forge-work.mjs list` — inspect Work Mode automations.

## Important runtime paths

The React bundle is emitted under `out/vs/workbench/contrib/void/browser/react/out`.
Forge TypeScript output is emitted under `browser/forge`, while flattened React
imports also require the compatibility copy under `void/forge`. The React build
must keep both locations synchronized.

The Super Agent MCP server is registered in `~/.forge-ai-editor/mcp.json` and
uses source integrations under `~/.forge/integrations`. Browser profiles,
artifacts, workflows, and sanitized learning traces are stored under `~/.forge/`.

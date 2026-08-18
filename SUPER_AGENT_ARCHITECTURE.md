# Forge Super Agent Runtime

Forge integrates advanced agent capabilities without loading every subsystem into every model prompt.

## Architecture

```text
User request
  -> zero-token task classifier
  -> adaptive configured-model router
  -> native 333-skill router (0-3 skill bodies, 4k skill-token cap)
  -> focused workspace/code-graph discovery
  -> coding agent loop (read/edit/rewrite/create/delete/terminal/MCP)
  -> optional browser/design/work-mode tools
  -> tests + diff review
  -> sanitized offline learning trace
```

The base IDE remains lightweight. Heavy upstream projects are pinned by exact commit in `forge-integrations.lock.json` and cloned as full local source trees under `~/.forge/integrations` when requested. This avoids embedding multiple independent Electron/GPU toolchains inside the Forge build while still making their complete source available locally.

## One-command bootstrap

```bash
# SkillOpt + Understand Anything source + Forge MCP registration
node scripts/forge-super-agent-bootstrap.mjs

# All five requested source trees
node scripts/forge-super-agent-bootstrap.mjs --full

# Also install supported dependency sets where safe
node scripts/forge-super-agent-bootstrap.mjs --full --setup
```

Restart Forge after MCP bootstrap. The `forge-super-agent` MCP server then exposes browser, integration, code-graph, sidecar, work-mode, and learning tools directly to the existing Forge agent loop.

## Adaptive model routing

`common/forge/intelligence/taskProfile.ts` classifies coding/debug/design/browser/automation/security/research tasks without an extra LLM call. `adaptiveModelRouter.ts` scores only models already configured by the user. The current model is retained when it is close to the best fit, reducing provider churn and token/cost overhead. An explicitly named configured model wins.

The active React chat path applies this decision before sending the user message when `globalSettings.autoModelSelection` is enabled.

## Browser agent

`forge_browser` uses a persistent local Playwright context. Supported operations include:

- open/goto
- compact DOM snapshot
- click/fill/type/press
- bounded waits
- screenshots stored under `~/.forge/artifacts/browser`
- batched `run_steps`

Arbitrary page evaluation is disabled unless explicitly opted into for a trusted request.

## Understand Anything

The pinned source is installed locally, while Forge reads `.ua/knowledge-graph.json` on demand through `forge_understand`. Search returns small matching graph slices instead of placing the whole graph in model context. If the graph is absent, the tool tells the agent to run the upstream `/understand` skill; subsequent upstream runs are incremental.

## Open Design

Open Design remains a companion sidecar because it has its own daemon/web/desktop architecture and Node/pnpm requirements. `forge_sidecar` can inspect/start/stop the pinned source runtime. The coding agent can combine Open Design with `forge_browser` and normal workspace edits.

## Work Mode and AionUi

Forge Work Mode stores local workflow definitions under `~/.forge/work/tasks.json`. It supports manual, one-time, interval, and five-field cron schedules. Prompt workflows are returned to the Forge agent for model/tool execution. Shell workflows require approval unless the creator explicitly marks the task unattended.

AionUi is installed as a pinned companion source tree and can be launched as a desktop/web cowork sidecar for long-running automation and remote access.

## Self-evolution and Agent Lightning

Forge deliberately separates **live execution** from **learning**:

- `forge_learning record` writes sanitized JSONL outcomes under `~/.forge/learning`.
- SkillOpt-Sleep can inspect/replay/consolidate experience behind its validation gate.
- Agent Lightning source and trace data are available for optional offline RL training.
- No successful chat turn directly rewrites a live skill or launches GPU training.

This keeps normal inference fast and predictable while still creating an evidence-based path for self-improvement.

## Verification

After changing Super Agent code, run:

```bash
npm run compile
npm run buildreact
node scripts/forge-runtime-guard.mjs
node scripts/manage-skills.mjs validate
node scripts/forge-integrations.mjs doctor
```

Then restart Forge and verify the MCP tool list includes `forge_browser`, `forge_integrations`, `forge_understand`, `forge_sidecar`, `forge_workflow`, and `forge_learning`.

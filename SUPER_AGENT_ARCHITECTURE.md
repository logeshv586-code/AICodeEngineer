# Forge Super Agent Runtime

Forge integrates advanced coding-agent capabilities without loading every subsystem into every model prompt.

## Runtime architecture

```text
User request
  -> zero-token task classification / adaptive model selection
  -> native 333-skill router (0-3 bodies, 4k skill-token cap)
  -> CocoIndex + optional Understand Anything graph discovery
  -> Forge coding loop (read/edit/rewrite/create/delete/terminal/MCP)
  -> optional persistent browser / Open Design / AionUi / Work Mode tools
  -> tests + browser verification + diff review
  -> sanitized offline learning trace
  -> SkillOpt validation / optional Agent Lightning training
```

The base IDE remains lightweight. Heavy upstream projects are pinned by exact commit in `forge-integrations.lock.json` and downloaded as local source trees under `~/.forge/integrations`. On Windows this resolves to `C:\Users\<user>\.forge\integrations`.

## Windows one-click full installation

After pulling Forge, run:

```bat
install-forge-super-agent.bat
```

This downloads the complete pinned working source tree for all five integrations and installs Chromium for the persistent Playwright browser agent:

- Microsoft SkillOpt
- Egonex Understand Anything
- Microsoft Agent Lightning
- Nexu Open Design
- AionUi

The installer uses shallow exact-commit checkouts: every file for the pinned revision is available locally, while unnecessary Git history is not downloaded.

For dependency setup where supported:

```bat
install-forge-super-agent.bat setup
```

Agent Lightning GPU/`verl`/vLLM dependencies remain deliberately opt-in because its training environment is substantially heavier than normal IDE inference.

Cross-platform equivalent:

```bash
node scripts/forge-super-agent-bootstrap.mjs --full --browser
node scripts/forge-super-agent-bootstrap.mjs --full --browser --setup
```

## Local source layout

```text
~/.forge/integrations/
  skillopt/
  understand-anything/
  agent-lightning/
  open-design/
  aionui/
  .forge-integrations.json
```

`node scripts/forge-integrations.mjs verify full` validates exact commit, upstream remote, and source-license presence for all five checkouts.

## MCP integration

`run-forge-ide.bat` registers `forge-super-agent` in `~/.forge-ai-editor/mcp.json` every launch. The MCP server exposes:

- `forge_browser` — persistent browser inspection and interaction
- `forge_integrations` — source install/status/doctor/verify/self-test
- `forge_understand` — small local `.ua` graph searches and viewer launch
- `forge_sidecar` — Open Design / AionUi lifecycle
- `forge_workflow` — local scheduled/manual Work Mode tasks and pending queue
- `forge_learning` — sanitized traces and SkillOpt-Sleep controls

Run a strict verification with:

```bash
node scripts/forge-super-agent-self-test.mjs --require-all
```

## Browser agent

The browser controller keeps one local Playwright profile under `~/.forge/browser-profile`. `snapshot` returns a compact page representation and assigns temporary stable selectors such as:

```text
[data-forge-agent-id="12"]
```

The agent can then click/fill/type/select/check/hover without guessing DOM selectors. It also supports navigation, tabs, waits, screenshots, batched `run_steps`, and guarded JavaScript evaluation. Browser screenshots are stored under `~/.forge/artifacts/browser`.

Use `FORGE_BROWSER_HEADED=1` when you want the controlled browser visible.

## Understand Anything

Forge keeps Understand Anything as a pinned full source checkout and consumes `.ua/knowledge-graph.json` only when useful. `forge_understand search` returns small graph slices rather than injecting the entire graph into the prompt. Initial graph construction remains an explicit upstream operation because it may consume substantial compute/tokens; later updates are incremental.

## Open Design

Open Design remains a companion runtime because it has its own daemon/web/desktop architecture. Forge can start, stop and inspect the pinned source through `forge_sidecar`. Design tasks can combine Open Design outputs with normal Forge workspace edits and `forge_browser` verification.

## Work Mode + AionUi

`run-forge-ide.bat` starts the lightweight `forge-work-daemon.mjs` scheduler. Work Mode supports:

- manual tasks
- one-time schedules
- interval schedules (minimum one minute)
- five-field cron schedules
- unattended local command tasks
- approval-required command tasks
- agent-prompt tasks

Scheduled prompts and approval-required commands are de-duplicated into `~/.forge/work/pending.json`; completed/acknowledged work is recorded in `~/.forge/work/history.jsonl`. AionUi can still be launched as the richer local/remote cowork sidecar for long-running automation UI.

## Self-evolution

Forge deliberately separates live execution from learning:

- `forge_learning record` writes sanitized task traces to `~/.forge/learning/coding-traces.jsonl`.
- SkillOpt-Sleep can replay/consolidate experience behind its validation gates.
- Agent Lightning source is available locally for optional RL experiments/training.
- A successful chat turn never directly rewrites a production skill or silently starts GPU training.

This preserves predictable inference behavior while still creating a controlled self-improvement loop.

## Verification after pull

```bash
npm run compile
npm run buildreact
node scripts/forge-runtime-guard.mjs
node scripts/manage-skills.mjs validate
node scripts/forge-integrations.mjs doctor
node scripts/forge-super-agent-self-test.mjs --require-all
```

Then restart Forge with `run-forge-ide.bat` and verify that the MCP tool list includes all six `forge_*` tools above.

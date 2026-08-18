# Forge Super Agent Runtime

Forge integrates advanced coding-agent capabilities without loading every subsystem into every model prompt.

## Runtime architecture

```text
User request
  -> local task classification / adaptive model selection
  -> native 333-skill router (0-3 bodies, 4k skill-token cap)
  -> CocoIndex + optional Understand Anything graph discovery
  -> Forge coding loop (read/edit/rewrite/create/delete/terminal/MCP)
  -> persistent browser / Open Design / AionUi / Work Mode when relevant
  -> tests + browser verification + diff review
  -> sanitized learning trace + SkillOpt validation
  -> Agent Lightning later, as a dedicated optional training phase
```

## Active integration phase

The normal Forge installation now uses these integrations immediately:

- Microsoft SkillOpt
- Egonex Understand Anything
- Nexu Open Design
- AionUi
- Forge persistent Playwright browser
- Forge Work Mode scheduler and pending queue
- Native 333-skill registry/router

Agent Lightning is deliberately deferred. Its source remains pinned in `forge-integrations.lock.json`, and Forge already knows how to install it later, but it is not downloaded, required, started, or included in normal self-tests during this phase.

## Windows one-click install

After pulling Forge, run:

```bat
install-forge-super-agent.bat
```

The active source trees are stored under:

```text
C:\Users\<user>\.forge\integrations\
  skillopt\
  understand-anything\
  open-design\
  aionui\
```

For dependency setup where supported:

```bat
install-forge-super-agent.bat setup
```

Cross-platform equivalent:

```bash
node scripts/forge-super-agent-bootstrap.mjs --active --browser
node scripts/forge-super-agent-bootstrap.mjs --active --browser --setup
```

## Later Agent Lightning phase

When the dedicated GPU/RL environment is ready, install its pinned source with:

```bash
node scripts/forge-super-agent-bootstrap.mjs --with-lightning --browser
```

For the fully provisioned future state, verification can use:

```bash
node scripts/forge-integrations.mjs verify full
node scripts/forge-super-agent-self-test.mjs --require-all
```

Until then, normal verification intentionally requires only the active integration set:

```bash
node scripts/forge-integrations.mjs verify active
node scripts/forge-super-agent-self-test.mjs --require-active
```

## MCP tools

`run-forge-ide.bat` registers `forge-super-agent` in `~/.forge-ai-editor/mcp.json`. The MCP server exposes:

- `forge_browser` — persistent browser inspection and interaction
- `forge_integrations` — install/status/doctor/verify/self-test
- `forge_understand` — compact `.ua` graph search and local dashboard
- `forge_sidecar` — Open Design / AionUi lifecycle
- `forge_workflow` — Work Mode tasks, pending queue, approvals, scheduling
- `forge_learning` — sanitized traces and SkillOpt-Sleep controls

## Browser agent

The browser controller keeps one local profile under `~/.forge/browser-profile`. `snapshot` returns compact visible page content and temporary selectors such as `[data-forge-agent-id="12"]`. The agent can click, fill, type, select, check, hover, navigate tabs, wait for text, reload, take screenshots, and batch actions through `run_steps`.

## Work Mode

`run-forge-ide.bat` starts `scripts/forge-work-daemon.mjs`. It supports manual, one-time, interval, and five-field cron schedules. Unattended shell commands can execute locally; prompt tasks and approval-required commands are queued under `~/.forge/work/pending.json` for Forge/AionUi handling. History is stored in `~/.forge/work/history.jsonl`.

## Self-evolution policy

Live execution is separated from learning. Forge records sanitized outcomes, SkillOpt can validate/stage skill improvements, and production skills are not silently rewritten after a successful chat. Agent Lightning will later provide the heavier RL training path when the dedicated environment is available.

## Verification after pull

```bash
npm run compile
npm run buildreact
node scripts/forge-runtime-guard.mjs
node scripts/manage-skills.mjs validate
node scripts/forge-integrations.mjs verify active
node scripts/forge-super-agent-self-test.mjs --require-active
```

Then restart Forge with `run-forge-ide.bat`.

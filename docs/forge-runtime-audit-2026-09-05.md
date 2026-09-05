# Forge coding agent: architecture audit and repairs

Audit base: `main` at `3e3e8375aed960a795f30ea3d17f2ff08f477201`.

The active product surface is `ConversationShell` → `ChatView` → `ChatThreadService` → model transport and the approved tool loop. Specialist descriptors, the legacy agent classes, and the experimental task-graph runtime are separate layers. Their existence is not proof of independent working agents.

## Findings and implemented repairs

| Area | Confirmed defect | Repair |
| --- | --- | --- |
| Runtime delivery | The cancelled workflow left upgrade code inside patch generators instead of maintained runtime files. | Commit the policy and document readers as source. Legacy patch entrypoints validate presence and cannot overwrite later fixes. |
| Slash dispatch | ChatView treated comma variants as generic `/agent` text; local commands could reach the model instead of their handler. | Dispatch exact registered commands before short-alias expansion. Preserve user arguments and original visible labels. |
| Command discovery | The active palette exposed only five commands. | Keep five initial choices; search the full registered command list. |
| Stop | The streaming guard could prevent typed `/workflow,stop` from reaching its local handler. | Permit the local stop command while streaming; no new model call. |
| Browser capture | Native Add to Chat inserted generated HTML/CSS instructions into a legacy composer event; the active shell did not consume that event. | Show **Add Chat**, stage the selected component directly in the chat service, and render a removable context chip in the active shell. Other browser context events are staged too. |
| Message display | Visible-label changes used asynchronous state rewrites after submission. | Persist the label with the user message and carry it through queued sends. Internal runtime text remains backend context. |
| Submission | React state alone left a same-frame duplicate-send window. | Use a synchronous submission ref. Keep draft/attachments when handoff fails. Key the active ChatView by thread. |
| Documents | Binary PDF/Office files were decoded as ordinary UTF-8 attachments. | Route them through the actual document extraction MCP before prompt construction. Surface unavailable extraction without inventing content. |
| Task scope | Document/image attachments could force implementation mode even for summaries/explanations. | Prioritize the requested action. Summaries/explanations are read-only unless the user requests editing. |
| Document robustness | Extraction blocked the MCP event loop, lacked time/size limits, and sorted numbered slide parts lexically. | Asynchronous extraction process, 60-second process timeout, input/archive limits, numeric part ordering, truncation and empty-text warnings. |
| Instruction precedence | Global preferences and project rules were combined without distinct priority labels. | Explicitly label task > project > global > generic defaults; browser/document sources remain evidence rather than instructions. |
| Browser coordination | Concurrent tool requests could share a page and profile; oversized batches silently discarded steps. | Reject concurrent browser requests, validate all batch actions and size before execution, retain failure position, reuse the existing browser context, and use strict selectors. |
| Browser evidence | Old snapshot IDs could survive into later snapshots; screenshots exposed password inputs. | Remove stale IDs before assigning fresh ones; mask password and one-time-code inputs in screenshots. This is not comprehensive secret redaction. |
| Provider stalls | The chat callback promise had no deadline; token-limit continuations could run without a bound. | Five-minute model request deadline, late-callback suppression, existing bounded retries, and a resumable pause after 80 turns. |
| False specialist success | Six legacy specialist classes and four graph workers returned fabricated implementation/test/review/deployment results. | Unconnected implementations fail explicitly. The real sidebar tool loop remains available. |
| Workspace tools | `MAX_CHILDREN_URIS_PAGE` callers disagreed with `MAX_CHILDREN_URIs_PAGE` import. | Correct callers, restoring TypeScript validation for directory pagination. |
| CI | Fast validation only ran for a workflow-file change on an old branch. Full validation could generate and push source. | Fast PR/main validation covers runtime changes and behavioral tests using an isolated compiler. Heavy validation is manual, read-only, and does not commit generated source. |

## Capability assessment

| Capability | Current evidence | Remaining limit |
| --- | --- | --- |
| Coding, editing, terminal tests and debugging | Real sidebar tools, approved execution, model/tool continuation; source and routing checks pass. | Live performance depends on the model, credentials, environment and task. |
| Slash commands | Handler-level tests cover argument retention, browser guidance, local status and stop. | Full Electron interaction test still required. |
| Browser-to-code context | Captured component HTML/CSS/URL reaches staged model context with a compact chip. | Native Electron browser and Playwright MCP browser use separate sessions; authenticated state is not automatically shared. |
| Browser automation | Real Playwright implementation; batch/locking behavior tested with controlled operations. | No live authenticated browser workflow was certified in this audit. |
| Documents and summaries | Real DOCX/XLSX/PPTX and text extraction exercised; PDF has pypdf/PyMuPDF/pdftotext fallbacks. | No OCR. Legacy DOC/XLS/PPT require conversion. RTF extraction is basic. Embedded objects, charts and complex reading order are not certified. |
| Provider support | Source contract covers 17 transport paths, custom models and native/XML tool formats. | A routing contract cannot certify every model's tool use, vision, context capacity or quality. No private model credentials were used. |
| Skills/plugins | Registry and MCP routing exist; isolated integrations remain optional. | Installed, configured and healthy are separate from merely registered. |
| Autonomous completion | Policy requires inspect/edit/verify/review; loop has bounded retries and saved conversation checkpoints. | The done gate is predominantly model-driven, not a machine-certified acceptance specification. |
| Independent specialist orchestration | Roles and orchestration scaffolding exist. | Unconnected legacy workers now fail honestly; they are not implemented independent execution backends. |

## Validation performed

- 31 behavioral checks: task scope; slash arguments and labels; local stop/status; DOCX/XLSX/PPTX extraction; binary rejection; truncation; binary prompt routing; atomic visible labels; partial browser batches; concurrency; unconnected-worker failures.
- Core TypeScript: `node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit -p src/tsconfig.json` passed after repairs.
- UI contract: 60 checks passed. Agent/tool contract: 21 checks passed. Provider contract: 9 checks covering 17 providers passed. Brand: 20 checks passed. Work Mode: 13 checks passed. Autonomous/runtime and React service export contracts passed.
- Skill inventory validation found 0 missing skills but **333 hash mismatches** against the existing registry. This is unresolved integrity/metadata drift, not a passed integrity check. No skill hashes were regenerated to hide this discrepancy.
- Python/Node helper syntax and `git diff --check` passed.
- React bundling succeeded, but `npm run buildreact` failed its final runtime import validation because core build artifacts were missing (413 unresolved imports). This is **not** a full React/runtime gate pass.
- Full `npm ci --foreground-scripts` failed building `kerberos`: `gssapi/gssapi.h` is missing. OS package installation was blocked by environment process-permission restrictions. Source-only dependencies were installed with lifecycle scripts disabled to permit source validation; this does not substitute for native setup.
- `npm run compile` could not run fully because recursive build dependencies were absent (`ternary-stream`) following incomplete native setup.
- Managed browser navigation to the local component harness was blocked with `net::ERR_BLOCKED_BY_CLIENT`. No rendered desktop screenshots or live UI pass are claimed.
- Test runtime used Node 24.19.0; release configuration remains pinned to Node 20.18.2. Release validation must use that pinned environment.

## Required next integration work

1. Complete the manual full validation workflow on the pinned Node version with Linux native prerequisites. Follow with a Windows Electron smoke covering slash dispatch, browser capture, document upload, real model execution, stop/resume and thread switching.
2. Connect specialist roles to a shared execution interface that returns real tool evidence. Require cancellation, workspace write ownership, an explicit approval boundary and observed test exit status. Do not restore placeholder success objects.
3. Replace the model-only done gate with per-task acceptance criteria and evidence records. Distinguish verified, blocked, failed, cancelled and uncertain outcomes; keep an action journal before retrying side effects.
4. Add per-model capability probes for text, tool-call round trips and vision separately. Preserve manual selection; report unsupported capabilities instead of pretending all models are equivalent.
5. Make the native-browser/MCP session boundary explicit. Add a supported handoff for the chosen page/session and validate login state; never assume both browsers share credentials.
6. Add document paging, source-aware slide/sheet order and names, OCR, richer format parsers and precise citation coverage. Add redaction beyond password fields and test malicious page/document instructions.

## Manual acceptance scenarios

- `/agent,fix <specific failure>`: exact task survives dispatch; edit, relevant test, retest and final report use real tool outputs.
- `/browser <local URL and UI change>`: real DOM inspection, code changes and browser verification; no fabricated screenshot claim.
- Native browser: select a component → **Add Chat** → component chip appears → type a change → submit. HTML/CSS stays out of the visible composer and user bubble.
- `/models`, `/preferences`, `/plugins`, `/browser-status`, `/workflow,stop`: their local actions run without unnecessary model calls.
- Attach DOCX/XLSX/PPTX/PDF and request a summary: extract actual source; no unsolicited code edits. Unsupported/scanned files disclose the limitation.
- Failed submission retains draft and attachments. Switching threads does not leak local attachments. Stopping or a provider timeout does not replay previous browser steps.

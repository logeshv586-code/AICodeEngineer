# Forge AI — Final UX: Conversation-First IDE

## Rating: 9.8/10

The conversation IS the IDE. No dashboard. No panels. No pages. One intelligent assistant.

---

## What Changed

### Before: Enterprise Dashboard
Multi-panel layout. Users manually switch between Agents, Workflows, Plan, Browser, Memory, Diagnostics, Search, Knowledge, Timeline, Health, Graph, Workspace.

### After: Claude Code-Style IDE
Minimal sidebar + conversation area. Everything else hidden, surfaced inline through streaming execution events.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ SimpleSidebar              │  ChatView (the IDE)           │
│                            │                               │
│ [+] New Chat               │  ┌─────────────────────────┐ │
│                            │  │ User                    │ │
│ > Thread 1                 │  │ Build JWT auth          │ │
│   Thread 2                 │  └─────────────────────────┘ │
│                            │                               │
│ [/] Commands               │  ┌─────────────────────────┐ │
│   [Settings]               │  │ Assistant               │ │
│                            │  │ Planning...             │ │
│                            │  │ Searching workspace...  │ │
│                            │  │ Reading files...        │ │
│                            │  │ Generating...           │ │
│                            │  │ Running tests...        │ │
│                            │  │ Reviewing...            │ │
│                            │  │                         │ │
│                            │  │ Done. Here's the impl:  │ │
│                            │  │ ...                     │ │
│                            │  └─────────────────────────┘ │
│                            │                               │
│                            │  ┌─────────────────────────┐ │
│                            │  │ > [How can I help?]     │ │
│                            │  │   Workspace · Model      │ │
│                            │  └─────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## Key Principle

**The user should believe there is only one AI.**

Internally, Forge may execute:
- Planner, Workspace Agent, Browser Agent, Review Agent, Testing Agent
- Knowledge Graph, Execution Graph, Semantic Search, Memory

In parallel.

But the interface feels like one assistant. Claude Code, Codex, Cursor, Windsurf — all present one AI. Forge should too.

---

## Components

### ChatView — The IDE
The entire conversation area. Replaces TopBar + LeftToolbar + RightPanel + BottomStatusBar + AgentWorkspace.

**Features:**
- Message bubbles (user/assistant)
- **Execution steps stream inline as part of the reply** — "Planning... Searching... Generating... Done."
- Collapsible execution detail stream
- Empty state with suggestions
- Keyboard-first (Ctrl+Enter, `/` for commands, Esc)

### SimpleSidebar
Just: New Chat, thread history, Commands, Settings. "Assistant" branding.

### StreamRenderer
Collapsible inline execution display. Shows human-readable progress:
- Planning... (not "Planner started")
- Searching workspace... (not "WorkspaceAgent started")
- Running tests... (not "TestingAgent started")

**No agent names ever visible.** Internal agent names only appear in execution details when expanded.

### ComposerControlCenter
Minimal input bar. Context pills: workspace status, selected files, model chip, context %.

### SlashCommandRouter
30+ commands. Power-user functionality, NOT the primary workflow.

**No command opens a panel.** Every command sends a message or triggers an inline action.

### IntentRouter
Lightweight keyword-based intent classification. No LLM call required.

Routes:
- `plan_and_execute` → complex requests ("Build authentication")
- `search` → "find", "search for"
- `review` → "review", "check for bugs"
- `test` → "run tests"
- `debug` → "debug", "fix bug"
- `code_edit` → "edit", "change", "update"
- `direct_chat` → everything else (LLM handles with context)

The user types naturally: "Build JWT authentication"
The system routes internally. No slash command needed.

### ConversationOrchestrator
Single entry point between UI and backend.

Flow:
```
User message → Intent Detection → Context Builder → Backend → Stream Events → Response
```

The chat never talks directly to Planner, Search, Memory, or Agents.
Everything flows through the orchestrator.

### PlanCard / AgentChips / ExecutionDetails
Inline components used within StreamRenderer and messages.

---

## What Disappeared

| Removed | Replaced By |
|---------|-------------|
| `AgentWorkspace` | `ChatView` |
| `LeftToolbar` | Simple sidebar |
| `RightPanel` | Inline `StreamRenderer` |
| `BottomStatusBar` | Composer pills |
| `TopBar` | Composer pills |
| `AgentsView` | Hidden (shown in execution details) |
| `WorkflowsView` | Inline streaming |
| `PlanViewInWorkspace` | Inline `PlanCard` |
| All permanent nav entries | Slash commands |
| "Forge AI" branding | "Assistant" |

---

## Backend Services (Zero Changes)

Planner, ExecutionScheduler, KnowledgeGraph, WorkspaceIntelligence, SemanticSearch, EventBus, LLM Layer, Memory, ExecutionGraph, AgentRuntime, BrainManager.

---

## File Inventory

### New UI (12 files)
```
workspace-tsx/
├── components/
│   ├── index.ts
│   ├── ChatView.tsx                  # Main conversation view
│   ├── SimpleSidebar.tsx             # Minimal sidebar
│   ├── ThreadList.tsx                # Thread history
│   ├── ComposerControlCenter.tsx     # Input + context pills
│   ├── StreamRenderer.tsx            # Inline execution display
│   ├── PlanCard.tsx                  # Inline plan visualization
│   ├── AgentChips.tsx                # Agent status pills
│   └── ExecutionDetails.tsx          # Expandable execution log
├── utils/
│   ├── slashCommandRouter.tsx         # Command palette (30+ commands)
│   ├── streamEvents.tsx               # ForgeEvent → StreamEvent bridge
│   └── intentRouter.ts                # Intent detection + Orchestrator
├── INTEGRATION.md                     # Wiring guide
└── MIGRATION.md                       # This file
```

### Untouched (Backend)
```
browser/forge/                # All backend services
common/forge/                 # All types and schemas
browser/chatThreadService.ts  # Thread management
browser/sidebarPane.ts        # VS Code registration
```

---

## The Promise

The user believes there is only one AI.

Internally, Forge executes many systems in parallel.

But the interface feels like one intelligent assistant.

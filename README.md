# Forge Intelligence Platform & Collaborative Execution Runtime

<div align="center">
  <img src="C:/Users/e629/.gemini/antigravity/brain/b4fed5bd-63fb-409e-ba66-a4473560fc96/forge_platform_logo_1785412948639.png" alt="Forge Platform Logo" width="220" />
  <h3>Autonomous Agentic Development Platform</h3>
</div>

---

## Architectural Overview

Forge is an **autonomous agentic execution environment** integrated directly into the VS Code workbench architecture (`src/vs/workbench/contrib/void/`). It transitions AI assistance from chat prompts into a structured **Intelligence Platform**, **Execution Engine**, and **Multi-Agent Collaborative Runtime**.

```
                                         Forge Platform
                                               │
 ┌─────────────────────────────────────────────┴─────────────────────────────────────────────┐
 │                                                                                           │
 ▼                                                                                           ▼
Intelligence Platform (Platform v1 - Frozen)                                     Execution Platform (Phase 3 - Frozen)
 ├─ WorkspaceModel (AST, Symbol, Import, Call Graphs)                             ├─ Execution Planner & Plan Optimizer
 ├─ BrowserModel (DOM, Headings, Code Blocks, Tables)                             ├─ Topological Task Graph (DAG Engine)
 ├─ KnowledgeGraph (Directed Entities & Typed Edges)                              ├─ Internal Execution Event Bus
 ├─ MemoryStore & Workspace Health Calculator                                     ├─ Resource Manager & Worker Pool Manager
 └─ Adaptive Context Orchestrator & Token Budget Manager                          ├─ Multi-Stage Review Pipeline Gate
                                                                                  ├─ Isolated Artifact Store & Execution Memory
                                                                                  └─ Telemetry Tracker & Span Profiler
 └─────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                               ▼
                                Phase 3.5: Collaborative Execution Runtime
                    (Coordinator · Shared Blackboard · Consensus Engine · Delegation Manager)
```

---

## Key Subsystems & Features Designed

### 1. Intelligence Platform (Platform v1)
- **WorkspaceModel (`electron-main/forge/workspace/`)**: Performs AST symbol parsing, extracts import dependencies, constructs call graphs, computes module coupling scores, and maintains incremental disk caches (`.forge-workspace-cache.json`).
- **BrowserModel (`electron-main/forge/browser/`)**: Captures DOM elements, heading hierarchies, code snippets, tables, and web selection state, cross-indexing live web content with workspace AST symbols.
- **KnowledgeGraph Engine (`electron-main/forge/knowledge/`)**: Multigraph linking AST code entities and web pages with typed directed edges. Calculates static workspace complexity, circular dependency risks, and health grades (A through F).
- **Adaptive Context Engine (`browser/forge/context/`)**:
  - `IntentAnalyzer`: Classifies user queries (`Debug`, `Architecture`, `Documentation`, `TestGeneration`, `ReviewPR`, `Refactor`, `ExplainCode`).
  - `AdaptiveBudgetManager`: Dynamically allocates provider token budgets per intent (e.g. `Debug` allocates 45% Workspace budget).
  - `RetrievalPlanner`: Filters active context providers and tracks token/latency cost metrics.
  - `ContextCompressor`: Performs symbol-first retrieval, progressive staging (Stage 1 to 4), and Git diff compression, delivering **~68% token footprint savings**.

### 2. Execution Platform (Phase 3)
- **Planner & Optimizer (`browser/forge/execution/planner/`, `optimizer/`)**: Decomposes raw user goals into structured execution plans, merges duplicate operations, and validates parallel execution safety.
- **Task Graph DAG Engine (`graph/`)**: Builds topological directed acyclic task graphs with strict cycle validation (`GraphValidator`).
- **Internal Execution Event Bus (`bus/`)**: Typed event pub/sub (`PLAN_CREATED`, `TASK_READY`, `WORKER_ASSIGNED`, `CHECKPOINT_SAVED`, `EXECUTION_FINISHED`) decoupling all runtime modules.
- **Resource Manager & Worker Pool (`scheduler/`, `workers/`)**: Enforces concurrency limits across CPU, LLM tokens, and browser webviews while leasing specialized workers (`WorkspaceWorker`, `BrowserWorker`, `TestingWorker`, `ReviewWorker`).
- **Artifact Store (`artifacts/`)**: Isolates heavy execution payloads (patches, reports, screenshots, test logs) from execution memory metadata.
- **Multi-Stage Review Pipeline (`review/`)**: Enforces automated checks (`Lint → Format → Static Analysis → Security → Tests → Approval Gate`).

### 3. Collaborative Execution Runtime (Phase 3.5)
- **Collaboration Coordinator (`collaboration/coordinator.ts`)**: Orchestration brain delegating sub-tasks, monitoring blackboard state, and triggering multi-agent consensus approvals.
- **Agent Registry (`agents/`)**: Manages specialized agent descriptors (`Workspace`, `Browser`, `Review`, `Security`, `Testing`), health states, priority levels, and concurrency thresholds.
- **Shared Blackboard (`blackboard/`)**: Shared state bus where agents publish code patches, test logs, review findings, and deployment status without directly invoking one another.
- **Consensus Engine (`consensus/`)**: Evaluates multi-agent voting strategies (`Unanimous`, `Majority`, `WeightedConfidence`, `DesignatedAuthority`) before committing code modifications.
- **Delegation Manager & Progress Aggregator (`collaboration/`)**: Matches task requirements to optimal agents based on load and computes unified execution progress percentages.

### 4. NVIDIA NIM API Integration
Full support for NVIDIA's high-performance AI inference endpoints:
- **Base Endpoint**: `https://integrate.api.nvidia.com/v1` (100% OpenAI-compatible)
- **Supported Models**: `z-ai/glm-5.2`, `nvidia/llama-3.1-nemotron-70b-instruct`, `meta/llama-3.3-70b-instruct`, `deepseek-ai/deepseek-r1`, `nvidia/neva-22b`.
- **UI Settings**: Enter your API Key (`nvapi-...`) under **Settings → NVIDIA API**.

---

## Quickstart & Setup Guide

### 1. Configuring NVIDIA API Key in UI
1. Open Void / Forge Settings (**Gear Icon** or `Cmd/Ctrl + ,`).
2. Navigate to **Providers → NVIDIA API**.
3. Enter your NVIDIA API key (e.g. `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`).
4. Select `z-ai/glm-5.2` or any supported NVIDIA NIM model from the model dropdown.

### 2. Launching Multi-Agent AgentPanel UI
1. Open the Forge **AgentPanel** in the sidebar.
2. Explore the specialized tabs:
   - **Plan**: Live DAG execution step progression.
   - **🧠 Workspace**: Live symbol counts, import graphs, and module coupling scores.
   - **🌐 Browser**: Embedded webview browser intelligence with DOM capture and symbol matches.
   - **📊 Health & Graph**: Interactive workspace health dashboard and Knowledge Graph node inspector.
   - **👥 Multi-Agent**: Live online agent roster, health status, and Shared Blackboard artifacts.

---

## Directory Blueprint

```
src/vs/workbench/contrib/void/
├── common/
│   ├── voidSettingsTypes.ts       # Provider & Model Settings Types (NVIDIA added)
│   ├── modelCapabilities.ts       # Model Capabilities & Reserved Space
│   └── sendLLMMessageTypes.ts     # Provider Message Formats
│
├── electron-main/forge/
│   ├── workspace/                 # WorkspaceModel, Symbol Extractor, Import & Call Graphs
│   ├── browser/                   # BrowserModel & Cross-Symbol Matcher
│   ├── knowledge/                 # KnowledgeGraph & Workspace Health Calculator
│   ├── ipc/                       # Privileged IPC Channels
│   └── llmMessage/                # sendLLMMessage.impl.ts (NVIDIA API client route)
│
└── browser/forge/
    ├── context/                   # IntentAnalyzer, SemanticRanker, ContextCompressor, TokenBudgetManager
    ├── execution/                 # Phase 3 & 3.5 Execution Platform
    │   ├── bus/                   # Internal Execution Bus (pub/sub)
    │   ├── capabilities/          # Capability Registry & Matcher
    │   ├── planner/ & optimizer/  # Planner & Plan Optimizer
    │   ├── graph/                 # DAG Task Graph Engine & Validator
    │   ├── scheduler/ & workers/  # Concurrency Scheduler & Worker Pool
    │   ├── state/ & runtime/      # State Machine, Execution Memory & AgentRuntime
    │   ├── artifacts/             # Isolated Artifact Store
    │   ├── review/ & policies/    # Review Pipeline & Policy Engine
    │   ├── agents/                # Agent Registry, Descriptors & Health
    │   ├── blackboard/            # Shared Blackboard State Bus
    │   ├── consensus/             # Consensus Engine & Voting Policies
    │   └── collaboration/         # Coordinator, Delegation Manager & Progress Aggregator
    └── react/src/forge/           # React Presentation Components & AgentPanel UI
```

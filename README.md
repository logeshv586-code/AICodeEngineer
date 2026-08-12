# Forge Intelligence Platform & Collaborative Execution Runtime

<div align="center">
  <h3>Autonomous Agentic Development Platform & AI-Native IDE</h3>
  <p><i>A high-performance VS Code / Void fork powered by React UI and Electron runtime architecture.</i></p>
</div>

---

## 📐 Architectural Overview

Forge is an **autonomous agentic execution environment** integrated directly into the VS Code workbench architecture. It elevates AI assistance from simple chat prompts into a full-featured **Intelligence Platform**, **Execution Engine**, and **Multi-Agent Collaborative Runtime**.

```
                                         Forge Platform
                                               │
 ┌─────────────────────────────────────────────┴─────────────────────────────────────────────┐
 │                                                                                           │
 ▼                                                                                           ▼
Intelligence Platform (Platform v1)                                                 Execution Platform (Phase 3)
 ├─ WorkspaceModel (AST, Symbol, Import, Call Graphs)                             ├─ Execution Planner & Plan Optimizer
 ├─ BrowserModel (Crawl4AI DOM, Headings, Code Blocks, Tables)                    ├─ Topological Task Graph (DAG Engine)
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

## ✨ Key Subsystems & Core Features

### 1. Intelligence Platform
- **WorkspaceModel (`src/vs/workbench/contrib/void/electron-main/forge/workspace/`)**: Performs AST symbol parsing, extracts import dependencies, constructs call graphs, computes module coupling scores, and maintains incremental disk caches (`.forge-workspace-cache.json`).
- **BrowserModel (`electron-main/forge/browser/`)**: Integrates local Crawl4AI Docker microservices to capture DOM elements, heading hierarchies, code snippets, and web selection state, cross-indexing live web content with workspace AST symbols.
- **KnowledgeGraph Engine (`electron-main/forge/knowledge/`)**: Multigraph linking AST code entities and web pages with typed directed edges. Calculates static workspace complexity, circular dependency risks, and health grades (A through F).
- **Adaptive Context Engine (`browser/forge/context/`)**:
  - **IntentAnalyzer**: Classifies user queries (`Debug`, `Architecture`, `Documentation`, `TestGeneration`, `ReviewPR`, `Refactor`, `ExplainCode`).
  - **AdaptiveBudgetManager**: Dynamically allocates provider token budgets per intent.
  - **RetrievalPlanner**: Filters active context providers and tracks token/latency cost metrics.
  - **ContextCompressor**: Symbol-first retrieval, progressive staging (Stage 1 to 4), and Git diff compression, delivering **~68% token footprint savings**.

### 2. Execution Platform
- **Planner & Optimizer (`browser/forge/execution/planner/`, `optimizer/`)**: Decomposes raw user goals into structured execution plans, merges duplicate operations, and validates parallel execution safety.
- **Task Graph DAG Engine (`graph/`)**: Builds topological directed acyclic task graphs with strict cycle validation (`GraphValidator`).
- **Internal Execution Event Bus (`bus/`)**: Typed event pub/sub (`PLAN_CREATED`, `TASK_READY`, `WORKER_ASSIGNED`, `CHECKPOINT_SAVED`, `EXECUTION_FINISHED`) decoupling all runtime modules.
- **Resource Manager & Worker Pool (`scheduler/`, `workers/`)**: Enforces concurrency limits across CPU, LLM tokens, and browser webviews while leasing specialized workers (`WorkspaceWorker`, `BrowserWorker`, `TestingWorker`, `ReviewWorker`).
- **Artifact Store (`artifacts/`)**: Isolates heavy execution payloads (patches, reports, screenshots, test logs) from execution memory metadata.
- **Multi-Stage Review Pipeline (`review/`)**: Enforces automated checks (`Lint → Format → Static Analysis → Security → Tests → Approval Gate`).

### 3. Collaborative Execution Runtime
- **Collaboration Coordinator (`collaboration/coordinator.ts`)**: Orchestration brain delegating sub-tasks, monitoring blackboard state, and triggering multi-agent consensus approvals.
- **Agent Registry (`agents/`)**: Manages specialized agent descriptors (`Workspace`, `Browser`, `Review`, `Security`, `Testing`), health states, priority levels, and concurrency thresholds.
- **Shared Blackboard (`blackboard/`)**: Shared state bus where agents publish code patches, test logs, review findings, and deployment status asynchronously.
- **Consensus Engine (`consensus/`)**: Evaluates multi-agent voting strategies (`Unanimous`, `Majority`, `WeightedConfidence`, `DesignatedAuthority`) before committing code modifications.

### 4. High-Performance Provider Integrations
- **NVIDIA NIM Integration**: Native support for high-throughput inference endpoints (`https://integrate.api.nvidia.com/v1`). Models include `z-ai/glm-5.2`, `nvidia/llama-3.1-nemotron-70b-instruct`, `meta/llama-3.3-70b-instruct`, and `deepseek-ai/deepseek-r1`.
- **Multi-Provider Support**: Anthropic Claude, OpenAI GPT-4o, Ollama, Gemini, and custom OpenAI-compatible REST endpoints.

---

## 🛠️ Required Agent & Build Workflow

> **IMPORTANT**: Generated files under `out/` are derived build artifacts. All source changes MUST take place in `src/`.

### Mandatory Build & Execution Contract
1. **Core TypeScript / Electron changes**: Run `npm run compile`.
2. **React UI / Forge Browser changes**: Run `npm run buildreact`.
3. **Combined build**: Run `npm run build:forge`.
4. **Launch IDE**: Always launch using `run-forge-ide.bat` (or `npm run forge:verify`), which executes `scripts/forge-runtime-guard.mjs`.
5. **Runtime Guard Protection**: Never launch Electron if the runtime guard fails. The guard self-repairs missing bundles in `out/` and keeps `out/vs/workbench/contrib/void/browser/react/out` and `void/forge` synchronized.

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js**: v18.x or v20.x
- **Docker** (Optional, for web crawling): Installed and running for Crawl4AI local container (`unclecode/crawl4ai:all-in-one`).

### 2. Initializing & Launching
```bash
# Install dependencies
npm install

# Compile core TypeScript and React UI bundles
npm run build:forge

# Launch Forge IDE with Runtime Guard verification
run-forge-ide.bat
```

### 3. Setting Up API Keys
1. Open Settings in Forge IDE (`Ctrl+,` or Gear Icon).
2. Navigate to **Providers → NVIDIA API** (or your chosen provider).
3. Input your API key (e.g., `nvapi-...`).
4. Select your preferred model (e.g. `z-ai/glm-5.2` or `deepseek-r1`).

---

## 📂 Directory Blueprint

```
src/vs/workbench/contrib/void/
├── common/
│   ├── voidSettingsTypes.ts       # Provider & Model Settings Types
│   ├── modelCapabilities.ts       # Model Capabilities & Context Windows
│   └── sendLLMMessageTypes.ts     # Provider Message Formats
│
├── electron-main/forge/
│   ├── workspace/                 # AST Extractor, Import Graph & Symbol Indexes
│   ├── browser/                   # Crawl4AI Browser Model & Cross-Symbol Matcher
│   ├── knowledge/                 # Knowledge Graph & Workspace Health Calculator
│   ├── ipc/                       # Privileged Electron Main IPC Channels
│   └── llmMessage/                # LLM API Transports (NVIDIA, OpenAI, Anthropic)
│
└── browser/forge/
    ├── context/                   # Intent Analyzer, Compression Engine, Budget Manager
    ├── execution/                 # Task DAG Engine, Planner, Event Bus, Worker Pool
    │   ├── bus/                   # Internal Typed Event Pub/Sub
    │   ├── planner/ & optimizer/  # Execution Plan Builders
    │   ├── graph/                 # Topological Task DAG Validator
    │   ├── scheduler/ & workers/  # Worker Leasing & Concurrency Control
    │   ├── artifacts/             # Isolated Execution Artifact Store
    │   ├── review/                # Policy & Multi-Stage Quality Gates
    │   ├── agents/                # Agent Registry & Health Monitoring
    │   ├── blackboard/            # Shared Blackboard State Engine
    │   ├── consensus/             # Voting & Consensus Strategies
    │   └── collaboration/         # Coordinator & Delegation Engine
    └── react/src/forge/           # React AgentPanel UI & Subsystem Monitors
```

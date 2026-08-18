# Third-Party Agent Integrations

Forge does not vendor these upstream repositories into the application source tree. `forge-integrations.lock.json` pins exact commits, and `scripts/forge-integrations.mjs` clones their full working source trees locally under `~/.forge/integrations`.

This document is attribution and integration metadata, not a replacement for each upstream license. Preserve the upstream LICENSE/NOTICE files in every local clone and comply with the pinned project's terms when redistributing derived work.

| Integration | Upstream | Pinned commit | License | Forge use |
|---|---|---|---|---|
| SkillOpt | `microsoft/SkillOpt` | `9c776fcb51ae681c046d6f619b55e5f337d4f900` | MIT | Offline validated skill optimization and SkillOpt-Sleep |
| Understand Anything | `Egonex-AI/Understand-Anything` | `32944829e7a63a9fa9c55d811d7f98a9530c6a6a` | MIT | Incremental code knowledge graph and codebase understanding |
| Agent Lightning | `microsoft/agent-lightning` | `352f1bd7c1a06994c841d86ae7cffd222148824a` | MIT | Optional offline RL from sanitized coding traces |
| Open Design | `nexu-io/open-design` | `b20d3c6f0665e032369a3c91cc11550c5345c90e` | Apache-2.0 | Design systems, templates, local design daemon/UI |
| AionUi | `iOfficeAI/AionUi` | `362122e8b36398c32ed5276dd645cd4853e57b43` | Apache-2.0 | Cowork desktop/web companion and long-running automation |

## Data boundaries

- SkillOpt-Sleep and Agent Lightning are offline learning systems. Do not send secrets, raw credentials, private browser cookies, or unredacted proprietary transcripts into training data.
- `forge-learning.mjs` redacts common secret-bearing keys and token patterns before writing traces, but callers must still minimize sensitive content.
- Understand Anything can generate semantic code summaries. Treat `.ua/` as project data and use local models when the project's privacy requirements demand it.
- Browser automation uses a persistent local profile. Credentials in that profile must never be copied into learning traces or committed to Git.
- Open Design and AionUi are separate local applications with their own runtime, network, and provider settings. Their upstream security and privacy behavior remains governed by their own code/configuration.

## Why the source is installed outside the Forge repository

Open Design and AionUi are large independent application stacks, and Agent Lightning can require a dedicated GPU training environment. Embedding those trees directly inside Forge would increase checkout/build size, create dependency conflicts, and make upstream updates difficult. Pinned local clones provide reproducible full source access without making every Forge compile install or bundle unrelated toolchains.

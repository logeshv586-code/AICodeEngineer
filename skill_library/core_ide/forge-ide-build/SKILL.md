---
name: forge-ide-build
description: Builds, compiles, and verifies Forge IDE (VS Code/Void fork) runtime artifacts, Electron bundles, and React assets. Use when building, packaging, or fixing compilation errors in Forge IDE.
---

# Forge IDE Build & Runtime Guard

This repository is a VS Code/Void fork with Forge React UI and Electron runtime artifacts. Generated files under `out/` are not source of truth.

## Build Workflows

1. **Core TypeScript / Electron Changes:**
   ```bash
   npm run compile
   ```
2. **React / Forge Browser Changes:**
   ```bash
   npm run buildreact
   ```
3. **Launch Execution:**
   - Launch through `run-forge-ide.bat`, which runs `scripts/forge-runtime-guard.mjs`.
   - Never launch Electron when the runtime guard reports missing artifacts.

## Important Runtime Paths
- The React bundle is emitted under `out/vs/workbench/contrib/void/browser/react/out`.
- Forge TypeScript output is emitted under `browser/forge`.
- Flattened React imports require the compatibility copy under `void/forge`. The React build synchronizes both locations.

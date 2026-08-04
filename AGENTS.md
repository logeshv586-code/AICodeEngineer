# Forge IDE agent build contract

This repository is a VS Code/Void fork with Forge React UI and Electron runtime
artifacts. Generated files under `out/` are not source of truth.

## Required workflow

- Make source changes under `src/`.
- Run `npm run compile` after core TypeScript/Electron changes.
- Run `npm run buildreact` after React or Forge browser changes.
- Launch through `run-forge-ide.bat`, which runs `scripts/forge-runtime-guard.mjs`.
- Never launch Electron when the runtime guard reports missing artifacts.

The runtime guard repairs a clean or partially generated `out/` directory by
compiling the core and rebuilding the React/Forge bundles. If a new dynamic
import is introduced, add its expected runtime artifact to the guard and update
the bundle synchronization in `src/vs/workbench/contrib/void/browser/react/build.js`.

## Important runtime paths

The React bundle is emitted under `out/vs/workbench/contrib/void/browser/react/out`.
Forge TypeScript output is emitted under `browser/forge`, while flattened React
imports also require the compatibility copy under `void/forge`. The React build
must keep both locations synchronized.

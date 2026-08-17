---
name: electron-runtime
description: Diagnoses Electron main process, preload scripts, renderer IPC channels, window lifecycle, and native modules. Use when debugging Electron crashes, IPC communication, or window management.
---

# Electron Runtime & IPC Architecture

## Architecture
- **Main Process:** Manages BrowserWindow instances, native menus, file dialogs, and OS integration.
- **Preload Scripts:** Context-isolated bridge exposing safe APIs via `contextBridge.exposeInMainWorld`.
- **Renderer Process:** UI workbench executing inside Chromium context.

## Debugging Procedure
1. Trace IPC channels between `src/vs/platform/` and renderer services.
2. Check for unhandled exceptions in the main process logs.
3. Verify preload security policies and context isolation boundaries.
4. Test with `scripts/node-electron.bat` or `run-forge-ide.bat`.

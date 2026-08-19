#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

command -v node >/dev/null 2>&1 || { echo '[forge] Bootstrap Node.js is not available on PATH. Run setup first.' >&2; exit 1; }
FORGE_NODE="$(node scripts/forge-node20-runtime.mjs ensure | tail -n 1)"
[[ -x "$FORGE_NODE" ]] || { echo "[forge] Pinned Forge Node runtime is missing: $FORGE_NODE" >&2; exit 1; }
export PATH="$(dirname "$FORGE_NODE"):$PATH"
export VSCODE_DEV=1
export VSCODE_CLI=1
export ELECTRON_ENABLE_LOGGING=1
export NODE_ENV=development

"$FORGE_NODE" scripts/forge-integrations.mjs bootstrap-mcp || echo '[forge-super-agent] MCP bootstrap failed; continuing with built-in tools only.' >&2

if [[ -f scripts/forge-work-daemon.mjs ]]; then
  nohup "$FORGE_NODE" scripts/forge-work-daemon.mjs >/dev/null 2>&1 &
fi

"$FORGE_NODE" scripts/forge-integrations.mjs verify active >/dev/null 2>&1 || {
  echo '[forge-super-agent] Active integrations are not fully installed. Run: bash ./setup-forge.sh' >&2
}

"$FORGE_NODE" scripts/forge-runtime-guard.mjs || {
  echo '[forge-guard] Build validation failed. Electron will not be launched.' >&2
  echo '[forge-guard] Repair with: bash ./setup-forge.sh' >&2
  exit 1
}

case "$(uname -s)" in
  Darwin)
    ELECTRON="$ROOT/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
    ;;
  Linux)
    ELECTRON="$ROOT/node_modules/electron/dist/electron"
    ;;
  *)
    echo "[forge] Unsupported platform for this launcher: $(uname -s)" >&2
    exit 1
    ;;
esac

[[ -x "$ELECTRON" ]] || {
  echo "[forge] Electron runtime is missing: $ELECTRON" >&2
  echo '[forge] Run: bash ./setup-forge.sh' >&2
  exit 1
}

if [[ $# -eq 0 ]]; then
  "$ELECTRON" "$ROOT" "$ROOT" >/dev/null 2>&1 &
else
  "$ELECTRON" "$ROOT" "$@" >/dev/null 2>&1 &
fi

echo "[forge] Forge launched on $(uname -s) with $($FORGE_NODE --version)."

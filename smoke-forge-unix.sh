#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

command -v node >/dev/null 2>&1 || { echo '[forge-smoke] Bootstrap Node.js is not available on PATH.' >&2; exit 1; }
[[ -d node_modules ]] || { echo '[forge-smoke] Dependencies are not installed. Run: bash ./setup-forge.sh' >&2; exit 1; }

FORGE_NODE="$(node scripts/forge-node20-runtime.mjs ensure | tail -n 1)"
FORGE_RUNTIME_ROOT="$(cd "$(dirname "$FORGE_NODE")/.." && pwd)"
FORGE_NPM_CLI="$FORGE_RUNTIME_ROOT/lib/node_modules/npm/bin/npm-cli.js"
export PATH="$(dirname "$FORGE_NODE"):$PATH"

printf '\n============================================================\n'
printf '  Forge - %s Release Smoke\n' "$(uname -s)"
printf '============================================================\n\n'

printf '[1/4] Running contracts and skill validation...\n'
"$FORGE_NODE" scripts/forge-brand-contract-test.mjs
"$FORGE_NODE" scripts/forge-ui-contract-test.mjs
"$FORGE_NODE" scripts/forge-native-setup-contract.mjs
"$FORGE_NODE" scripts/forge-react-service-export-contract.mjs
"$FORGE_NODE" scripts/forge-model-provider-contract-test.mjs
"$FORGE_NODE" scripts/forge-work-self-test.mjs
"$FORGE_NODE" scripts/manage-skills.mjs validate

printf '[2/4] Compiling core and building React UI...\n'
"$FORGE_NODE" "$FORGE_NPM_CLI" run compile
"$FORGE_NODE" "$FORGE_NPM_CLI" run buildreact

printf '[3/4] Verifying runtime and integrations...\n'
"$FORGE_NODE" scripts/forge-runtime-guard.mjs
"$FORGE_NODE" scripts/forge-integrations.mjs verify active
"$FORGE_NODE" scripts/forge-integrations.mjs doctor
"$FORGE_NODE" scripts/forge-super-agent-self-test.mjs

case "$(uname -s)" in
  Darwin) ELECTRON="$ROOT/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" ;;
  Linux) ELECTRON="$ROOT/node_modules/electron/dist/electron" ;;
  *) echo '[forge-smoke] Unsupported Unix platform.' >&2; exit 1 ;;
esac
[[ -x "$ELECTRON" ]] || { echo "[forge-smoke] Electron runtime is missing: $ELECTRON" >&2; exit 1; }
ELECTRON_VERSION="$($ELECTRON --version)"
printf '[forge-smoke] Electron runtime: %s\n' "$ELECTRON_VERSION"

printf '[4/4] Automated preflight passed. Launching Forge...\n\n'
printf 'FINAL MANUAL RELEASE CHECKLIST\n'
printf '  1. Confirm a Chat model is selected and Test API succeeds for the selected provider.\n'
printf '  2. Send a normal coding task and confirm a response/run starts.\n'
printf '  3. Attach a file and an image; confirm both remain staged and are used.\n'
printf '  4. Start a task, press Stop, and confirm the active run aborts.\n'
printf '  5. Run /browser and confirm Playwright responds.\n'
printf '  6. Run /work and confirm Work Mode responds.\n'
printf '  7. Run /design and confirm the design workflow responds.\n'
printf '  8. Confirm Forge window/app identity is correct on the desktop/dock/taskbar.\n\n'

bash ./run-forge-ide.sh
printf '[forge-smoke] Forge launched. Complete the eight checks above for release sign-off.\n'

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

printf '\n============================================================\n'
printf '  Forge Super Agent - macOS/Linux Setup\n'
printf '============================================================\n'
printf 'Repository: %s\n\n' "$ROOT"

command -v node >/dev/null 2>&1 || { echo 'ERROR: A bootstrap Node.js runtime is required on PATH.' >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo 'ERROR: Git is required on PATH.' >&2; exit 1; }

printf '[1/6] Preparing pinned Node runtime, native toolchain, and dependencies...\n'
bash scripts/forge-unix-native-preflight.sh "$ROOT" --install-dependencies

FORGE_NODE="$(node scripts/forge-node20-runtime.mjs ensure | tail -n 1)"
FORGE_RUNTIME_ROOT="$(cd "$(dirname "$FORGE_NODE")/.." && pwd)"
FORGE_NPM_CLI="$FORGE_RUNTIME_ROOT/lib/node_modules/npm/bin/npm-cli.js"
export PATH="$(dirname "$FORGE_NODE"):$PATH"
FORGE_NODE_VERSION="$($FORGE_NODE --version)"
printf '[forge-setup] Runtime locked to %s: %s\n' "$FORGE_NODE_VERSION" "$FORGE_NODE"

printf '[2/6] Installing pinned integrations and Playwright Chromium...\n'
"$FORGE_NODE" scripts/forge-super-agent-bootstrap.mjs --full --setup --browser

printf '[3/6] Running Forge contracts and skill validation...\n'
"$FORGE_NODE" scripts/forge-brand-contract-test.mjs
"$FORGE_NODE" scripts/forge-ui-contract-test.mjs
"$FORGE_NODE" scripts/forge-native-setup-contract.mjs
"$FORGE_NODE" scripts/forge-react-service-export-contract.mjs
"$FORGE_NODE" scripts/forge-model-provider-contract-test.mjs
"$FORGE_NODE" scripts/forge-work-self-test.mjs
"$FORGE_NODE" scripts/manage-skills.mjs validate

printf '[4/6] Compiling Forge core...\n'
"$FORGE_NODE" "$FORGE_NPM_CLI" run compile

printf '[5/6] Building Forge React UI...\n'
"$FORGE_NODE" "$FORGE_NPM_CLI" run buildreact

printf '[6/6] Verifying runtime and Super Agent integration state...\n'
"$FORGE_NODE" scripts/forge-runtime-guard.mjs
"$FORGE_NODE" scripts/forge-integrations.mjs verify active
"$FORGE_NODE" scripts/forge-integrations.mjs doctor
"$FORGE_NODE" scripts/forge-super-agent-self-test.mjs

printf '\n============================================================\n'
printf '  Forge setup completed successfully on %s.\n' "$(uname -s)"
printf '============================================================\n'
printf 'Pinned runtime: %s\n' "$FORGE_NODE_VERSION"
printf 'Launch: bash ./run-forge-ide.sh\n'
printf 'Release smoke: bash ./smoke-forge-unix.sh\n\n'

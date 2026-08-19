#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
INSTALL_DEPS="${2:-}"
cd "$REPO_ROOT"

fail() {
  printf '\n[forge-native] Unix native build preflight FAILED.\n%s\n' "$1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' was not found."
}

printf '[forge-native] Checking %s native build prerequisites...\n' "$(uname -s)"
require_cmd node
require_cmd git
require_cmd python3
require_cmd make

case "$(uname -s)" in
  Darwin)
    require_cmd xcode-select
    xcode-select -p >/dev/null 2>&1 || fail "Xcode Command Line Tools are required. Run: xcode-select --install"
    require_cmd clang
    require_cmd clang++
    ;;
  Linux)
    if command -v g++ >/dev/null 2>&1; then
      :
    elif command -v clang++ >/dev/null 2>&1; then
      :
    else
      fail "A C++ compiler is required. Install g++/build-essential or clang."
    fi
    require_cmd pkg-config
    missing=()
    for pkg in x11 xkbfile libsecret-1 krb5; do
      if ! pkg-config --exists "$pkg" 2>/dev/null; then
        missing+=("$pkg")
      fi
    done
    if ((${#missing[@]})); then
      fail "Missing native development packages: ${missing[*]}
Debian/Ubuntu: sudo apt-get install build-essential g++ libx11-dev libxkbfile-dev libsecret-1-dev libkrb5-dev pkg-config python3
Fedora/RHEL: sudo dnf install @development-tools gcc gcc-c++ make libsecret-devel krb5-devel libX11-devel libxkbfile-devel pkgconf-pkg-config python3
openSUSE: sudo zypper install patterns-devel-C-C++-devel_C_C++ krb5-devel libsecret-devel libxkbfile-devel libX11-devel pkg-config python3"
    fi
    ;;
  *)
    fail "Unsupported Unix platform: $(uname -s). Forge currently targets Windows, macOS, and Linux."
    ;;
esac

FORGE_NODE="$(node scripts/forge-node20-runtime.mjs ensure | tail -n 1)"
[[ -x "$FORGE_NODE" ]] || fail "Pinned Forge Node runtime was not prepared: $FORGE_NODE"
FORGE_NODE_VERSION="$($FORGE_NODE --version)"
EXPECTED_NODE="v$(tr -d '\r\n ' < .nvmrc)"
[[ "$FORGE_NODE_VERSION" == "$EXPECTED_NODE" ]] || fail "Expected $EXPECTED_NODE but resolved $FORGE_NODE_VERSION"

FORGE_RUNTIME_ROOT="$(cd "$(dirname "$FORGE_NODE")/.." && pwd)"
FORGE_NPM_CLI="$FORGE_RUNTIME_ROOT/lib/node_modules/npm/bin/npm-cli.js"
[[ -f "$FORGE_NPM_CLI" ]] || fail "Pinned Forge npm CLI is missing: $FORGE_NPM_CLI"
export PATH="$(dirname "$FORGE_NODE"):$PATH"
export npm_config_foreground_scripts=true

printf '[forge-native] Forge Node runtime: %s\n' "$FORGE_NODE_VERSION"
printf '[forge-native] Native dependency scripts: serialized foreground mode.\n'
printf '[forge-native] Unix native build preflight passed.\n'

if [[ "$INSTALL_DEPS" == "--install-dependencies" ]]; then
  if [[ -d node_modules ]]; then
    printf '[forge-native] Removing previous node_modules tree...\n'
    rm -rf node_modules || fail "Could not remove node_modules. Stop editor/Electron/watch processes using this repository and retry."
  fi
  printf '[forge-native] Installing deterministic Forge dependencies with npm ci...\n'
  "$FORGE_NODE" "$FORGE_NPM_CLI" ci --foreground-scripts
  printf '[forge-native] npm ci completed successfully.\n'
fi

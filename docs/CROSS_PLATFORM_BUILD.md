# Forge Cross-Platform Build Baseline

Forge is a Code-OSS/Void-derived desktop IDE. The project keeps Forge-specific product behavior in this repository while treating upstream projects as architecture and build references rather than blindly copying new upstream commits.

## Reference sources

1. **Microsoft VS Code / Code-OSS 1.99.3** — the exact Code-OSS product version used by this repository (`package.json` is `1.99.3`). This is the base reference for Electron, native modules, gulp targets, platform resources, and desktop launch behavior.
2. **voideditor/void** — AI/editor architecture reference for the `src/vs/workbench/contrib/void/` service, React/Tailwind, provider, edit/model service, IPC, and CSP patterns. The upstream repository is archived/read-only, so Forge must not depend on receiving future fixes from it.
3. **voideditor/void-builder / VSCodium** — reference for distributable Windows, macOS, and Linux packaging, signing, update, and release automation. Forge's local setup remains independent from signing/release credentials.

Reference URLs:

- https://github.com/microsoft/vscode/tree/1.99.3
- https://github.com/voideditor/void
- https://github.com/voideditor/void-builder
- https://github.com/VSCodium/vscodium

## Supported developer platforms

### Windows 10/11 x64

Use:

```powershell
.\setup-forge-super-agent.bat
.\smoke-forge-windows.bat
.\run-forge-ide.bat
```

Required native toolchain:

- Visual Studio 2022 or Visual Studio 2026
- Desktop development with C++
- x64/x86 MSVC tools
- Windows 10/11 SDK
- C++ Spectre-mitigated libraries for x64/x86
- ATL/MFC Spectre components are recommended for complete VS Code/Void contributor parity

Forge keeps `/Qspectre` compatibility instead of disabling mitigation to avoid installing the required runtime libraries.

### macOS

Use:

```bash
bash ./setup-forge.sh
bash ./smoke-forge-unix.sh
bash ./run-forge-ide.sh
```

Requirements:

- Xcode + Command Line Tools
- Python 3
- Git
- a bootstrap Node runtime; Forge then downloads and checksum-verifies the exact Node version from `.nvmrc`

Both Apple Silicon and Intel are supported by the portable Node runtime helper. Electron/native modules compile for the host architecture.

### Linux

Use the same Unix commands:

```bash
bash ./setup-forge.sh
bash ./smoke-forge-unix.sh
bash ./run-forge-ide.sh
```

Debian/Ubuntu native prerequisites:

```bash
sudo apt-get install build-essential g++ libx11-dev libxkbfile-dev libsecret-1-dev libkrb5-dev python-is-python3 pkg-config
```

Fedora/RHEL:

```bash
sudo dnf install @development-tools gcc gcc-c++ make libsecret-devel krb5-devel libX11-devel libxkbfile-devel pkgconf-pkg-config python3
```

## Deterministic runtime rules

Forge setup, smoke, and launch do not trust the machine's active Node version. `scripts/forge-node20-runtime.mjs` reads `.nvmrc`, downloads the matching Node archive from nodejs.org, verifies it against `SHASUMS256.txt`, and uses that runtime for Forge build/runtime scripts.

Windows VS2026 additionally uses a Forge-owned npm 11 runtime whose bundled node-gyp supports VS2026. Native npm lifecycle scripts are executed with `--foreground-scripts` to avoid GYP solution-generation races across VS Code native addons.

Open Design remains isolated on its own pinned Node 24 runtime and does not change the core Forge Node 20 ABI.

## Build gates

Every platform lane must pass:

1. native dependency installation
2. Forge brand/UI contracts
3. native setup contract
4. React service import/export contract
5. model/provider routing contract
6. Work Mode self-test
7. 333-skill validation
8. core TypeScript compile
9. Forge React build
10. runtime artifact guard
11. host Electron executable version check

GitHub Actions runs these gates on Linux, macOS, Windows 2022, and Windows 2025/VS2026-era runners.

## Local packaged builds

The inherited Code-OSS/Void gulp packaging targets remain the canonical local packaging mechanism:

```bash
# macOS Apple Silicon
npm run gulp vscode-darwin-arm64

# macOS Intel
npm run gulp vscode-darwin-x64

# Linux x64
npm run gulp vscode-linux-x64

# Linux ARM64
npm run gulp vscode-linux-arm64
```

Windows:

```powershell
npm run gulp vscode-win32-x64
npm run gulp vscode-win32-arm64
```

These create unsigned local application outputs. Production signing, notarization, package repositories, and auto-update publishing should follow a separate release pipeline based on the VSCodium/Void Builder model.

## Upstream update policy

Do not merge an upstream repository wholesale into Forge. Instead:

1. identify the upstream bug/feature and source commit;
2. compare it against the Code-OSS `1.99.3` base and Forge changes;
3. port the smallest compatible change;
4. preserve Forge provider/agent/UI behavior;
5. add or extend a contract/CI gate for the regression;
6. verify Windows, Linux, and macOS lanes before release.

This keeps Forge able to reuse the full open-source architecture while preventing an upstream rebase from silently removing Forge-specific behavior.

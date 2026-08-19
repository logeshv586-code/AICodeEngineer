import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const nvmrc = read('.nvmrc').trim();
const node20 = read('scripts/forge-node20-runtime.mjs');
const preflight = read('scripts/forge-windows-native-preflight.ps1');
const spectre = read('scripts/forge-windows-spectre-check.ps1');
const setup = read('setup-forge-super-agent.bat');
const launch = read('run-forge-ide.bat');
const smoke = read('smoke-forge-windows.bat');
const unixPreflight = read('scripts/forge-unix-native-preflight.sh');
const unixSetup = read('setup-forge.sh');
const unixLaunch = read('run-forge-ide.sh');
const unixSmoke = read('smoke-forge-unix.sh');
const crossPlatformDocs = read('docs/CROSS_PLATFORM_BUILD.md');
const workflow = read('.github/workflows/forge-ci.yml');

const checks = [
  ['Forge runtime remains Node 20', /^20\./.test(nvmrc)],
  ['portable Node runtime is checksum verified', node20.includes('SHASUMS256.txt') && node20.includes('checksum mismatch') && node20.includes("readFileSync(path.join(repoRoot, '.nvmrc')") && node20.includes("process.platform === 'darwin'") && node20.includes("process.platform === 'linux'")],
  ['Windows preflight resolves pinned Node', preflight.includes('forge-node20-runtime.mjs') && preflight.includes('Forge Node runtime:')],
  ['native lifecycle scripts are serialized', preflight.includes("npm_config_foreground_scripts = 'true'") && preflight.includes("'--foreground-scripts'") && unixPreflight.includes('npm_config_foreground_scripts=true') && unixPreflight.includes('--foreground-scripts')],
  ['VS2026 uses Forge-owned npm under pinned Node', preflight.includes("$forgeNpmVersion = '11.16.0'") && preflight.includes('Invoke-ForgeCommand $forgeNode') && preflight.includes("$selectedVsVersion -eq '2026'")],
  ['Windows Spectre runtime is a setup gate', spectre.includes('lib\\spectre\\x64') && spectre.includes('C++ Spectre-mitigated libraries for x64/x86') && setup.includes('forge-windows-spectre-check.ps1')],
  ['setup pins all later stages to Forge Node', setup.includes('FORGE_NODE_HOME') && setup.includes('FORGE_NPM_CLI') && setup.includes('set "PATH=!FORGE_NODE_HOME!;!PATH!"') && setup.includes('"!FORGE_NODE!" scripts\\forge-runtime-guard.mjs')],
  ['setup compile does not fall back to system npm', setup.includes('"!FORGE_NODE!" "!FORGE_NPM_CLI!" run compile') && !setup.includes('call npm run compile')],
  ['normal Windows launcher uses pinned Forge Node', launch.includes('forge-node20-runtime.mjs ensure') && launch.includes('set "PATH=!FORGE_NODE_HOME!;!PATH!"') && launch.includes('"!FORGE_NODE!" "%~dp0scripts\\forge-runtime-guard.mjs"')],
  ['Windows smoke uses pinned Forge Node and npm', smoke.includes('forge-node20-runtime.mjs ensure') && smoke.includes('FORGE_NPM_CLI') && smoke.includes('"!FORGE_NODE!" "!FORGE_NPM_CLI!" run compile')],
  ['Unix preflight covers macOS and Linux native prerequisites', unixPreflight.includes('Darwin)') && unixPreflight.includes('Linux)') && unixPreflight.includes('xcode-select') && unixPreflight.includes('libsecret-1') && unixPreflight.includes('libkrb5-dev')],
  ['Unix setup runs the same Forge gates', unixSetup.includes('forge-unix-native-preflight.sh') && unixSetup.includes('forge-ui-contract-test.mjs') && unixSetup.includes('forge-model-provider-contract-test.mjs') && unixSetup.includes('manage-skills.mjs validate') && unixSetup.includes('run buildreact')],
  ['Unix launch supports both Electron layouts', unixLaunch.includes('Electron.app/Contents/MacOS/Electron') && unixLaunch.includes('node_modules/electron/dist/electron') && unixLaunch.includes('forge-runtime-guard.mjs')],
  ['Unix smoke uses pinned Forge runtime', unixSmoke.includes('forge-node20-runtime.mjs ensure') && unixSmoke.includes('FORGE_NPM_CLI') && unixSmoke.includes('run compile') && unixSmoke.includes('run-forge-ide.sh')],
  ['cross-platform build policy references Code-OSS Void and VSCodium', crossPlatformDocs.includes('Microsoft VS Code / Code-OSS 1.99.3') && crossPlatformDocs.includes('voideditor/void') && crossPlatformDocs.includes('VSCodium/vscodium')],
  ['CI gates Windows Spectre before native install', workflow.includes('forge-windows-spectre-ensure.ps1') && workflow.includes('forge-windows-native-preflight.ps1 -RepoRoot $PWD -InstallDependencies')],
  ['CI builds Linux and macOS Electron', workflow.includes('linux-electron:') && workflow.includes('macos-electron:') && workflow.includes('Verify Linux Electron executable') && workflow.includes('Verify macOS Electron executable')],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed = true;
}

if (failed) {
  console.error('\nForge native setup contract failed.');
  process.exitCode = 1;
} else {
  console.log(`\nForge native setup contract passed for Node ${nvmrc} across Windows, macOS and Linux.`);
}

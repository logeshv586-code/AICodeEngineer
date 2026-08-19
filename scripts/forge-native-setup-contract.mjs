import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const nvmrc = read('.nvmrc').trim();
const node20 = read('scripts/forge-node20-runtime.mjs');
const preflight = read('scripts/forge-windows-native-preflight.ps1');
const setup = read('setup-forge-super-agent.bat');
const launch = read('run-forge-ide.bat');
const smoke = read('smoke-forge-windows.bat');
const workflow = read('.github/workflows/forge-ci.yml');

const checks = [
  ['Forge runtime remains Node 20', /^20\./.test(nvmrc)],
  ['portable Node runtime is checksum verified', node20.includes('SHASUMS256.txt') && node20.includes('checksum mismatch') && node20.includes("readFileSync(path.join(repoRoot, '.nvmrc')")],
  ['Windows preflight resolves pinned Node', preflight.includes('forge-node20-runtime.mjs') && preflight.includes('Forge Node runtime:')],
  ['native lifecycle scripts are serialized', preflight.includes("npm_config_foreground_scripts = 'true'") && preflight.includes("'--foreground-scripts'")],
  ['VS2026 uses Forge-owned npm under pinned Node', preflight.includes("$forgeNpmVersion = '11.16.0'") && preflight.includes('Invoke-ForgeCommand $forgeNode') && preflight.includes("$selectedVsVersion -eq '2026'")],
  ['setup pins all later stages to Forge Node', setup.includes('FORGE_NODE_HOME') && setup.includes('FORGE_NPM_CLI') && setup.includes('set "PATH=!FORGE_NODE_HOME!;!PATH!"') && setup.includes('"!FORGE_NODE!" scripts\\forge-runtime-guard.mjs')],
  ['setup compile does not fall back to system npm', setup.includes('"!FORGE_NODE!" "!FORGE_NPM_CLI!" run compile') && !setup.includes('call npm run compile')],
  ['normal launcher uses pinned Forge Node', launch.includes('forge-node20-runtime.mjs ensure') && launch.includes('set "PATH=!FORGE_NODE_HOME!;!PATH!"') && launch.includes('"!FORGE_NODE!" "%~dp0scripts\\forge-runtime-guard.mjs"')],
  ['Windows smoke uses pinned Forge Node and npm', smoke.includes('forge-node20-runtime.mjs ensure') && smoke.includes('FORGE_NPM_CLI') && smoke.includes('"!FORGE_NODE!" "!FORGE_NPM_CLI!" run compile')],
  ['Windows CI uses the same native preflight', workflow.includes('forge-windows-native-preflight.ps1 -RepoRoot $PWD -InstallDependencies')],
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
  console.log(`\nForge native setup contract passed for Node ${nvmrc}.`);
}

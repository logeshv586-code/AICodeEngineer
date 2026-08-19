import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exists = relative => fs.existsSync(path.join(repoRoot, relative));
const read = relative => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const pkg = JSON.parse(read('package.json'));
const docs = read('docs/CROSS_PLATFORM_BUILD.md');

const voidArchitectureFiles = [
  'src/vs/workbench/contrib/void/common/modelCapabilities.ts',
  'src/vs/workbench/contrib/void/common/voidSettingsTypes.ts',
  'src/vs/workbench/contrib/void/common/sendLLMMessageTypes.ts',
  'src/vs/workbench/contrib/void/electron-main/llmMessage/sendLLMMessage.impl.ts',
  'src/vs/workbench/contrib/void/browser/react/build.js',
  'src/vs/workbench/contrib/void/browser/react/src/util/services.tsx',
  'src/vs/workbench/contrib/void/browser/react/src/void-settings-tsx/Settings.tsx',
];

const platformAssets = [
  'resources/win32',
  'resources/linux',
  'resources/darwin',
];

const checks = [
  ['Code-OSS base version remains explicit', pkg.name === 'code-oss-dev' && pkg.version === '1.99.3'],
  ['Void architecture source areas remain present', voidArchitectureFiles.every(exists)],
  ['Windows Linux and macOS product assets remain present', platformAssets.every(exists)],
  ['React build extension remains active', typeof pkg.scripts?.buildreact === 'string' && pkg.scripts.buildreact.includes('browser/react')],
  ['cross-platform docs track Code-OSS reference', docs.includes('microsoft/vscode/tree/1.99.3')],
  ['cross-platform docs track Void architecture reference', docs.includes('github.com/voideditor/void')],
  ['cross-platform docs track VSCodium packaging reference', docs.includes('github.com/VSCodium/vscodium') && docs.includes('github.com/voideditor/void-builder')],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed = true;
}

if (failed) {
  console.error('\nForge upstream reference contract failed. Port upstream changes deliberately instead of deleting the Code-OSS/Void architecture surface.');
  process.exitCode = 1;
} else {
  console.log('\nForge upstream reference contract passed: Code-OSS 1.99.3 + Void architecture + VSCodium packaging references are intact.');
}

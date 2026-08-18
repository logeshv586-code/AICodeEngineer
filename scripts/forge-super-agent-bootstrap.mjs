import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapForgeMcp, doctor, installGroup, verifyIntegrations } from './forge-integrations.mjs';
import { runSelfTest } from './forge-super-agent-self-test.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const includeLightning = process.argv.includes('--full') || process.argv.includes('--all') || process.argv.includes('--with-lightning');
const coreOnly = process.argv.includes('--core');
const setup = process.argv.includes('--setup');
const force = process.argv.includes('--force');
const installBrowser = process.argv.includes('--browser');
const group = includeLightning ? 'full' : coreOnly ? 'core' : 'active';

const run = (command, args = []) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
};

console.log(`[forge-super-agent] Installing ${group} pinned source integrations${setup ? ' with dependency setup' : ' (source-only)'}.`);
if (!includeLightning) console.log('[forge-super-agent] Agent Lightning is deferred and will not be installed or required in this phase.');
const installed = installGroup(group, { setup, force });
for (const item of installed) {
  console.log(`[forge-super-agent] ${item.id}: ${item.path}`);
}

if (installBrowser) {
  console.log('[forge-super-agent] Installing Chromium for the local Playwright browser agent...');
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  run(npmCommand, ['exec', 'playwright', 'install', 'chromium']);
}

const configFile = bootstrapForgeMcp();
console.log(`[forge-super-agent] MCP bootstrap complete: ${configFile}`);

const verification = verifyIntegrations({ requireAll: includeLightning, requireActive: !includeLightning });
if (!verification.ok) {
  throw new Error(`Integration verification failed: ${verification.failures.join(', ')}`);
}

const selfTest = runSelfTest({ requireAll: includeLightning, requireActive: !includeLightning });
if (!selfTest.ok) {
  throw new Error(`Forge Super Agent self-test failed: ${selfTest.failed.join(', ')}`);
}

console.log(JSON.stringify(doctor(), null, 2));
console.log('[forge-super-agent] Installation and verification complete.');
console.log('[forge-super-agent] Restart Forge AI so the built-in MCP client loads forge-super-agent.');
console.log('[forge-super-agent] Active integration source lives under ~/.forge/integrations (C:\\Users\\<user>\\.forge\\integrations on Windows).');
if (!includeLightning) {
  console.log('[forge-super-agent] Later, enable Agent Lightning with: node scripts/forge-super-agent-bootstrap.mjs --with-lightning --browser');
}

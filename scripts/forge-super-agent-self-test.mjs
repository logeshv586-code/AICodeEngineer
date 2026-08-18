import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ACTIVE_INTEGRATION_IDS, doctor, verifyIntegrations } from './forge-integrations.mjs';
import { runUiContractTest } from './forge-ui-contract-test.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const check = (name, ok, detail) => ({ name, ok: !!ok, detail });

export const runSelfTest = (options = {}) => {
  const requireAll = options.requireAll === true;
  const requireActive = options.requireActive === true || !requireAll;
  const checks = [];
  const diagnostics = doctor();

  checks.push(check('node', diagnostics.commands.node, process.version));
  checks.push(check('git', diagnostics.commands.git, diagnostics.commands.git ? 'available' : 'missing'));
  checks.push(check('forge mcp config', diagnostics.mcp.registered, diagnostics.mcp.configFile));

  try {
    require.resolve('@playwright/test');
    checks.push(check('playwright package', true, '@playwright/test is resolvable'));
  } catch (error) {
    checks.push(check('playwright package', false, error instanceof Error ? error.message : String(error)));
  }

  const registryPath = path.join(repoRoot, 'skill_registry.json');
  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const skills = Array.isArray(registry.skills) ? registry.skills : [];
    checks.push(check('skill registry', skills.length === 333 && registry.skillCount === 333, `${skills.length}/333 skills`));
  } catch (error) {
    checks.push(check('skill registry', false, error instanceof Error ? error.message : String(error)));
  }

  const workspaceSkillsDir = path.join(repoRoot, '.agents', 'skills');
  try {
    const active = fs.readdirSync(workspaceSkillsDir, { withFileTypes: true }).filter(entry => entry.isDirectory() || entry.name.endsWith('.md'));
    checks.push(check('state-2 workspace skills', active.length === 7, `${active.length}/7 active skills`));
  } catch (error) {
    checks.push(check('state-2 workspace skills', false, error instanceof Error ? error.message : String(error)));
  }

  const integrationVerification = verifyIntegrations({ requireAll, requireActive });
  for (const item of integrationVerification.integrations) {
    const required = requireAll || ACTIVE_INTEGRATION_IDS.includes(item.id);
    const ok = required ? item.exact && item.remoteExact && item.licenseFilePresent : true;
    const detail = item.installed
      ? `${item.commit || 'unknown'}${item.exact ? ' (pinned)' : ' (mismatch)'}`
      : required
        ? 'not installed (required now)'
        : 'deferred until Agent Lightning phase';
    checks.push(check(`integration:${item.id}`, ok, detail));
  }

  try {
    const ui = runUiContractTest();
    for (const item of ui.checks) checks.push(check(`ui:${item.name}`, item.ok, item.detail));
  } catch (error) {
    checks.push(check('ui contracts', false, error instanceof Error ? error.message : String(error)));
  }

  const failed = checks.filter(item => !item.ok);
  return {
    ok: failed.length === 0,
    requireAll,
    requireActive,
    repoRoot,
    integrationsRoot: diagnostics.integrationsRoot,
    expectedWindowsPath: path.join(os.homedir(), '.forge', 'integrations'),
    activeIntegrationIds: ACTIVE_INTEGRATION_IDS,
    deferredIntegrationIds: ['agent-lightning'],
    checks,
    failed: failed.map(item => item.name),
  };
};

const main = () => {
  const requireAll = process.argv.includes('--require-all');
  const result = runSelfTest({ requireAll, requireActive: !requireAll || process.argv.includes('--require-active') });
  for (const item of result.checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name.padEnd(40)} ${item.detail || ''}`);
  console.log(`\nIntegration root: ${result.integrationsRoot}`);
  console.log(`Active now: ${result.activeIntegrationIds.join(', ')}`);
  console.log('Deferred: agent-lightning');
  if (!result.ok) {
    console.error(`\nForge Super Agent self-test failed: ${result.failed.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nForge Super Agent self-test passed.');
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { doctor, verifyIntegrations } from './forge-integrations.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const check = (name, ok, detail) => ({ name, ok: !!ok, detail });

export const runSelfTest = (options = {}) => {
  const requireAll = options.requireAll === true;
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
    const active = fs.readdirSync(workspaceSkillsDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() || entry.name.endsWith('.md'));
    checks.push(check('state-2 workspace skills', active.length === 7, `${active.length}/7 active skills`));
  } catch (error) {
    checks.push(check('state-2 workspace skills', false, error instanceof Error ? error.message : String(error)));
  }

  const integrationVerification = verifyIntegrations({ requireAll });
  for (const item of integrationVerification.integrations) {
    const ok = item.exact || (!requireAll && !item.installed);
    checks.push(check(`integration:${item.id}`, ok, item.installed
      ? `${item.commit || 'unknown'}${item.exact ? ' (pinned)' : ' (mismatch)'}`
      : `not installed${requireAll ? ' (required)' : ' (optional)'}`));
  }

  const failed = checks.filter(item => !item.ok);
  return {
    ok: failed.length === 0,
    requireAll,
    repoRoot,
    integrationsRoot: diagnostics.integrationsRoot,
    expectedWindowsPath: path.join(os.homedir(), '.forge', 'integrations'),
    checks,
    failed: failed.map(item => item.name),
  };
};

const main = () => {
  const result = runSelfTest({ requireAll: process.argv.includes('--require-all') });
  for (const item of result.checks) {
    console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name.padEnd(28)} ${item.detail || ''}`);
  }
  console.log(`\nIntegration root: ${result.integrationsRoot}`);
  if (!result.ok) {
    console.error(`\nForge Super Agent self-test failed: ${result.failed.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nForge Super Agent self-test passed.');
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

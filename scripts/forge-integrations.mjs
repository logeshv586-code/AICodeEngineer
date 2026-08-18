import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lockPath = path.join(repoRoot, 'forge-integrations.lock.json');
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const integrationsRoot = process.env.FORGE_INTEGRATIONS_HOME || path.join(os.homedir(), '.forge', 'integrations');
const forgeDataRoot = process.env.FORGE_DATA_HOME || path.join(os.homedir(), '.forge-ai-editor');

const aliases = {
  ua: 'understand-anything',
  understand: 'understand-anything',
  lightning: 'agent-lightning',
  design: 'open-design',
  aion: 'aionui',
};

const resolveId = id => aliases[id] || id;
const integrationOfId = id => lock.integrations[resolveId(id)];
const integrationPath = id => path.join(integrationsRoot, resolveId(id));

const run = (command, args = [], options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    stdio: options.stdio || 'inherit',
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, ...(options.env || {}) },
  });
  if (options.allowFailure) return result;
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
  return result;
};

const commandExists = command => {
  const checker = process.platform === 'win32' ? 'where' : 'which';
  return run(checker, [command], { stdio: 'ignore', allowFailure: true }).status === 0;
};

const currentCommit = dir => {
  if (!fs.existsSync(path.join(dir, '.git'))) return null;
  const result = run('git', ['-C', dir, 'rev-parse', 'HEAD'], { stdio: 'pipe', allowFailure: true });
  return result.status === 0 ? String(result.stdout || '').trim() : null;
};

const venvPython = dir => process.platform === 'win32'
  ? path.join(dir, '.forge-venv', 'Scripts', 'python.exe')
  : path.join(dir, '.forge-venv', 'bin', 'python');

const setupIntegration = id => {
  const dir = integrationPath(id);
  if (id === 'skillopt') {
    if (!commandExists('python') && !commandExists('python3')) throw new Error('Python is required to set up SkillOpt.');
    const python = commandExists('python') ? 'python' : 'python3';
    const venv = path.join(dir, '.forge-venv');
    if (!fs.existsSync(venvPython(dir))) run(python, ['-m', 'venv', venv]);
    run(venvPython(dir), ['-m', 'pip', 'install', '-e', dir]);
    return;
  }

  if (id === 'understand-anything') {
    if (!commandExists('pnpm')) throw new Error('pnpm is required for Understand Anything source setup. Install pnpm or use source-only mode.');
    run('pnpm', ['install', '--frozen-lockfile'], { cwd: dir });
    return;
  }

  if (id === 'open-design') {
    if (!commandExists('pnpm')) throw new Error('pnpm is required for Open Design. Open Design currently expects its documented pnpm toolchain.');
    run('pnpm', ['install', '--frozen-lockfile'], { cwd: dir });
    return;
  }

  if (id === 'aionui') {
    if (!commandExists('pnpm')) throw new Error('pnpm is required to set up AionUi from source.');
    run('pnpm', ['install', '--frozen-lockfile'], { cwd: dir });
    return;
  }

  if (id === 'agent-lightning') {
    console.log('[forge-integrations] Agent Lightning source is installed. GPU/RL dependencies are intentionally opt-in.');
    console.log('[forge-integrations] Follow the pinned repository setup for the CUDA/verl/vLLM environment you intend to train with.');
  }
};

export const installIntegration = (rawId, options = {}) => {
  const id = resolveId(rawId);
  const spec = integrationOfId(id);
  if (!spec) throw new Error(`Unknown integration: ${rawId}`);
  fs.mkdirSync(integrationsRoot, { recursive: true });
  const dir = integrationPath(id);
  const existing = currentCommit(dir);

  if (existing === spec.commit && !options.force) {
    console.log(`[forge-integrations] ${id} already pinned at ${spec.commit.slice(0, 12)}.`);
  } else {
    if (fs.existsSync(dir) && options.force) fs.rmSync(dir, { recursive: true, force: true });
    if (!fs.existsSync(path.join(dir, '.git'))) {
      run('git', ['clone', '--filter=blob:none', '--no-checkout', spec.repo, dir]);
    }
    run('git', ['-C', dir, 'fetch', '--depth', '1', 'origin', spec.commit]);
    run('git', ['-C', dir, 'checkout', '--detach', spec.commit]);
    console.log(`[forge-integrations] Installed full ${id} source at ${dir}`);
  }

  if (options.setup) setupIntegration(id);
  return { id, path: dir, commit: currentCommit(dir), expectedCommit: spec.commit };
};

export const installGroup = (group, options = {}) => {
  const ids = Object.entries(lock.integrations)
    .filter(([, spec]) => group === 'full' || (group === 'core' && spec.tier === 'core'))
    .map(([id]) => id);
  return ids.map(id => installIntegration(id, options));
};

export const integrationStatus = () => Object.entries(lock.integrations).map(([id, spec]) => {
  const dir = integrationPath(id);
  const commit = currentCommit(dir);
  return {
    id,
    tier: spec.tier,
    license: spec.license,
    installed: !!commit,
    commit,
    expectedCommit: spec.commit,
    exact: commit === spec.commit,
    path: dir,
  };
});

export const bootstrapForgeMcp = (options = {}) => {
  const configFile = options.configFile || path.join(forgeDataRoot, 'mcp.json');
  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  let config = { mcpServers: {} };
  if (fs.existsSync(configFile)) {
    try { config = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch { /* replace malformed empty config below */ }
  }
  config.mcpServers ||= {};
  config.mcpServers['forge-super-agent'] = {
    command: process.execPath,
    args: [path.join(repoRoot, 'scripts', 'forge-mcp-server.mjs')],
    env: {
      FORGE_APP_ROOT: repoRoot,
      FORGE_INTEGRATIONS_HOME: integrationsRoot,
    },
    cwd: repoRoot,
  };
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  console.log(`[forge-integrations] Forge Super Agent MCP registered in ${configFile}`);
  return configFile;
};

export const doctor = () => {
  const status = integrationStatus();
  return {
    repoRoot,
    integrationsRoot,
    forgeDataRoot,
    commands: {
      git: commandExists('git'),
      node: commandExists('node'),
      python: commandExists('python') || commandExists('python3'),
      pnpm: commandExists('pnpm'),
    },
    integrations: status,
  };
};

const printStatus = () => {
  for (const item of integrationStatus()) {
    const mark = item.exact ? 'OK' : item.installed ? 'MISMATCH' : 'NOT INSTALLED';
    console.log(`${mark.padEnd(13)} ${item.id.padEnd(20)} ${item.path}`);
  }
};

const main = () => {
  const [command = 'status', target = 'core', ...rest] = process.argv.slice(2);
  const setup = rest.includes('--setup');
  const force = rest.includes('--force');

  if (command === 'status') return printStatus();
  if (command === 'doctor') return console.log(JSON.stringify(doctor(), null, 2));
  if (command === 'bootstrap-mcp') return bootstrapForgeMcp();
  if (command === 'install') {
    if (target === 'core' || target === 'full') return installGroup(target, { setup, force });
    return installIntegration(target, { setup, force });
  }
  if (command === 'path') return console.log(integrationPath(target));

  console.log('Usage: node scripts/forge-integrations.mjs <status|doctor|bootstrap-mcp|install|path> [core|full|integration] [--setup] [--force]');
  process.exitCode = 1;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

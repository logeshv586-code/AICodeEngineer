import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lockPath = path.join(repoRoot, 'forge-integrations.lock.json');
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const integrationsRoot = path.resolve(process.env.FORGE_INTEGRATIONS_HOME || path.join(os.homedir(), '.forge', 'integrations'));
const forgeDataRoot = path.resolve(process.env.FORGE_DATA_HOME || path.join(os.homedir(), '.forge-ai-editor'));
const installManifestPath = path.join(integrationsRoot, '.forge-integrations.json');

export const ACTIVE_INTEGRATION_IDS = Object.keys(lock.integrations).filter(id => id !== 'agent-lightning');

const aliases = {
  all: 'full',
  default: 'active',
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
    shell: options.shell ?? (process.platform === 'win32'),
    env: { ...process.env, ...(options.env || {}) },
    timeout: options.timeout,
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

const pnpmInvocation = () => {
  if (commandExists('pnpm')) return { command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', prefix: [] };
  if (commandExists('corepack')) return { command: process.platform === 'win32' ? 'corepack.cmd' : 'corepack', prefix: ['pnpm'] };
  return null;
};

const runPnpm = (args, cwd) => {
  const invocation = pnpmInvocation();
  if (!invocation) throw new Error('pnpm is required for this integration. Install pnpm or enable Corepack.');
  return run(invocation.command, [...invocation.prefix, ...args], { cwd, shell: false });
};

const currentCommit = dir => {
  if (!fs.existsSync(path.join(dir, '.git'))) return null;
  const result = run('git', ['-C', dir, 'rev-parse', 'HEAD'], { stdio: 'pipe', allowFailure: true });
  return result.status === 0 ? String(result.stdout || '').trim() : null;
};

const currentRemote = dir => {
  if (!fs.existsSync(path.join(dir, '.git'))) return null;
  const result = run('git', ['-C', dir, 'remote', 'get-url', 'origin'], { stdio: 'pipe', allowFailure: true });
  return result.status === 0 ? String(result.stdout || '').trim() : null;
};

const sourceLicensePresent = dir => {
  if (!fs.existsSync(dir)) return false;
  try {
    return fs.readdirSync(dir).some(name => /^licen[cs]e(?:\.|$)/i.test(name));
  } catch {
    return false;
  }
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
    run(venvPython(dir), ['-m', 'pip', 'install', '--upgrade', 'pip'], { shell: false });
    run(venvPython(dir), ['-m', 'pip', 'install', '-e', dir], { shell: false });
    return;
  }

  if (id === 'understand-anything') {
    const pluginRoot = path.join(dir, 'understand-anything-plugin');
    const packageRoot = fs.existsSync(path.join(pluginRoot, 'package.json')) ? pluginRoot : dir;
    if (!fs.existsSync(path.join(packageRoot, 'package.json'))) {
      console.log('[forge-integrations] Understand Anything source is ready. No Node workspace package was found to set up.');
      return;
    }
    runPnpm(['install', '--frozen-lockfile'], packageRoot);
    runPnpm(['--filter', '@understand-anything/core', 'build'], packageRoot);
    return;
  }

  if (id === 'open-design') {
    runPnpm(['install', '--frozen-lockfile'], dir);
    return;
  }

  if (id === 'aionui') {
    runPnpm(['install', '--frozen-lockfile'], dir);
    return;
  }

  if (id === 'agent-lightning') {
    console.log('[forge-integrations] Agent Lightning source is installed, but its GPU/RL stack is intentionally not configured by Forge.');
    console.log('[forge-integrations] Enable it later with the pinned upstream CUDA/Kubernetes/verl/vLLM training guide.');
  }
};

const ensureCloneTarget = (dir, options = {}) => {
  if (!fs.existsSync(dir)) return;
  if (fs.existsSync(path.join(dir, '.git'))) return;
  const entries = fs.readdirSync(dir);
  if (entries.length === 0) {
    fs.rmSync(dir, { recursive: true, force: true });
    return;
  }
  if (options.force) {
    fs.rmSync(dir, { recursive: true, force: true });
    return;
  }
  throw new Error(`Integration target exists but is not a Git checkout: ${dir}. Use --force only if you want Forge to replace it.`);
};

const writeInstallManifest = () => {
  fs.mkdirSync(integrationsRoot, { recursive: true });
  const manifest = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    integrationsRoot,
    activeIntegrationIds: ACTIVE_INTEGRATION_IDS,
    deferredIntegrationIds: ['agent-lightning'],
    lockFile: lockPath,
    integrations: integrationStatus(),
  };
  fs.writeFileSync(installManifestPath, JSON.stringify(manifest, null, 2));
  return installManifestPath;
};

export const installIntegration = (rawId, options = {}) => {
  const id = resolveId(rawId);
  const spec = integrationOfId(id);
  if (!spec) throw new Error(`Unknown integration: ${rawId}`);
  if (!commandExists('git')) throw new Error('Git is required to download Forge integrations.');

  fs.mkdirSync(integrationsRoot, { recursive: true });
  const dir = integrationPath(id);
  ensureCloneTarget(dir, options);
  const existing = currentCommit(dir);

  if (existing === spec.commit && !options.force) {
    console.log(`[forge-integrations] ${id} already pinned at ${spec.commit.slice(0, 12)}.`);
  } else {
    if (fs.existsSync(dir) && options.force) fs.rmSync(dir, { recursive: true, force: true });
    if (!fs.existsSync(path.join(dir, '.git'))) {
      fs.mkdirSync(dir, { recursive: true });
      run('git', ['init', dir]);
      run('git', ['-C', dir, 'remote', 'add', 'origin', spec.repo]);
    } else {
      const remote = currentRemote(dir);
      if (remote !== spec.repo) run('git', ['-C', dir, 'remote', 'set-url', 'origin', spec.repo]);
    }

    run('git', ['-C', dir, 'fetch', '--depth', '1', 'origin', spec.commit]);
    run('git', ['-C', dir, 'checkout', '--detach', '--force', 'FETCH_HEAD']);
    console.log(`[forge-integrations] Installed full ${id} source at ${dir}`);
  }

  if (options.setup) setupIntegration(id);
  writeInstallManifest();
  return {
    id,
    path: dir,
    commit: currentCommit(dir),
    expectedCommit: spec.commit,
    exact: currentCommit(dir) === spec.commit,
    license: spec.license,
    licenseFilePresent: sourceLicensePresent(dir),
  };
};

export const installGroup = (group, options = {}) => {
  const normalizedGroup = resolveId(group);
  const ids = Object.entries(lock.integrations)
    .filter(([id, spec]) => normalizedGroup === 'full'
      || (normalizedGroup === 'active' && id !== 'agent-lightning')
      || (normalizedGroup === 'core' && spec.tier === 'core'))
    .map(([id]) => id);
  if (ids.length === 0) throw new Error(`Unknown integration group: ${group}`);
  const results = ids.map(id => installIntegration(id, options));
  writeInstallManifest();
  return results;
};

export const integrationStatus = () => Object.entries(lock.integrations).map(([id, spec]) => {
  const dir = integrationPath(id);
  const commit = currentCommit(dir);
  const remote = currentRemote(dir);
  return {
    id,
    tier: spec.tier,
    activeNow: id !== 'agent-lightning',
    deferred: id === 'agent-lightning',
    license: spec.license,
    installed: !!commit,
    commit,
    expectedCommit: spec.commit,
    exact: commit === spec.commit,
    remote,
    expectedRemote: spec.repo,
    remoteExact: remote === spec.repo,
    licenseFilePresent: sourceLicensePresent(dir),
    path: dir,
  };
});

export const verifyIntegrations = (options = {}) => {
  const requireAll = options.requireAll === true;
  const requireActive = options.requireActive === true;
  const integrations = integrationStatus();
  const requiredIds = new Set(requireAll
    ? integrations.map(item => item.id)
    : requireActive
      ? ACTIVE_INTEGRATION_IDS
      : []);
  const failures = integrations.filter(item =>
    (requiredIds.has(item.id) && !item.installed)
    || (item.installed && (!item.exact || !item.remoteExact || !item.licenseFilePresent))
  );
  return {
    ok: failures.length === 0,
    requireAll,
    requireActive,
    requiredIds: [...requiredIds],
    integrations,
    failures: failures.map(item => item.id),
  };
};

export const bootstrapForgeMcp = (options = {}) => {
  const configFile = options.configFile || path.join(forgeDataRoot, 'mcp.json');
  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  let config = { mcpServers: {} };
  if (fs.existsSync(configFile)) {
    try { config = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch { /* replace malformed config below */ }
  }
  config.mcpServers ||= {};
  config.mcpServers['forge-super-agent'] = {
    command: process.execPath,
    args: [path.join(repoRoot, 'scripts', 'forge-mcp-server.mjs')],
    env: {
      FORGE_APP_ROOT: repoRoot,
      FORGE_INTEGRATIONS_HOME: integrationsRoot,
      FORGE_DATA_HOME: forgeDataRoot,
    },
    cwd: repoRoot,
  };
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  console.log(`[forge-integrations] Forge Super Agent MCP registered in ${configFile}`);
  return configFile;
};

const mcpRegistrationStatus = () => {
  const configFile = path.join(forgeDataRoot, 'mcp.json');
  if (!fs.existsSync(configFile)) return { registered: false, configFile };
  try {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    const server = config?.mcpServers?.['forge-super-agent'];
    return {
      registered: !!server,
      configFile,
      command: server?.command,
      cwd: server?.cwd,
    };
  } catch {
    return { registered: false, configFile, malformed: true };
  }
};

export const doctor = () => ({
  repoRoot,
  integrationsRoot,
  forgeDataRoot,
  installManifestPath,
  activeIntegrationIds: ACTIVE_INTEGRATION_IDS,
  deferredIntegrationIds: ['agent-lightning'],
  commands: {
    git: commandExists('git'),
    node: commandExists('node'),
    python: commandExists('python') || commandExists('python3'),
    pnpm: commandExists('pnpm'),
    corepack: commandExists('corepack'),
  },
  mcp: mcpRegistrationStatus(),
  integrations: integrationStatus(),
});

const printStatus = () => {
  console.log(`Forge integration root: ${integrationsRoot}`);
  for (const item of integrationStatus()) {
    const mark = item.exact && item.remoteExact ? 'OK' : item.installed ? 'MISMATCH' : item.deferred ? 'DEFERRED' : 'NOT INSTALLED';
    console.log(`${mark.padEnd(13)} ${item.id.padEnd(20)} ${item.path}`);
  }
};

const main = () => {
  const [command = 'status', target = 'active', ...rest] = process.argv.slice(2);
  const setup = rest.includes('--setup');
  const force = rest.includes('--force');

  if (command === 'status') return printStatus();
  if (command === 'doctor') return console.log(JSON.stringify(doctor(), null, 2));
  if (command === 'verify') {
    const result = verifyIntegrations({
      requireAll: target === 'full' || target === 'all' || rest.includes('--require-all'),
      requireActive: target === 'active' || rest.includes('--require-active'),
    });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (command === 'bootstrap-mcp') return bootstrapForgeMcp();
  if (command === 'install') {
    if (target === 'core' || target === 'active' || target === 'full' || target === 'all') return installGroup(target, { setup, force });
    return installIntegration(target, { setup, force });
  }
  if (command === 'path') return console.log(integrationPath(target));
  if (command === 'root') return console.log(integrationsRoot);

  console.log('Usage: node scripts/forge-integrations.mjs <status|doctor|verify|bootstrap-mcp|install|path|root> [core|active|full|all|integration] [--setup] [--force] [--require-active] [--require-all]');
  process.exitCode = 1;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

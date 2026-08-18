import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const integrationsRoot = path.resolve(process.env.FORGE_INTEGRATIONS_HOME || path.join(os.homedir(), '.forge', 'integrations'));
const stateRoot = path.join(os.homedir(), '.forge', 'sidecars');
const node24RuntimeScript = path.join(scriptsRoot, 'forge-node24-runtime.mjs');

const sidecars = {
  'open-design': {
    cwd: path.join(integrationsRoot, 'open-design'),
    runtime: 'node24',
    startArgs: ['tools-dev', 'start', 'web'],
    stopArgs: ['tools-dev', 'stop'],
    statusArgs: ['tools-dev', 'status'],
  },
  'aionui': {
    cwd: path.join(integrationsRoot, 'aionui'),
    runtime: 'ambient',
    startArgs: ['webui'],
    remoteArgs: ['webui:remote'],
    stopArgs: null,
    statusArgs: null,
  },
};

const commandExists = command => {
  const checker = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(checker, [command], { stdio: 'ignore', shell: false });
  return result.status === 0;
};

const pnpmInvocation = () => {
  if (commandExists('pnpm')) return { command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', prefix: [] };
  if (commandExists('corepack')) return { command: process.platform === 'win32' ? 'corepack.cmd' : 'corepack', prefix: ['pnpm'] };
  throw new Error('pnpm is unavailable. Install pnpm or enable Corepack before starting AionUi. Open Design uses its own Forge-managed Node 24/pnpm runtime.');
};

const runPnpm = (args, options = {}) => {
  if (options.runtime === 'node24') {
    return spawnSync(process.execPath, [node24RuntimeScript, 'pnpm', '--cwd', options.cwd, '--', ...args], {
      cwd: scriptsRoot,
      encoding: 'utf8',
      shell: false,
      stdio: options.stdio || 'pipe',
      timeout: options.timeout,
    });
  }
  const invocation = pnpmInvocation();
  return spawnSync(invocation.command, [...invocation.prefix, ...args], {
    cwd: options.cwd,
    encoding: 'utf8',
    shell: false,
    stdio: options.stdio || 'pipe',
    timeout: options.timeout,
  });
};

const spawnPnpm = (args, options = {}) => {
  const invocation = pnpmInvocation();
  return spawn(invocation.command, [...invocation.prefix, ...args], {
    cwd: options.cwd,
    detached: options.detached === true,
    stdio: options.stdio || 'ignore',
    shell: false,
    windowsHide: true,
    env: { ...process.env, ...(options.env || {}) },
  });
};

const specOf = name => {
  const spec = sidecars[name];
  if (!spec) throw new Error(`Unknown sidecar: ${name}`);
  if (!fs.existsSync(spec.cwd)) throw new Error(`${name} is not installed. Run install-forge-super-agent.bat first or use forge_integrations install.`);
  return spec;
};

const stateFile = name => path.join(stateRoot, `${name}.json`);
const writeState = (name, state) => {
  fs.mkdirSync(stateRoot, { recursive: true });
  fs.writeFileSync(stateFile(name), JSON.stringify(state, null, 2));
};
const readState = name => {
  if (!fs.existsSync(stateFile(name))) return null;
  try { return JSON.parse(fs.readFileSync(stateFile(name), 'utf8')); } catch { return null; }
};
const clearState = name => {
  try { fs.rmSync(stateFile(name), { force: true }); } catch { /* ignore */ }
};
const processAlive = pid => {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
};

export const sidecarStatus = name => {
  const spec = specOf(name);
  const state = readState(name);
  let nativeStatus;
  if (spec.statusArgs) {
    const result = runPnpm(spec.statusArgs, { cwd: spec.cwd, runtime: spec.runtime, timeout: 30_000 });
    nativeStatus = { exitCode: result.status, stdout: String(result.stdout || '').slice(-8000), stderr: String(result.stderr || '').slice(-4000) };
  }
  return {
    name,
    path: spec.cwd,
    runtime: spec.runtime,
    process: state ? { ...state, alive: processAlive(state.pid) } : null,
    nativeStatus,
  };
};

export const startSidecar = (name, options = {}) => {
  const spec = specOf(name);
  if (name === 'open-design') {
    const result = runPnpm(spec.startArgs, { cwd: spec.cwd, runtime: spec.runtime, timeout: 120_000 });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Open Design failed to start: ${String(result.stderr || result.stdout || '').slice(-6000)}`);
    return { name, runtime: spec.runtime, exitCode: result.status, stdout: String(result.stdout || '').slice(-12000), stderr: String(result.stderr || '').slice(-6000) };
  }

  const child = spawnPnpm(options.remote ? spec.remoteArgs : spec.startArgs, {
    cwd: spec.cwd,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  const state = { pid: child.pid, startedAt: new Date().toISOString(), remote: !!options.remote };
  writeState(name, state);
  return { name, ...state };
};

const killProcessTree = pid => {
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { encoding: 'utf8', shell: false });
    return { ok: result.status === 0, stdout: String(result.stdout || ''), stderr: String(result.stderr || '') };
  }
  try {
    process.kill(-pid, 'SIGTERM');
    return { ok: true };
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
};

export const stopSidecar = name => {
  const spec = specOf(name);
  if (spec.stopArgs) {
    const result = runPnpm(spec.stopArgs, { cwd: spec.cwd, runtime: spec.runtime, timeout: 60_000 });
    if (result.error) throw result.error;
    return { name, runtime: spec.runtime, exitCode: result.status, stdout: String(result.stdout || '').slice(-8000), stderr: String(result.stderr || '').slice(-4000) };
  }
  const state = readState(name);
  if (!state?.pid) return { name, stopped: false, reason: 'No managed PID found.' };
  const killed = killProcessTree(state.pid);
  if (killed.ok) clearState(name);
  return { name, stopped: killed.ok, pid: state.pid, ...killed };
};

const main = () => {
  const [command = 'status', name = 'open-design', ...args] = process.argv.slice(2);
  if (command === 'status') return console.log(JSON.stringify(sidecarStatus(name), null, 2));
  if (command === 'start') return console.log(JSON.stringify(startSidecar(name, { remote: args.includes('--remote') }), null, 2));
  if (command === 'stop') return console.log(JSON.stringify(stopSidecar(name), null, 2));
  console.log('Usage: node scripts/forge-sidecars.mjs <status|start|stop> <open-design|aionui> [--remote]');
  process.exitCode = 1;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

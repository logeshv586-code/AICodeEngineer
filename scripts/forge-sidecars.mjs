import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const integrationsRoot = process.env.FORGE_INTEGRATIONS_HOME || path.join(os.homedir(), '.forge', 'integrations');
const stateRoot = path.join(os.homedir(), '.forge', 'sidecars');

const sidecars = {
  'open-design': {
    cwd: path.join(integrationsRoot, 'open-design'),
    command: 'pnpm',
    startArgs: ['tools-dev', 'start', 'web'],
    stopArgs: ['tools-dev', 'stop'],
    statusArgs: ['tools-dev', 'status'],
  },
  'aionui': {
    cwd: path.join(integrationsRoot, 'aionui'),
    command: 'pnpm',
    startArgs: ['webui'],
    stopArgs: null,
    statusArgs: null,
  },
};

const specOf = name => {
  const spec = sidecars[name];
  if (!spec) throw new Error(`Unknown sidecar: ${name}`);
  if (!fs.existsSync(spec.cwd)) throw new Error(`${name} is not installed. Run forge-integrations.mjs install ${name} first.`);
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
const processAlive = pid => {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
};

export const sidecarStatus = name => {
  const spec = specOf(name);
  const state = readState(name);
  let nativeStatus;
  if (spec.statusArgs) {
    const result = spawnSync(spec.command, spec.statusArgs, { cwd: spec.cwd, encoding: 'utf8', shell: process.platform === 'win32' });
    nativeStatus = { exitCode: result.status, stdout: String(result.stdout || '').slice(-8000), stderr: String(result.stderr || '').slice(-4000) };
  }
  return { name, path: spec.cwd, process: state ? { ...state, alive: processAlive(state.pid) } : null, nativeStatus };
};

export const startSidecar = (name, options = {}) => {
  const spec = specOf(name);
  if (name === 'open-design') {
    const result = spawnSync(spec.command, spec.startArgs, { cwd: spec.cwd, encoding: 'utf8', shell: process.platform === 'win32' });
    return { name, exitCode: result.status, stdout: String(result.stdout || '').slice(-12000), stderr: String(result.stderr || '').slice(-6000) };
  }

  const child = spawn(spec.command, options.remote ? ['webui:remote'] : spec.startArgs, {
    cwd: spec.cwd,
    detached: true,
    stdio: 'ignore',
    shell: process.platform === 'win32',
    env: { ...process.env },
  });
  child.unref();
  const state = { pid: child.pid, startedAt: new Date().toISOString(), remote: !!options.remote };
  writeState(name, state);
  return { name, ...state };
};

export const stopSidecar = name => {
  const spec = specOf(name);
  if (spec.stopArgs) {
    const result = spawnSync(spec.command, spec.stopArgs, { cwd: spec.cwd, encoding: 'utf8', shell: process.platform === 'win32' });
    return { name, exitCode: result.status, stdout: String(result.stdout || '').slice(-8000), stderr: String(result.stderr || '').slice(-4000) };
  }
  const state = readState(name);
  if (!state?.pid) return { name, stopped: false, reason: 'No managed PID found.' };
  try {
    process.kill(state.pid);
    return { name, stopped: true, pid: state.pid };
  } catch (error) {
    return { name, stopped: false, pid: state.pid, error: error instanceof Error ? error.message : String(error) };
  }
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

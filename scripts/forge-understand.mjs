import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const integrationsRoot = path.resolve(process.env.FORGE_INTEGRATIONS_HOME || path.join(os.homedir(), '.forge', 'integrations'));
const pluginRoot = path.join(integrationsRoot, 'understand-anything', 'understand-anything-plugin');
const dashboardDir = path.join(pluginRoot, 'packages', 'dashboard');
const stateRoot = path.join(os.homedir(), '.forge', 'sidecars');
const dashboardStateFile = path.join(stateRoot, 'understand-dashboard.json');

const commandExists = command => {
  const checker = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(checker, [command], { stdio: 'ignore', shell: false }).status === 0;
};

const pnpmInvocation = () => {
  if (commandExists('pnpm')) return { command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', prefix: [] };
  if (commandExists('corepack')) return { command: process.platform === 'win32' ? 'corepack.cmd' : 'corepack', prefix: ['pnpm'] };
  throw new Error('pnpm is unavailable. Install pnpm or enable Corepack before launching the Understand Anything dashboard.');
};

const dataDirOfWorkspace = workspace => {
  const preferred = path.join(workspace, '.ua');
  const legacy = path.join(workspace, '.understand-anything');
  if (fs.existsSync(legacy)) return legacy;
  if (fs.existsSync(preferred)) return preferred;
  return preferred;
};

const graphFileOfWorkspace = workspace => path.join(dataDirOfWorkspace(workspace), 'knowledge-graph.json');

const walkStrings = (value, pathParts = [], output = [], depth = 0) => {
  if (depth > 10 || output.length > 5000) return output;
  if (typeof value === 'string') {
    output.push({ path: pathParts.join('.'), text: value });
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, [...pathParts, String(index)], output, depth + 1));
    return output;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) walkStrings(item, [...pathParts, key], output, depth + 1);
  }
  return output;
};

export const graphStatus = workspace => {
  const root = path.resolve(workspace || process.cwd());
  const graphFile = graphFileOfWorkspace(root);
  if (!fs.existsSync(graphFile)) return { workspace: root, exists: false, graphFile, pluginRoot };
  const stat = fs.statSync(graphFile);
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(graphFile, 'utf8')); } catch { parsed = null; }
  const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes.length : undefined;
  const edges = Array.isArray(parsed?.edges) ? parsed.edges.length : undefined;
  return { workspace: root, exists: true, graphFile, sizeBytes: stat.size, modifiedAt: stat.mtime.toISOString(), nodes, edges, pluginRoot };
};

export const searchGraph = (workspace, query, limit = 20) => {
  const root = path.resolve(workspace || process.cwd());
  const graphFile = graphFileOfWorkspace(root);
  if (!fs.existsSync(graphFile)) {
    return {
      status: graphStatus(root),
      matches: [],
      guidance: 'No Understand Anything graph exists. Use the pinned Understand Anything source/skill to run /understand once; later runs are incremental.',
    };
  }
  const graph = JSON.parse(fs.readFileSync(graphFile, 'utf8'));
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(term => term.length > 1);
  const strings = walkStrings(graph);
  const matches = strings.map(item => {
    const text = item.text.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (text === term) score += 10;
      else if (text.includes(term)) score += 3;
      if (item.path.toLowerCase().includes(term)) score += 2;
    }
    return { ...item, score };
  }).filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(Number(limit) || 20, 100)));
  return { status: graphStatus(root), matches };
};

const processAlive = pid => {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
};

export const viewerStatus = () => {
  if (!fs.existsSync(dashboardStateFile)) return { running: false, dashboardDir };
  try {
    const state = JSON.parse(fs.readFileSync(dashboardStateFile, 'utf8'));
    return { ...state, running: processAlive(state.pid), dashboardDir };
  } catch {
    return { running: false, dashboardDir };
  }
};

export const openViewer = async workspace => {
  const root = path.resolve(workspace || process.cwd());
  if (!graphStatus(root).exists) throw new Error('No .ua/knowledge-graph.json found. Run Understand Anything analysis first.');
  if (!fs.existsSync(dashboardDir)) throw new Error('Pinned Understand Anything source is not installed. Run install-forge-super-agent.bat first.');
  if (!fs.existsSync(path.join(pluginRoot, 'node_modules')) && !fs.existsSync(path.join(dashboardDir, 'node_modules'))) {
    throw new Error('Understand Anything dashboard dependencies are not installed. Run install-forge-super-agent.bat setup.');
  }

  const existing = viewerStatus();
  if (existing.running && existing.workspace === root) return existing;

  const invocation = pnpmInvocation();
  const child = spawn(invocation.command, [...invocation.prefix, 'exec', 'vite', '--host', '127.0.0.1'], {
    cwd: dashboardDir,
    env: { ...process.env, GRAPH_DIR: root },
    detached: true,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  const result = await new Promise((resolve, reject) => {
    let output = '';
    let settled = false;
    const finish = fn => value => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.stdout?.removeAllListeners('data');
      child.stderr?.removeAllListeners('data');
      fn(value);
    };
    const resolveOnce = finish(resolve);
    const rejectOnce = finish(reject);
    const timeout = setTimeout(() => {
      rejectOnce(new Error(`Understand Anything dashboard did not report a URL within 20 seconds. Output: ${output.slice(-4000)}`));
    }, 20_000);

    const inspect = chunk => {
      output += String(chunk || '');
      const tokenUrl = output.match(/Dashboard URL:\s*(http:\/\/127\.0\.0\.1:\d+\?token=[^\s]+)/i)?.[1];
      const viteUrl = output.match(/Local:\s*(http:\/\/localhost:\d+\/?)/i)?.[1]
        || output.match(/Local:\s*(http:\/\/127\.0\.0\.1:\d+\/?)/i)?.[1];
      const url = tokenUrl || viteUrl;
      if (url) resolveOnce({ url, output: output.slice(-6000) });
    };

    child.stdout?.on('data', inspect);
    child.stderr?.on('data', inspect);
    child.once('error', rejectOnce);
    child.once('exit', code => {
      if (!settled && code !== null) rejectOnce(new Error(`Understand Anything dashboard exited with code ${code}. ${output.slice(-4000)}`));
    });
  });

  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();
  const state = { pid: child.pid, workspace: root, url: result.url, startedAt: new Date().toISOString() };
  fs.mkdirSync(stateRoot, { recursive: true });
  fs.writeFileSync(dashboardStateFile, JSON.stringify(state, null, 2));
  return { ...state, running: true, dashboardDir };
};

export const stopViewer = () => {
  const state = viewerStatus();
  if (!state.pid || !state.running) return { stopped: false, reason: 'Understand Anything dashboard is not running.' };
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(state.pid), '/T', '/F'], { encoding: 'utf8', shell: false });
    if (result.status === 0) fs.rmSync(dashboardStateFile, { force: true });
    return { stopped: result.status === 0, pid: state.pid, stdout: String(result.stdout || ''), stderr: String(result.stderr || '') };
  }
  try {
    process.kill(-state.pid, 'SIGTERM');
    fs.rmSync(dashboardStateFile, { force: true });
    return { stopped: true, pid: state.pid };
  } catch (error) {
    return { stopped: false, pid: state.pid, error: error instanceof Error ? error.message : String(error) };
  }
};

const main = async () => {
  const [command = 'status', ...args] = process.argv.slice(2);
  const workspaceArg = args.find(arg => !arg.startsWith('--')) || process.cwd();
  if (command === 'status') return console.log(JSON.stringify(graphStatus(workspaceArg), null, 2));
  if (command === 'search') {
    const query = args.slice(1).join(' ');
    return console.log(JSON.stringify(searchGraph(workspaceArg, query), null, 2));
  }
  if (command === 'viewer') return console.log(JSON.stringify(await openViewer(workspaceArg), null, 2));
  if (command === 'viewer-status') return console.log(JSON.stringify(viewerStatus(), null, 2));
  if (command === 'viewer-stop') return console.log(JSON.stringify(stopViewer(), null, 2));
  console.log('Usage: node scripts/forge-understand.mjs <status|search|viewer|viewer-status|viewer-stop> [workspace] [query]');
  process.exitCode = 1;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

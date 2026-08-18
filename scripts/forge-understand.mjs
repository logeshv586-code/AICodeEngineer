import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dataDirOfWorkspace = workspace => {
  const preferred = path.join(workspace, '.ua');
  const legacy = path.join(workspace, '.understand-anything');
  if (fs.existsSync(preferred)) return preferred;
  if (fs.existsSync(legacy)) return legacy;
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
  if (!fs.existsSync(graphFile)) return { workspace: root, exists: false, graphFile };
  const stat = fs.statSync(graphFile);
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(graphFile, 'utf8')); } catch { parsed = null; }
  const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes.length : undefined;
  const edges = Array.isArray(parsed?.edges) ? parsed.edges.length : undefined;
  return { workspace: root, exists: true, graphFile, sizeBytes: stat.size, modifiedAt: stat.mtime.toISOString(), nodes, edges };
};

export const searchGraph = (workspace, query, limit = 20) => {
  const root = path.resolve(workspace || process.cwd());
  const graphFile = graphFileOfWorkspace(root);
  if (!fs.existsSync(graphFile)) {
    return {
      status: graphStatus(root),
      matches: [],
      guidance: 'No Understand Anything graph exists. Install the pinned integration and run its /understand skill once; later runs are incremental.',
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

export const openViewer = workspace => {
  const root = path.resolve(workspace || process.cwd());
  if (!graphStatus(root).exists) throw new Error('No .ua/knowledge-graph.json found. Run Understand Anything analysis first.');
  const result = spawnSync('npx', [
    'https://github.com/Egonex-AI/Understand-Anything/releases/latest/download/understand-anything-viewer.tgz',
    root,
  ], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  return { exitCode: result.status };
};

const main = () => {
  const [command = 'status', ...args] = process.argv.slice(2);
  const workspaceArg = args.find(arg => !arg.startsWith('--')) || process.cwd();
  if (command === 'status') return console.log(JSON.stringify(graphStatus(workspaceArg), null, 2));
  if (command === 'search') {
    const query = args.slice(1).join(' ');
    return console.log(JSON.stringify(searchGraph(workspaceArg, query), null, 2));
  }
  if (command === 'viewer') return console.log(JSON.stringify(openViewer(workspaceArg), null, 2));
  console.log('Usage: node scripts/forge-understand.mjs <status|search|viewer> [workspace] [query]');
  process.exitCode = 1;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

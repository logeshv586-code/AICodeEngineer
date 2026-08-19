import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FORGE_NODE_VERSION = fs.readFileSync(path.join(repoRoot, '.nvmrc'), 'utf8').trim();

if (!/^20\./.test(FORGE_NODE_VERSION)) {
  throw new Error(`Forge setup runtime must stay on Node 20; .nvmrc currently contains '${FORGE_NODE_VERSION}'.`);
}

const runtimeHome = path.resolve(process.env.FORGE_RUNTIME_HOME || path.join(os.homedir(), '.forge', 'runtimes'));
const platformToken = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'darwin' : process.platform === 'linux' ? 'linux' : null;
const archToken = process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : null;

const archiveSpec = () => {
  if (!platformToken || !archToken) throw new Error(`Forge Node 20 runtime does not support ${process.platform}/${process.arch}.`);
  if (platformToken === 'win') return { file: `node-v${FORGE_NODE_VERSION}-win-${archToken}.zip`, folder: `node-v${FORGE_NODE_VERSION}-win-${archToken}`, kind: 'zip' };
  if (platformToken === 'linux') return { file: `node-v${FORGE_NODE_VERSION}-linux-${archToken}.tar.xz`, folder: `node-v${FORGE_NODE_VERSION}-linux-${archToken}`, kind: 'tar' };
  return { file: `node-v${FORGE_NODE_VERSION}-darwin-${archToken}.tar.gz`, folder: `node-v${FORGE_NODE_VERSION}-darwin-${archToken}`, kind: 'tar' };
};

const runtimeRoot = path.join(runtimeHome, `node-v${FORGE_NODE_VERSION}`);
const extractedRoot = () => path.join(runtimeRoot, archiveSpec().folder);
export const forgeNodePath = () => process.env.FORGE_NODE20_PATH || (process.platform === 'win32' ? path.join(extractedRoot(), 'node.exe') : path.join(extractedRoot(), 'bin', 'node'));
export const forgeNpmCliPath = () => process.platform === 'win32'
  ? path.join(extractedRoot(), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  : path.join(extractedRoot(), 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');

const request = url => new Promise((resolve, reject) => {
  const visit = target => {
    https.get(target, response => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        visit(new URL(response.headers.location, target).toString());
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed (${response.statusCode}) for ${target}`));
        return;
      }
      resolve(response);
    }).on('error', reject);
  };
  visit(url);
});

const downloadText = async url => {
  const response = await request(url);
  const chunks = [];
  for await (const chunk of response) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

const downloadFile = async (url, destination) => {
  const response = await request(url);
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  const temp = `${destination}.part-${process.pid}`;
  const out = fs.createWriteStream(temp);
  await new Promise((resolve, reject) => {
    response.pipe(out);
    response.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
  });
  await fs.promises.rename(temp, destination);
};

const sha256 = filePath => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  stream.on('data', chunk => hash.update(chunk));
  stream.on('error', reject);
  stream.on('end', () => resolve(hash.digest('hex')));
});

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, ...(options.env || {}) },
    stdio: options.stdio || 'pipe',
    timeout: options.timeout || 30 * 60_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = String(result.stderr || '').trim();
    const stdout = String(result.stdout || '').trim();
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}: ${stderr || stdout}`);
  }
  return result;
};

export const ensureForgeNode20Runtime = async () => {
  const configured = process.env.FORGE_NODE20_PATH;
  if (configured) {
    if (!fs.existsSync(configured)) throw new Error(`FORGE_NODE20_PATH does not exist: ${configured}`);
    const version = String(run(configured, ['--version']).stdout || '').trim();
    if (version !== `v${FORGE_NODE_VERSION}`) throw new Error(`FORGE_NODE20_PATH must be Node v${FORGE_NODE_VERSION}; found ${version || 'unknown'}.`);
    return configured;
  }

  const existing = forgeNodePath();
  if (fs.existsSync(existing)) {
    const version = String(run(existing, ['--version']).stdout || '').trim();
    if (version === `v${FORGE_NODE_VERSION}` && fs.existsSync(forgeNpmCliPath())) return existing;
  }

  const spec = archiveSpec();
  const base = `https://nodejs.org/dist/v${FORGE_NODE_VERSION}`;
  const archivePath = path.join(runtimeRoot, spec.file);
  await fs.promises.mkdir(runtimeRoot, { recursive: true });
  console.error(`[forge-node20] Downloading Node.js v${FORGE_NODE_VERSION} for ${platformToken}-${archToken}...`);
  await downloadFile(`${base}/${spec.file}`, archivePath);

  const sums = await downloadText(`${base}/SHASUMS256.txt`);
  const expected = sums.split(/\r?\n/).map(line => line.trim().split(/\s+/)).find(parts => parts.at(-1) === spec.file)?.[0];
  if (!expected) throw new Error(`Could not find ${spec.file} in Node.js SHASUMS256.txt.`);
  const actual = await sha256(archivePath);
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    await fs.promises.rm(archivePath, { force: true });
    throw new Error(`Node.js archive checksum mismatch for ${spec.file}.`);
  }

  await fs.promises.rm(extractedRoot(), { recursive: true, force: true });
  if (spec.kind === 'zip') {
    const escapedArchive = archivePath.replace(/'/g, "''");
    const escapedDestination = runtimeRoot.replace(/'/g, "''");
    run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${escapedArchive}' -DestinationPath '${escapedDestination}' -Force`], { timeout: 10 * 60_000 });
  } else {
    run('tar', ['-xf', archivePath, '-C', runtimeRoot], { timeout: 10 * 60_000 });
  }
  await fs.promises.rm(archivePath, { force: true });

  const version = String(run(forgeNodePath(), ['--version']).stdout || '').trim();
  if (version !== `v${FORGE_NODE_VERSION}`) throw new Error(`Installed Forge Node runtime failed verification: expected v${FORGE_NODE_VERSION}, got ${version}.`);
  if (!fs.existsSync(forgeNpmCliPath())) throw new Error(`Installed Forge Node runtime is missing npm CLI: ${forgeNpmCliPath()}`);
  return forgeNodePath();
};

const main = async () => {
  const [command = 'status'] = process.argv.slice(2);
  if (command === 'ensure') {
    const node = await ensureForgeNode20Runtime();
    process.stdout.write(`${node}\n`);
    return;
  }
  if (command === 'status') {
    console.log(JSON.stringify({
      version: FORGE_NODE_VERSION,
      nodePath: forgeNodePath(),
      npmCliPath: forgeNpmCliPath(),
      installed: fs.existsSync(forgeNodePath()) && fs.existsSync(forgeNpmCliPath()),
    }, null, 2));
    return;
  }
  throw new Error('Usage: node scripts/forge-node20-runtime.mjs <status|ensure>');
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`[forge-node20] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

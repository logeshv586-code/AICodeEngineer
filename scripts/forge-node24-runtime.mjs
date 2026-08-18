import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const NODE24_VERSION = '24.19.0';
export const OPEN_DESIGN_PNPM_VERSION = '10.33.2';

const runtimeHome = path.resolve(process.env.FORGE_RUNTIME_HOME || path.join(os.homedir(), '.forge', 'runtimes'));
const runtimeRoot = path.join(runtimeHome, `node-v${NODE24_VERSION}`);
const pnpmRoot = path.join(runtimeHome, `pnpm-${OPEN_DESIGN_PNPM_VERSION}-node24`);

const platformToken = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'darwin' : process.platform === 'linux' ? 'linux' : null;
const archToken = process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : null;

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

const archiveSpec = () => {
  if (!platformToken || !archToken) throw new Error(`Forge Open Design runtime does not support ${process.platform}/${process.arch}. Install Node 24 manually and set FORGE_NODE24_PATH.`);
  if (platformToken === 'win') return { file: `node-v${NODE24_VERSION}-win-${archToken}.zip`, folder: `node-v${NODE24_VERSION}-win-${archToken}`, kind: 'zip' };
  if (platformToken === 'linux') return { file: `node-v${NODE24_VERSION}-linux-${archToken}.tar.xz`, folder: `node-v${NODE24_VERSION}-linux-${archToken}`, kind: 'tar' };
  return { file: `node-v${NODE24_VERSION}-darwin-${archToken}.tar.gz`, folder: `node-v${NODE24_VERSION}-darwin-${archToken}`, kind: 'tar' };
};

const extractedRoot = () => path.join(runtimeRoot, archiveSpec().folder);
export const node24Path = () => process.env.FORGE_NODE24_PATH || (process.platform === 'win32' ? path.join(extractedRoot(), 'node.exe') : path.join(extractedRoot(), 'bin', 'node'));
const npmCliPath = () => path.join(extractedRoot(), 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
const npmCliPathWin = () => path.join(extractedRoot(), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const pnpmCliPath = () => path.join(pnpmRoot, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs');

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

export const ensureNode24Runtime = async () => {
  const configured = process.env.FORGE_NODE24_PATH;
  if (configured) {
    if (!fs.existsSync(configured)) throw new Error(`FORGE_NODE24_PATH does not exist: ${configured}`);
    const version = String(run(configured, ['--version']).stdout || '').trim();
    if (!version.startsWith('v24.')) throw new Error(`FORGE_NODE24_PATH must point to Node 24, found ${version || 'unknown'}.`);
    return configured;
  }

  const existing = node24Path();
  if (fs.existsSync(existing)) {
    const version = String(run(existing, ['--version']).stdout || '').trim();
    if (version === `v${NODE24_VERSION}`) return existing;
  }

  const spec = archiveSpec();
  const base = `https://nodejs.org/dist/v${NODE24_VERSION}`;
  const archivePath = path.join(runtimeRoot, spec.file);
  await fs.promises.mkdir(runtimeRoot, { recursive: true });
  console.log(`[forge-node24] Downloading Node.js v${NODE24_VERSION} for ${platformToken}-${archToken}...`);
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

  const version = String(run(node24Path(), ['--version']).stdout || '').trim();
  if (version !== `v${NODE24_VERSION}`) throw new Error(`Installed Node runtime failed verification: expected v${NODE24_VERSION}, got ${version}.`);
  return node24Path();
};

export const ensureOpenDesignPnpm = async () => {
  const node = await ensureNode24Runtime();
  const cli = pnpmCliPath();
  if (fs.existsSync(cli)) {
    const version = String(run(node, [cli, '--version']).stdout || '').trim();
    if (version === OPEN_DESIGN_PNPM_VERSION) return { node, pnpmCli: cli };
  }

  await fs.promises.mkdir(pnpmRoot, { recursive: true });
  const npmCli = process.platform === 'win32' ? npmCliPathWin() : npmCliPath();
  if (!fs.existsSync(npmCli)) throw new Error(`The local Node 24 runtime is missing npm CLI: ${npmCli}`);
  console.log(`[forge-node24] Installing pnpm ${OPEN_DESIGN_PNPM_VERSION} for Open Design...`);
  run(node, [npmCli, 'install', '--prefix', pnpmRoot, `pnpm@${OPEN_DESIGN_PNPM_VERSION}`, '--no-audit', '--no-fund'], { timeout: 10 * 60_000 });
  const version = String(run(node, [cli, '--version']).stdout || '').trim();
  if (version !== OPEN_DESIGN_PNPM_VERSION) throw new Error(`pnpm verification failed: expected ${OPEN_DESIGN_PNPM_VERSION}, got ${version}.`);
  return { node, pnpmCli: cli };
};

export const runOpenDesignPnpm = async (args, options = {}) => {
  const { node, pnpmCli } = await ensureOpenDesignPnpm();
  return run(node, [pnpmCli, ...args], options);
};

export const openDesignRuntimeStatus = () => ({
  nodeVersion: NODE24_VERSION,
  nodePath: node24Path(),
  nodeInstalled: fs.existsSync(node24Path()),
  pnpmVersion: OPEN_DESIGN_PNPM_VERSION,
  pnpmPath: pnpmCliPath(),
  pnpmInstalled: fs.existsSync(pnpmCliPath()),
  runtimeRoot,
});

const main = async () => {
  const [command = 'status', ...args] = process.argv.slice(2);
  if (command === 'status') {
    console.log(JSON.stringify(openDesignRuntimeStatus(), null, 2));
    return;
  }
  if (command === 'ensure') {
    await ensureOpenDesignPnpm();
    console.log(JSON.stringify(openDesignRuntimeStatus(), null, 2));
    return;
  }
  if (command === 'pnpm') {
    const cwdIndex = args.indexOf('--cwd');
    const separator = args.indexOf('--');
    const cwd = cwdIndex >= 0 ? args[cwdIndex + 1] : process.cwd();
    const commandArgs = separator >= 0 ? args.slice(separator + 1) : args.filter((_, index) => index !== cwdIndex && index !== cwdIndex + 1);
    if (!commandArgs.length) throw new Error('Usage: node scripts/forge-node24-runtime.mjs pnpm --cwd <path> -- <pnpm args>');
    const result = await runOpenDesignPnpm(commandArgs, { cwd, stdio: 'pipe' });
    if (result.stdout) process.stdout.write(String(result.stdout));
    if (result.stderr) process.stderr.write(String(result.stderr));
    return;
  }
  throw new Error('Usage: node scripts/forge-node24-runtime.mjs <status|ensure|pnpm> [--cwd <path> -- <pnpm args>]');
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`[forge-node24] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

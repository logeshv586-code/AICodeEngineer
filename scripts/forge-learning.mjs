import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const integrationsRoot = process.env.FORGE_INTEGRATIONS_HOME || path.join(os.homedir(), '.forge', 'integrations');
const learningRoot = process.env.FORGE_LEARNING_HOME || path.join(os.homedir(), '.forge', 'learning');
const traceFile = path.join(learningRoot, 'coding-traces.jsonl');

const secretKeyPattern = /(api.?key|token|secret|password|credential|authorization|cookie)/i;
const secretValuePattern = /(sk-[a-z0-9_-]{12,}|gh[pousr]_[a-z0-9]{20,}|nvapi-[a-z0-9_-]{12,}|bearer\s+[a-z0-9._-]{12,})/ig;

const sanitize = (value, key = '') => {
  if (secretKeyPattern.test(key)) return '[redacted]';
  if (typeof value === 'string') return value.replace(secretValuePattern, '[redacted]');
  if (Array.isArray(value)) return value.map(item => sanitize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey)]));
  }
  return value;
};

export const recordLearningTrace = input => {
  fs.mkdirSync(learningRoot, { recursive: true });
  const trace = sanitize({
    timestamp: new Date().toISOString(),
    task: input.task,
    outcome: input.outcome,
    reward: typeof input.reward === 'number' ? input.reward : undefined,
    model: input.model,
    skills: input.skills,
    changedFiles: input.changedFiles,
    tests: input.tests,
    notes: input.notes,
  });
  fs.appendFileSync(traceFile, `${JSON.stringify(trace)}\n`);
  return { path: traceFile, trace };
};

const skillOptExecutable = () => {
  const root = path.join(integrationsRoot, 'skillopt', '.forge-venv');
  const candidates = process.platform === 'win32'
    ? [path.join(root, 'Scripts', 'skillopt-sleep.exe'), path.join(root, 'Scripts', 'skillopt-sleep')]
    : [path.join(root, 'bin', 'skillopt-sleep')];
  return candidates.find(fs.existsSync) || 'skillopt-sleep';
};

export const skillOptSleep = (action = 'status', options = {}) => {
  const allowed = new Set(['status', 'dry-run', 'run']);
  if (!allowed.has(action)) throw new Error(`Unsupported SkillOpt-Sleep action: ${action}`);
  const args = [action];
  if (options.workspace) args.push('--workspace', path.resolve(options.workspace));
  const result = spawnSync(skillOptExecutable(), args, {
    cwd: options.workspace || process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 20 * 60_000,
  });
  return {
    action,
    exitCode: result.status,
    stdout: String(result.stdout || '').slice(-30_000),
    stderr: String(result.stderr || '').slice(-12_000),
  };
};

export const learningStatus = () => ({
  traceFile,
  traceBytes: fs.existsSync(traceFile) ? fs.statSync(traceFile).size : 0,
  skillopt: {
    source: path.join(integrationsRoot, 'skillopt'),
    installed: fs.existsSync(path.join(integrationsRoot, 'skillopt')),
  },
  agentLightning: {
    source: path.join(integrationsRoot, 'agent-lightning'),
    installed: fs.existsSync(path.join(integrationsRoot, 'agent-lightning')),
    note: 'Training is deliberately offline/opt-in because Agent Lightning commonly requires a dedicated GPU training environment.',
  },
});

const main = () => {
  const [command = 'status', ...args] = process.argv.slice(2);
  if (command === 'status') return console.log(JSON.stringify(learningStatus(), null, 2));
  if (command === 'record') {
    const jsonIndex = args.indexOf('--json');
    if (jsonIndex === -1 || !args[jsonIndex + 1]) throw new Error('Use: record --json <trace-json>');
    return console.log(JSON.stringify(recordLearningTrace(JSON.parse(args[jsonIndex + 1])), null, 2));
  }
  if (command === 'sleep') return console.log(JSON.stringify(skillOptSleep(args[0] || 'status', { workspace: args[1] }), null, 2));
  console.log('Usage: node scripts/forge-learning.mjs <status|record|sleep>');
  process.exitCode = 1;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

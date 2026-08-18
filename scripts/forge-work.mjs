import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workRoot = process.env.FORGE_WORK_HOME || path.join(os.homedir(), '.forge', 'work');
const tasksFile = path.join(workRoot, 'tasks.json');
const pendingFile = path.join(workRoot, 'pending.json');
const historyFile = path.join(workRoot, 'history.jsonl');

const loadStore = () => {
  if (!fs.existsSync(tasksFile)) return { schemaVersion: 2, tasks: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
    return { schemaVersion: 2, tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] };
  } catch {
    return { schemaVersion: 2, tasks: [] };
  }
};

const saveStore = store => {
  fs.mkdirSync(workRoot, { recursive: true });
  fs.writeFileSync(tasksFile, JSON.stringify({ ...store, schemaVersion: 2 }, null, 2));
};

const loadPending = () => {
  if (!fs.existsSync(pendingFile)) return { schemaVersion: 1, items: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
    return { schemaVersion: 1, items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return { schemaVersion: 1, items: [] };
  }
};

const savePending = store => {
  fs.mkdirSync(workRoot, { recursive: true });
  fs.writeFileSync(pendingFile, JSON.stringify(store, null, 2));
};

const appendHistory = event => {
  fs.mkdirSync(workRoot, { recursive: true });
  fs.appendFileSync(historyFile, `${JSON.stringify(event)}\n`);
};

const makeId = title => `${String(title || 'task').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'task'}-${Date.now().toString(36)}`;

const cronFieldMatches = (value, field) => {
  if (field === '*') return true;
  if (field.startsWith('*/')) {
    const step = Number(field.slice(2));
    return Number.isFinite(step) && step > 0 && value % step === 0;
  }
  return field.split(',').some(part => {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      return Number.isFinite(start) && Number.isFinite(end) && value >= start && value <= end;
    }
    return Number(part) === value;
  });
};

const cronMatches = (expression, date) => {
  const fields = String(expression || '').trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const [minute, hour, day, month, weekday] = fields;
  return cronFieldMatches(date.getMinutes(), minute)
    && cronFieldMatches(date.getHours(), hour)
    && cronFieldMatches(date.getDate(), day)
    && cronFieldMatches(date.getMonth() + 1, month)
    && cronFieldMatches(date.getDay(), weekday);
};

const isDue = (task, now = new Date()) => {
  if (!task.enabled) return false;
  const schedule = task.schedule || { type: 'manual' };
  if (schedule.type === 'manual') return false;
  if (schedule.type === 'once') return !task.lastRunAt && new Date(schedule.at).getTime() <= now.getTime();
  if (schedule.type === 'interval') {
    const everyMs = Math.max(60_000, Number(schedule.everyMs) || 0);
    const last = task.lastRunAt ? new Date(task.lastRunAt).getTime() : 0;
    const start = schedule.startAt ? new Date(schedule.startAt).getTime() : 0;
    return now.getTime() >= start && now.getTime() - last >= everyMs;
  }
  if (schedule.type === 'cron') {
    if (!cronMatches(schedule.expression, now)) return false;
    const minuteKey = now.toISOString().slice(0, 16);
    return task.lastCronMinute !== minuteKey;
  }
  return false;
};

const markScheduled = (task, now = new Date()) => {
  task.lastRunAt = now.toISOString();
  if (task.schedule?.type === 'cron') task.lastCronMinute = now.toISOString().slice(0, 16);
  if (task.schedule?.type === 'once') task.enabled = false;
};

export const listWorkflows = () => loadStore().tasks;
export const listPendingWork = () => loadPending().items;

export const addWorkflow = input => {
  const store = loadStore();
  const task = {
    id: input.id || makeId(input.title),
    title: input.title || 'Forge Work Task',
    kind: input.kind === 'command' ? 'command' : 'prompt',
    prompt: input.prompt || undefined,
    command: input.command || undefined,
    cwd: input.cwd || undefined,
    schedule: input.schedule || { type: 'manual' },
    unattended: input.unattended === true,
    enabled: input.enabled !== false,
    createdAt: new Date().toISOString(),
    lastRunAt: null,
    lastResult: null,
  };
  if (task.kind === 'command' && !task.command) throw new Error('Command workflow requires command.');
  if (task.kind === 'prompt' && !task.prompt) throw new Error('Prompt workflow requires prompt.');
  store.tasks.push(task);
  saveStore(store);
  return task;
};

export const removeWorkflow = id => {
  const store = loadStore();
  const before = store.tasks.length;
  store.tasks = store.tasks.filter(task => task.id !== id);
  saveStore(store);
  const pending = loadPending();
  pending.items = pending.items.filter(item => item.taskId !== id);
  savePending(pending);
  return before !== store.tasks.length;
};

export const runWorkflow = (id, options = {}) => {
  const store = loadStore();
  const task = store.tasks.find(item => item.id === id);
  if (!task) throw new Error(`Unknown workflow: ${id}`);

  let result;
  if (task.kind === 'prompt') {
    result = {
      status: 'agent_required',
      prompt: task.prompt,
      message: 'Execute this prompt in Forge using the normal model/tool agent loop.',
    };
  } else if (!task.unattended && !options.approved) {
    result = {
      status: 'approval_required',
      command: task.command,
      message: 'Command workflows require explicit approval unless unattended=true.',
    };
  } else {
    const commandResult = spawnSync(task.command, {
      cwd: task.cwd || process.cwd(),
      shell: true,
      encoding: 'utf8',
      timeout: Math.max(5_000, Math.min(Number(options.timeoutMs) || 120_000, 900_000)),
    });
    result = {
      status: commandResult.status === 0 ? 'completed' : 'failed',
      exitCode: commandResult.status,
      stdout: String(commandResult.stdout || '').slice(-20_000),
      stderr: String(commandResult.stderr || '').slice(-20_000),
    };
  }

  if (result.status !== 'approval_required') {
    const now = new Date();
    markScheduled(task, now);
    task.lastResult = result;
    saveStore(store);
    appendHistory({ type: 'run', taskId: task.id, at: now.toISOString(), result });
  }
  return { task, result };
};

const enqueuePending = (task, status, now) => {
  const pending = loadPending();
  const existing = pending.items.find(item => item.taskId === task.id && item.status === status);
  if (existing) return existing;
  const item = {
    id: `${task.id}-${now.getTime().toString(36)}`,
    taskId: task.id,
    title: task.title,
    kind: task.kind,
    status,
    prompt: task.prompt,
    command: task.command,
    cwd: task.cwd,
    createdAt: now.toISOString(),
  };
  pending.items.push(item);
  savePending(pending);
  appendHistory({ type: 'queued', taskId: task.id, pendingId: item.id, at: now.toISOString(), status });
  return item;
};

export const ackPendingWork = (id, result = {}) => {
  const pending = loadPending();
  const item = pending.items.find(candidate => candidate.id === id);
  if (!item) throw new Error(`Unknown pending work item: ${id}`);
  pending.items = pending.items.filter(candidate => candidate.id !== id);
  savePending(pending);
  appendHistory({ type: 'ack', taskId: item.taskId, pendingId: id, at: new Date().toISOString(), result });
  return { acknowledged: true, item, result };
};

export const tickWorkflows = (options = {}) => {
  const store = loadStore();
  const now = new Date();
  const due = store.tasks.filter(task => isDue(task, now));
  const outputs = [];

  for (const task of due) {
    if (task.kind === 'command' && task.unattended) {
      outputs.push(runWorkflow(task.id, { approved: true, timeoutMs: options.timeoutMs }));
      continue;
    }

    const status = task.kind === 'prompt' ? 'agent_required' : 'approval_required';
    const item = enqueuePending(task, status, now);
    markScheduled(task, now);
    task.lastResult = { status, pendingId: item.id };
    outputs.push({ task, result: { status, pendingId: item.id, prompt: task.prompt, command: task.command } });
  }

  if (due.some(task => !(task.kind === 'command' && task.unattended))) saveStore(store);
  return outputs;
};

const main = () => {
  const [command = 'list', ...args] = process.argv.slice(2);
  if (command === 'list') return console.log(JSON.stringify(listWorkflows(), null, 2));
  if (command === 'pending') return console.log(JSON.stringify(listPendingWork(), null, 2));
  if (command === 'tick') return console.log(JSON.stringify(tickWorkflows(), null, 2));
  if (command === 'remove') return console.log(JSON.stringify({ removed: removeWorkflow(args[0]) }));
  if (command === 'run') return console.log(JSON.stringify(runWorkflow(args[0], { approved: args.includes('--approve') }), null, 2));
  if (command === 'ack') return console.log(JSON.stringify(ackPendingWork(args[0], { note: args.slice(1).join(' ') }), null, 2));
  if (command === 'add') {
    const payloadIndex = args.indexOf('--json');
    if (payloadIndex === -1 || !args[payloadIndex + 1]) throw new Error('Use: add --json <task-json>');
    return console.log(JSON.stringify(addWorkflow(JSON.parse(args[payloadIndex + 1])), null, 2));
  }
  console.log('Usage: node scripts/forge-work.mjs <list|pending|tick|add|run|ack|remove>');
  process.exitCode = 1;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

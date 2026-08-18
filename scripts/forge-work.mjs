import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workRoot = process.env.FORGE_WORK_HOME || path.join(os.homedir(), '.forge', 'work');
const tasksFile = path.join(workRoot, 'tasks.json');
const pendingFile = path.join(workRoot, 'pending.json');
const pendingLockFile = path.join(workRoot, 'pending.lock');
const historyFile = path.join(workRoot, 'history.jsonl');
const CLAIM_LEASE_MS = 10 * 60_000;
const LOCK_STALE_MS = 30_000;

const loadStore = () => {
  if (!fs.existsSync(tasksFile)) return { schemaVersion: 3, tasks: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
    return { schemaVersion: 3, tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] };
  } catch {
    return { schemaVersion: 3, tasks: [] };
  }
};

const saveStore = store => {
  fs.mkdirSync(workRoot, { recursive: true });
  fs.writeFileSync(tasksFile, JSON.stringify({ ...store, schemaVersion: 3 }, null, 2));
};

const normalizePendingItem = item => ({
  ...item,
  workflowId: item.workflowId || item.taskId,
  taskId: undefined,
  claim: item.claim || null,
});

const loadPending = () => {
  if (!fs.existsSync(pendingFile)) return { schemaVersion: 2, items: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
    return {
      schemaVersion: 2,
      items: Array.isArray(parsed.items) ? parsed.items.map(normalizePendingItem) : [],
    };
  } catch {
    return { schemaVersion: 2, items: [] };
  }
};

const savePending = store => {
  fs.mkdirSync(workRoot, { recursive: true });
  fs.writeFileSync(pendingFile, JSON.stringify({ ...store, schemaVersion: 2 }, null, 2));
};

const appendHistory = event => {
  fs.mkdirSync(workRoot, { recursive: true });
  fs.appendFileSync(historyFile, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
};

const acquirePendingLock = () => {
  fs.mkdirSync(workRoot, { recursive: true });
  const tryOpen = () => {
    try {
      const fd = fs.openSync(pendingLockFile, 'wx');
      fs.writeFileSync(fd, `${process.pid}\n${new Date().toISOString()}\n`);
      return fd;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      return null;
    }
  };

  let fd = tryOpen();
  if (fd !== null) return fd;
  try {
    if (Date.now() - fs.statSync(pendingLockFile).mtimeMs > LOCK_STALE_MS) {
      fs.rmSync(pendingLockFile, { force: true });
      fd = tryOpen();
    }
  } catch { /* the other process may already have released it */ }
  return fd;
};

const withPendingLock = callback => {
  const fd = acquirePendingLock();
  if (fd === null) return { locked: false, value: null };
  try {
    return { locked: true, value: callback() };
  } finally {
    try { fs.closeSync(fd); } catch { /* ignore */ }
    try { fs.rmSync(pendingLockFile, { force: true }); } catch { /* ignore */ }
  }
};

const makeId = title => `${String(title || 'task').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'task'}-${Date.now().toString(36)}`;
const makePendingId = task => `${task.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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
    return task.lastCronMinute !== now.toISOString().slice(0, 16);
  }
  return false;
};

const markScheduled = (task, now, result) => {
  task.lastRunAt = now.toISOString();
  if (task.schedule?.type === 'cron') task.lastCronMinute = now.toISOString().slice(0, 16);
  if (task.schedule?.type === 'once') task.enabled = false;
  task.lastResult = result;
};

const claimIsActive = item => {
  const expiresAt = item?.claim?.expiresAt ? new Date(item.claim.expiresAt).getTime() : 0;
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
};

const enqueuePending = (task, status, now) => {
  const result = withPendingLock(() => {
    const pending = loadPending();
    const existing = pending.items.find(item => item.workflowId === task.id && item.status === status && !claimIsActive(item));
    if (existing) return existing;
    const item = {
      id: makePendingId(task),
      workflowId: task.id,
      title: task.title,
      kind: task.kind,
      status,
      prompt: task.prompt,
      command: task.command,
      cwd: task.cwd,
      createdAt: now.toISOString(),
      scheduledFor: now.toISOString(),
      claim: null,
    };
    pending.items.push(item);
    savePending(pending);
    appendHistory({ type: 'queued', workflowId: task.id, pendingId: item.id, status });
    return item;
  });
  if (!result.locked) throw new Error('Work Mode pending queue is busy.');
  return result.value;
};

export const listWorkflows = () => loadStore().tasks;
export const listPendingWork = () => loadPending().items.filter(item => !claimIsActive(item));

export const workStatus = () => {
  const pending = loadPending().items;
  const available = pending.filter(item => !claimIsActive(item));
  return {
    workRoot,
    tasksFile,
    pendingFile,
    historyFile,
    taskCount: loadStore().tasks.length,
    pendingCount: available.length,
    claimedCount: pending.length - available.length,
    totalPendingCount: pending.length,
  };
};

export const claimPendingWork = (id, options = {}) => {
  if (!id) return null;
  const claimant = String(options.claimant || `forge-${process.pid}`);
  const leaseMs = Math.max(60_000, Math.min(Number(options.leaseMs) || CLAIM_LEASE_MS, 60 * 60_000));
  const result = withPendingLock(() => {
    const pending = loadPending();
    const item = pending.items.find(candidate => candidate.id === id);
    if (!item) return null;
    if (claimIsActive(item) && item.claim?.claimant !== claimant) return null;
    const claimedAt = new Date();
    item.claim = {
      claimant,
      claimedAt: claimedAt.toISOString(),
      expiresAt: new Date(claimedAt.getTime() + leaseMs).toISOString(),
    };
    savePending(pending);
    appendHistory({ type: 'claimed', workflowId: item.workflowId, pendingId: id, claimant, expiresAt: item.claim.expiresAt });
    return { ...item };
  });
  return result.locked ? result.value : null;
};

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
  if (store.tasks.some(existing => existing.id === task.id)) throw new Error(`Workflow already exists: ${task.id}`);
  store.tasks.push(task);
  saveStore(store);
  appendHistory({ type: 'created', workflowId: task.id, title: task.title, schedule: task.schedule });
  return task;
};

export const removeWorkflow = id => {
  const store = loadStore();
  const before = store.tasks.length;
  store.tasks = store.tasks.filter(task => task.id !== id);
  saveStore(store);
  withPendingLock(() => {
    const pending = loadPending();
    pending.items = pending.items.filter(item => item.workflowId !== id);
    savePending(pending);
  });
  const removed = before !== store.tasks.length;
  if (removed) appendHistory({ type: 'removed', workflowId: id });
  return removed;
};

export const runWorkflow = (id, options = {}) => {
  const store = loadStore();
  const task = store.tasks.find(item => item.id === id);
  if (!task) throw new Error(`Unknown workflow: ${id}`);

  let result;
  if (task.kind === 'prompt') {
    if (options.enqueue === true) {
      const item = enqueuePending(task, 'agent_required', new Date());
      result = { status: 'queued', pendingId: item.id, prompt: task.prompt };
    } else {
      result = { status: 'agent_required', prompt: task.prompt, message: 'Execute this prompt in Forge using the normal model/tool agent loop.' };
    }
  } else if (!task.unattended && !options.approved) {
    if (options.enqueue === true) {
      const item = enqueuePending(task, 'approval_required', new Date());
      result = { status: 'queued', pendingId: item.id, command: task.command };
    } else {
      result = { status: 'approval_required', command: task.command, message: 'Command workflows require explicit approval unless unattended=true.' };
    }
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

  if (options.markRun !== false && result.status !== 'approval_required') {
    const now = new Date();
    markScheduled(task, now, result);
    saveStore(store);
  }
  appendHistory({ type: 'run', workflowId: task.id, result });
  return { task, result };
};

export const ackPendingWork = (id, result = {}) => {
  if (!id) throw new Error('Pending work acknowledgement requires id.');
  const locked = withPendingLock(() => {
    const pending = loadPending();
    const item = pending.items.find(candidate => candidate.id === id);
    if (!item) return null;
    pending.items = pending.items.filter(candidate => candidate.id !== id);
    savePending(pending);
    appendHistory({ type: 'acknowledged', workflowId: item.workflowId, pendingId: id, result });
    return { acknowledged: true, item, result };
  });
  if (!locked.locked) throw new Error('Work Mode pending queue is busy.');
  return locked.value;
};

export const tickWorkflows = (options = {}) => {
  const store = loadStore();
  const now = options.now ? new Date(options.now) : new Date();
  const due = store.tasks.filter(task => isDue(task, now));
  const outputs = [];

  for (const task of due) {
    if (task.kind === 'command' && task.unattended) {
      const commandResult = spawnSync(task.command, {
        cwd: task.cwd || process.cwd(),
        shell: true,
        encoding: 'utf8',
        timeout: Math.max(5_000, Math.min(Number(options.timeoutMs) || 120_000, 900_000)),
      });
      const result = {
        status: commandResult.status === 0 ? 'completed' : 'failed',
        exitCode: commandResult.status,
        stdout: String(commandResult.stdout || '').slice(-20_000),
        stderr: String(commandResult.stderr || '').slice(-20_000),
      };
      markScheduled(task, now, result);
      appendHistory({ type: 'scheduled_run', workflowId: task.id, result });
      outputs.push({ task: { ...task }, result });
      continue;
    }

    try {
      const status = task.kind === 'prompt' ? 'agent_required' : 'approval_required';
      const item = enqueuePending(task, status, now);
      const result = { status: 'queued', pendingId: item.id, prompt: task.prompt, command: task.command };
      markScheduled(task, now, result);
      outputs.push({ task: { ...task }, result });
    } catch (error) {
      outputs.push({ task: { ...task }, result: { status: 'queue_busy', error: error instanceof Error ? error.message : String(error) } });
    }
  }

  saveStore(store);
  return outputs;
};

const main = () => {
  const [command = 'list', ...args] = process.argv.slice(2);
  if (command === 'status') return console.log(JSON.stringify(workStatus(), null, 2));
  if (command === 'list') return console.log(JSON.stringify(listWorkflows(), null, 2));
  if (command === 'pending') return console.log(JSON.stringify(listPendingWork(), null, 2));
  if (command === 'tick') return console.log(JSON.stringify(tickWorkflows(), null, 2));
  if (command === 'remove') return console.log(JSON.stringify({ removed: removeWorkflow(args[0]) }));
  if (command === 'run') return console.log(JSON.stringify(runWorkflow(args[0], { approved: args.includes('--approve'), enqueue: args.includes('--enqueue') }), null, 2));
  if (command === 'claim') {
    const claimantIndex = args.indexOf('--claimant');
    return console.log(JSON.stringify(claimPendingWork(args[0], { claimant: claimantIndex >= 0 ? args[claimantIndex + 1] : undefined }), null, 2));
  }
  if (command === 'ack') {
    const jsonIndex = args.indexOf('--json');
    const result = jsonIndex >= 0 && args[jsonIndex + 1] ? JSON.parse(args[jsonIndex + 1]) : { status: 'completed' };
    return console.log(JSON.stringify(ackPendingWork(args[0], result), null, 2));
  }
  if (command === 'add') {
    const payloadIndex = args.indexOf('--json');
    if (payloadIndex === -1 || !args[payloadIndex + 1]) throw new Error('Use: add --json <task-json>');
    return console.log(JSON.stringify(addWorkflow(JSON.parse(args[payloadIndex + 1])), null, 2));
  }
  console.log('Usage: node scripts/forge-work.mjs <status|list|pending|tick|add|run|claim|ack|remove>');
  process.exitCode = 1;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

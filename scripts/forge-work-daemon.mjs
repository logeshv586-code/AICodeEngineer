import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tickWorkflows } from './forge-work.mjs';

const workRoot = process.env.FORGE_WORK_HOME || path.join(os.homedir(), '.forge', 'work');
const pidFile = path.join(workRoot, 'scheduler.pid');
const logFile = path.join(workRoot, 'scheduler.log');

const processAlive = pid => {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
};

const log = message => {
  fs.mkdirSync(workRoot, { recursive: true });
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`);
};

const existingPid = fs.existsSync(pidFile) ? Number(fs.readFileSync(pidFile, 'utf8')) : 0;
if (processAlive(existingPid)) {
  console.log(`[forge-work-daemon] Scheduler already running with PID ${existingPid}.`);
  process.exit(0);
}

fs.mkdirSync(workRoot, { recursive: true });
fs.writeFileSync(pidFile, String(process.pid));
log(`scheduler started pid=${process.pid}`);

const cleanup = () => {
  try {
    const current = Number(fs.readFileSync(pidFile, 'utf8'));
    if (current === process.pid) fs.rmSync(pidFile, { force: true });
  } catch { /* ignore */ }
};

process.once('exit', cleanup);
process.once('SIGINT', () => { cleanup(); process.exit(0); });
process.once('SIGTERM', () => { cleanup(); process.exit(0); });

const tick = () => {
  try {
    const outputs = tickWorkflows({ timeoutMs: 120_000 });
    if (outputs.length > 0) log(`processed ${outputs.length} due workflow(s): ${JSON.stringify(outputs.map(item => item.result?.status || 'unknown'))}`);
  } catch (error) {
    log(`tick failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  }
};

tick();
setInterval(tick, 60_000);
console.log(`[forge-work-daemon] Scheduler running with PID ${process.pid}. Log: ${logFile}`);

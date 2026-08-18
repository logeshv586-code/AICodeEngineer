import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-work-test-'));
process.env.FORGE_WORK_HOME = tempRoot;

const work = await import(`./forge-work.mjs?selftest=${Date.now()}`);

const checks = [];
const check = (name, fn) => {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};

try {
  const dueAt = new Date(Date.now() - 5_000).toISOString();
  work.addWorkflow({
    id: 'prompt-once',
    title: 'Prompt Once',
    kind: 'prompt',
    prompt: 'Inspect the workspace and report status.',
    schedule: { type: 'once', at: dueAt },
  });
  work.addWorkflow({
    id: 'command-approval',
    title: 'Command Approval',
    kind: 'command',
    command: `${JSON.stringify(process.execPath)} -e "process.exit(0)"`,
    schedule: { type: 'once', at: dueAt },
    unattended: false,
  });

  const tick = work.tickWorkflows({ now: new Date().toISOString() });
  check('two due tasks queued', () => assert.equal(tick.length, 2));
  check('prompt requires agent', () => assert.ok(tick.some(item => item.task.id === 'prompt-once' && item.result.status === 'queued')));
  check('command remains approval gated', () => assert.ok(tick.some(item => item.task.id === 'command-approval' && item.result.status === 'queued')));

  const pending = work.listPendingWork();
  const promptPending = pending.find(item => item.workflowId === 'prompt-once');
  const commandPending = pending.find(item => item.workflowId === 'command-approval');
  check('prompt pending item exists', () => assert.equal(promptPending?.status, 'agent_required'));
  check('command approval item exists', () => assert.equal(commandPending?.status, 'approval_required'));

  const claimed = work.claimPendingWork(promptPending?.id, { claimant: 'self-test-a', leaseMs: 120_000 });
  check('first consumer claims prompt', () => assert.equal(claimed?.claim?.claimant, 'self-test-a'));
  check('claimed prompt hidden from pending list', () => assert.ok(!work.listPendingWork().some(item => item.id === promptPending?.id)));
  const conflictingClaim = work.claimPendingWork(promptPending?.id, { claimant: 'self-test-b', leaseMs: 120_000 });
  check('second consumer cannot steal active claim', () => assert.equal(conflictingClaim, null));

  const ack = work.ackPendingWork(promptPending?.id, { status: 'completed', test: true });
  check('claimed prompt can be acknowledged', () => assert.equal(ack?.item?.id, promptPending?.id));
  check('ack removes prompt from queue', () => assert.ok(!work.listPendingWork().some(item => item.id === promptPending?.id)));

  const runApproval = work.runWorkflow('command-approval', { approved: false, enqueue: false, markRun: false });
  check('manual command run still requires approval', () => assert.equal(runApproval.result.status, 'approval_required'));

  const status = work.workStatus();
  check('status reports remaining approval item', () => assert.equal(status.totalPendingCount, 1));
  check('history file written', () => assert.ok(fs.existsSync(status.historyFile) && fs.statSync(status.historyFile).size > 0));

  const failed = checks.filter(item => !item.ok);
  for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.error ? ` — ${item.error}` : ''}`);
  if (failed.length) {
    console.error(`\nForge Work Mode self-test failed: ${failed.map(item => item.name).join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nForge Work Mode self-test passed.');
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

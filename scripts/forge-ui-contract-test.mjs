import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const source = {
  chat: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/ChatView.tsx',
  composer: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/ComposerControlCenter.tsx',
  sidebar: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/SimpleSidebar.tsx',
  workflows: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/WorkflowsView.tsx',
  workspace: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/AgentWorkspace.tsx',
  universalComposer: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/UniversalComposer.tsx',
  bridge: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/hooks/useForgeBridge.ts',
};

const contains = (text, all) => all.every(token => text.includes(token));
const check = (name, ok, detail = '') => ({ name, ok: !!ok, detail });

export const runUiContractTest = () => {
  const files = Object.fromEntries(Object.entries(source).map(([key, relative]) => [key, read(relative)]));
  const checks = [
    check('conversation abort wiring', contains(files.chat, ['abortRunning(', 'onAbort={handleAbort}']), 'Stop must cancel the active ChatThreadService run'),
    check('conversation attachment wiring', contains(files.chat, ['handleAddAttachment', 'addNewStagingSelection', 'onAddAttachment={handleAddAttachment}']), 'Attachments must become real staging selections'),
    check('composer file picker', contains(files.composer, ['fileInputRef', "type='file'", 'onDrop={handleDrop}', 'onAddAttachment']), 'Paperclip and drag/drop must be functional'),
    check('attachment-only submit', files.composer.includes('value.trim().length > 0 || attachments.length > 0'), 'Attached context must be sendable without placeholder text'),
    check('response actions', contains(files.chat, ['duplicateThread(', 'navigator.clipboard.writeText', 'Forge Assistant Response Feedback']), 'Copy, duplicate, and feedback actions must have handlers'),
    check('super-agent sidebar controls', contains(files.sidebar, ['forge_understand', 'forge_workflow', "name: 'open-design'", 'forge_integrations']), 'Quick controls must call the real Forge MCP server'),
    check('workflow delete action', contains(files.workflows, ['onDeleteWorkflow', 'Trash2', 'confirmDeleteId']) && contains(files.bridge, ["type: 'deleteWorkflow'", 'deleteWorkflow']), 'Workflow delete must update bridge state'),
    check('workflow rerun action', files.workflows.includes("title='Run again'"), 'Completed/failed workflows should be repeatable'),
    check('workspace feature navigation', !files.workspace.includes('onFeatureChange={() => {}}') && files.workspace.includes('handleFeatureChange'), 'Top workspace controls may not be no-ops'),
    check('legacy design action', contains(files.universalComposer, ['prepareArtTask', 'Use in task']), 'Design panel must prepare a real Open Design agent task'),
    check('legacy code action', contains(files.universalComposer, ['prepareCodeRun', 'Prepare run']), 'Code panel must use the normal agent/terminal approval path'),
    check('no active abort stub', !files.chat.includes('onAbort={() => {}}'), 'Active Stop button may not be a stub'),
  ];

  return { ok: checks.every(item => item.ok), checks, failed: checks.filter(item => !item.ok).map(item => item.name) };
};

const main = () => {
  const result = runUiContractTest();
  for (const item of result.checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name.padEnd(32)} ${item.detail}`);
  if (!result.ok) {
    console.error(`\nForge UI contract test failed: ${result.failed.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nForge UI contract test passed.');
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const source = {
  activeSidebar: 'src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/Sidebar.tsx',
  chat: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/ChatView.tsx',
  composer: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/ComposerControlCenter.tsx',
  sidebar: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/SimpleSidebar.tsx',
  agents: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/AgentsView.tsx',
  workflows: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/WorkflowsView.tsx',
  workspace: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/AgentWorkspace.tsx',
  leftToolbar: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/LeftToolbar.tsx',
  universalComposer: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/UniversalComposer.tsx',
  slashCommands: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/utils/slashCommands.ts',
  slashRouter: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/utils/slashCommandRouter.tsx',
  services: 'src/vs/workbench/contrib/void/browser/react/src/util/services.tsx',
  bridge: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/hooks/useForgeBridge.ts',
  setup: 'setup-forge-super-agent.bat',
};

const contains = (text, all) => all.every(token => text.includes(token));
const check = (name, ok, detail = '') => ({ name, ok: !!ok, detail });

export const runUiContractTest = () => {
  const files = Object.fromEntries(Object.entries(source).map(([key, relative]) => [key, read(relative)]));
  const checks = [
    check('active sidebar super-agent rail', contains(files.activeSidebar, ['forge_browser', 'forge_understand', 'forge_workflow', 'forge_sidecar', 'forge_integrations']), 'The sidebar users actually see must expose browser, graph, Work Mode, design, and health controls'),
    check('active response buttons', contains(files.activeSidebar, ['Copy response', 'Fork / Branch thread', 'Forge Assistant Response Feedback', 'duplicateThread']), 'Compact response copy/fork/feedback buttons must have handlers'),
    check('registered settings action', contains(files.activeSidebar, ['workbench.action.openVoidSettings']) && contains(files.sidebar, ['workbench.action.openVoidSettings']) && contains(files.slashRouter, ['workbench.action.openVoidSettings']) && contains(files.slashCommands, ['workbench.action.openVoidSettings']) && contains(files.leftToolbar, ['workbench.action.openVoidSettings']), 'Visible settings controls must use the registered Forge settings action'),
    check('active slash super-agent commands', contains(files.slashRouter, ["name: '/browser'", "name: '/graph'", "name: '/work'", "name: '/design'", "name: '/health'", 'callForgeToolJson']), 'The active ChatView slash router must expose the Super Agent'),
    check('active Work Mode approval commands', contains(files.slashRouter, ["name: '/work-pending'", "name: '/work-approve'", "name: '/work-remove'", "action: 'ack'", 'approved: true']), 'Approval-gated scheduled commands must have a real user action path'),
    check('workflow stop aborts agent run', contains(files.slashRouter, ["name: '/workflow,stop'", 'abortRunning(threadId)']) && !files.slashRouter.includes("sendMessage('Stopping the current workflow"), 'Stop must cancel the active run rather than submit another model request'),
    check('direct skill search stays local', contains(files.chat, ['handleLocalSkillCommand', "text === '/skill'", "text === '/skills'", 'searchSkills(query)']), 'Pasted /skill and /skills commands must not reach the LLM'),
    check('native non-image file picker', contains(files.chat, ['IFileDialogService', 'showOpenDialog', 'handlePickFiles', 'onPickFiles={handlePickFiles}']), 'Code/document attachments must use native VS Code file URIs'),
    check('image attachment path', contains(files.composer, ['imageInputRef', "accept='image/*'", 'FileReader', 'onAddAttachment']), 'Images must retain data URLs for vision-capable models'),
    check('no removed Electron File.path dependency', !files.composer.includes("{ path?: string }") && !files.composer.includes('.path || file.name'), 'Electron 32+ removed File.path; Forge must not rely on it'),
    check('non-image drag drop is explicit', contains(files.composer, ['Use the paperclip button for code, documents, and other files', 'onAttachmentError']), 'Pathless non-image drops must not silently create broken filesystem selections'),
    check('attachment-only submit', files.composer.includes('value.trim().length > 0 || attachments.length > 0'), 'Attached context must be sendable without placeholder text'),
    check('slash attachment picker event', contains(files.slashCommands, ["dispatchAttachmentPicker('file')", "dispatchAttachmentPicker('image')", 'forge:open-attachment-picker']) && contains(files.universalComposer, ['forge:open-attachment-picker', 'openAttachmentPicker']), 'Legacy slash attachment commands must still route into the legacy composer picker'),
    check('browser installed by one-click setup', contains(files.setup, ['--full --setup --browser', 'Playwright Chromium']), 'Fresh Windows setup must install the browser runtime used by forge_browser'),
    check('Work Mode claim renewal', contains(files.activeSidebar, ['WORK_CLAIM_LEASE_MS', 'WORK_CLAIM_RENEW_MS', 'renewClaim', "action: 'claim'", "action: 'ack'"]), 'Long scheduled agent runs must renew their lease and avoid duplicate execution'),
    check('native workspace toolbar actions', contains(files.leftToolbar, ['workbench.files.action.focusFilesExplorer', 'workbench.action.findInFiles', 'workbench.action.terminal.toggleTerminal', 'focusCurrentChat', 'runKnowledgeTask', 'toggleReasoning']), 'Visible workspace toolbar buttons must route to real workbench or agent actions'),
    check('workflow badge action', contains(files.leftToolbar, ["onToolChange('workflows')", "title={`${threadCount} workflow(s)`}"]), 'The status badge must open workflows rather than being inert'),
    check('quiet React service bridge', !files.services.includes('TEMPORARY DEBUG INSTRUMENTATION') && !files.services.includes('[Forge Debug]') && files.services.includes('_registerServices'), 'Production React service resolution must not log every dependency lookup'),
    check('conversation abort wiring', contains(files.chat, ['abortRunning(', 'onAbort={handleAbort}']), 'Stop must cancel the active ChatThreadService run'),
    check('conversation attachment staging', contains(files.chat, ['addNewStagingSelection', "type: 'File'", "type: 'Image'"]), 'File and image attachments must become real staging selections'),
    check('response actions', contains(files.chat, ['duplicateThread(', 'navigator.clipboard.writeText', 'Forge Assistant Response Feedback']), 'Conversation response copy, duplicate, and feedback actions must have handlers'),
    check('super-agent sidebar controls', contains(files.sidebar, ['forge_understand', 'forge_workflow', "name: 'open-design'", 'forge_integrations']), 'Conversation sidebar controls must call the real Forge MCP server'),
    check('specialized agent roles', contains(files.agents, ['DesignAgent', 'AutomationAgent', 'KnowledgeAgent', 'LearningAgent']) && contains(files.bridge, ['capabilitiesForRole', 'design_generate', 'workflow_automation', 'skill_evolution']), 'Created agents must receive role-specific capabilities'),
    check('safe agent deletion', contains(files.agents, ['onDeleteAgent', 'Remove agent']) && contains(files.workspace, ['onDeleteAgent={bridge.deleteAgent}']) && contains(files.bridge, ["type: 'deleteAgent'", "action.agentId === 'forge-agent'"]), 'Idle specialized agents may be removed while the primary/running agent is protected'),
    check('workflow delete action', contains(files.workflows, ['onDeleteWorkflow', 'Trash2', 'confirmDeleteId']) && contains(files.bridge, ["type: 'deleteWorkflow'", 'deleteWorkflow']), 'Workflow delete must update bridge state'),
    check('workflow rerun action', files.workflows.includes("title='Run again'"), 'Completed/failed workflows should be repeatable'),
    check('workspace feature navigation', !files.workspace.includes('onFeatureChange={() => {}}') && files.workspace.includes('handleFeatureChange'), 'Top workspace controls may not be no-ops'),
    check('right-panel tab state', contains(files.workspace, ['RightPanelTab', 'setRightPanelTab(tab)']), 'Right panel must preserve its full tab union instead of casting unsupported tabs'),
    check('legacy design action', contains(files.universalComposer, ['prepareArtTask', 'Use in task']), 'Design panel must prepare a real Open Design agent task'),
    check('legacy code action', contains(files.universalComposer, ['prepareCodeRun', 'Prepare run']), 'Code panel must use the normal agent/terminal approval path'),
    check('no active abort stub', !files.chat.includes('onAbort={() => {}}'), 'Active Stop button may not be a stub'),
  ];

  return { ok: checks.every(item => item.ok), checks, failed: checks.filter(item => !item.ok).map(item => item.name) };
};

const main = () => {
  const result = runUiContractTest();
  for (const item of result.checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name.padEnd(40)} ${item.detail}`);
  if (!result.ok) {
    console.error(`\nForge UI contract test failed: ${result.failed.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nForge UI contract test passed.');
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
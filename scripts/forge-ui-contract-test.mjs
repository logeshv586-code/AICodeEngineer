import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const source = {
  activeSidebar: 'src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/Sidebar.tsx',
  conversation: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/ConversationShell.tsx',
  chat: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/ChatView.tsx',
  composer: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/ComposerControlCenter.tsx',
  sidebar: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/SimpleSidebar.tsx',
  threadList: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/ThreadList.tsx',
  context: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/ForgeContextPanel.tsx',
  chatHeader: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/ForgeChatHeader.tsx',
  brandMark: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/ForgeBrandMark.tsx',
  brandCss: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/forgeBrand.css',
  rightPanelCss: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/forgeRightPanel.css',
  evolution: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/utils/evolutionPrompts.ts',
  product: 'product.json',
  brandAsset: 'resources/forge/forge-mark.svg',
  agents: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/AgentsView.tsx',
  workflows: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/WorkflowsView.tsx',
  workspace: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/AgentWorkspace.tsx',
  leftToolbar: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/LeftToolbar.tsx',
  universalComposer: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/UniversalComposer.tsx',
  slashRouter: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/utils/slashCommandRouter.tsx',
  settingsService: 'src/vs/workbench/contrib/void/common/voidSettingsService.ts',
  chatService: 'src/vs/workbench/contrib/void/browser/chatThreadService.ts',
  services: 'src/vs/workbench/contrib/void/browser/react/src/util/services.tsx',
  bridge: 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/hooks/useForgeBridge.ts',
  setup: 'setup-forge-super-agent.bat',
  integrations: 'scripts/forge-integrations.mjs',
  sidecars: 'scripts/forge-sidecars.mjs',
  node24: 'scripts/forge-node24-runtime.mjs',
};

const contains = (text, all) => all.every(token => text.includes(token));
const check = (name, ok, detail = '') => ({ name, ok: !!ok, detail });

export const runUiContractTest = () => {
  const files = Object.fromEntries(Object.entries(source).map(([key, relative]) => [key, read(relative)]));
  const product = JSON.parse(files.product);
  const checks = [
    check('conversation shell is active UI', contains(files.activeSidebar, ['ConversationShell', '<ConversationShell />']) && !files.activeSidebar.includes('<SidebarChat'), 'The rendered Forge sidebar must use the Forge conversation shell instead of the legacy compact renderer'),
    check('single chat surface', contains(files.conversation, ['<ForgeChatHeader', '<ChatView', 'forge-chat-layout']) && !files.conversation.includes('<SimpleSidebar') && !files.conversation.includes('<ForgeContextPanel'), 'The active Forge surface must remain a normal editor chat without duplicate conversation/context columns'),
    check('premium brand system', contains(files.conversation, ['forge-premium-shell', 'forge-brand-aurora', "../forgeBrand.css"]) && contains(files.brandMark, ['ForgeBrandMark', '#8B8DFF', '#55D8FF']) && files.brandAsset.includes('<svg'), 'The UI and reusable vector mark must share the Forge iris/cyan brand'),
    check('desktop display brand', product.nameShort === 'Forge' && String(product.nameLong).startsWith('Forge') && product.applicationName === 'forge-ai', 'Display branding changes without breaking internal application/data identifiers'),
    check('active response buttons', contains(files.chat, ['Copy message', 'Duplicate thread', 'Forge Assistant Response Feedback', 'duplicateThread']), 'Copy/fork/feedback actions live in the active ChatView'),
    check('registered settings action', contains(files.conversation, ['workbench.action.openVoidSettings']) && contains(files.sidebar, ['workbench.action.openVoidSettings']) && contains(files.slashRouter, ['workbench.action.openVoidSettings']) && contains(files.leftToolbar, ['workbench.action.openVoidSettings']), 'Visible settings controls must use the registered Forge settings action'),
    check('keyboard conversation history', contains(files.threadList, ["role='list'", "role='button'", 'tabIndex={0}', "event.key === 'Enter' || event.key === ' '", "aria-current={isActive ? 'page' : undefined}"]) && files.threadList.includes('isFocused || showDelete'), 'Conversation rows and delete controls must be reachable without mouse hover'),
    check('active slash super-agent commands', contains(files.slashRouter, ["name: '/browser'", "name: '/graph'", "name: '/work'", "name: '/design'", "name: '/health'", 'callForgeToolJson']), 'The active ChatView slash router must expose the Super Agent'),
    check('single slash registry', !fs.existsSync(path.join(repoRoot, 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/utils/slashCommands.ts')) && contains(files.universalComposer, ['createAllCommands', 'slashCommandRouter.tsx']), 'Every composer must use the consolidated slash router instead of a duplicate command file'),
    check('agent-only execution', contains(files.settingsService, ["chatMode: 'agent'"]) && contains(files.chatService, ["const chatMode = 'agent' as const"]), 'Legacy chat/gather preferences must normalize to the tool-capable Agent mode'),
    check('single automatic model router', contains(files.chatService, ['chooseAdaptiveModel', '_selectAutoModelForPrompt', 'decision.switched']) && !files.chat.includes('chooseAdaptiveModel'), 'Automatic selection must run once in the backend before the agent model snapshot is created'),
    check('quiet empty conversation', !files.conversation.includes('ForgePanelIntro') && !files.chat.includes('How can Forge help with this project?'), 'Startup must show the real composer without an image-like command welcome screen'),
    check('composer stays at chat bottom', !files.conversation.includes('forge-chat-with-intro') && !files.rightPanelCss.includes('.void-forge-chat-with-intro'), 'The empty chat body must retain flex height so the composer stays pinned below the conversation'),
    check('evolution lives in slash commands', contains(files.slashRouter, ["name: '/evolve'", "name: '/evolve,skills'", 'FORGE_PROJECT_EVOLUTION_TASK', 'FORGE_SKILL_EVOLUTION_TASK']) && contains(files.evolution, ['FORGE_EVOLUTION_POLICY', '.agents/skills', 'Next evolution']), 'Project and skill evolution must stay available from the compact chat command surface with bounded backend guidance'),
    check('dark slash palette contract', contains(files.slashRouter, ['forge-slash-overlay', 'forge-slash-palette', 'forge-slash-command-selected', "role='dialog'", "aria-label='Forge slash commands'", 'paletteLeft', 'paletteMaxHeight']) && contains(files.brandCss, ['z-index: 99999', '--vscode-quickInput-background']), 'The portal-based slash palette must use editor theme tokens and stay within the viewport above the composer'),
    check('active Work Mode approval commands', contains(files.slashRouter, ["name: '/work-pending'", "name: '/work-approve'", "name: '/work-remove'", "action: 'ack'", 'approved: true']), 'Approval-gated scheduled commands must have a real user action path'),
    check('workflow stop aborts agent run', contains(files.slashRouter, ["name: '/workflow,stop'", 'abortRunning(threadId)']) && !files.slashRouter.includes("sendMessage('Stopping the current workflow") && !files.slashRouter.includes("publish('CANCEL_WORKFLOW'"), 'Stop must cancel the active run rather than submit another model request or dead event'),
    check('workspace index uses real service', contains(files.slashRouter, ['ISemanticSearchService', "name: '/workspace,index'", 'workspacePath', '.indexWorkspace(workspacePath)']) && !files.slashRouter.includes("publish('REINDEX_WORKSPACE'"), 'Workspace reindex must use the registered CocoIndex semantic search service with the open workspace path'),
    check('automatic knowledge refresh', contains(files.chatHeader, ['reloadSkills()', 'indexWorkspace(workspacePath)', 'wasStreamingRef', 'refreshKnowledge(true)']) && contains(files.conversation, ['workspacePath={workspacePath}', 'FORGE_EVOLUTION_POLICY']), 'Completed agent runs must refresh workspace skills and project knowledge while keeping evolution guidance in the backend task'),
    check('direct skill search stays local', contains(files.chat, ['handleLocalSkillCommand', "text === '/skill'", "text === '/skills'", 'searchSkills(query)']), 'Pasted /skill and /skills commands must not reach the LLM'),
    check('native non-image file picker', contains(files.chat, ['IFileDialogService', 'showOpenDialog', 'handlePickFiles', 'onPickFiles={handlePickFiles}']), 'Code/document attachments must use native VS Code file URIs'),
    check('image attachment path', contains(files.composer, ['imageInputRef', "accept='image/*'", 'FileReader', 'onAddAttachment']), 'Images must retain data URLs for vision-capable models'),
    check('no removed Electron File.path dependency', !files.composer.includes("{ path?: string }") && !files.composer.includes('.path || file.name'), 'Electron File.path must not be required for image attachments'),
    check('non-image drag drop is explicit', contains(files.composer, ['For code and documents, use the paperclip', 'onAttachmentError']), 'Pathless non-image drops must not silently create broken filesystem selections'),
    check('attachment-only submit', files.composer.includes('value.trim().length > 0 || attachments.length > 0'), 'Attached context must be sendable without placeholder text'),
    check('premium composer controls', contains(files.composer, ['forge-brand-composer', 'forge-brand-send', '/ commands', 'onAbort']), 'The active composer must expose attachments, commands, model context, send and real stop behavior'),
    check('duplicate submit prevention', contains(files.chat, ['const [isSubmitting, setIsSubmitting] = useState(false)', 'if (isStreaming || isSubmitting) return', 'isDisabled={isSubmitting}']), 'The active composer must block duplicate task handoff while the previous submit is starting'),
    check('failed submit preserves draft context', contains(files.chat, ['const sent = await sendWithAdaptiveModel(text)', 'if (!sent) return', "notify(`Forge could not start this task:", 'finally {', 'setIsSubmitting(false)']), 'Drafts/attachments must only clear after a successful handoff and failures must be visible'),
    check('missing model recovery', contains(files.chat, ['!settingsService.state.modelSelectionOfFeature.Chat && !canAutoSelect', 'Choose a Chat model before sending a task', 'onOpenSettings?.()']), 'A missing Chat model must open recovery settings unless Auto can select a configured candidate'),
    check('slash command error recovery', contains(files.chat, ['Promise.resolve(cmd.execute', "notify(`Command ${cmd.name} failed:"]), 'Async slash command failures must surface to the user rather than becoming unhandled promises'),
    check('responsive legacy context rail', contains(files.context, ['forge-brand-context-panel', 'Quick actions']) && files.brandCss.includes('@media (max-width: 1180px)'), 'The fallback context component remains responsive even though the active single-chat shell does not render it'),
    check('legacy super-agent sidebar controls', contains(files.sidebar, ['forge_browser', 'forge_understand', 'forge_workflow', "name: 'open-design'", 'forge_integrations']), 'Fallback conversation controls must keep their real Forge MCP wiring even though the active shell uses slash commands'),
    check('slash attachment picker event', contains(files.slashRouter, ["dispatchAttachmentPicker('file')", "dispatchAttachmentPicker('image')", 'forge:open-attachment-picker']) && contains(files.universalComposer, ['forge:open-attachment-picker', 'openAttachmentPicker']), 'Slash attachment commands must route into the composer picker from the consolidated registry'),
    check('browser installed by one-click setup', contains(files.setup, ['--full --setup --browser', 'Playwright Chromium']), 'Fresh Windows setup must install the browser runtime used by forge_browser'),
    check('Open Design isolated Node 24', contains(files.node24, ["NODE24_VERSION = '24.19.0'", "OPEN_DESIGN_PNPM_VERSION = '10.33.2'", 'SHASUMS256.txt', 'checksum mismatch']) && contains(files.integrations, ['forge-node24-runtime.mjs', "id === 'open-design'", 'runOpenDesignPnpm']) && contains(files.sidecars, ["runtime: 'node24'", 'forge-node24-runtime.mjs']), 'Open Design must not inherit Forge Node 20; it gets a checksummed Node 24 + pinned pnpm runtime'),
    check('Work Mode claim renewal', contains(files.activeSidebar, ['WORK_CLAIM_LEASE_MS', 'WORK_CLAIM_RENEW_MS', 'renewClaim', "action: 'claim'", "action: 'ack'"]), 'Long scheduled agent runs must renew their lease and avoid duplicate execution'),
    check('native workspace toolbar actions', contains(files.leftToolbar, ['workbench.files.action.focusFilesExplorer', 'workbench.action.findInFiles', 'workbench.action.terminal.toggleTerminal', 'focusCurrentChat', 'runKnowledgeTask', 'toggleReasoning']), 'Fallback workspace toolbar buttons must route to real workbench or agent actions'),
    check('quiet React service bridge', !files.services.includes('TEMPORARY DEBUG INSTRUMENTATION') && !files.services.includes('[Forge Debug]') && files.services.includes('_registerServices'), 'Production React service resolution must not log every dependency lookup'),
    check('conversation abort wiring', contains(files.chat, ['abortRunning(', 'onAbort={handleAbort}']), 'Stop must cancel the active ChatThreadService run'),
    check('conversation attachment staging', contains(files.chat, ['addNewStagingSelection', "type: 'File'", "type: 'Image'"]), 'File and image attachments must become real staging selections'),
    check('specialized agent roles', contains(files.agents, ['DesignAgent', 'AutomationAgent', 'KnowledgeAgent', 'LearningAgent']) && contains(files.bridge, ['capabilitiesForRole', 'design_generate', 'workflow_automation', 'skill_evolution']), 'Created agents must receive role-specific capabilities'),
    check('safe agent deletion', contains(files.agents, ['onDeleteAgent', 'Remove agent']) && contains(files.workspace, ['onDeleteAgent={bridge.deleteAgent}']) && contains(files.bridge, ["type: 'deleteAgent'", "action.agentId === 'forge-agent'"]), 'Idle specialized agents may be removed while the primary/running agent is protected'),
    check('workflow delete action', contains(files.workflows, ['onDeleteWorkflow', 'Trash2', 'confirmDeleteId']) && contains(files.bridge, ["type: 'deleteWorkflow'", 'deleteWorkflow']), 'Workflow delete must update bridge state'),
    check('workflow rerun action', files.workflows.includes("title='Run again'"), 'Completed/failed workflows should be repeatable'),
    check('workspace feature navigation', !files.workspace.includes('onFeatureChange={() => {}}') && files.workspace.includes('handleFeatureChange'), 'Fallback workspace controls may not be no-ops'),
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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const prompts = read('src/vs/workbench/contrib/void/common/prompt/prompts.ts');
const toolsService = read('src/vs/workbench/contrib/void/browser/toolsService.ts');
const toolTypes = read('src/vs/workbench/contrib/void/common/toolsServiceTypes.ts');
const messageTypes = read('src/vs/workbench/contrib/void/common/sendLLMMessageTypes.ts');
const chatService = read('src/vs/workbench/contrib/void/browser/chatThreadService.ts');
const sidebar = read('src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/SidebarChat.tsx');
const conversion = read('src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts');
const transport = read('src/vs/workbench/contrib/void/electron-main/llmMessage/sendLLMMessage.impl.ts');
const capabilities = read('src/vs/workbench/contrib/void/common/modelCapabilities.ts');
const slashRouter = read('src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/utils/slashCommandRouter.tsx');

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
const hasAll = (source, tokens) => tokens.every(token => source.includes(token));
const occurrences = (source, token) => source.split(token).length - 1;

check(
  'single tool-capable agent mode',
  chatService.includes("const chatMode = 'agent' as const"),
  'Every normal Forge conversation must execute through Agent mode so workspace tools remain available.',
);

check(
  'manual model selection is respected',
  hasAll(chatService, [
    'if (!this._settingsService.state.globalSettings.autoModelSelection) return',
    "await this._settingsService.setModelSelectionOfFeature('Chat', decision.selection)",
  ]),
  'Adaptive routing may change the Chat model only when Auto Model Selection is enabled.',
);

check(
  'auto slash command uses real settings service',
  hasAll(slashRouter, [
    "import { IVoidSettingsService } from '../../../../../common/voidSettingsService.js'",
    'accessor.get(IVoidSettingsService)',
    "setGlobalSetting('autoModelSelection', enabled)",
  ]) && !slashRouter.includes("accessor.get('IVoidSettingsService')"),
  '/auto must resolve the typed VS Code settings service instead of passing an invalid string to the dependency injector.',
);

check(
  'read and discovery tools exist',
  hasAll(prompts, [
    'read_file:',
    'ls_dir:',
    'get_dir_tree:',
    'search_pathnames_only:',
    'search_for_files:',
    'search_in_file:',
    'semantic_search:',
    'read_lint_errors:',
  ]),
  'Agent mode must be able to inspect files, folders, search results, semantic context, and lint diagnostics.',
);

check(
  'write and execution tools exist',
  hasAll(prompts, [
    'create_file_or_folder:',
    'edit_file:',
    'rewrite_file:',
    'delete_file_or_folder:',
    'run_command:',
    'open_persistent_terminal:',
    'run_persistent_command:',
    'kill_persistent_terminal:',
  ]),
  'Agent mode must be able to create, modify, replace, delete, build, test, and run projects.',
);

check(
  'prompt exports match tool-service imports',
  prompts.includes('export const MAX_CHILDREN_URIs_PAGE = 500')
    && toolsService.includes('MAX_CHILDREN_URIs_PAGE'),
  'Shared pagination constants must keep the exact exported identifier consumed by toolsService.ts.',
);

check(
  'tool turns are silent execution turns',
  hasAll(prompts, [
    'A tool-call turn MUST contain the tool call only.',
    'Do not send user-facing progress prose between consecutive tool calls.',
    'Tool-call turns are silent execution turns',
    'Never write "let me inspect"',
  ])
    && !prompts.includes('Instead, describe at a high level what the tool will do'),
  'Forge must execute tool steps without producing repetitive "Let me inspect..." assistant bubbles.',
);

check(
  'tool narration leakage is suppressed',
  hasAll(messageTypes, [
    'removedRegisteredToolCall',
    'isExecutionPreambleOnly',
    "if (removedRegisteredToolCall && isExecutionPreambleOnly(cleaned)) return ''",
  ]),
  'If a registered tool call leaks into model text, stripping it must not leave a short "Let me inspect..." bubble behind.',
);

check(
  'runtime tool turns stay out of visible chat',
  hasAll(chatService, [
    'const isToolTurn = !!toolCall',
    "displayContentSoFar: isToolTurn ? '' : readableLLMContent(fullText)",
    "reasoningSoFar: isToolTurn ? '' : readableLLMContent(fullReasoning)",
    "displayContent: toolCall ? '' : info.fullText",
    "reasoning: toolCall ? '' : info.fullReasoning",
  ]),
  'The agent must keep tool-call history for providers while hiding routine tool-turn narration from the sidebar.',
);

check(
  'legacy tool preambles stay hidden',
  hasAll(sidebar, [
    'isRoutineAgentPreamble',
    "nextMessage?.role === 'tool'",
    "nextMessage?.role === 'interrupted_streaming_tool'",
    'if (isExecutionPreamble) return null',
  ]),
  'Saved threads created before the runtime fix must not continue rendering tool-adjacent "Let me..." bubbles.',
);

check(
  'tool loop continues until verified',
  hasAll(prompts, [
    'Follow the full engineering loop:',
    'run targeted lint/type/build/tests',
    'continue fixing',
    'Never claim checks passed unless their command result shows success.',
  ])
    && hasAll(chatService, [
      'shouldSendAnotherMessage = true',
      'const chatMode = \'agent\' as const',
      'Agent Context Handoff',
    ]),
  'Forge must continue through inspect/edit/test/fix cycles instead of stopping after one model response.',
);

check(
  'model tool aliases normalize',
  hasAll(prompts, [
    "create_file_or_folder: ['write_file'",
    "read_file: ['read_file_or_folder'",
    "edit_file: ['modify_file'",
    "rewrite_file: ['overwrite_file'",
    "run_command: ['exec'",
    'normalizeToolName',
    'normalizeRawParams',
  ]),
  'Different model naming habits must map onto the canonical Forge tool protocol.',
);

check(
  'workspace paths are model-safe',
  hasAll(toolsService, [
    "'Forge AI Workspace'",
    "rawPath === '/workspace'",
    'resolveWorkspaceURI',
    'await fileService.createFolder(parentUri)',
  ]),
  'Relative and /workspace model paths must resolve into the real project and missing parent folders must be created safely.',
);

check(
  'write and terminal actions are approval-gated',
  hasAll(toolTypes, [
    "'create_file_or_folder': 'edits'",
    "'delete_file_or_folder': 'edits'",
    "'rewrite_file': 'edits'",
    "'edit_file': 'edits'",
    "'run_command': 'terminal'",
    "'run_persistent_command': 'terminal'",
  ]),
  'Potentially destructive edits and terminal actions must stay behind the configured approval policy.',
);

check(
  'native provider tool formats adapt',
  hasAll(transport, [
    "specialToolFormat === 'openai-style'",
    "specialToolFormat === 'anthropic-style'",
    "specialToolFormat === 'gemini-style'",
  ]),
  'Forge must use the provider-native function/tool protocol when the selected model supports it.',
);

check(
  'custom model XML fallback is end-to-end',
  occurrences(transport, 'extractXMLToolsWrapper') >= 3
    && prompts.includes('systemToolsXMLPrompt')
    && conversion.includes('const includeXMLToolDefinitions = !specialToolFormat')
    && conversion.includes('prepareMessages_XML_tools'),
  'Unknown/custom models without a native tool format must receive XML tool instructions and have XML tool calls parsed back into Forge tools.',
);

check(
  'custom model capability fallback exists',
  hasAll(capabilities, ['extensiveModelOptionsFallback', 'modelOptionsFallback']),
  'A user-supplied model name must fall back to inferred/default capabilities rather than being rejected because it is not pre-registered.',
);

check(
  'tool history round-trips across providers',
  hasAll(conversion, [
    'prepareMessages_openai_tools',
    'prepareMessages_anthropic_tools',
    'prepareMessages_XML_tools',
    'reParsedToolXMLString',
  ]),
  'Follow-up turns must preserve prior tool calls/results in each provider protocol so multi-step agents can continue reliably.',
);

for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name.padEnd(40)} ${item.detail}`);
const failed = checks.filter(item => !item.ok);
if (failed.length) {
  console.error(`\nForge agent/tool contract failed: ${failed.map(item => item.name).join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('\nForge agent/tool contract passed.');
}

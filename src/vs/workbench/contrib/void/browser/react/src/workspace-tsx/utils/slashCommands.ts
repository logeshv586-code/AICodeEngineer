/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { ChatMode } from '../../../../common/voidSettingsTypes.js';

export interface SlashCommand {
  name: string;
  label: string;
  description: string;
  icon?: React.ReactNode;
  category: string;
  execute: (args: string, accessor: any) => void | Promise<void>;
}

const notify = (accessor: any, message: string, level: 'info' | 'warn' | 'error' = 'info') => {
  const service = accessor.get('INotificationService');
  if (level === 'error') service.error(message);
  else if (level === 'warn') service.warn(message);
  else service.info(message);
};

const dispatchAttachmentPicker = (kind: 'file' | 'image') => {
  window.dispatchEvent(new CustomEvent('forge:open-attachment-picker', { detail: { kind } }));
};

const callForgeTool = async (accessor: any, toolName: string, params: Record<string, unknown>, label: string) => {
  const mcp = accessor.get('IMCPService');
  const installed = (mcp.getMCPTools?.() || []).some((tool: any) => tool.mcpServerName === 'forge-super-agent' && tool.name === toolName);
  if (!installed) {
    notify(accessor, 'Forge Super Agent MCP is not ready. Run the bootstrap command and restart Forge.', 'warn');
    return;
  }
  try {
    const { result } = await mcp.callMCPTool({ serverName: 'forge-super-agent', toolName, params });
    const text = mcp.stringifyResult(result).replace(/\s+/g, ' ').trim();
    notify(accessor, `${label}: ${text.slice(0, 1000) || 'OK'}`);
  } catch (error) {
    notify(accessor, `${label} failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
};

const slashCommands: SlashCommand[] = [
  {
    name: 'code',
    label: 'Code Agent',
    description: 'Implement the requested code changes in the workspace',
    category: 'Agents',
    execute: (args, accessor) => sendAgentTask(accessor, `Act as the coding agent. Inspect the workspace, implement the requested code changes, run targeted verification, fix failures, and review the final diff. ${args}`),
  },
  {
    name: 'review',
    label: 'Review Code',
    description: 'Review the current workspace or selected files for bugs and improvements',
    category: 'Agents',
    execute: (args, accessor) => sendAgentTask(accessor, `Review the current workspace and selected files for correctness, security, performance, maintainability, and regressions. Fix actionable issues when safe and verify them. ${args}`),
  },
  {
    name: 'bug',
    label: 'Fix Bug',
    description: 'Trace an error to its root cause and implement a verified fix',
    category: 'Agents',
    execute: (args, accessor) => sendAgentTask(accessor, `Debug and fix the reported bug. Reproduce where possible, read the relevant code and logs, identify the root cause, implement the smallest coherent fix, and run regression checks. ${args}`),
  },
  {
    name: 'test',
    label: 'Run Tests',
    description: 'Run the relevant test suite and fix failures',
    category: 'Agents',
    execute: (args, accessor) => sendAgentTask(accessor, `Run the most relevant tests for this workspace, diagnose failures, fix the implementation or tests as appropriate, then rerun verification. ${args}`),
  },
  {
    name: 'understand',
    label: 'Understand Codebase',
    description: 'Use focused discovery and the Understand Anything graph for a repository task',
    category: 'Super Agent',
    execute: (args, accessor) => sendAgentTask(accessor, `Understand this codebase for the following task. Start with lean semantic discovery; use the Understand Anything graph when present or when the repository is large/cross-file. Never inject the whole graph. Explain the relevant architecture and continue with the task if one is specified. ${args}`),
  },
  {
    name: 'graph',
    label: 'Code Graph Status',
    description: 'Check the local Understand Anything graph without an LLM call',
    category: 'Super Agent',
    execute: async (_args, accessor) => {
      const workspace = accessor.get('IWorkspaceContextService').getWorkspace().folders[0]?.uri.fsPath;
      await callForgeTool(accessor, 'forge_understand', { action: 'status', ...(workspace ? { workspace } : {}) }, 'Code graph');
    },
  },
  {
    name: 'browser',
    label: 'Browser Agent',
    description: 'Inspect and verify the real web UI using the persistent browser',
    category: 'Super Agent',
    execute: (args, accessor) => sendAgentTask(accessor, `Use the Forge browser agent for this task. Inspect the live page and compact DOM, interact only as needed, take screenshots when visual verification helps, make required code changes, and verify the result in the browser. ${args}`),
  },
  {
    name: 'work',
    label: 'Work Mode',
    description: 'List local Work Mode automations without using the LLM',
    category: 'Super Agent',
    execute: (_args, accessor) => callForgeTool(accessor, 'forge_workflow', { action: 'list' }, 'Work Mode'),
  },
  {
    name: 'design',
    label: 'Design Agent',
    description: 'Use Open Design for a visual/prototype task',
    category: 'Super Agent',
    execute: (args, accessor) => sendAgentTask(accessor, `Treat this as a design implementation task. Use Open Design only where it adds value, keep editable source artifacts in the workspace, use the browser for real visual verification, and deliver production-ready code/artifacts. ${args}`),
  },
  {
    name: 'design-status',
    label: 'Open Design Status',
    description: 'Check the local Open Design sidecar without an LLM call',
    category: 'Super Agent',
    execute: (_args, accessor) => callForgeTool(accessor, 'forge_sidecar', { action: 'status', name: 'open-design' }, 'Open Design'),
  },
  {
    name: 'health',
    label: 'Integration Health',
    description: 'Run the local Super Agent integration doctor',
    category: 'Super Agent',
    execute: (_args, accessor) => callForgeTool(accessor, 'forge_integrations', { action: 'doctor' }, 'Integrations'),
  },
  {
    name: 'skills',
    label: 'List Skills',
    description: 'Show registry and workspace skill status',
    category: 'Skills',
    execute: (_args, accessor) => {
      const skillsService = accessor.get('ISkillsService');
      const registryCount = skillsService.getRegistrySkillCount();
      const workspaceSkills = skillsService.getAllSkills();
      const names = workspaceSkills.map((skill: { name: string }) => skill.name).join(', ');
      notify(accessor, `${registryCount} registry skills, ${workspaceSkills.length} active workspace skills${names ? ` (Active: ${names})` : ''}`);
    },
  },
  {
    name: 'skill',
    label: 'Search Skills',
    description: 'Search the 333-skill registry locally',
    category: 'Skills',
    execute: async (args, accessor) => {
      const query = (args || '').trim();
      if (!query) {
        notify(accessor, 'Usage: /skill <query> (e.g. /skill jetson)');
        return;
      }
      const results = await accessor.get('ISkillsService').searchSkills(query);
      const top = results.slice(0, 8);
      const formatted = top.length ? top.map((r: { id: string; category: string }) => `${r.id} (${r.category})`).join(', ') : 'No matching skills found';
      notify(accessor, `Skill search "${query}": ${formatted}`);
    },
  },
  {
    name: 'skill-add',
    label: 'Add Skill',
    description: 'Show the workspace location for custom skills',
    category: 'Skills',
    execute: (_args, accessor) => notify(accessor, 'Add a custom skill under <workspace>/.agents/skills/<name>/SKILL.md or as a flat Markdown file.'),
  },
  {
    name: 'mcp',
    label: 'MCP Tools',
    description: 'Show connected MCP servers and tools available to the agent',
    category: 'MCP',
    execute: (_args, accessor) => {
      const mcp = accessor.get('IMCPService');
      const servers = Object.keys(mcp.state.mcpServerOfName || {});
      const tools = (mcp.getMCPTools() || []).map((tool: { name: string }) => tool.name);
      notify(accessor, `MCP servers: ${servers.join(', ') || 'none'} · tools: ${tools.join(', ') || 'none'}`);
    },
  },
  {
    name: 'mcp-config',
    label: 'Configure MCP',
    description: 'Open the MCP configuration file for external tools and servers',
    category: 'MCP',
    execute: (_args, accessor) => { void accessor.get('IMCPService').revealMCPConfigFile(); },
  },
  {
    name: 'settings',
    label: 'Open Settings',
    description: 'Open provider, model, skill, and MCP settings',
    category: 'System',
    execute: (_args, accessor) => accessor.get('ICommandService').executeCommand('workbench.action.openVoidSettings'),
  },
  {
    name: 'auto',
    label: 'Toggle Auto Model',
    description: 'Let Forge select a configured model for each task or keep the selected model',
    category: 'Model',
    execute: (_args, accessor) => {
      const settings = accessor.get('IVoidSettingsService');
      settings.setGlobalSetting('autoModelSelection', !settings.state.globalSettings.autoModelSelection);
      notify(accessor, `Adaptive model selection ${settings.state.globalSettings.autoModelSelection ? 'disabled' : 'enabled'}.`);
    },
  },
  {
    name: 'clear',
    label: 'Clear Context',
    description: 'Clear staged context from the current message',
    category: 'Chat',
    execute: (_args, accessor) => {
      accessor.get('IChatThreadService').setCurrentThreadState({ stagingSelections: [] });
      notify(accessor, 'Staged context cleared.');
    },
  },
  {
    name: 'mode',
    label: 'Switch Mode',
    description: 'Switch between chat, gather, and agent modes',
    category: 'Chat',
    execute: (args, accessor) => {
      const settings = accessor.get('IVoidSettingsService');
      const modes: ChatMode[] = ['normal', 'gather', 'agent'];
      const requestedMode = args.trim().toLowerCase();
      const currentMode = settings.state.globalSettings.chatMode || 'agent';
      const nextMode = modes.includes(requestedMode as ChatMode) ? requestedMode as ChatMode : modes[(modes.indexOf(currentMode) + 1) % modes.length];
      void setChatMode(accessor, nextMode);
    },
  },
  { name: 'chat', label: 'Chat Mode', description: 'Use normal chat without workspace tools', category: 'Chat', execute: (_args, accessor) => { void setChatMode(accessor, 'normal'); } },
  { name: 'gather', label: 'Gather Mode', description: 'Read workspace context without editing files', category: 'Chat', execute: (_args, accessor) => { void setChatMode(accessor, 'gather'); } },
  { name: 'agent-mode', label: 'Agent Mode', description: 'Use workspace tools and allow file edits', category: 'Chat', execute: (_args, accessor) => { void setChatMode(accessor, 'agent'); } },
  {
    name: 'reasoning',
    label: 'Toggle Reasoning',
    description: 'Toggle reasoning on or off for the current model',
    category: 'Model',
    execute: (_args, accessor) => {
      const settings = accessor.get('IVoidSettingsService');
      const modelSel = settings.state.modelSelectionOfFeature.Chat;
      if (!modelSel) return notify(accessor, 'No Chat model is selected.', 'warn');
      const options = settings.state.optionsOfModelSelection.Chat?.[modelSel.providerName]?.[modelSel.modelName];
      const current = options?.reasoningEnabled ?? false;
      settings.setOptionsOfModelSelection('Chat', modelSel.providerName, modelSel.modelName, { reasoningEnabled: !current });
      notify(accessor, `Reasoning ${current ? 'disabled' : 'enabled'} for ${modelSel.modelName}.`);
    },
  },
  {
    name: 'attach',
    label: 'Attach File',
    description: 'Open the composer file picker',
    category: 'Input',
    execute: () => dispatchAttachmentPicker('file'),
  },
  {
    name: 'image',
    label: 'Attach Image',
    description: 'Open the composer image picker',
    category: 'Input',
    execute: () => dispatchAttachmentPicker('image'),
  },
  {
    name: 'task',
    label: 'Task Mode',
    description: 'Toggle structured task-mode execution',
    category: 'Agent',
    execute: (_args, accessor) => {
      const settings = accessor.get('IVoidSettingsService');
      const current = settings.state.globalSettings.taskModeEnabled ?? false;
      settings.setGlobalSetting('taskModeEnabled', !current);
      notify(accessor, `Task mode ${current ? 'disabled' : 'enabled'}.`);
    },
  },
  {
    name: 'multi',
    label: 'Multi-Agent',
    description: 'Toggle multi-agent collaboration mode',
    category: 'Agent',
    execute: (_args, accessor) => {
      const settings = accessor.get('IVoidSettingsService');
      const current = settings.state.globalSettings.multiAgentEnabled ?? false;
      settings.setGlobalSetting('multiAgentEnabled', !current);
      notify(accessor, `Multi-agent mode ${current ? 'disabled' : 'enabled'}.`);
    },
  },
  {
    name: 'plan',
    label: 'Generate Plan',
    description: 'Generate an agent plan for the current task',
    category: 'Agent',
    execute: (_args, accessor) => {
      const thread = accessor.get('IChatThreadService').getCurrentThread();
      const lastUserMessage = thread?.messages.filter((m: any) => m.role === 'user').pop();
      sendAgentTask(accessor, `Create a concise, executable implementation plan for this task before making changes. Include discovery, implementation, verification, and rollback boundaries. ${lastUserMessage?.content || 'Use the current workspace task.'}`);
    },
  },
  {
    name: 'voice',
    label: 'Voice Input',
    description: 'Toggle voice input mode',
    category: 'Input',
    execute: (_args, accessor) => {
      const settings = accessor.get('IVoidSettingsService');
      const current = settings.state.globalSettings.voiceInputEnabled ?? false;
      settings.setGlobalSetting('voiceInputEnabled', !current);
      notify(accessor, `Voice input ${current ? 'disabled' : 'enabled'}.`);
    },
  },
  {
    name: 'art',
    label: 'Art Mode',
    description: 'Enable design/art task controls',
    category: 'Model',
    execute: (_args, accessor) => {
      accessor.get('IVoidSettingsService').setGlobalSetting('artModeEnabled', true);
      notify(accessor, 'Art/design controls enabled.');
    },
  },
  {
    name: 'code-mode',
    label: 'Code Mode',
    description: 'Enable safe code execution controls',
    category: 'Model',
    execute: (_args, accessor) => {
      accessor.get('IVoidSettingsService').setGlobalSetting('codeExecutionEnabled', true);
      notify(accessor, 'Code execution controls enabled.');
    },
  },
];

function sendAgentTask(accessor: any, prompt: string): void {
  const chatThreadService = accessor.get('IChatThreadService');
  let threadId = chatThreadService.state.currentThreadId;
  if (!threadId) threadId = chatThreadService.createNewThread();
  void chatThreadService.addUserMessageAndStreamResponse({ userMessage: prompt.trim(), threadId });
}

async function setChatMode(accessor: any, mode: ChatMode): Promise<void> {
  const settingsService = accessor.get('IVoidSettingsService');
  settingsService.setGlobalSetting('chatMode', mode);
  notify(accessor, `Chat mode: ${mode === 'normal' ? 'Chat' : mode === 'gather' ? 'Gather' : 'Agent'}`);
}

export function getSlashCommands(): SlashCommand[] { return slashCommands; }

export function getSlashCommandsByCategory(): Record<string, SlashCommand[]> {
  const categories: Record<string, SlashCommand[]> = {};
  for (const command of slashCommands) (categories[command.category] ||= []).push(command);
  return categories;
}

export function findSlashCommand(name: string): SlashCommand | undefined {
  return slashCommands.find(command => command.name === name);
}

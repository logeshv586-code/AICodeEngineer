/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';

export interface SlashCommand {
  name: string;
  label: string;
  description: string;
  icon?: React.ReactNode;
  category: string;
  execute: (args: string, accessor: any) => void;
}

const slashCommands: SlashCommand[] = [
  {
    name: 'clear',
    label: 'Clear Context',
    description: 'Clear all staging selections and reset the chat',
    category: 'Chat',
    execute: (args, accessor) => {
      const chatThreadService = accessor.get('IChatThreadService');
      chatThreadService.clearStagingSelections();
    },
  },
  {
    name: 'mode',
    label: 'Switch Mode',
    description: 'Switch between chat, gather, and agent modes',
    category: 'Chat',
    execute: (args, accessor) => {
      const voidSettingsService = accessor.get('IVoidSettingsService');
      const modes = ['normal', 'gather', 'agent'] as const;
      const currentMode = voidSettingsService.state.globalSettings.chatMode || 'agent';
      const idx = modes.indexOf(currentMode);
      const nextMode = modes[(idx + 1) % modes.length];
      voidSettingsService.setGlobalSetting('chatMode', nextMode);
    },
  },
  {
    name: 'reasoning',
    label: 'Toggle Reasoning',
    description: 'Toggle reasoning on or off for the current model',
    category: 'Model',
    execute: (args, accessor) => {
      const voidSettingsService = accessor.get('IVoidSettingsService');
      const settingsState = accessor.get('IVoidSettingsService').state;
      const modelSel = settingsState.modelSelectionOfFeature['Chat'];
      if (!modelSel) return;
      const { providerName, modelName } = modelSel;
      const overrides = settingsState.overridesOfModel;
      const current = overrides?.[modelName]?.reasoningEnabled;
      voidSettingsService.setOptionsOfModelSelection('Chat', providerName, modelName, {
        reasoningEnabled: !current,
      });
    },
  },
  {
    name: 'attach',
    label: 'Attach File',
    description: 'Attach a file to the current message',
    category: 'Input',
    execute: (args, accessor) => {
      const chatThreadService = accessor.get('IChatThreadService');
      const fileDialogService = accessor.get('IFileDialogService');
      fileDialogService.showOpenDialog({
        canSelectMany: true,
        openLabel: 'Attach',
      }).then((result: any) => {
        if (!result || !result.result) return;
        const uris = result.result;
        uris.forEach((uri: any) => {
          chatThreadService.addNewStagingSelection({
            type: 'File',
            uri,
            language: '',
            state: { wasAddedAsCurrentFile: false },
          });
        });
      });
    },
  },
  {
    name: 'task',
    label: 'Task Mode',
    description: 'Toggle task mode for structured agent workflows',
    category: 'Agent',
    execute: (args, accessor) => {
      const voidSettingsService = accessor.get('IVoidSettingsService');
      const settingsState = voidSettingsService.state;
      const current = settingsState.globalSettings.taskModeEnabled ?? false;
      voidSettingsService.setGlobalSetting('taskModeEnabled', !current);
    },
  },
  {
    name: 'multi',
    label: 'Multi-Agent',
    description: 'Toggle multi-agent collaboration mode',
    category: 'Agent',
    execute: (args, accessor) => {
      const voidSettingsService = accessor.get('IVoidSettingsService');
      const settingsState = voidSettingsService.state;
      const current = settingsState.globalSettings.multiAgentEnabled ?? false;
      voidSettingsService.setGlobalSetting('multiAgentEnabled', !current);
    },
  },
  {
    name: 'plan',
    label: 'Generate Plan',
    description: 'Generate an agent plan for the current task',
    category: 'Agent',
    execute: (args, accessor) => {
      const chatThreadService = accessor.get('IChatThreadService');
      const thread = chatThreadService.getCurrentThread();
      if (!thread) return;
      const lastUserMessage = thread.messages.filter((m: any) => m.role === 'user').pop();
      if (!lastUserMessage) return;
      chatThreadService.generatePlan(lastUserMessage.content || '');
    },
  },
  {
    name: 'voice',
    label: 'Voice Input',
    description: 'Toggle voice input mode',
    category: 'Input',
    execute: (args, accessor) => {
      const voidSettingsService = accessor.get('IVoidSettingsService');
      const settingsState = voidSettingsService.state;
      const current = settingsState.globalSettings.voiceInputEnabled ?? false;
      voidSettingsService.setGlobalSetting('voiceInputEnabled', !current);
    },
  },
  {
    name: 'image',
    label: 'Image Input',
    description: 'Attach an image to the current message',
    category: 'Input',
    execute: (args, accessor) => {
      const chatThreadService = accessor.get('IChatThreadService');
      const fileDialogService = accessor.get('IFileDialogService');
      fileDialogService.showOpenDialog({
        canSelectMany: false,
        openLabel: 'Attach Image',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      }).then((result: any) => {
        if (!result || !result.result || result.result.length === 0) return;
        const uri = result.result[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
          const dataUrl = evt.target?.result as string;
          chatThreadService.addNewStagingSelection({
            type: 'Image',
            uri,
            dataUrl,
            mimeType: 'image/png',
          });
        };
        reader.readAsDataURL(uri.fsPath);
      });
    },
  },
  {
    name: 'art',
    label: 'Art Mode',
    description: 'Switch to art generation mode',
    category: 'Model',
    execute: (args, accessor) => {
      const voidSettingsService = accessor.get('IVoidSettingsService');
      voidSettingsService.setGlobalSetting('artModeEnabled', true);
    },
  },
  {
    name: 'code',
    label: 'Code Mode',
    description: 'Switch to code execution mode',
    category: 'Model',
    execute: (args, accessor) => {
      const voidSettingsService = accessor.get('IVoidSettingsService');
      voidSettingsService.setGlobalSetting('codeExecutionEnabled', true);
    },
  },
];

export function getSlashCommands(): SlashCommand[] {
  return slashCommands;
}

export function getSlashCommandsByCategory(): Record<string, SlashCommand[]> {
  const categories: Record<string, SlashCommand[]> = {};
  slashCommands.forEach(cmd => {
    if (!categories[cmd.category]) {
      categories[cmd.category] = [];
    }
    categories[cmd.category].push(cmd);
  });
  return categories;
}

export function findSlashCommand(name: string): SlashCommand | undefined {
  return slashCommands.find(cmd => cmd.name === name);
}
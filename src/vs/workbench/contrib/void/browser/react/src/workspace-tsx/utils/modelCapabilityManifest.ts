/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProviderName } from '../../../../common/voidSettingsTypes.js';
import { getModelCapabilities } from '../../../../common/modelCapabilities.js';
import { VoidSettingsState } from '../../../../common/voidSettingsService.js';

export interface ModelCapability {
  canReason: boolean;
  canEdit: boolean;
  canUseTools: boolean;
  canAcceptAttachments: boolean;
  canUseVoice: boolean;
  canUseImages: boolean;
  canUseArt: boolean;
  canUseCodeExecution: boolean;
  maxContextTokens: number | null;
  supportsStreaming: boolean;
  supportsMultiAgent: boolean;
  supportsTaskMode: boolean;
  reasoningBudgetSlider: { min: number; max: number; default: number } | null;
  reasoningEffortOptions: string[] | null;
}

export interface CapabilityManifest {
  provider: ProviderName;
  model: string;
  capabilities: ModelCapability;
  lastUpdated: number;
}

const DEFAULT_CAPABILITIES: ModelCapability = {
  canReason: false,
  canEdit: false,
  canUseTools: false,
  canAcceptAttachments: false,
  canUseVoice: false,
  canUseImages: false,
  canUseArt: false,
  canUseCodeExecution: false,
  maxContextTokens: null,
  supportsStreaming: true,
  supportsMultiAgent: false,
  supportsTaskMode: false,
  reasoningBudgetSlider: null,
  reasoningEffortOptions: null,
};

export function getCapabilityManifest(
  providerName: ProviderName,
  modelName: string,
  overridesOfModel: Record<string, any> | undefined,
): ModelCapability {
  const { reasoningCapabilities } = getModelCapabilities(providerName, modelName, overridesOfModel);

  const canReason = !!reasoningCapabilities;
  const hasSlider = reasoningCapabilities?.reasoningSlider?.type === 'budget_slider';
  const hasEffort = reasoningCapabilities?.reasoningSlider?.type === 'effort_slider';

  const capabilityOverrides = overridesOfModel?.[modelName]?.capabilities;

  return {
    canReason,
    canEdit: capabilityOverrides?.canEdit ?? canReason,
    canUseTools: capabilityOverrides?.canUseTools ?? canReason,
    canAcceptAttachments: capabilityOverrides?.canAcceptAttachments ?? true,
    canUseVoice: capabilityOverrides?.canUseVoice ?? false,
    canUseImages: capabilityOverrides?.canUseImages ?? true,
    canUseArt: capabilityOverrides?.canUseArt ?? false,
    canUseCodeExecution: capabilityOverrides?.canUseCodeExecution ?? false,
    maxContextTokens: capabilityOverrides?.maxContextTokens ?? null,
    supportsStreaming: true,
    supportsMultiAgent: capabilityOverrides?.supportsMultiAgent ?? false,
    supportsTaskMode: capabilityOverrides?.supportsTaskMode ?? false,
    reasoningBudgetSlider: hasSlider ? reasoningCapabilities!.reasoningSlider : null,
    reasoningEffortOptions: hasEffort ? (reasoningCapabilities!.reasoningSlider as any).values : null,
  };
}

export function createCapabilityManifest(
  providerName: ProviderName,
  modelName: string,
  settingsState: VoidSettingsState,
): CapabilityManifest {
  const overridesOfModel = settingsState.overridesOfModel;
  const capabilities = getCapabilityManifest(providerName, modelName, overridesOfModel);

  return {
    provider: providerName,
    model: modelName,
    capabilities,
    lastUpdated: Date.now(),
  };
}

export type CapabilityChangeCallback = (manifest: CapabilityManifest) => void;

const listeners = new Set<CapabilityChangeCallback>();

export function onCapabilityChange(callback: CapabilityChangeCallback): () => void {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

export function notifyCapabilityChange(manifest: CapabilityManifest): void {
  listeners.forEach(cb => cb(manifest));
}
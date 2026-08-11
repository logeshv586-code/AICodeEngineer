/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useState, useEffect } from 'react';
import { ModelCapability, createCapabilityManifest, CapabilityManifest } from '../utils/modelCapabilityManifest.js';
import { VoidSettingsState } from '../../../../common/voidSettingsService.js';

export function useModelCapabilities(
  settingsState: VoidSettingsState,
  featureName: string = 'Chat',
): ModelCapability | null {
  const [capabilities, setCapabilities] = useState<ModelCapability | null>(null);

  useEffect(() => {
    const modelSel = settingsState.modelSelectionOfFeature[featureName as keyof typeof settingsState.modelSelectionOfFeature];
    if (!modelSel) {
      setCapabilities(null);
      return;
    }

    const { providerName, modelName } = modelSel;
    const manifest = createCapabilityManifest(providerName, modelName, settingsState);
    setCapabilities(manifest.capabilities);
  }, [settingsState.modelSelectionOfFeature, settingsState.overridesOfModel, featureName]);

  return capabilities;
}

export function useCapabilityManifest(
  settingsState: VoidSettingsState,
  featureName: string = 'Chat',
): CapabilityManifest | null {
  const [manifest, setManifest] = useState<CapabilityManifest | null>(null);

  useEffect(() => {
    const modelSel = settingsState.modelSelectionOfFeature[featureName as keyof typeof settingsState.modelSelectionOfFeature];
    if (!modelSel) {
      setManifest(null);
      return;
    }

    const { providerName, modelName } = modelSel;
    const newManifest = createCapabilityManifest(providerName, modelName, settingsState);
    setManifest(newManifest);
  }, [settingsState.modelSelectionOfFeature, settingsState.overridesOfModel, featureName]);

  return manifest;
}

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect } from 'react';
import { ModelCapability, createCapabilityManifest, onCapabilityChange, CapabilityManifest } from '../utils/modelCapabilityManifest.js';
import { VoidSettingsState } from '../../../../common/voidSettingsService.js';

interface ModelCapabilityDetectorProps {
  settingsState: VoidSettingsState;
  onCapabilitiesChange?: (manifest: CapabilityManifest) => void;
}

export const ModelCapabilityDetector: React.FC<ModelCapabilityDetectorProps> = ({
  settingsState,
  onCapabilitiesChange,
}) => {
  const [manifest, setManifest] = useState<CapabilityManifest | null>(null);
  const [capabilities, setCapabilities] = useState<ModelCapability | null>(null);

  useEffect(() => {
    const modelSel = settingsState.modelSelectionOfFeature['Chat'];
    if (!modelSel) {
      setCapabilities(null);
      setManifest(null);
      return;
    }

    const { providerName, modelName } = modelSel;
    const newManifest = createCapabilityManifest(providerName, modelName, settingsState);
    setManifest(newManifest);
    setCapabilities(newManifest.capabilities);

    if (onCapabilitiesChange) {
      onCapabilitiesChange(newManifest);
    }
  }, [settingsState.modelSelectionOfFeature, settingsState.overridesOfModel, onCapabilitiesChange]);

  useEffect(() => {
    return onCapabilityChange((newManifest) => {
      setManifest(newManifest);
      setCapabilities(newManifest.capabilities);
      if (onCapabilitiesChange) {
        onCapabilitiesChange(newManifest);
      }
    });
  }, [onCapabilitiesChange]);

  return { manifest, capabilities };
};
/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { SharedArtifact } from './artifactReference.js';

export interface BlackboardUpdatedPayload {
	readonly artifact: SharedArtifact;
	readonly action: 'published' | 'updated' | 'state_changed';
}

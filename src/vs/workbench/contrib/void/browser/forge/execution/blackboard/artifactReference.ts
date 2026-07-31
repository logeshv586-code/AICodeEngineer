/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export type SharedArtifactState = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'committed';

export interface SharedArtifact {
	readonly id: string;
	readonly type: 'code_patch' | 'test_log' | 'review_finding' | 'security_report' | 'deployment_status';
	readonly title: string;
	readonly producerAgentId: string;
	readonly consumerAgentIds: string[];
	readonly artifactId: string; // references ArtifactStore id
	readonly state: SharedArtifactState;
	readonly timestamp: number;
}

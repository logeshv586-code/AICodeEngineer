/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// ─── Conversation-First IDE Components ───────────────────────────────────────

export { ChatView } from './ChatView';
export { SimpleSidebar } from './SimpleSidebar';
export { ThreadList, buildThreadList } from './ThreadList';

// ─── Inline Rendering Components ─────────────────────────────────────────────

export { StreamRenderer, StreamStatus, extractAgentChips, extractPlanSteps } from './StreamRenderer';
export { PlanCard, InlinePlanSummary } from './PlanCard';
export { AgentChips, AgentChip, AgentStatusBar } from './AgentChips';
export { ExecutionDetails, ExecutionSummary } from './ExecutionDetails';

// ─── Composer ────────────────────────────────────────────────────────────────

export { ComposerControlCenter } from './ComposerControlCenter';

// ─── Legacy Workspace Components (kept for reference, not used in new UI) ────

export { AgentWorkspace } from './AgentWorkspace';
export { TopBar } from './TopBar';
export { LeftToolbar } from './LeftToolbar';
export { RightPanel } from './RightPanel';
export { BottomStatusBar } from './BottomStatusBar';
export { UniversalComposer } from './UniversalComposer';
export { AgentsView } from './AgentsView';
export { WorkflowsView } from './WorkflowsView';
export { PlanViewInWorkspace } from './PlanViewInWorkspace';

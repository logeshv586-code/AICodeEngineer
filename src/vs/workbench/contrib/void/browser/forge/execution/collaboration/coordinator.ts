import { DelegationManager } from './delegationManager.js';
import { ProgressAggregator } from './progressAggregator.js';
import { SharedBlackboard } from '../blackboard/blackboard.js';
import { ConsensusEngine } from '../consensus/consensusEngine.js';
import { ExecutionBus } from '../bus/executionBus.js';
import { ProgressSnapshot } from './collaborationTypes.js';

export class CollaborationCoordinator {
	private readonly delegationManager = new DelegationManager();
	private readonly progressAggregator = new ProgressAggregator();
	private readonly blackboard = SharedBlackboard.getInstance();
	private readonly consensus = new ConsensusEngine();

	constructor(
		private readonly bus: ExecutionBus = ExecutionBus.getInstance()
	) { }

	getProgress(completed: number, total: number, active: number): ProgressSnapshot {
		return this.progressAggregator.computeSnapshot(completed, total, active);
	}

	delegateTask(taskId: string, title: string, requiredRole: any): string {
		const match = this.delegationManager.findBestAgent({ taskId, title, requiredRole });
		const agentId = match?.agentId || 'agent-workspace-code';

		this.bus.publish('WORKER_ASSIGNED', { taskId, agentId, matchScore: match?.matchScore });
		return agentId;
	}

	recordArtifact(producerAgentId: string, title: string, type: any, artifactId: string): void {
		this.blackboard.publishArtifact({
			type,
			title,
			producerAgentId,
			consumerAgentIds: ['agent-review-gate'],
			artifactId,
			state: 'pending_review'
		});
	}

	requestMultiAgentApproval(topic: string, votes: { agentId: string; approved: boolean; confidence: number }[]): boolean {
		const result = this.consensus.requestConsensus(topic, votes, 'Majority');
		return result.approved;
	}
}

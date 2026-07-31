import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { PlannerOutput } from '../../../common/forge/planner/planSchema.js';
import { BrainManager } from '../brain/brainManager.js';
import { ForgeEventBus } from '../events/forgeEventBus.js';
import { ForgeExecutorService } from './executorService.js';
import { CodeEngineerAgent } from '../agents/code/codeAgent.js';
import { RAGAgent } from '../agents/rag/ragAgent.js';
import { WebResearchAgent } from '../agents/web/webAgent.js';
import { ReviewAgent } from '../agents/review/reviewAgent.js';
import { TestAgent } from '../agents/test/testAgent.js';
import { DeploymentAgent } from '../agents/deployment/deploymentAgent.js';
import { TaskDependencyNode } from '../../../common/forge/types/schedulerTypes.js';

export class ForgeRunnerService {
	private readonly agents = new Map<string, any>([
		['CodeEngineer', new CodeEngineerAgent()],
		['RAGAgent', new RAGAgent()],
		['WebResearchAgent', new WebResearchAgent()],
		['ReviewAgent', new ReviewAgent()],
		['TestAgent', new TestAgent()],
		['DeploymentAgent', new DeploymentAgent()]
	]);

	constructor(
		private readonly executor?: ForgeExecutorService,
		private readonly eventBus: ForgeEventBus = ForgeEventBus.getInstance(),
		private readonly brainManager: BrainManager = BrainManager.getInstance()
	) { }

	getEventBus(): ForgeEventBus {
		return this.eventBus;
	}

	getExecutor(): ForgeExecutorService | undefined {
		return this.executor;
	}

	async runPlan(plan: PlannerOutput, token?: CancellationToken): Promise<void> {
		const resolver = async (node: TaskDependencyNode, tok?: CancellationToken) => {
			const agent = this.agents.get(node.assignedAgentRole) || this.agents.get('CodeEngineer');
			return agent.execute(node.title, node.params || {}, tok);
		};

		await this.brainManager.handleUserQuery(plan.goal, resolver, token);
	}
}

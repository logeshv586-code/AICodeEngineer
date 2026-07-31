import { CancellationToken } from '../../../../../../../base/common/cancellation.js';
import { ExecutionPlanner } from '../planner/planner.js';
import { PlanOptimizer } from '../optimizer/planOptimizer.js';
import { TaskGraphBuilder } from '../graph/taskGraphBuilder.js';
import { ExecutionScheduler } from '../scheduler/scheduler.js';
import { ExecutionMemory } from './executionMemory.js';

export class AgentRuntime {
	private static instance?: AgentRuntime;
	private readonly planner = new ExecutionPlanner();
	private readonly optimizer = new PlanOptimizer();
	private readonly graphBuilder = new TaskGraphBuilder();
	private readonly scheduler = new ExecutionScheduler();
	private readonly memory = ExecutionMemory.getInstance();

	private constructor() { }

	public static getInstance(): AgentRuntime {
		if (!this.instance) {
			this.instance = new AgentRuntime();
		}
		return this.instance;
	}

	async executeGoal(userGoal: string, token?: CancellationToken): Promise<void> {
		// 1. Planner generates raw plan
		const rawPlan = await this.planner.createPlan(userGoal);

		// 2. PlanOptimizer optimizes raw steps
		const optimizedPlan = this.optimizer.optimizePlan(rawPlan);

		// 3. TaskGraphBuilder constructs DAG
		const graph = this.graphBuilder.buildGraph(optimizedPlan);

		// 4. ExecutionScheduler dispatches ready nodes to workers
		await this.scheduler.runGraph(graph, token);

		// 5. Record execution metadata in memory
		this.memory.saveRecord({
			id: rawPlan.id,
			goal: userGoal,
			status: graph.hasFailed() ? 'Failed' : 'Completed',
			artifactIds: graph.getAllNodes().map(n => n.artifactId).filter((id): id is string => Boolean(id)),
			timestamp: Date.now()
		});
	}
}

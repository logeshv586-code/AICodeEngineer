import { KnowledgeGraphSnapshot, WorkspaceHealthStats, KnowledgeEntity } from '../../../common/forge/types/knowledgeGraphTypes.js';

export class KnowledgeService {
	private static instance?: KnowledgeService;

	private constructor(private readonly channel: any) { }

	public static create(channel: any): KnowledgeService {
		if (!this.instance) {
			this.instance = new KnowledgeService(channel);
		}
		return this.instance;
	}

	async getKnowledgeGraph(workspacePath: string): Promise<KnowledgeGraphSnapshot | null> {
		return this._call<KnowledgeGraphSnapshot>('getKnowledgeGraph', { workspacePath });
	}

	async getWorkspaceHealth(workspacePath: string): Promise<WorkspaceHealthStats | null> {
		return this._call<WorkspaceHealthStats>('getWorkspaceHealth', { workspacePath });
	}

	async queryKnowledgeNeighbors(entityId: string): Promise<KnowledgeEntity[]> {
		const res = await this._call<KnowledgeEntity[]>('queryKnowledgeNeighbors', { entityId });
		return res ?? [];
	}

	private async _call<T>(command: string, args: Record<string, any>): Promise<T | null> {
		if (this.channel?.call) {
			return this.channel.call(command, args) as Promise<T>;
		}
		return null;
	}
}

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { TaskGraph } from './taskGraph.js';

export class GraphValidator {
	validate(graph: TaskGraph): { isValid: boolean; error?: string } {
		const nodes = graph.getAllNodes();
		const nodeIds = new Set(nodes.map(n => n.id));

		// Check for missing dependencies
		for (const node of nodes) {
			for (const depId of node.dependsOn) {
				if (!nodeIds.has(depId)) {
					return { isValid: false, error: `Task ${node.id} references missing dependency ${depId}` };
				}
			}
		}

		// Cycle detection
		const visited = new Set<string>();
		const inStack = new Set<string>();

		const dfs = (id: string): boolean => {
			visited.add(id);
			inStack.add(id);

			const node = graph.getNode(id);
			if (node) {
				for (const depId of node.dependsOn) {
					if (!visited.has(depId)) {
						if (dfs(depId)) return true;
					} else if (inStack.has(depId)) {
						return true;
					}
				}
			}

			inStack.delete(id);
			return false;
		};

		for (const node of nodes) {
			if (!visited.has(node.id)) {
				if (dfs(node.id)) {
					return { isValid: false, error: `Cycle detected in TaskGraph` };
				}
			}
		}

		return { isValid: true };
	}
}

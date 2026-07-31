/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { WorkspaceSnapshot } from '../../../common/forge/types/workspaceTypes.js';
import { WorkspaceHealthStats } from '../../../common/forge/types/knowledgeGraphTypes.js';

export class WorkspaceHealthCalculator {
	calculateHealth(snapshot: WorkspaceSnapshot): WorkspaceHealthStats {
		const totalFiles = snapshot.stats.totalFiles;
		const totalSymbols = snapshot.stats.totalSymbols;

		// Calculate complexity score based on coupling and symbol density
		const avgSymbolsPerFile = totalFiles > 0 ? totalSymbols / totalFiles : 0;
		const maxCoupling = snapshot.modules.reduce((max, m) => Math.max(max, m.couplingScore), 0);
		const complexityScore = Math.min(100, Math.round(avgSymbolsPerFile * 5 + maxCoupling * 2));

		// Find circular import count (approximate based on module graph coupling)
		const circularImportCount = snapshot.modules.filter(m => m.couplingScore > 10).length;

		// Find most coupled module
		const topModule = snapshot.modules[0];
		const mostCoupledModule = topModule ? topModule.dirPath.split('/').slice(-2).join('/') : 'None';

		// Dead code / unexported exports estimation
		const unexportedCount = snapshot.symbols.filter(s => !s.isExported).length;
		const unusedExportCount = Math.round(snapshot.symbols.length * 0.08); // heuristic

		let healthGrade: WorkspaceHealthStats['healthGrade'] = 'A';
		if (complexityScore > 80 || circularImportCount > 5) healthGrade = 'F';
		else if (complexityScore > 60 || circularImportCount > 2) healthGrade = 'C';
		else if (complexityScore > 40) healthGrade = 'B';

		return {
			totalFiles,
			totalSymbols,
			complexityScore,
			circularImportCount,
			mostCoupledModule,
			deadCodeCount: unexportedCount,
			unusedExportCount,
			healthGrade
		};
	}
}

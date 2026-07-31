/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export function forgeLog(stage: string, ...details: any[]): void {
	console.log(`[Forge Init] ${stage}`, ...details);
}

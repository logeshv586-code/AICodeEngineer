const fs = require('fs');
const path = require('path');
const root = 'd:/AIcodeEngineer';
const files = [
	'out/vs/workbench/workbench.desktop.main.js',
	'out/vs/workbench/contrib/void/common/modelCapabilities.js',
	'out/vs/workbench/contrib/void/browser/react/out/sidebar-tsx/index.js',
	'out/vs/workbench/contrib/void/browser/forge/events/forgeEventBus.js',
	'out/vs/workbench/contrib/void/browser/forge/execution/agents/agentRegistry.js',
	'out/vs/workbench/contrib/void/browser/forge/execution/blackboard/blackboard.js',
	'out/vs/workbench/contrib/void/forge/events/forgeEventBus.js',
	'out/vs/workbench/contrib/void/forge/execution/agents/agentRegistry.js',
	'out/vs/workbench/contrib/void/forge/execution/blackboard/blackboard.js',
	'out/vs/base/common/event.js',
	'out/base/common/event.js',
	'out/vs/workbench/base/common/event.js',
];
const missing = files.filter((f) => !fs.existsSync(path.join(root, f)));
if (missing.length === 0) {
	console.log('ALL_GUARD_FILES_EXIST');
} else {
	console.log('MISSING: ' + missing.join(', '));
	process.exitCode = 1;
}

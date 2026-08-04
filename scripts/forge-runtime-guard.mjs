import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredRuntimeFiles = [
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
const coreRuntimeFiles = [
	'out/vs/workbench/workbench.desktop.main.js',
	'out/vs/workbench/contrib/void/common/modelCapabilities.js',
	'out/vs/workbench/contrib/void/browser/forge/events/forgeEventBus.js',
	'out/vs/workbench/contrib/void/browser/forge/execution/agents/agentRegistry.js',
	'out/vs/workbench/contrib/void/browser/forge/execution/blackboard/blackboard.js',
	'out/vs/base/common/event.js',
];

const missingFiles = () => requiredRuntimeFiles.filter(file => !fs.existsSync(path.join(workspaceRoot, file)));

const run = (command, args) => {
	console.log(`[forge-guard] Running ${command} ${args.join(' ')}`);
	const result = spawnSync(command, args, {
		cwd: workspaceRoot,
		stdio: 'inherit',
		shell: process.platform === 'win32',
	});
	if (result.error) {
		console.error(`[forge-guard] Could not run ${command}: ${result.error.message}`);
		return result.status ?? 1;
	}
	return result.status ?? 1;
};

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const initialMissing = coreRuntimeFiles.filter(file => !fs.existsSync(path.join(workspaceRoot, file)));

if (initialMissing.length > 0) {
	console.warn('[forge-guard] Missing runtime artifacts:');
	initialMissing.forEach(file => console.warn(`  - ${file}`));
	if (run(npmCommand, ['run', 'compile']) !== 0) {
		process.exit(1);
	}
}

// Always rebuild React because it also synchronizes the Forge compatibility
// paths created by build.js after a clean core compile.
if (run(npmCommand, ['run', 'buildreact']) !== 0) {
	process.exit(1);
}

const remainingMissing = missingFiles();
if (remainingMissing.length > 0) {
	console.error('[forge-guard] Refusing to launch: runtime artifacts are still missing.');
	remainingMissing.forEach(file => console.error(`  - ${file}`));
	process.exit(1);
}

console.log('[forge-guard] Runtime artifacts verified.');

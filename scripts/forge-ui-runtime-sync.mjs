import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const runtimeChatModeAction = path.join(
	workspaceRoot,
	'out/vs/workbench/contrib/void/browser/chatModeActions.js',
);

const runtimeReactOut = path.join(
	workspaceRoot,
	'out/vs/workbench/contrib/void/browser/react/out',
);

const run = (args) => {
	const result = spawnSync(npm, args, {
		cwd: workspaceRoot,
		stdio: 'inherit',
		shell: process.platform === 'win32',
	});

	if (result.error) {
		console.error(`[forge-ui-sync] Could not run ${npm} ${args.join(' ')}: ${result.error.message}`);
		return result.status ?? 1;
	}

	return result.status ?? 1;
};

// The normal Code-OSS prelaunch only compiles when the whole `out` directory is
// missing. Forge can therefore retain an older compiled contribution after a pull.
// Compile once when the chat-mode command introduced by the current source tree is
// not present in the runtime output.
if (!fs.existsSync(runtimeChatModeAction)) {
	console.log('[forge-ui-sync] Forge contribution output is stale; compiling current sources.');
	if (run(['run', 'compile']) !== 0) process.exit(1);
}

// React build.js mirrors the current conversation-first bundle into the Code-OSS
// runtime tree. Remove the old mirror first so a previously generated Forge landing
// screen cannot be restored during startup from a stale bundle.
fs.rmSync(runtimeReactOut, { recursive: true, force: true });
console.log('[forge-ui-sync] Refreshing Forge conversation UI runtime.');
if (run(['run', 'buildreact']) !== 0) process.exit(1);

console.log('[forge-ui-sync] Forge UI runtime is current.');

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// These modules sit on the startup/import path for the Void/Forge contribution and
// React service bridge. A stale or partial `out` tree can still contain
// workbench.desktop.main.js while missing one of these files, which makes Electron
// fail the whole dynamic workbench import with ERR_FILE_NOT_FOUND. Keep them in the
// core probe so normal launch self-repairs by running a clean Code-OSS compile.
const startupServiceRuntimeFiles = [
	'out/vs/workbench/contrib/void/common/mcpService.js',
	'out/vs/workbench/contrib/void/common/metricsService.js',
	'out/vs/workbench/contrib/void/common/voidSettingsService.js',
	'out/vs/workbench/contrib/void/common/voidSettingsTypes.js',
	'out/vs/workbench/contrib/void/common/storageKeys.js',
	'out/vs/workbench/contrib/void/common/sendLLMMessageService.js',
	'out/vs/workbench/contrib/void/common/voidModelService.js',
	'out/vs/workbench/contrib/void/common/refreshModelService.js',
	'out/vs/workbench/contrib/void/common/forge/contracts/ISemanticSearchService.js',
	'out/vs/workbench/contrib/void/common/forge/intelligence/adaptiveModelRouter.js',
	'out/vs/workbench/contrib/void/common/forge/intelligence/taskProfile.js',
	'out/vs/workbench/contrib/void/browser/forge/semanticSearchService.js',
];

const requiredRuntimeFiles = [
	'out/vs/workbench/workbench.desktop.main.js',
	'out/vs/workbench/contrib/void/common/modelCapabilities.js',
	...startupServiceRuntimeFiles,
	'out/vs/workbench/contrib/void/browser/react/out/sidebar-tsx/index.js',
	'out/vs/workbench/contrib/void/browser/forge/events/forgeEventBus.js',
	'out/vs/workbench/contrib/void/browser/forge/execution/agents/agentRegistry.js',
	'out/vs/workbench/contrib/void/browser/forge/execution/blackboard/blackboard.js',
	'out/vs/workbench/contrib/void/forge/semanticSearchService.js',
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
	...startupServiceRuntimeFiles,
	'out/vs/workbench/contrib/void/browser/forge/events/forgeEventBus.js',
	'out/vs/workbench/contrib/void/browser/forge/execution/agents/agentRegistry.js',
	'out/vs/workbench/contrib/void/browser/forge/execution/blackboard/blackboard.js',
	'out/vs/base/common/event.js',
];
const requiredSuperAgentFiles = [
	'forge-integrations.lock.json',
	'install-forge-super-agent.bat',
	'setup-forge-super-agent.bat',
	'scripts/forge-super-agent-bootstrap.mjs',
	'scripts/forge-super-agent-self-test.mjs',
	'scripts/forge-ui-contract-test.mjs',
	'scripts/forge-brand-contract-test.mjs',
	'scripts/forge-work-self-test.mjs',
	'scripts/forge-mcp-server.mjs',
	'scripts/forge-integrations.mjs',
	'scripts/forge-node24-runtime.mjs',
	'scripts/forge-work.mjs',
	'scripts/forge-work-daemon.mjs',
	'scripts/forge-understand.mjs',
	'scripts/forge-learning.mjs',
	'scripts/forge-sidecars.mjs',
	'scripts/lib/forge-browser-controller.mjs',
	'resources/forge/forge-mark.svg',
	'resources/win32/code.ico',
	'resources/win32/code_150x150.png',
	'resources/win32/code_70x70.png',
	'resources/linux/code.png',
	'resources/darwin/code.icns',
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
const nodeCommand = process.execPath;
const initialMissing = coreRuntimeFiles.filter(file => !fs.existsSync(path.join(workspaceRoot, file)));

if (initialMissing.length > 0) {
	console.warn('[forge-guard] Incomplete core runtime output detected; rebuilding the clean TypeScript output tree:');
	initialMissing.forEach(file => console.warn(`  - ${file}`));
	if (run(npmCommand, ['run', 'compile']) !== 0) process.exit(1);
}

// Rebuild React because build.js also synchronizes Forge compatibility paths.
if (run(npmCommand, ['run', 'buildreact']) !== 0) process.exit(1);

const remainingMissing = missingFiles();
if (remainingMissing.length > 0) {
	console.error('[forge-guard] Refusing to launch: runtime artifacts are still missing after repair.');
	remainingMissing.forEach(file => console.error(`  - ${file}`));
	console.error('[forge-guard] The missing path above is now a build-output defect, not a stale-cache condition.');
	process.exit(1);
}

const missingSuperAgent = requiredSuperAgentFiles.filter(file => !fs.existsSync(path.join(workspaceRoot, file)));
if (missingSuperAgent.length > 0) {
	console.error('[forge-guard] Refusing to launch: Super Agent or Forge brand assets are missing.');
	missingSuperAgent.forEach(file => console.error(`  - ${file}`));
	process.exit(1);
}

if (run(nodeCommand, ['scripts/forge-brand-contract-test.mjs']) !== 0) {
	console.error('[forge-guard] Refusing to launch: Forge brand/product contract failed.');
	process.exit(1);
}

const registryFile = path.join(workspaceRoot, 'skill_registry.json');
if (!fs.existsSync(registryFile)) {
	console.error('[forge-guard] Missing skill_registry.json at application root.');
	process.exit(1);
}

try {
	const registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
	const skills = Array.isArray(registry) ? registry : (registry.skills || []);

	if (typeof registry.skillCount === 'number' && registry.skillCount !== skills.length) {
		console.error(`[forge-guard] Registry count mismatch: expected ${registry.skillCount}, found ${skills.length}`);
		process.exit(1);
	}
	if (skills.length !== 333) {
		console.error(`[forge-guard] Expected 333 registered skills, found ${skills.length}.`);
		process.exit(1);
	}

	let missingSkillFiles = 0;
	for (const skill of skills) {
		const fullPath = path.join(workspaceRoot, skill.path);
		if (!fs.existsSync(fullPath)) {
			console.error(`[forge-guard] Missing packaged skill file: ${skill.id} -> ${skill.path}`);
			missingSkillFiles++;
		}
	}
	if (missingSkillFiles > 0) {
		console.error(`[forge-guard] Refusing to launch: ${missingSkillFiles} skill files missing.`);
		process.exit(1);
	}
} catch (e) {
	console.error(`[forge-guard] Failed to parse skill_registry.json: ${e.message}`);
	process.exit(1);
}

try {
	const integrations = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'forge-integrations.lock.json'), 'utf8'));
	const entries = Object.entries(integrations.integrations || {});
	if (entries.length !== 5) {
		console.error(`[forge-guard] Expected 5 pinned Super Agent integrations, found ${entries.length}.`);
		process.exit(1);
	}
	for (const [name, spec] of entries) {
		if (!/^[0-9a-f]{40}$/i.test(spec.commit || '')) {
			console.error(`[forge-guard] Integration ${name} is not pinned to a full commit SHA.`);
			process.exit(1);
		}
		if (!/^https:\/\/github\.com\//i.test(spec.repo || '')) {
			console.error(`[forge-guard] Integration ${name} must use an explicit GitHub source URL.`);
			process.exit(1);
		}
	}
} catch (e) {
	console.error(`[forge-guard] Invalid forge-integrations.lock.json: ${e.message}`);
	process.exit(1);
}

console.log('[forge-guard] Runtime artifacts, startup services, Forge brand, 333-skill library, and Super Agent assets verified.');
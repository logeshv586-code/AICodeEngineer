import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const mustContain = (name, text, values) => {
	const missing = values.filter(value => !text.includes(value));
	if (missing.length) {
		console.error(`[forge-autonomous-contract] ${name} is missing:`);
		for (const value of missing) console.error(`  - ${value}`);
		process.exit(1);
	}
};

const policy = read('src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/utils/autonomousTaskPolicy.ts');
const chatView = read('src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/ChatView.tsx');
const slash = read('src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/utils/slashCommandRouter.tsx');
const conversion = read('src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts');
const runtimeGuard = read('scripts/forge-runtime-guard.mjs');

mustContain('autonomousTaskPolicy.ts', policy, [
	'FORGE AUTONOMOUS RUNTIME V1',
	'current user/task instruction > project-local rules (.voidrules and project skills) > saved/global user AI instructions > generic Forge defaults',
	'Parallelize independent read-only investigation',
	'PDF/DOC/DOCX/XLS/XLSX/PPT/PPTX/CSV',
	'never say complete merely because files were edited',
	'observed symptom -> evidence -> root cause -> repair -> regression test',
	'prepareAutonomousTask',
]);

mustContain('ChatView.tsx', chatView, [
	"prepareAutonomousTask({",
	"docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'",
	"xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'",
	"pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'",
	"extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'rtf'",
	'Understand every relevant attachment',
]);

mustContain('slashCommandRouter.tsx', slash, [
	"name: '/agent,finish'",
	"name: '/agent,project'",
	"name: '/agent,requirements'",
	"name: '/agent,ui'",
	"name: '/agent,verify'",
	"name: '/plugins'",
	"name: '/preferences'",
	'Connected capability servers:',
]);

mustContain('convertToLLMMessageService.ts', conversion, [
	"state.globalSettings.aiInstructions",
	"URI.joinPath(folder.uri, '.voidrules')",
	'prepareSkillContext(lastUserContent)',
	'injectImageAttachments(messages, imageAttachments, providerName)',
]);

mustContain('forge-runtime-guard.mjs', runtimeGuard, [
	"FORGE_SKIP_REACT_REBUILD === '1'",
	'React rebuild already completed by the caller; verifying artifacts only.',
]);

console.log('[forge-autonomous-contract] Autonomous runtime, preferences, skills/plugins, rich attachments, verification loop, and no-duplicate React guard contracts verified.');

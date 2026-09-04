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
const mcp = read('scripts/forge-mcp-server.mjs');
const docNode = read('scripts/forge-document-reader.mjs');
const docPython = read('scripts/forge-document-reader.py');

mustContain('autonomousTaskPolicy.ts', policy, [
	'FORGE AUTONOMOUS RUNTIME V1',
	'current user/task instruction > project-local rules (.voidrules and project skills) > saved/global user AI instructions > generic Forge defaults',
	'Parallelize independent read-only investigation',
	'For PDF/DOCX/XLSX/PPTX/CSV/RTF use forge_document when available',
	'never say complete merely because files were edited',
	'observed symptom -> evidence -> root cause -> repair -> regression test',
	'prepareAutonomousTask',
]);

mustContain('ChatView.tsx', chatView, [
	'prepareAutonomousTask({',
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
	'state.globalSettings.aiInstructions',
	"URI.joinPath(folder.uri, '.voidrules')",
	'prepareSkillContext(lastUserContent)',
	'injectImageAttachments(messages, imageAttachments, providerName)',
]);

mustContain('forge-mcp-server.mjs', mcp, [
	"name: 'forge_document'",
	"args.action === 'read'",
	'readDocument({ path: args.path, maxChars: args.maxChars })',
]);

mustContain('forge-document-reader.mjs', docNode, [
	'documentStatus',
	'readDocument',
	"['pdf', 'docx', 'xlsx', 'pptx', 'csv', 'rtf'",
]);

mustContain('forge-document-reader.py', docPython, [
	'def read_pdf(path: str)',
	'def read_docx(path: str)',
	'def read_xlsx(path: str)',
	'def read_pptx(path: str)',
	"Legacy {ext} binary format is not parsed directly",
]);

mustContain('forge-runtime-guard.mjs', runtimeGuard, [
	"'scripts/forge-document-reader.mjs'",
	"'scripts/forge-document-reader.py'",
	"FORGE_SKIP_REACT_REBUILD === '1'",
	'React rebuild already completed by the caller; verifying artifacts only.',
]);

console.log('[forge-autonomous-contract] Autonomous runtime, preferences, skills/plugins, document/image ingestion, verification loop, and optimized runtime guard contracts verified.');

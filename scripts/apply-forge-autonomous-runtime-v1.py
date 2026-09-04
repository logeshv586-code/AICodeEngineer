from pathlib import Path


def replace_once(path: str, before: str, after: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if after in text:
        return
    count = text.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one match, found {count}')
    p.write_text(text.replace(before, after, 1), encoding='utf-8')


policy_path = Path('src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/utils/autonomousTaskPolicy.ts')
policy_path.parent.mkdir(parents=True, exist_ok=True)
policy_path.write_text(r'''/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export interface ForgeAttachmentDescriptor {
	readonly uri: string;
	readonly name?: string;
	readonly mimeType: string;
}

export interface AutonomousTaskInput {
	readonly userText: string;
	readonly expandedText?: string;
	readonly attachments?: readonly ForgeAttachmentDescriptor[];
}

type ForgeTaskKind = 'conversation' | 'inspect' | 'code' | 'fix' | 'test' | 'run' | 'review' | 'requirements' | 'ui';

const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'rtf', 'odt', 'ods', 'odp']);
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg']);

const extensionOf = (value: string): string => value.split(/[?#]/, 1)[0].split('.').pop()?.toLowerCase() || '';

const inferTaskKind = (text: string, attachments: readonly ForgeAttachmentDescriptor[]): ForgeTaskKind => {
	const lower = text.toLowerCase();
	const hasDocument = attachments.some(item => DOCUMENT_EXTENSIONS.has(extensionOf(item.name || item.uri)) || /pdf|word|excel|spreadsheet|presentation|csv/.test(item.mimeType));
	const hasImage = attachments.some(item => item.mimeType.startsWith('image/') || IMAGE_EXTENSIONS.has(extensionOf(item.name || item.uri)));
	if (hasDocument || /\b(requirement|requirements|frs|srs|specification|pdf|document|spreadsheet|excel|word|ppt|presentation)\b/.test(lower)) return 'requirements';
	if (hasImage || /\b(screenshot|image|pixel|visual|ui|ux|layout|design)\b/.test(lower)) return 'ui';
	if (/\b(run|start|launch|serve|execute)\b/.test(lower)) return 'run';
	if (/\b(test|tests|lint|typecheck|type check|compile|build|verify|verification)\b/.test(lower)) return 'test';
	if (/\b(review|audit|security|performance|regression)\b/.test(lower)) return 'review';
	if (/\b(fix|bug|debug|error|broken|failing|crash|issue|problem)\b/.test(lower)) return 'fix';
	if (/\b(create|implement|add|edit|change|update|remove|delete|refactor|migrate|convert|integrate|develop|make)\b/.test(lower)) return 'code';
	if (/\b(inspect|understand|explain|analyze|analyse|search|find|locate|architecture)\b/.test(lower)) return 'inspect';
	return 'conversation';
};

const shouldUseAutonomousRuntime = (text: string, kind: ForgeTaskKind, attachments: readonly ForgeAttachmentDescriptor[]): boolean => {
	if (attachments.length > 0) return true;
	if (kind !== 'conversation') return true;
	const trimmed = text.trim();
	if (trimmed.length > 120) return true;
	return /\b(project|workspace|codebase|repository|repo|agent|plugin|skill|mcp)\b/i.test(trimmed);
};

const attachmentSummary = (attachments: readonly ForgeAttachmentDescriptor[]): string => {
	if (!attachments.length) return 'No explicit attachment metadata was supplied.';
	return attachments.map((item, index) => `${index + 1}. ${item.name || item.uri} (${item.mimeType || 'unknown type'})`).join('\n');
};

const kindDirective = (kind: ForgeTaskKind): string => {
	switch (kind) {
		case 'run': return 'RUN MODE: determine the real start command from project files, execute it in the terminal, inspect real output, and verify the process/application actually starts. Opening a terminal alone is never completion.';
		case 'fix': return 'FIX MODE: reproduce or inspect the failure, identify root cause rather than symptoms, make the smallest coherent repair, then run targeted regression verification.';
		case 'test': return 'TEST MODE: determine the project\'s real verification commands, run them, diagnose actionable failures, fix failures caused by the implementation, and rerun until the relevant gate is green or a concrete external blocker is proven.';
		case 'review': return 'REVIEW MODE: inspect the relevant code and current diff for correctness, security, performance, maintainability, compatibility, and regressions. Fix confirmed issues when safe and verify the resulting behavior.';
		case 'requirements': return 'REQUIREMENTS MODE: understand attached/source requirements before editing. Preserve page/sheet/slide/file references where available, map requirements to code/modules, implement the mapped work, and verify each implemented requirement. Never invent unreadable binary content.';
		case 'ui': return 'UI MODE: understand the supplied visual/design context, inspect the existing UI implementation, make production-ready edits, and use browser/runtime verification when available. Preserve behavior while correcting visual and interaction defects.';
		case 'inspect': return 'INSPECTION MODE: gather only the context needed, combine exact and semantic search, explain findings with concrete file/symbol evidence, and do not edit unless the user requested a change.';
		case 'code': return 'IMPLEMENTATION MODE: inspect architecture and nearby patterns first, make coherent production-ready changes, preserve established conventions, then run the narrowest useful verification followed by broader gates when justified.';
		default: return 'ASSIST MODE: answer naturally. If the request turns into workspace work, switch to the full autonomous execution contract before changing files.';
	}
};

export const prepareAutonomousTask = ({ userText, expandedText, attachments = [] }: AutonomousTaskInput): string => {
	const original = userText.trim();
	const effective = (expandedText || original).trim();
	const kind = inferTaskKind(original, attachments);
	if (!shouldUseAutonomousRuntime(original, kind, attachments)) return effective;

	return `${effective}\n\n---\nFORGE AUTONOMOUS RUNTIME V1\n${kindDirective(kind)}\n\nEXECUTION CONTRACT\n1. OWNERSHIP: You are the coordinating coding engineer for this task. Continue through understanding, implementation, debugging, verification, and final review without asking the user for the next routine step. Ask only when a genuinely missing decision cannot be inferred safely.\n2. INSTRUCTION PRECEDENCE: current user/task instruction > project-local rules (.voidrules and project skills) > saved/global user AI instructions > generic Forge defaults. Do not silently override an explicit project or task constraint.\n3. PROJECT INTELLIGENCE: identify the opened project/workspace, stack, manifests, build/test commands, architecture boundaries, and relevant modules before broad edits. Do not read the whole repository when targeted search is enough.\n4. SEARCH AND CONTEXT: use exact text/symbol/file search first when the target is known; use semantic search/code graph when meaning or cross-file relationships matter. Read the smallest useful ranges, follow references, and re-read changed regions before another write.\n5. SKILLS, AGENTS, MCP AND PLUGINS: use project-local skills automatically when routed; use explicit registry skills/MCP/plugin tools when they materially improve the task. Parallelize independent read-only investigation when useful, but serialize or coordinate writes so agents never overwrite each other. One orchestrator owns the final result.\n6. ATTACHMENTS: inspect every relevant attachment before acting. Images must be treated as visual context. For PDF/DOC/DOCX/XLS/XLSX/PPT/PPTX/CSV or other binary documents, use an available document-capable tool/MCP/plugin or parser. If no tool can actually read a binary attachment, state that exact blocker instead of fabricating its contents.\n7. EDITING: prefer minimal coherent edits that preserve architecture, public APIs, style, security boundaries, and user data. Search callers/references before signature or schema changes. Keep unrelated churn out of the diff.\n8. BUG LOGIC: for failures, establish observed symptom -> evidence -> root cause -> repair -> regression test. Do not stop at the first plausible explanation.\n9. VERIFICATION LOOP: choose verification from the real project (targeted tests, lint, type checks, compile/build, runtime/browser checks). Inspect failures, fix actionable causes, and rerun. Continue until the requested behavior is proven or a concrete external blocker remains.\n10. DONE GATE: never say complete merely because files were edited. Completion requires the requested behavior implemented, relevant diagnostics/tests/build checks passing, changed diff reviewed, user constraints re-checked, and no known regression left unreported. If a gate cannot run, report exactly which gate and why.\n11. FINAL RESPONSE: be concise and evidence-based: outcome, important files/areas changed, verification performed/results, and only genuine remaining blockers.\n\nATTACHMENTS\n${attachmentSummary(attachments)}\n\nORIGINAL USER REQUEST\n${original}`;
};
''', encoding='utf-8')

chat_view = 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/ChatView.tsx'
replace_once(
    chat_view,
    "import { ITerminalToolService } from '../../../../terminalToolService.js';\n",
    "import { ITerminalToolService } from '../../../../terminalToolService.js';\nimport { prepareAutonomousTask } from '../utils/autonomousTaskPolicy';\n",
)
replace_once(
    chat_view,
    "\t\tpdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', json: 'application/json', jsonl: 'application/jsonl',\n",
    "\t\tpdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',\n\t\txls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',\n\t\tppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',\n\t\tcsv: 'text/csv', rtf: 'application/rtf', txt: 'text/plain', md: 'text/markdown', json: 'application/json', jsonl: 'application/jsonl',\n",
)
replace_once(
    chat_view,
    "\t\tconst prepared = expandForgeCommand(raw);\n",
    "\t\tconst expanded = expandForgeCommand(raw);\n\t\tconst prepared = prepareAutonomousTask({\n\t\t\tuserText: raw,\n\t\t\texpandedText: expanded,\n\t\t\tattachments: effectiveAttachments.map(attachment => ({ uri: attachment.uri, name: attachment.name, mimeType: attachment.mimeType })),\n\t\t});\n",
)
replace_once(
    chat_view,
    "\t}, [ensurePersistentRunTerminal, handleLocalSkillCommand, notify, onOpenSettings, onSendMessage, slashContext]);\n",
    "\t}, [effectiveAttachments, ensurePersistentRunTerminal, handleLocalSkillCommand, notify, onOpenSettings, onSendMessage, slashContext]);\n",
)
replace_once(
    chat_view,
    "\t\tconst text = draftText.trim() || (effectiveAttachments.length > 0 ? 'Inspect the attached context and complete the requested work. Read relevant files first, make the necessary changes, and verify the result.' : '');\n",
    "\t\tconst text = draftText.trim() || (effectiveAttachments.length > 0 ? 'Understand every relevant attachment, map its requirements or visual evidence to the opened project, implement the requested outcome, and run the relevant verification until it is complete or a concrete blocker is proven.' : '');\n",
)
replace_once(
    chat_view,
    "extensions: ['pdf', 'txt', 'md', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'json', 'jsonl', 'css', 'scss', 'html', 'svg', 'xml', 'yaml', 'yml', 'toml', 'rs', 'go', 'java', 'kt', 'kts', 'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'rb', 'sh', 'ps1', 'sql']",
    "extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'rtf', 'txt', 'md', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'json', 'jsonl', 'css', 'scss', 'html', 'svg', 'xml', 'yaml', 'yml', 'toml', 'rs', 'go', 'java', 'kt', 'kts', 'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'rb', 'sh', 'ps1', 'sql']",
)

slash_router = 'src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/utils/slashCommandRouter.tsx'
replace_once(
    slash_router,
    "\t\t{ name: '/agent,explain', label: 'Explain Code', category: 'Agent', description: 'Explain relevant architecture and flow', icon: <MessageSquare size={14} />, execute() { sendMessage('Explain the relevant code and architecture for the current task. Read only the context needed and identify important data/control flow.'); } },\n",
    "\t\t{ name: '/agent,explain', label: 'Explain Code', category: 'Agent', description: 'Explain relevant architecture and flow', icon: <MessageSquare size={14} />, execute() { sendMessage('Explain the relevant code and architecture for the current task. Read only the context needed and identify important data/control flow.'); } },\n\t\t{ name: '/agent,finish', label: 'Finish Completely', category: 'Agent', description: 'Continue the current task through strict verification and completion', icon: <CheckCircle size={14} />, execute(commandContext) { sendMessage(`Finish this task completely. Re-read the request and current workspace state, complete missing implementation, run the relevant verification loop, fix failures, review the final diff, and do not claim done until the requested behavior is proven or a concrete blocker is identified. ${commandContext.args}`.trim()); } },\n\t\t{ name: '/agent,project', label: 'Understand Project', category: 'Agent', description: 'Build focused project intelligence before acting', icon: <Brain size={14} />, execute(commandContext) { sendMessage(`Understand this project for the requested goal: identify stack, manifests, architecture, important modules, build/test commands, project rules, relevant skills and dependencies. Use exact plus semantic search as needed, then continue with the requested work. ${commandContext.args}`.trim()); } },\n\t\t{ name: '/agent,requirements', label: 'Implement Requirements', category: 'Agent', description: 'Read attached requirements and implement them in the project', icon: <ListChecks size={14} />, execute(commandContext) { sendMessage(`Read and understand the attached requirement sources first, map each actionable requirement to the project, implement the mapped changes, verify them, and report any requirement that could not be validated. Never invent unreadable document content. ${commandContext.args}`.trim()); } },\n\t\t{ name: '/agent,ui', label: 'Visual UI Fix', category: 'Agent', description: 'Use screenshot/image context and browser verification for UI work', icon: <Palette size={14} />, execute(commandContext) { sendMessage(`Treat attached images/screenshots as visual evidence. Inspect the existing UI, implement the requested visual and interaction changes, preserve behavior, and verify with the browser/runtime when available. ${commandContext.args}`.trim()); } },\n\t\t{ name: '/agent,verify', label: 'Strict Verify', category: 'Agent', description: 'Run the project-specific done gate and fix failures', icon: <FlaskConical size={14} />, execute(commandContext) { sendMessage(`Run the strict done gate for this task: relevant tests, lint/type checks, compile/build, runtime or browser checks where applicable, and final diff review. Diagnose and fix actionable failures, rerun checks, and report only genuine blockers. ${commandContext.args}`.trim()); } },\n",
)
replace_once(
    slash_router,
    "\t\t{ name: '/attach', label: 'Attach File', category: 'System', description: 'Attach code or a document to the next agent task', icon: <FileText size={14} />, execute() { dispatchAttachmentPicker('file'); } },\n",
    "\t\t{ name: '/plugins', label: 'Plugins & MCP', category: 'System', description: 'Show connected MCP/plugin capability servers', icon: <Network size={14} />, execute() { const tools = accessor.get(IMCPService).getMCPTools() || []; const servers = [...new Set(tools.map(tool => tool.mcpServerName))].sort(); notify(accessor, servers.length ? `Connected capability servers: ${servers.join(', ')} (${tools.length} tools).` : 'No MCP/plugin capability servers are currently connected.', servers.length ? 'info' : 'warn'); } },\n\t\t{ name: '/preferences', label: 'Preference Rules', category: 'System', description: 'Explain Forge instruction precedence', icon: <Settings size={14} />, execute() { notify(accessor, 'Forge preference order: current task > project .voidrules/project skills > global AI instructions > generic defaults.'); } },\n\t\t{ name: '/attach', label: 'Attach File', category: 'System', description: 'Attach code or a document to the next agent task', icon: <FileText size={14} />, execute() { dispatchAttachmentPicker('file'); } },\n",
)
replace_once(
    slash_router,
    "Forge commands: Agent /agent,* · Evolution /evolve /evolve,skills · Workflow /workflow,start /workflow,stop · Super Agent /browser /graph /design /work /work-pending /work-approve /health · Skills /skill /skills · Tools /terminal /run,* /git,* · Memory /workspace,index · System /models /settings.",
    "Forge commands: Agent /agent,* including /agent,finish /agent,project /agent,requirements /agent,ui /agent,verify · Evolution /evolve /evolve,skills · Workflow /workflow,start /workflow,stop · Super Agent /browser /graph /design /work /work-pending /work-approve /health · Skills /skill /skills · Tools /terminal /run,* /git,* · Memory /workspace,index · System /plugins /preferences /models /attach /image /settings.",
)

runtime_guard = 'scripts/forge-runtime-guard.mjs'
replace_once(
    runtime_guard,
    "// Rebuild React because build.js also synchronizes Forge compatibility paths.\nif (run(npmCommand, ['run', 'buildreact']) !== 0) process.exit(1);\n",
    "// Rebuild React because build.js also synchronizes Forge compatibility paths. CI may\n// explicitly build React immediately before this guard and opt out of the duplicate work.\nif (process.env.FORGE_SKIP_REACT_REBUILD === '1') {\n\tconsole.log('[forge-guard] React rebuild already completed by the caller; verifying artifacts only.');\n} else if (run(npmCommand, ['run', 'buildreact']) !== 0) process.exit(1);\n",
)

print('Forge Autonomous Runtime V1 patch applied successfully.')

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readDocument } from './forge-document-reader.mjs';

const require = createRequire(import.meta.url);
const ts = process.env.FORGE_TYPESCRIPT_PATH ? require(process.env.FORGE_TYPESCRIPT_PATH) : require('typescript');
const base = 'src/vs/workbench/contrib/void/';
let passed = 0;
const test = async (name, run) => { await run(); passed++; console.log(`PASS ${name}`); };
const load = (filename, injected = {}) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, { fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } });
  const exports = {};
  const generic = new Proxy({}, { get: (_, name) => name === 'default' ? { createElement: () => null } : name });
  vm.runInNewContext(output.outputText, { exports, require: specifier => injected[specifier] || generic, console, window: { dispatchEvent() {} }, CustomEvent: class {} });
  return exports;
};
const { prepareAutonomousTask } = load(base + 'browser/react/src/workspace-tsx/utils/autonomousTaskPolicy.ts');
await test('PDF summary does not select implementation mode', () => {
  const text = prepareAutonomousTask({ userText: 'Summarize this PDF', attachments: [{ uri: '/tmp/report.pdf', mimeType: 'application/pdf' }] });
  assert.match(text, /DOCUMENT MODE/); assert.doesNotMatch(text, /REQUIREMENTS MODE:/);
});
await test('requirements implementation retains coding scope', () => assert.match(prepareAutonomousTask({ userText: 'Implement these requirements', attachments: [{ uri: '/tmp/spec.docx', mimeType: 'application/msword' }] }), /REQUIREMENTS MODE:/));
await test('image explanation remains read-only', () => assert.match(prepareAutonomousTask({ userText: 'Explain this image', attachments: [{ uri: '/tmp/image.png', mimeType: 'image/png' }] }), /INSPECTION MODE:/));
await test('ordinary greeting stays lean', () => assert.equal(prepareAutonomousTask({ userText: 'hello' }), 'hello'));

const { createAllCommands } = load(base + 'browser/react/src/workspace-tsx/utils/slashCommandRouter.tsx');
const messages = [], notifications = [], calls = [], aborts = [];
const service = { info: x => notifications.push(x), warn: x => notifications.push(x), error: x => notifications.push(x),
 getMCPTools: () => [{ name: 'forge_browser', mcpServerName: 'forge-super-agent' }],
 callMCPTool: async params => { calls.push(params); return { result: { text: '{"ready":true}' } }; }, stringifyResult: result => result.text,
 searchSkills: async () => [], getAllSkills: () => [], getRegistrySkillCount: () => 0 };
const context = { accessor: { get: () => service }, commandService: { executeCommand: async id => calls.push(id) },
 chatThreadsService: { state: { currentThreadId: 'thread-a' }, abortRunning: async id => aborts.push(id) },
 args: '', onClose() {}, setActiveTool() {}, sendMessage: (text, label) => messages.push({ text, label }) };
const commands = createAllCommands(context);
await test('all command names are unique', () => assert.equal(new Set(commands.map(c => c.name)).size, commands.length));
for (const name of ['/agent,fix', '/agent,test', '/agent,doc', '/agent,ui', '/agent,requirements', '/agent,verify', '/browser']) {
 await test(`${name} preserves task and display label`, async () => {
  await commands.find(c => c.name === name).execute({ ...context, args: 'target-checkout-issue' });
  assert.match(messages.at(-1).text, /target-checkout-issue/); assert.equal(messages.at(-1).label, `${name} target-checkout-issue`);
 });
}
await test('browser command uses browser-specific guidance', () => assert.match(messages.at(-1).text, /browser agent/));
await test('stop aborts locally without a model request', async () => {
 const count = messages.length; await commands.find(c => c.name === '/workflow,stop').execute(context);
 assert.deepEqual(aborts, ['thread-a']); assert.equal(messages.length, count);
});
await test('browser status calls the MCP tool without model usage', async () => {
 const count = messages.length; await commands.find(c => c.name === '/browser-status').execute(context);
 assert.equal(calls.at(-1).toolName, 'forge_browser'); assert.equal(calls.at(-1).params.action, 'status'); assert.equal(messages.length, count);
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-doc-test-'));
try {
 const python = process.platform === 'win32' ? 'python' : 'python3';
 execFileSync(python, ['-c', `import zipfile,sys\nfrom pathlib import Path\np=Path(sys.argv[1])\nwith zipfile.ZipFile(p/'sample.docx','w') as z:\n z.writestr('word/document.xml','<document><p><t>Verified document content</t></p></document>')\nwith zipfile.ZipFile(p/'slides.pptx','w') as z:\n for i in [10,2,1]: z.writestr(f'ppt/slides/slide{i}.xml',f'<slide><p><t>Content {i}</t></p></slide>')\nwith zipfile.ZipFile(p/'sheet.xlsx','w') as z:\n z.writestr('xl/worksheets/sheet1.xml','<worksheet><row><c r="A1" t="inlineStr"><is><t>Invoice</t></is></c><c r="B1"><v>250</v></c></row></worksheet>')\n(p/'legacy.doc').write_bytes(b'not text')\n(p/'large.txt').write_text('x'*5000)`, dir]);
 await test('DOCX extraction reads actual text', async () => assert.match((await readDocument({ path: path.join(dir, 'sample.docx') })).content, /Verified document content/));
 await test('PPTX double-digit slides use numeric order', async () => {
  const { content } = await readDocument({ path: path.join(dir, 'slides.pptx') });
  assert.ok(content.indexOf('Content 1') < content.indexOf('Content 2')); assert.ok(content.indexOf('Content 2') < content.indexOf('Content 10'));
 });
 await test('XLSX preserves cell references and values', async () => assert.match((await readDocument({ path: path.join(dir, 'sheet.xlsx') })).content, /A1=Invoice \| B1=250/));
 await test('legacy binary documents fail explicitly', async () => assert.rejects(readDocument({ path: path.join(dir, 'legacy.doc') }), /Legacy/));
 await test('truncated documents disclose full character count', async () => {
  const result = await readDocument({ path: path.join(dir, 'large.txt'), maxChars: 1000 });
  assert.equal(result.truncated, true); assert.equal(result.characters, 5000); assert.equal(result.content.length, 1000);
 });
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
console.log(`${passed} behavioral checks passed.`);

// Execute the real prompt-construction functions in isolation from the VS Code host.
const promptSource = ts.createSourceFile('prompts.ts', fs.readFileSync(base + 'common/prompt/prompts.ts','utf8'), ts.ScriptTarget.Latest, true);
const selectedFunctions = ['readFile', 'messageOfSelection', 'chat_userMessageContent'];
const promptCode = promptSource.statements.filter(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => selectedFunctions.includes(d.name.getText()))).map(node => node.getText(promptSource)).join('\n');
const promptExports = {};
vm.runInNewContext(ts.transpileModule(promptCode, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports:promptExports,DEFAULT_FILE_SIZE_LIMIT:2000000,tripleTick:['```','```']});
const uri = {fsPath:'/tmp/spec.pdf', path:'/tmp/spec.pdf', toString:()=> 'file:///tmp/spec.pdf'};
await test('binary attachment uses extractor without raw file decoding', async () => {
 let reads=0;
 const output = await promptExports.messageOfSelection({type:'File',uri}, {fileService:{readFile:async()=>{throw Error('raw decode forbidden')}},readDocument:async()=>{reads++;return 'Extracted source'},folderOpts:{}});
 assert.equal(reads,1);assert.match(output,/Extracted source/);
});
await test('unavailable binary extraction reports a blocker instead of invented content', async () => {
 const output=await promptExports.messageOfSelection({type:'File',uri}, {readDocument:async()=>{throw Error('reader unavailable')},folderOpts:{}});
 assert.match(output,/reader unavailable/);assert.match(output,/do not invent/);
});
await test('browser context is source evidence, not a task instruction', async () => {
 const output=await promptExports.messageOfSelection({type:'BrowserComponent',title:'Card',content:'<button>Buy</button>',uri},{});
 assert.match(output,/untrusted page content/);assert.match(output,/<button>Buy<\/button>/);
});
const serviceSource=ts.createSourceFile('chatThreadService.ts',fs.readFileSync(base+'browser/chatThreadService.ts','utf8'),ts.ScriptTarget.Latest,true);
const cls=serviceSource.statements.find(node=>ts.isClassDeclaration(node)&&node.members.some(m=>m.name?.getText()==='_addUserMessageAndStreamResponse'));
const method=cls.members.find(m=>m.name?.getText()==='_addUserMessageAndStreamResponse').getText(serviceSource);
const serviceExports={};
vm.runInNewContext(ts.transpileModule(`export class Subject { ${method} }`,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:serviceExports,chat_userMessageContent:async text=>text+'\nsource attachment',defaultMessageState:{}});
await test('visible label is persisted atomically with expanded execution instructions', async()=>{
 const subject=new serviceExports.Subject();let saved;
 Object.assign(subject,{state:{allThreads:{a:{messages:[{}],state:{stagingSelections:[]}}}},_addMessageToThread:(_id,m)=>{saved=m},_setThreadState(){},_wrapRunAgentToNotify(){},_runChatAgent(){},_currentModelSelectionProps:()=>({})});
 await subject._addUserMessageAndStreamResponse({userMessage:'INTERNAL RUNTIME POLICY',displayLabelOverride:'/browser improve card',threadId:'a'});
 assert.equal(saved.displayContent,'/browser improve card');assert.match(saved.content,/INTERNAL RUNTIME POLICY/);
});
console.log(`${passed} total behavioral checks passed.`);
const { ForgeBrowserController } = await import('./lib/forge-browser-controller.mjs');
await test('browser batch validates all actions before any mutation', async () => {
 const browser=new ForgeBrowserController();let clicks=0;browser.click=async()=>{clicks++};
 await assert.rejects(browser.runSteps([{action:'click',selector:'#buy'},{action:'not-real'}]),/no steps were executed/);assert.equal(clicks,0);
});
await test('browser batch reports partial completion without replay', async () => {
 const browser=new ForgeBrowserController();let clicks=0;browser.click=async()=>{clicks++;return {ok:true}};browser.snapshot=async()=>{throw Error('lost page')};
 await assert.rejects(browser.runSteps([{action:'click',selector:'#buy'},{action:'snapshot'}]),error=>{const report=JSON.parse(error.message);return report.completedSteps===1&&report.failedStepIndex===1});assert.equal(clicks,1);
});
await test('competing browser requests cannot interleave', async () => {
 const browser=new ForgeBrowserController();let release;const first=browser.runExclusive(()=>new Promise(resolve=>{release=resolve}));
 await assert.rejects(browser.runExclusive(async()=>{}),/Browser is busy/);release();await first;assert.equal(await browser.runExclusive(async()=>42),42);
});
console.log(`${passed} total behavioral checks passed.`);
const { WorkerManager } = load(base+'browser/forge/execution/workers/workerManager.ts', {'../bus/executionBus.js':{ExecutionBus:{getInstance:()=>({publish(){}})}}});
for (const category of ['workspace','browser','testing','review']) await test(`unconnected ${category} worker cannot report fabricated success`, async()=>{
 const result=await new WorkerManager().getWorker(category).executeTask({taskId:'a',title:'test',category});
 assert.equal(result.success,false);assert.match(result.error,/no connected execution backend/);
});
console.log(`${passed} total behavioral checks passed.`);

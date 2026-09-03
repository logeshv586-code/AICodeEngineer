import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const prompt = read('src/vs/workbench/contrib/void/common/prompt/prompts.ts');
const chat = read('src/vs/workbench/contrib/void/browser/chatThreadService.ts');
const sidebar = read('src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/SidebarChat.tsx');

const failures = [];
const requireText = (source, text, label) => { if (!source.includes(text)) failures.push(`missing: ${label}`); };
const forbidText = (source, text, label) => { if (source.includes(text)) failures.push(`forbidden: ${label}`); };

forbidText(prompt, 'Only use ONE tool call at a time.', 'legacy single-tool narration instruction');
forbidText(prompt, 'Instead, describe at a high level what the tool will do', 'forced pre-tool narration');
requireText(prompt, 'Do NOT narrate routine workspace inspection or tool usage', 'quiet tool-turn prompt rule');
requireText(prompt, 'Do not stop after exploration when the user asked you to implement or fix something.', 'implementation continuation rule');
requireText(chat, "displayContent: toolCall ? '' : info.fullText", 'hidden tool-turn assistant content');
requireText(chat, "reasoning: toolCall ? '' : info.fullReasoning", 'hidden tool-turn reasoning');
requireText(sidebar, 'isRoutineAgentPreamble', 'legacy preamble cleanup');
requireText(sidebar, "nextMessage?.role === 'tool'", 'tool-adjacent preamble suppression');

if (failures.length) {
  console.error('Forge sidebar agent guard failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Forge sidebar agent guard passed.');

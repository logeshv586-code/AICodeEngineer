import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const capabilities = read('src/vs/workbench/contrib/void/common/modelCapabilities.ts');
const settingsTypes = read('src/vs/workbench/contrib/void/common/voidSettingsTypes.ts');
const transport = read('src/vs/workbench/contrib/void/electron-main/llmMessage/sendLLMMessage.impl.ts');

const keysBetween = (source, startMarker, endMarker, valueOpener) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Could not locate ${startMarker}`);
  const body = source.slice(start + startMarker.length, end);
  const escaped = valueOpener.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^\\s*([A-Za-z][A-Za-z0-9]*):\\s*${escaped}`, 'gm');
  return [...body.matchAll(pattern)].map(match => match[1]);
};

const providerSettings = keysBetween(capabilities, 'export const defaultProviderSettings = {', '} as const', '{');
const defaultModels = keysBetween(capabilities, 'export const defaultModelsOfProvider = {', '} as const satisfies Record<ProviderName, string[]>', '[');
const implementations = keysBetween(transport, 'export const sendLLMMessageToProviderImplementation = {', '} satisfies CallFnOfProvider', '{');

const unique = values => [...new Set(values)];
const sorted = values => unique(values).sort();
const sameSet = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });

check('provider registry is non-empty', providerSettings.length >= 15, `Found ${providerSettings.length} providers.`);
check('default-model registry parity', sameSet(providerSettings, defaultModels), `Settings=${providerSettings.length}, model registries=${defaultModels.length}.`);
check('chat transport registry parity', sameSet(providerSettings, implementations), `Settings=${providerSettings.length}, transports=${implementations.length}.`);
check('provider display parity', providerSettings.every(name => settingsTypes.includes(`providerName === '${name}'`)), 'Every provider must have a settings/display path.');

const nativeProviders = new Set(['anthropic', 'gemini']);
const compatibleProviders = providerSettings.filter(name => !nativeProviders.has(name));
check('native provider transports', transport.includes('sendAnthropicChat') && transport.includes('sendGeminiChat'), 'Anthropic and Gemini must keep their native transports.');
check('OpenAI-compatible provider factory', compatibleProviders.every(name => transport.includes(`providerName === '${name}'`)), 'Every non-native provider must be constructible by the shared OpenAI-compatible SDK factory.');
check('all-provider connection test', transport.includes('export const testLLMConnection') && transport.includes("if (providerName === 'anthropic')") && transport.includes("else if (providerName === 'gemini')") && transport.includes('newOpenAICompatibleSDK({ providerName, settingsOfProvider })'), 'Connection testing must work for native and OpenAI-compatible providers.');
check('custom-model fallback coverage', capabilities.includes('extensiveModelOptionsFallback') && capabilities.includes('modelOptionsFallback'), 'Unknown/custom model names must have a capability fallback path instead of being rejected by registry lookup alone.');

for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name.padEnd(34)} ${item.detail}`);
const failed = checks.filter(item => !item.ok);
if (failed.length) {
  console.error(`\nForge model/provider contract failed: ${failed.map(item => item.name).join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`\nForge model/provider contract passed for ${providerSettings.length} providers.`);
}

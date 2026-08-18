import { bootstrapForgeMcp, doctor, installGroup } from './forge-integrations.mjs';

const full = process.argv.includes('--full');
const setup = process.argv.includes('--setup');
const force = process.argv.includes('--force');
const group = full ? 'full' : 'core';

console.log(`[forge-super-agent] Installing ${group} pinned source integrations${setup ? ' with setup' : ' (source-only)'}.`);
installGroup(group, { setup, force });
const configFile = bootstrapForgeMcp();
console.log(`[forge-super-agent] MCP bootstrap complete: ${configFile}`);
console.log(JSON.stringify(doctor(), null, 2));
console.log('[forge-super-agent] Restart Forge AI so the built-in MCP client loads forge-super-agent.');
console.log('[forge-super-agent] For every requested upstream source tree, use --full. Add --setup only when you want dependency installation too.');

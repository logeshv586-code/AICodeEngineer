import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ForgeBrowserController } from './lib/forge-browser-controller.mjs';
import { ackPendingWork, addWorkflow, listPendingWork, listWorkflows, removeWorkflow, runWorkflow, tickWorkflows } from './forge-work.mjs';
import { bootstrapForgeMcp, doctor, installGroup, installIntegration, integrationStatus, verifyIntegrations } from './forge-integrations.mjs';
import { graphStatus, openViewer, searchGraph, stopViewer, viewerStatus } from './forge-understand.mjs';
import { sidecarStatus, startSidecar, stopSidecar } from './forge-sidecars.mjs';
import { learningStatus, recordLearningTrace, skillOptSleep } from './forge-learning.mjs';
import { runSelfTest } from './forge-super-agent-self-test.mjs';

const browser = new ForgeBrowserController();
const server = new Server(
  { name: 'forge-super-agent', version: '1.1.0' },
  { capabilities: { tools: {} } },
);

const textResult = value => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
});

const errorResult = error => ({
  isError: true,
  content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
});

const tools = [
  {
    name: 'forge_browser',
    description: 'Control a persistent local Playwright browser for website inspection, forms, navigation, screenshots, and browser verification. Snapshot returns compact text plus stable temporary selectors; prefer snapshot/run_steps over many tiny calls.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'status | open | snapshot | click | fill | type | press | select | check | hover | wait | wait_for_text | back | forward | reload | tabs | new_tab | switch_tab | close_tab | screenshot | run_steps | evaluate | close' },
        url: { type: 'string' }, selector: { type: 'string' }, value: { type: 'string' }, key: { type: 'string' },
        option: { type: 'string' }, checked: { type: 'boolean' }, text: { type: 'string' }, index: { type: 'number' },
        ms: { type: 'number' }, name: { type: 'string' }, expression: { type: 'string' }, allowUnsafe: { type: 'boolean' },
        steps: { type: 'array', items: { type: 'object' } },
      },
      required: ['action'],
    },
  },
  {
    name: 'forge_integrations',
    description: 'Manage and verify pinned local source integrations used by Forge: SkillOpt, Understand Anything, Agent Lightning, Open Design, and AionUi. Full install places complete pinned source trees under ~/.forge/integrations.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'status | doctor | verify | install | bootstrap_mcp | self_test' },
        target: { type: 'string', description: 'core | full | skillopt | understand-anything | agent-lightning | open-design | aionui' },
        setup: { type: 'boolean' }, force: { type: 'boolean' }, requireAll: { type: 'boolean' },
      },
      required: ['action'],
    },
  },
  {
    name: 'forge_understand',
    description: 'Use an Understand Anything .ua knowledge graph for large/multi-language codebase understanding without injecting the full graph into model context, and manage its pinned local dashboard.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'status | search | viewer | viewer_status | viewer_stop' },
        workspace: { type: 'string' }, query: { type: 'string' }, limit: { type: 'number' },
      },
      required: ['action'],
    },
  },
  {
    name: 'forge_sidecar',
    description: 'Start, stop, or inspect Open Design and AionUi local companion runtimes. Open Design supplies design systems/templates; AionUi supplies long-running cowork/automation UI.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'status | start | stop' },
        name: { type: 'string', description: 'open-design | aionui' },
        remote: { type: 'boolean', description: 'AionUi only: launch remote web UI mode' },
      },
      required: ['action', 'name'],
    },
  },
  {
    name: 'forge_workflow',
    description: 'Create and run local Work Mode automations. Scheduled prompt tasks and approval-required commands are queued for Forge/AionUi; unattended shell tasks execute locally through the scheduler.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'list | pending | add | run | ack | remove | tick' },
        id: { type: 'string' }, approved: { type: 'boolean' }, task: { type: 'object' }, result: { type: 'object' },
      },
      required: ['action'],
    },
  },
  {
    name: 'forge_learning',
    description: 'Record sanitized coding outcomes for offline learning and run SkillOpt-Sleep validation. Agent Lightning training stays opt-in/offline; never mutate live skills merely because a task completed.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'status | record | skillopt_status | skillopt_dry_run | skillopt_run' },
        trace: { type: 'object' }, workspace: { type: 'string' },
      },
      required: ['action'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async request => {
  const name = request.params.name;
  const args = request.params.arguments || {};
  try {
    if (name === 'forge_browser') {
      const action = args.action;
      if (action === 'status') return textResult(await browser.status());
      if (action === 'open') return textResult(await browser.open(args.url));
      if (action === 'snapshot') return textResult(await browser.snapshot());
      if (action === 'click') return textResult(await browser.click(args.selector));
      if (action === 'fill') return textResult(await browser.fill(args.selector, args.value));
      if (action === 'type') return textResult(await browser.type(args.selector, args.value));
      if (action === 'press') return textResult(await browser.press(args.selector, args.key));
      if (action === 'select') return textResult(await browser.select(args.selector, args.option ?? args.value));
      if (action === 'check') return textResult(await browser.check(args.selector, args.checked !== false));
      if (action === 'hover') return textResult(await browser.hover(args.selector));
      if (action === 'wait') return textResult(await browser.wait(args.ms));
      if (action === 'wait_for_text') return textResult(await browser.waitForText(args.text ?? args.value, args.ms));
      if (action === 'back') return textResult(await browser.back());
      if (action === 'forward') return textResult(await browser.forward());
      if (action === 'reload') return textResult(await browser.reload());
      if (action === 'tabs') return textResult(await browser.tabs());
      if (action === 'new_tab') return textResult(await browser.newTab(args.url));
      if (action === 'switch_tab') return textResult(await browser.switchTab(args.index));
      if (action === 'close_tab') return textResult(await browser.closeTab(args.index));
      if (action === 'screenshot') return textResult(await browser.screenshot(args.name));
      if (action === 'run_steps') return textResult(await browser.runSteps(args.steps));
      if (action === 'evaluate') return textResult(await browser.evaluate(args.expression, args.allowUnsafe === true));
      if (action === 'close') return textResult(await browser.close());
      throw new Error(`Unsupported browser action: ${action}`);
    }

    if (name === 'forge_integrations') {
      if (args.action === 'status') return textResult(integrationStatus());
      if (args.action === 'doctor') return textResult(doctor());
      if (args.action === 'verify') return textResult(verifyIntegrations({ requireAll: args.requireAll === true || args.target === 'full' }));
      if (args.action === 'self_test') return textResult(runSelfTest({ requireAll: args.requireAll === true || args.target === 'full' }));
      if (args.action === 'bootstrap_mcp') return textResult({ configFile: bootstrapForgeMcp() });
      if (args.action === 'install') {
        const target = args.target || 'core';
        return textResult(target === 'core' || target === 'full' || target === 'all'
          ? installGroup(target, { setup: args.setup === true, force: args.force === true })
          : installIntegration(target, { setup: args.setup === true, force: args.force === true }));
      }
      throw new Error(`Unsupported integrations action: ${args.action}`);
    }

    if (name === 'forge_understand') {
      const workspace = args.workspace || process.cwd();
      if (args.action === 'status') return textResult(graphStatus(workspace));
      if (args.action === 'search') return textResult(searchGraph(workspace, args.query || '', args.limit || 20));
      if (args.action === 'viewer') return textResult(await openViewer(workspace));
      if (args.action === 'viewer_status') return textResult(viewerStatus());
      if (args.action === 'viewer_stop') return textResult(stopViewer());
      throw new Error(`Unsupported understand action: ${args.action}`);
    }

    if (name === 'forge_sidecar') {
      if (args.action === 'status') return textResult(sidecarStatus(args.name));
      if (args.action === 'start') return textResult(startSidecar(args.name, { remote: args.remote === true }));
      if (args.action === 'stop') return textResult(stopSidecar(args.name));
      throw new Error(`Unsupported sidecar action: ${args.action}`);
    }

    if (name === 'forge_workflow') {
      if (args.action === 'list') return textResult(listWorkflows());
      if (args.action === 'pending') return textResult(listPendingWork());
      if (args.action === 'add') return textResult(addWorkflow(args.task || {}));
      if (args.action === 'run') return textResult(runWorkflow(args.id, { approved: args.approved === true }));
      if (args.action === 'ack') return textResult(ackPendingWork(args.id, args.result || {}));
      if (args.action === 'remove') return textResult({ removed: removeWorkflow(args.id) });
      if (args.action === 'tick') return textResult(tickWorkflows());
      throw new Error(`Unsupported workflow action: ${args.action}`);
    }

    if (name === 'forge_learning') {
      if (args.action === 'status') return textResult(learningStatus());
      if (args.action === 'record') return textResult(recordLearningTrace(args.trace || {}));
      if (args.action === 'skillopt_status') return textResult(skillOptSleep('status', { workspace: args.workspace }));
      if (args.action === 'skillopt_dry_run') return textResult(skillOptSleep('dry-run', { workspace: args.workspace }));
      if (args.action === 'skillopt_run') return textResult(skillOptSleep('run', { workspace: args.workspace }));
      throw new Error(`Unsupported learning action: ${args.action}`);
    }

    throw new Error(`Unknown Forge tool: ${name}`);
  } catch (error) {
    return errorResult(error);
  }
});

// Scheduled execution is owned by forge-work-daemon.mjs. Keeping scheduling in
// one process avoids duplicate command execution or duplicate pending items.
const transport = new StdioServerTransport();
await server.connect(transport);

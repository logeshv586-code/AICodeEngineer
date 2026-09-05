import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const defaultProfileDir = path.join(os.homedir(), '.forge', 'browser-profile');
const defaultArtifactDir = path.join(os.homedir(), '.forge', 'artifacts', 'browser');

const compactText = value => String(value || '').replace(/\s+/g, ' ').trim();

export class ForgeBrowserController {
  constructor(options = {}) {
    this.profileDir = options.profileDir || process.env.FORGE_BROWSER_PROFILE || defaultProfileDir;
    this.artifactDir = options.artifactDir || process.env.FORGE_BROWSER_ARTIFACTS || defaultArtifactDir;
    this.headless = options.headless ?? process.env.FORGE_BROWSER_HEADED !== '1';
    this.context = null;
    this.page = null;
    this.busy = false;
  }

  async runExclusive(operation) {
    if (this.busy) throw new Error('Browser is busy with another tool request. Wait for its result and inspect a fresh snapshot before acting.');
    this.busy = true;
    try { return await operation(); } finally { this.busy = false; }
  }

  async ensurePage() {
    if (this.page && !this.page.isClosed()) return this.page;
    if (this.context) {
      this.page = this.context.pages().find(page => !page.isClosed()) || await this.context.newPage();
      return this.page;
    }
    let chromium;
    try {
      ({ chromium } = await import('@playwright/test'));
    } catch (error) {
      throw new Error(`Playwright is unavailable. Run npm install in Forge first. ${error instanceof Error ? error.message : error}`);
    }
    fs.mkdirSync(this.profileDir, { recursive: true });
    try {
      this.context = await chromium.launchPersistentContext(this.profileDir, {
        headless: this.headless,
        viewport: { width: 1440, height: 1000 },
        acceptDownloads: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Chromium could not start. Run "npm exec playwright install chromium" in Forge. ${message}`);
    }
    const pages = this.context.pages();
    this.page = pages[0] || await this.context.newPage();
    return this.page;
  }

  async status() {
    return {
      ready: !!this.page && !this.page.isClosed(),
      headless: this.headless,
      profileDir: this.profileDir,
      artifactDir: this.artifactDir,
      url: this.page && !this.page.isClosed() ? this.page.url() : null,
      tabs: this.context ? this.context.pages().length : 0,
    };
  }

  async open(url) {
    if (!url) throw new Error('Browser open requires a URL.');
    const page = await this.ensurePage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    return this.snapshot();
  }

  async snapshot() {
    const page = await this.ensurePage();
    const data = await page.evaluate(() => {
      const text = value => String(value || '').replace(/\s+/g, ' ').trim();
      const visible = element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      const interactiveSelector = 'a[href],button,[role="button"],input,textarea,select,[contenteditable="true"]';
      document.querySelectorAll('[data-forge-agent-id]').forEach(el => el.removeAttribute('data-forge-agent-id'));
      const interactive = Array.from(document.querySelectorAll(interactiveSelector)).filter(visible).slice(0, 100);
      interactive.forEach((el, index) => el.setAttribute('data-forge-agent-id', String(index + 1)));
      const interactives = interactive.map(el => {
        const id = el.getAttribute('data-forge-agent-id');
        const tag = el.tagName.toLowerCase();
        const input = el;
        return {
          id,
          selector: `[data-forge-agent-id="${id}"]`,
          tag,
          role: el.getAttribute('role') || undefined,
          type: el.getAttribute('type') || undefined,
          text: text(el.textContent).slice(0, 240) || undefined,
          ariaLabel: el.getAttribute('aria-label') || undefined,
          placeholder: el.getAttribute('placeholder') || undefined,
          name: el.getAttribute('name') || undefined,
          href: tag === 'a' ? el.href : undefined,
          value: tag === 'input' || tag === 'textarea' || tag === 'select'
            ? (el.getAttribute('type') === 'password' ? '[redacted]' : String(input.value || '').slice(0, 160))
            : undefined,
        };
      });
      const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4'))
        .filter(visible)
        .slice(0, 40)
        .map(el => ({ tag: el.tagName.toLowerCase(), text: text(el.textContent).slice(0, 300) }));
      return {
        title: document.title,
        url: location.href,
        headings,
        interactives,
        text: text(document.body?.innerText || '').slice(0, 14000),
      };
    });
    return data;
  }

  locator(selector) {
    if (!selector) throw new Error('A selector is required. Use a selector returned by snapshot when possible.');
    return this.page.locator(selector); // Playwright strict mode rejects ambiguous targets.
  }

  async click(selector) {
    const page = await this.ensurePage();
    await this.locator(selector).click({ timeout: 15_000 });
    await page.waitForTimeout(250);
    return this.snapshot();
  }

  async fill(selector, value) {
    await this.ensurePage();
    await this.locator(selector).fill(String(value ?? ''), { timeout: 15_000 });
    return { ok: true, selector, valueLength: String(value ?? '').length };
  }

  async type(selector, value) {
    await this.ensurePage();
    await this.locator(selector).pressSequentially(String(value ?? ''), { delay: 20, timeout: 15_000 });
    return { ok: true, selector, valueLength: String(value ?? '').length };
  }

  async press(selector, key) {
    await this.ensurePage();
    await this.locator(selector).press(key, { timeout: 15_000 });
    return { ok: true, selector, key };
  }

  async select(selector, option) {
    await this.ensurePage();
    const result = await this.locator(selector).selectOption(String(option ?? ''));
    return { ok: true, selector, selected: result };
  }

  async check(selector, checked = true) {
    await this.ensurePage();
    if (checked) await this.locator(selector).check({ timeout: 15_000 });
    else await this.locator(selector).uncheck({ timeout: 15_000 });
    return { ok: true, selector, checked: !!checked };
  }

  async hover(selector) {
    await this.ensurePage();
    await this.locator(selector).hover({ timeout: 15_000 });
    return { ok: true, selector };
  }

  async wait(ms = 500) {
    const page = await this.ensurePage();
    const bounded = Math.max(0, Math.min(Number(ms) || 0, 30_000));
    await page.waitForTimeout(bounded);
    return { ok: true, waitedMs: bounded };
  }

  async waitForText(value, timeoutMs = 15_000) {
    const page = await this.ensurePage();
    await page.getByText(String(value || ''), { exact: false }).first().waitFor({ state: 'visible', timeout: Math.min(Number(timeoutMs) || 15_000, 45_000) });
    return { ok: true, text: String(value || '') };
  }

  async back() {
    const page = await this.ensurePage();
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30_000 });
    return this.snapshot();
  }

  async forward() {
    const page = await this.ensurePage();
    await page.goForward({ waitUntil: 'domcontentloaded', timeout: 30_000 });
    return this.snapshot();
  }

  async reload() {
    const page = await this.ensurePage();
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
    return this.snapshot();
  }

  async tabs() {
    await this.ensurePage();
    return this.context.pages().map((page, index) => ({ index, url: page.url(), active: page === this.page }));
  }

  async newTab(url) {
    await this.ensurePage();
    this.page = await this.context.newPage();
    if (url) await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    return this.snapshot();
  }

  async switchTab(index) {
    await this.ensurePage();
    const pages = this.context.pages();
    const next = pages[Number(index)];
    if (!next) throw new Error(`No browser tab at index ${index}.`);
    this.page = next;
    await this.page.bringToFront();
    return this.snapshot();
  }

  async closeTab(index) {
    await this.ensurePage();
    const pages = this.context.pages();
    const target = index === undefined ? this.page : pages[Number(index)];
    if (!target) throw new Error(`No browser tab at index ${index}.`);
    await target.close();
    const remaining = this.context.pages();
    this.page = remaining[0] || await this.context.newPage();
    return this.tabs();
  }

  async screenshot(name = 'forge-browser') {
    const page = await this.ensurePage();
    fs.mkdirSync(this.artifactDir, { recursive: true });
    const safe = compactText(name).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'forge-browser';
    const file = path.join(this.artifactDir, `${safe}-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: true, mask: [page.locator('input[type="password"],input[autocomplete="one-time-code"]')] });
    return { ok: true, path: file, url: page.url() };
  }

  async evaluate(expression, allowUnsafe = false) {
    if (!allowUnsafe && process.env.FORGE_ALLOW_BROWSER_EVAL !== '1') {
      throw new Error('Browser evaluate is disabled by default. Pass allowUnsafe=true for an explicit trusted request.');
    }
    const page = await this.ensurePage();
    const result = await page.evaluate(source => {
      // Deliberately isolated behind explicit opt-in. The caller owns the expression.
      // eslint-disable-next-line no-eval
      return eval(source);
    }, String(expression || ''));
    return { result };
  }

  async runSteps(steps = []) {
    const supported = new Set(['open', 'goto', 'snapshot', 'click', 'fill', 'type', 'press', 'select', 'check', 'hover', 'wait', 'wait_for_text', 'back', 'forward', 'reload', 'new_tab', 'switch_tab', 'close_tab', 'screenshot']);
    if (!Array.isArray(steps) || steps.length > 40) throw new Error('run_steps requires an array of at most 40 steps; no steps were executed.');
    for (const step of steps) {
      if (!step || !supported.has(step.action)) throw new Error(`Unsupported browser step: ${step?.action}; no steps were executed.`);
    }
    const outputs = [];
    for (const [index, step] of steps.entries()) {
      try {
      const action = step?.action;
      if (action === 'open' || action === 'goto') outputs.push(await this.open(step.url));
      else if (action === 'snapshot') outputs.push(await this.snapshot());
      else if (action === 'click') outputs.push(await this.click(step.selector));
      else if (action === 'fill') outputs.push(await this.fill(step.selector, step.value));
      else if (action === 'type') outputs.push(await this.type(step.selector, step.value));
      else if (action === 'press') outputs.push(await this.press(step.selector, step.key));
      else if (action === 'select') outputs.push(await this.select(step.selector, step.option ?? step.value));
      else if (action === 'check') outputs.push(await this.check(step.selector, step.checked !== false));
      else if (action === 'hover') outputs.push(await this.hover(step.selector));
      else if (action === 'wait') outputs.push(await this.wait(step.ms));
      else if (action === 'wait_for_text') outputs.push(await this.waitForText(step.text ?? step.value, step.ms));
      else if (action === 'back') outputs.push(await this.back());
      else if (action === 'forward') outputs.push(await this.forward());
      else if (action === 'reload') outputs.push(await this.reload());
      else if (action === 'new_tab') outputs.push(await this.newTab(step.url));
      else if (action === 'switch_tab') outputs.push(await this.switchTab(step.index));
      else if (action === 'close_tab') outputs.push(await this.closeTab(step.index));
      else if (action === 'screenshot') outputs.push(await this.screenshot(step.name));
      else throw new Error(`Unsupported browser step: ${action}`);
      } catch (error) {
        throw new Error(JSON.stringify({ message: 'Browser batch stopped. Do not replay completed steps. Inspect current state before retrying the failed step; its action may already have happened.', completedSteps: outputs.length, failedStepIndex: index, failedAction: step.action, error: error instanceof Error ? error.message : String(error) }));
      }
    }
    return outputs;
  }

  async close() {
    if (this.context) await this.context.close();
    this.context = null;
    this.page = null;
    return { ok: true };
  }
}

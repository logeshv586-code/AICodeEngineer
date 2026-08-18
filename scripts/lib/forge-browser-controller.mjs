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
  }

  async ensurePage() {
    if (this.page && !this.page.isClosed()) return this.page;
    let chromium;
    try {
      ({ chromium } = await import('playwright'));
    } catch (error) {
      throw new Error(`Playwright is unavailable. Run npm install in Forge first. ${error instanceof Error ? error.message : error}`);
    }
    fs.mkdirSync(this.profileDir, { recursive: true });
    this.context = await chromium.launchPersistentContext(this.profileDir, {
      headless: this.headless,
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
    });
    const pages = this.context.pages();
    this.page = pages[0] || await this.context.newPage();
    return this.page;
  }

  async open(url) {
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
      const items = (selector, mapper, limit = 60) => Array.from(document.querySelectorAll(selector))
        .filter(visible)
        .slice(0, limit)
        .map(mapper)
        .filter(Boolean);
      return {
        title: document.title,
        url: location.href,
        headings: items('h1,h2,h3,h4', el => ({ tag: el.tagName.toLowerCase(), text: text(el.textContent) }), 40),
        links: items('a[href]', el => ({ text: text(el.textContent), href: el.href }), 60),
        buttons: items('button,[role="button"]', el => ({ text: text(el.textContent), ariaLabel: el.getAttribute('aria-label') || undefined }), 60),
        inputs: items('input,textarea,select', el => ({
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || undefined,
          name: el.getAttribute('name') || undefined,
          placeholder: el.getAttribute('placeholder') || undefined,
          ariaLabel: el.getAttribute('aria-label') || undefined,
          value: el.type === 'password' ? '[redacted]' : String(el.value || '').slice(0, 160),
        }), 60),
        text: text(document.body?.innerText || '').slice(0, 12000),
      };
    });
    return data;
  }

  async click(selector) {
    const page = await this.ensurePage();
    await page.locator(selector).first().click({ timeout: 15_000 });
    await page.waitForTimeout(250);
    return this.snapshot();
  }

  async fill(selector, value) {
    const page = await this.ensurePage();
    await page.locator(selector).first().fill(String(value ?? ''), { timeout: 15_000 });
    return { ok: true, selector, valueLength: String(value ?? '').length };
  }

  async type(selector, value) {
    const page = await this.ensurePage();
    await page.locator(selector).first().pressSequentially(String(value ?? ''), { delay: 20, timeout: 15_000 });
    return { ok: true, selector, valueLength: String(value ?? '').length };
  }

  async press(selector, key) {
    const page = await this.ensurePage();
    await page.locator(selector).first().press(key, { timeout: 15_000 });
    return { ok: true, selector, key };
  }

  async wait(ms = 500) {
    const page = await this.ensurePage();
    await page.waitForTimeout(Math.max(0, Math.min(Number(ms) || 0, 30_000)));
    return { ok: true, waitedMs: Math.max(0, Math.min(Number(ms) || 0, 30_000)) };
  }

  async screenshot(name = 'forge-browser') {
    const page = await this.ensurePage();
    fs.mkdirSync(this.artifactDir, { recursive: true });
    const safe = compactText(name).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'forge-browser';
    const file = path.join(this.artifactDir, `${safe}-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: true });
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
    const outputs = [];
    for (const step of steps.slice(0, 30)) {
      const action = step?.action;
      if (action === 'open' || action === 'goto') outputs.push(await this.open(step.url));
      else if (action === 'snapshot') outputs.push(await this.snapshot());
      else if (action === 'click') outputs.push(await this.click(step.selector));
      else if (action === 'fill') outputs.push(await this.fill(step.selector, step.value));
      else if (action === 'type') outputs.push(await this.type(step.selector, step.value));
      else if (action === 'press') outputs.push(await this.press(step.selector, step.key));
      else if (action === 'wait') outputs.push(await this.wait(step.ms));
      else if (action === 'screenshot') outputs.push(await this.screenshot(step.name));
      else throw new Error(`Unsupported browser step: ${action}`);
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

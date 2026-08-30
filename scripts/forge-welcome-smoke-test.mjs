/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { _electron as electron } from '@playwright/test';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const executablePath = path.join(repositoryRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const screenshotPath = process.env.FORGE_WELCOME_SCREENSHOT
	?? path.join(os.tmpdir(), `forge-welcome-${process.pid}.png`);
const smokeProfilePath = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-welcome-smoke-'));
const smokeExtensionsPath = path.join(smokeProfilePath, 'extensions');
fs.mkdirSync(smokeExtensionsPath);
const launchEnvironment = { ...process.env };

delete launchEnvironment.ELECTRON_RUN_AS_NODE;
Object.assign(launchEnvironment, {
	VSCODE_DEV: '1',
	VSCODE_CLI: '1',
	NODE_ENV: 'development',
});

let application;
try {
	application = await electron.launch({
		executablePath,
		args: [
			repositoryRoot,
			repositoryRoot,
			`--user-data-dir=${smokeProfilePath}`,
			`--extensions-dir=${smokeExtensionsPath}`,
		],
		cwd: repositoryRoot,
		env: launchEnvironment,
		timeout: 60_000,
	});

	const window = application.windows()[0] ?? await application.waitForEvent('window', { timeout: 60_000 });
	await window.getByPlaceholder('Describe the outcome you want Forge to deliver…').waitFor({ state: 'visible' });

	await window.getByRole('button', { name: '/ commands', exact: true }).click();
	const slashPalette = window.getByRole('dialog', { name: 'Forge slash commands' });
	await slashPalette.waitFor({ state: 'visible' });
	await window.getByText('/agent,code', { exact: true }).waitFor({ state: 'visible' });
	await window.getByText('/auto', { exact: true }).waitFor({ state: 'visible' });
	const slashPaletteBounds = await slashPalette.boundingBox();
	const composerBounds = await window.locator('.void-forge-right-composer-shell').boundingBox();
	const viewport = await window.evaluate(() => ({ width: innerWidth, height: innerHeight }));
	assert.ok(slashPaletteBounds && slashPaletteBounds.y >= 8 && slashPaletteBounds.x >= 8, 'The slash palette must stay inside the top and left viewport edges.');
	assert.ok(slashPaletteBounds && slashPaletteBounds.x + slashPaletteBounds.width <= viewport.width - 8, 'The slash palette must stay inside the right viewport edge.');
	assert.ok(slashPaletteBounds && composerBounds && slashPaletteBounds.y + slashPaletteBounds.height <= composerBounds.y, 'The slash palette must open above the bottom composer.');
	await window.keyboard.press('Escape');

	await window.locator('.void-forge-right-composer-meta-right button').first().click();
	await window.getByText('Auto Mode', { exact: true }).waitFor({ state: 'visible' });
	await window.keyboard.press('Escape');

	const commandCount = await window.locator('.void-forge-panel-command').count();
	const welcomeCount = await window.locator('.void-forge-panel-intro').count();
	const restoredMessageCount = await window.locator('.void-forge-brand-user-bubble').count();
	const openSlashPaletteCount = await window.locator('.void-forge-slash-palette:visible').count();
	const forgeSurfaceBounds = await window.locator('.part.auxiliarybar').boundingBox();
	const viewportWidth = await window.evaluate(() => innerWidth);

	assert.equal(commandCount, 0, 'Startup must not render the old slash-command welcome screen.');
	assert.equal(welcomeCount, 0, 'Startup must not render the image-like Forge intro board.');
	assert.equal(restoredMessageCount, 0, 'The startup screen must not restore a message into the active conversation.');
	assert.equal(openSlashPaletteCount, 0, 'The slash-command palette must be closed on startup.');
	assert.ok(
		forgeSurfaceBounds && forgeSurfaceBounds.width >= Math.min(280, viewportWidth * 0.25),
		'The Forge chat surface must remain usable in the right auxiliary panel.',
	);
	assert.ok(
		forgeSurfaceBounds && composerBounds && composerBounds.y >= forgeSurfaceBounds.y + forgeSurfaceBounds.height * 0.55,
		'The Forge composer must stay in the lower portion of the chat surface.',
	);

	await window.screenshot({ path: screenshotPath });
	console.log(JSON.stringify({
		status: 'passed',
		commandCount,
		forgeSurfaceWidth: Math.round(forgeSurfaceBounds.width),
		composerTop: Math.round(composerBounds.y),
		screenshotPath,
	}, null, 2));
} finally {
	await application?.close();
	fs.rmSync(smokeProfilePath, { recursive: true, force: true });
}

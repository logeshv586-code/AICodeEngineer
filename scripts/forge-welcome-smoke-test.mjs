/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { _electron as electron } from '@playwright/test';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const executablePath = path.join(repositoryRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const screenshotPath = process.env.FORGE_WELCOME_SCREENSHOT
	?? path.join(os.tmpdir(), `forge-welcome-${process.pid}.png`);
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
		args: [repositoryRoot, repositoryRoot],
		cwd: repositoryRoot,
		env: launchEnvironment,
		timeout: 60_000,
	});

	const window = application.windows()[0] ?? await application.waitForEvent('window', { timeout: 60_000 });
	await window.getByPlaceholder('Describe the outcome you want Forge to deliver…').waitFor({ state: 'visible' });

	await window.getByRole('button', { name: '/ commands', exact: true }).click();
	await window.getByRole('dialog', { name: 'Forge slash commands' }).waitFor({ state: 'visible' });
	await window.getByText('/agent,code', { exact: true }).waitFor({ state: 'visible' });
	await window.getByText('/auto', { exact: true }).waitFor({ state: 'visible' });
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

	await window.screenshot({ path: screenshotPath });
	console.log(JSON.stringify({
		status: 'passed',
		commandCount,
		forgeSurfaceWidth: Math.round(forgeSurfaceBounds.width),
		screenshotPath,
	}, null, 2));
} finally {
	await application?.close();
}

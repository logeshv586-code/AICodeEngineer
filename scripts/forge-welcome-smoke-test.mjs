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
	const welcome = window.locator('.void-forge-panel-intro');
	await welcome.waitFor({ state: 'visible', timeout: 60_000 });
	await window.getByRole('heading', { name: 'Forge AI', exact: true }).waitFor({ state: 'visible' });
	await window.getByPlaceholder('Describe the outcome you want Forge to deliver…').waitFor({ state: 'visible' });

	const commandCount = await window.locator('.void-forge-panel-command').count();
	const restoredMessageCount = await window.locator('.void-forge-brand-user-bubble').count();
	const openSlashPaletteCount = await window.locator('.void-forge-slash-palette:visible').count();
	const welcomeBounds = await welcome.boundingBox();
	const forgeSurfaceBounds = await window.locator('.part.auxiliarybar').boundingBox();
	const restoredPanelVisible = await window.locator('.part.panel').isVisible();
	const viewportWidth = await window.evaluate(() => innerWidth);

	assert.equal(commandCount, 11, 'The welcome screen must show all 11 primary Forge commands.');
	assert.equal(restoredMessageCount, 0, 'The startup screen must not restore a message into the active conversation.');
	assert.equal(openSlashPaletteCount, 0, 'The slash-command palette must be closed on startup.');
	assert.ok(welcomeBounds && welcomeBounds.width >= 500, 'The welcome board must use the main work surface.');
	assert.equal(restoredPanelVisible, false, 'A restored Terminal or bottom panel must not displace Forge on startup.');
	assert.ok(
		forgeSurfaceBounds && forgeSurfaceBounds.width >= viewportWidth * 0.6,
		'The Forge surface must occupy the main work area beside Explorer.',
	);

	await window.screenshot({ path: screenshotPath });
	console.log(JSON.stringify({
		status: 'passed',
		commandCount,
		welcomeWidth: Math.round(welcomeBounds.width),
		forgeSurfaceWidth: Math.round(forgeSurfaceBounds.width),
		screenshotPath,
	}, null, 2));
} finally {
	await application?.close();
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const nodeVersion = /^(\d+)\.(\d+)\.(\d+)/.exec(process.versions.node);
const majorNodeVersion = parseInt(nodeVersion[1]);
const minorNodeVersion = parseInt(nodeVersion[2]);
const patchNodeVersion = parseInt(nodeVersion[3]);

if (!process.env['VSCODE_SKIP_NODE_VERSION_CHECK']) {
	if (majorNodeVersion < 20 || (majorNodeVersion === 20 && minorNodeVersion < 18) || (majorNodeVersion === 20 && minorNodeVersion === 18 && patchNodeVersion < 1)) {
		console.error('\x1b[1;31m*** Please use Node.js v20.18.1 or later for development.\x1b[0;0m');
		throw new Error();
	}
}

if (process.env['npm_execpath'].includes('yarn')) {
	console.error('\x1b[1;31m*** Seems like you are using `yarn` which is not supported in this repo any more, please use `npm i` instead. ***\x1b[0;0m');
	throw new Error();
}

const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const os = require('os');

if (process.platform === 'win32') {
	if (!hasSupportedVisualStudioVersion()) {
		console.error('\x1b[1;31m*** Invalid C/C++ Compiler Toolchain. Please check https://github.com/microsoft/vscode/wiki/How-to-Contribute#prerequisites.\x1b[0;0m');
		console.error('\x1b[1;31m*** Forge supports Visual Studio 2022 and Visual Studio 2026; custom installs may be supplied via vs2022_install or vs2026_install.\x1b[0;0m');
		throw new Error();
	}
	installHeaders();
}

if (process.arch !== os.arch()) {
	console.error(`\x1b[1;31m*** ARCHITECTURE MISMATCH: The node.js process is ${process.arch}, but your OS architecture is ${os.arch()}. ***\x1b[0;0m`);
	console.error(`\x1b[1;31m*** This can greatly increase the build time of vs code. ***\x1b[0;0m`);
}

function hasSupportedVisualStudioVersion() {
	const fs = require('fs');
	const path = require('path');

	// VS Code 1.99.3 predates Visual Studio 2026. Prefer vswhere so Forge accepts
	// real VS2022/VS2026 C++ installations regardless of installation directory.
	const programFiles86Path = process.env['ProgramFiles(x86)'];
	if (programFiles86Path) {
		const vswhere = path.join(programFiles86Path, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
		if (fs.existsSync(vswhere)) {
			try {
				const installationPath = cp.execFileSync(vswhere, [
					'-latest',
					'-products', '*',
					'-version', '[17.0,19.0)',
					'-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
					'-property', 'installationPath'
				], { encoding: 'utf8', windowsHide: true }).trim();
				if (installationPath && fs.existsSync(installationPath)) {
					return true;
				}
			} catch {
				// Fall through to the upstream environment/default-path checks below.
			}
		}
	}

	// Preserve the upstream discovery behavior as a fallback and extend it with
	// VS2026's major-version install folder (18).
	const supportedVersions = [
		{ version: '2026', installFolder: '18' },
		{ version: '2022', installFolder: '2022' },
		{ version: '2019', installFolder: '2019' },
		{ version: '2017', installFolder: '2017' },
	];

	const availableVersions = [];
	for (const { version, installFolder } of supportedVersions) {
		let vsPath = process.env[`vs${version}_install`];
		if (vsPath && fs.existsSync(vsPath)) {
			availableVersions.push(version);
			break;
		}
		const programFiles64Path = process.env['ProgramFiles'];

		const vsTypes = ['Enterprise', 'Professional', 'Community', 'Preview', 'BuildTools', 'IntPreview'];
		if (programFiles64Path) {
			vsPath = `${programFiles64Path}/Microsoft Visual Studio/${installFolder}`;
			if (vsTypes.some(vsType => fs.existsSync(path.join(vsPath, vsType)))) {
				availableVersions.push(version);
				break;
			}
		}

		if (programFiles86Path) {
			vsPath = `${programFiles86Path}/Microsoft Visual Studio/${installFolder}`;
			if (vsTypes.some(vsType => fs.existsSync(path.join(vsPath, vsType)))) {
				availableVersions.push(version);
				break;
			}
		}
	}
	return availableVersions.length;
}

function installHeaders() {
	cp.execSync(`npm.cmd ${process.env['npm_command'] || 'ci'}`, {
		env: process.env,
		cwd: path.join(__dirname, 'gyp'),
		stdio: 'inherit'
	});

	// The node gyp package got installed using the above npm command using the gyp/package.json
	// file checked into our repository. So from that point it is save to construct the path
	// to that executable
	const node_gyp = path.join(__dirname, 'gyp', 'node_modules', '.bin', 'node-gyp.cmd');
	const result = cp.execFileSync(node_gyp, ['list'], { encoding: 'utf8', shell: true });
	const versions = new Set(result.split(/\n/g).filter(line => !line.startsWith('gyp info')).map(value => value));

	const local = getHeaderInfo(path.join(__dirname, '..', '..', '.npmrc'));
	const remote = getHeaderInfo(path.join(__dirname, '..', '..', 'remote', '.npmrc'));

	if (local !== undefined && !versions.has(local.target)) {
		// Both disturl and target come from a file checked into our repository
		cp.execFileSync(node_gyp, ['install', '--dist-url', local.disturl, local.target], { shell: true });
	}

	if (remote !== undefined && !versions.has(remote.target)) {
		// Both disturl and target come from a file checked into our repository
		cp.execFileSync(node_gyp, ['install', '--dist-url', remote.disturl, remote.target], { shell: true });
	}
}

/**
 * @param {string} rcFile
 * @returns {{ disturl: string; target: string } | undefined}
 */
function getHeaderInfo(rcFile) {
	const lines = fs.readFileSync(rcFile, 'utf8').split(/\r\n?/g);
	let disturl, target;
	for (const line of lines) {
		let match = line.match(/\s*disturl=*\"(.*)\"\s*$/);
		if (match !== null && match.length >= 1) {
			disturl = match[1];
		}
		match = line.match(/\s*target=*\"(.*)\"\s*$/);
		if (match !== null && match.length >= 1) {
			target = match[1];
		}
	}
	return disturl !== undefined && target !== undefined
		? { disturl, target }
		: undefined;
}

const { spawn } = require('child_process');
const path = require('path');

const root = 'd:/AIcodeEngineer';
const electronPath = path.join(root, 'node_modules/electron/dist/electron.exe');

const child = spawn(electronPath, ['.'], {
	cwd: root,
	detached: true,
	stdio: 'ignore',
	env: {
		...process.env,
		VSCODE_DEV: '1',
		VSCODE_CLI: '1',
		ELECTRON_ENABLE_LOGGING: '1',
		NODE_ENV: 'development',
	},
});

child.unref();
console.log('electron_pid=' + child.pid);
console.log('ELECTRON_LAUNCH_ATTEMPTED');

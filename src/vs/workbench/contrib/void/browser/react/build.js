import { execSync, spawn } from 'child_process';
// Added lines below
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function doesPathExist(filePath) {
	try {
		const stats = fs.statSync(filePath);

		return stats.isFile();
	} catch (err) {
		if (err.code === 'ENOENT') {
			return false;
		}
		throw err;
	}
}

/*

This function finds `globalDesiredPath` given `localDesiredPath` and `currentPath`

Diagram:

...basePath/
└── void/
	├── ...currentPath/ (defined globally)
	└── ...localDesiredPath/ (defined locally)

*/
function findDesiredPathFromLocalPath(localDesiredPath, currentPath) {

	// walk upwards until currentPath + localDesiredPath exists
	while (!doesPathExist(path.join(currentPath, localDesiredPath))) {
		const parentDir = path.dirname(currentPath);

		if (parentDir === currentPath) {
			return undefined;
		}

		currentPath = parentDir;
	}

	// return the `globallyDesiredPath`
	const globalDesiredPath = path.join(currentPath, localDesiredPath)
	return globalDesiredPath;
}

// React's flattened output can resolve browser/forge imports through void/forge.
// Never copy compiled modules into that compatibility tree: their own relative
// imports are authored for browser/forge and would then resolve from the wrong
// directory. Bridge modules keep the requested compatibility URL while loading
// the canonical compiler output from its original location.
function syncRuntimeModuleBridges(sourceDir, bridgeDir) {
	fs.rmSync(bridgeDir, { recursive: true, force: true });

	const visit = (currentSourceDir, currentBridgeDir) => {
		fs.mkdirSync(currentBridgeDir, { recursive: true });
		for (const entry of fs.readdirSync(currentSourceDir, { withFileTypes: true })) {
			const sourcePath = path.join(currentSourceDir, entry.name);
			const bridgePath = path.join(currentBridgeDir, entry.name);

			if (entry.isDirectory()) {
				visit(sourcePath, bridgePath);
				continue;
			}

			if (entry.isFile() && entry.name.endsWith('.js')) {
				let target = path.relative(path.dirname(bridgePath), sourcePath).replace(/\\/g, '/');
				if (!target.startsWith('.')) target = `./${target}`;
				fs.writeFileSync(
					bridgePath,
					`import * as canonical from '${target}';\nexport * from '${target}';\nexport default canonical.default;\n`,
					'utf8'
				);
				continue;
			}

			// Preserve non-JavaScript runtime assets without relocating executable
			// module bodies. Source maps are intentionally omitted for bridge files.
			if (entry.isFile() && !entry.name.endsWith('.js.map')) {
				fs.copyFileSync(sourcePath, bridgePath);
			}
		}
	};

	visit(sourceDir, bridgeDir);
}

// hack to refresh styles automatically
function saveStylesFile() {
	setTimeout(() => {
		try {
			const pathToCssFile = findDesiredPathFromLocalPath('./src/vs/workbench/contrib/void/browser/react/src2/styles.css', __dirname);

			if (pathToCssFile === undefined) {
				console.error('[scope-tailwind] Error finding styles.css');
				return;
			}

			// Or re-write with the same content:
			const content = fs.readFileSync(pathToCssFile, 'utf8');
			fs.writeFileSync(pathToCssFile, content, 'utf8');
			console.log('[scope-tailwind] Force-saved styles.css');
		} catch (err) {
			console.error('[scope-tailwind] Error saving styles.css:', err);
		}
	}, 6000);
}

const args = process.argv.slice(2);
const isWatch = args.includes('--watch') || args.includes('-w');

if (isWatch) {
	// this just builds it if it doesn't exist instead of waiting for the watcher to trigger
	// Check if src2/ exists; if not, do an initial scope-tailwind build
	if (!fs.existsSync('src2')) {
		try {
			console.log('🔨 Running initial scope-tailwind build to create src2 folder...');
			execSync(
				'npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-"',
				{ stdio: 'inherit' }
			);
			console.log('✅ src2/ created successfully.');
		} catch (err) {
			console.error('❌ Error running initial scope-tailwind build:', err);
			process.exit(1);
		}
	}

	// Watch mode
	const scopeTailwindWatcher = spawn('npx', [
		'nodemon',
		'--watch', 'src',
		'--ext', 'ts,tsx,css',
		'--exec',
		'npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-"'
	]);

	const tsupWatcher = spawn('npx', [
		'tsup',
		'--watch'
	]);

	scopeTailwindWatcher.stdout.on('data', (data) => {
		console.log(`[scope-tailwind] ${data}`);
		// If the output mentions "styles.css", trigger the save:
		if (data.toString().includes('styles.css')) {
			saveStylesFile();
		}
	});

	scopeTailwindWatcher.stderr.on('data', (data) => {
		console.error(`[scope-tailwind] ${data}`);
	});

	// Handle tsup watcher output
	tsupWatcher.stdout.on('data', (data) => {
		console.log(`[tsup] ${data}`);
	});

	tsupWatcher.stderr.on('data', (data) => {
		console.error(`[tsup] ${data}`);
	});

	// Handle process termination
	process.on('SIGINT', () => {
		scopeTailwindWatcher.kill();
		tsupWatcher.kill();
		process.exit();
	});

	console.log('🔄 Watchers started! Press Ctrl+C to stop both watchers.');
} else {
	// Build mode
	console.log('📦 Building...');

	// Run scope-tailwind once
	execSync('npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-"', { stdio: 'inherit' });

	// Run tsup once
	execSync('npx tsup', { stdio: 'inherit' });

	// The TypeScript compiler copies react/out into out/ during the core build,
	// but this standalone React build must also refresh the files Electron loads.
	const packageJsonPath = findDesiredPathFromLocalPath('./package.json', __dirname);
	if (packageJsonPath === undefined) {
		throw new Error('[forge] Could not locate the workspace root');
	}
	const runtimeReactOut = path.join(
		path.dirname(packageJsonPath),
		'out/vs/workbench/contrib/void/browser/react/out'
	);
	fs.cpSync(path.join(__dirname, 'out'), runtimeReactOut, { recursive: true });
	console.log(`[forge] Synced React bundles to ${runtimeReactOut}`);

	// React is emitted from a flattened `react/out` directory. Some preserved
	// Forge imports therefore resolve through `void/forge`, while TypeScript
	// emits the canonical modules under `void/browser/forge`. Use bridge modules
	// instead of copies so the canonical module keeps its original base URL and
	// all of its internal relative imports remain correct.
	const workspaceOut = path.join(path.dirname(packageJsonPath), 'out');
	const runtimeBrowserForge = path.join(workspaceOut, 'vs/workbench/contrib/void/browser/forge');
	const runtimeVoidForge = path.join(workspaceOut, 'vs/workbench/contrib/void/forge');
	if (fs.existsSync(runtimeBrowserForge)) {
		syncRuntimeModuleBridges(runtimeBrowserForge, runtimeVoidForge);
		console.log(`[forge] Synced Forge compatibility bridges to ${runtimeVoidForge}`);
	}

	// One Forge event import is preserved six levels deep by tsup and resolves
	// to workbench/base/common at runtime. Mirror the compiled base common
	// modules into that compatibility location.
	const runtimeBaseCommon = path.join(workspaceOut, 'vs/base/common');
	const runtimeWorkbenchBaseCommon = path.join(workspaceOut, 'vs/workbench/base/common');
	const runtimeRootBaseCommon = path.join(workspaceOut, 'base/common');
	if (fs.existsSync(runtimeBaseCommon)) {
		fs.cpSync(runtimeBaseCommon, runtimeWorkbenchBaseCommon, { recursive: true });
		fs.cpSync(runtimeBaseCommon, runtimeRootBaseCommon, { recursive: true });
	}

	console.log('✅ Build complete!');
}
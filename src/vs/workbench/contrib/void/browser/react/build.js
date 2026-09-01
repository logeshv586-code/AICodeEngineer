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

function visitJavaScriptFiles(rootDir, callback) {
	const visit = (currentDir) => {
		for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
			const entryPath = path.join(currentDir, entry.name);
			if (entry.isDirectory()) {
				visit(entryPath);
				continue;
			}
			if (entry.isFile() && entry.name.endsWith('.js')) callback(entryPath);
		}
	};
	visit(rootDir);
}

// tsup bundles nested React sources into react/out/<entry>/index.js, but it keeps
// imports that climb three or more directories external. A source import such as
// ../../../../../common/... is correct from workspace-tsx/components, yet the same
// literal path is one level too deep after flattening and resolves to contrib/common.
// Rebase only this known shape when the canonical void/common target actually exists.
function rebaseFlattenedCommonImports(bundleRoot) {
	const sourcePrefix = '../../../../../common/';
	const runtimePrefix = '../../../../common/';
	let rewriteCount = 0;

	visitJavaScriptFiles(bundleRoot, (bundlePath) => {
		const content = fs.readFileSync(bundlePath, 'utf8');
		const rewritten = content.replace(
			/(["'])(\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/common\/[^"']+\.js)\1/g,
			(match, quote, specifier) => {
				if (!specifier.startsWith(sourcePrefix)) return match;
				const runtimeSpecifier = runtimePrefix + specifier.slice(sourcePrefix.length);
				const runtimeTarget = path.resolve(path.dirname(bundlePath), runtimeSpecifier);
				if (!fs.existsSync(runtimeTarget)) return match;
				rewriteCount++;
				console.log(`[forge] Rebased flattened import ${path.relative(bundleRoot, bundlePath)}: ${specifier} -> ${runtimeSpecifier}`);
				return `${quote}${runtimeSpecifier}${quote}`;
			}
		);
		if (rewritten !== content) fs.writeFileSync(bundlePath, rewritten, 'utf8');
	});

	return rewriteCount;
}

// A preserved import from a nested React source directory can have the same
// flattening problem for modules that live directly under void/browser. From an
// emitted entry point, ../../../../ resolves under void instead of void/browser.
// Only shorten the import when the emitted URL is missing and the one-level
// shallower URL exists, so intentional void/common imports remain untouched.
function rebaseFlattenedBrowserImports(bundleRoot) {
	const sourcePrefix = '../../../../';
	const runtimePrefix = '../../../';
	let rewriteCount = 0;

	visitJavaScriptFiles(bundleRoot, (bundlePath) => {
		const content = fs.readFileSync(bundlePath, 'utf8');
		const rewritten = content.replace(
			/(^[^\S\r\n]*(?:import|export)\b[^\r\n]*?["'])(\.\.\/\.\.\/\.\.\/\.\.\/[^"']+\.js)(["'])/gm,
			(match, beforeSpecifier, specifier, closingQuote) => {
				if (!specifier.startsWith(sourcePrefix)) return match;
				const currentTarget = path.resolve(path.dirname(bundlePath), specifier);
				if (fs.existsSync(currentTarget)) return match;

				const runtimeSpecifier = runtimePrefix + specifier.slice(sourcePrefix.length);
				const runtimeTarget = path.resolve(path.dirname(bundlePath), runtimeSpecifier);
				if (!fs.existsSync(runtimeTarget)) return match;

				rewriteCount++;
				console.log(`[forge] Rebased flattened browser import ${path.relative(bundleRoot, bundlePath)}: ${specifier} -> ${runtimeSpecifier}`);
				return `${beforeSpecifier}${runtimeSpecifier}${closingQuote}`;
			}
		);
		if (rewritten !== content) fs.writeFileSync(bundlePath, rewritten, 'utf8');
	});

	return rewriteCount;
}

// Validate the URLs Electron will actually request, not just a hand-picked list of
// canonical compiler outputs. This catches a preserved relative import whose module
// exists elsewhere in out/ but is unreachable from the emitted bundle's directory.
function findMissingRelativeRuntimeImports(bundleRoot) {
	const missing = [];
	const importPattern = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(["'])(\.\.\/[^"']+\.js)\1/g;

	visitJavaScriptFiles(bundleRoot, (bundlePath) => {
		const content = fs.readFileSync(bundlePath, 'utf8');
		importPattern.lastIndex = 0;
		let match;
		while ((match = importPattern.exec(content)) !== null) {
			const specifier = match[2];
			const target = path.resolve(path.dirname(bundlePath), specifier);
			if (!fs.existsSync(target)) {
				missing.push({ bundlePath, specifier, target });
			}
		}
	});

	return missing;
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

	const rebasedImports = rebaseFlattenedCommonImports(runtimeReactOut)
		+ rebaseFlattenedBrowserImports(runtimeReactOut);
	if (rebasedImports > 0) {
		// Keep the generated source-side output in sync so a later core compile does
		// not copy the pre-rebased bundle back over the verified runtime tree.
		fs.cpSync(runtimeReactOut, path.join(__dirname, 'out'), { recursive: true });
		console.log(`[forge] Rebased ${rebasedImports} flattened runtime import${rebasedImports === 1 ? '' : 's'}.`);
	}

	const missingRuntimeImports = findMissingRelativeRuntimeImports(runtimeReactOut);
	if (missingRuntimeImports.length > 0) {
		console.error('[forge] React bundles contain unresolved relative runtime imports:');
		for (const missing of missingRuntimeImports) {
			console.error(`  - ${path.relative(runtimeReactOut, missing.bundlePath)}: ${missing.specifier}`);
			console.error(`    -> ${path.relative(path.dirname(packageJsonPath), missing.target)}`);
		}
		throw new Error(`[forge] ${missingRuntimeImports.length} unresolved React runtime import${missingRuntimeImports.length === 1 ? '' : 's'}`);
	}
	console.log('[forge] Verified all preserved React relative .js imports resolve from their emitted runtime locations.');

	console.log('✅ Build complete!');
}

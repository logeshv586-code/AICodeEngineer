import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, 'src');
const src2Dir = path.join(__dirname, 'src2');
const outDir = path.join(__dirname, 'out');

// 1. Copy src to src2
fs.cpSync(srcDir, src2Dir, { recursive: true });

// 2. Build with esbuild
const entries = [
	'void-editor-widgets-tsx/index.tsx',
	'sidebar-tsx/index.tsx',
	'void-settings-tsx/index.tsx',
	'void-tooltip/index.tsx',
	'void-onboarding/index.tsx',
	'quick-edit-tsx/index.tsx',
	'diff/index.tsx',
];

console.log('📦 Building React bundles with esbuild...');

for (const entry of entries) {
	const entryPath = path.join(src2Dir, entry);
	const outFile = path.join(outDir, entry.replace(/\.tsx$/, '.js'));

	await esbuild.build({
		entryPoints: [entryPath],
		outfile: outFile,
		bundle: true,
		format: 'esm',
		platform: 'browser',
		target: 'esnext',
		loader: { '.tsx': 'tsx', '.ts': 'ts', '.css': 'css' },
		external: ['../../../*.js'],
		logLevel: 'info',
	});
}

console.log('✅ React bundle build finished!');

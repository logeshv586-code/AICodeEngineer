import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(repoRoot, relative), 'utf8');
const readBuffer = relative => fs.readFileSync(path.join(repoRoot, relative));
const exists = relative => fs.existsSync(path.join(repoRoot, relative));
const size = relative => exists(relative) ? fs.statSync(path.join(repoRoot, relative)).size : 0;
const contains = (text, all) => all.every(token => text.includes(token));
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');

const files = {
	product: read('product.json'),
	conversation: read('src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/ConversationShell.tsx'),
	brandMark: read('src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/components/ForgeBrandMark.tsx'),
	brandCss: read('src/vs/workbench/contrib/void/browser/react/src/workspace-tsx/forgeBrand.css'),
	brandSvg: read('resources/forge/forge-mark.svg'),
	winManifest: read('resources/win32/VisualElementsManifest.xml'),
	linuxDesktop: read('resources/linux/code.desktop'),
	linuxHandler: read('resources/linux/code-url-handler.desktop'),
	linuxAppdata: read('resources/linux/code.appdata.xml'),
};

const product = JSON.parse(files.product);
const expectedRepo = 'https://github.com/logeshv586-code/AICodeEngineer';
const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });

check('Forge product identity', product.nameShort === 'Forge' && String(product.nameLong).startsWith('Forge') && product.applicationName === 'forge-ai', 'Desktop identity must stay Forge.');
check('Forge license metadata', product.licenseName === 'Apache-2.0' && String(product.licenseUrl).startsWith(expectedRepo), 'Product metadata must match LICENSE.txt and point at this repository.');
check('Forge issue routing', product.reportIssueUrl === `${expectedRepo}/issues/new`, 'Report Issue must open the Forge repository, not an upstream project.');
check('trusted links are Forge-owned', Array.isArray(product.linkProtectionTrustedDomains) && product.linkProtectionTrustedDomains.includes(expectedRepo) && !product.linkProtectionTrustedDomains.some(domain => String(domain).includes('voideditor')), 'Default trusted-domain branding must not silently trust the old product site.');

check('active attachment-only send', contains(files.conversation, ['const selections = chatThreadsService.getCurrentThreadState().stagingSelections.slice()', "const effectiveMessage = trimmed || (selections.length > 0 ? 'Inspect the attached context and continue with the task.' : '')", '_chatSelections: selections']), 'The active conversation shell must preserve staged context even when the text box is empty.');
check('premium Forge palette', contains(files.brandCss, ['--forge-iris:', '--forge-cyan:', '--forge-ember:', '--forge-focus-ring:', 'forge-premium-shell']), 'Forge must keep its own obsidian/iris/cyan/ember system.');
check('keyboard focus visibility', contains(files.brandCss, [':focus-visible', 'outline: 2px solid var(--forge-focus-ring)', 'outline-offset: 2px']), 'Keyboard users need a visible premium focus ring.');
check('reduced motion support', contains(files.brandCss, ['prefers-reduced-motion: reduce', 'transition-duration: 0.01ms', 'animation-duration: 0.01ms']), 'Reduced-motion preference must be respected.');
check('Forge mark consistency', contains(files.brandMark, ['#8B8DFF', '#55D8FF', '#F4C668']) && contains(files.brandSvg, ['#8B8DFF', '#55D8FF', '#F4C668']), 'Reusable UI mark and standalone vector asset must share the same identity colors.');

check('Windows tile brand', contains(files.winManifest, ['BackgroundColor="#0D1628"', 'ForegroundText="light"', 'ShortDisplayName="Forge"']), 'Windows tile metadata must display Forge on the premium dark background.');
check('Linux desktop brand', contains(files.linuxDesktop, ['AI Development Environment', 'Keywords=forge;ai;agent;coding;automation;development;ide;']) && !files.linuxDesktop.includes('Keywords=vscode'), 'Linux launcher metadata must identify Forge rather than VS Code.');
check('Linux URL handler brand', contains(files.linuxHandler, ['Open Forge AI Engineering Studio', 'Keywords=forge;ai;agent;coding;ide;']) && !files.linuxHandler.includes('Code Editing. Redefined.'), 'Deep-link launcher metadata must be Forge-specific.');
check('Linux app-store brand', contains(files.linuxAppdata, [expectedRepo, 'Forge is an AI engineering studio', 'adaptive AI model routing']) && !files.linuxAppdata.includes('Visual Studio Code'), 'AppStream metadata must describe Forge rather than the upstream editor.');

// Native packaging still expects historical VS Code-compatible filenames, but the
// bytes behind those paths must now be Forge-owned brand assets.
const nativeAssets = [
	'resources/win32/code.ico',
	'resources/win32/code_150x150.png',
	'resources/win32/code_70x70.png',
	'resources/linux/code.png',
	'resources/darwin/code.icns',
	'resources/forge/forge-mark-150.png',
];
check('native icon assets present', nativeAssets.every(asset => size(asset) > 1024), 'Platform icon files must remain present for Windows, Linux, macOS, and the canonical Forge raster source.');

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const linuxIcon = readBuffer('resources/linux/code.png');
const win70 = readBuffer('resources/win32/code_70x70.png');
const win150 = readBuffer('resources/win32/code_150x150.png');
const canonicalRaster = readBuffer('resources/forge/forge-mark-150.png');
const winIco = readBuffer('resources/win32/code.ico');
const macIcns = readBuffer('resources/darwin/code.icns');
check('native icon file signatures', linuxIcon.subarray(0, 8).equals(pngSignature) && win70.subarray(0, 8).equals(pngSignature) && win150.subarray(0, 8).equals(pngSignature) && winIco[0] === 0 && winIco[1] === 0 && winIco[2] === 1 && winIco[3] === 0 && macIcns.subarray(0, 4).toString('ascii') === 'icns', 'Native package icons must remain valid PNG, ICO, and ICNS files.');
check('native raster uses Forge mark', sha256(linuxIcon) === sha256(canonicalRaster) && sha256(win150) === sha256(canonicalRaster), 'Linux and Windows 150px package icons must use the canonical Forge raster mark.');

for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name.padEnd(32)} ${item.detail}`);
const failed = checks.filter(item => !item.ok);
if (failed.length) {
	console.error(`\nForge brand contract failed: ${failed.map(item => item.name).join(', ')}`);
	process.exitCode = 1;
} else {
	console.log('\nForge brand contract passed.');
}

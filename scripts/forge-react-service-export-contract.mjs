import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reactRoot = path.join(repoRoot, 'src/vs/workbench/contrib/void/browser/react/src');
const servicesPath = path.join(reactRoot, 'util/services.tsx');

const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});

const services = fs.readFileSync(servicesPath, 'utf8');
const exports = new Set();
for (const match of services.matchAll(/\bexport\s+(?:const|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g)) exports.add(match[1]);
for (const match of services.matchAll(/\bexport\s*\{([^}]+)\}/g)) {
  for (const item of match[1].split(',')) {
    const name = item.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]?.trim();
    if (name) exports.add(name);
  }
}

const missing = [];
let importCount = 0;
for (const file of walk(reactRoot)) {
  if (!/\.(?:ts|tsx)$/.test(file) || file === servicesPath) continue;
  const source = fs.readFileSync(file, 'utf8');
  const importPattern = /import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]*util\/services\.tsx)['"]/g;
  for (const match of source.matchAll(importPattern)) {
    const specifiers = match[1].split(',').map(value => value.trim()).filter(Boolean);
    for (const specifier of specifiers) {
      const imported = specifier.replace(/^type\s+/, '').split(/\s+as\s+/)[0]?.trim();
      if (!imported) continue;
      importCount += 1;
      if (!exports.has(imported)) {
        missing.push({ imported, file: path.relative(repoRoot, file).replaceAll('\\', '/') });
      }
    }
  }
}

if (missing.length) {
  console.error('Forge React service export contract FAILED.');
  for (const item of missing) console.error(`  Missing export ${item.imported} required by ${item.file}`);
  process.exitCode = 1;
} else {
  console.log(`Forge React service export contract passed: ${exports.size} exports cover ${importCount} named imports.`);
}

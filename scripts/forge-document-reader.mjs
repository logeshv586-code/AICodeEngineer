import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helper = path.join(root, 'scripts', 'forge-document-reader.py');

const pythonCandidates = () => process.platform === 'win32'
  ? [['py', ['-3']], ['python', []], ['python3', []]]
  : [['python3', []], ['python', []]];

const execFileAsync = promisify(execFile);

const locatePython = () => {
  for (const [command, prefix] of pythonCandidates()) {
    const probe = spawnSync(command, [...prefix, '--version'], { encoding: 'utf8', windowsHide: true, timeout: 2000 });
    if (!probe.error && probe.status === 0) return { command, prefix };
  }
  return null;
};

export const documentStatus = () => ({
  helperExists: fs.existsSync(helper),
  python: locatePython()?.command || null,
  supported: ['pdf', 'docx', 'xlsx', 'pptx', 'csv', 'rtf', 'txt', 'md', 'json', 'xml', 'yaml', 'code/text files'],
  pdfBackends: 'pypdf, PyMuPDF, or pdftotext (first available)',
});

export const readDocument = async ({ path: documentPath, maxChars = 60000 } = {}) => {
  if (!documentPath || typeof documentPath !== 'string') throw new Error('forge_document requires a local file path.');
  if (!fs.existsSync(documentPath) || !fs.statSync(documentPath).isFile()) throw new Error(`Document not found: ${documentPath}`);
  const python = locatePython();
  if (!python) throw new Error('Python 3 is required for Forge document extraction and was not found.');
  const result = await execFileAsync(python.command, [...python.prefix, helper, '--path', documentPath, '--max-chars', String(maxChars)], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
    timeout: 60000,
  }).catch(error => {
    if (error.killed) throw new Error('Document extraction timed out after 60 seconds.');
    let details;
    try { details = JSON.parse(error.stdout || '{}'); } catch { /* non-JSON process failure */ }
    throw new Error(details?.error || error.message || 'Document extraction failed.');
  });
  const output = (result.stdout || '').trim();
  let parsed;
  try { parsed = output ? JSON.parse(output) : null; } catch { parsed = null; }
  if (parsed?.error) throw new Error(parsed?.error || result.stderr || 'Document extraction failed.');
  if (!parsed) throw new Error('Document reader returned no structured result.');
  return parsed;
};

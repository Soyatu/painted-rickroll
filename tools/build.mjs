// Concatenate src/*.js (in name order) into src/template.html -> index.html, then syntax-check.
import { readFileSync, writeFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const parts = readdirSync(src).filter(f => f.endsWith('.js')).sort();
const js = parts.map(f => `// ---- ${f}\n` + readFileSync(join(src, f), 'utf8')).join('\n');
const tmp = join(mkdtempSync(join(tmpdir(), 'rick-')), 'bundle.js');
writeFileSync(tmp, js);
execFileSync(process.execPath, ['--check', tmp], { stdio: 'inherit' });
const html = readFileSync(join(src, 'template.html'), 'utf8').replace('/*__SCRIPT__*/', () => js);
writeFileSync(join(root, 'index.html'), html);
console.log(`built index.html: ${parts.length} modules, ${(html.length / 1024).toFixed(1)} KB`);

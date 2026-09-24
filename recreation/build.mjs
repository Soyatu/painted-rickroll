// Concatenates src/*.js (in name order) into src/template.html -> index.html, then syntax-checks it.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');
const files = readdirSync(src).filter(f => f.endsWith('.js')).sort();
const js = files.map(f => `// ---- ${f}\n` + readFileSync(join(src, f), 'utf8').trimEnd()).join('\n\n');
try {
  new Function(js);
} catch (e) {
  console.error('syntax error:', e.message);
  process.exit(1);
}
const tpl = readFileSync(join(src, 'template.html'), 'utf8');
const out = tpl.replace('/*__SCRIPT__*/', () => js);
writeFileSync(join(here, 'index.html'), out);
console.log(`index.html: ${files.length} modules, ${(out.length / 1024).toFixed(1)} KB`);

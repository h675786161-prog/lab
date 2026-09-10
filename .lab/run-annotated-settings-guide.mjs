import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceUrl = new URL('./annotate-settings-guide.mjs', import.meta.url);
const source = await fs.readFile(sourceUrl, 'utf8');
const broken = 'const noteNode = atlas.querySelector(`#setting-note-${CSS.escape(key)}`);';
const fixed = "const noteNode = document.getElementById('setting-note-' + key);";
if (!source.includes(broken)) throw new Error('settings annotation compatibility patch target missing');
const patched = source.replace(broken, fixed);
const tempFile = path.join('/tmp', `annotate-settings-guide-${process.pid}.mjs`);
await fs.writeFile(tempFile, patched);
try {
  await import(`${pathToFileURL(tempFile).href}?v=${Date.now()}`);
} finally {
  await fs.rm(tempFile, { force: true });
}

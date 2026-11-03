import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('./', import.meta.url);
const source = await readFile(new URL('src/client.js', root), 'utf8');
const image = await readFile(new URL('assets/nailong.png', root));
await mkdir(new URL('lib/', root), { recursive: true });
await writeFile(new URL('lib/client.js', root), source.replace('__NAILONG_IMAGE__', `data:image/png;base64,${image.toString('base64')}`));
console.log('Built offline NaiLong client plugin.');

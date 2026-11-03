import { cp, mkdir, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
await mkdir(join(root, 'site/assets'), { recursive: true });
await cp(join(root, 'assets/nailong.png'), join(root, 'site/assets/nailong.png'));
for (const id of (await readdir(join(root, 'skins'))).filter(x => x.startsWith('nailong-'))) {
  await cp(join(root, 'skins', id), join(root, 'site/skins', id), { recursive: true });
}
// Pillow decodes WebP and writes genuine idle-frame GIFs, not simulated motion.
const result = spawnSync('python', [join(root, 'scripts/preview-gifs.py')], { cwd: root, encoding: 'utf8' });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(result.stderr || result.stdout);
process.stdout.write(result.stdout);
console.log('Built site assets from installation skins.');

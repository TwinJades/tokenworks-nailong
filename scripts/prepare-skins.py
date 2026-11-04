#!/usr/bin/env python3
"""Recreate skin assets from the pinned files in third-party (Pillow 12.3.0)."""
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
THIRD = ROOT / 'third-party'
SKINS = ROOT / 'skins'


def save_manifest(directory, manifest):
    (directory / 'skin.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def header(name, author, width, height):
    # The upstream repository license is preserved separately. Character and
    # collected-image rights are not represented by an SPDX license here.
    return {'schemaVersion': 1, 'id': 'nailong-' + name, 'name': '奶龙 · ' + author,
            'author': author, 'frame': {'width': width, 'height': height}, 'animations': {}}


for name, author, original, idle in [
    ('zhengyici', 'Zhengyici', THIRD / 'zhengyici/assets/nailong-spritesheet.webp', 6),
    ('erich207', 'erich207', THIRD / 'erich207/spritesheet.webp', 7),
]:
    target = SKINS / ('nailong-' + name)
    target.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(original, target / 'sheet.webp')
    sheet = Image.open(original).convert('RGBA')
    sheet.crop((7 * 192, 5 * 208, 8 * 192, 6 * 208)).save(target / 'sleep.png')
    skin = header(name, author, 192, 208)
    for state, row, count in [('idle', 0, idle), ('think', 8, 6), ('attention', 6, 6),
                              ('done', 4, 5), ('failed', 5, 8), ('drag', 1, 8),
                              ('react', 3, 4), ('peek', 6, 6), ('greet', 3, 4)]:
        skin['animations'][state] = {'sheet': 'sheet.webp', 'columns': 8, 'row': row, 'frames': count, 'fps': 8}
    skin['animations']['sleep'] = {'image': 'sleep.png'}
    save_manifest(target, skin)

source = THIRD / 'mosterpath/packs/nailong'
target = SKINS / 'nailong-mosterpath'
target.mkdir(parents=True, exist_ok=True)
size = (256, 256)


def fitted(image):
    image = image.convert('RGBA')
    image.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', size)
    canvas.alpha_composite(image, ((size[0] - image.width) // 2, size[1] - image.height))
    return canvas


paths = {'idle': '03-idle/01-half-lidded.png', 'think': '04-think/01-green-eye-chin.png',
         'attention': '05-shock/01-green-eye-kick.png', 'failed': '05-shock/02-green-eye-headgrab.png',
         'drag': '09-variants/01-crawl-laugh.png', 'react': '09-variants/02-peace-tongue.png',
         'peek': '09-variants/04-green-smile.png'}
skin = header('mosterpath', 'mosterpath', *size)
for state, path in paths.items():
    with Image.open(source / path) as image:
        fitted(image).save(target / (state + '.png'), optimize=True)
    skin['animations'][state] = {'image': state + '.png'}
skin['animations']['drag']['motion'] = 'dangle'
skin['animations']['sleep'] = {'image': 'idle.png'}
skin['animations']['greet'] = {'image': 'react.png'}
# Pillow composites successive GIF frames using their disposal information.
# Group consecutive original frames into <=64 uniformly sized time intervals;
# retaining their summed durations preserves the full animation cycle.
with Image.open(source / 'laugh.gif') as gif:
    total = gif.n_frames
    groups = min(total, 64)
    frames, durations = [], []
    for i in range(groups):
        start, end = i * total // groups, (i + 1) * total // groups
        gif.seek(start)
        filename = f'laugh-{i:02d}.webp'
        fitted(gif).save(target / filename, lossless=True, method=6)
        frames.append(filename)
        duration = 0
        for n in range(start, end):
            gif.seek(n)
            duration += max(1, gif.info.get('duration', 100))
        durations.append(duration)
    skin['animations']['done'] = {'frames': frames, 'frameMs': durations, 'playback': 'loop'}
# Apply committed alpha masks to the original fitted RGB pixels. This keeps
# routine rebuilds deterministic and avoids requiring inference dependencies.
from PIL import ImageChops
for image_path in target.iterdir():
    if image_path.suffix not in ['.png', '.webp']:
        continue
    mask_path = ROOT / 'assets/mosterpath-masks' / (image_path.stem + '.png')
    if not mask_path.is_file():
        raise FileNotFoundError(f'Missing reviewed foreground mask: {mask_path}')
    with Image.open(image_path) as original, Image.open(mask_path) as mask:
        result = original.convert('RGBA')
        result.putalpha(ImageChops.multiply(result.getchannel('A'), mask.convert('L')))
        if image_path.suffix == '.webp':
            result.save(image_path, lossless=True, method=6)
        else:
            result.save(image_path, optimize=True)
save_manifest(target, skin)

# Notices travel with each installed skin, not only with the source repository.
for name in ['zhengyici', 'erich207', 'mosterpath']:
    target = SKINS / ('nailong-' + name)
    shutil.copyfile(THIRD / name / 'LICENSE', target / 'UPSTREAM-LICENSE.txt')
    if name == 'erich207':
        shutil.copyfile(THIRD / name / 'NOTICE.md', target / 'UPSTREAM-NOTICE.md')
    if name == 'mosterpath':
        shutil.copyfile(THIRD / name / 'packs/nailong/README.md', target / 'UPSTREAM-ASSETS.md')
    notes = json.loads((THIRD / 'provenance.json').read_text(encoding='utf-8'))[name]
    (target / 'SOURCE.md').write_text(notes['repository'] + '\n\nCommit: ' + notes['commit'] + '\n\n' + notes['notes'] + '\n', encoding='utf-8')

# Keep the output checksum inventory synchronized with reproducible conversion.
import hashlib
provenance_path = THIRD / 'provenance.json'
provenance = json.loads(provenance_path.read_text(encoding='utf-8'))
for name in provenance:
    provenance[name]['skin_files_sha256'] = {
        file.name: hashlib.sha256(file.read_bytes()).hexdigest()
        for file in sorted((SKINS / ('nailong-' + name)).iterdir()) if file.is_file()
    }
provenance_path.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

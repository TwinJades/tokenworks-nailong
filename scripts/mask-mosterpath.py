"""Generate reviewed alpha masks from original fitted artwork; rembg 2.0.69/u2net.
Run prepare-skins.py first to restore the original fitted source if changing masks.
Masks are committed so ordinary skin rebuilds require only Pillow, not ML models.
"""
from pathlib import Path
import os
from PIL import Image
from rembg import remove, new_session
import numpy as np
import cv2
from scipy.ndimage import binary_fill_holes
root = Path(__file__).resolve().parent.parent
source = root / 'skins/nailong-mosterpath'
target = root / 'assets/mosterpath-masks'
target.mkdir(parents=True, exist_ok=True)
session = new_session('u2net')
for path in sorted(source.iterdir()):
    if path.suffix not in ['.png', '.webp']:
        continue
    originals = root / 'third-party/mosterpath/packs/nailong'
    static = {'idle': '03-idle/01-half-lidded.png', 'think': '04-think/01-green-eye-chin.png', 'attention': '05-shock/01-green-eye-kick.png', 'failed': '05-shock/02-green-eye-headgrab.png', 'drag': '09-variants/01-crawl-laugh.png', 'react': '09-variants/02-peace-tongue.png', 'peek': '09-variants/04-green-smile.png'}
    if path.stem.startswith('laugh-'):
        original = Image.open(originals / 'laugh.gif')
        original.seek(int(path.stem.split('-')[1]) * original.n_frames // 64)
    else:
        original = Image.open(originals / static[path.stem])
    original = original.convert('RGBA')
    original.thumbnail((256, 256), Image.Resampling.LANCZOS)
    image = Image.new('RGBA', (256, 256))
    image.alpha_composite(original, ((256 - original.width) // 2, 256 - original.height))
    mask = remove(image, session=session, only_mask=True).convert('L')
    # Suppress near-transparent background haze without cutting dark body details.
    mask = mask.point(lambda a: 0 if a < 12 else 255 if a > 243 else round((a - 12) * 255 / 231))
    # Original padding stays transparent even if the model proposes foreground there.
    from PIL import ImageChops
    mask = ImageChops.multiply(mask, image.getchannel('A'))
    if path.stem.startswith('laugh-'):
        rgb = np.array(image.convert('RGB'))
        hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
        valid = np.array(image.getchannel('A')) > 0
        yellow = (hsv[:, :, 1] > 65) & (hsv[:, :, 0] < 45) & valid
        labels = np.full(valid.shape, cv2.GC_PR_BGD, dtype=np.uint8)
        labels[np.array(mask) > 100] = cv2.GC_PR_FGD
        labels[(hsv[:, :, 1] < 38) | ~valid] = cv2.GC_BGD
        labels[yellow] = cv2.GC_FGD
        cv2.grabCut(rgb, labels, None, np.zeros((1, 65)), np.zeros((1, 65)), 5, cv2.GC_INIT_WITH_MASK)
        foreground = (labels == cv2.GC_FGD) | (labels == cv2.GC_PR_FGD)
        foreground = binary_fill_holes(foreground)
        mask = Image.fromarray((foreground * 255).astype('uint8'))
    else:
        # Pale belly is enclosed by the yellow body, never a background hole.
        filled = binary_fill_holes(np.array(mask) > 100)
        mask = Image.fromarray(np.maximum(np.array(mask), filled.astype('uint8') * 255))
    mask = ImageChops.multiply(mask, image.getchannel('A'))
    mask.save(target / (path.stem + '.png'), optimize=True)
    print(path.name, flush=True)

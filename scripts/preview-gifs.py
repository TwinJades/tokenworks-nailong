from pathlib import Path
import json
from PIL import Image
root = Path(__file__).resolve().parent.parent
for directory in sorted((root / 'skins').glob('nailong-*')):
    skin = json.loads((directory / 'skin.json').read_text(encoding='utf-8'))
    animation = skin['animations']['idle']
    width, height = skin['frame']['width'], skin['frame']['height']
    frames = []
    if 'sheet' in animation:
        sheet = Image.open(directory / animation['sheet']).convert('RGBA')
        columns = animation.get('columns', animation['frames'])
        for index in range(animation['frames']):
            x = index % columns * width
            y = (animation.get('row', 0) + index // columns) * height
            frames.append(sheet.crop((x, y, x + width, y + height)))
    else:
        for file in animation.get('frames', [animation.get('image')]):
            frames.append(Image.open(directory / file).convert('RGBA'))
    durations = animation.get('frameMs', [round(1000 / animation.get('fps', 8))] * len(frames))
    if animation.get('playback') == 'pingpong' and len(frames) > 2:
        frames += frames[-2:0:-1]
        durations += durations[-2:0:-1]
    # White matte avoids GIF palette transparency halos; original install art stays unchanged.
    output = []
    for frame in frames:
        matte = Image.new('RGBA', frame.size, 'white')
        matte.alpha_composite(frame)
        output.append(matte.convert('RGB'))
    target = root / 'site' / 'assets' / (directory.name + '.gif')
    output[0].save(target, save_all=True, append_images=output[1:], duration=durations, loop=0, disposal=2)
    print(f'{target.name}: {len(frames)} actual idle frame(s)')

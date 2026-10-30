"""Encode actual final-design browser frames. No generated or interpolated gameplay."""
from pathlib import Path
from base64 import b64encode
from PIL import Image

root = Path(__file__).resolve().parents[2]
for name, duration in [('ark', 180), ('livewire', 120)]:
    frames = []
    for path in sorted((root / '.local' / 'final-media' / name).glob('*.png')):
        with Image.open(path) as source:
            frame = source.convert('RGB')
            frame.thumbnail((800, 500), Image.Resampling.LANCZOS)
            frames.append(frame)
    if len(frames) != 24:
        raise ValueError(f'Expected 24 real {name} frames')
    palette = frames[0].quantize(colors=64)
    frames = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
    output = root / 'assets' / 'readme' / ('ark-roll.gif' if name == 'ark' else 'minecraft-livewire.gif')
    frames[0].save(output, save_all=True, append_images=frames[1:], duration=duration, loop=0, optimize=True, disposal=2)
    if output.stat().st_size > 5_000_000:
        raise ValueError(f'{output.name} exceeds the documentation budget')
    print(f'{output.name}: {len(frames)} actual frames, {output.stat().st_size} bytes')

# Portable SVG container for the actual recorded animation; GitHub's inline SVG animation is unsupported.
gif = b64encode((root / 'assets/readme/ark-roll.gif').read_bytes()).decode('ascii')
(root / 'assets/readme/ark-roll.svg').write_text(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600" role="img" aria-labelledby="title desc"><title id="title">TORCHLINE · The Awakening</title><desc id="desc">Actual final-design Ark footage. Open in an SVG-capable browser; use the PNG still for reduced motion. Saved practice, not Twitch evidence.</desc><image width="960" height="600" href="data:image/gif;base64,{gif}"/></svg>''', encoding='utf-8')

"""Encode original vector-animation frames and actual gameplay frames as GIFs."""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[2]
frames=ROOT/'.local/readme-frames'
out=ROOT/'assets/readme'
for kind, duration in [('game',170),('trace',85)]:
    files=sorted(frames.glob(f'{kind}-*.png'))
    expected=72 if kind=='game' else 48
    if len(files)!=expected: raise RuntimeError(f'Expected {expected} owned {kind} frames.')
    rgb=[Image.open(file).convert('RGB') for file in files]
    if kind=='game': rgb=[image.resize((720,450), Image.Resampling.LANCZOS) for image in rgb]
    if len(rgb[0].getcolors(maxcolors=1000000) or []) < 32: raise RuntimeError('Capture has no meaningful visual content.')
    # A common palette prevents color shimmer between frames.
    sheet=Image.new('RGB',(rgb[0].width,len(rgb[::8])*rgb[0].height))
    for i,img in enumerate(rgb[::8]): sheet.paste(img,(0,i*img.height))
    palette=sheet.quantize(colors=128,method=Image.Quantize.MEDIANCUT)
    images=[img.quantize(palette=palette,dither=Image.Dither.NONE) for img in rgb]
    path=out/('gameplay.gif' if kind=='game' else 'world-trace.gif')
    images[0].save(path,save_all=True,append_images=images[1:],duration=duration,loop=0,optimize=True,disposal=1)
    if path.stat().st_size>5_000_000: raise RuntimeError(f'{path.name} exceeds the README motion budget.')
    with Image.open(path) as encoded:
        count=encoded.n_frames
        total=0
        for index in range(count):
            encoded.seek(index)
            total+=encoded.info.get('duration',0)
        # GIF stores hundredths of a second and may merge identical images.
        if count<2 or total!=(duration//10*10)*len(images):
            raise RuntimeError('Encoded animation lost motion or changed its total duration.')
        print(path.name,path.stat().st_size,'bytes',count,'encoded frames',total,'milliseconds')
contact=Image.new('RGB',(1200,750),'#05060a')
for n,index in enumerate([0,23,47,71]):
    img=Image.open(frames/f'game-{index:03}.png').convert('RGB').resize((600,375))
    contact.paste(img,(n%2*600,n//2*375))
contact.save(ROOT/'.local/readme-frames/contact.png')

"""Original README vectors using shipped OFL fonts and the actual Ark render.
Requires Pillow and fontTools for documentation generation, never app runtime.
"""
from pathlib import Path
from base64 import b64encode
from html import escape
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/readme'
OUT.mkdir(parents=True, exist_ok=True)
FONTS = {name: TTFont(ROOT / f'apps/web/public/fonts/{name}.ttf') for name in ['tektur', 'saira', 'kode-mono']}

def text(value, x, y, size, font='kode-mono', color='#a4b4c2', tracking=0, anchor='start'):
    face = FONTS[font]
    glyphs, cmap, units = face.getGlyphSet(), face.getBestCmap(), face['head'].unitsPerEm
    advance = sum(face['hmtx'][cmap.get(ord(c), 'question')][0] for c in value) * size / units + max(0, len(value)-1) * tracking
    if anchor == 'middle': x -= advance / 2
    if anchor == 'end': x -= advance
    parts = []
    for char in value:
        name = cmap.get(ord(char), 'question')
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        if pen.getCommands():
            parts.append(f'<path d="{pen.getCommands()}" transform="translate({x:.3f} {y}) scale({size/units:.7f} {-size/units:.7f})"/>')
        x += face['hmtx'][name][0] * size / units + tracking
    return f'<g fill="{color}" aria-label="{escape(value)}">'+''.join(parts)+'</g>'

def svg(width, height, title, body, defs=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc"><title id="title">{escape(title)}</title><desc id="desc">Original TORCHLINE documentation artwork. Text and full explanations are available in the README.</desc><defs>{defs}</defs>{body}</svg>\n'

stars = ''.join(f'<circle cx="{(i*137+53)%1400}" cy="{(i*i*17+97)%620}" r="{0.5+(i%3)*0.35}" fill="#aec7cf" opacity="{0.1+(i%5)*0.04}"/>' for i in range(100))
render = b64encode((OUT / 'ark-render.png').read_bytes()).decode()
hero_defs = '''<linearGradient id="wordmark" x2="0" y2="1"><stop stop-color="#ffffff"/><stop offset=".55" stop-color="#e3e4e9"/><stop offset="1" stop-color="#8e939f"/></linearGradient><radialGradient id="space"><stop stop-color="#2f1d18"/><stop offset="1" stop-color="#05060a"/></radialGradient><linearGradient id="edge"><stop stop-color="#ffd086" stop-opacity="0"/><stop offset=".5" stop-color="#ffd086"/><stop offset="1" stop-color="#ffd086" stop-opacity="0"/></linearGradient><linearGradient id="fade"><stop stop-color="white" stop-opacity="0"/><stop offset=".16" stop-color="white"/><stop offset=".92" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><mask id="scene"><rect width="1600" height="800" fill="url(#fade)"/></mask><clipPath id="frame"><rect width="1400" height="720" rx="18"/></clipPath>'''
body = f'<g clip-path="url(#frame)"><rect width="1400" height="720" fill="#05060a"/><ellipse cx="160" cy="230" rx="800" ry="580" fill="url(#space)"/>{stars}'
body += '<path d="M64 54 72 62 64 70 56 62Z" fill="#ffd086"/><path d="M88 62H350" stroke="url(#edge)"/>'
body += text('CODEX x TWITCHCON', 88, 51, 10, tracking=2, color='#e7bd7b')
body += text('SEASON 01 / THE ARK PROTOCOL', 1336, 62, 11, anchor='end', tracking=2)
body += text('TORCHLINE', 64, 184, 142, 'tektur', 'url(#wordmark)', 9)
body += f'<image x="340" y="210" width="1080" height="540" href="data:image/png;base64,{render}" mask="url(#scene)"/>'
body += text('The stream ends.', 65, 286, 35, 'saira', '#ffffff')
body += text("The world doesn’t.", 65, 328, 35, 'saira', '#ffffff')
body += '<path d="M65 371H143" stroke="#e7bd7b" stroke-width="2"/>'
body += text('CHAT SHAPES THE JOURNEY.', 65, 407, 11, color='#b2cdd1', tracking=1)
body += text('THE ARK CARRIES IT FORWARD.', 65, 429, 11, color='#b2cdd1', tracking=1)
body += text('A shared survival game for Twitch.', 65, 477, 17, 'saira', '#a3aeba')
body += '<path d="M1170 283h65v36" stroke="#7798a3" stroke-opacity=".45" fill="none"/><circle cx="1235" cy="319" r="3" fill="#dcb57b"/>'
body += text('EVERY SCAR HAS A STORY', 1335, 268, 9, anchor='end', tracking=1.5, color='#a5b5bc')
body += '<rect x="32" y="617" width="1336" height="78" rx="7" fill="#0b1119" stroke="#b6cbd024"/>'
for x, number, label in [(65,'216','PASSENGERS'),(382,'05','CHAPTERS'),(674,'01','SHARED ARK'),(1016,'YOU','MAKE THE CALL')]:
    body += text(number, x, 658, 30, 'tektur', '#f1e9dc', 2)
    body += text(label, x, 680, 9, color='#c3a578', tracking=2)
for x in [347,640,980]: body += f'<path d="M{x} 636v42" stroke="#ffffff13"/>'
body += '</g>'
(OUT/'hero.svg').write_text(svg(1400,720,'TORCHLINE — The stream ends. The world does not.',body,hero_defs), encoding='utf-8')

def trace(animated):
    animation = '<style>#signal{animation:relay 6s ease-in-out infinite}@keyframes relay{0%,12%{transform:translateX(0);opacity:0}20%{opacity:1}80%{opacity:1}88%,100%{transform:translateX(960px);opacity:0}}@media(prefers-reduced-motion:reduce){#signal{animation:none;transform:translateX(480px);opacity:1}}</style>' if animated else ''
    b = f'{animation}<rect width="1400" height="180" rx="12" fill="#080e15"/><path d="M220 77H1180" stroke="#8fdce43b" stroke-width="1" stroke-dasharray="3 9"/>'
    for x in [220,700,1180]:
        b += f'<circle cx="{x}" cy="77" r="20" fill="#0a151d" stroke="#c9b287" stroke-opacity=".6"/><path d="M{x} 67l10 10-10 10-10-10Z" fill="#e5c189"/>'
    b += f'<circle id="signal" cx="{220 if animated else 700}" cy="77" r="5" fill="#e7eac6"/>'
    for x,label,sub in [(220,'COMMUNITY A','MAKE THE CHOICE'),(700,'THE SAME ARK','KEEP THE CONSEQUENCE'),(1180,'COMMUNITY B','INHERIT THE STORY')]:
        b += text(label,x,32,13,'tektur','#ebede9',2,'middle')
        b += text(sub,x,127,9,color='#9db9c4',tracking=1.3,anchor='middle')
    b += text('ILLUSTRATED HANDOFF MECHANIC / NATIVE TWITCH ACCEPTANCE PENDING',700,161,8,color='#c4a77d',tracking=1,anchor='middle')
    return svg(1400,180,'One persistent Ark passes between consenting communities',b)
(OUT/'world-trace.svg').write_text(trace(True),encoding='utf-8')
(OUT/'world-trace-still.svg').write_text(trace(False),encoding='utf-8')

icons = {
 'ship':'M3 12h18M5 9h13l3 3-3 3H5Z M8 7v10M14 4v16M12 5h4M12 19h4',
 'crew':'M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M3 20v-3a5 5 0 0 1 10 0v3M17 4a3 3 0 0 1 0 6M17 12a5 5 0 0 1 4 5v3',
 'scar':'M5 3l6 6-4 4 7 8M13 3l6 6-4 4 4 4M3 12h4M17 21l4-4',
 'relay':'M4 12h16M8 8l4 4-4 4M16 8l4 4-4 4M4 4v16',
 'lock':'M6 10h12v11H6ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3',
 'replay':'M4 10a8 8 0 1 1 1 9M4 3v7h7M12 7v6l4 2',
}
(OUT/'icons').mkdir(exist_ok=True)
for name,path in icons.items():
    (OUT/f'icons/{name}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="{path}" fill="none" stroke="#b27e3a" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>\n',encoding='utf-8')
print('Created hero, motion/still trace and six original vector icons; no remote resources.')

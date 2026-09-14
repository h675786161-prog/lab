from pathlib import Path
import sys
from PIL import Image

if len(sys.argv) != 3:
    raise SystemExit('usage: build_parts.py <source-assets-dir> <output-parts-dir>')

src = Path(sys.argv[1])
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)


def crop_save(source: str, box, target: str, resize=None):
    image = Image.open(src / source).convert('RGBA').crop(box)
    if resize:
        image = image.resize(resize, Image.Resampling.LANCZOS)
    image.save(out / target, optimize=True, compress_level=9)

# Top navigation: original art contributes only structural end caps.
# Center shell is CSS so the raster never dictates nav width.
crop_save('top-nav-base.png', (0, 0, 150, 160), 'top-nav-left-cap.png', (128, 136))
crop_save('top-nav-base.png', (460, 0, 610, 160), 'top-nav-right-cap.png', (128, 136))

# Input: original art contributes only structural end caps.
# Center shell is CSS so textarea/tool zones remain independent and flexible.
crop_save('input-bar-base.png', (0, 0, 160, 160), 'input-left-cap.png', (144, 144))
crop_save('input-bar-base.png', (672, 0, 832, 160), 'input-right-cap.png', (144, 144))

# Avatar frames: split into upper/lower frame structure instead of one overlay.
for source, prefix in [
    ('avatar-frame-bot.png', 'avatar-bot'),
    ('avatar-frame-user.png', 'avatar-user'),
]:
    image = Image.open(src / source).convert('RGBA')
    w, h = image.size
    half = h // 2
    image.crop((0, 0, w, half)).resize((164, 90), Image.Resampling.LANCZOS).save(out / f'{prefix}-top.png', optimize=True, compress_level=9)
    image.crop((0, half, w, h)).resize((164, 90), Image.Resampling.LANCZOS).save(out / f'{prefix}-bottom.png', optimize=True, compress_level=9)

parts = sorted(out.glob('*.png'))
assert len(parts) == 8, f'expected 8 structural fragments, got {len(parts)}'
for p in parts:
    assert p.read_bytes()[:8] == b'\x89PNG\r\n\x1a\n', p
print('generated structural fragments:')
for p in parts:
    print(f'  {p.name}')

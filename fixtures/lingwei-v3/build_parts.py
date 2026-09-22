from pathlib import Path
import sys
from PIL import Image

if len(sys.argv) != 3:
    raise SystemExit('usage: build_parts.py <source-assets-dir> <output-parts-dir>')

src = Path(sys.argv[1])
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

# Message paper is deliberately NOT stretched as one complete rectangle.
# Each source is split horizontally:
#   top half    -> fixed upper boundary
#   center seam -> infinitely extensible vertical middle
#   bottom half -> fixed lower boundary
# The browser then does horizontal 3-slice on each band so left/right corners
# and side ornaments remain stable while only the clean center expands.
for source, prefix in [
    ('message-ai-paper.png', 'message-ai'),
    ('message-user-paper.png', 'message-user'),
]:
    image = Image.open(src / source).convert('RGBA')
    w, h = image.size
    half = h // 2

    top = image.crop((0, 0, w, half))
    bottom = image.crop((0, half, w, h))

    # A narrow strip centered on the split seam becomes the repeat/stretch body.
    seam_half = max(1, h // 120)
    y0 = max(0, half - seam_half)
    y1 = min(h, half + seam_half)
    middle = image.crop((0, y0, w, y1))

    top.save(out / f'{prefix}-top.png', optimize=True, compress_level=9)
    middle.save(out / f'{prefix}-middle.png', optimize=True, compress_level=9)
    bottom.save(out / f'{prefix}-bottom.png', optimize=True, compress_level=9)

parts = sorted(out.glob('*.png'))
assert len(parts) == 6, f'expected 6 message structural fragments, got {len(parts)}'
for p in parts:
    assert p.read_bytes()[:8] == b'\x89PNG\r\n\x1a\n', p
print('generated message paper fragments:')
for p in parts:
    print(f'  {p.name}')

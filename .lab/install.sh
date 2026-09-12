#!/usr/bin/env bash
set -euo pipefail
mkdir -p "${LAB_EVIDENCE_DIR:?}"

python3 - <<'PY'
from pathlib import Path
import base64, gzip, hashlib, json, os

root = Path.cwd()
fix = root / 'fixtures' / 'f7d'
expected = 'd85a240e3ada1300349ba205149e936346da2bc4d7746e26e84d5f76e3f8d982'
parts = sorted(fix.glob('card.*.b64'))
if not parts:
    raise SystemExit('F7D fixture chunks missing')
raw = gzip.decompress(base64.b64decode(''.join(p.read_text(encoding='utf-8') for p in parts)))
sha = hashlib.sha256(raw).hexdigest()
if sha != expected:
    raise SystemExit(f'F7D v0.4.4 fixture sha mismatch: {sha}')
card = json.loads(raw.decode('utf-8'))
if card.get('data', {}).get('character_version') != '0.4.4-lab':
    raise SystemExit(f"unexpected card version: {card.get('data', {}).get('character_version')}")
if len(card.get('data', {}).get('character_book', {}).get('entries', [])) != 55:
    raise SystemExit('unexpected lore entry count')

out = Path(os.environ['LAB_EVIDENCE_DIR'])
(out / 'f7d-v044-card.json').write_bytes(raw)
(out / 'f7d-v044-fixture.json').write_text(json.dumps({
    'sha256': sha,
    'version': card['data']['character_version'],
    'entries': len(card['data']['character_book']['entries']),
    'regex_scripts': len(card['data'].get('extensions', {}).get('regex_scripts', [])),
    'creator': card['data'].get('creator'),
}, ensure_ascii=False, indent=2), encoding='utf-8')
print('F7D exact fixture verified:', sha)
PY

{
  echo "project=f7d-v0.4.4-lab"
  echo "mode=character-card-only"
  echo "target_dir=${TARGET_DIR:-}"
  echo "st_dir=${ST_DIR:-}"
  echo "card_sha256=d85a240e3ada1300349ba205149e936346da2bc4d7746e26e84d5f76e3f8d982"
} > "$LAB_EVIDENCE_DIR/f7d-install.txt"

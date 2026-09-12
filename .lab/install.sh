#!/usr/bin/env bash
set -euo pipefail
mkdir -p "${LAB_EVIDENCE_DIR:?}"

python3 - <<'PY'
from pathlib import Path
import base64, gzip, hashlib, json, os

root = Path.cwd()
fix = root / 'fixtures' / 'f7d'
expected = '4737dfc9abd5f4faf70b29d647b4e8694607fd86446c596bf737b3f41241f5f2'
parts = sorted(fix.glob('card.*.b64'))
if not parts:
    raise SystemExit('F7D fixture chunks missing')
raw = gzip.decompress(base64.b64decode(''.join(p.read_text(encoding='utf-8') for p in parts)))
sha = hashlib.sha256(raw).hexdigest()
if sha != expected:
    raise SystemExit(f'F7D v0.4.5 fixture sha mismatch: {sha}')
card = json.loads(raw.decode('utf-8'))
data = card.get('data', {})
lore = data.get('character_book', {}).get('entries', [])
if data.get('character_version') != '0.4.5-lab':
    raise SystemExit(f"unexpected card version: {data.get('character_version')}")
if len(lore) != 55:
    raise SystemExit(f'unexpected lore entry count: {len(lore)}')
post = str(data.get('post_history_instructions', ''))
if '提交前结算扫描' not in post or '提交屏障' not in post:
    raise SystemExit('v0.4.5 pre-commit settlement rules missing')
if not any('ANN_D4_ELIGIBILITY' in str(e.get('content','')) for e in lore):
    raise SystemExit('ANN_D4_ELIGIBILITY rule missing')
if not any('DAY3_MORNING' in str(e.get('content','')) for e in lore):
    raise SystemExit('DAY3_MORNING rule missing')

out = Path(os.environ['LAB_EVIDENCE_DIR'])
(out / 'f7d-v045-card.json').write_bytes(raw)
(out / 'f7d-v045-fixture.json').write_text(json.dumps({
    'sha256': sha,
    'version': data['character_version'],
    'entries': len(lore),
    'regex_scripts': len(data.get('extensions', {}).get('regex_scripts', [])),
    'creator': data.get('creator'),
    'has_precommit_sweep': '提交前结算扫描' in post,
    'has_submit_barrier': '提交屏障' in post,
    'has_ann_d4_atomic': any('ANN_D4_ELIGIBILITY' in str(e.get('content','')) for e in lore),
    'has_day3_morning_atomic': any('DAY3_MORNING' in str(e.get('content','')) for e in lore),
}, ensure_ascii=False, indent=2), encoding='utf-8')
print('F7D exact v0.4.5 fixture verified:', sha)
PY

{
  echo "project=f7d-v0.4.5-lab"
  echo "mode=character-card-only"
  echo "target_dir=${TARGET_DIR:-}"
  echo "st_dir=${ST_DIR:-}"
  echo "card_sha256=4737dfc9abd5f4faf70b29d647b4e8694607fd86446c596bf737b3f41241f5f2"
} > "$LAB_EVIDENCE_DIR/f7d-install.txt"

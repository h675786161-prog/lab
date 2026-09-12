#!/usr/bin/env bash
set -euo pipefail
mkdir -p "${LAB_EVIDENCE_DIR:?}"

python3 .lab/build-v048.py

# Ensure v0.4.8-only runtime readback anchors are inserted even if formatting
# around the base has_hiro line changes slightly.
python3 - <<'PY'
from pathlib import Path
p = Path('.lab/runtime-smoke.mjs')
s = p.read_text(encoding='utf-8')
needle = "    has_hiro: lore.some(e => String(e?.name || e?.comment || '').includes('希罗')),"
fields = (
    "\n    has_player_agency: post.includes('玩家控制权｜最高叙事约束') && lore.some(e => String(e?.content || '').includes('正文不得代演玩家'))," 
    "\n    has_ann_node_rule: lore.some(e => String(e?.content || '').includes('安核心剧情节点'))," 
    "\n    has_sybilla_whitelist: lore.some(e => String(e?.content || '').includes('西比尔额外调查｜正文白名单'))," 
)
if 'has_player_agency:' not in s:
    if needle not in s:
        raise SystemExit('runtime-smoke has_hiro anchor missing')
    s = s.replace(needle, needle + ''.join(fields))
required = "'has_player_agency','has_ann_node_rule','has_sybilla_whitelist'"
if required not in s:
    raise SystemExit('runtime-smoke v0.4.8 required anchors missing')
p.write_text(s, encoding='utf-8')
PY

{
  echo "project=f7d-v0.4.8-lab"
  echo "mode=character-card-only"
  echo "target_dir=${TARGET_DIR:-}"
  echo "st_dir=${ST_DIR:-}"
  echo "card_sha256=c285ca4cab2bf986ee242a6edaa607ac7a2967299ee70506ee7c3836767f249b"
} > "$LAB_EVIDENCE_DIR/f7d-install.txt"

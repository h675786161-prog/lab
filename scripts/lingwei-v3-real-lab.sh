#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ST_DIR="${ST_DIR:-/tmp/lingwei-v3-st}"
EVIDENCE="${EVIDENCE:-$ROOT_DIR/lab-evidence-v3}"
ST_COMMIT="8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8"
ASSET_DST="$ST_DIR/public/scripts/extensions/third-party/lingwei-v3-qa/assets"
rm -rf "$ST_DIR"
git clone --filter=blob:none --no-checkout https://github.com/SillyTavern/SillyTavern.git "$ST_DIR"
git -C "$ST_DIR" fetch origin "$ST_COMMIT" --depth=1
git -C "$ST_DIR" checkout --detach "$ST_COMMIT"
test "$(git -C "$ST_DIR" rev-parse HEAD)" = "$ST_COMMIT"
cat "$ROOT_DIR/fixtures/lingwei-v3/theme.css" "$ROOT_DIR/fixtures/lingwei-v3/layout-guard.css" > /tmp/lingwei-v3.css
python3 - /tmp/lingwei-v3.css <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text(encoding='utf-8').replace('url("./assets/','url("/scripts/extensions/third-party/lingwei-v3-qa/assets/');p.write_text(s,encoding='utf-8')
PY
mkdir -p "$ASSET_DST"
cp "$ROOT_DIR"/fixtures/lingwei-v3/assets/*.png "$ASSET_DST"/
test "$(find "$ASSET_DST" -maxdepth 1 -name '*.png' | wc -l)" -eq 10
(cd "$ST_DIR" && npm ci)
mkdir -p "$EVIDENCE"
cd "$ST_DIR"
nohup node server.js --listen --port 8000 --disableCsrf > "$EVIDENCE/sillytavern.log" 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT
for _ in $(seq 1 90); do curl -fsS --max-time 2 http://127.0.0.1:8000/ >/dev/null 2>&1 && break; sleep 1; done
curl -fsS --max-time 2 http://127.0.0.1:8000/ >/dev/null
ST_DIR="$ST_DIR" bash "$ROOT_DIR/scripts/lingwei-v3-qa-shot.sh" "$EVIDENCE"

#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EVIDENCE="${1:-$ROOT_DIR/lab-evidence-v3}"
ST_DIR="${ST_DIR:-/tmp/lingwei-v3-st}"
ST_COMMIT="8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8"
mkdir -p "$EVIDENCE"
test -d "$ST_DIR/.git" || { echo "[LingWei v3] runtime missing: $ST_DIR"; exit 1; }
test "$(git -C "$ST_DIR" rev-parse HEAD)" = "$ST_COMMIT" || { echo "[LingWei v3] wrong SillyTavern commit"; exit 1; }
curl -fsS --max-time 5 http://127.0.0.1:8000/ >/dev/null
BROWSER="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)"
test -n "$BROWSER" || { echo "[LingWei v3] Chrome/Chromium missing"; exit 1; }
PW_DIR="/tmp/lingwei-v3-browser"
mkdir -p "$PW_DIR"
if [ ! -f "$PW_DIR/node_modules/playwright-core/index.mjs" ]; then
  (cd "$PW_DIR" && npm init -y >/dev/null 2>&1 && npm install --no-audit --no-fund playwright-core@1.55.0)
fi
CHROME_BIN="$BROWSER" PW_ENTRY="file://$PW_DIR/node_modules/playwright-core/index.mjs" EVIDENCE="$EVIDENCE" node "$ROOT_DIR/fixtures/lingwei-v3/shot.mjs"

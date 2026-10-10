#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: $0 /path/to/新建文件夹.zip [work-dir]" >&2
  exit 2
fi

ZIP_PATH="$(realpath "$1")"
WORK_ROOT="${2:-/tmp/echo-real-benchmark}"
LAB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURE_DIR="$WORK_ROOT/fixtures"
QA_DIR="$WORK_ROOT/qa-tools"
ECHO_DIR="$WORK_ROOT/echo-performance"
RESULT_ROOT="$WORK_ROOT/results"

ST_COMMIT="${ST_COMMIT:-8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8}"
ECHO_REF="${ECHO_REF:-feature/echo-performance-long-chat}"
TAVERN_HELPER_COMMIT="${TAVERN_HELPER_COMMIT:-c0196caee03955aa39e00db1a2623b2591bd3c6f}"
PROMPT_TEMPLATE_COMMIT="${PROMPT_TEMPLATE_COMMIT:-d6f520d149aba146305b0b781ddd691d449c28d2}"
WORLD_BACKSTAGE_COMMIT="${WORLD_BACKSTAGE_COMMIT:-b4cfc7519102bdc93e33932093b52d31505a5fe2}"
PORT="${ECHO_ST_PORT:-8039}"
LAB_ST_URL="http://127.0.0.1:${PORT}/"

rm -rf "$WORK_ROOT"
mkdir -p "$WORK_ROOT" "$FIXTURE_DIR" "$QA_DIR" "$RESULT_ROOT"

python3 "$LAB_ROOT/fixtures/echo-performance-real/build_fixtures.py" "$ZIP_PATH" --out "$FIXTURE_DIR"
python3 "$LAB_ROOT/fixtures/echo-performance-real/audit_world_backstage.py" \
  "$FIXTURE_DIR/real-heavy-259.jsonl" \
  --out "$RESULT_ROOT/world-backstage-storage-audit.json" >/dev/null

git clone --filter=blob:none --no-checkout https://github.com/Lenore-111/echo-performance.git "$ECHO_DIR"
git -C "$ECHO_DIR" fetch origin "$ECHO_REF" --depth=1
git -C "$ECHO_DIR" checkout --detach FETCH_HEAD
npm --prefix "$ECHO_DIR" run check
ECHO_COMMIT="$(git -C "$ECHO_DIR" rev-parse HEAD)"

mkdir -p "$QA_DIR"
(
  cd "$QA_DIR"
  npm init -y >/dev/null 2>&1
  npm install --no-audit --no-fund playwright-core@1.55.0
)
LAB_PLAYWRIGHT_CORE_ENTRY="$QA_DIR/node_modules/playwright-core/index.mjs"
LAB_CHROME="${LAB_CHROME:-$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)}"
if [ -z "$LAB_CHROME" ]; then
  echo "Chrome/Chromium not found. Set LAB_CHROME explicitly." >&2
  exit 1
fi

clone_exact() {
  local repo="$1" commit="$2" dest="$3"
  git clone --filter=blob:none --no-checkout "$repo" "$dest"
  git -C "$dest" fetch origin "$commit" --depth=1
  git -C "$dest" checkout --detach "$commit"
  test "$(git -C "$dest" rev-parse HEAD)" = "$commit"
}

prepare_st() {
  local kind="$1" st_dir="$2"
  clone_exact https://github.com/SillyTavern/SillyTavern.git "$ST_COMMIT" "$st_dir"
  npm --prefix "$st_dir" ci

  local ext_root="$st_dir/public/scripts/extensions/third-party"
  mkdir -p "$ext_root"
  rm -rf "$ext_root/echo-performance"
  ln -s "$ECHO_DIR" "$ext_root/echo-performance"

  if [ "$kind" = "real" ]; then
    clone_exact https://github.com/N0VI028/JS-Slash-Runner.git "$TAVERN_HELPER_COMMIT" "$ext_root/JS-Slash-Runner"
    clone_exact https://github.com/zonde306/ST-Prompt-Template.git "$PROMPT_TEMPLATE_COMMIT" "$ext_root/ST-Prompt-Template"
    clone_exact https://github.com/h675786161-prog/world-backstage.git "$WORLD_BACKSTAGE_COMMIT" "$ext_root/world-backstage"
  fi
}

run_stack() {
  local kind="$1"
  local st_dir="$WORK_ROOT/st-$kind"
  local out="$RESULT_ROOT/$kind"
  prepare_st "$kind" "$st_dir"
  mkdir -p "$out"

  cat > "$out/version-pins.json" <<JSON
{
  "sillyTavern": "$ST_COMMIT",
  "echoPerformance": "$ECHO_COMMIT",
  "tavernHelper": "$TAVERN_HELPER_COMMIT",
  "promptTemplate": "$PROMPT_TEMPLATE_COMMIT",
  "worldBackstage": "$WORLD_BACKSTAGE_COMMIT"
}
JSON

  (
    cd "$st_dir"
    nohup node server.js --listen --port "$PORT" --disableCsrf > "$out/sillytavern-runtime.log" 2>&1 &
    echo $! > "$out/st.pid"
  )

  local pid
  pid="$(cat "$out/st.pid")"
  cleanup() { kill "$pid" 2>/dev/null || true; }
  trap cleanup RETURN

  for _ in $(seq 1 120); do
    if curl -fsS --max-time 2 "$LAB_ST_URL" >/dev/null 2>&1; then break; fi
    if ! kill -0 "$pid" 2>/dev/null; then
      cat "$out/sillytavern-runtime.log" >&2
      return 1
    fi
    sleep 1
  done
  curl -fsS --max-time 3 "$LAB_ST_URL" >/dev/null

  LAB_ST_URL="$LAB_ST_URL" \
  LAB_CHROME="$LAB_CHROME" \
  LAB_PLAYWRIGHT_CORE_ENTRY="$LAB_PLAYWRIGHT_CORE_ENTRY" \
  LAB_EVIDENCE_DIR="$out" \
  ECHO_FIXTURE_DIR="$FIXTURE_DIR" \
  ECHO_THEME_DIR="$FIXTURE_DIR/themes" \
  ECHO_STACK_KIND="$kind" \
  ECHO_RUN_IDLE="${ECHO_RUN_IDLE:-1}" \
  ECHO_IDLE_SECONDS="${ECHO_IDLE_SECONDS:-30,60,180,300}" \
  ECHO_RUN_TRACE="${ECHO_RUN_TRACE:-1}" \
  ECHO_RUN_MEMORY_CYCLE="${ECHO_RUN_MEMORY_CYCLE:-1}" \
  ECHO_DIAGNOSTIC_HOOKS="${ECHO_DIAGNOSTIC_HOOKS:-0}" \
  node "$LAB_ROOT/.lab/echo-real-stack-benchmark.mjs"

  cleanup
  trap - RETURN
}

run_stack bare
run_stack real

echo "Echo real benchmark complete: $RESULT_ROOT"

#!/usr/bin/env bash
set -euo pipefail
mkdir -p "${LAB_EVIDENCE_DIR:?}"
{
  echo "project=f7d-v0.4.0-lab"
  echo "mode=character-card-only"
  echo "target_dir=${TARGET_DIR:-}"
  echo "st_dir=${ST_DIR:-}"
} > "$LAB_EVIDENCE_DIR/f7d-install.txt"
# Character cards are imported through SillyTavern's own /api/characters/import endpoint
# after the real server and browser are running. No third-party extension is installed.

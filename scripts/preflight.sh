#!/usr/bin/env bash
# opencode-team-memory 事前動作確認スクリプト
# 実行: bash scripts/preflight.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check() { printf "  %-40s " "$1"; shift; if "$@" &>/dev/null; then printf "${GREEN}OK${NC}\n"; else printf "${RED}FAIL${NC}\n"; fi; }
warn() { printf "  %-40s ${YELLOW}%s${NC}\n" "$1" "$2"; }

echo ""
echo "========================================"
echo " opencode-team-memory preflight check"
echo "========================================"
echo ""

# ── RTK ──
echo "[RTK]"
check "rtk binary" command -v rtk
check "rtk version" rtk --version
warn "rtk gain (data=0 is OK)"  "$(rtk gain 2>&1 | head -1)"
echo ""

# ── Context-Mode ──
echo "[Context-Mode]"
check "npm global package" npm ls -g context-mode
check "CLI binary" command -v context-mode
echo ""

# ── opencode-team-memory ──
echo "[opencode-team-memory]"
check "npm global package" npm ls -g opencode-team-memory
warn "global plugin config" "$(grep -c 'opencode-team-memory' ~/.config/opencode/opencode.json 2>/dev/null && echo 'found' || echo 'NOT FOUND')"
echo ""

# ── メモリ保存先 ──
echo "[Memory]"
if grep -q "OPENCODE_TEAM_MEMORY_DIR" ~/.zshrc 2>/dev/null; then
  warn "shared memory" "OPENCODE_TEAM_MEMORY_DIR is set → all projects share memory"
else
  check "per-project memory" true
fi
echo ""

# ── opencode.json ──
echo "[Project Config]"
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PARENT_PROJECT="${PROJECT_ROOT}/../opencode.json"
if [ -f "$PROJECT_ROOT/opencode.json" ]; then
  check "opencode.json exists" true
elif [ -f "$PARENT_PROJECT" ]; then
  warn "opencode.json" "found in parent ($PARENT_PROJECT)"
else
  warn "opencode.json" "not found"
fi
echo ""

# ── 総合判定 ──
echo "========================================"
echo " Next: opencode を起動し、以下を確認"
echo ""
echo "  TUI内: ctx stats    → Context-Mode 応答"
echo "  TUI内: Agent に「role_memory_save」を聞く → ツール認識"
echo "  別窓:  rtk gain     → RTK 動作"
echo "========================================"

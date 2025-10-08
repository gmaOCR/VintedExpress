#!/usr/bin/env bash
# Simple launcher for the Vinted login script.
# Usage: copy .env.example to .env and edit credentials, then run ./tools/run_login.sh
set -euo pipefail
SCRIPT="$(dirname "$0")/python/login_vinted.py"
# load .env if present
if [ -f "$(dirname "$0")/.env" ]; then
  # shellcheck disable=SC1091
  source "$(dirname "$0")/.env"
fi
: "${VINTED_USER:?Please set VINTED_USER in .env or env}"
: "${VINTED_PASS:?Please set VINTED_PASS in .env or env}"
: "${USER_DATA_DIR:=tools/.chrome_profile_uc}"
: "${CHROMEDRIVER:=tools/.local-chromedriver/chromedriver}"
PY="./tools/venv/bin/python3"
"$PY" "$SCRIPT" --user-data-dir "$USER_DATA_DIR" --chromedriver "$CHROMEDRIVER" --keep-open

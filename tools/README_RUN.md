Run the Vinted login orchestrator

1. Copy the example .env and edit credentials:

   cp tools/.env.example tools/.env

   # edit tools/.env and set VINTED_USER and VINTED_PASS

2. Run the launcher:

   ./tools/run_login.sh

The script uses the virtualenv python at `tools/venv/bin/python3` by default. It passes `--keep-open` so the browser stays open at the end. You can customize `CHROMEDRIVER` and `USER_DATA_DIR` in `tools/.env` if needed.

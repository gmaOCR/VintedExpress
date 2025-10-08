This folder contains a Selenium-based approach using undetected-chromedriver to attempt a more native browser session and improve chances versus DataDome.

Files:

- login_vinted.py : main script. Launches an undetected Chrome, simulates human behaviour, opens the signup/login page, fills credentials, and waits for manual captcha resolution if needed. Saves cookies and localStorage to `tools/session.json` and `tools/storage.json`.
- requirements.txt : Python dependencies.

Usage:

1. Create a virtualenv and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Run the script (set environment variables first):

```bash
export VINTED_USER="your_user"
export VINTED_PASS="your_pass"
python login_vinted.py
```

Notes:

- This script uses undetected-chromedriver to reduce automation flags. It still cannot guarantee bypassing DataDome.
- If a captcha appears, the script will pause and allow you to solve it in the opened browser. After you solve it, press Enter in the terminal to continue.
- The script will export cookies and local/session storage into `tools/session.json` and `tools/storage.json`.

New options / notes

- Persist a real Chrome profile across runs:

```bash
python login_vinted.py --user-data-dir /absolute/path/to/chrome_user_data
```

If you don't pass `--user-data-dir` the script will create/use `tools/.chrome_profile_uc` by default. Using a persistent profile (a real user-data-dir) is the single most effective measure to keep a valid authenticated session and avoid repeated mail codes.

- Warmup browsing (recommended):

```bash
python login_vinted.py --user-data-dir /abs/path --warmup 3 --warmup-duration 6
```

This will run 3 warmup visits (Google/YouTube/Wikipedia/Vinted/LeBonCoin shuffled) to populate history/cache and build entropy in the profile before performing the login flow.

- After a successful manual captcha/email validation, cookies are saved to `tools/session.json`. To reuse these cookies in a regular Chrome profile:

1. Open Chrome and go to `chrome://version` to find your profile path.
2. Close Chrome.
3. Copy `tools/.chrome_profile_uc` (or the user-data-dir you used) to your Chrome profile location OR import cookies via an extension such as "EditThisCookie" using the `tools/cookies_export.json` file produced by the script.

Notes on durability:

- Cookies may expire (short-lived auth). Using a persistent profile and regular warmup (periodic visits) extends the perceived "human" activity and reduces chance of DataDome challenges.
- For full automation at scale, a residential proxy + managed browser profiles is required (see main repo docs).

\*\*\* End README

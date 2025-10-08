import json
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent.parent
SESSION_FILE = TOOLS_DIR / 'session.json'


def save_cookies(driver):
    try:
        with open(SESSION_FILE, 'w') as f:
            json.dump(driver.get_cookies(), f, indent=2)
        print('Saved cookies to', SESSION_FILE)
    except Exception as e:
        print('Failed to save cookies:', e)


def save_storage(driver):
    try:
        script_ls = (
            "var r={};"
            "for(var i=0;i<localStorage.length;i++){"
            "var k=localStorage.key(i);"
            "r[k]=localStorage.getItem(k);}"
            "return r;"
        )
        ls = driver.execute_script(script_ls)
    except Exception:
        ls = {}
    try:
        script_ss = (
            "var r={};"
            "for(var i=0;i<sessionStorage.length;i++){"
            "var k=sessionStorage.key(i);"
            "r[k]=sessionStorage.getItem(k);}"
            "return r;"
        )
        ss = driver.execute_script(script_ss)
    except Exception:
        ss = {}
    try:
        with open(SESSION_FILE.parent / 'storage.json', 'w') as f:
            json.dump({'localStorage': ls, 'sessionStorage': ss}, f, indent=2)
        print('Saved storage to', SESSION_FILE.parent / 'storage.json')
    except Exception as e:
        print('Failed to save storage:', e)


def save_login_response(resp):
    try:
        if resp is None:
            return
        with open(SESSION_FILE.parent / 'login-response.json', 'w') as f:
            json.dump(resp, f, indent=2)
        print('Saved login response to', SESSION_FILE.parent / 'login-response.json')
    except Exception as e:
        print('Failed to save login response:', e)

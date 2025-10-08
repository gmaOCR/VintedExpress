#!/usr/bin/env python3
"""
Minimal Selenium script that performs a linear flow:
- visit Wikipedia
- visit Google.fr and accept consent
- search "vinted.fr" and open a result
- visit Vinted login and attempt login
- check for captcha/DataDome iframes

Designed to be small and easy to debug.
"""
import os
import time
import random
import argparse

from pathlib import Path
import undetected_chromedriver as uc
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
# WebDriverWait/EC used in helpers module; not needed directly here


try:
    from tools.python.humanize import human_type, simulate_human_mouse_move, pre_search_humanize
    from tools.python.utils import save_cookies, save_storage, save_login_response
    from tools.python.cdp_utils import set_accept_language, set_timezone, set_user_agent
    from tools.python.stealth import apply_stealth_knobs
    from tools.python.interaction import robust_click, capture_post_response, detect_captcha, wait_for_captcha_resolution
except Exception:
    import sys
    ROOT = Path(__file__).resolve().parents[2]
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    from tools.python.humanize import human_type, simulate_human_mouse_move, pre_search_humanize
    from tools.python.utils import save_cookies, save_storage, save_login_response
    from tools.python.cdp_utils import set_accept_language, set_timezone, set_user_agent
    from tools.python.stealth import apply_stealth_knobs
    from tools.python.interaction import robust_click, capture_post_response, detect_captcha, wait_for_captcha_resolution

# paths
TOOLS_DIR = Path(__file__).resolve().parent.parent
SESSION_FILE = TOOLS_DIR / 'session.json'

# default target page
TARGET = 'https://www.vinted.fr/member/signup/select_type?ref_url=%2F'


def click_consent(driver, timeout=8):
    """Robust consent click:
    - try the common CSS selector first (if it exists)
    - then search by visible text (case-insensitive) in the main document
    - if not found, iterate accessible iframes and repeat
    Returns True if clicked, False otherwise.
    """
    variants = ['tout accepter', "j'accepte", 'accepter', 'accept all']

    def xpath_ci(text):
        # case-insensitive contains on normalized text
        return (
            "contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',"
            "'abcdefghijklmnopqrstuvwxyz'), '%s')" % text.lower()
        )

    # 0) quick try: known Google consent CSS (some profiles show it)
    try:
        elems = driver.find_elements(By.CSS_SELECTOR, 'div.QS5gu.sy4vM')
        for el in elems:
            try:
                if el.is_displayed():
                    try:
                        print('Found consent element by CSS selector')
                        try:
                            driver.execute_script("arguments[0].scrollIntoView({block:'center', inline:'center'});", el)
                        except Exception:
                            pass
                        try:
                            simulate_human_mouse_move(driver, el)
                        except Exception:
                            pass
                        ActionChains(driver).move_to_element(el).click(el).perform()
                    except Exception:
                        driver.execute_script('arguments[0].click();', el)
                    time.sleep(0.5)
                    return True
            except Exception:
                continue
    except Exception:
        pass

    # 1) search by text+role in main document
    try:
        for v in variants:
            xp = f"//*[(@role='none' or @role='button' or self::button) and {xpath_ci(v)}]"
            els = driver.find_elements(By.XPATH, xp)
            for el in els:
                try:
                    if el.is_displayed():
                        try:
                            print('Found consent candidate by role/text in main doc')
                            try:
                                driver.execute_script("arguments[0].scrollIntoView({block:'center', inline:'center'});", el)
                            except Exception:
                                pass
                            try:
                                simulate_human_mouse_move(driver, el)
                            except Exception:
                                pass
                            ActionChains(driver).move_to_element(el).click(el).perform()
                        except Exception:
                            driver.execute_script('arguments[0].click();', el)
                        time.sleep(0.5)
                        return True
                except Exception:
                    continue
    except Exception:
        pass

    # 2) looser text-only search in main document
    try:
        for v in variants:
            xp = f"//*[ {xpath_ci(v)} ]"
            els = driver.find_elements(By.XPATH, xp)
            for el in els:
                try:
                    if el.is_displayed():
                        try:
                            print('Found consent candidate by loose text in main doc')
                            try:
                                driver.execute_script("arguments[0].scrollIntoView({block:'center', inline:'center'});", el)
                            except Exception:
                                pass
                            try:
                                simulate_human_mouse_move(driver, el)
                            except Exception:
                                pass
                            ActionChains(driver).move_to_element(el).click(el).perform()
                        except Exception:
                            driver.execute_script('arguments[0].click();', el)
                        time.sleep(0.5)
                        return True
                except Exception:
                    continue
    except Exception:
        pass

    # 3) iterate accessible iframes and repeat
    frames = driver.find_elements(By.TAG_NAME, 'iframe')
    for f in frames:
        try:
            driver.switch_to.frame(f)
            # first try role+text in iframe
            for v in variants:
                try:
                    xp = f"//*[(@role='none' or @role='button' or self::button) and {xpath_ci(v)}]"
                    els = driver.find_elements(By.XPATH, xp)
                    for el in els:
                        try:
                            if el.is_displayed():
                                try:
                                    print('Found consent candidate in iframe (role/text)')
                                    try:
                                        driver.execute_script("arguments[0].scrollIntoView({block:'center', inline:'center'});", el)
                                    except Exception:
                                        pass
                                    try:
                                        simulate_human_mouse_move(driver, el)
                                    except Exception:
                                        pass
                                    ActionChains(driver).move_to_element(el).click(el).perform()
                                except Exception:
                                    driver.execute_script('arguments[0].click();', el)
                                driver.switch_to.default_content()
                                time.sleep(0.5)
                                return True
                        except Exception:
                            continue
                except Exception:
                    continue
            # then looser text-only in iframe
            for v in variants:
                try:
                    xp = f"//*[ {xpath_ci(v)} ]"
                    els = driver.find_elements(By.XPATH, xp)
                    for el in els:
                        try:
                            if el.is_displayed():
                                try:
                                    print('Found consent candidate in iframe (loose text)')
                                    try:
                                        driver.execute_script("arguments[0].scrollIntoView({block:'center', inline:'center'});", el)
                                    except Exception:
                                        pass
                                    try:
                                        simulate_human_mouse_move(driver, el)
                                    except Exception:
                                        pass
                                    ActionChains(driver).move_to_element(el).click(el).perform()
                                except Exception:
                                    driver.execute_script('arguments[0].click();', el)
                                driver.switch_to.default_content()
                                time.sleep(0.5)
                                return True
                        except Exception:
                            continue
                except Exception:
                    continue
        except Exception:
            # cross-origin iframe or other access error
            pass
        finally:
            try:
                driver.switch_to.default_content()
            except Exception:
                pass

    return False


def harden_driver(driver):
    """Attempt lightweight anti-fingerprinting tweaks.
    This is not perfect but reduces simple webdriver leaks.
    """
    # orchestrate CDP + stealth knobs
    try:
        try:
            set_user_agent(driver)
        except Exception:
            pass
        try:
            set_accept_language(driver)
        except Exception:
            pass
        try:
            set_timezone(driver)
        except Exception:
            pass
        try:
            apply_stealth_knobs(driver)
        except Exception:
            pass
    except Exception:
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--user-data-dir', help='Chrome profile dir', default=str(TOOLS_DIR / '.chrome_profile_uc'))
    parser.add_argument('--chromedriver', help='Path to chromedriver executable', default=None)
    parser.add_argument('--no-login', action='store_true', help='Do not perform credential submission')
    parser.add_argument('--keep-open', action='store_true', help="Don't quit the browser at the end; wait for Enter")
    args = parser.parse_args()

    user = os.environ.get('VINTED_USER')
    pwd = os.environ.get('VINTED_PASS')
    if not args.no_login and (not user or not pwd):
        print('Set VINTED_USER and VINTED_PASS or run with --no-login')
        return

    options = Options()
    options.add_argument(f"--user-data-dir={args.user_data_dir}")
    options.add_argument('--no-first-run')
    options.add_argument('--no-default-browser-check')
    options.add_argument('--window-size=1200,800')
    # anti-automation flags
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_experimental_option('excludeSwitches', ['enable-automation'])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_argument('--lang=fr-FR')

    chromedriver_path = args.chromedriver

    def start_driver():
        if chromedriver_path:
            svc = Service(chromedriver_path)
            return webdriver.Chrome(service=svc, options=options)
        if uc is not None:
            return uc.Chrome(options=options)
        return webdriver.Chrome(options=options)

    driver = start_driver()
    try:
        harden_driver(driver)
    except Exception:
        pass
    try:
        # warm up the profile with benign browsing
        from tools.python.humanize import warmup_browse
        try:
            warmup_browse(driver, visits=2)
        except Exception:
            pass
    except Exception:
        pass
    # WebDriverWait available via explicit calls if needed

    try:
        # 1) Wikipedia
        print('Visiting Wikipedia...')
        driver.get('https://fr.wikipedia.org/wiki/Accueil')
        time.sleep(1.5)

        # 2) Google FR
        print('Visiting Google.fr...')
        driver.get('https://www.google.fr')
        time.sleep(1.2)

        # accept consent if present
        try:
            clicked = click_consent(driver)
            print('Consent clicked:', clicked)
            if not clicked:
                # consent not clicked; no debug capture needed
                pass
        except Exception as e:
            print('Consent click error:', e)

        # 3) Search vinted.fr
        try:
            # try common selectors
            search = None
            for sel in ['input[name="q"]', 'textarea[jsname="yZiJbe"]', 'input[type="search"]']:
                try:
                    el = driver.find_element(By.CSS_SELECTOR, sel)
                    if el.is_displayed():
                        search = el
                        break
                except Exception:
                    continue
            if not search:
                for el in driver.find_elements(By.CSS_SELECTOR, 'input, textarea'):
                    try:
                        if el.is_displayed():
                            search = el
                            break
                    except Exception:
                        continue
            if not search:
                print('No search field found on Google; will open search URL instead')
                driver.get('https://www.google.fr/search?q=vinted.fr')
            else:
                try:
                    try:
                        pre_search_humanize(driver)
                    except Exception:
                        pass
                    human_type(search, 'vinted.fr')
                    # petit délai humain après la saisie pour diminuer les risques de captcha
                    time.sleep(random.uniform(1.0, 2.0))
                    search.send_keys(Keys.RETURN)
                except Exception:
                    # fallback: open Google search URL directly
                    try:
                        driver.get('https://www.google.fr/search?q=vinted.fr')
                    except Exception as e:
                        print('Fallback to search URL failed:', e)
        except Exception as e:
            print('Google search error:', e)

        time.sleep(2.0)

        # 4) Click first vinted.fr result
        clicked = False
        try:
            anchors = driver.find_elements(By.CSS_SELECTOR, 'a')
            for a in anchors:
                try:
                    href = a.get_attribute('href') or ''
                    if 'vinted.fr' in href:
                        try:
                            a.click()
                        except Exception:
                            driver.execute_script('arguments[0].click();', a)
                        clicked = True
                        break
                except Exception:
                    continue
        except Exception:
            pass

        if not clicked:
            print('No search result found; opening target directly')
            driver.get(TARGET)

        time.sleep(2.0)

        # 5) go to vinted login page explicitly (best-effort)
        try:
            driver.get("https://www.vinted.fr/member/signup/select_type?ref_url=%2F")
            time.sleep(1.0)
        except Exception:
            pass

        # 6) perform Vinted login flow according to LOGIN_GOAL.md

        # detect_captcha is provided by tools.python.interaction.detect_captcha

        # wait_for_captcha_resolution is provided by tools.python.interaction.wait_for_captcha_resolution

        # capture_post_response is provided by tools.python.interaction.capture_post_response

        # save_storage is provided by tools.python.utils.save_storage

        def do_vinted_login_flow(driver, user, pwd):
            try:
                # ensure on target page
                try:
                    driver.get('https://www.vinted.fr/member/signup/select_type?ref_url=%2F')
                except Exception:
                    pass
                time.sleep(3)
                try:
                    # small mouse move
                    pre_search_humanize(driver)
                except Exception:
                    pass
                # 3) click cookie accept
                try:
                    btn = driver.find_element(By.CSS_SELECTOR, '#onetrust-accept-btn-handler')
                    try:
                        btn.click()
                    except Exception:
                        driver.execute_script('arguments[0].click();', btn)
                except Exception:
                    pass
                time.sleep(2)
                try:
                    pre_search_humanize(driver)
                except Exception:
                    pass
                # robust_click is provided by tools.python.interaction.robust_click

                # 5) click Se connecter
                try:
                    robust_click(driver, By.CSS_SELECTOR, "[data-testid='auth-select-type--register-switch']")
                except Exception:
                    pass
                time.sleep(2)
                # 7) click login by email
                try:
                    robust_click(driver, By.CSS_SELECTOR, "[data-testid='auth-select-type--login-email']")
                except Exception:
                    pass
                time.sleep(2)
                # 9) fill username/password
                try:
                    user_el = driver.find_element(By.CSS_SELECTOR, '#username')
                    pwd_el = driver.find_element(By.CSS_SELECTOR, '#password')
                    user_el.clear()
                    for ch in user:
                        user_el.send_keys(ch)
                        time.sleep(random.uniform(0.05, 0.2))
                    pwd_el.clear()
                    for ch in pwd:
                        pwd_el.send_keys(ch)
                        time.sleep(random.uniform(0.05, 0.2))
                except Exception as e:
                    print('Fill credentials failed:', e)
                # 10) wait 3-6s before submit
                time.sleep(random.uniform(3.0, 6.0))
                # detect captcha
                if detect_captcha(driver):
                    ok = wait_for_captcha_resolution(driver, timeout=120)
                    if not ok:
                        print('Captcha not resolved within timeout')
                        return None
                # prepare performance capture
                try:
                    driver.execute_cdp_cmd('Network.enable', {})
                except Exception:
                    pass
                # submit
                try:
                    submit = driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]')
                    try:
                        submit.click()
                    except Exception:
                        driver.execute_script('arguments[0].click();', submit)
                except Exception:
                    try:
                        # try alternative selector
                        btn = driver.find_element(By.CSS_SELECTOR, "button[data-testid='auth-submit']")
                        try:
                            btn.click()
                        except Exception:
                            driver.execute_script('arguments[0].click();', btn)
                    except Exception:
                        print('No submit button found')
                # capture network response for POST
                resp = capture_post_response(driver, timeout=12)
                if resp:
                    try:
                        save_login_response(resp)
                    except Exception as e:
                        print('Failed to save login response:', e)
                # 14) save cookies + storage
                try:
                    save_cookies(driver)
                except Exception:
                    pass
                try:
                    save_storage(driver)
                except Exception:
                    pass
                # 15) navigate to /items/new and save html + screenshot
                try:
                    driver.get('https://www.vinted.fr/items/new')
                    time.sleep(2)
                    html = driver.page_source
                    with open(TOOLS_DIR / 'last-capture-items-new.html', 'w') as f:
                        f.write(html)
                    screenshot = TOOLS_DIR / 'last-capture-items-new.png'
                    driver.save_screenshot(str(screenshot))
                    print('Saved /items/new capture to', TOOLS_DIR / 'last-capture-items-new.html')
                except Exception as e:
                    print('Failed to capture /items/new:', e)
                return resp
            except Exception as e:
                print('Vinted login flow failed:', e)
                return None

        if not args.no_login:
            try:
                do_vinted_login_flow(driver, user, pwd)
            except Exception as e:
                print('Error during vinted login flow:', e)

        time.sleep(2.0)

        # 7) Check for captcha/DataDome by scanning iframes
        try:
            iframes = driver.find_elements(By.TAG_NAME, 'iframe')
            has_captcha = False
            for f in iframes:
                try:
                    src = f.get_attribute('src') or ''
                    if any(x in src for x in ('datadome', 'captcha', 'recaptcha')):
                        print('Possible captcha iframe detected:', src)
                        has_captcha = True
                        break
                except Exception:
                    continue
            if not has_captcha:
                print('No obvious captcha/DataDome iframe detected')
        except Exception as e:
            print('Captcha check failed:', e)

        # save cookies
        try:
            save_cookies(driver)
        except Exception:
            pass

    finally:
        # optionally keep the browser open for inspection
        try:
            if 'args' in locals() and getattr(args, 'keep_open', False):
                print('\n--keep-open enabled: la fenêtre du navigateur restera ouverte. Appuie sur Entrée pour fermer.')
                try:
                    input()
                except Exception:
                    # non-interactive terminals may raise; just pass
                    pass
        except Exception:
            pass
        try:
            driver.quit()
        except Exception:
            pass


if __name__ == '__main__':
    main()

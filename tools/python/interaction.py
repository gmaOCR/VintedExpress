import time
import json
from pathlib import Path
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from .humanize import simulate_human_mouse_move

TOOLS_DIR = Path(__file__).resolve().parent.parent


def robust_click(driver, by, sel, timeout=6):
    """Try multiple click strategies and save debug artifacts on failure."""
    # Wait until element is present and clickable
    try:
        el = WebDriverWait(driver, timeout).until(
            EC.element_to_be_clickable((by, sel))
        )
    except Exception as e:
        # fallback: try to find element without clickable
        try:
            el = driver.find_element(by, sel)
        except Exception:
            print('robust_click: element not found', sel, 'err:', e)
            return False

    try:
        driver.execute_script("arguments[0].scrollIntoView({block:'center', inline:'center'});", el)
    except Exception:
        pass
    try:
        simulate_human_mouse_move(driver, el)
    except Exception:
        pass

    # Try normal click sequence
    try:
        ActionChains(driver).move_to_element(el).click(el).perform()
        return True
    except Exception:
        pass

    # Try JS click
    try:
        driver.execute_script('arguments[0].click();', el)
        return True
    except Exception:
        pass

    # Try dispatch pointer events then click
    try:
        dispatch_js = (
            "var e1=new PointerEvent('pointerdown',{bubbles:true,cancelable:true});"
            "var e2=new PointerEvent('pointerup',{bubbles:true,cancelable:true});"
            "arguments[0].dispatchEvent(e1);arguments[0].dispatchEvent(e2);"
        )
        try:
            driver.execute_script(dispatch_js, el)
        except Exception:
            pass
        try:
            driver.execute_script('arguments[0].click();', el)
            return True
        except Exception:
            pass
    except Exception:
        pass

    # Try inner span/button child (some markup uses span clickable)
    try:
        child = el.find_element(By.CSS_SELECTOR, 'span')
        try:
            ActionChains(driver).move_to_element(child).click(child).perform()
            return True
        except Exception:
            try:
                driver.execute_script('arguments[0].click();', child)
                return True
            except Exception:
                pass
    except Exception:
        pass

    # final: save debug artifacts for investigation
    try:
        safe_name = sel.replace('/', '_').replace(' ', '_').replace(':', '_')
        screenshot = TOOLS_DIR / f'click-failure-{safe_name}.png'
        driver.save_screenshot(str(screenshot))
        with open(TOOLS_DIR / f'click-failure-{safe_name}.html', 'w') as f:
            f.write(driver.page_source)
        print('robust_click: saved debug artifacts for', sel)
    except Exception:
        pass
    return False


def capture_post_response(driver, url_substrings=None, timeout=10):
    if url_substrings is None:
        url_substrings = ['login', 'session', 'auth', 'signin']
    end = time.time() + timeout
    while time.time() < end:
        try:
            logs = driver.get_log('performance')
        except Exception:
            logs = []
        for entry in logs:
            try:
                msg = json.loads(entry['message'])['message']
            except Exception:
                continue
            method = msg.get('method')
            params = msg.get('params') or {}
            if method == 'Network.responseReceived':
                response = params.get('response') or {}
                requestId = params.get('requestId')
                url = response.get('url', '')
                if requestId and any(s in url for s in url_substrings):
                    try:
                        body = driver.execute_cdp_cmd('Network.getResponseBody', {'requestId': requestId})
                        return {'requestId': requestId, 'url': url, 'body': body}
                    except Exception:
                        continue
        time.sleep(0.5)
    return None


def detect_captcha(driver):
    try:
        iframes = driver.find_elements(By.TAG_NAME, 'iframe')
        for f in iframes:
            try:
                src = f.get_attribute('src') or ''
                if any(x in src for x in ('datadome', 'captcha', 'recaptcha')):
                    return True
            except Exception:
                continue
    except Exception:
        pass
    return False


def wait_for_captcha_resolution(driver, timeout=120):
    start = time.time()
    while time.time() - start < timeout:
        if not detect_captcha(driver):
            return True
        print('⚠️ CAPTCHA DÉTECTÉ! Résolvez manuellement dans le navigateur...')
        time.sleep(1)
    return False

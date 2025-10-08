import time
import random
import math


def human_type(el, text, delay_range=(0.06, 0.18)):
    for ch in text:
        el.send_keys(ch)
        time.sleep(random.uniform(*delay_range))


def simulate_human_mouse_move(driver, element, duration=0.8, steps=12):
    try:
        rect = driver.execute_script('return arguments[0].getBoundingClientRect();', element)
    except Exception:
        return
    if not rect:
        return
    cx = rect.get('left', 0) + rect.get('width', 0) / 2
    cy = rect.get('top', 0) + rect.get('height', 0) / 2

    start_x = cx + random.choice([-1, 1]) * random.uniform(120, 300)
    start_y = cy + random.choice([-1, 1]) * random.uniform(60, 200)

    pts = []
    for i in range(steps):
        t = (i + 1) / float(steps)
        t_e = 0.5 - 0.5 * math.cos(math.pi * t)
        x = start_x + (cx - start_x) * t_e + random.uniform(-6, 6)
        y = start_y + (cy - start_y) * t_e + random.uniform(-4, 4)
        pts.append((int(x), int(y)))

    interval = max(0.01, duration / max(1, steps))
    for (x, y) in pts:
        try:
            driver.execute_script(
                "document.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX: arguments[0], clientY: arguments[1]}));",
                x,
                y,
            )
        except Exception:
            try:
                driver.execute_script("var e=new MouseEvent('mousemove');",)
                driver.execute_script("e.clientX=arguments[0];", x)
                driver.execute_script("e.clientY=arguments[0];document.dispatchEvent(e);", y)
            except Exception:
                pass
        time.sleep(interval)
    time.sleep(random.uniform(0.08, 0.22))


def pre_search_humanize(driver):
    try:
        for _ in range(random.randint(1, 3)):
            dy = random.randint(-120, 120)
            driver.execute_script('window.scrollBy(0, arguments[0]);', dy)
            time.sleep(random.uniform(0.12, 0.28))

        w = driver.execute_script('return window.innerWidth') or 1200
        h = driver.execute_script('return window.innerHeight') or 800
        for _ in range(random.randint(3, 7)):
            x = random.randint(int(w * 0.1), int(w * 0.9))
            y = random.randint(int(h * 0.1), int(h * 0.9))
            try:
                driver.execute_script(
                    "document.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, clientX:arguments[0], clientY:arguments[1]}));",
                    x,
                    y,
                )
            except Exception:
                pass
            time.sleep(random.uniform(0.08, 0.22))

        try:
            driver.execute_script("window.focus();document.body.focus();")
            time.sleep(random.uniform(0.06, 0.18))
            driver.execute_script("window.blur();")
        except Exception:
            pass

        time.sleep(random.uniform(0.2, 0.7))
    except Exception:
        pass


def warmup_browse(driver, urls=None, visits=2):
    """Warm-up browsing: visit a few benign FR pages to warm the profile/cookies.
    Keeps interactions short and human-like.
    """
    try:
        if urls is None:
            urls = [
                'https://fr.wikipedia.org/wiki/Accueil',
                'https://www.lemonde.fr',
                'https://www.lefigaro.fr',
                'https://www.liberation.fr',
            ]
        for i in range(min(visits, len(urls))):
            url = random.choice(urls)
            try:
                driver.get(url)
                time.sleep(random.uniform(1.2, 2.4))
                # small interaction
                try:
                    driver.execute_script('window.scrollBy(0, document.body.scrollHeight*0.15);')
                except Exception:
                    pass
                time.sleep(random.uniform(0.6, 1.2))
            except Exception:
                continue
    except Exception:
        pass

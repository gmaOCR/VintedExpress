def apply_stealth_knobs(driver):
    try:
        script = (
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
            "Object.defineProperty(navigator, 'languages', {get: () => ['fr-FR','fr']});"
            "window.chrome = window.chrome || { runtime: {} };"
            "Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3]});"
        )
        try:
            driver.execute_script(script)
        except Exception:
            pass
    except Exception:
        pass

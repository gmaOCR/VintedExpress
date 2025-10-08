
def set_accept_language(driver, lang_header='fr-FR,fr;q=0.9'):
    try:
        headers = {'Accept-Language': lang_header}
        driver.execute_cdp_cmd('Network.setExtraHTTPHeaders', {'headers': headers})
    except Exception:
        pass


def set_timezone(driver, tz='Europe/Paris'):
    try:
        driver.execute_cdp_cmd('Emulation.setTimezoneOverride', {'timezoneId': tz})
    except Exception:
        pass


def set_user_agent(driver, ua=None):
    try:
        if ua is None:
            ua = driver.execute_script('return navigator.userAgent')
        driver.execute_cdp_cmd('Network.setUserAgentOverride', {'userAgent': ua})
    except Exception:
        pass

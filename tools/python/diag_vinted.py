#!/usr/bin/env python3
"""
Diagnostic de débogage pour Vinted/DataDome.
Usage:
  python3 tools/python/diag_vinted.py --user-data-dir <path> [--url <url>]

Ce script ouvre la page (headful), prend des captures d'écran, collecte:
- navigator.* et autres propriétés JS
- canvas + webgl fingerprints
- console logs
- cookies et localStorage
- détection d'iframe captcha (geo.captcha-delivery / datadome)
- sauvegarde le tout dans tools/diag.json et images

Conçu pour exécuter avec `undetected_chromedriver`.
"""

import json
import os
import sys
import time
import argparse
from pathlib import Path

try:
    import undetected_chromedriver as uc
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
except Exception:
    # Try to add user site-packages (pip --user) to sys.path (common in dev envs)
    import site, sys
    user_site = site.getusersitepackages()
    if user_site and user_site not in sys.path:
        sys.path.insert(0, user_site)
    try:
        import undetected_chromedriver as uc
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
    except Exception:
        print("Missing dependencies: please run: python3 -m pip install --user undetected-chromedriver selenium")
        raise

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tools'
OUT.mkdir(parents=True, exist_ok=True)

def now():
    return time.strftime('%Y%m%d_%H%M%S')

JS_COLLECT = r"""
(async function(){
  function safe(fn){try{return fn();}catch(e){return String(e);} }
  const nav = navigator;
  const plugins = Array.from(nav.plugins||[]).map(p=>({name:p.name, filename:p.filename, description:p.description}));
  const mime = Array.from(navigator.mimeTypes||[]).map(m=>({type:m.type,description:m.description}));
  let canvas='';
  try{
    const c=document.createElement('canvas'); c.width=256; c.height=64; const ctx=c.getContext('2d'); ctx.fillStyle='rgba(102, 204, 0, 0.2)'; ctx.fillRect(0,0,256,64); ctx.font='16px Arial'; ctx.fillStyle='rgb(10,40,80)'; ctx.fillText('VINTED_DIAG_'+Math.random(),10,30); canvas = c.toDataURL();
  }catch(e){canvas=String(e)}
  let webgl={};
  try{
    const c=document.createElement('canvas'); const gl = c.getContext('webgl')||c.getContext('experimental-webgl');
    if(gl){
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      webgl.renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      webgl.vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      webgl.version = gl.getParameter(gl.VERSION);
      webgl.shading = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
    } else { webgl = 'no-webgl' }
  }catch(e){ webgl = String(e) }
  let iframe=null;
  try{
    const f = Array.from(document.querySelectorAll('iframe')).find(i=>i.src && (i.src.includes('captcha-delivery')||i.src.includes('datadome')||i.src.includes('captcha')) );
    if(f) iframe = {src: f.src, outerHTML: f.outerHTML.slice(0,2000)};
  }catch(e){ iframe=String(e) }
  let permissions={};
  try{
    const names = ['geolocation','notifications','camera','microphone','clipboard-read','clipboard-write'];
    for(const n of names){ try{ const r=await navigator.permissions.query({name:n}); permissions[n]=r.state }catch(e){ permissions[n]=String(e) } }
  }catch(e){ permissions=String(e) }
  const res = {
    ua: safe(()=>navigator.userAgent),
    webdriver: safe(()=>navigator.webdriver),
    languages: safe(()=>navigator.languages),
    platform: safe(()=>navigator.platform),
    vendor: safe(()=>navigator.vendor),
    plugins: plugins,
    mimeTypes: mime,
    hardwareConcurrency: safe(()=>navigator.hardwareConcurrency),
    deviceMemory: safe(()=>navigator.deviceMemory),
    maxTouchPoints: safe(()=>navigator.maxTouchPoints),
    timezoneOffset: safe(()=> (new Date()).getTimezoneOffset()),
    cookieEnabled: safe(()=>navigator.cookieEnabled),
    doNotTrack: safe(()=>navigator.doNotTrack),
    product: safe(()=>navigator.product),
    productSub: safe(()=>navigator.productSub),
    buildId: safe(()=>navigator.buildID),
    permissions: permissions,
    canvas: canvas,
    webgl: webgl,
    iframe_captcha: iframe,
    location: safe(()=>location.href),
    document_title: safe(()=>document.title)
  };
  return res;
})();
"""


def run_diagnostic(user_data_dir, url):
    opts = uc.ChromeOptions()
    opts.add_argument("--no-first-run")
    opts.add_argument("--no-default-browser-check")
    opts.add_argument("--window-size=1366,768")
    opts.add_argument(f"--user-data-dir={user_data_dir}")
    # avoid very intrusive flags

    # Allow overriding the chromedriver executable with an env var (set by our downloader)
    driver_path = os.environ.get('UC_CHROMEDRIVER_EXECUTABLE_PATH') or os.environ.get('CHROMEDRIVER_PATH')
    if driver_path:
        try:
            driver = uc.Chrome(options=opts, driver_executable_path=driver_path)
        except TypeError:
            # fallback name used by some uc versions
            driver = uc.Chrome(options=opts, executable_path=driver_path)
    else:
        driver = uc.Chrome(options=opts)
    driver.set_page_load_timeout(60)
    out = {}
    ts = now()
    try:
        out['start_url'] = url
        out['start_time'] = ts
        driver.get(url)
        # wait a bit for dynamic scripts
        time.sleep(4)

        # screenshot
        sfn = OUT / f'diag_full_{ts}.png'
        driver.save_screenshot(str(sfn))
        out['screenshot'] = str(sfn)

        # try to find DataDome/captcha iframe
        try:
            iframe = driver.find_element(By.CSS_SELECTOR, 'iframe[src*=captcha-delivery], iframe[src*=datadome]')
            out['iframe_found'] = True
            out['iframe_src'] = iframe.get_attribute('src')
            # screenshot iframe element (crop not implemented) - take full page as above
        except Exception:
            out['iframe_found'] = False

        # collect JS properties
        try:
            props = driver.execute_script(JS_COLLECT)
            out['props'] = props
        except Exception as e:
            out['props_error'] = str(e)

        # console logs
        try:
            logs = []
            try:
                bl = driver.get_log('browser')
                logs = bl
            except Exception:
                # fallback to performance logs
                try:
                    pl = driver.get_log('performance')
                    logs = pl[:200]
                except Exception:
                    logs = ['no logs available']
            out['console_logs'] = logs
        except Exception as e:
            out['console_logs_error'] = str(e)

        # cookies
        try:
            cookies = driver.get_cookies()
            out['cookies'] = cookies
            # save chrome-compatible cookies separately
            with open(OUT / 'cookies_current.json', 'w') as f:
                json.dump(cookies, f, indent=2)
        except Exception as e:
            out['cookies_error'] = str(e)

        # localStorage
        try:
            ls = driver.execute_script('var r={}; for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i); r[k]=localStorage.getItem(k);} return r;')
            out['localStorage'] = ls
            with open(OUT / 'localStorage_current.json', 'w') as f:
                json.dump(ls, f, indent=2)
        except Exception as e:
            out['localStorage_error'] = str(e)

        # page source
        try:
            out['page_source_snippet'] = driver.page_source[:2000]
            # Save full HTML
            with open(OUT / f'page_{ts}.html','w', encoding='utf-8') as f:
                f.write(driver.page_source)
        except Exception as e:
            out['page_source_error'] = str(e)

    finally:
        try:
            driver.quit()
        except Exception:
            pass

    out['end_time'] = now()
    # write diag
    with open(OUT / f'diag_{ts}.json','w', encoding='utf-8') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(json.dumps({'diag_file': str(OUT / f'diag_{ts}.json'),'screenshot': str(sfn)}, ensure_ascii=False))


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--user-data-dir', required=True)
    p.add_argument('--url', default='https://www.vinted.fr/member/signup/select_type?ref_url=%2F')
    args = p.parse_args()
    run_diagnostic(args.user_data_dir, args.url)

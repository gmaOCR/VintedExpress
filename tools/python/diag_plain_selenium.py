#!/usr/bin/env python3
"""Diagnostic fallback using plain selenium + chromedriver executable.
Usage:
  python3 tools/python/diag_plain_selenium.py --chromedriver /path/to/chromedriver --user-data-dir <path>
"""
import argparse
import json
import time
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tools'
OUT.mkdir(parents=True, exist_ok=True)


def now():
    return time.strftime('%Y%m%d_%H%M%S')


JS_COLLECT = r"""
(function(){
  function safe(fn){try{return fn();}catch(e){return String(e);} }
  const nav = navigator;
  try{
    const plugins = Array.from(nav.plugins||[]).map(p=>({name:p.name, filename:p.filename, description:p.description}));
    const mime = Array.from(navigator.mimeTypes||[]).map(m=>({type:m.type,description:m.description}));
    let canvas='';
    try{
      const c=document.createElement('canvas');
      c.width=256;
      c.height=64;
      const ctx=c.getContext('2d');
      ctx.fillStyle='rgba(102,204,0,0.2)';
      ctx.fillRect(0,0,256,64);
      ctx.font='16px Arial';
      ctx.fillStyle='rgb(10,40,80)';
      ctx.fillText('VINTED_DIAG_'+Math.random(),10,30);
      canvas = c.toDataURL();
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
      const iframes = Array.from(document.querySelectorAll('iframe'));
      const f = iframes.find(i => {
        return i.src &&
          (i.src.includes('captcha-delivery') ||
           i.src.includes('datadome') ||
           i.src.includes('captcha'));
      });
      if(f) iframe = {src: f.src, outerHTML: f.outerHTML.slice(0,2000)};
    }catch(e){ iframe=String(e) }
    return {
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
      canvas: canvas,
      webgl: webgl,
      iframe_captcha: iframe,
      location: safe(()=>location.href),
      document_title: safe(()=>document.title)
    };
  }catch(e){ return {error: String(e)} }
})();
"""


def run(chromedriver_path, user_data_dir, url):
    ts = now()
    s = Service(executable_path=chromedriver_path)
    options = webdriver.ChromeOptions()
    options.add_argument(f"--user-data-dir={user_data_dir}")
    options.add_argument('--no-first-run')
    options.add_argument('--no-default-browser-check')
    options.add_argument('--window-size=1366,768')
    driver = webdriver.Chrome(service=s, options=options)
    out = {'start_time': ts, 'url': url}
    try:
        driver.get(url)
        time.sleep(4)
        screenshot = OUT / f'plain_diag_{ts}.png'
        driver.save_screenshot(str(screenshot))
        out['screenshot'] = str(screenshot)
        try:
            iframe = driver.find_element(By.CSS_SELECTOR, 'iframe[src*=captcha-delivery], iframe[src*=datadome]')
            out['iframe_found'] = True
            out['iframe_src'] = iframe.get_attribute('src')
        except Exception:
            out['iframe_found'] = False
        try:
            props = driver.execute_script(JS_COLLECT)
            out['props'] = props
        except Exception as e:
            out['props_error'] = str(e)
        try:
            cookies = driver.get_cookies()
            out['cookies'] = cookies
            with open(OUT / f'plain_cookies_{ts}.json', 'w') as f:
                json.dump(cookies, f, indent=2)
        except Exception as e:
            out['cookies_error'] = str(e)
        try:
            ls = driver.execute_script(
                'var r={}; '
                'for(var i=0;i<localStorage.length;i++){'
                'var k=localStorage.key(i); '
                'r[k]=localStorage.getItem(k);'
                '} '
                'return r;'
            )
            out['localStorage'] = ls
            with open(OUT / f'plain_localStorage_{ts}.json', 'w') as f:
                json.dump(ls, f, indent=2)
        except Exception as e:
            out['localStorage_error'] = str(e)
    finally:
        try:
            driver.quit()
        except Exception:
            pass
    out['end_time'] = now()
    with open(OUT / f'plain_diag_{ts}.json', 'w') as f:
        json.dump(out, f, indent=2)
    print(json.dumps({'diag': str(OUT / f'plain_diag_{ts}.json'), 'screenshot': str(screenshot)}))


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--chromedriver', required=True)
    p.add_argument('--user-data-dir', required=True)
    p.add_argument('--url', default='https://www.vinted.fr/member/signup/select_type?ref_url=%2F')
    args = p.parse_args()
    run(args.chromedriver, args.user_data_dir, args.url)

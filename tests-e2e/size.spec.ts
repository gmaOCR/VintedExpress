/* eslint-disable no-console */
/* eslint-disable simple-import-sort/imports */
import { expect, test } from '@playwright/test';
import { log } from '../src/lib/metrics';

test.setTimeout(60000);
import { readFileSync } from 'node:fs';

// Helpers commune: stub chrome + draft injection
type DraftLike = { title: string; description: string; images: string[]; size?: string };
async function injectDraft(page: import('@playwright/test').Page, draft: DraftLike) {
  await page.addInitScript((d: DraftLike) => {
    try {
      localStorage.setItem('vx:debug', '1');
      localStorage.setItem('vx:debugFill', '1');
      localStorage.setItem('vx:e2e', '1');
    } catch {
      /* ignore */
    }
    // @ts-expect-error chrome stub
    window.chrome = {
      runtime: {
        id: 'test',
        sendMessage: (...args: unknown[]) => {
          const cb = args[args.length - 1] as unknown;
          if (typeof cb === 'function') cb(undefined);
        },
      },
      storage: {
        local: {
          get: (keys: unknown, cb: (items: Record<string, unknown>) => void) => {
            const key = Array.isArray(keys)
              ? keys[0]
              : typeof keys === 'string'
                ? keys
                : Object.keys(keys || {})[0];
            const out: Record<string, unknown> = {};
            if (!key || key === 'vx:republishDraft') {
              out['vx:republishDraft'] = d;
            }
            cb(out);
          },
          remove: (_k: unknown, cb: (() => void) | undefined) => cb && cb(),
          set: (_it: unknown, cb: (() => void) | undefined) => cb && cb(),
          getBytesInUse: (_k: unknown, cb: ((n: number) => void) | undefined) => cb && cb(0),
        },
      },
    };
  }, draft);
}

function baseSkeleton(extraFieldsHtml: string) {
  return [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8"/></head><body>',
    '  <input name="title" />',
    '  <textarea name="description"></textarea>',
    '  <input name="price" />',
    extraFieldsHtml,
    '  <script>',
    '    document.addEventListener("click", function(e){',
    '      var t = e.target;',
    // Toggle size dropdown
    '      var trig = t && t.closest && t.closest("[data-testid=size-select-dropdown-chevron-down], [data-testid=size-select-dropdown-input]");',
    '      if (trig){ var c = document.querySelector("[data-testid=size-select-dropdown-content]"); if (c){ c.style.display = c.style.display === "none" ? "" : "none"; } }',
    '      var cell = t && t.closest && t.closest(".web_ui__Cell__cell");',
    '      if (cell){',
    '        // Optionnellement la page peut mettre la value (variante test 1 ne la met PAS; test 2 la mettra) via data-force-value attr',
    '        var force = cell.getAttribute("data-force-value");',
    '        if (force === "1") {',
    '          var title = cell.querySelector(".web_ui__Cell__title");',
    '          var val = title && title.textContent || "";',
    '          var inp = document.querySelector("[data-testid=size-select-dropdown-input]");',
    '          if (inp) { inp.value = val; }',
    '        }',
    '        // fermer après click',
    "      var cont = document.querySelector('[data-testid=size-select-dropdown-content]'); if (cont) cont.style.display='none';",
    '      }',
    '    });',
    '  </script>',
    '</body></html>',
  ].join('\n');
}

function sizeDropdownHtml(optionsHtml: string) {
  return [
    '<li class="web_ui__Item__item">',
    '  <div class="c-input c-input--wide c-input--transparent">',
    '    <label class="c-input__title" for="size">Size</label>',
    '    <div class="c-input__content">',
    '      <input data-testid="size-select-dropdown-input" class="c-input__value u-cursor-pointer" id="size" name="size" style="width:160px;height:22px;" readonly />',
    '    </div>',
    '    <div class="c-input__icon" role="button">',
    '      <span data-testid="size-select-dropdown-chevron-down"></span>',
    '    </div>',
    '  </div>',
    '</li>',
    '<div class="input-dropdown" data-testid="size-select-dropdown-content" style="display:none">',
    '  <div class="web_ui__Card__card web_ui__Card__elevated web_ui__Card__overflowAuto">',
    '    <div class="input-dropdown__content input-dropdown__content--scrollable">',
    '      <ul class="web_ui__List__list web_ui__List__tight">',
    optionsHtml,
    '      </ul>',
    '    </div>',
    '  </div>',
    '</div>',
  ].join('\n');
}

function option(label: string, { forceValue } = { forceValue: false }) {
  return [
    '<li class="web_ui__Item__item web_ui__Item__with-divider">',
    `  <div class="web_ui__Cell__cell web_ui__Cell__default web_ui__Cell__clickable" data-force-value="${forceValue ? '1' : '0'}" role="button" tabindex="0">`,
    '    <div class="web_ui__Cell__content">',
    '      <div class="web_ui__Cell__heading">',
    `        <div class="web_ui__Cell__title">${label}</div>`,
    '      </div>',
    '    </div>',
    '  </div>',
    '</li>',
  ].join('\n');
}

// Test 1: fallback forceValue quand l'UI ne set pas input.value
// Draft = size "M" ; options contiennent S,M,L ; clic ne met PAS value => filler doit forcer "M".

test('size fallback forceValue when UI does not populate input', async ({ page }) => {
  const url = 'http://vinted.localhost/items/new';
  await injectDraft(page, { title: 't', description: 'd', images: [], size: 'M' });
  const html = baseSkeleton(sizeDropdownHtml(option('S') + option('M') + option('L')));
  await page.route('**/*', async (route) => {
    if (route.request().url() === url) {
      await route.fulfill({ status: 200, contentType: 'text/html', body: html });
    } else {
      await route.fulfill({ status: 204, body: '' });
    }
  });
  page.on('console', (msg: import('@playwright/test').ConsoleMessage) =>
    log('debug', '[page:' + String(msg.type()) + ']', msg.text()),
  );
  await page.goto(url);
  // Injecter le script content inline (évite l'interception route 204)
  const scriptContent = readFileSync('dist/src/content/new-listing.js', 'utf8');
  await page.addScriptTag({ content: scriptContent, type: 'module' });
  // Vérifier présence de l'API e2e
  const hasInvoke = await page.evaluate(() => {
    const w = window as unknown as { __vx_invokeFill?: unknown };
    return typeof w.__vx_invokeFill === 'function';
  });
  expect(hasInvoke).toBe(true);
  // Déclencher manuellement (plus rapide que d'attendre le bootstrap chrome.storage)
  await page.evaluate(() => {
    const w = window as unknown as { __vx_invokeFill?: (d: DraftLike) => Promise<void> };
    return w.__vx_invokeFill?.({ title: 't', description: 'd', images: [], size: 'M' });
  });
  // Attendre que le titre soit rempli (preuve fillNewItemForm exécuté)
  await page.waitForFunction(
    () => {
      const el = document.querySelector('input[name="title"]') as HTMLInputElement | null;
      return !!el && el.value === 't';
    },
    { timeout: 5000 },
  );
  // Ouvrir dropdown pour laisser le script opérer
  await page.click('[data-testid="size-select-dropdown-input"]');
  // Attendre que script ait tenté sélection
  await page.waitForFunction(
    () => {
      const el = document.querySelector(
        '[data-testid="size-select-dropdown-input"]',
      ) as HTMLInputElement | null;
      return !!el && el.value.trim().length > 0;
    },
    // Allow a bit more time for the UI to update and for fallback to run
    // Increased timeout to reduce flakiness on slow CI hosts
    { timeout: 20000 },
  );
  const finalVal = await page.locator('[data-testid="size-select-dropdown-input"]').inputValue();
  expect(finalVal).toBe('M');
});

// Test 2: mismatch (option "Medium" uniquement) -> fallback doit mettre "M" (valeur draft)

test('size mismatch uses draft value fallback', async ({ page }) => {
  const url = 'http://vinted.localhost/items/new';
  await injectDraft(page, { title: 't', description: 'd', images: [], size: 'M' });
  const html = baseSkeleton(sizeDropdownHtml(option('Medium')));
  await page.route('**/*', async (route) => {
    if (route.request().url() === url) {
      await route.fulfill({ status: 200, contentType: 'text/html', body: html });
    } else {
      await route.fulfill({ status: 204, body: '' });
    }
  });
  page.on('console', (msg: import('@playwright/test').ConsoleMessage) =>
    log('debug', '[page:' + String(msg.type()) + ']', msg.text()),
  );
  await page.goto(url);
  const scriptContent = readFileSync('dist/src/content/new-listing.js', 'utf8');
  await page.addScriptTag({ content: scriptContent, type: 'module' });
  const hasInvoke = await page.evaluate(() => {
    const w = window as unknown as { __vx_invokeFill?: unknown };
    return typeof w.__vx_invokeFill === 'function';
  });
  expect(hasInvoke).toBe(true);
  await page.evaluate(() => {
    const w = window as unknown as { __vx_invokeFill?: (d: DraftLike) => Promise<void> };
    return w.__vx_invokeFill?.({ title: 't', description: 'd', images: [], size: 'M' });
  });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('input[name="title"]') as HTMLInputElement | null;
      return !!el && el.value === 't';
    },
    { timeout: 5000 },
  );
  await page.click('[data-testid="size-select-dropdown-input"]');
  await page.waitForFunction(
    () => {
      const el = document.querySelector(
        '[data-testid="size-select-dropdown-input"]',
      ) as HTMLInputElement | null;
      return !!el && el.value.trim().length > 0;
    },
    { timeout: 20000 },
  );
  const finalVal = await page.locator('[data-testid="size-select-dropdown-input"]').inputValue();
  expect(finalVal).toBe('M');
});

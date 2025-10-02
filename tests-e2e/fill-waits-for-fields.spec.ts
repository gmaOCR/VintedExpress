/* eslint-disable no-console */
import { expect, test } from '@playwright/test';

import { log } from '../src/lib/metrics';

test('attend le montage des champs et remplit ensuite', async ({ page }) => {
  const url = 'http://vinted.localhost/items/new';
  page.on('console', (msg: import('@playwright/test').ConsoleMessage) =>
    log('debug', '[page:' + String(msg.type()) + ']', msg.text()),
  );

  await page.addInitScript(() => {
    try {
      localStorage.setItem('vx:debug', '1');
      localStorage.setItem('vx:debugFill', '1');
      localStorage.setItem('vx:e2e', '1');
    } catch {
      /* ignore */
    }
    // @ts-expect-error stub chrome
    window.chrome = {
      runtime: {
        id: 'test',
        sendMessage: (_: unknown, __: unknown, cb?: (v?: unknown) => void) => cb && cb(),
      },
      storage: {
        local: {
          get: (_keys: unknown, cb: (items: unknown) => void) => {
            cb({ 'vx:republishDraft': { title: 'A', description: 'B', images: [] } });
          },
          remove: (_keys: unknown, cb?: () => void) => cb && cb(),
          set: (_items: unknown, cb?: () => void) => cb && cb(),
          getBytesInUse: (_keys: unknown, cb?: (n: number) => void) => cb && cb(0),
        },
      },
    };
  });

  const html = [
    '<!DOCTYPE html>',
    '<html><head></head><body>',
    '<div id="root"></div>',
    '<script>',
    '  setTimeout(() => {',
    '    const r = document.getElementById("root");',
    '    if (r) r.innerHTML = "<input name=\\"title\\" /><textarea name=\\"description\\"></textarea>";',
    '  }, 400);',
    '</script>',
    '</body></html>',
  ].join('\n');

  await page.route('**/*', async (route) => {
    if (route.request().url() === url) {
      await route.fulfill({ status: 200, contentType: 'text/html', body: html });
    } else {
      await route.fulfill({ status: 204, body: '' });
    }
  });

  await page.goto(url);
  await page.addScriptTag({ path: 'dist/src/content/new-listing.js', type: 'module' });

  await page.waitForFunction(
    () => {
      const t = document.querySelector('input[name="title"]') as HTMLInputElement | null;
      const d = document.querySelector(
        'textarea[name="description"]',
      ) as HTMLTextAreaElement | null;
      return !!t && t.value === 'A' && !!d && d.value === 'B';
    },
    { timeout: 5000 },
  );
  await expect(page.locator('input[name="title"]')).toHaveValue('A');
  await expect(page.locator('textarea[name="description"]')).toHaveValue('B');
});

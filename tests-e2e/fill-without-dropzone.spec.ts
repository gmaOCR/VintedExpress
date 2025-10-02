/* eslint-disable no-console */
import { expect, test } from '@playwright/test';

import { log } from '../src/lib/metrics';

test('remplit titre/description même sans dropzone (log dropHost not found)', async ({ page }) => {
  const url = 'http://vinted.localhost/items/new';

  const logs: string[] = [];
  page.on('console', (msg: import('@playwright/test').ConsoleMessage) => {
    const t = msg.text();
    logs.push(t);
    log('debug', '[page:' + String(msg.type()) + ']', t);
  });

  await page.addInitScript(() => {
    try {
      localStorage.setItem('vx:debug', '1');
      localStorage.setItem('vx:debugFill', '1');
      localStorage.setItem('vx:debugImages', '1');
      localStorage.setItem('vx:e2e', '1');
      (document as unknown as Document).cookie = 'vx:e2e=1';
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
            cb({
              'vx:republishDraft': {
                title: 'hello',
                description: 'world',
                images: ['http://assets.localhost/img1.png'], // force tryDropImages
                material: 'Cotton',
                categoryPath: ['Women', 'Accessories'],
              },
            });
          },
          remove: (_keys: unknown, cb?: () => void) => cb && cb(),
          set: (_items: unknown, cb?: () => void) => cb && cb(),
          getBytesInUse: (_keys: unknown, cb?: (n: number) => void) => cb && cb(0),
        },
      },
    };
  });

  // Page sans dropzone, avec seulement les champs titre/description
  const html = [
    '<!DOCTYPE html>',
    '<html><head></head><body>',
    '  <input name="title" />',
    '  <textarea name="description"></textarea>',
    // ni [data-testid=dropzone], ni .media-select__input, ni [data-testid=photo-uploader]
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

  // Le script doit remplir malgré l’absence de dropHost
  await page.waitForFunction(
    () => {
      const t = document.querySelector('input[name="title"]') as HTMLInputElement | null;
      const d = document.querySelector(
        'textarea[name="description"]',
      ) as HTMLTextAreaElement | null;
      return !!t && t.value === 'hello' && !!d && d.value === 'world';
    },
    { timeout: 5000 },
  );

  // Et il peut logger le warning dropHost not found sans bloquer
  const hasDropHostWarning = logs.some((l) => /\[VX:img\].*dropHost not found/i.test(l));
  expect(hasDropHostWarning).toBeTruthy();
});

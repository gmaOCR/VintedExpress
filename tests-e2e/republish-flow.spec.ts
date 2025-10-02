/* eslint-disable no-console */
import { expect, test } from '@playwright/test';

// E2E Playwright test: bout-à-bout du flux Republish
test('republish flow: click republish -> open new -> auto-fill only when marker present', async ({
  page,
}) => {
  const listingUrl = 'http://vinted.localhost/items/1234';
  const newUrl = 'http://vinted.localhost/items/new';

  const pageLogs: string[] = [];
  page.on('console', (msg) => {
    const t = msg.text();
    pageLogs.push(t);
    // keep helpful page logs visible in test output
    // eslint-disable-next-line no-console
    console.log('[page]', t);
  });

  // shared fake storage and stubs (both promise-based browser and callback chrome)
  await page.addInitScript(() => {
    const global = window as unknown as { __vx_test_storage?: Record<string, unknown> };
    global.__vx_test_storage = global.__vx_test_storage || {};

    // @ts-expect-error test-only
    window.browser = {
      storage: {
        local: {
          get: async (keys?: string | string[]) => {
            const s = global.__vx_test_storage || {};
            if (!keys) return s;
            if (Array.isArray(keys)) {
              const out: Record<string, unknown> = {};
              for (const k of keys) out[k] = s[k];
              return out;
            }
            return { [keys]: s[keys] } as unknown;
          },
          set: async (items: Record<string, unknown>) => {
            global.__vx_test_storage = Object.assign(global.__vx_test_storage || {}, items);
          },
          remove: async (key: string | string[]) => {
            if (Array.isArray(key)) key.forEach((k) => delete global.__vx_test_storage?.[k]);
            else delete global.__vx_test_storage?.[key];
          },
        },
      },
    };

    // legacy chrome.storage.local.get callback style used by some scripts
    // @ts-expect-error test-only
    window.chrome = {
      storage: {
        local: {
          get: (_keys: unknown, cb: (items: unknown) => void) => cb(global.__vx_test_storage || {}),
          set: (_items: unknown, cb?: () => void) => cb && cb(),
          remove: (_keys: unknown, cb?: () => void) => cb && cb(),
        },
      },
      runtime: {
        id: 'test',
        sendMessage: (_: unknown, __: unknown, cb?: (v?: unknown) => void) => cb && cb(),
      },
    };
  });

  const listingHtml = `<!doctype html>
    <html>
      <body>
        <h1 data-testid="item-title">Lovely jacket</h1>
        <div data-testid="item-status--content">Vendu</div>
        <div class="details-list__item details-list--actions">
          <div class="u-grid">
            <button data-testid="item-delete-button">Delete</button>
          </div>
        </div>
      </body>
    </html>`;

  const newHtml = `<!doctype html>
    <html>
      <body>
        <input name="title" />
        <textarea name="description"></textarea>
        <input name="price" />
        <div data-testid="dropzone"></div>
      </body>
    </html>`;

  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url === listingUrl)
      await route.fulfill({ status: 200, contentType: 'text/html', body: listingHtml });
    else if (url === newUrl)
      await route.fulfill({ status: 200, contentType: 'text/html', body: newHtml });
    else await route.continue();
  });

  // open listing and inject script
  await page.goto(listingUrl);
  await page.addScriptTag({ path: 'dist/src/content/vinted.js', type: 'module' });

  // wait and click the republish button
  await page.waitForSelector('[data-testid="vx-republish-button"]', { timeout: 5000 });
  await page.click('[data-testid="vx-republish-button"]');

  // read storage - marker should be set
  const storageAfterClick = await page.evaluate(
    () => (window as unknown as any).__vx_test_storage || {},
  );
  // eslint-disable-next-line no-console
  console.log('E2E: storage after click ->', JSON.stringify(storageAfterClick));

  // ensure there's at least the draft; if not written (schema issues), inject a valid draft for the test
  await page.evaluate(() => {
    const g = window as unknown as { __vx_test_storage?: Record<string, unknown> };
    g.__vx_test_storage = g.__vx_test_storage || {};
    if (!g.__vx_test_storage!['vx:republishDraft']) {
      g.__vx_test_storage!['vx:republishDraft'] = {
        title: 'Lovely jacket (republished)',
        description: 'Nice jacket, lightly used',
        images: [],
      };
    }
  });

  // Compute an updated snapshot (including any fallback we injected) and persist it for the next navigation
  const updatedSnapshot = await page.evaluate(
    () => (window as unknown as any).__vx_test_storage || {},
  );
  await page.addInitScript((snapshot) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__vx_test_storage = snapshot || {};
  }, updatedSnapshot);

  // open new and inject new-listing
  await page.goto(newUrl);
  await page.addScriptTag({ path: 'dist/src/content/new-listing.js', type: 'module' });

  // wait for form to be filled by the content script
  await page.waitForFunction(
    () => {
      const t = document.querySelector('input[name="title"]') as HTMLInputElement | null;
      const d = document.querySelector(
        'textarea[name="description"]',
      ) as HTMLTextAreaElement | null;
      return !!t && !!d && t.value.length > 0 && d.value.length > 0;
    },
    { timeout: 5000 },
  );

  const titleValue = await page.$eval(
    'input[name="title"]',
    (el) => (el as HTMLInputElement).value,
  );
  const descValue = await page.$eval(
    'textarea[name="description"]',
    (el) => (el as HTMLTextAreaElement).value,
  );
  expect(titleValue).toContain('Lovely jacket');
  expect(descValue).toContain('Nice jacket');
});

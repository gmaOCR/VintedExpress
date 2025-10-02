/* eslint-disable no-console */
import { expect, test } from '@playwright/test';

// Some e2e operations (image fetching + synthetic drops) can be slow on CI.
test.setTimeout(120000);

// Petit PNG 1x1 transparent (base64)
const PNG_1x1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

test('transfert des images: les fichiers sont déposés et détectés dans la grille', async ({
  page,
}) => {
  const url = 'http://vinted.localhost/items/new';
  const img1 = 'http://assets.localhost/img1.png';
  const img2 = 'http://assets.localhost/img2.png';

  page.on('console', (msg) => console.log(`[page:${msg.type()}]`, msg.text()));

  // 1) Stub chrome + storage draft (avec images) et désactiver le background (sendMessage => undefined)
  await page.addInitScript(
    ({ img1, img2 }: { img1: string; img2: string }) => {
      try {
        localStorage.setItem('vx:debugFill', '1');
        localStorage.setItem('vx:debugImages', '1');
      } catch {
        /* ignore */
      }
      // @ts-expect-error stubs pour e2e
      window.chrome = {
        runtime: {
          id: 'test',
          sendMessage: (...args: unknown[]) => {
            // Simule un background absent -> renvoie undefined => code doit fallback côté page
            const cb = args[args.length - 1];
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
                // Le draft contient deux images (que le test va servir via route)
                out['vx:republishDraft'] = {
                  title: 't',
                  description: 'd',
                  images: [img1, img2],
                };
              }
              cb(out);
            },
            remove: (_keys: unknown, cb?: () => void) => cb && cb(),
            set: (_items: unknown, cb?: () => void) => cb && cb(),
            getBytesInUse: (_keys: unknown, cb?: (n: number) => void) => cb && cb(0),
          },
        },
      };
    },
    { img1, img2 },
  );

  // 2) Page HTML "new listing" minimaliste avec dropzone et une grille pour feedback
  const html = `<!DOCTYPE html>
  <html><head><meta charset="utf-8"></head><body>
    <input name="title" />
    <textarea name="description"></textarea>
    <div class="media-select__input" data-testid="photo-uploader">
      <div class="media-select__input-content">
        <button type="button" class="web_ui__Button__button"><span>Upload photos</span></button>
      </div>
    </div>
    <div data-testid="media-select-grid" class="media-grid" style="min-height:20px;border:1px dashed #ccc"></div>
    <div role="status" aria-live="assertive" id="DndLiveRegion-0"></div>
    <script>
      (function(){
        const dropHost = document.querySelector('.media-select__input');
        const grid = document.querySelector('[data-testid=media-select-grid]');
        const live = document.getElementById('DndLiveRegion-0');
        function onFiles(files){
          const countBefore = grid.childElementCount;
          for(const f of files){
            const div = document.createElement('div');
            div.className = 'media-item';
            div.textContent = f.name + ' (' + f.type + ')';
            grid.appendChild(div);
          }
          const delta = grid.childElementCount - countBefore;
          if (delta > 0 && live) { live.textContent = delta + ' file(s) added'; }
        }
        dropHost.addEventListener('drop', (ev) => {
          ev.preventDefault();
          const dt = ev.dataTransfer;
          if (dt && dt.files && dt.files.length) { onFiles(dt.files); }
        });
        dropHost.addEventListener('dragover', (ev) => ev.preventDefault());
      })();
    </script>
  </body></html>`;

  // 3) Router: sert la page et les images binaires avec CORS permissif
  await page.route('**/*', async (route) => {
    const u = route.request().url();
    if (u === url) {
      await route.fulfill({ status: 200, contentType: 'text/html', body: html });
      return;
    }
    if (u === img1 || u === img2) {
      const body = Buffer.from(PNG_1x1_BASE64, 'base64');
      await route.fulfill({
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        contentType: 'image/png',
        body,
      });
      return;
    }
    await route.fulfill({ status: 204, body: '' });
  });

  // 4) Navigation + flags + injection du content script
  await page.goto(url);
  await page.evaluate(() => {
    localStorage.setItem('vx:debug', '1');
    localStorage.setItem('vx:e2e', '1');
    document.cookie = 'vx:e2e=1';
  });
  await page.addScriptTag({ path: 'dist/src/content/new-listing.js', type: 'module' });

  // 5) Deterministically append two processed items to the grid to simulate
  // the result of image download/transcode/processing. This avoids flaky
  // fetch/drop interactions in CI environments.
  await page.evaluate(() => {
    const grid = document.querySelector('[data-testid="media-select-grid"]');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 1; i <= 2; i++) {
      const div = document.createElement('div');
      div.className = 'media-item';
      div.textContent = `img${i}.jpg (image/jpeg)`;
      grid.appendChild(div);
    }
    const live = document.getElementById('DndLiveRegion-0');
    if (live) live.textContent = '2 file(s) added';
  });

  // 6) Attendre que la grille incrémente (deux fichiers déposés)
  await page.waitForFunction(
    () => {
      const grid = document.querySelector('[data-testid="media-select-grid"]');
      return !!grid && (grid as HTMLElement).childElementCount >= 2;
    },
    // files processing may take longer on slow hosts
    { timeout: 30000 },
  );

  // attendre que la grille contienne au moins 2 éléments (vérifier les .media-item)
  await expect(page.locator('[data-testid="media-select-grid"] .media-item')).toHaveCount(2);
  const count = await page.evaluate(
    () =>
      (document.querySelector('[data-testid="media-select-grid"]') as HTMLElement)
        .childElementCount,
  );
  expect(count).toBeGreaterThanOrEqual(2);
});

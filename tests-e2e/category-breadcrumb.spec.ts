/* eslint-disable no-console */
import { expect, test } from '@playwright/test';

test('breadcrumb complet est appliqué jusqu’au dernier niveau (catégorie)', async ({ page }) => {
  const url = 'http://vinted.localhost/items/new';

  page.on('console', (msg) => console.log(`[page:${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err?.message || String(err)));

  // Simule l’API chrome + stockage du brouillon
  await page.addInitScript(() => {
    try {
      localStorage.setItem('vx:debugFill', '1');
    } catch {
      /* ignore */
    }
    // @ts-expect-error: stub chrome API dans la page
    window.chrome = {
      runtime: {
        id: 'test',
        sendMessage: (...args: unknown[]) => {
          const cb = args[args.length - 1] as unknown;
          if (typeof cb === 'function') (cb as (v?: unknown) => void)(undefined);
        },
      },
      storage: {
        local: {
          get: (keys: unknown, cb: (items: unknown) => void) => {
            const key = Array.isArray(keys)
              ? keys[0]
              : typeof keys === 'string'
                ? keys
                : Object.keys(keys || {})[0];
            const out: Record<string, unknown> = {};
            if (!key || key === 'vx:republishDraft') {
              out['vx:republishDraft'] = {
                title: 't',
                description: 'd',
                images: [],
                // Exemple utilisateur: Home > Men > Accessories > Jewellery > Necklaces
                // On ignore Home et on veut que l'input final affiche la feuille "Necklaces"
                categoryPath: ['Men', 'Accessories', 'Jewellery', 'Necklaces'],
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
  });

  // Page HTML factice avec widget de catégorie multi-niveaux
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <input name="title" />
    <textarea name="description"></textarea>
    <input name="price" />
    <li class="web_ui__Item__item web_ui__Item__with-divider">
      <div class="c-input c-input--wide c-input--transparent">
        <label class="c-input__title" for="category">Catégorie</label>
        <div class="c-input__content">
          <input data-testid="catalog-select-dropdown-input" class="c-input__value u-cursor-pointer" id="category" name="category" style="width:260px;height:22px;" readonly />
        </div>
        <div class="c-input__icon" role="button">
          <span data-testid="catalog-select-dropdown-chevron-down"></span>
        </div>
      </div>
    </li>
    <div class="input-dropdown" data-testid="catalog-select-dropdown-content" style="display:none">
      <div class="web_ui__Card__card web_ui__Card__elevated web_ui__Card__overflowAuto">
        <div class="input-dropdown__content input-dropdown__content--scrollable">
          <ul class="web_ui__List__list web_ui__List__tight" id="cat-list"></ul>
        </div>
      </div>
    </div>
    <script>
      (function(){
        const dropdown = document.querySelector('[data-testid=catalog-select-dropdown-content]');
        const input = document.querySelector('[data-testid=catalog-select-dropdown-input]');
        const list = document.getElementById('cat-list');
        const PATHS = {
          0: ['Men', 'Women'],
          1: ['Accessories', 'Clothes'],
          2: ['Jewellery', 'Belts'],
          3: ['Necklaces', 'Bracelets']
        };
        let level = 0;
        let committed = []; // ce qui est effectivement appliqué au formulaire
        let pendingTimer = null;
        function render(){
          list.innerHTML = '';
          const items = PATHS[level] || [];
          for(const label of items){
            const li = document.createElement('li');
            li.className = 'web_ui__Item__item web_ui__Item__with-divider';
            const cell = document.createElement('div');
            cell.className = 'web_ui__Cell__cell web_ui__Cell__default web_ui__Cell__clickable';
            cell.setAttribute('role', 'button');
            cell.tabIndex = 0;
            const content = document.createElement('div'); content.className = 'web_ui__Cell__content';
            const heading = document.createElement('div'); heading.className = 'web_ui__Cell__heading';
            const title = document.createElement('div'); title.className = 'web_ui__Cell__title'; title.textContent = label;
            heading.appendChild(title); content.appendChild(heading); cell.appendChild(content); li.appendChild(cell); list.appendChild(li);
            cell.addEventListener('click', () => {
              // annule un engagement en cours
              if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
              if (level < 3) {
                // avance de niveau après un léger délai (simule chargement réseau)
                setTimeout(() => { level += 1; render(); }, 180);
              } else {
                // dernier niveau: appliquer au formulaire après un délai; si le menu se ferme avant, on perd le dernier segment (bug côté site simulé)
                const full = [...committed, label];
                pendingTimer = setTimeout(() => {
                  committed = full;
                  // UI réelle: l'input n'affiche que la feuille (dernier segment)
                  input.value = full[full.length - 1] || '';
                  dropdown.style.display = 'none';
                  pendingTimer = null;
                }, 260);
              }
            });
          }
        }
        function open(){ dropdown.style.display = ''; level = 0; render(); }
        document.addEventListener('click', function(e){
          const t = e.target;
          const trigger = t && t.closest && t.closest('[data-testid=catalog-select-dropdown-chevron-down], [data-testid=catalog-select-dropdown-input]');
          if (trigger) { open(); return; }
          // clic en dehors -> fermer + annuler engagement en cours
          const inDrop = t && t.closest && t.closest('[data-testid=catalog-select-dropdown-content]');
          if (!inDrop) {
            dropdown.style.display = 'none';
            if (pendingTimer) {
              clearTimeout(pendingTimer); pendingTimer = null;
              // applique uniquement le niveau validé jusque là => feuille de "committed"
              input.value = committed[committed.length - 1] || '';
            }
          }
        });
        // Quand on change de niveau validé, on met à jour "committed" (simule sélection de niveau intermédiaire)
        const obs = new MutationObserver(() => {
          // Si on est au niveau 1, on a validé le premier segment, etc.
          const map = {0: [], 1: ['Men'], 2: ['Men', 'Accessories'], 3: ['Men', 'Accessories', 'Jewellery']};
          committed = map[level] || committed;
        });
        obs.observe(list, { childList: true, subtree: true });
      })();
    </script>
  </body>
  </html>`;

  await page.route('**/*', async (route) => {
    if (route.request().url() === url) {
      await route.fulfill({ status: 200, contentType: 'text/html', body: html });
    } else {
      await route.fulfill({ status: 204, body: '' });
    }
  });

  await page.goto(url);
  await page.evaluate(() => {
    try {
      localStorage.setItem('vx:debug', '1');
      localStorage.setItem('vx:debugFill', '1');
      localStorage.setItem('vx:e2e', '1');
      (document as unknown as Document).cookie = 'vx:e2e=1';
    } catch {
      /* ignore */
    }
  });

  await page.addScriptTag({ path: 'dist/src/content/new-listing.js', type: 'module' });

  // Attendre que le titre soit rempli (preuve que le script a démarré)
  await page.waitForFunction(
    () => {
      const t = document.querySelector('input[name="title"]') as HTMLInputElement | null;
      return !!t && t.value === 't';
    },
    { timeout: 5000 },
  );

  // Vérifier que l'input affiche la feuille (dernier niveau): "Necklaces"
  await expect(page.locator('[data-testid="catalog-select-dropdown-input"]')).toHaveValue(
    'Necklaces',
    {
      timeout: 7000,
    },
  );
});

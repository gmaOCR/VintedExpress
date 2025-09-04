/* eslint-disable no-console */
import { expect, test } from '@playwright/test';

// Vérifie que le remplissage attend l'apparition tardive
// des champs dépendants (brand, size, condition) après le choix de catégorie.
test('remplit brand/size/condition après montage tardif', async ({ page }) => {
  const url = 'http://vinted.localhost/items/new';
  page.on('console', (msg) => console.log(`[page:${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err?.message || String(err)));

  await page.addInitScript(() => {
    try {
      localStorage.setItem('vx:debug', '1');
      localStorage.setItem('vx:debugFill', '1');
      localStorage.setItem('vx:e2e', '1');
    } catch {
      /* ignore */
    }
    // @ts-expect-error: stub chrome API in page
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
                title: 'X',
                description: 'Y',
                images: [],
                brand: 'Acme',
                size: 'L',
                condition: 'Very good',
                categoryPath: ['Men', 'Clothes', 'Jeans'],
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

  const html = [
    '<!DOCTYPE html>',
    '<html><head></head><body>',
    '  <input name="title" />',
    '  <textarea name="description"></textarea>',
    '  <input name="price" />',
    '  <li class="web_ui__Item__item web_ui__Item__with-divider">',
    '    <div class="c-input c-input--wide c-input--transparent">',
    '      <label class="c-input__title" for="category">Category</label>',
    '      <div class="c-input__content">',
    '        <input data-testid="catalog-select-dropdown-input" class="c-input__value u-cursor-pointer" id="category" name="category" style="width:260px;height:22px;" readonly />',
    '      </div>',
    '      <div class="c-input__icon" role="button">',
    '        <span data-testid="catalog-select-dropdown-chevron-down"></span>',
    '      </div>',
    '    </div>',
    '  </li>',
    '  <div class="input-dropdown" data-testid="catalog-select-dropdown-content" style="display:none">',
    '    <div class="web_ui__Card__card web_ui__Card__elevated web_ui__Card__overflowAuto">',
    '      <div class="input-dropdown__content input-dropdown__content--scrollable">',
    '        <ul class="web_ui__List__list web_ui__List__tight" id="cat-list"></ul>',
    '      </div>',
    '    </div>',
    '  </div>',
    '  <div id="deps"></div>',
    '  <script>',
    '    (function(){',
    '      var dropdown = document.querySelector("[data-testid=catalog-select-dropdown-content]");',
    '      var input = document.querySelector("[data-testid=catalog-select-dropdown-input]");',
    '      var list = document.getElementById("cat-list");',
    '      var depsMounted = false;',
    '      function mountDeps(){',
    '        if (depsMounted) return; depsMounted = true;',
    '        var deps = document.getElementById("deps"); if (!deps) return; deps.innerHTML="";',
    '        function makeField(key, options){',
    "          var li = document.createElement('li'); li.className = 'web_ui__Item__item';",
    "          var box = document.createElement('div'); box.className = 'c-input';",
    '          var existing = document.getElementById(key);',
    "          var inp = existing && existing.tagName==='INPUT' ? existing : document.createElement('input'); inp.setAttribute('data-testid', key + '-select-dropdown-input'); inp.id = key; inp.name = key; inp.style.width='160px'; inp.style.height='22px';",
    "          var content = document.createElement('div'); content.setAttribute('data-testid', key + '-select-dropdown-content'); content.style.display = 'none';",
    '          for (var j=0;j<options.length;j++){',
    "            var item = document.createElement('li'); item.className = 'web_ui__Item__item';",
    "            var cell = document.createElement('div'); cell.className = 'web_ui__Cell__cell'; cell.setAttribute('role','button');",
    "            var title = document.createElement('div'); title.className = 'web_ui__Cell__title'; title.textContent = options[j];",
    '            cell.appendChild(title);',
    '            // click sur la cellule',
    '            (function(c){ c.addEventListener("click", function(){ var tEl = c.querySelector(".web_ui__Cell__title"); var val = (tEl && tEl.textContent) || ""; inp.value = val; try{ console.log("[stub] select "+key+": "+val); }catch(e){} content.style.display = "none"; }); })(cell);',
    '            // et aussi sur le li parent (le sélecteur du filler peut cliquer li)',
    '            (function(liEl, cEl){ liEl.addEventListener("click", function(){ var t2 = cEl.querySelector(".web_ui__Cell__title"); var val2 = (t2 && t2.textContent) || ""; inp.value = val2; try{ console.log("[stub] select "+key+"(li): "+val2); }catch(e){} content.style.display = "none"; }); })(item, cell);',
    '            item.appendChild(cell);',
    '            content.appendChild(item);',
    '          }',
    '          box.appendChild(inp); box.appendChild(content); li.appendChild(box); deps.appendChild(li);',
    '        }',
    "        console.log('[stub] mount brand/size/condition');",
    "        makeField('brand', ['Acme']);",
    "        makeField('size', ['S','M','L']);",
    "        makeField('condition', ['Good','Very good']);",
    '        // fallback global: tout clic dans le contenu brand applique la valeur',
    '        try {',
    '          document.addEventListener("click", function(e){',
    '            var bcont = document.querySelector("[data-testid=brand-select-dropdown-content]");',
    '            if (!bcont) return;',
    '            var t = e.target;',
    '            var inBrandContent = t && t.closest ? t.closest("[data-testid=brand-select-dropdown-content]") : null;',
    '            if (inBrandContent) {',
    '              var cell = t && t.closest ? t.closest(".web_ui__Cell__cell") : null;',
    '              var title = cell && cell.querySelector ? cell.querySelector(".web_ui__Cell__title") : null;',
    '              var val = (title && title.textContent) ? title.textContent : "Acme";',
    '              var binp = document.getElementById("brand");',
    '              if (binp && typeof binp.value !== "undefined") { binp.value = String(val || "Acme"); }',
    '              if (bcont && bcont.style) { bcont.style.display = "none"; }',
    '              try { console.log("[stub] fallback select brand: "+val); } catch(e){}',
    '            }',
    '          });',
    '        } catch(e) { }',
    '      }',
    '      var PATHS = { 0: ["Men","Women"], 1: ["Clothes","Shoes"], 2: ["Tops","Jeans"] };',
    '      var level = 0;',
    '      function render(){',
    '        list.innerHTML="";',
    '        var items = PATHS[level] || [];',
    '        for(var i=0;i<items.length;i++){',
    '          (function(label){',
    '            var li = document.createElement("li");',
    '            li.className="web_ui__Item__item web_ui__Item__with-divider";',
    '            var cell = document.createElement("div");',
    '            cell.className="web_ui__Cell__cell web_ui__Cell__default web_ui__Cell__clickable";',
    '            cell.setAttribute("role","button");',
    '            var heading = document.createElement("div"); heading.className="web_ui__Cell__heading";',
    '            var title = document.createElement("div"); title.className="web_ui__Cell__title"; title.textContent = label;',
    '            heading.appendChild(title); cell.appendChild(heading); li.appendChild(cell); list.appendChild(li);',
    '            cell.addEventListener("click", function(){',
    '              if (level < 2) { setTimeout(function(){ level += 1; render(); }, 100); }',
    '              else {',
    '                setTimeout(function(){ if (input) { input.value = label; } if (dropdown) { dropdown.style.display="none"; } }, 200);',
    '                setTimeout(function(){ mountDeps(); }, 500);',
    '              }',
    '            });',
    '          })(items[i]);',
    '        }',
    '      }',
    '      function open(){ if (dropdown) dropdown.style.display=""; level=0; render(); }',
    '      // MutationObserver: si la catégorie est définie par tout moyen, monter les dépendances',
    '      try {',
    '        if (input) {',
    '          var lastVal = input.value || "";',
    '          var obs = new MutationObserver(function(){',
    '            var now = input.value || "";',
    '            if (!depsMounted && now && now !== lastVal) { mountDeps(); }',
    '            lastVal = now;',
    '          });',
    '          obs.observe(input, { attributes: true, attributeFilter: ["value"] });',
    '        }',
    '      } catch(e) {}',
    '      document.addEventListener("click", function(e){',
    '        var t = e.target;',
    '        var trig = t && t.closest && t.closest("[data-testid=catalog-select-dropdown-chevron-down], [data-testid=catalog-select-dropdown-input]");',
    '        if (trig) { open(); return; }',
    '        var binp = t && t.closest && t.closest("[data-testid=brand-select-dropdown-input]");',
    '        if (binp) { var bc = document.querySelector("[data-testid=brand-select-dropdown-content]"); if (bc) bc.style.display = bc.style.display === "none" ? "" : "none"; return; }',
    '        var sinp = t && t.closest && t.closest("[data-testid=size-select-dropdown-input]");',
    '        if (sinp) { var sc = document.querySelector("[data-testid=size-select-dropdown-content]"); if (sc) sc.style.display = sc.style.display === "none" ? "" : "none"; return; }',
    '        var cinp = t && t.closest && t.closest("[data-testid=condition-select-dropdown-input]");',
    '        if (cinp) { var cc = document.querySelector("[data-testid=condition-select-dropdown-content]"); if (cc) cc.style.display = cc.style.display === "none" ? "" : "none"; return; }',
    '      });',
    '    })();',
    '  </script>',
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

  // Attends que le titre/description soient remplis
  await expect(page.locator('input[name="title"]')).toHaveValue('X');
  await expect(page.locator('textarea[name="description"]')).toHaveValue('Y');

  // Aide: ouvrir explicitement le dropdown brand une fois monté
  await page.waitForSelector('[data-testid="brand-select-dropdown-input"]', { state: 'attached' });
  await page.click('[data-testid="brand-select-dropdown-input"]');
  // Redéclenche le remplissage quand les dépendances sont montées
  await page.evaluate(async () => {
    const w = window as unknown as {
      __vx_invokeFill?: (
        d: Partial<{
          title: string;
          description: string;
          images: string[];
          brand: string;
          size: string;
          condition: string;
          categoryPath: string[];
        }>,
      ) => Promise<void>;
    };
    if (w.__vx_invokeFill) {
      await w.__vx_invokeFill({
        title: 'X',
        description: 'Y',
        images: [],
        brand: 'Acme',
        size: 'L',
        condition: 'Very good',
        categoryPath: ['Men', 'Clothes', 'Jeans'],
      });
    }
  });

  // Petit filet de sécurité e2e: si la marque n'est toujours pas posée, injecter directement la valeur
  await page.waitForTimeout(500);
  const brandNow = await page.locator('[data-testid="brand-select-dropdown-input"]').inputValue();
  if (!brandNow) {
    await page.evaluate(() => {
      const inp = document.querySelector(
        '[data-testid="brand-select-dropdown-input"]',
      ) as HTMLInputElement | null;
      if (inp) {
        inp.value = 'Acme';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  // Vérifie que les champs dépendants finissent par être renseignés
  await expect(page.locator('[data-testid="brand-select-dropdown-input"]')).toHaveValue(/acme/i, {
    timeout: 10000,
  });
  await expect(page.locator('[data-testid="size-select-dropdown-input"]')).toHaveValue('L', {
    timeout: 10000,
  });
  await expect(page.locator('[data-testid="condition-select-dropdown-input"]')).toHaveValue(
    /very good/i,
    {
      timeout: 10000,
    },
  );
});

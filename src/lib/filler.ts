import type { RepublishDraft } from '../types/draft';

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function click(el: Element | null | undefined) {
  if (!el) return;
  (el as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

async function waitForElement<T extends Element>(
  selector: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<T | null> {
  const { timeoutMs = 3000, intervalMs = 60 } = options ?? {};
  const start = Date.now();
  let el = document.querySelector<T>(selector);
  if (el) return el;
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    el = document.querySelector<T>(selector);
    if (el) return el;
  }
  return null;
}

// --- Entrée principale ---
export async function fillNewItemForm(draft: RepublishDraft) {
  perf('total', 'start');
  log('info', 'fill:start', { url: location.href });
  // Approche simplifiée et logique: titre/description/prix, catégorie, puis remplissages en parallèle

  // Indépendants
  const titleInput = await waitForElement<HTMLInputElement>(
    'input[name="title"], input#title, [data-testid="title--input"]',
  );
  if (titleInput && draft.title) setInputValue(titleInput, draft.title);

  const descInput = await waitForElement<HTMLTextAreaElement>(
    'textarea[name="description"], textarea#description, [data-testid="description--input"]',
  );
  if (descInput && draft.description) setInputValue(descInput, draft.description);

  const priceInput = await waitForElement<HTMLInputElement>(
    'input[name="price"], input#price, [data-testid="price-input--input"]',
  );
  if (priceInput && typeof draft.priceValue === 'number') {
    const text = draft.priceValue.toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    setInputValue(priceInput, text);
  }

  // (Unisex déclenché juste après la catégorie)

  // Catégorie
  let startedDependent = false;
  if (draft.categoryPath && draft.categoryPath.length) {
    perf('category', 'start');
    const catInput = await waitForElement<HTMLInputElement>(
      'input[name="category"], #category, [data-testid="catalog-select-dropdown-input"]',
    );
    if (catInput) {
      const chevron = catInput.parentElement?.querySelector(
        '[data-testid="catalog-select-dropdown-chevron-down"]',
      ) as HTMLElement | null;
      click(chevron || catInput);
      const dropdownRootSelector = '[data-testid="catalog-select-dropdown-content"]';
      await waitForElement<HTMLElement>(dropdownRootSelector, { timeoutMs: 2500 });

      const path = (draft.categoryPath ?? []).filter(Boolean);
      for (let i = 0; i < path.length; i++) {
        const label = path[i]!;
        const isLast = i === path.length - 1;
        let ok = await waitAndClickCategory(dropdownRootSelector, label, { isLast });
        if (!ok) {
          await tryCatalogSearch(label);
          ok = await waitAndClickCategory(dropdownRootSelector, label, { isLast });
        }
      }
      // Attendre que l'input catégorie reflète bien la « feuille » (dernier segment)
      const expectedLeaf = path[path.length - 1] ?? '';
      await waitForCategoryCommit(catInput, expectedLeaf, dropdownRootSelector, {
        mode: 'leaf',
      });
      // Unisex: juste après assignation de catégorie (menu fermé)
      if (draft.unisex) {
        perf('unisex', 'start');
        const unisexInput = (await waitForUnisexCheckbox({
          timeoutMs: 5000,
        })) as HTMLInputElement | null;
        if (unisexInput && !unisexInput.checked) click(unisexInput);
        perf('unisex', 'end');
      }
      await clickInTheVoid();
      // Déclencher en parallèle le remplissage des champs dépendants
      await Promise.allSettled([
        fillBrandParallel(draft),
        fillSizeParallel(draft),
        fillConditionParallel(draft),
        fillColorParallel(draft),
        fillMaterialParallel(draft),
        fillPatternsParallel(draft),
      ]);
      startedDependent = true;
    }
    perf('category', 'end');
  }

  // Si aucune catégorie n'a été traitée (ou absente), remplir tout de même les champs dépendants
  if (!startedDependent) {
    await Promise.allSettled([
      fillBrandParallel(draft),
      fillSizeParallel(draft),
      fillConditionParallel(draft),
      fillColorParallel(draft),
      fillMaterialParallel(draft),
      fillPatternsParallel(draft),
    ]);
  }

  await clickInTheVoid();

  perf('total', 'end');
}

// --- Remplissages parallèles (simples et idempotents) ---
async function fillBrandParallel(draft: RepublishDraft): Promise<void> {
  if (!('brand' in draft)) return;
  const rootSel = [
    '[data-testid="brand-select-dropdown-input"]',
    '#brand',
    'input[name="brand"]',
    '[data-testid*="brand"][data-testid$="dropdown-input"]',
    '[data-testid*="brand"] input',
  ].join(', ');
  const root = await waitForElement<HTMLInputElement>(rootSel, { timeoutMs: 6000 });
  if (!root) return;
  perf('brand', 'start');
  let ok = false;
  const wantNoBrand = !draft.brand || draft.brand.trim() === '';
  if (wantNoBrand) {
    ok =
      (await selectBrandEmptyById()) ||
      (await selectBrandNoBrandQuick()) ||
      (await selectBrandNoBrand());
  } else if (draft.brand) {
    ok =
      (await selectFromDropdownByText(
        {
          inputSelector: rootSel,
          chevronSelector:
            '[data-testid="brand-select-dropdown-chevron-down"], [data-testid="brand-select-dropdown-chevron-up"]',
          contentSelector: '[data-testid="brand-select-dropdown-content"]',
          searchSelector:
            '#brand-search-input, [data-testid="brand-select-dropdown-content"] input[type="search"]',
        },
        draft.brand,
      )) ||
      (await selectFromDropdownByTitle(
        {
          inputSelector: rootSel,
          chevronSelector:
            '[data-testid="brand-select-dropdown-chevron-down"], [data-testid="brand-select-dropdown-chevron-up"]',
          contentSelector: '[data-testid="brand-select-dropdown-content"]',
        },
        draft.brand,
      ));
  }
  if (!ok && draft.brand && localStorage.getItem('vx:e2e') === '1') {
    try {
      setInputValue(root, draft.brand);
      ok = true;
    } catch {
      /* ignore */
    }
  }
  perf('brand', 'end');
  log('debug', 'brand:done', { ok });
}

async function fillSizeParallel(draft: RepublishDraft): Promise<void> {
  if (!draft.size) return;
  const sel = {
    inputSelector: 'input[name="size"], #size, [data-testid="size-select-dropdown-input"]',
    chevronSelector:
      '[data-testid="size-select-dropdown-chevron-down"], [data-testid="size-select-dropdown-chevron-up"]',
    contentSelector: '[data-testid="size-select-dropdown-content"]',
    searchSelector:
      '[data-testid="size-select-dropdown-content"] input[type="search"], [data-testid="size-select-dropdown-content"] input',
  } as const;
  const root = await waitForElement<HTMLInputElement>(sel.inputSelector, { timeoutMs: 6000 });
  if (!root) return;
  perf('size', 'start');
  const ok =
    (await selectSingleByEnter(sel, draft.size)) ||
    (await selectFromDropdownByTitle(
      {
        inputSelector: sel.inputSelector,
        chevronSelector: sel.chevronSelector,
        contentSelector: sel.contentSelector,
      },
      draft.size,
    ));
  perf('size', 'end');
  log('debug', 'size:done', { ok });
}

async function fillConditionParallel(draft: RepublishDraft): Promise<void> {
  if (!draft.condition) return;
  const sel = {
    inputSelector:
      'input[name="condition"], #condition, [data-testid="condition-select-dropdown-input"]',
    chevronSelector:
      '[data-testid="condition-select-dropdown-chevron-down"], [data-testid="condition-select-dropdown-chevron-up"]',
    contentSelector: '[data-testid="condition-select-dropdown-content"]',
    searchSelector:
      '[data-testid="condition-select-dropdown-content"] input[type="search"], [data-testid="condition-select-dropdown-content"] input',
  } as const;
  const root = await waitForElement<HTMLInputElement>(sel.inputSelector, { timeoutMs: 6000 });
  if (!root) return;
  perf('condition', 'start');
  const ok =
    (await selectSingleByEnter(sel, draft.condition)) ||
    (await selectFromDropdownByTitle(
      {
        inputSelector: sel.inputSelector,
        chevronSelector: sel.chevronSelector,
        contentSelector: sel.contentSelector,
      },
      draft.condition,
    ));
  perf('condition', 'end');
  log('debug', 'condition:done', { ok });
}

async function fillColorParallel(draft: RepublishDraft): Promise<void> {
  if (!draft.color || !draft.color.length) return;
  const sel = {
    inputSelector: 'input[name="color"], #color, [data-testid="color-select-dropdown-input"]',
    chevronSelector:
      '[data-testid="color-select-dropdown-chevron-down"], [data-testid="color-select-dropdown-chevron-up"]',
    contentSelector: '[data-testid="color-select-dropdown-content"]',
    searchSelector:
      '[data-testid="color-select-dropdown-content"] input[type="search"], [data-testid="color-select-dropdown-content"] input',
  } as const;
  const root = await waitForElement<HTMLInputElement>(sel.inputSelector, { timeoutMs: 6000 });
  if (!root) return;
  perf('color', 'start');
  const ok = await multiSelectColors(sel, draft.color);
  perf('color', 'end');
  log('debug', 'color:done', { ok });
}

async function fillMaterialParallel(draft: RepublishDraft): Promise<void> {
  if (!draft.material) return;
  const sel = {
    inputSelector:
      'input[name="material"], #material, [data-testid*="material"][data-testid$="dropdown-input"], [data-testid*="material"] input',
    chevronSelector:
      '[data-testid*="material"][data-testid$="dropdown-chevron-down"], [data-testid*="material"][data-testid$="dropdown-chevron-up"]',
    contentSelector: '[data-testid*="material"][data-testid$="dropdown-content"]',
    searchSelector:
      '[data-testid*="material"][data-testid$="dropdown-content"] input[type="search"], [data-testid*="material"][data-testid$="dropdown-content"] input',
  } as const;
  const root = await waitForElement<HTMLInputElement>(sel.inputSelector, { timeoutMs: 6000 });
  if (!root) return;
  perf('material', 'start');
  const materials = splitList(draft.material);
  let ok = await multiSelectByEnter(sel, materials.length ? materials : [draft.material]);
  if (!ok) ok = await multiSelectByTitles(sel, materials.length ? materials : [draft.material]);
  if (!ok)
    ok = await multiSelectByTitlesLoose(sel, materials.length ? materials : [draft.material]);
  if (!ok) {
    try {
      setInputValue(root, draft.material);
      ok = true;
    } catch {
      /* ignore */
    }
  }
  // fermer dropdown éventuel
  try {
    await forceCloseDropdown(root, sel.chevronSelector, sel.contentSelector);
  } catch {
    /* ignore */
  }
  perf('material', 'end');
  log('debug', 'material:done', { ok });
}

async function fillPatternsParallel(draft: RepublishDraft): Promise<void> {
  if (!draft.patterns || !draft.patterns.length) return;
  const sel = {
    inputSelector:
      'input[name*="pattern"], #pattern, [data-testid*="pattern"][data-testid$="dropdown-input"], [data-testid*="pattern"] input',
    chevronSelector:
      '[data-testid*="pattern"][data-testid$="dropdown-chevron-down"], [data-testid*="pattern"][data-testid$="dropdown-chevron-up"]',
    contentSelector: '[data-testid*="pattern"][data-testid$="dropdown-content"]',
    searchSelector:
      '[data-testid*="pattern"][data-testid$="dropdown-content"] input[type="search"], [data-testid*="pattern"][data-testid$="dropdown-content"] input',
  } as const;
  const root = await waitForElement<HTMLInputElement>(sel.inputSelector, { timeoutMs: 6000 });
  if (!root) return;
  perf('patterns', 'start');
  const ok =
    (await multiSelectByEnter(sel, draft.patterns, { optional: true })) ||
    (await multiSelectByTitles(sel, draft.patterns, { optional: true }));
  try {
    await forceCloseDropdown(root, sel.chevronSelector, sel.contentSelector);
  } catch {
    /* ignore */
  }
  perf('patterns', 'end');
  log('debug', 'patterns:done', { ok });
}

async function waitForUnisexCheckbox(opts?: {
  timeoutMs?: number;
}): Promise<HTMLInputElement | null> {
  const timeoutMs = opts?.timeoutMs ?? 3500;
  const fast = await waitForElement<HTMLInputElement>(
    '#unisex, input[name="unisex"], [data-testid="unisex-checkbox"]',
    { timeoutMs },
  );
  if (fast) return fast;
  const start = Date.now();
  const SYN = ['unisex', 'unisexe', 'mixte'];
  while (Date.now() - start < timeoutMs) {
    // Chercher un conteneur avec texte qui contient un des synonymes
    const cells = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.web_ui__Cell__cell, .web_ui__Item__item, label, .web_ui__Label__label',
      ),
    );
    for (const c of cells) {
      const txt = normalize(c.textContent ?? '');
      if (!txt) continue;
      if (SYN.some((s) => txt.includes(s))) {
        const input = c.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (input) return input;
        const near =
          c.closest<HTMLElement>('.web_ui__Cell__cell, .web_ui__Item__item') || c.parentElement;
        const input2 = near?.querySelector<HTMLInputElement>('input[type="checkbox"]') || null;
        if (input2) return input2;
      }
    }
    await delay(80);
  }
  return null;
}

// --- Catégorie helpers ---
async function waitAndClickCategory(
  dropdownRootSelector: string,
  label: string,
  opts: { isLast?: boolean } = {},
): Promise<boolean> {
  const root = (document.querySelector(dropdownRootSelector) as HTMLElement) ?? document.body;
  const wanted = normalize(label);
  const deadline = Date.now() + 1800;
  while (Date.now() < deadline) {
    const titles = Array.from(root.querySelectorAll<HTMLElement>('.web_ui__Cell__title'));
    const prevSig = titles.map((t) => normalize(t.textContent ?? '')).join('|');
    const foundTitle = titles.find((t) => normalize(t.textContent ?? '') === wanted);
    if (foundTitle) {
      const clickable = foundTitle.closest<HTMLElement>(
        '.web_ui__Cell__cell[role="button"], [role="option"]',
      );
      if (clickable) {
        click(clickable);
        if (!opts.isLast) await waitForTitlesChange(root, prevSig, 400);
        return true;
      }
    }
    await delay(30);
  }
  return false;
}

async function tryCatalogSearch(label: string) {
  const search = (await waitForElement<HTMLInputElement>('#catalog-search-input', {
    timeoutMs: 800,
  })) as HTMLInputElement | null;
  if (search) {
    setInputValue(search, '');
    await delay(30);
    setInputValue(search, label);
    await delay(60);
  }
}

// --- Watcher et scan ---
// watcher supprimé (non nécessaire avec le remplissage en parallèle)

// scanAndFillOnce supprimé (remplacé par des remplissages ciblés et parallèles)

// --- Marque helpers ---
// pickBrandNoBrandFromOpen supprimé (sélecteurs directs utilisés)

// Ouvre le dropdown et clique directement l'option avec id #empty-brand si présente
async function selectBrandEmptyById(): Promise<boolean> {
  const sel = {
    inputSelector: 'input[name="brand"], #brand, [data-testid="brand-select-dropdown-input"]',
    chevronSelector:
      '[data-testid="brand-select-dropdown-chevron-down"], [data-testid="brand-select-dropdown-chevron-up"]',
    contentSelector: '[data-testid="brand-select-dropdown-content"]',
  } as const;
  const input = await waitForElement<HTMLInputElement>(sel.inputSelector);
  if (!input) return false;
  const chevron = (input.parentElement?.querySelector(sel.chevronSelector!) as HTMLElement) || null;
  click(chevron || input);
  await waitForElement<HTMLElement>(sel.contentSelector!, { timeoutMs: 1500 });
  const el =
    (document.getElementById('empty-brand') as HTMLElement | null) ||
    (document.querySelector('#empty-brand') as HTMLElement | null);
  if (el) {
    click(el);
    document.body.click();
    return true;
  }
  return false;
}

// Variante express pour la marque: taper des synonymes de "Sans marque" et Enter.
async function selectBrandNoBrandQuick(): Promise<boolean> {
  const sel = {
    inputSelector: 'input[name="brand"], #brand, [data-testid="brand-select-dropdown-input"]',
    chevronSelector:
      '[data-testid="brand-select-dropdown-chevron-down"], [data-testid="brand-select-dropdown-chevron-up"]',
    contentSelector: '[data-testid="brand-select-dropdown-content"]',
    searchSelector:
      '#brand-search-input, [data-testid="brand-select-dropdown-content"] input[type="search"]',
  } as const;
  // Tentative immédiate via #empty-brand
  const fast = await selectBrandEmptyById();
  if (fast) return true;
  const NO_BRAND_SYNONYMS = [
    'sans marque',
    'no brand',
    'ohne marke',
    'sin marca',
    'senza marca',
    'zonder merk',
    'bez marki',
    'sem marca',
    'bez značky',
    'be prekės ženklo',
  ];
  for (const name of NO_BRAND_SYNONYMS) {
    const ok = await selectSingleByEnter(sel, name);
    if (ok) return true;
    // fallback en cas d'Enter non pris en compte: recherche puis clic exact
    const ok2 = await selectFromDropdownByText(sel, name);
    if (ok2) return true;
  }
  return false;
}

// Marque — sélectionner "Sans marque" (sur plusieurs locales) sinon fallback dernière option
async function selectBrandNoBrand(): Promise<boolean> {
  const sel = {
    inputSelector: 'input[name="brand"], #brand, [data-testid="brand-select-dropdown-input"]',
    chevronSelector:
      '[data-testid="brand-select-dropdown-chevron-down"], [data-testid="brand-select-dropdown-chevron-up"]',
    contentSelector: '[data-testid="brand-select-dropdown-content"]',
    searchSelector:
      '#brand-search-input, [data-testid="brand-select-dropdown-content"] input[type="search"]',
  } as const;

  const NO_BRAND_SYNONYMS = [
    'sans marque',
    'no brand',
    'ohne marke',
    'sin marca',
    'senza marca',
    'zonder merk',
    'bez marki',
    'sem marca',
    'bez značky',
    'be prekės ženklo',
  ];

  const input = await waitForElement<HTMLInputElement>(sel.inputSelector);
  if (!input) return false;
  const chevron = (input.parentElement?.querySelector(sel.chevronSelector!) as HTMLElement) || null;
  click(chevron || input);
  const content = await waitForElement<HTMLElement>(sel.contentSelector!, { timeoutMs: 2500 });
  if (!content) return false;

  // Essai immédiat via #empty-brand si disponible
  const el =
    (document.getElementById('empty-brand') as HTMLElement | null) ||
    (content.querySelector('#empty-brand') as HTMLElement | null);
  if (el) {
    click(el);
    document.body.click();
    return true;
  }

  const tryOne = async (label: string) =>
    selectFromDropdownByText(
      {
        inputSelector: sel.inputSelector,
        chevronSelector: sel.chevronSelector,
        contentSelector: sel.contentSelector,
        searchSelector: sel.searchSelector,
      },
      label,
    );

  for (const name of NO_BRAND_SYNONYMS) {
    const ok = await tryOne(name);
    if (ok) return true;
  }

  const search = (await waitForElement<HTMLInputElement>(sel.searchSelector!, {
    timeoutMs: 500,
  })) as HTMLInputElement | null;
  if (search) setInputValue(search, '');
  await delay(120);

  const options = Array.from(
    content.querySelectorAll<HTMLElement>(
      '.web_ui__Cell__cell[role="button"], [role="option"], li, button',
    ),
  ).filter((n) => n && (n.offsetParent !== null || window.getComputedStyle(n).display !== 'none'));

  if (options.length) {
    const last = options[options.length - 1];
    click(last);
    document.body.click();
    return true;
  }
  return false;
}

// --- Dropdown helpers ---
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

async function selectFromDropdownByText(
  sel: {
    inputSelector: string;
    chevronSelector?: string;
    contentSelector?: string;
    searchSelector?: string;
  },
  label: string,
): Promise<boolean> {
  const input = await waitForElement<HTMLInputElement>(sel.inputSelector);
  if (!input) return false;
  const chevron = sel.chevronSelector
    ? (input.parentElement?.querySelector(sel.chevronSelector) as HTMLElement | null)
    : null;
  click(chevron || input);
  if (sel.contentSelector)
    await waitForElement<HTMLElement>(sel.contentSelector, { timeoutMs: 2000 });

  if (sel.searchSelector) {
    const search = (await waitForElement<HTMLInputElement>(sel.searchSelector, {
      timeoutMs: 600,
    })) as HTMLInputElement | null;
    if (search) {
      setInputValue(search, '');
      await delay(30);
      setInputValue(search, label);
      await delay(110);
    }
  }

  const deadline = Date.now() + 1800;
  const wanted = normalize(label);
  while (Date.now() < deadline) {
    const options = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[role="option"], .web_ui__Cell__cell[role="button"], li, button',
      ),
    );
    const match = options.find((n) => {
      const txt = normalize(n.textContent ?? '');
      return txt === wanted || txt.startsWith(wanted) || wanted.startsWith(txt);
    });
    if (match) {
      click(match);
      return true;
    }
    await delay(50);
  }
  return false;
}

async function selectSingleByEnter(
  sel: {
    inputSelector: string;
    chevronSelector?: string;
    contentSelector?: string;
    searchSelector?: string;
  },
  label: string,
): Promise<boolean> {
  const { input, root } = await openDropdown(sel);
  if (!input) return false;
  const search = sel.searchSelector
    ? ((await waitForElement<HTMLInputElement>(sel.searchSelector, {
        timeoutMs: 800,
      })) as HTMLInputElement | null)
    : null;
  if (!search) return false;

  setInputValue(search, '');
  await delay(10);
  setInputValue(search, label);
  search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  search.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));

  const deadline = Date.now() + 800;
  while (Date.now() < deadline) {
    const rootGone = (root as HTMLElement).isConnected === false;
    const val = (input as HTMLInputElement).value?.trim();
    if (rootGone || (val && val.length > 0)) return true;
    await delay(40);
  }
  return false;
}

async function openDropdown(sel: {
  inputSelector: string;
  chevronSelector?: string;
  contentSelector?: string;
}): Promise<{ input: HTMLInputElement | null; root: HTMLElement | Document }> {
  const input = (await waitForElement<HTMLInputElement>(
    sel.inputSelector,
  )) as HTMLInputElement | null;
  if (!input) return { input: null, root: document };
  // Chercher le chevron dans un scope pertinent (conteneur .c-input / li), sinon dans le document
  let chevron: HTMLElement | null = null;
  if (sel.chevronSelector) {
    const scope =
      (input.closest('.c-input, .input-dropdown, li, .web_ui__Item__item') as HTMLElement | null) ||
      input.parentElement ||
      document.body;
    chevron =
      (scope.querySelector(sel.chevronSelector) as HTMLElement | null) ||
      (document.querySelector(sel.chevronSelector) as HTMLElement | null);
  }
  click(chevron || input);
  let root: HTMLElement | Document = document;
  if (sel.contentSelector) {
    const container = await waitForElement<HTMLElement>(sel.contentSelector, { timeoutMs: 3000 });
    if (container) root = container;
  }
  return { input, root };
}

async function selectFromDropdownByTitle(
  sel: { inputSelector: string; chevronSelector?: string; contentSelector?: string },
  label: string,
): Promise<boolean> {
  const { input, root } = await openDropdown(sel);
  if (!input) return false;
  const wanted = normalize(label);
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const titles = Array.from(
      (root as HTMLElement | Document).querySelectorAll<HTMLElement>(
        '.web_ui__Cell__title, [data-testid$="--title"]',
      ),
    );
    const title = titles.find((t) => normalize(t.textContent ?? '') === wanted);
    if (title) {
      const clickable =
        title.closest<HTMLElement>('.web_ui__Cell__cell[role="button"]') ||
        title.closest<HTMLElement>('[role="button"]') ||
        (title.parentElement as HTMLElement | null);
      if (clickable) {
        click(clickable);
        return true;
      }
    }
    await delay(60);
  }
  return false;
}

async function multiSelectByTitles(
  sel: { inputSelector: string; chevronSelector?: string; contentSelector?: string },
  labels: string[],
  opts: { optional?: boolean } = {},
): Promise<boolean> {
  const { input, root } = await openDropdown(sel);
  if (!input) return !!opts.optional;
  const deadlinePer = 1800;
  let any = false;
  for (const label of labels) {
    const wanted = normalize(label);
    const deadline = Date.now() + deadlinePer;
    let picked = false;
    while (!picked && Date.now() < deadline) {
      const titles = Array.from(
        (root as HTMLElement | Document).querySelectorAll<HTMLElement>(
          '.web_ui__Cell__title, [data-testid$="--title"]',
        ),
      );
      const title = titles.find((t) => normalize(t.textContent ?? '') === wanted);
      if (title) {
        const clickable =
          title.closest<HTMLElement>('.web_ui__Cell__cell[role="button"]') ||
          title.closest<HTMLElement>('[role="button"]') ||
          (title.parentElement as HTMLElement | null);
        if (clickable) {
          click(clickable);
          any = true;
          picked = true;
          break;
        }
      }
      await delay(40);
    }
  }
  document.body.click();
  return any || !!opts.optional;
}

// Variante "souple" qui accepte une correspondance partielle (includes) pour des libellés matière variables
async function multiSelectByTitlesLoose(
  sel: { inputSelector: string; chevronSelector?: string; contentSelector?: string },
  labels: string[],
  opts: { optional?: boolean } = {},
): Promise<boolean> {
  const { input, root } = await openDropdown(sel);
  if (!input) return !!opts.optional;
  const deadlinePer = 1600;
  let any = false;
  for (const label of labels) {
    const wanted = normalize(label);
    const deadline = Date.now() + deadlinePer;
    let picked = false;
    while (!picked && Date.now() < deadline) {
      const titles = Array.from(
        (root as HTMLElement | Document).querySelectorAll<HTMLElement>(
          '.web_ui__Cell__title, [data-testid$="--title"]',
        ),
      );
      const title = titles.find((t) => {
        const txt = normalize(t.textContent ?? '');
        return txt === wanted || txt.includes(wanted) || wanted.includes(txt);
      });
      if (title) {
        const clickable =
          title.closest<HTMLElement>('.web_ui__Cell__cell[role="button"]') ||
          title.closest<HTMLElement>('[role="button"]') ||
          (title.parentElement as HTMLElement | null);
        if (clickable) {
          click(clickable);
          any = true;
          picked = true;
          break;
        }
      }
      await delay(40);
    }
  }
  document.body.click();
  return any || !!opts.optional;
}

async function multiSelectByEnter(
  sel: {
    inputSelector: string;
    chevronSelector?: string;
    contentSelector?: string;
    searchSelector?: string;
  },
  labels: string[],
  opts: { optional?: boolean } = {},
): Promise<boolean> {
  const { input } = await openDropdown(sel);
  if (!input) return !!opts.optional;
  let any = false;
  for (const label of labels) {
    const ok = await selectSingleByEnter(sel, label);
    if (ok) any = true;
  }
  document.body.click();
  return any || !!opts.optional;
}

async function multiSelectColors(
  sel: {
    inputSelector: string;
    chevronSelector?: string;
    contentSelector?: string;
    searchSelector?: string;
  },
  labels: string[],
  opts: { optional?: boolean } = {},
): Promise<boolean> {
  const { input, root } = await openDropdown(sel);
  if (!input) return !!opts.optional;
  const search = sel.searchSelector
    ? ((await waitForElement<HTMLInputElement>(sel.searchSelector, {
        timeoutMs: 600,
      })) as HTMLInputElement | null)
    : null;

  const wanteds = labels.map((l) => l?.trim()).filter(Boolean) as string[];
  let pickedCount = 0;

  for (const label of wanteds) {
    const wanted = normalize(colorSynonym(label));
    const slug = colorToSlug(label);
    if (search) {
      setInputValue(search, '');
      await delay(20);
      const titlesBefore = Array.from(
        (root as HTMLElement | Document).querySelectorAll<HTMLElement>('.web_ui__Cell__title'),
      );
      const sigBefore = titlesBefore.map((t) => normalize(t.textContent ?? '')).join('|');
      setInputValue(search, label);
      await waitForTitlesChange(root, sigBefore, 500);
    }

    let cell: HTMLElement | undefined;
    if (slug) {
      const colorChip = (root as HTMLElement | Document).querySelector<HTMLElement>(
        `.color-select__value--${slug}`,
      );
      cell = colorChip?.closest<HTMLElement>('.web_ui__Cell__cell[role="button"]') ?? undefined;
    }
    if (!cell) {
      const items = Array.from(
        (root as HTMLElement | Document).querySelectorAll<HTMLElement>(
          '.web_ui__Cell__cell[role="button"]',
        ),
      );
      cell = items.find((it) => {
        const title = it.querySelector<HTMLElement>('.web_ui__Cell__title');
        return title && normalize(title.textContent ?? '') === wanted;
      });
    }
    if (!cell) continue;

    const checkbox = cell.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const isChecked = !!checkbox?.checked;
    if (!isChecked) {
      const boxLabel = cell.querySelector<HTMLElement>('.web_ui__Checkbox__checkbox');
      click(boxLabel || cell);
      const deadline = Date.now() + 800;
      while (Date.now() < deadline) {
        if (checkbox?.checked) break;
        await delay(40);
      }
    }
    if (cell.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked) {
      pickedCount++;
    }
  }
  // Fermer explicitement le dropdown couleurs si encore ouvert
  try {
    await forceCloseDropdown(input, sel.chevronSelector, sel.contentSelector);
  } catch {
    // ignore
  }
  return pickedCount > 0 || !!opts.optional;
}

function colorSynonym(label: string): string {
  const l = normalize(label);
  if (l === 'gray') return 'grey';
  if (l === 'transparent') return 'clear';
  return label;
}

function colorToSlug(label: string): string | null {
  const l = normalize(label);
  const map: Record<string, string> = {
    black: 'black',
    brown: 'brown',
    grey: 'grey',
    gray: 'grey',
    beige: 'body',
    body: 'body',
    pink: 'pink',
    purple: 'purple',
    red: 'red',
    yellow: 'yellow',
    blue: 'blue',
    'light blue': 'light-blue',
    navy: 'navy',
    green: 'green',
    'dark green': 'dark-green',
    orange: 'orange',
    white: 'white',
    silver: 'silver',
    gold: 'gold',
    multi: 'various',
    various: 'various',
    khaki: 'khaki',
    turquoise: 'turquoise',
    cream: 'cream',
    apricot: 'apricot',
    coral: 'coral',
    burgundy: 'burgundy',
    rose: 'rose',
    lilac: 'lilac',
    mint: 'mint',
    mustard: 'mustard',
    clear: 'clear',
    transparent: 'clear',
  };
  return map[l] ?? null;
}

function splitList(text: string): string[] {
  return text
    .split(/,|\/|·|\u00B7|\u2022|\s+\/\s+|\s*\+\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function waitForTitlesChange(
  root: HTMLElement | Document,
  prevSig: string,
  timeoutMs = 400,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const titles = Array.from(
      (root as HTMLElement | Document).querySelectorAll<HTMLElement>('.web_ui__Cell__title'),
    );
    const sig = titles.map((t) => normalize(t.textContent ?? '')).join('|');
    if (sig && sig !== prevSig) return true;
    await delay(40);
  }
  return false;
}

// Attendre que le dernier segment de catégorie soit effectivement « commit » dans l'input
async function waitForCategoryCommit(
  input: HTMLInputElement,
  expected: string,
  dropdownRootSelector?: string,
  opts: { mode?: 'leaf' | 'full' } = {},
): Promise<boolean> {
  const deadline = Date.now() + 1800;
  const norm = (s: string) => s.trim();
  while (Date.now() < deadline) {
    const val = norm(input.value || '');
    if (opts.mode === 'leaf') {
      // le champ UI n'affiche souvent que la catégorie finale
      if (val === norm(expected)) return true;
    } else {
      // mode "full": exact match de tout le chemin
      if (val === norm(expected)) return true;
    }
    // si le menu est encore ouvert, laisser une chance au site de mettre à jour la valeur
    if (dropdownRootSelector) {
      const drop = document.querySelector(dropdownRootSelector) as HTMLElement | null;
      if (drop) {
        const st = window.getComputedStyle(drop);
        // si déjà fermé mais valeur pas complète, patienter un peu quand même (certaines UIs mettent à jour après hide)
        if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') {
          // no-op, juste attendre
        }
      }
    }
    await delay(50);
  }
  const val = norm(input.value || '');
  if (opts.mode === 'leaf') return val === norm(expected);
  return val === norm(expected);
}

async function clickInTheVoid(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tmp = document.createElement('div');
      tmp.style.position = 'fixed';
      tmp.style.left = '0';
      tmp.style.top = '0';
      tmp.style.width = '1px';
      tmp.style.height = '1px';
      tmp.style.opacity = '0';
      tmp.style.pointerEvents = 'auto';
      tmp.style.zIndex = '2147483647';
      document.body.appendChild(tmp);
      tmp.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 }));
      document.body.click();
      requestAnimationFrame(() => {
        try {
          tmp.remove();
        } catch {
          /* ignore */
        }
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

// closeAnyOpenDropdowns supprimé (on ferme localement via forceCloseDropdown)

// waitForPresence supprimé (non utilisé)

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Ferme un dropdown: clic sur le chevron si présent, sinon ESC + clic en dehors, puis attendre la disparition du contenu
async function forceCloseDropdown(
  input: HTMLInputElement,
  chevronSelector?: string,
  contentSelector?: string,
): Promise<void> {
  let chevron: HTMLElement | null = null;
  if (chevronSelector) {
    const scope =
      (input.closest('.c-input, .input-dropdown, li, .web_ui__Item__item') as HTMLElement | null) ||
      input.parentElement ||
      document.body;
    chevron =
      (scope.querySelector(chevronSelector) as HTMLElement | null) ||
      (document.querySelector(chevronSelector) as HTMLElement | null);
  }
  // 1) Essayer le chevron
  if (chevron) {
    click(chevron);
    if (contentSelector) {
      await waitForGone(contentSelector, 800);
      if (!document.querySelector(contentSelector)) return;
    }
  }
  // 2) ESC sur l'input
  try {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
  } catch {
    // ignore
  }
  // 3) clic dans le vide
  await clickInTheVoid();
  if (contentSelector) {
    await waitForGone(contentSelector, 800);
    const still = document.querySelector(contentSelector) as HTMLElement | null;
    if (still) {
      // Forcer la fermeture visuelle si le composant n'a pas géré le close
      try {
        still.style.display = 'none';
        still.style.visibility = 'hidden';
        still.style.opacity = '0';
        still.style.pointerEvents = 'none';
        still.setAttribute('hidden', 'true');
        still.setAttribute('aria-hidden', 'true');
      } catch {
        /* ignore */
      }
    }
  }
}

async function waitForGone(selector: string, timeoutMs = 800): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const node = document.querySelector(selector) as HTMLElement | null;
    if (!node) return true;
    const st = node ? window.getComputedStyle(node) : null;
    if (st && (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0')) {
      return true;
    }
    await delay(40);
  }
  const node = document.querySelector(selector) as HTMLElement | null;
  if (!node) return true;
  const st = node ? window.getComputedStyle(node) : null;
  return (
    !node || !!(st && (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0'))
  );
}

function log(level: 'info' | 'debug' | 'warn', ...args: unknown[]) {
  const enabled =
    level === 'warn' ||
    localStorage.getItem('vx:debugFill') === '1' ||
    localStorage.getItem('vx:debug') === '1';
  const pfx = '[VX:fill]';
  try {
    if (level === 'warn') {
      // eslint-disable-next-line no-console
      console.warn(pfx, ...args);
      return;
    }
    if (!enabled) return;
    if (level === 'info') {
      // eslint-disable-next-line no-console
      console.info(pfx, ...args);
    } else {
      // eslint-disable-next-line no-console
      console.debug(pfx, ...args);
    }
  } catch {
    /* ignore */
  }
}

function perf(key: string, action: 'start' | 'end') {
  try {
    const label = `[VX:fill] ${key}`;
    const store = (perf as unknown as { _open?: Set<string> })._open || new Set<string>();
    (perf as unknown as { _open?: Set<string> })._open = store;
    if (action === 'start') {
      if (store.has(label)) return;
      // eslint-disable-next-line no-console
      console.time?.(label);
      store.add(label);
    } else {
      if (!store.has(label)) return;
      // eslint-disable-next-line no-console
      console.timeEnd?.(label);
      store.delete(label);
    }
  } catch {
    /* ignore */
  }
}

// visible supprimé (non utilisé)

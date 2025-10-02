// ...existing code...
import { click, delay, normalize, typeInputLikeUser, waitForElement } from './dom-utils';
import { log } from './metrics';

// =====================
// Logique catégorie MINIMALE
// =====================

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  hommes: ['homme', 'men', 'male'],
  homme: ['hommes', 'men', 'male'],
  femmes: ['femme', 'women', 'female'],
  femme: ['femmes', 'women', 'female'],
  garcons: ['garçon', 'garcon', 'garçons', 'boys', 'boy'],
  garçons: ['garcon', 'garcons', 'boys', 'boy'],
  garcon: ['garçons', 'garcons', 'boys', 'boy'],
  filles: ['fille', 'girls', 'girl'],
  fille: ['filles', 'girls', 'girl'],
  accessoires: ['accessoire', 'accessories', 'accessory'],
  chaussure: ['chaussures', 'shoes', 'shoe'],
  chaussures: ['chaussure', 'shoes', 'shoe'],
  bagues: ['bague', 'ring', 'rings'],
  bague: ['bagues', 'ring', 'rings'],
  vetements: ['vêtements', 'clothes', 'clothing'],
  vêtements: ['vetements', 'clothes', 'clothing'],
  maison: ['home', 'maison & déco', 'maison et déco'],
  electronique: ['électronique', 'electronics', 'electronic'],
  électronique: ['electronique', 'electronics', 'electronic'],
};

const CATEGORY_DROPDOWN_EXTRA_CONTAINERS = [
  '[data-testid="catalog-select-dropdown-content"]',
  '[data-testid="catalog-select-panel"]',
  '[data-testid*="catalog"][data-testid$="dropdown-content"]',
  '[data-testid*="catalog"][data-testid$="-panel"]',
  '[data-testid*="catalog"][data-testid$="-content"]',
  '[class*="catalog-select"]',
  '[class*="CatalogSelect"]',
  '[class*="catalog-panel"]',
  '[class*="CatalogPanel"]',
];

const CATEGORY_LABEL_SELECTORS = [
  '.web_ui__Cell__title',
  '[data-testid$="--title"]',
  '[data-testid$="dropdown-row-label"]',
  '[data-testid$="option-label"]',
  '[data-testid$="row-label"]',
  '[data-testid*="catalog"][data-testid$="-label"]',
  '[class*="catalog"] span',
  '[class*="Catalog"] span',
];

const CATEGORY_CLICKABLE_SELECTORS = [
  '[data-testid="catalog-select-option"]',
  '[data-testid^="catalog-select-"][data-testid$="-option"]',
  '[data-testid*="catalog"][data-testid$="dropdown-row-button"]',
  '[data-testid*="catalog"][data-testid$="-row-button"]',
  '[data-testid*="catalog"][data-testid$="-row"]',
  '.web_ui__Cell__cell[role="button"]',
  'button[data-testid*="catalog"]',
  'li[data-testid*="catalog"]',
  '[role="option"]',
];

type CategoryOption = {
  clickable: HTMLElement;
  raw: string;
  normalized: string;
};

function isLikelyBreadcrumbOrSelected(el: HTMLElement): boolean {
  const attr = (value: string | null | undefined) => value?.toLowerCase() ?? '';
  const role = attr(el.getAttribute('role'));
  const ariaSelected = attr(el.getAttribute('aria-selected'));
  if (ariaSelected === 'true' && role !== 'option' && role !== 'treeitem') {
    return true;
  }
  const testId = attr(el.getAttribute('data-testid'));
  if (testId.includes('breadcrumb') || testId.includes('selected') || testId.includes('summary')) {
    return true;
  }
  const className = typeof el.className === 'string' ? el.className.toLowerCase() : '';
  if (
    className.includes('breadcrumb') ||
    className.includes('selected') ||
    className.includes('summary')
  ) {
    return true;
  }
  const ownerWithTestId = el.closest('[data-testid]') as HTMLElement | null;
  if (ownerWithTestId && ownerWithTestId !== el) {
    const ownerTestId = attr(ownerWithTestId.getAttribute('data-testid'));
    if (
      ownerTestId.includes('breadcrumb') ||
      ownerTestId.includes('selected') ||
      ownerTestId.includes('summary')
    ) {
      return true;
    }
  }
  return false;
}

function resolveCategoryContainers(rootSelector: string): Array<Document | HTMLElement> {
  const set = new Set<Document | HTMLElement>();
  if (rootSelector) {
    const primary = Array.from(document.querySelectorAll<HTMLElement>(rootSelector));
    primary.forEach((el) => set.add(el));
  }
  for (const extraSelector of CATEGORY_DROPDOWN_EXTRA_CONTAINERS) {
    const extras = Array.from(document.querySelectorAll<HTMLElement>(extraSelector));
    extras.forEach((el) => set.add(el));
  }

  // Chercher si des iframes same-origin contiennent les sélecteurs attendus
  const iframes = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe'));
  for (const iframe of iframes) {
    try {
      const doc = iframe.contentDocument;
      if (!doc) continue;
      // chercher rapidement si ce document contient des indices de dropdown
      const found =
        CATEGORY_DROPDOWN_EXTRA_CONTAINERS.some((sel) => !!doc.querySelector(sel)) ||
        CATEGORY_CLICKABLE_SELECTORS.some((sel) => !!doc.querySelector(sel));
      if (found) set.add(doc);
    } catch {
      // cross-origin ou inaccessible -> ignorer
    }
  }

  if (!set.size) {
    // Par défaut, inclure le document entier pour la recherche globale
    set.add(document);
  }
  return Array.from(set);
}

function extractCategoryOptionLabel(el: HTMLElement): string {
  for (const selector of CATEGORY_LABEL_SELECTORS) {
    const labelNode = el.querySelector<HTMLElement>(selector);
    const text = labelNode?.textContent?.trim();
    if (text) return text;
  }
  // Support aria-labelledby: resolver les ids référencés
  const labelled = el.getAttribute('aria-labelledby');
  if (labelled) {
    try {
      const ids = labelled.split(/\s+/).filter(Boolean);
      const parts: string[] = [];
      for (const id of ids) {
        const doc = el.ownerDocument || document;
        const node = doc.getElementById(id);
        if (node) {
          const t = node.textContent?.trim();
          if (t) parts.push(t);
        }
      }
      if (parts.length) return parts.join(' ');
    } catch {
      /* ignore */
    }
  }
  const aria = el.getAttribute('aria-label');
  if (aria?.trim()) return aria.trim();
  return el.textContent?.trim() ?? '';
}

function collectCategoryOptions(root: Document | HTMLElement): CategoryOption[] {
  const seen = new Set<HTMLElement>();
  const options: CategoryOption[] = [];
  const rootNode = root as Document | HTMLElement;
  const addOption = (clickable: HTMLElement | null) => {
    if (!clickable) return;
    if (seen.has(clickable)) return;
    if (isLikelyBreadcrumbOrSelected(clickable)) return;
    const raw = extractCategoryOptionLabel(clickable);
    const normalizedLabel = normalize(raw);
    if (!normalizedLabel) return;
    seen.add(clickable);
    options.push({ clickable, raw, normalized: normalizedLabel });
  };

  for (const selector of CATEGORY_LABEL_SELECTORS) {
    const labelNodes = Array.from(rootNode.querySelectorAll<HTMLElement>(selector));
    for (const labelNode of labelNodes) {
      const clickable = labelNode.closest<HTMLElement>(
        'button, [role="option"], li, [data-testid], .web_ui__Cell__cell[role="button"]',
      );
      addOption((clickable as HTMLElement) ?? labelNode);
    }
  }

  for (const selector of CATEGORY_CLICKABLE_SELECTORS) {
    const clickables = Array.from(rootNode.querySelectorAll<HTMLElement>(selector));
    for (const clickable of clickables) {
      addOption(clickable);
    }
  }

  // Fallback: si aucune option n'a été trouvée mais que root est document, tenter quelques selecteurs globaux
  if (!options.length && rootNode instanceof Document) {
    for (const selector of CATEGORY_CLICKABLE_SELECTORS.slice(0, 4)) {
      const clickables = Array.from(document.querySelectorAll<HTMLElement>(selector));
      for (const clickable of clickables) addOption(clickable);
      if (options.length) break;
    }
  }

  return options;
}

function isElementVisible(el: HTMLElement | null): boolean {
  if (!el) return false;
  try {
    const rect = el.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return false;
    const style = window.getComputedStyle(el);
    if (!style) return false;
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

function findCategoryMatchGlobally(wanted: string): HTMLElement | null {
  const root = document.body;
  if (!root) return null;
  const normalizedWanted = normalize(wanted);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let inspected = 0;
  const maxInspect = 6000;
  while (walker.nextNode() && inspected < maxInspect) {
    inspected += 1;
    const node = walker.currentNode;
    if (!(node instanceof HTMLElement)) continue;
    if (!isElementVisible(node)) continue;
    const text = node.textContent?.trim();
    if (!text) continue;
    const normalizedText = normalize(text);
    if (!normalizedText) continue;
    const matches =
      normalizedText === normalizedWanted ||
      normalizedText.includes(normalizedWanted) ||
      normalizedWanted.includes(normalizedText);
    if (!matches) continue;
    const clickable = node.closest<HTMLElement>(
      'button, [role="option"], [role="treeitem"], [role="menuitem"], [role="button"], li',
    );
    const target = clickable && isElementVisible(clickable) ? clickable : node;
    if (target && isElementVisible(target)) {
      return target;
    }
  }
  return null;
}

function collectCategoryTitles(rootSelector: string): string[] {
  const titleSelectors =
    '.web_ui__Cell__title, [data-testid$="--title"], [data-testid$="dropdown-row-label"], [data-testid$="option-label"], [data-testid$="option"], button[data-testid*="catalog"], [role="option"], li[data-testid*="catalog"]';
  const titles = new Set<string>();
  const scopes = resolveCategoryContainers(rootSelector);
  for (const scope of scopes) {
    const scopedTitles = Array.from(scope.querySelectorAll<HTMLElement>(titleSelectors));
    for (const element of scopedTitles) {
      const text = element.textContent?.trim();
      if (text) {
        titles.add(text);
      }
    }
  }
  if (!titles.size) {
    const globalTitles = Array.from(document.querySelectorAll<HTMLElement>(titleSelectors));
    for (const element of globalTitles) {
      const text = element.textContent?.trim();
      if (text) {
        titles.add(text);
      }
    }
  }
  return Array.from(titles).slice(0, 25);
}

function buildCategoryVariants(label: string): { normalized: string[]; searchTerms: string[] } {
  const base = normalize(label);
  const extras = CATEGORY_SYNONYMS[base] ?? [];
  const normalizedVariants = Array.from(
    new Set([base, ...extras.map((entry) => normalize(entry))]),
  );
  const searchTerms = Array.from(
    new Set([
      label,
      ...extras.map((entry) => entry.replace(/^(.)/, (m) => m.toUpperCase())),
      base.replace(/^(.)/, (m) => m.toUpperCase()),
    ]),
  ).filter(Boolean);
  return { normalized: normalizedVariants, searchTerms };
}

export async function selectCategoryPathMinimal(
  dropdownRootSelector: string,
  path: string[],
): Promise<{ steps: { label: string; ok: boolean }[]; allOk: boolean }> {
  const steps: { label: string; ok: boolean }[] = [];
  for (let i = 0; i < path.length; i++) {
    const raw = path[i];
    const label = raw ?? '';
    const variants = buildCategoryVariants(label);
    const targets = variants.normalized.length ? variants.normalized : [normalize(label)];
    let ok = false;
    const deadline = Date.now() + 1800;
    while (!ok && Date.now() < deadline) {
      const containers = resolveCategoryContainers(dropdownRootSelector);
      for (const target of targets) {
        if (containers.some((scope) => clickFirstMatch(scope, target))) {
          ok = true;
          break;
        }
        if (containers.some((scope) => clickFirstMatch(scope, target, { fuzzy: true }))) {
          ok = true;
          break;
        }
      }
      if (ok) break;
      await delay(90);
    }
    // Tentative recherche si toujours pas ok
    if (!ok) {
      const searchSelectors =
        '#catalog-search-input, [data-testid="catalog-select-search-input"], input[type="search"][name*="catalog" i], input[placeholder*="Recherche" i], input[placeholder*="Rechercher" i]';
      const searchSet = new Set<HTMLInputElement>();
      const containers = resolveCategoryContainers(dropdownRootSelector);
      for (const scope of containers) {
        const scoped = Array.from(scope.querySelectorAll<HTMLInputElement>(searchSelectors));
        scoped.forEach((node) => searchSet.add(node));
      }
      if (!searchSet.size) {
        const globals = Array.from(document.querySelectorAll<HTMLInputElement>(searchSelectors));
        globals.forEach((node) => searchSet.add(node));
      }
      const searches = Array.from(searchSet);
      for (const search of searches) {
        try {
          typeInputLikeUser(search, '', { commit: false });
          await delay(80);
          for (const query of [label, ...variants.searchTerms]) {
            typeInputLikeUser(search, query, { commit: false });
            search.dispatchEvent(new Event('input', { bubbles: true }));
            await delay(240);
            let localOk = false;
            for (const target of targets) {
              const scopes = resolveCategoryContainers(dropdownRootSelector);
              localOk =
                scopes.some((scope) => clickFirstMatch(scope, target)) ||
                scopes.some((scope) => clickFirstMatch(scope, target, { fuzzy: true }));
              if (localOk) break;
            }
            if (localOk) {
              ok = true;
              break;
            }
          }
        } catch {
          /* ignore */
        }
        if (ok) {
          break;
        }
      }
    }
    if (!ok) {
      try {
        const snapshot = resolveCategoryContainers(dropdownRootSelector)
          .flatMap((scope) => collectCategoryOptions(scope))
          .map((opt) => ({ raw: opt.raw, norm: opt.normalized }))
          .slice(0, 25);
        log('warn', 'category:options:snapshot', {
          label,
          wanted: targets,
          snapshot,
        });
      } catch {
        /* ignore */
      }

      try {
        const globalTarget = findCategoryMatchGlobally(label);
        if (globalTarget) {
          click(globalTarget);
          log('info', 'category:fallback:global', {
            label,
            tag: globalTarget.tagName,
            classes: globalTarget.className,
          });
          await delay(120);
          ok = true;
        }
      } catch {
        /* ignore */
      }

      // Loguer les 25 premiers titres disponibles pour diagnostic
      try {
        const titles = collectCategoryTitles(dropdownRootSelector);
        log('warn', 'category:step:unmatched', {
          label,
          wanted: targets,
          titles,
        });
      } catch {
        /* ignore */
      }
    }
    steps.push({ label, ok });
    log('debug', 'category:min:step', { label, ok, index: i });
    if (!ok) break;
    // Attendre apparition éventuelle d'une nouvelle colonne (signature titres change)
    await delay(120);
  }
  const allOk = steps.length === path.length && steps.every((s) => s.ok);
  log('info', 'category:min:summary', { allOk, steps });
  return { steps, allOk };
}

function clickFirstMatch(
  root: Document | HTMLElement,
  wanted: string,
  opts: { fuzzy?: boolean; allowGlobalFallback?: boolean } = {},
): boolean {
  const options = collectCategoryOptions(root);
  const normalizedWanted = normalize(wanted);
  const allowGlobal =
    opts.allowGlobalFallback !== false && typeof document !== 'undefined' && root !== document;

  if (!options.length) {
    if (allowGlobal) {
      return clickFirstMatch(document, wanted, {
        fuzzy: opts.fuzzy,
        allowGlobalFallback: false,
      });
    }
    return false;
  }

  const exact = options.find((opt) => opt.normalized === normalizedWanted);
  if (exact) {
    click(exact.clickable);
    return true;
  }

  if (opts.fuzzy) {
    const fuzzy = options.find((opt) => {
      const txt = opt.normalized;
      return (
        txt === normalizedWanted ||
        txt.startsWith(normalizedWanted) ||
        normalizedWanted.startsWith(txt) ||
        txt.includes(normalizedWanted) ||
        normalizedWanted.includes(txt)
      );
    });
    if (fuzzy) {
      click(fuzzy.clickable);
      return true;
    }
  }

  if (allowGlobal) {
    return clickFirstMatch(document, wanted, {
      fuzzy: opts.fuzzy,
      allowGlobalFallback: false,
    });
  }

  return false;
}

export async function openCategoryDropdown(): Promise<{ input: HTMLInputElement | null }> {
  const input = await waitForElement<HTMLInputElement>(
    'input[name="category"], #category, [data-testid="catalog-select-dropdown-input"], [data-testid="catalog-select-input"], [data-testid*="catalog"][data-testid$="dropdown-input"], [data-testid*="catalog"][data-testid$="-input"]',
    { timeoutMs: 4000 },
  );
  if (!input) return { input: null };
  const chevron = input.parentElement?.querySelector(
    '[data-testid="catalog-select-dropdown-chevron-down"], [data-testid="catalog-select-dropdown-chevron-up"]',
  ) as HTMLElement | null;
  (chevron || input).click();
  await waitForElement(
    '[data-testid="catalog-select-dropdown-content"], [data-testid="catalog-select-panel"], [data-testid*="catalog"][data-testid$="dropdown-content"], [data-testid*="catalog"][data-testid$="-panel"]',
    { timeoutMs: 3000 },
  );
  return { input };
}

// Stubs simples pour compatibilité avec filler.ts (on redirige vers la version minimale)
export const selectCategoryPathDeterministic = async (
  dropdownRootSelector: string,
  path: string[],
) => {
  const res = await selectCategoryPathMinimal(dropdownRootSelector, path);
  return {
    steps: res.steps.map((s, i) => ({
      label: s.label,
      ok: s.ok,
      isLast: i === path.length - 1,
      mode: 'min',
    })),
    allOk: res.allOk,
    runId: 'min',
  };
};

export const selectCategoryPathSimple = async (dropdownRootSelector: string, path: string[]) => {
  const res = await selectCategoryPathMinimal(dropdownRootSelector, path);
  return {
    steps: res.steps.map((s, i) => ({ label: s.label, ok: s.ok, isLast: i === path.length - 1 })),
    allOk: res.allOk,
  };
};

export const waitAndClickCategory = async (dropdownRootSelector: string, label: string) => {
  const root = (document.querySelector(dropdownRootSelector) as HTMLElement) ?? document.body;
  return clickFirstMatch(root, normalize(label));
};

export async function waitForCategoryCommit(
  input: HTMLInputElement,
  expectedLeaf: string,
): Promise<boolean> {
  const wanted = normalize(expectedLeaf);
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const val = normalize(input.value || '');
    if (val.includes(wanted)) return true;
    await delay(90);
  }
  return false;
}

export async function waitForUnisexCheckbox() {
  return document.querySelector<HTMLInputElement>('input[type="checkbox"][name*="unisex" i]');
}

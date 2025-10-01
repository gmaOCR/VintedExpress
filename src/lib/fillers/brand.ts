import type { RepublishDraft } from '../../types/draft';
import { getTimeout } from '../config';
import { blurInput, click, setInputValue, waitForElement } from '../dom-utils';
import {
  forceCloseDropdown,
  openDropdown,
  selectFromDropdownByText,
  selectFromDropdownByTitle,
  selectSingleByEnter,
} from '../dropdown';
import { NO_BRAND_SYNONYMS } from '../i18n';
import { log } from '../metrics';

const BRAND_INPUT_SELECTOR = [
  'input[name="brand"]',
  '#brand',
  '[data-testid="brand-select-dropdown-input"]',
  '[data-testid="brand-multi-list-dropdown-input"]',
  '[data-testid="brand-select-input"]',
  '[data-testid="brand-input"]',
  '[data-testid*="brand"][data-testid$="dropdown-input"]',
  '[data-testid*="brand"][data-testid$="combobox-input"]',
  '[data-testid*="brand"][data-testid$="-input"]',
  '[data-testid*="brand"] input',
].join(', ');

const BRAND_CHEVRON_SELECTOR =
  '[data-testid="brand-select-dropdown-chevron-down"], [data-testid="brand-select-dropdown-chevron-up"], [data-testid*="brand"][data-testid$="dropdown-chevron-down"], [data-testid*="brand"][data-testid$="dropdown-chevron-up"], [data-testid*="brand"][data-testid$="combobox-chevron-down"], [data-testid*="brand"][data-testid$="combobox-chevron-up"]';

const BRAND_CONTENT_SELECTOR =
  '[data-testid="brand-select-dropdown-content"], [data-testid="brand-multi-list-dropdown-content"], [data-testid*="brand"][data-testid$="dropdown-content"], [data-testid*="brand"][data-testid$="combobox-content"], [data-testid*="brand"][data-testid$="-content"]';

const BRAND_SEARCH_SELECTOR =
  '#brand-search-input, [data-testid="brand-select-dropdown-content"] input[type="search"], [data-testid="brand-multi-list-dropdown-content"] input[type="search"], [data-testid*="brand"][data-testid$="search-input"], [data-testid*="brand"][data-testid$="search"] input[type="search"]';

async function waitForInputValueEquals(
  input: HTMLInputElement,
  expected: string,
  timeoutMs = 1200,
): Promise<boolean> {
  const norm = (s: string) => (s || '').trim();
  const target = norm(expected);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (norm(input.value) === target) return true;
    await new Promise((r) => setTimeout(r, 40));
  }
  return norm(input.value) === target;
}

async function selectBrandEmptyById(): Promise<boolean> {
  const sel = {
    inputSelector: BRAND_INPUT_SELECTOR,
    chevronSelector: BRAND_CHEVRON_SELECTOR,
    contentSelector: BRAND_CONTENT_SELECTOR,
  } as const;
  const input = await waitForElement<HTMLInputElement>(sel.inputSelector);
  if (!input) return false;
  const chevron = (input.parentElement?.querySelector(sel.chevronSelector!) as HTMLElement) || null;
  click(chevron || input);
  await waitForElement<HTMLElement>(sel.contentSelector!, {
    timeoutMs: Math.min(1500, getTimeout('wait.dropdown.content')),
  });
  const el =
    (document.getElementById('empty-brand') as HTMLElement | null) ||
    (document.querySelector('#empty-brand') as HTMLElement | null);
  if (el) {
    click(el);
    // document.body.click() SUPPRIMÉ - peut causer reset
    return true;
  }
  return false;
}

async function selectBrandNoBrandQuick(): Promise<boolean> {
  const sel = {
    inputSelector: BRAND_INPUT_SELECTOR,
    chevronSelector: BRAND_CHEVRON_SELECTOR,
    contentSelector: BRAND_CONTENT_SELECTOR,
  } as const;
  const fast = await selectBrandEmptyById();
  if (fast) return true;
  const { input, root } = await openDropdown(sel);
  if (!input) return false;
  const deadline = Date.now() + Math.min(600, getTimeout('wait.dropdown.commit'));
  while (Date.now() < deadline) {
    const options = Array.from(
      (root as HTMLElement | Document).querySelectorAll<HTMLElement>(
        '[role="option"], .web_ui__Cell__cell[role="button"], li, button',
      ),
    );
    const found = options.find((n) => {
      const txt = (n.textContent || '').toLowerCase().trim();
      return NO_BRAND_SYNONYMS.some((syn) => txt === syn.toLowerCase());
    });
    if (found) {
      click(found);
      // document.body.click() SUPPRIMÉ - peut causer reset
      return true;
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  return false;
}

async function selectBrandNoBrand(): Promise<boolean> {
  const sel = {
    inputSelector: BRAND_INPUT_SELECTOR,
    chevronSelector: BRAND_CHEVRON_SELECTOR,
    contentSelector: BRAND_CONTENT_SELECTOR,
    searchSelector: BRAND_SEARCH_SELECTOR,
  } as const;
  const input = await waitForElement<HTMLInputElement>(sel.inputSelector);
  if (!input) return false;
  const chevron = (input.parentElement?.querySelector(sel.chevronSelector!) as HTMLElement) || null;
  click(chevron || input);
  await waitForElement<HTMLElement>(sel.contentSelector!, {
    timeoutMs: Math.min(2500, getTimeout('wait.dropdown.content')),
  });
  // Si aucun champ de recherche n'est présent, éviter une boucle coûteuse: cliquer le dernier élément
  const hasSearch = !!document.querySelector(sel.searchSelector!);
  if (!hasSearch) {
    const options = Array.from(
      document.querySelectorAll<HTMLElement>('[role="option"], .web_ui__Cell__cell[role="button"]'),
    );
    const last = options[options.length - 1];
    if (last) {
      click(last);
      // document.body.click() SUPPRIMÉ - peut causer reset
      return true;
    }
  }
  for (const name of NO_BRAND_SYNONYMS) {
    const ok =
      (await selectFromDropdownByText(sel, name)) ||
      (await selectFromDropdownByTitle(
        {
          inputSelector: sel.inputSelector,
          chevronSelector: sel.chevronSelector,
          contentSelector: sel.contentSelector,
        },
        name,
      ));
    if (ok) return true;
  }
  const options = Array.from(
    document.querySelectorAll<HTMLElement>('[role="option"], .web_ui__Cell__cell[role="button"]'),
  );
  const last = options[options.length - 1];
  if (last) {
    click(last);
    // document.body.click() SUPPRIMÉ - peut causer reset
    return true;
  }
  return false;
}

export async function fillBrand(draft: RepublishDraft): Promise<void> {
  try {
    log('info', 'brand:start', { raw: draft.brand });
  } catch {
    /* ignore */
  }
  const rootSel = BRAND_INPUT_SELECTOR;
  const root = await waitForElement<HTMLInputElement>(rootSel, { timeoutMs: 6000 });
  if (!root) {
    log('debug', 'brand:input:not-found');
    return;
  }
  log('debug', 'brand:input:found');

  let ok = false;
  const wantNoBrand = !draft.brand || draft.brand.trim() === '';
  if (wantNoBrand) {
    log('debug', 'brand:want:no-brand');
    ok =
      (await selectBrandEmptyById()) ||
      (await selectBrandNoBrandQuick()) ||
      (await selectBrandNoBrand());
    log('debug', 'brand:no-brand:selection', ok);
  } else if (draft.brand) {
    const wanted = draft.brand;
    // 1) Essayer via recherche + Enter (plus rapide quand dispo)
    log('debug', 'brand:strategy:enter', wanted);
    ok = await selectSingleByEnter(
      {
        inputSelector: rootSel,
        chevronSelector: BRAND_CHEVRON_SELECTOR,
        contentSelector: BRAND_CONTENT_SELECTOR,
        searchSelector: BRAND_SEARCH_SELECTOR,
      },
      draft.brand,
    );
    // 2) Titre strict puis texte approché
    log('debug', 'brand:select:enter', ok);
    if (!ok) log('debug', 'brand:strategy:text/title');
    if (!ok)
      ok =
        (await selectFromDropdownByText(
          {
            inputSelector: rootSel,
            chevronSelector: BRAND_CHEVRON_SELECTOR,
            contentSelector: BRAND_CONTENT_SELECTOR,
            searchSelector: BRAND_SEARCH_SELECTOR,
          },
          wanted,
        )) ||
        (await selectFromDropdownByTitle(
          {
            inputSelector: rootSel,
            chevronSelector: BRAND_CHEVRON_SELECTOR,
            contentSelector: BRAND_CONTENT_SELECTOR,
          },
          wanted,
        ));
  }
  if (!wantNoBrand && draft.brand && draft.brand.trim()) {
    const committed = await waitForInputValueEquals(root, draft.brand, 1200);
    log('debug', 'brand:committed', committed, 'value', root.value);
    if (!committed) {
      // Fallback explicite: assigner la valeur brute (mode e2e ou dernière chance)
      try {
        setInputValue(root, draft.brand);
        blurInput(root);
        ok = true;
        log('warn', 'brand:fallback:setInputValue');
      } catch {
        log('warn', 'brand:fallback:setInputValue:failed');
        /* ignore */
      }
    }
  }
  // Assurer la fermeture du menu si encore ouvert
  try {
    await forceCloseDropdown(root, BRAND_CHEVRON_SELECTOR, BRAND_CONTENT_SELECTOR);
  } catch {
    /* ignore */
  }
  log('debug', 'brand:done', { success: ok, finalValue: root.value, wantNoBrand });
  void ok;
}

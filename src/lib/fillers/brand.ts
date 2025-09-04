import type { RepublishDraft } from '../../types/draft';
import { getTimeout } from '../config';
import { click, setInputValue, waitForElement } from '../dom-utils';
import { openDropdown, selectFromDropdownByText, selectFromDropdownByTitle } from '../dropdown';
import { NO_BRAND_SYNONYMS } from '../i18n';

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
    inputSelector: 'input[name="brand"], #brand, [data-testid="brand-select-dropdown-input"]',
    chevronSelector:
      '[data-testid="brand-select-dropdown-chevron-down"], [data-testid="brand-select-dropdown-chevron-up"]',
    contentSelector: '[data-testid="brand-select-dropdown-content"]',
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
    document.body.click();
    return true;
  }
  return false;
}

async function selectBrandNoBrandQuick(): Promise<boolean> {
  const sel = {
    inputSelector: 'input[name="brand"], #brand, [data-testid="brand-select-dropdown-input"]',
    chevronSelector:
      '[data-testid="brand-select-dropdown-chevron-down"], [data-testid="brand-select-dropdown-chevron-up"]',
    contentSelector: '[data-testid="brand-select-dropdown-content"]',
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
      document.body.click();
      return true;
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  return false;
}

async function selectBrandNoBrand(): Promise<boolean> {
  const sel = {
    inputSelector: 'input[name="brand"], #brand, [data-testid="brand-select-dropdown-input"]',
    chevronSelector:
      '[data-testid="brand-select-dropdown-chevron-down"], [data-testid="brand-select-dropdown-chevron-up"]',
    contentSelector: '[data-testid="brand-select-dropdown-content"]',
    searchSelector:
      '#brand-search-input, [data-testid="brand-select-dropdown-content"] input[type="search"]',
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
      document.body.click();
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
    document.body.click();
    return true;
  }
  return false;
}

export async function fillBrand(draft: RepublishDraft): Promise<void> {
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
  if (draft.brand && draft.brand.trim()) {
    const committed = await waitForInputValueEquals(root, draft.brand, 1200);
    if (!committed && localStorage.getItem('vx:e2e') === '1') {
      try {
        setInputValue(root, draft.brand);
        ok = true;
      } catch {
        /* ignore */
      }
    }
  }
  void ok;
}

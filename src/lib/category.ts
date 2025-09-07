import { click, delay, normalize, waitForElement } from './dom-utils';
import { log } from './metrics';

// =====================
// Logique catégorie MINIMALE
// =====================

export async function selectCategoryPathMinimal(
  dropdownRootSelector: string,
  path: string[],
): Promise<{ steps: { label: string; ok: boolean }[]; allOk: boolean }> {
  const rootSel = dropdownRootSelector;
  const container = (document.querySelector(rootSel) as HTMLElement) ?? document.body;
  const steps: { label: string; ok: boolean }[] = [];
  for (let i = 0; i < path.length; i++) {
    const raw = path[i];
    const label = raw ?? '';
    const wanted = normalize(label);
    let ok = false;
    const deadline = Date.now() + 1800;
    while (!ok && Date.now() < deadline) {
      ok = clickFirstMatch(container, wanted);
      if (ok) break;
      // Fuzzy tentative si pas trouvé strictement (accents / casse gérés par normalize déjà)
      ok = clickFirstMatch(container, wanted, { fuzzy: true });
      if (ok) break;
      await delay(90);
    }
    // Tentative recherche si toujours pas ok
    if (!ok) {
      const search = container.querySelector<HTMLInputElement>('#catalog-search-input');
      if (search) {
        try {
          search.value = '';
          search.dispatchEvent(new Event('input', { bubbles: true }));
          await delay(30);
          search.value = label;
          search.dispatchEvent(new Event('input', { bubbles: true }));
          await delay(220);
          ok =
            clickFirstMatch(container, wanted) ||
            clickFirstMatch(container, wanted, { fuzzy: true });
        } catch {
          /* ignore */
        }
      }
    }
    if (!ok) {
      // Loguer les 25 premiers titres disponibles pour diagnostic
      try {
        const titles = Array.from(
          container.querySelectorAll<HTMLElement>('.web_ui__Cell__title, [data-testid$="--title"]'),
        )
          .slice(0, 25)
          .map((t) => t.textContent?.trim() || '');
        log('warn', 'category:step:unmatched', { label, wanted, titles });
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
  root: HTMLElement,
  wanted: string,
  opts: { fuzzy?: boolean } = {},
): boolean {
  const titles = Array.from(
    root.querySelectorAll<HTMLElement>('.web_ui__Cell__title, [data-testid$="--title"]'),
  );
  const match = titles.find((t) => {
    const txt = normalize(t.textContent || '');
    if (opts.fuzzy)
      return (
        txt === wanted ||
        txt.startsWith(wanted) ||
        wanted.startsWith(txt) ||
        txt.includes(wanted) ||
        wanted.includes(txt)
      );
    return txt === wanted;
  });
  if (!match) return false;
  const clickable = match.closest<HTMLElement>(
    '.web_ui__Cell__cell[role="button"], [role="option"], li, button',
  );
  if (!clickable) return false;
  click(clickable);
  return true;
}

export async function openCategoryDropdown(): Promise<{ input: HTMLInputElement | null }> {
  const input = await waitForElement<HTMLInputElement>(
    'input[name="category"], #category, [data-testid="catalog-select-dropdown-input"]',
    { timeoutMs: 4000 },
  );
  if (!input) return { input: null };
  const chevron = input.parentElement?.querySelector(
    '[data-testid="catalog-select-dropdown-chevron-down"], [data-testid="catalog-select-dropdown-chevron-up"]',
  ) as HTMLElement | null;
  (chevron || input).click();
  await waitForElement('[data-testid="catalog-select-dropdown-content"]', { timeoutMs: 3000 });
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

import { click, delay, normalize, waitForElement } from './dom-utils';
import { log } from './metrics';

// =====================
// Logique catégorie MINIMALE
// =====================

export async function selectCategoryPathMinimal(
  dropdownRootSelector: string,
  path: string[],
): Promise<{ steps: { label: string; ok: boolean }[]; allOk: boolean }> {
  const root = (document.querySelector(dropdownRootSelector) as HTMLElement) ?? document.body;
  const steps: { label: string; ok: boolean }[] = [];
  for (const label of path) {
    const wanted = normalize(label);
    let ok = clickFirstMatch(root, wanted);
    if (!ok) {
      const search = root.querySelector<HTMLInputElement>('#catalog-search-input');
      if (search) {
        try {
          search.value = '';
          search.dispatchEvent(new Event('input', { bubbles: true }));
          await delay(20);
          search.value = label;
          search.dispatchEvent(new Event('input', { bubbles: true }));
          await delay(140);
          ok = clickFirstMatch(root, wanted);
        } catch {
          /* ignore */
        }
      }
    }
    steps.push({ label, ok });
    log('debug', 'category:min:step', { label, ok });
    if (!ok) break;
    await delay(80); // laisser apparaître la colonne suivante
  }
  const allOk = steps.length === path.length && steps.every((s) => s.ok);
  log('info', 'category:min:summary', { allOk, steps });
  return { steps, allOk };
}

function clickFirstMatch(root: HTMLElement, wanted: string): boolean {
  const titles = Array.from(
    root.querySelectorAll<HTMLElement>('.web_ui__Cell__title, [data-testid$="--title"]'),
  );
  const match = titles.find((t) => normalize(t.textContent || '') === wanted);
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

import { click, delay, normalize, waitForElement } from './dom-utils';
import { waitForTitlesChange } from './dropdown';

export async function waitAndClickCategory(
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

export async function tryCatalogSearch(label: string) {
  const search = (await waitForElement<HTMLInputElement>('#catalog-search-input', {
    timeoutMs: 800,
  })) as HTMLInputElement | null;
  if (search) {
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(30);
    search.value = label;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(60);
  }
}

export async function waitForCategoryCommit(
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
      if (val === norm(expected)) return true;
    } else {
      if (val === norm(expected)) return true;
    }
    if (dropdownRootSelector) {
      const drop = document.querySelector(dropdownRootSelector) as HTMLElement | null;
      if (drop) {
        void getComputedStyle(drop);
      }
    }
    await delay(50);
  }
  const val = norm(input.value || '');
  if (opts.mode === 'leaf') return val === norm(expected);
  return val === norm(expected);
}

export async function waitForUnisexCheckbox(opts?: {
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

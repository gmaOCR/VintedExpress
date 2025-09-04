import { click, delay, normalize, waitForElement, waitForGone } from './dom-utils';

export async function openDropdown(sel: {
  inputSelector: string;
  chevronSelector?: string;
  contentSelector?: string;
}): Promise<{ input: HTMLInputElement | null; root: HTMLElement | Document }> {
  const input = (await waitForElement<HTMLInputElement>(
    sel.inputSelector,
  )) as HTMLInputElement | null;
  if (!input) return { input: null, root: document };
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

export async function forceCloseDropdown(
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
  if (chevron) {
    click(chevron);
    if (contentSelector) {
      await waitForGone(contentSelector, 800);
      if (!document.querySelector(contentSelector)) return;
    }
  }
  try {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
  } catch {
    // ignore
  }
  await import('./dom-utils').then((m) => m.clickInTheVoid());
  if (contentSelector) {
    await waitForGone(contentSelector, 800);
    const still = document.querySelector(contentSelector) as HTMLElement | null;
    if (still) {
      try {
        still.style.display = 'none';
        still.style.visibility = 'hidden';
        still.style.opacity = '0';
        still.style.pointerEvents = 'none';
        still.setAttribute('hidden', 'true');
        still.setAttribute('aria-hidden', 'true');
      } catch {
        // ignore
      }
    }
  }
}

export async function waitForTitlesChange(
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

export async function selectFromDropdownByTitle(
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

export async function selectFromDropdownByText(
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
      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await delay(30);
      search.value = label;
      search.dispatchEvent(new Event('input', { bubbles: true }));
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

export async function selectSingleByEnter(
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

  search.value = '';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  await delay(10);
  search.value = label;
  search.dispatchEvent(new Event('input', { bubbles: true }));
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

export async function multiSelectByTitles(
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

export async function multiSelectByTitlesLoose(
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

export async function multiSelectByEnter(
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

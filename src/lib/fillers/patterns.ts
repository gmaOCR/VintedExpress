import type { RepublishDraft } from '../../types/draft';
import { waitForElement } from '../dom-utils';
import { forceCloseDropdown, multiSelectByEnter, multiSelectByTitles } from '../dropdown';

export async function fillPatterns(draft: RepublishDraft): Promise<void> {
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
  await multiSelectByEnter(sel, draft.patterns, { optional: true });
  await multiSelectByTitles(sel, draft.patterns, { optional: true });
  try {
    await forceCloseDropdown(root, sel.chevronSelector, sel.contentSelector);
  } catch {
    /* ignore */
  }
}

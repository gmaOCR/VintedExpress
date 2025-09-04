import type { RepublishDraft } from '../../types/draft';
import { waitForElement } from '../dom-utils';
import { selectFromDropdownByTitle, selectSingleByEnter } from '../dropdown';

export async function fillSize(draft: RepublishDraft): Promise<void> {
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
  await selectSingleByEnter(sel, draft.size);
  await selectFromDropdownByTitle(
    {
      inputSelector: sel.inputSelector,
      chevronSelector: sel.chevronSelector,
      contentSelector: sel.contentSelector,
    },
    draft.size,
  );
}

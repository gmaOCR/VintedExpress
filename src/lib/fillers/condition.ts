import type { RepublishDraft } from '../../types/draft';
import { waitForElement } from '../dom-utils';
import { selectFromDropdownByTitle, selectSingleByEnter } from '../dropdown';
import { normalizeCondition } from '../i18n';

export async function fillCondition(draft: RepublishDraft): Promise<void> {
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
  const wanted = normalizeCondition(draft.condition);
  await selectSingleByEnter(sel, wanted);
  await selectFromDropdownByTitle(
    {
      inputSelector: sel.inputSelector,
      chevronSelector: sel.chevronSelector,
      contentSelector: sel.contentSelector,
    },
    wanted,
  );
}

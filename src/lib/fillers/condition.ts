import type { RepublishDraft } from '../../types/draft';
import { blurInput, setInputValue, waitForElement } from '../dom-utils';
import { forceCloseDropdown, selectFromDropdownByTitle } from '../dropdown';
import { log } from '../metrics';

export async function fillCondition(draft: RepublishDraft): Promise<void> {
  if (!draft.condition) return;

  const sel = {
    inputSelector:
      'input[name="condition"], #condition, [data-testid="condition-select-dropdown-input"], [data-testid="condition-v2-dropdown-input"], [data-testid*="condition"][data-testid$="dropdown-input"]',
  } as const;

  const root = await waitForElement<HTMLInputElement>(sel.inputSelector, { timeoutMs: 6000 });
  if (!root) {
    log('debug', 'condition:input:not-found');
    return;
  }

  try {
    const selObj = {
      inputSelector: sel.inputSelector,
      chevronSelector:
        '[data-testid="condition-select-dropdown-chevron-down"], [data-testid="condition-select-dropdown-chevron-up"], [data-testid*="condition"][data-testid$="dropdown-chevron-down"], [data-testid*="condition"][data-testid$="dropdown-chevron-up"], .c-input__icon',
      contentSelector:
        '[data-testid="condition-select-dropdown-content"], .input-dropdown, [data-testid*="condition"][data-testid$="dropdown-content"]',
    } as const;

    let committed = false;
    try {
      committed = await selectFromDropdownByTitle(selObj, draft.condition);
    } catch {
      committed = false;
    }

    if (!committed) {
      setInputValue(root, draft.condition);
      blurInput(root);
    }

    try {
      await forceCloseDropdown(root, selObj.chevronSelector, selObj.contentSelector);
    } catch {
      /* ignore */
    }
    log('info', 'condition:done', { finalValue: root.value });
  } catch (e) {
    log('warn', 'condition:error', { message: (e as Error)?.message });
  }
}

import type { RepublishDraft } from '../../types/draft';
import { blurInput, setInputValue, waitForElement } from '../dom-utils';
import { forceCloseDropdown, selectFromDropdownByTitle } from '../dropdown';
import { log } from '../metrics';

export async function fillSize(draft: RepublishDraft): Promise<void> {
  if (!draft.size) return;

  const sel = {
    inputSelector:
      'input[name="size"], #size, [data-testid="size-select-dropdown-input"], [data-testid="size-combobox-input"], [data-testid*="size"][data-testid$="dropdown-input"], [data-testid*="size"][data-testid$="combobox-input"]',
  } as const;

  const root = await waitForElement<HTMLInputElement>(sel.inputSelector, { timeoutMs: 6000 });
  if (!root) {
    log('debug', 'size:input:not-found');
    return;
  }

  try {
    const selObj = {
      inputSelector: sel.inputSelector,
      chevronSelector:
        '[data-testid="size-select-dropdown-chevron-down"], [data-testid="size-select-dropdown-chevron-up"], [data-testid*="size"][data-testid$="dropdown-chevron-down"], [data-testid*="size"][data-testid$="dropdown-chevron-up"], .c-input__icon',
      contentSelector:
        '[data-testid="size-select-dropdown-content"], .input-dropdown, [data-testid*="size"][data-testid$="dropdown-content"]',
    } as const;

    // Prefer clicking the option in the dropdown so React state is updated
    let committed = false;
    try {
      committed = await selectFromDropdownByTitle(selObj, draft.size);
    } catch {
      committed = false;
    }

    if (!committed) {
      // Fallback: set the input value and blur (last resort)
      setInputValue(root, draft.size);
      blurInput(root);
    }

    try {
      await forceCloseDropdown(root, selObj.chevronSelector, selObj.contentSelector);
    } catch {
      /* ignore */
    }
    log('info', 'size:done', { finalValue: root.value });
  } catch (e) {
    log('warn', 'size:error', { message: (e as Error)?.message });
  }
}

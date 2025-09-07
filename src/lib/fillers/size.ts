import type { RepublishDraft } from '../../types/draft';
import { blurInput, waitForElement } from '../dom-utils';
import { forceCloseDropdown, selectFromDropdownByTitle, selectSingleByEnter } from '../dropdown';
import { log } from '../metrics';

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
  if (!root) {
    log('debug', 'size:input:not-found');
    return;
  }
  log('debug', 'size:input:found');
  let ok = await selectSingleByEnter(sel, draft.size);
  log('debug', 'size:selectSingleByEnter', ok);
  if (!ok)
    ok = await selectFromDropdownByTitle(
      {
        inputSelector: sel.inputSelector,
        chevronSelector: sel.chevronSelector,
        contentSelector: sel.contentSelector,
      },
      draft.size,
    );
  log('debug', 'size:selectByTitle', ok);
  if (!ok) {
    try {
      root.value = draft.size;
      root.dispatchEvent(new Event('input', { bubbles: true }));
      root.dispatchEvent(new Event('change', { bubbles: true }));
      blurInput(root);
      ok = true;
      log('warn', 'size:fallback:setInputValue');
    } catch {
      log('warn', 'size:fallback:setInputValue:failed');
    }
  }
  try {
    await forceCloseDropdown(root, sel.chevronSelector, sel.contentSelector);
  } catch {
    /* ignore */
  }
  // Force value si succès logique mais input resté vide
  if (ok && !root.value) {
    try {
      const selectedTitle = document
        .querySelector<HTMLElement>(
          '[data-testid="size-select-dropdown-content"] .web_ui__Cell__cell.is-selected .web_ui__Cell__title',
        )
        ?.textContent?.trim();
      const candidate = selectedTitle || draft.size;
      if (candidate) {
        root.value = candidate;
        root.dispatchEvent(new Event('input', { bubbles: true }));
        root.dispatchEvent(new Event('change', { bubbles: true }));
        blurInput(root);
        log('debug', 'size:forceValue', { candidate });
      }
    } catch {
      /* ignore */
    }
  }
  log('debug', 'size:done', { success: ok, finalValue: root.value });
}

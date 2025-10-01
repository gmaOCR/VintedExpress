import type { RepublishDraft } from '../../types/draft';
import { blurInput, waitForElement } from '../dom-utils';
import { forceCloseDropdown, selectFromDropdownByTitle, selectSingleByEnter } from '../dropdown';
import { normalizeCondition } from '../i18n';
import { log } from '../metrics';

export async function fillCondition(draft: RepublishDraft): Promise<void> {
  if (!draft.condition) return;
  const sel = {
    inputSelector:
      'input[name="condition"], #condition, [data-testid="condition-select-dropdown-input"], [data-testid="condition-v2-dropdown-input"], [data-testid*="condition"][data-testid$="dropdown-input"], [data-testid*="condition"][data-testid$="combobox-input"], [data-testid*="condition"][data-testid$="-input"]',
    chevronSelector:
      '[data-testid="condition-select-dropdown-chevron-down"], [data-testid="condition-select-dropdown-chevron-up"], [data-testid*="condition"][data-testid$="dropdown-chevron-down"], [data-testid*="condition"][data-testid$="dropdown-chevron-up"], [data-testid*="condition"][data-testid$="combobox-chevron-down"], [data-testid*="condition"][data-testid$="combobox-chevron-up"]',
    contentSelector:
      '[data-testid="condition-select-dropdown-content"], [data-testid="condition-v2-dropdown-content"], [data-testid*="condition"][data-testid$="dropdown-content"], [data-testid*="condition"][data-testid$="combobox-content"], [data-testid*="condition"][data-testid$="-content"]',
    searchSelector:
      '[data-testid="condition-select-dropdown-content"] input[type="search"], [data-testid="condition-v2-dropdown-content"] input[type="search"], [data-testid*="condition"][data-testid$="search-input"], [data-testid*="condition"][data-testid$="search"] input',
  } as const;
  const root = await waitForElement<HTMLInputElement>(sel.inputSelector, { timeoutMs: 6000 });
  if (!root) {
    log('debug', 'condition:input:not-found');
    return;
  }
  log('debug', 'condition:input:found');
  const wanted = normalizeCondition(draft.condition);

  // Pré-semer la valeur immédiatement
  if (!root.value && wanted) {
    try {
      root.value = wanted;
      root.dispatchEvent(new Event('input', { bubbles: true }));
      root.dispatchEvent(new Event('change', { bubbles: true }));
      log('debug', 'condition:preseed', { value: root.value });
    } catch {
      /* ignore */
    }
  }

  let ok = await selectSingleByEnter(sel, wanted);
  log('debug', 'condition:selectSingleByEnter', ok);
  if (!ok)
    ok = await selectFromDropdownByTitle(
      {
        inputSelector: sel.inputSelector,
        chevronSelector: sel.chevronSelector,
        contentSelector: sel.contentSelector,
      },
      wanted,
    );
  log('debug', 'condition:selectByTitle', ok);
  if (!ok) {
    try {
      root.value = wanted;
      root.dispatchEvent(new Event('input', { bubbles: true }));
      root.dispatchEvent(new Event('change', { bubbles: true }));
      blurInput(root);
      ok = true;
      log('warn', 'condition:fallback:setInputValue');
    } catch {
      log('warn', 'condition:fallback:setInputValue:failed');
    }
  }

  log('debug', 'condition:post-initial-phase', { ok, current: root.value });

  // Si succès logique mais valeur vide, forcer
  if (ok && !root.value) {
    try {
      root.value = wanted;
      root.dispatchEvent(new Event('input', { bubbles: true }));
      root.dispatchEvent(new Event('change', { bubbles: true }));
      blurInput(root);
      log('warn', 'condition:forceValue:immediate', { candidate: wanted });
    } catch {
      /* ignore */
    }
  }

  try {
    await forceCloseDropdown(root, sel.chevronSelector, sel.contentSelector);
  } catch {
    /* ignore */
  }

  // Dernier filet de sécurité
  if (!root.value && wanted) {
    try {
      root.value = wanted;
      root.dispatchEvent(new Event('input', { bubbles: true }));
      root.dispatchEvent(new Event('change', { bubbles: true }));
      blurInput(root);
      log('warn', 'condition:forceValue:final', { candidate: wanted });
    } catch {
      /* ignore */
    }
  }

  log('debug', 'condition:done', { success: ok, finalValue: root.value });
}

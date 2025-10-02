import type { RepublishDraft } from '../../types/draft';
import { blurInput, setInputValue, waitForElement } from '../dom-utils';
import { forceCloseDropdown, selectFromDropdownByTitle } from '../dropdown';
import { normalizeCondition } from '../i18n';
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

    // If original selection didn't commit, try normalized (canonical English) label
    const normalized = normalizeCondition(draft.condition || '');
    if (!committed && normalized && normalized !== draft.condition) {
      try {
        committed = await selectFromDropdownByTitle(selObj, normalized);
      } catch {
        committed = false;
      }
    }

    if (!committed) {
      // Fallback: write the raw draft.condition (initial assignment)
      setInputValue(root, draft.condition);
      blurInput(root);
    }

    // Always normalize final condition to canonical English for internal
    // consistency and tests. This writes the canonical label into the
    // input so downstream logic can rely on a single canonical form.
    try {
      const current = root.value || draft.condition || '';
      const finalNormalized = normalizeCondition(current);
      if (finalNormalized && finalNormalized !== current) {
        setInputValue(root, finalNormalized);
        blurInput(root);
      }
    } catch {
      /* ignore normalization errors */
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

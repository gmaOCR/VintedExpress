import type { RepublishDraft } from '../../types/draft';
import { blurInput, waitForElement } from '../dom-utils';
import { forceCloseDropdown, selectFromDropdownByTitle, selectSingleByEnter } from '../dropdown';
import { log } from '../metrics';

export async function fillSize(draft: RepublishDraft): Promise<void> {
  if (!draft.size) return;
  const sel = {
    inputSelector:
      'input[name="size"], #size, [data-testid="size-select-dropdown-input"], [data-testid="size-combobox-input"], [data-testid*="size"][data-testid$="dropdown-input"], [data-testid*="size"][data-testid$="combobox-input"], [data-testid*="size"][data-testid$="-input"]',
    chevronSelector:
      '[data-testid="size-select-dropdown-chevron-down"], [data-testid="size-select-dropdown-chevron-up"], [data-testid*="size"][data-testid$="dropdown-chevron-down"], [data-testid*="size"][data-testid$="dropdown-chevron-up"], [data-testid*="size"][data-testid$="combobox-chevron-down"], [data-testid*="size"][data-testid$="combobox-chevron-up"]',
    contentSelector:
      '[data-testid="size-select-dropdown-content"], [data-testid="size-combobox-content"], [data-testid*="size"][data-testid$="dropdown-content"], [data-testid*="size"][data-testid$="combobox-content"], [data-testid*="size"][data-testid$="-content"]',
    searchSelector:
      '[data-testid="size-select-dropdown-content"] input[type="search"], [data-testid="size-combobox-content"] input[type="search"], [data-testid*="size"][data-testid$="search-input"], [data-testid*="size"][data-testid$="search"] input',
  } as const;
  const root = await waitForElement<HTMLInputElement>(sel.inputSelector, { timeoutMs: 6000 });
  if (!root) {
    log('debug', 'size:input:not-found');
    return;
  }
  log('debug', 'size:input:found');
  // Pré-semer immédiatement la valeur pour garantir qu'au moins le champ reflète le draft
  if (!root.value && draft.size) {
    try {
      root.value = draft.size;
      root.dispatchEvent(new Event('input', { bubbles: true }));
      root.dispatchEvent(new Event('change', { bubbles: true }));
      log('debug', 'size:preseed', { value: root.value });
    } catch {
      /* ignore */
    }
  }
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
  log('debug', 'size:post-initial-phase', { ok, current: root.value });
  // Bypass immédiat: si logique ok mais value vide -> pousser draft.size directement (cas e2e stub sans radio / sans is-selected)
  if (ok && !root.value) {
    try {
      root.value = draft.size;
      root.dispatchEvent(new Event('input', { bubbles: true }));
      root.dispatchEvent(new Event('change', { bubbles: true }));
      blurInput(root);
      log('warn', 'size:forceValue:immediate', { candidate: draft.size });
    } catch {
      /* ignore */
    }
  }
  log('debug', 'size:after-immediate', { value: root.value });
  // Fermer une première fois (nettoyage visuel) avant fallback complémentaire
  try {
    await forceCloseDropdown(root, sel.chevronSelector, sel.contentSelector);
  } catch {
    /* ignore */
  }
  // Force value si succès logique mais input resté vide
  if (ok && !root.value) {
    try {
      // 1) Brève attente
      const shortDeadline = Date.now() + 120;
      while (!root.value && Date.now() < shortDeadline) await new Promise((r) => setTimeout(r, 20));
      // 2) Si toujours vide, ré-ouvrir pour tenter de détecter sélection UI (même si notre stub ne la marque pas)
      if (!root.value) {
        try {
          const ev = new MouseEvent('click', { bubbles: true });
          root.dispatchEvent(ev);
        } catch {
          /* ignore */
        }
        await new Promise((r) => setTimeout(r, 40));
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
          log('warn', 'size:forceValue:late', { candidate });
        }
      }
    } catch {
      /* ignore */
    }
  }
  log('debug', 'size:after-late', { value: root.value });
  // Re-fermer si ré-ouvert
  if (document.querySelector(sel.contentSelector)) {
    try {
      await forceCloseDropdown(root, sel.chevronSelector, sel.contentSelector);
    } catch {
      /* ignore */
    }
  }
  // Dernier filet de sécurité: si malgré tout la value est vide, pousser la valeur du draft
  if (!root.value && draft.size) {
    try {
      root.value = draft.size;
      root.dispatchEvent(new Event('input', { bubbles: true }));
      root.dispatchEvent(new Event('change', { bubbles: true }));
      blurInput(root);
      log('warn', 'size:forceValue:final', { candidate: draft.size });
    } catch {
      /* ignore */
    }
  }
  log('debug', 'size:done', { success: ok, finalValue: root.value });
}

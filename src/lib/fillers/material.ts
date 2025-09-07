import type { RepublishDraft } from '../../types/draft';
import { blurInput, setInputValue, waitForElement } from '../dom-utils';
import {
  forceCloseDropdown,
  multiSelectByEnter,
  multiSelectByTitles,
  multiSelectByTitlesLoose,
} from '../dropdown';
import { normalizeMaterial } from '../i18n';
import { log } from '../metrics';

export async function fillMaterial(draft: RepublishDraft): Promise<void> {
  if (!draft.material) return;
  try {
    log('info', 'material:start', { raw: draft.material });
  } catch {
    /* ignore */
  }
  const sel = {
    inputSelector:
      'input[name="material"], #material, [data-testid*="material"][data-testid$="dropdown-input"], [data-testid*="material"] input',
    chevronSelector:
      '[data-testid*="material"][data-testid$="dropdown-chevron-down"], [data-testid*="material"][data-testid$="dropdown-chevron-up"]',
    contentSelector: '[data-testid*="material"][data-testid$="dropdown-content"]',
    searchSelector:
      '[data-testid*="material"][data-testid$="dropdown-content"] input[type="search"], [data-testid*="material"][data-testid$="dropdown-content"] input',
  } as const;
  const root = await waitForElement<HTMLInputElement>(sel.inputSelector, { timeoutMs: 6000 });
  if (!root) {
    log('debug', 'material:input:not-found');
    return;
  }
  log('debug', 'material:input:found');
  const materials = splitList(draft.material).map((m) => normalizeMaterial(m));
  const labels = materials.length ? materials : [normalizeMaterial(draft.material)];
  log('debug', 'material:labels', labels);
  let ok = await multiSelectByEnter(sel, labels);
  log('debug', 'material:multiSelectByEnter', ok);
  if (!ok) {
    log('debug', 'material:strategy:titles');
    ok = await multiSelectByTitles(sel, labels);
    log('debug', 'material:multiSelectByTitles', ok);
  }
  if (!ok) {
    log('debug', 'material:strategy:titlesLoose');
    ok = await multiSelectByTitlesLoose(sel, labels);
    log('debug', 'material:multiSelectByTitlesLoose', ok);
  }
  try {
    const chips = Array.from(
      (root.closest('.web_ui__Input__input') || document).querySelectorAll<HTMLElement>(
        '[data-testid*="material"] .web_ui__Tag__tag, .web_ui__Tag__tag',
      ),
    )
      .slice(0, 15)
      .map((c) => (c.textContent || '').trim())
      .filter(Boolean);
    if (chips.length) log('debug', 'material:chips', { count: chips.length, chips });
    // Considérer la présence de chips comme succès même si input.value vide (multi-select UX)
    if (!ok && chips.length > 0) ok = true;
    // Si succès déclaré mais aucune trace (ni chips ni valeur), on forcera fallback plus bas
    if (ok && chips.length === 0 && !root.value) {
      log('debug', 'material:commit:missingValue');
      ok = false;
    }
  } catch {
    /* ignore */
  }
  if (!ok) {
    log('warn', 'material:fallback:setInputValue');
    try {
      setInputValue(root, draft.material);
      blurInput(root);
      ok = true;
    } catch {
      log('warn', 'material:fallback:setInputValue:failed');
    }
  }
  try {
    await forceCloseDropdown(root, sel.chevronSelector, sel.contentSelector);
  } catch {
    /* ignore */
  }
  // Force une valeur lisible si succès mais input resté vide (cas multi-select sans chip rendu)
  if (ok && !root.value) {
    try {
      const chip = document.querySelector<HTMLElement>(
        '[data-testid*="material"] .web_ui__Tag__tag, .web_ui__Tag__tag',
      );
      const candidate = chip?.textContent?.trim() || labels[0] || draft.material;
      if (candidate) {
        setInputValue(root, candidate);
        blurInput(root);
        log('debug', 'material:forceValue', { candidate });
      }
    } catch {
      /* ignore */
    }
  }
  log('debug', 'material:done', { success: ok, finalValue: root.value });
}

function splitList(text: string): string[] {
  return text
    .split(/,|\/|·|\u00B7|\u2022|\s+\/\s+|\s*\+\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

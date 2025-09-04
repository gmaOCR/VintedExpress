import type { RepublishDraft } from '../../types/draft';
import { setInputValue, waitForElement } from '../dom-utils';
import {
  forceCloseDropdown,
  multiSelectByEnter,
  multiSelectByTitles,
  multiSelectByTitlesLoose,
} from '../dropdown';
import { normalizeMaterial } from '../i18n';

export async function fillMaterial(draft: RepublishDraft): Promise<void> {
  if (!draft.material) return;
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
  if (!root) return;
  const materials = splitList(draft.material).map((m) => normalizeMaterial(m));
  const labels = materials.length ? materials : [normalizeMaterial(draft.material)];
  let ok = await multiSelectByEnter(sel, labels);
  if (!ok) ok = await multiSelectByTitles(sel, labels);
  if (!ok) ok = await multiSelectByTitlesLoose(sel, labels);
  if (!ok) {
    try {
      setInputValue(root, draft.material);
    } catch {
      /* ignore */
    }
  }
  try {
    await forceCloseDropdown(root, sel.chevronSelector, sel.contentSelector);
  } catch {
    /* ignore */
  }
}

function splitList(text: string): string[] {
  return text
    .split(/,|\/|·|\u00B7|\u2022|\s+\/\s+|\s*\+\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

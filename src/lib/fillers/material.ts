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
      'input[name="material"], #material, [data-testid*="material"][data-testid$="dropdown-input"], [data-testid*="material"][data-testid$="combobox-input"], [data-testid*="material"][data-testid$="-input"], [data-testid*="material"] input',
    chevronSelector:
      '[data-testid*="material"][data-testid$="dropdown-chevron-down"], [data-testid*="material"][data-testid$="dropdown-chevron-up"], [data-testid*="material"][data-testid$="combobox-chevron-down"], [data-testid*="material"][data-testid$="combobox-chevron-up"]',
    contentSelector:
      '[data-testid*="material"][data-testid$="dropdown-content"], [data-testid*="material"][data-testid$="combobox-content"], [data-testid*="material"][data-testid$="-content"]',
    searchSelector:
      '[data-testid*="material"][data-testid$="dropdown-content"] input[type="search"], [data-testid*="material"][data-testid$="combobox-content"] input[type="search"], [data-testid*="material"][data-testid$="search-input"], [data-testid*="material"][data-testid$="search"] input',
  } as const;
  const root = await waitForElement<HTMLInputElement>(sel.inputSelector, { timeoutMs: 6000 });
  if (!root) {
    log('debug', 'material:input:not-found');
    return;
  }
  log('debug', 'material:input:found');
  const rawList = splitList(draft.material);
  const displayLabels = (rawList.length ? rawList : [draft.material])
    .map((m) => (m || '').trim())
    .filter(Boolean);
  const normalizedLabels = displayLabels.map((m) => normalizeMaterial(m));
  log('debug', 'material:labels', {
    display: displayLabels,
    normalized: normalizedLabels,
  });
  let ok = false;
  // 1) Stratégies standard multi-select
  {
    let s = await multiSelectByEnter(sel, displayLabels);
    log('debug', 'material:multiSelectByEnter', s);
    if (!s) {
      log('debug', 'material:strategy:titles');
      s = await multiSelectByTitles(sel, displayLabels);
      log('debug', 'material:multiSelectByTitles', s);
    }
    if (!s) {
      log('debug', 'material:strategy:titlesLoose');
      s = await multiSelectByTitlesLoose(sel, displayLabels);
      log('debug', 'material:multiSelectByTitlesLoose', s);
    }
    ok = s;
  }
  // 2) Attente courte pour apparition des chips / cases cochées
  const successCheck = () => {
    const chips = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid*="material"] .web_ui__Tag__tag, .web_ui__Tag__tag',
      ),
    )
      .map((c) => (c.textContent || '').trim())
      .filter(Boolean);
    const checkedBoxes = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        '[data-testid*="material"] input[type="checkbox"], input[type="checkbox"]',
      ),
    ).filter((i) => i.checked);
    const checkedLabels = checkedBoxes
      .map((box) => {
        const val = box.value || box.getAttribute('value') || '';
        if (val) return normalizeMaterial(val);
        const labelNode =
          box.closest('[data-testid$="dropdown-row-button"], button, li') || box.parentElement;
        return normalizeMaterial(labelNode?.textContent || '');
      })
      .filter(Boolean);
    const normChips = chips.map((c) => normalizeMaterial(c));
    const haveAll = normalizedLabels.every((norm) => {
      return normChips.includes(norm) || checkedLabels.includes(norm);
    });
    return { chips, checkedCount: checkedBoxes.length, checkedLabels, haveAll };
  };
  const waitDeadline = Date.now() + 800;
  let snapshot = successCheck();
  while (Date.now() < waitDeadline && !snapshot.haveAll) {
    await new Promise((r) => setTimeout(r, 90));
    snapshot = successCheck();
  }
  if (snapshot.chips.length) log('debug', 'material:chips', snapshot);
  if (snapshot.haveAll) ok = true;
  else ok = false;
  // 3) Si toujours pas ok: tentative ciblée cell par cell (checkbox direct)
  if (!ok) {
    displayLabels.forEach((wanted, idx) => {
      const normWanted = normalizedLabels[idx] || normalizeMaterial(wanted);
      const cell = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-testid*="material"] .web_ui__Cell__cell, .web_ui__Cell__cell, [data-testid*="material"][data-testid$="dropdown-row-button"], [data-testid$="dropdown-row-button"]',
        ),
      ).find((c) => normalizeMaterial(c.textContent || '') === normWanted);
      if (cell) {
        try {
          cell.click();
          const box = cell.querySelector<HTMLInputElement>('input[type="checkbox"]');
          if (box && !box.checked) {
            box.click();
          }
        } catch {
          /* ignore */
        }
      }
    });
    // Re-vérification
    snapshot = successCheck();
    if (snapshot.haveAll) ok = true;
  }
  // 3bis) Correspondance partielle / similarité simple si échec stricte
  if (!ok) {
    try {
      log('debug', 'material:strategy:partial');
    } catch {
      /* ignore */
    }
    const cells = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid*="material"] .web_ui__Cell__cell, .web_ui__Cell__cell, [data-testid*="material"][data-testid$="dropdown-row-button"], [data-testid$="dropdown-row-button"]',
      ),
    ).map((c) => ({ el: c, raw: (c.textContent || '').trim() }));
    const normCells = cells.map((c) => ({ ...c, norm: normalizeMaterial(c.raw) }));
    displayLabels.forEach((wanted, idx) => {
      const normWanted = normalizedLabels[idx] || normalizeMaterial(wanted);
      // Cherche inclusion mutuelle
      let candidate = normCells.find(
        (c) => c.norm.includes(normWanted) || normWanted.includes(c.norm),
      );
      if (!candidate) {
        // Similarité naïve: distance de longueur ou ratio commun
        const scored = normCells
          .map((c) => ({
            c,
            score: similarityScore(normWanted, c.norm),
          }))
          .sort((a, b) => b.score - a.score);
        if (scored.length && scored[0] && scored[0].score >= 0.6) candidate = scored[0].c; // seuil empirique
      }
      if (candidate) {
        try {
          candidate.el.click();
          const box = candidate.el.querySelector<HTMLInputElement>('input[type="checkbox"]');
          if (box && !box.checked) box.click();
          log('debug', 'material:partial:applied', { wanted, candidate: candidate.raw });
        } catch {
          /* ignore */
        }
      }
    });
    snapshot = successCheck();
    if (snapshot.haveAll) ok = true;
  }
  // 4) Dernier espoir: si rien marqué mais on a une seule valeur, forcer input pour lisibilité
  if (!ok) {
    try {
      const chipsAfter = successCheck();
      if (chipsAfter.haveAll) {
        ok = true;
      } else if (displayLabels.length === 1) {
        log('warn', 'material:fallback:setInputValue');
        try {
          setInputValue(root, displayLabels[0] || draft.material || '');
          blurInput(root);
          ok = true;
        } catch {
          log('warn', 'material:fallback:setInputValue:failed');
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (!ok) {
    // Si toujours pas ok, log titres candidats pour debug terrain
    try {
      const titles = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-testid*="material"] .web_ui__Cell__title, .web_ui__Cell__title',
        ),
      )
        .slice(0, 30)
        .map((t) => t.textContent?.trim() || '');
      log('warn', 'material:failure:titles', { displayLabels, titles });
    } catch {
      /* ignore */
    }
  }
  try {
    await forceCloseDropdown(root, sel.chevronSelector, sel.contentSelector);
  } catch {
    /* ignore */
  }
  // Force une valeur lisible si succès mais input resté vide
  if (ok && !root.value) {
    try {
      const chip = document.querySelector<HTMLElement>(
        '[data-testid*="material"] .web_ui__Tag__tag, .web_ui__Tag__tag',
      );
      let candidate = chip?.textContent?.trim();
      if (!candidate) {
        // Cherche la cellule sélectionnée pour récupérer la forme exacte (accents)
        const selectedCell = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-testid*="material"] .web_ui__Cell__cell.is-selected, .web_ui__Cell__cell.is-selected',
          ),
        )
          .map((c) => c.textContent?.trim() || '')
          .find(Boolean);
        candidate = selectedCell || displayLabels[0] || draft.material;
      }
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

// Similarité très simple: ratio du plus long préfixe commun / longueur max, pondéré par Jaccard sur tokens
function similarityScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const minLen = Math.min(a.length, b.length);
  let prefix = 0;
  while (prefix < minLen && a[prefix] === b[prefix]) prefix++;
  const prefixScore = prefix / Math.max(a.length, b.length);
  const tokensA = Array.from(new Set(a.split(/\s+/)));
  const tokensB = Array.from(new Set(b.split(/\s+/)));
  const inter = tokensA.filter((t) => tokensB.includes(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = union ? inter / union : 0;
  return prefixScore * 0.5 + jaccard * 0.5;
}

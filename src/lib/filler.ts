import type { RepublishDraft } from '../types/draft';
import {
  tryCatalogSearch,
  waitAndClickCategory,
  waitForCategoryCommit,
  waitForUnisexCheckbox,
} from './category';
import { click, clickInTheVoid, setInputValue, waitForElement } from './dom-utils';
import { fillBrand } from './fillers/brand';
import { fillColor } from './fillers/color';
import { fillCondition } from './fillers/condition';
import { fillMaterial } from './fillers/material';
import { fillPatterns } from './fillers/patterns';
import { fillSize } from './fillers/size';
// dropdown utils désormais utilisés via les fillers spécialisés
import { log, perf } from './metrics';

// --- Entrée principale ---
export async function fillNewItemForm(draft: RepublishDraft) {
  perf('total', 'start');
  log('info', 'fill:start', { url: location.href });
  // Approche simplifiée et logique: titre/description/prix, catégorie, puis remplissages en parallèle

  // Indépendants
  const titleInput = await waitForElement<HTMLInputElement>(
    'input[name="title"], input#title, [data-testid="title--input"]',
  );
  if (titleInput && draft.title) setInputValue(titleInput, draft.title);

  const descInput = await waitForElement<HTMLTextAreaElement>(
    'textarea[name="description"], textarea#description, [data-testid="description--input"]',
  );
  if (descInput && draft.description) setInputValue(descInput, draft.description);

  const priceInput = await waitForElement<HTMLInputElement>(
    'input[name="price"], input#price, [data-testid="price-input--input"]',
  );
  if (priceInput && typeof draft.priceValue === 'number') {
    const text = draft.priceValue.toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    setInputValue(priceInput, text);
  }

  // (Unisex déclenché juste après la catégorie)

  // Catégorie
  let startedDependent = false;
  if (draft.categoryPath && draft.categoryPath.length) {
    perf('category', 'start');
    const catInput = await waitForElement<HTMLInputElement>(
      'input[name="category"], #category, [data-testid="catalog-select-dropdown-input"]',
    );
    if (catInput) {
      const chevron = catInput.parentElement?.querySelector(
        '[data-testid="catalog-select-dropdown-chevron-down"]',
      ) as HTMLElement | null;
      click(chevron || catInput);
      const dropdownRootSelector = '[data-testid="catalog-select-dropdown-content"]';
      await waitForElement<HTMLElement>(dropdownRootSelector, { timeoutMs: 2500 });

      const path = (draft.categoryPath ?? []).filter(Boolean);
      for (let i = 0; i < path.length; i++) {
        const label = path[i]!;
        const isLast = i === path.length - 1;
        let ok = await waitAndClickCategory(dropdownRootSelector, label, { isLast });
        if (!ok) {
          await tryCatalogSearch(label);
          ok = await waitAndClickCategory(dropdownRootSelector, label, { isLast });
        }
      }
      // Attendre que l'input catégorie reflète bien la « feuille » (dernier segment)
      const expectedLeaf = path[path.length - 1] ?? '';
      await waitForCategoryCommit(catInput, expectedLeaf, dropdownRootSelector, {
        mode: 'leaf',
      });
      // Unisex: juste après assignation de catégorie (menu fermé)
      if (draft.unisex) {
        perf('unisex', 'start');
        const unisexInput = (await waitForUnisexCheckbox({
          timeoutMs: 5000,
        })) as HTMLInputElement | null;
        if (unisexInput && !unisexInput.checked) click(unisexInput);
        perf('unisex', 'end');
      }
      await clickInTheVoid();
      // Déclencher en parallèle le remplissage des champs dépendants
      await Promise.allSettled([
        fillBrand(draft),
        fillSize(draft),
        fillCondition(draft),
        fillColor(draft),
        fillMaterial(draft),
        fillPatterns(draft),
      ]);
      startedDependent = true;
    }
    perf('category', 'end');
  }

  // Si aucune catégorie n'a été traitée (ou absente), remplir tout de même les champs dépendants
  if (!startedDependent) {
    await Promise.allSettled([
      fillBrand(draft),
      fillSize(draft),
      fillCondition(draft),
      fillColor(draft),
      fillMaterial(draft),
      fillPatterns(draft),
    ]);
  }

  await clickInTheVoid();

  perf('total', 'end');
}

// Section helpers historique supprimée (déplacée dans ./fillers et utilitaires)

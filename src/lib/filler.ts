import type { RepublishDraft } from '../types/draft';
import {
  selectCategoryPathDeterministic,
  selectCategoryPathSimple,
  waitAndClickCategory,
  waitForCategoryCommit,
  waitForUnisexCheckbox,
} from './category';
import { click, setInputValue, waitForElement } from './dom-utils';
import { closeAnyDropdowns } from './dropdown';
import { fillBrand } from './fillers/brand';
import { fillColor } from './fillers/color';
import { fillCondition } from './fillers/condition';
import { fillMaterial } from './fillers/material';
import { fillPatterns } from './fillers/patterns';
import { fillSize } from './fillers/size';
import { log, perf } from './metrics';

// --- Entrée principale ---
export async function fillNewItemForm(draft: RepublishDraft) {
  // Garde anti double exécution (content script injecté plusieurs fois)
  if ((window as unknown as { __vx_fillRunning?: boolean }).__vx_fillRunning) {
    log('warn', 'fill:skip:already-running');
    return;
  }
  (window as unknown as { __vx_fillRunning?: boolean }).__vx_fillRunning = true;
  const runId = Date.now().toString(36).slice(-6);
  perf('total', 'start');
  log('info', 'fill:start', {
    url: location.href,
    hasDraft: !!draft,
    draftKeys: Object.keys(draft || {}).slice(0, 20),
    brand: (draft as Partial<RepublishDraft>).brand ?? null,
    material: (draft as Partial<RepublishDraft>).material ?? null,
    runId,
  });
  // Approche simplifiée et logique: titre/description/prix, catégorie, puis remplissages en parallèle

  // Indépendants
  const titleInput = await waitForElement<HTMLInputElement>(
    'input[name="title"], input#title, [data-testid="title--input"]',
  );
  if (titleInput && draft.title) {
    setInputValue(titleInput, draft.title);
    log('debug', 'fill:title:set', titleInput.value);
  }

  const descInput = await waitForElement<HTMLTextAreaElement>(
    'textarea[name="description"], textarea#description, [data-testid="description--input"]',
  );
  if (descInput && draft.description) {
    setInputValue(descInput, draft.description);
    log('debug', 'fill:description:set');
  }

  const priceInput = await waitForElement<HTMLInputElement>(
    'input[name="price"], input#price, [data-testid="price-input--input"]',
  );
  if (priceInput && typeof draft.priceValue === 'number') {
    const text = draft.priceValue.toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    setInputValue(priceInput, text);
    log('debug', 'fill:price:set', priceInput.value);
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
      log('debug', 'category:input:found');
      const chevron = catInput.parentElement?.querySelector(
        '[data-testid="catalog-select-dropdown-chevron-down"]',
      ) as HTMLElement | null;
      click(chevron || catInput);
      const dropdownRootSelector = '[data-testid="catalog-select-dropdown-content"]';
      await waitForElement<HTMLElement>(dropdownRootSelector, { timeoutMs: 2500 });

      const path = (draft.categoryPath ?? []).filter(Boolean);
      const det = await selectCategoryPathDeterministic(dropdownRootSelector, path);
      log('info', 'category:summary', { allOk: det.allOk, steps: det.steps, detRun: det.runId });
      let stepResults = det.steps.map((s: { label: string; ok: boolean; isLast: boolean }) => ({
        label: s.label,
        ok: s.ok,
        isLast: s.isLast,
      }));
      let allOk = det.allOk;
      if (!allOk) {
        const needLegacy =
          stepResults.every((s: { ok: boolean }) => !s.ok) || stepResults.length < path.length;
        if (needLegacy) {
          const legacy = await selectCategoryPathSimple(dropdownRootSelector, path);
          log('info', 'category:legacy', legacy);
          if (legacy.allOk) {
            stepResults = legacy.steps;
            allOk = true;
          }
        }
      }
      if (!allOk) {
        const failed = stepResults.find(
          (s: { label: string; ok: boolean; isLast: boolean }) => !s.ok,
        );
        if (failed) {
          const ok = await waitAndClickCategory(dropdownRootSelector, failed.label);
          log('debug', 'category:fallback:single', { label: failed.label, ok });
        }
      }
      const expectedLeaf = path[path.length - 1] ?? '';
      const committed = await waitForCategoryCommit(catInput, expectedLeaf);
      log('debug', 'category:commit', { expectedLeaf, committed });
      // Si échec global, retenter une fois rapide (ex: ordre initial partiellement incompatible)
      // Unisex après commit (ou tentative)
      if (draft.unisex) {
        perf('unisex', 'start');
        const unisexInput = (await waitForUnisexCheckbox()) as HTMLInputElement | null;
        if (unisexInput && !unisexInput.checked) click(unisexInput);
        perf('unisex', 'end');
      }
      // Lancer dépendants seulement après commit (améliore chances que champs existent)
      const dependents = [
        (async () => {
          log('debug', 'dep:brand:start', draft.brand);
          await fillBrand(draft);
          log('debug', 'dep:brand:end');
        })(),
        (async () => {
          log('debug', 'dep:size:start', draft.size);
          await fillSize(draft);
          log('debug', 'dep:size:end');
        })(),
        (async () => {
          log('debug', 'dep:condition:start', draft.condition);
          await fillCondition(draft);
          log('debug', 'dep:condition:end');
        })(),
        (async () => {
          log('debug', 'dep:color:start', draft.color);
          await fillColor(draft);
          log('debug', 'dep:color:end');
        })(),
        (async () => {
          log('debug', 'dep:material:start', draft.material);
          await fillMaterial(draft);
          log('debug', 'dep:material:end');
        })(),
        (async () => {
          log('debug', 'dep:patterns:start', draft.patterns);
          await fillPatterns(draft);
          log('debug', 'dep:patterns:end');
        })(),
      ];
      await Promise.allSettled(dependents);
      startedDependent = true;
    }
    perf('category', 'end');
  }

  // Si aucune catégorie n'a été traitée (ou absente), remplir tout de même les champs dépendants
  if (!startedDependent) {
    log('debug', 'dependents:direct');
    await Promise.allSettled([
      (async () => {
        log('debug', 'dep:brand:start', draft.brand);
        await fillBrand(draft);
        log('debug', 'dep:brand:end');
      })(),
      (async () => {
        log('debug', 'dep:size:start', draft.size);
        await fillSize(draft);
        log('debug', 'dep:size:end');
      })(),
      (async () => {
        log('debug', 'dep:condition:start', draft.condition);
        await fillCondition(draft);
        log('debug', 'dep:condition:end');
      })(),
      (async () => {
        log('debug', 'dep:color:start', draft.color);
        await fillColor(draft);
        log('debug', 'dep:color:end');
      })(),
      (async () => {
        log('debug', 'dep:material:start', draft.material);
        await fillMaterial(draft);
        log('debug', 'dep:material:end');
      })(),
      (async () => {
        log('debug', 'dep:patterns:start', draft.patterns);
        await fillPatterns(draft);
        log('debug', 'dep:patterns:end');
      })(),
    ]);
  }

  // Pas de pause inutile: laisser la page réagir naturellement

  perf('total', 'end');
  log('info', 'fill:end', { runId });
  try {
    await closeAnyDropdowns();
  } catch {
    /* ignore */
  }
  // Libère la garde pour éventuelle relance manuelle
  (window as unknown as { __vx_fillRunning?: boolean }).__vx_fillRunning = false;
}

// Section helpers historique supprimée (déplacée dans ./fillers et utilitaires)

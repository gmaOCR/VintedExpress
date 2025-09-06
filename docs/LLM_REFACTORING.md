# Guide de refactorisation (LLM) — VintedExpress

But: proposer des refactors et optimisations qui améliorent la lisibilité humaine, la cohérence et la robustesse, sans modifier les comportements publics ni casser les tests.

## Contexte

- Tech: TypeScript, Vite, MV3. Tests: Vitest + Playwright.
- Zones clés:
  - `src/content/new-listing.ts` (bootstrap + images)
  - `src/lib/` (dropdown, fillers, i18n, category, dom-utils, upload, images)
  - `src/lib/fillers/*` (par champ)
  - `tests/`, `tests-e2e/` (unitaires et E2E)
- Irritants observés: logique dropdown éparpillée, fermetures parfois non fiables, normalisations i18n partielles, attentes post-catégorie, gros fichier content, répétition de patterns de polling.

## Principes

- Centraliser comportements communs (sélecteurs, timeouts, normalisation, fermeture dropdown).
- Petits contrats stables, déterministes, testables. Fallback explicites (setInputValue + blur).
- Préférer clarté et nommage explicite aux boucles ad-hoc.

## Priorités (P0 → P2)

### P0 — Cohérence UX et utilitaires

1. API Dropdown unifiée (`src/lib/dropdown.ts`)

- Sélecteurs: `{ inputSelector; chevronSelector?; contentSelector?; searchSelector? }`.
- Stratégie: search+Enter → titre exact (`.web_ui__Cell__title`) → texte proche.
- Toujours tenter le radio interne si présent (force l’assignation côté UI).
- Toujours fermer après commit (Esc, clic chevron, clic “dans le vide”, `waitForGone`).
- Toutes les queries se font dans `contentSelector` si fourni (évite collisions globales).
- Délais via `getTimeout()`, pas de constantes magiques inline.

2. Fillers homogènes (`src/lib/fillers/*.ts`)

- Pipeline: normaliser (i18n) → select (Enter|Title|Text) → fallback `setInputValue + blur` → fermeture forcée.
- Pas de logique UI spécifique dans chaque filler: s’appuyer sur dropdown.ts.
- Vérifier via tests unitaires que `input.value` reflète la valeur finale.

3. Catégorie et dépendants (`src/lib/category.ts`, `src/lib/filler.ts`)

- Navigation: attendre le strict minimum pour la « feuille », puis lancer immédiatement les fillers dépendants en parallèle (`Promise.allSettled`).
- `tryCatalogSearch()` idempotent, léger (clear → taper → court délai).
- `waitAndClickCategory(rootSel, label, { isLast })` avec `waitForTitlesChange` scoppé au container.

4. i18n centralisé (`src/lib/i18n.ts`)

- Exposer `normalizeCondition`, `normalizeMaterial`, `NO_BRAND_SYNONYMS` et (optionnel) `normalizeBrandText`.
- Interdire les comparaisons non normalisées dans fillers.

5. DOM & Config (`src/lib/dom-utils.ts`, `src/lib/config.ts`)

- Un seul `waitForElement`, `waitForGone`, `click`, `delay`.
- Timeouts via `getTimeout(key)`, surcharges via `localStorage` (`vx:to:*`).

### P1 — Lisibilité des scripts Content & pipeline images

6. Scinder `src/content/new-listing.ts`

- Sections: bootstrap (chrome.storage + API e2e), orchestrateur (`fillNewItemForm`), pipeline images (download/convert/upload/feedback) en sous-fonctions privées.
- Ajouter types/alias pour feedback (grid/live) et états de pipeline.

7. Images/Upload (`src/lib/images.ts`, `src/lib/upload.ts`)

- API claire: `prepareFile(url) → Promise<File|null>` (télécharge, convertit, assure JPEG/PNG).
- Limiter la concurrence (3–4 simultanés) avec petite file asynchrone.
- Tests: type inconnu → JPEG; DnD → incrément de grille; fallback input si DnD indisponible.

8. Logs/metrics

- `perf(label, start|end)` no-op en prod, activable via `vx:debug`/`vx:e2e`.
- Logs silencieux par défaut.

### P2 — Ergonomie, style, couverture

9. Types & Sélecteurs

- Type alias `DropdownSelectors` pour signatures.
- Helper `invariant(cond, msg)` pour clarifier early-returns.

10. Lint & import order

- Appliquer `eslint-plugin-simple-import-sort`, `eslint-config-prettier`. Script `lint:fix`.

11. Tests complémentaires

- E2E: fermeture dropdown (condition, marque, matériaux, taille).
- Unit: `selectSingleByEnter` avec/sans `searchSelector`.
- Cas “brand inconnue” → fallback `setInputValue + blur`.

## Contrats recommandés (pour édition LLM)

- Dropdown
  - `openDropdown(sel): { input: HTMLInputElement|null; root: HTMLElement|Document }`
  - `selectSingleByEnter(sel, label): Promise<boolean>`
  - `selectFromDropdownByTitle(sel, label): Promise<boolean>`
  - `selectFromDropdownByText(sel, label): Promise<boolean>`
  - `multiSelectByEnter|Titles|TitlesLoose(sel, labels, { optional? }): Promise<boolean>`
  - `forceCloseDropdown(input, chevronSelector?, contentSelector?): Promise<void>`
  - Edge cases: pas de champ search, radios internes, listes scrollables; cliquer radio si présent.

- Fillers
  - Signature: `(draft: RepublishDraft) => Promise<void>`; early return si champ absent.
  - Succès: `input.value` reflète la valeur normalisée (ou “Sans marque” si brand vide).

- Catégorie
  - `waitAndClickCategory(rootSel, label, { isLast }): Promise<boolean>` + `waitForTitlesChange()` scoppé au container.
  - `waitForCategoryCommit(input, expected, rootSel, { mode: 'leaf'|'full' }): Promise<boolean>`

- i18n
  - Normalisations par champ + `NO_BRAND_SYNONYMS`.

- Images/Upload
  - `prepareFile(url) → File|null`, `dndOneFile(target, file)`, `waitForMediaFeedback(grid, live, beforeCount, beforeLive, timeout)`.

## Critères de succès

- Dropdowns se ferment après sélection; marque et état correctement remplis.
- Pas d’attente inutile après catégorie; dépendants démarrent rapidement.
- Timeouts ajustables via localStorage; build/tests verts.

## Plan d’application par étapes (sécurisées)

1. Harmoniser `dropdown.ts` + adapters dans fillers.
2. Centraliser normalisations i18n et les consommer partout.
3. Simplifier l’orchestrateur (remplissages dépendants précoces).
4. Découper `new-listing.ts` si nécessaire (>500 lignes focalisées images).
5. Étendre tests (fermeture dropdown, fallback brand, timings post-catégorie).

## Astuce tuning

- localStorage: `vx:to:wait.dropdown.content`, `vx:to:wait.dropdown.commit`, etc. pour ajuster sans rebuild.

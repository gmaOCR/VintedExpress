# Guide LLM de refactorisation — VintedExpress

Date: 2025-09-04

Ce document fournit des instructions opérables pour un LLM afin de refactorer le codebase par priorités, avec règles, étapes concrètes, critères d’acceptation et livrables. Objectif: améliorer lisibilité, découpage, et mutualisation sans changer le comportement utilisateur.

## Checklist

- Énoncer règles générales et contraintes non-fonctionnelles.
- P0: Scinder `filler.ts` en modules cohésifs + factoriser logique dropdown.
- P1: Mutualiser pipeline images + uploads; isoler observateur/heartbeat UI.
- P2: i18n/synonymes, perfs DOM, lint “no-console” en prod.
- Qualité: exécuter build/tests, ajouter tests ciblés, maintenir comportement.

## Règles générales

- Ne pas changer le comportement utilisateur ni les APIs publiques existantes (ex: `fillNewItemForm`).
- Ne pas réintroduire de `console.*`; conserver des wrappers no-op si nécessaire.
- Préserver la compatibilité MV3 (background/service worker, content scripts).
- Petites PRs atomiques par phase; build et tests verts à chaque fin de phase.
- Ajouter/mettre à jour des tests unitaires lors de chaque extraction.
- Ne pas renommer les points d’entrée Vite/manifest ni déplacer les fichiers HTML.

## P0 — Refactor “remplissage” et dropdowns (priorité lisibilité)

But: découper `src/lib/filler.ts` en modules dédiés, factoriser la logique dropdown répétée.

Créer les nouveaux fichiers:

- `src/lib/dom-utils.ts`
  - `delay`, `click`, `setInputValue`, `waitForElement`, `waitForGone`, `clickInTheVoid`, `normalize`.
- `src/lib/dropdown.ts`
  - `openDropdown`, `forceCloseDropdown`, `waitForTitlesChange`,
  - `selectFromDropdownByText`, `selectFromDropdownByTitle`, `selectSingleByEnter`,
  - `selectMultiple(labels, options)` pour unifier les variantes multiSelect.
- `src/lib/category.ts`
  - `waitAndClickCategory`, `tryCatalogSearch`, `waitForCategoryCommit`, `waitForUnisexCheckbox`.
- `src/lib/color-map.ts`
  - `colorSynonym`, `colorToSlug` et mapping centralisé.
- `src/lib/fillers/{brand,size,condition,color,material,patterns}.ts`
  - Chaque module exporte `fill(draft: RepublishDraft): Promise<{ ok: boolean; reason?: string }>` et dépend de `dropdown`/`dom-utils`.
- `src/lib/config.ts`
  - Timeouts/intervals par défaut (ex: `{ short: 400, medium: 1800, long: 6000 }`).

Adapter `src/lib/filler.ts` (orchestrateur):

- Conserver `fillNewItemForm(draft)` qui:
  - Remplit titre/description/prix.
  - Sélectionne la catégorie, puis lance en parallèle les `fillers/*.fill`.
  - N’inclut plus de logique DOM bas-niveau.

Remplacements/Factorisations:

- Remplacer `multiSelectByTitles`, `multiSelectByTitlesLoose`, `multiSelectByEnter`, `multiSelectColors` par `selectMultiple` avec options `{ match: 'exact'|'loose', method: 'enter'|'click', optional?: boolean }` dans `dropdown.ts`.
- Déplacer `colorSynonym` et `colorToSlug` dans `color-map.ts` et les utiliser depuis `fillers/color.ts`.

Critères d’acceptation:

- Build et tests actuels passent inchangés.
- `fillNewItemForm` reste l’API exportée unique.
- Duplication dropdown supprimée (une implémentation centrale).
- Aucune régression sur tests existants de filler.

## P1 — Images, upload et UI observer (cohérence et séparation)

But: mutualiser conversion/transcodage et isoler l’upload.

Créer:

- `src/lib/images.ts`
  - `sniffImageType`, `ensureUploadableImage`, `tryWebCodecsTranscodeToJpeg`, `ensureExtension`, helpers base64.
- `src/lib/upload.ts`
  - `prepareFiles(urls: string[]): Promise<File[]>`, `tryDropOrInput(dropHost: HTMLElement, files: File[]): Promise<boolean>`.
- `src/lib/ui/ensure-button.ts`
  - `enhanceListingPage`, `ensureFloatingButton`, `ensureStylesInjected`,
  - encapsule `MutationObserver` + heartbeat (setInterval) avec debounce.

Adapter:

- `src/content/new-listing.ts` → appeler `images.ts` et `upload.ts` au lieu de la logique inline.
- `src/content/vinted.ts` → déplacer l’injection du bouton dans `ui/ensure-button.ts` et garder un bootstrap simple.
- `src/background/index.ts` → utiliser `images.ts` pour conversion (supprimer duplications).

Critères d’acceptation:

- Build/tests passent; e2e (si présents) inchangés.
- Code d’images centralisé dans un seul module.
- Le content script “new listing” ne contient plus de conversions brutes.

## P2 — i18n, perf DOM et hygiène build

- i18n/synonymes:
  - Extraire labels (republish/duplicate) vers `src/i18n/labels.ts` (ou JSON).
  - Extraire synonymes couleurs multi-locales vers `src/i18n/colors.ts`.
  - Adapter `vinted.ts` pour utiliser ces sources.
- Performance DOM:
  - Dans `dropdown.ts`, limiter les `querySelectorAll` globaux; préférer le `root` (conteneur dropdown) et réutiliser la “signature titres” (`sig`) pour réduire les boucles.
  - Centraliser les timeouts (`config.ts`) et appliquer un léger backoff.
- Hygiène build:
  - Configurer Vite/esbuild pour `drop: ['console','debugger']` en production.
  - ESLint: activer `no-console`, `no-floating-promises`, `@typescript-eslint/no-misused-promises`.

Critères d’acceptation:

- Aucune régression; taille bundle stable ou inférieure.
- Lint passe sans nouveaux warnings bloquants.

## Tests à ajouter/mettre à jour (minimaux)

- `tests/dropdown.test.ts`:
  - Happy path: sélection par titre exact.
  - Fallback: recherche + Enter.
- `tests/images.test.ts`:
  - Sniff PNG/JPEG/WEBP/AVIF; `ensureUploadableImage` retourne le type attendu.
- `tests/colors.test.ts`:
  - Synonymes “gray -> grey”, mapping vers slugs.
- `tests/fillers/*.test.ts`:
  - 1 test par filler (happy path + option manquante/absente).

## Qualité et validations (à la fin de chaque phase)

- Build et tests unitaires verts.
- Grep: aucune occurrence de `console.` dans `src/`.
- Duplication dropdown supprimée (pas de `multiSelect*` résiduels hors `dropdown.ts`).

## Livrables attendus

- Modules créés: `dom-utils.ts`, `dropdown.ts`, `category.ts`, `color-map.ts`, `fillers/*`, `images.ts`, `upload.ts`, `ui/ensure-button.ts`, `i18n/*`.
- `filler.ts` réduit à un orchestrateur clair.
- Tests unitaires nouveaux/ajustés.
- Brève note dans `README.md` (structure modules, conventions sélecteurs, comment activer un mode debug structuré si requis).

## Hypothèses

- Pas d’exigence de logs runtime; wrappers de logs restent no-op.
- Pas de changement de manifest/permissions.
- Les tests vitest existants couvrent les chemins critiques; on les complète avec les tests ci-dessus.

---

Utilisation: exécuter P0 → P1 → P2 en PRs séparées. À chaque étape, conserver l’API publique et garantir green build/tests avant de poursuivre.

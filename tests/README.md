# Tests VintedExpress

Ce dossier contient des tests unitaires Vitest pour les modules d’extraction et de remplissage.

## Lancer les tests

```
npm run test
```

Pour voir la couverture:

```
npm run test:coverage
```

## Conventions et règles

- Environnement: jsdom. On force la visibilité des éléments en surchargant `getClientRects()` pour que `visible()` retourne vrai sous jsdom.
- Isolation: chaque test remet `document.body.innerHTML = ''` dans un `beforeEach` et nettoie `localStorage`.
- Sélecteurs: reproduire le minimum de DOM nécessaire (inputs et containers dropdown) avec les mêmes `data-testid`/classes utilisées par le code (ex: `data-testid="brand-select-dropdown-content"`).
- Événements: les tests vérifient les clics en attachant un listener `click` et en validant le compteur.
- Robustesse: privilégier des assertions « au moins une fois » (`toBeGreaterThan(0)`) pour éviter les flakies de timing.
- Mesures/perf: le code produit des `console.time` avec le préfixe `[VX:fill]`. Ces logs ne sont pas asser­tis, mais peuvent aider au debug.

## Couverture actuelle

- extractor: `parsePrice`, `splitColors` (voir `extractor.test.ts`).
- messaging: tests de `sendMessage` et handler (voir `messaging.test.ts`, `messages.test.ts`).
- filler:
  - Sélection marque sans marque via `#empty-brand`.
  - Fermeture forcée du dropdown couleur après sélection (débloque la suite du remplissage).
  - Correspondance « souple » pour `material` (titre partiel accepté).

## Bonnes pratiques pour nouveaux tests

- Créez des DOM minimalistes et stables, avec les bons attributs (`data-testid`, classes `.web_ui__…`).
- Préférez des tests ciblés sur une seule responsabilité (ex: fermeture d’un menu, sélection d’une option).
- Utilisez les helpers existants du code autant que possible au lieu de réimplémenter des comportements.
- Gardez les énoncés courts et clairs; évitez l’état global persistant entre tests.

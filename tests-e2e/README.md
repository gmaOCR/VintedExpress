# Tests E2E (Playwright)

Cette suite valide les comportements réels du content-script dans un navigateur Chromium via Playwright.

## Pré-requis

- Node 18+
- Dépendances installées
- Navigateurs Playwright installés

Installation rapide:

```bash
npm install
npx playwright install --with-deps chromium
```

## Lancer

- Headless:

```bash
npm run -s e2e
```

- Avec UI (headed):

```bash
npm run -s e2e:headed
```

- UI Test Runner:

```bash
npm run -s e2e:ui
```

Les scripts buildent l’extension (Vite) puis lancent Playwright.

## Structure

- `tests-e2e/*.spec.ts`: tests Playwright
- `playwright.config.ts`: configuration (chromium, testDir)
- `dist/`: bundle de l’extension (généré par Vite)

Chaque test:

- Stubbe `chrome.*` si nécessaire (runtime/storage)
- Construit un DOM minimal reproduisant les sélecteurs Vinted utilisés
- Injecte `dist/src/content/new-listing.js` (content script)
- Fait des assertions sur le DOM après exécution

## Écriture de tests

- Préférez un DOM minimal ciblé (inputs, dropdowns, data-testid présents)
- Simulez les interactions (ouverture dropdown, clic cell) via un petit script inline
- Évitez les timers arbitraires; utilisez `page.waitForFunction` / `expect(...).toBe*`

Exemple de checklist:

- Stub du brouillon dans `chrome.storage.local.get('vx:republishDraft')`
- DOM du champ visé (ex: Material) avec `data-testid` réalistes
- Handler `click` simple: ouvrir/fermer dropdown + cocher une case lors d’un clic sur une cellule
- Injecter le script `dist/src/content/new-listing.js`
- `expect` sur l’état final (cases cochées, dropdown fermé, etc.)

## Débogage

- Lancer en headed: `npm run -s e2e:headed`
- Traces Playwright sur échec (on-first-retry)
- Activer logs extension: dans le test, avant injection, définir:

```js
await page.evaluate(() => localStorage.setItem('vx:debug', '1'));
```

## À propos des tests jsdom

Quand un scénario UI dépend étroitement d’un navigateur (checkbox réellement cochée, fermeture de dropdown), privilégiez Playwright. Les tests jsdom équivalents peuvent être supprimés s’ils doublonnent la couverture E2E.

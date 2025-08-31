# Instructions pour GitHub Copilot — Extension Chrome/Chromium (Manifest V3)

But: construire une extension Chrome/Chromium pour Vinted (Manifest V3) en TypeScript, avec lisibilité, sécurité et testabilité élevées. Copilot doit proposer une architecture claire, un typage strict et le principe du moindre privilège.

## Périmètre et principes

- Plateformes: Chrome/Chromium (Manifest V3)
- Langage: TypeScript strict (`noImplicitAny`, `strictNullChecks`)
- Bundler: Vite + plugin web extension (ex. `vite-plugin-web-extension`)
- API navigateur: utiliser `webextension-polyfill` et l’espace de noms `browser.*`
- Qualité: ESLint + @typescript-eslint + Prettier (format on save)
- Tests: Vitest (unitaires). E2E optionnels (Playwright)
- Sécurité: CSP stricte, pas d’`eval`, pas d’`innerHTML` non maîtrisé
- Confidentialité: aucune télémétrie sans opt‑in explicite

## Structure de projet souhaitée

- `public/`
  - `manifest.json` (MV3)
  - `icons/` (16, 32, 48, 128 px)
  - `_locales/` (i18n, ex. `fr/messages.json`)
- `src/`
  - `background/` service worker (`index.ts`)
  - `content/` scripts injectés (`vinted.ts`)
  - `popup/` UI popup (`main.tsx`, `index.html`)
  - `options/` page d’options (`main.tsx`, `index.html`)
  - `lib/` utilitaires (`storage.ts`, `messaging.ts`)
  - `types/` types globaux (`messages.ts`, `domain.ts`)
  - `styles/` CSS/SCSS
- `tests/` (Vitest)
- `vite.config.ts`, `tsconfig.json`, `.eslintrc.cjs`, `.prettierrc`

## Manifest V3 — règles

- Permissions minimales et ciblées (notamment `host_permissions` vers Vinted)
- Background: service worker (pas de DOM)
- Content scripts: logique DOM spécifique au site, pas de secrets
- UI (popup/options): composants simples, pas de logique métier lourde
- Messaging: bus typé entre content <-> background <-> UI

## Convention de messages typés

- Schémas (ex. Zod) pour requêtes/réponses/erreurs
- `sendMessage<TReq, TRes>()` avec validation runtime + types TS
- Gestion d’erreurs: timeouts, permissions manquantes, onglet inactif

## Stockage et migrations

- Enveloppe `storage` au‑dessus de `chrome.storage.{local,sync}` avec clés typées
- Versionner le schéma (ex. `schemaVersion`) et migrations idempotentes

## Style et qualité

- `import/order`, pas de `any`, unions discriminées, fonctions pures
- Effets aux bords (content/background/UI)
- Logs verbeux en dev, silencieux en prod
- Commits: Conventional Commits

## Tests

- Vitest pour utilitaires, parsers, storage, messaging
- Mock de `webextension-polyfill`
- E2E (optionnel) Playwright

## i18n

- Clés en anglais, valeurs traduites en `_locales/{lang}/messages.json`
- Aucun texte en dur dans le code UI

## Sécurité

- CSP par défaut MV3; éviter les sources distantes non nécessaires
- Sanitize HTML dynamique (DOMPurify) ou utiliser `textContent`
- Pas de collecte de données sans consentement explicite

## Par défaut, Copilot doit

- Proposer TypeScript strict, petites fonctions testables
- Utiliser `browser.*` via `webextension-polyfill`
- Produire du code avec JSDoc concis pour APIs publiques
- Pour content scripts: APIs DOM natives (pas de dépendances lourdes)
- Pour background: pas d’accès DOM; privilégier messaging
- Pour UI: composants fonctionnels (si React), hooks, état local minimal

## Copilot doit éviter

- Permissions trop larges (`<all_urls>` sans justification)
- `any`, désactivation globale ESLint
- Mélanger logique métier et DOM
- Accéder à `window` dans le service worker
- `eval`/`Function`/`innerHTML` non sécurisé

## Exigences de configuration

- `tsconfig`: mode strict, moduleResolution `bundler`
- ESLint: `@typescript-eslint/recommended`, `import/order`, `no-console` (sauf dev)
- Prettier: 2 espaces, 100 colonnes, trailing commas
- Vite: entrées multiples (background, content, popup, options)

## Check‑list PR

- [ ] Linter/Typecheck OK
- [ ] Tests Vitest OK
- [ ] Permissions minimales et justifiées
- [ ] i18n pour textes UI
- [ ] Commits conventionnels

Astuce: Toujours préciser dans les prompts le rôle du fichier, les permissions, les types attendus et les contraintes de sécurité.

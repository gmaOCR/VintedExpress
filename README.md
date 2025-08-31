# VintedExpress — Extension Chrome/Chromium (MV3)

Un squelette d’extension MV3 pour Vinted, pensé pour la lisibilité, la sécurité et la testabilité.

## Prérequis

- Node.js 18+ (recommandé LTS)
- VS Code avec extensions: ESLint, Prettier, EditorConfig
- Chrome/Chromium pour charger l’extension en mode développeur

## Installation

```bash
npm install
```

## Développement

- Construire en mode watch:

```bash
npm run dev
```

- Dans Chrome: Ouvrez chrome://extensions, activez « Mode développeur », cliquez « Charger l’extension non empaquetée » et sélectionnez le dossier `dist`. Pendant le développement, cliquez « Actualiser » pour recharger.

## Build

```bash
npm run build
```

## Linter, formatage, types et tests

```bash
npm run lint
npm run lint:fix
npm run format
npm run typecheck
npm test
```

## Structure

- `src/background/`: service worker MV3
- `src/content/`: scripts injectés sur Vinted
- `src/popup/`: UI de la popup
- `src/options/`: page d’options
- `src/lib/`: utilitaires (messaging, storage…)
- `src/types/`: schémas/types partagés
- `tests/`: tests Vitest

## Notes

- Les permissions sont minimales par défaut (storage + host_permissions vers \*.vinted.fr). Ajoutez d’autres domaines si nécessaire.
- Le messaging est typé via Zod. Adaptez/étendez `src/types/messages.ts`.
- Lisez `COPILOT_INSTRUCTIONS.md` pour guider GitHub Copilot.

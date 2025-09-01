# VintedExpress — Chrome/Chromium Extension (MV3)

VintedExpress helps you quickly republish a sold listing on Vinted: it adds a “Republish” button on the item page and automatically pre-fills the new item form with data extracted from the sold listing.

## What it does

- Adds a Republish button on Vinted item pages, integrated under the Delete button (with a distinct color). A floating fallback button appears only if the integrated one cannot be rendered.
- Extracts key fields from the sold listing:
  - Title, Description (cleaned; no buttons or shipping blocks)
  - Price (numeric value + best-effort currency)
  - Condition (exact label)
  - Unisex flag (checked when the original page mentions Unisex/Unisexe)
  - Brand set to “Sans marque” automatically
  - Colors (multi-select)
  - Material (single or multi-select; falls back to text input when needed)
  - Category path from the breadcrumb (excluding “Accueil”), then selects it deterministically in the form
- Pre-fills the new item form (/items/new) using the extracted data.
- Keeps the draft in `browser.storage.local` just long enough to pre-fill, then clears it.

Note: Browsers cannot auto-upload images to Vinted; we show the original image URLs in a small helper box so you can re-add them easily.

## Requirements

- Node.js 18+ (recommended LTS)
- Chrome / Chromium with Developer Mode to load the built extension

## Install

```bash
npm install
```

## Development

- Dev build with watch:

```bash
npm run dev
```

- In Chrome: open chrome://extensions, enable “Developer mode”, click “Load unpacked”, and pick the `dist` folder. Click “Refresh” on the extension card after each rebuild.

## Build

```bash
npm run build
```

## How to use

1. Open a sold item on Vinted.
2. Click the Republish button under the Delete button.
3. You’ll be redirected to the new item form (/items/new); fields are pre-filled automatically:
   - Title, Description, Price, Condition
   - Unisex checked when applicable
   - Brand set to “Sans marque”
   - Colors and Material selected from lists when available
   - Category selected by walking the category dropdown levels by exact label
4. Re-add images if needed using the helper panel with your original URLs.

## Scripts

```bash
npm run lint        # ESLint
npm run lint:fix    # ESLint with auto-fix
npm run format      # Prettier
npm run typecheck   # TS type check
npm test            # Vitest
```

## Project layout

- `src/background/`: MV3 service worker
- `src/content/`: content scripts for Vinted (item page, new item form)
- `src/popup/`: extension popup UI
- `src/options/`: extension options page
- `src/lib/`: utilities (messaging, storage, extractor, filler)
- `src/types/`: shared schemas/types (zod)
- `tests/`: Vitest tests

## Permissions & security

- Minimal permissions: `storage` and host permissions for Vinted domains.
- All cross-script messages are schema-validated with zod.
- No network calls to third parties; no secrets.

## Notes

- If a specific label in your locale doesn’t get selected (e.g., category, condition), please open an issue with a DOM snippet and the exact title text; we’ll plug in a deterministic selector for it.
- See `COPILOT_INSTRUCTIONS.md` if you want to extend the project with GitHub Copilot.

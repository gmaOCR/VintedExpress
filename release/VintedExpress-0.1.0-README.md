# VintedExpress — Chrome/Chromium Extension (MV3)

VintedExpress helps you quickly republish a sold listing on Vinted: it adds a “Republish” button on the item page and automatically pre-fills the new item form with data extracted from the sold listing.

![VintedExpress preview](docs/preview.png)

Current version: 0.1.0 — see [CHANGELOG.md](CHANGELOG.md).

## What it does

- Title, Description (cleaned; no buttons or shipping blocks)
- Price (numeric value + best-effort currency)
- Condition (exact label)
- Unisex flag (checked when the original page mentions Unisex/Unisexe)
- Brand set to “Sans marque” automatically
- Colors (multi-select)
- Material (single or multi-select; falls back to text input when needed)
- Category path from the breadcrumb (excluding “Accueil”), then selects it deterministically in the form

Note: Browsers cannot auto-upload images to Vinted; we show the original image URLs in a small helper box so you can re-add them easily.

## Requirements

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Packaged build (ZIP)

Create a zip archive ready for upload (e.g., Chrome Web Store) or sharing:

```bash
npm run package
```

The archive will be generated at `release/VintedExpress-<version>.zip` and contains the built `dist/` folder with `manifest.json` and assets.

Notes:

- For local use in Chrome/Chromium, the recommended way is still “Load unpacked” and selecting the `dist/` folder.
- Direct installation from a `.zip` is not supported by Chrome; unzip it and use “Load unpacked”, or upload the `.zip` to the Chrome Web Store.

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

## Permissions & security

## Notes

- The preview image lives in `docs/preview.png`. Replace it with your own screenshot to match your locale/theme.

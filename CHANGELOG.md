# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [0.1.0] - 2025-09-01 — Initial release

Added

- Initial release of VintedExpress.
- Republish button injected under the visible Delete action (desktop-first), with a floating fallback if needed.
- Robust data extraction from sold listings: title, cleaned description, price, condition, unisex, material, colors, category path (breadcrumb).
- Deterministic auto-fill of the new listing form (/items/new), including dropdown selection for category, condition, material, and colors.
- Draft persistence via browser.storage.local (cleared after fill).
- Minimal i18n for the Republish/Duplicate button label.
- README with usage instructions, preview image, and packaging script.

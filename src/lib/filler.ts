import type { RepublishDraft } from '../types/draft';
import { fillCategory } from './category-simple';
import { click, setInputValue, typeInputLikeUser, waitForElement } from './dom-utils';
import { closeAnyDropdowns } from './dropdown';
import { fillBrand } from './fillers/brand';
import { fillColor } from './fillers/color';
import { fillCondition } from './fillers/condition';
import { fillMaterial } from './fillers/material';
import { fillPatterns } from './fillers/patterns';
import { fillSize } from './fillers/size';
import { log, perf } from './metrics';

function sanitizeCategoryPath(path: unknown[]): string[] {
  const sanitized: string[] = [];
  for (const entry of path) {
    if (entry == null) continue;
    if (typeof entry === 'string') {
      const trimmed = entry.trim();
      if (trimmed) sanitized.push(trimmed);
      continue;
    }
    if (typeof entry === 'number') {
      sanitized.push(String(entry));
      continue;
    }
    if (typeof entry === 'object') {
      const candidate =
        typeof (entry as { label?: unknown }).label === 'string'
          ? ((entry as { label?: unknown }).label as string)
          : typeof (entry as { name?: unknown }).name === 'string'
            ? ((entry as { name?: unknown }).name as string)
            : typeof (entry as { title?: unknown }).title === 'string'
              ? ((entry as { title?: unknown }).title as string)
              : null;
      if (candidate) {
        const trimmed = candidate.trim();
        if (trimmed) sanitized.push(trimmed);
        continue;
      }
    }
    try {
      const fallback = String(entry).trim();
      if (fallback && fallback !== '[object Object]') {
        sanitized.push(fallback);
      }
    } catch {
      /* ignore */
    }
  }
  return sanitized;
}

// --- Entrée principale ---
export async function fillNewItemForm(draft: RepublishDraft) {
  type WindowWithFillState = Window & {
    __vx_fillRunning?: boolean;
    __vx_categoryRetryCount?: number;
    __vx_categoryRetryPending?: boolean;
  };

  const win = window as unknown as WindowWithFillState;

  if (win.__vx_fillRunning) {
    log('warn', 'fill:skip:already-running');
    return;
  }
  win.__vx_fillRunning = true;
  const runId = Date.now().toString(36).slice(-6);
  perf('total', 'start');
  log('info', 'fill:start', {
    url: location.href,
    hasDraft: !!draft,
    draftKeys: Object.keys(draft || {}).slice(0, 20),
    brand: (draft as Partial<RepublishDraft>).brand ?? null,
    material: (draft as Partial<RepublishDraft>).material ?? null,
    categoryPathLength: draft.categoryPath?.length ?? 0,
    priceValue: (draft as Partial<RepublishDraft>).priceValue ?? null,
    runId,
  });
  try {
    // Attendre et remplir la catégorie si fournie
    const categorySelector =
      '[data-testid="catalog-select-dropdown-input"], [data-testid="catalog-select-input"]';

    if (draft.categoryPath && draft.categoryPath.length) {
      perf('category', 'start');
      const path = sanitizeCategoryPath(draft.categoryPath ?? []);
      if (path.length) {
        // Attendre la présence du champ catégorie (page lente)
        const catInput = await waitForElement<HTMLInputElement>(categorySelector, {
          timeoutMs: 8000,
        });
        if (!catInput) {
          log('warn', 'category:input:not-found-after-wait');
        }

        const success = await fillCategory(path);
        if (!success) {
          log('warn', 'category:failed', { path });
        }

        // Unisex option (après commit catégorie)
        // Unisex option (après commit catégorie)
        try {
          const descText = (draft.description ?? '') as string;
          const looksUnisex =
            !!draft.unisex ||
            (typeof descText === 'string' && /\b(unisex|unisexe|unisexes?)\b/i.test(descText));

          if (looksUnisex) {
            const unisexSelector =
              'input[type="checkbox"]#unisex, input[type="checkbox"][name*="unisex" i], input[type="checkbox"][aria-label*="unisex" i]';
            const unisexInput = await waitForElement<HTMLInputElement>(unisexSelector, {
              timeoutMs: 3000,
            });
            if (unisexInput) {
              if (!unisexInput.checked) {
                try {
                  click(unisexInput);
                } catch {
                  // fallback: set property and dispatch events
                  try {
                    unisexInput.checked = true;
                    unisexInput.dispatchEvent(new Event('input', { bubbles: true }));
                    unisexInput.dispatchEvent(new Event('change', { bubbles: true }));
                  } catch {
                    /* ignore */
                  }
                }
                log('info', 'fill:unisex:checked');
              } else {
                log('debug', 'fill:unisex:already-checked');
              }
            } else {
              log('warn', 'fill:unisex:not-found');
            }
          }
        } catch (e) {
          log('warn', 'fill:unisex:error', { message: (e as Error)?.message ?? String(e) });
        }
      }
      perf('category', 'end');
    }

    // Remplir les champs principaux (titre/description/prix)
    const titleInput = await waitForElement<HTMLInputElement>(
      'input[name="title"], input#title, [data-testid="title--input"], [data-testid="title-input"], [data-testid="title-field-input"]',
    );
    if (titleInput && draft.title) {
      setInputValue(titleInput, draft.title);
      log('debug', 'fill:title:set', titleInput.value);
    }

    const descInput = await waitForElement<HTMLTextAreaElement>(
      'textarea[name="description"], textarea#description, [data-testid="description--input"], [data-testid="description-input"], [data-testid="description-field-input"]',
    );
    if (descInput && draft.description) {
      setInputValue(descInput, draft.description);
      log('debug', 'fill:description:set');
    }

    const priceInputRoot = await waitForElement<HTMLInputElement | HTMLElement>(
      'input[name="price"], input#price, [data-testid="price-input--input"], [data-testid="price-input"], [data-testid="price-field-input"]',
    );
    const priceInput =
      priceInputRoot instanceof HTMLInputElement || priceInputRoot instanceof HTMLTextAreaElement
        ? priceInputRoot
        : (priceInputRoot?.querySelector('input, textarea') as
            | HTMLInputElement
            | HTMLTextAreaElement
            | null);
    if (priceInput) {
      if (typeof draft.priceValue === 'number' && Number.isFinite(draft.priceValue)) {
        const priceValue = draft.priceValue;
        const primary = formatPriceForElement(priceInput, priceValue);
        const attempted: string[] = [primary];
        setInputValue(priceInput, primary);
        log('debug', 'fill:price:set', {
          mode: 'primary',
          type: priceInput instanceof HTMLInputElement ? priceInput.type : null,
          value: priceInput.value,
          primary,
        });

        const fallbacks = collectPriceFallbacks(priceValue, primary);
        fallbacks.forEach((candidate, index) => {
          const delay = 70 * (index + 1);
          attempted.push(candidate);
          setTimeout(() => {
            try {
              if (isPriceValueInvalid(priceInput.value)) {
                setInputValue(priceInput, candidate);
                log('debug', 'fill:price:fallback:set', {
                  candidate,
                  delay,
                  value: priceInput.value,
                });
              }
            } catch {
              /* ignore */
            }
          }, delay);
        });

        const typeDelay = 70 * (fallbacks.length + 2);
        setTimeout(() => {
          try {
            if (isPriceValueInvalid(priceInput.value)) {
              const typed = String(priceValue);
              attempted.push(`[type:${typed}]`);
              typeInputLikeUser(priceInput, typed);
              log('debug', 'fill:price:fallback:type', {
                typed,
                value: priceInput.value,
              });
            }
          } catch {
            /* ignore */
          }
        }, typeDelay);

        const cents = Math.round(priceValue * 100);
        const hasDigitsFallback = Number.isFinite(cents);
        const digitsDelay = typeDelay + 140;
        if (hasDigitsFallback) {
          const absDigits = String(Math.abs(cents));
          const digitsInput = priceValue < 0 ? `-${absDigits}` : absDigits;
          setTimeout(() => {
            try {
              if (isPriceValueInvalid(priceInput.value)) {
                attempted.push(`[digits:${digitsInput}]`);
                typeInputLikeUser(priceInput, digitsInput);
                log('debug', 'fill:price:fallback:type-digits', {
                  digits: digitsInput,
                  value: priceInput.value,
                });
              }
            } catch {
              /* ignore */
            }
          }, digitsDelay);
        }

        const finalCheckDelay = (hasDigitsFallback ? digitsDelay : typeDelay) + 220;
        setTimeout(() => {
          try {
            if (isPriceValueInvalid(priceInput.value)) {
              log('warn', 'fill:price:still-invalid', {
                value: priceInput.value,
                priceValue,
                attempted,
                type: priceInput instanceof HTMLInputElement ? priceInput.type : null,
              });
            }
          } catch {
            /* ignore */
          }
        }, finalCheckDelay);
      } else if (draft.priceValue != null) {
        log('warn', 'fill:price:non-numeric', { priceValue: draft.priceValue });
      } else {
        log('debug', 'fill:price:skip:missing');
      }
    }

    // Champs dépendants: remplir dans l'ordre
    const seq = async (label: keyof RepublishDraft, fn: () => Promise<void>) => {
      log('debug', `dep:${label}:start`);
      try {
        await fn();
      } catch (e) {
        log('warn', `dep:${label}:error`, { message: (e as Error)?.message });
      }
      log('debug', `dep:${label}:end`);
    };

    await seq('brand', () => fillBrand(draft));
    await seq('size', () => fillSize(draft));
    await seq('condition', () => fillCondition(draft));
    await seq('color', () => fillColor(draft));
    await seq('material', () => fillMaterial(draft));
    await seq('patterns', () => fillPatterns(draft));

    // Pas de pause inutile: laisser la page réagir naturellement

    perf('total', 'end');
    log('info', 'fill:end', { runId });
    try {
      await closeAnyDropdowns();
    } catch {
      /* ignore */
    }
  } finally {
    win.__vx_fillRunning = false;
  }
}

// Section helpers historique supprimée (déplacée dans ./fillers et utilitaires)

function formatPriceForLocale(value: number): string {
  const lang = (document.documentElement.getAttribute('lang') || '').trim().toLowerCase();
  const split = lang ? lang.split('-') : [];
  const base = split.length > 0 ? split[0] : '';
  const locale = base || lang || 'en';
  const localesPreferComma = new Set(['fr', 'de', 'es', 'it', 'pt', 'pl', 'nl', 'lt', 'cs']);
  const isInteger = Number.isInteger(value);

  if (localesPreferComma.has(locale)) {
    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: isInteger ? 0 : 2,
      maximumFractionDigits: isInteger ? 0 : 2,
    });
    return formatter.format(value);
  }

  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: isInteger ? 0 : 2,
    maximumFractionDigits: isInteger ? 0 : 2,
  });
  return formatter.format(value);
}

function formatPriceForElement(el: HTMLInputElement | HTMLTextAreaElement, value: number): string {
  const input = el instanceof HTMLInputElement ? el : null;
  const type = input?.type?.toLowerCase?.() ?? '';
  const inputMode = input?.inputMode?.toLowerCase?.() ?? '';
  const preferPlain =
    type === 'number' ||
    inputMode === 'decimal' ||
    inputMode === 'numeric' ||
    inputMode === 'tel' ||
    el.getAttribute('inputmode')?.toLowerCase?.() === 'decimal';

  if (preferPlain) {
    if (Number.isInteger(value)) {
      return String(Math.trunc(value));
    }
    return value.toFixed(2);
  }

  return formatPriceForLocale(value);
}

function collectPriceFallbacks(value: number, primary: string): string[] {
  const candidates = new Set<string>();
  candidates.add(String(value));
  if (!Number.isInteger(value)) {
    candidates.add(value.toFixed(2));
  } else {
    candidates.add(`${value}.00`);
  }
  candidates.add(formatPriceForLocale(value));
  try {
    const locales = ['fr-FR', 'en-US', 'de-DE'];
    for (const locale of locales) {
      const formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
      }).format(value);
      candidates.add(formatted);
    }
  } catch {
    /* ignore */
  }
  candidates.delete(primary);
  return Array.from(candidates).filter(Boolean);
}

function isPriceValueInvalid(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return true;
  const normalized = value.replace(/\s+/g, '').toLowerCase();
  if (!normalized.length) return true;
  if (normalized.includes('nan')) return true;
  if (normalized === 'undefined' || normalized === 'null') return true;
  return false;
}

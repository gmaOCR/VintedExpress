import { RepublishDraft } from '../types/draft';

export function parsePrice(text: string | null | undefined): { value?: number; currency?: string } {
  if (!text) return {};
  const raw = text.replace(/\s+/g, ' ').trim();
  // Extraire monnaie et valeur, ex: "22,00 €", "€7.50" ou "23,80 EUR"
  const match = raw.match(
    /(?:\b|^)(?:\s*)(€|eur|euro|euros|usd|£|gbp|chf)?\s*([0-9]+(?:[.,][0-9]{1,2})?)\s*(€|eur|euro|euros|usd|£|gbp|chf)?/i,
  );
  if (!match) return {};
  const [, leadingCurrency, numericPart, trailingCurrency] = match;
  const numStr = numericPart?.replace(',', '.') ?? '';
  const value = Number.parseFloat(numStr);
  const currencyRaw = trailingCurrency ?? leadingCurrency;
  const upperCurrency = currencyRaw?.toUpperCase();
  const currency = upperCurrency === '€' ? 'EUR' : upperCurrency;
  return { value: Number.isFinite(value) ? value : undefined, currency };
}

export function splitColors(text: string | null | undefined): string[] | undefined {
  if (!text) return undefined;
  const v = text
    .split(/,|\/|·|•|\u2022|\u00B7|\s+\/\s+|\s*\+\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return v.length ? v : undefined;
}

export function extractDraftFromDocument(doc: Document): RepublishDraft {
  const queryText = (selector: string) =>
    (doc.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();

  // Titre
  const title = queryText('[data-testid="item-title"], .box--item-details h1, h1');

  // Description (dépliée si possible, sans inclure les blocs "Envoi", boutons, etc.)
  let description = '';
  const descContainer =
    doc.querySelector('[itemprop="description"]') ||
    doc.querySelector('[data-testid="item-description"]') ||
    doc.querySelector('.Item__description');
  if (descContainer) {
    // Essayer d’étendre si un bouton "... plus" est présent
    const expandBtn = Array.from(descContainer.querySelectorAll('button')).find((b) =>
      /plus|more|mehr|más|più|meer/i.test(b.textContent ?? ''),
    ) as HTMLButtonElement | undefined;
    try {
      expandBtn?.click();
    } catch {
      // ignore
    }
    // Cloner et supprimer les boutons pour éviter de capturer leur libellé
    const clone = descContainer.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('button').forEach((b) => b.remove());
    description = (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  // Prix
  const priceText = (
    doc.querySelector(
      '[data-testid="item-price"], [data-testid="item-price"] p, .details-list--pricing',
    )?.textContent ?? ''
  ).trim();
  const { value: priceValue, currency } = parsePrice(priceText);

  // Condition
  const condition = (
    doc.querySelector(
      '[data-testid="item-attributes-status"] [itemprop="status"], [data-testid="item-attributes-status"] .details-list__item-value:last-child',
    )?.textContent ?? ''
  )
    .replace(/\s+/g, ' ')
    .trim();

  // Taille
  const size =
    (
      doc.querySelector(
        '[data-testid="item-attributes-size"] [itemprop="size"], [data-testid="item-attributes-size"] .details-list__item-value:last-child',
      )?.textContent ?? ''
    )
      .replace(/\s+/g, ' ')
      .trim() || undefined;

  // Matière
  const material =
    (
      doc.querySelector(
        '[data-testid="item-attributes-material"] [itemprop="material"], [data-testid="item-attributes-material"] .details-list__item-value:last-child',
      )?.textContent ?? ''
    )
      .replace(/\s+/g, ' ')
      .trim() || undefined;

  // Couleur(s)
  const colorText = (
    doc.querySelector(
      '[data-testid="item-attributes-color"] [itemprop="color"], [data-testid="item-attributes-color"] .details-list__item-value:last-child',
    )?.textContent ?? ''
  )
    .replace(/\s+/g, ' ')
    .trim();
  const color = splitColors(colorText);

  // Images
  const images = Array.from(
    doc.querySelectorAll<HTMLImageElement>('[data-testid^="item-photo-"] img, .item-photos img'),
  )
    .map((img) => img.src)
    .filter(Boolean);

  // Breadcrumbs -> catégories
  const rawCategoryPath = Array.from(
    doc.querySelectorAll<HTMLLIElement>(
      '.breadcrumbs li [itemprop="title"], .breadcrumbs li span, .breadcrumbs__item span',
    ),
  )
    .map((el) => el.textContent?.trim() ?? '')
    .filter((t) => {
      const v = (t || '').trim().toLowerCase();
      return v && v !== 'accueil' && v !== 'home';
    });
  const categoryPath = compactCategoryPath(rawCategoryPath);

  // Unisexe: présent parfois près du titre ou dans un indicateur de genre
  // Heuristiques: chercher un badge/libellé "Unisexe"/"Unisex" dans l'en-tête
  let unisex: boolean | undefined = undefined;
  try {
    const header = doc.querySelector('h1')?.parentElement ?? doc.body ?? doc;
    const text = (header?.textContent ?? '').toLowerCase();
    if (/\bunisexe\b|\bunisex\b/.test(text)) {
      unisex = true;
    }
  } catch {
    // ignore
  }

  return {
    title,
    description,
    images: dedupeImages(images),
    priceValue,
    currency,
    condition: condition || undefined,
    size,
    material,
    color,
    categoryPath: categoryPath.length ? categoryPath : undefined,
    unisex,
  };
}

export function extractDraftFromItemPage(): RepublishDraft {
  return extractDraftFromDocument(document);
}

function compactCategoryPath(path: string[]): string[] {
  if (!path.length) return path;
  const normalized = path.map((label) => label.trim()).filter((label) => label.length > 0);
  if (normalized.length <= 1) return normalized;

  const collapsed = normalized.filter((label, index) => {
    if (index === 0) return true;
    return label !== normalized[index - 1];
  });

  for (let blockSize = 1; blockSize <= collapsed.length / 2; blockSize += 1) {
    if (collapsed.length % blockSize !== 0) continue;
    const block = collapsed.slice(0, blockSize);
    let matches = true;
    for (let i = 0; i < collapsed.length; i += 1) {
      if (collapsed[i] !== block[i % blockSize]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return block;
    }
  }

  return collapsed;
}

function dedupeImages(urls: string[]): string[] {
  if (urls.length <= 1) return urls;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

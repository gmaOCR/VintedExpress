import { RepublishDraft } from '../types/draft';

export function parsePrice(text: string | null | undefined): { value?: number; currency?: string } {
  if (!text) return {};
  const raw = text.replace(/\s+/g, ' ').trim();
  // Extraire monnaie et valeur, ex: "22,00 €" ou "23,80 €"
  const match = raw.match(/([0-9]+(?:[.,][0-9]{1,2})?)\s*(€|eur|euro|euros|usd|£|gbp|chf)/i);
  if (!match) return {};
  const numStr = match[1]?.replace(',', '.') ?? '';
  const value = Number.parseFloat(numStr);
  const currency = match[2]?.toUpperCase() === '€' ? 'EUR' : match[2]?.toUpperCase();
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

export function extractDraftFromItemPage(): RepublishDraft {
  // Titre
  const title = (
    document.querySelector('[data-testid="item-title"], .box--item-details h1, h1')?.textContent ??
    ''
  ).trim();

  // Description (dépliée si possible, sans inclure les blocs "Envoi", boutons, etc.)
  let description = '';
  const descContainer =
    document.querySelector('[itemprop="description"]') ||
    document.querySelector('[data-testid="item-description"]') ||
    document.querySelector('.Item__description');
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
    document.querySelector(
      '[data-testid="item-price"], [data-testid="item-price"] p, .details-list--pricing',
    )?.textContent ?? ''
  ).trim();
  const { value: priceValue, currency } = parsePrice(priceText);

  // Condition
  const condition = (
    document.querySelector(
      '[data-testid="item-attributes-status"] [itemprop="status"], [data-testid="item-attributes-status"] .details-list__item-value:last-child',
    )?.textContent ?? ''
  )
    .replace(/\s+/g, ' ')
    .trim();

  // Taille
  const size =
    (
      document.querySelector(
        '[data-testid="item-attributes-size"] [itemprop="size"], [data-testid="item-attributes-size"] .details-list__item-value:last-child',
      )?.textContent ?? ''
    )
      .replace(/\s+/g, ' ')
      .trim() || undefined;

  // Matière
  const material =
    (
      document.querySelector(
        '[data-testid="item-attributes-material"] [itemprop="material"], [data-testid="item-attributes-material"] .details-list__item-value:last-child',
      )?.textContent ?? ''
    )
      .replace(/\s+/g, ' ')
      .trim() || undefined;

  // Couleur(s)
  const colorText = (
    document.querySelector(
      '[data-testid="item-attributes-color"] [itemprop="color"], [data-testid="item-attributes-color"] .details-list__item-value:last-child',
    )?.textContent ?? ''
  )
    .replace(/\s+/g, ' ')
    .trim();
  const color = splitColors(colorText);

  // Images
  const images = Array.from(
    document.querySelectorAll<HTMLImageElement>(
      '[data-testid^="item-photo-"] img, .item-photos img',
    ),
  )
    .map((img) => img.src)
    .filter(Boolean);

  // Breadcrumbs -> catégories
  const categoryPath = Array.from(
    document.querySelectorAll<HTMLLIElement>(
      '.breadcrumbs li [itemprop="title"], .breadcrumbs li span, .breadcrumbs__item span',
    ),
  )
    .map((el) => el.textContent?.trim() ?? '')
    .filter((t) => {
      const v = (t || '').trim().toLowerCase();
      return v && v !== 'accueil' && v !== 'home';
    });

  // Unisexe: présent parfois près du titre ou dans un indicateur de genre
  // Heuristiques: chercher un badge/libellé "Unisexe"/"Unisex" dans l'en-tête
  let unisex: boolean | undefined = undefined;
  try {
    const header = document.querySelector('h1')?.parentElement ?? document.body;
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
    images,
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

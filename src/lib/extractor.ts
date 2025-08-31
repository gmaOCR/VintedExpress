import { RepublishDraft } from '../types/draft';

function parsePrice(text: string | null | undefined): { value?: number; currency?: string } {
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

function splitColors(text: string | null | undefined): string[] | undefined {
  if (!text) return undefined;
  const v = text
    .split(/,|\/|·|•|\u2022|\u00B7/)
    .map((s) => s.trim())
    .filter(Boolean);
  return v.length ? v : undefined;
}

export function extractDraftFromItemPage(): RepublishDraft {
  // Titre
  const title = (
    document.querySelector('[data-testid="item-title"], .box--item-details h1, h1')?.textContent ?? ''
  ).trim();

  // Description (dépliée si possible)
  const descNode =
    document.querySelector('[data-testid="item-description"], [itemprop="description"], .details-list__info [itemprop="description"], .details-list__info') ||
    document.querySelector('.Item__description');
  const description = (descNode?.textContent ?? '').trim();

  // Prix
  const priceText = (
    document.querySelector('[data-testid="item-price"], [data-testid="item-price"] p, .details-list--pricing')?.textContent ?? ''
  ).trim();
  const { value: priceValue, currency } = parsePrice(priceText);

  // Condition
  const condition = (
    document.querySelector('[data-testid="item-attributes-status"] [itemprop="status"], [data-testid="item-attributes-status"] .details-list__item-value:last-child')?.textContent ?? ''
  )
    .replace(/\s+/g, ' ')
    .trim();

  // Matière
  const material = (
    document.querySelector('[data-testid="item-attributes-material"] [itemprop="material"], [data-testid="item-attributes-material"] .details-list__item-value:last-child')?.textContent ?? ''
  )
    .replace(/\s+/g, ' ')
    .trim() || undefined;

  // Couleur(s)
  const colorText = (
    document.querySelector('[data-testid="item-attributes-color"] [itemprop="color"], [data-testid="item-attributes-color"] .details-list__item-value:last-child')?.textContent ?? ''
  )
    .replace(/\s+/g, ' ')
    .trim();
  const color = splitColors(colorText);

  // Images
  const images = Array.from(
    document.querySelectorAll<HTMLImageElement>('[data-testid^="item-photo-"] img, .item-photos img')
  )
    .map((img) => img.src)
    .filter(Boolean);

  // Breadcrumbs -> catégories
  const categoryPath = Array.from(
    document.querySelectorAll<HTMLLIElement>('.breadcrumbs li [itemprop="title"], .breadcrumbs li span, .breadcrumbs__item span')
  )
    .map((el) => el.textContent?.trim() ?? '')
    .filter((t) => t && t.toLowerCase() !== 'accueil');

  return {
    title,
    description,
    images,
    priceValue,
    currency,
    condition: condition || undefined,
    material,
    color,
    categoryPath: categoryPath.length ? categoryPath : undefined,
  };
}

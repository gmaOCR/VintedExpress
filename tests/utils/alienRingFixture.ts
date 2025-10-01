import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parsePrice, splitColors } from '../../src/lib/extractor';
import type { RepublishDraft } from '../../src/types/draft';

const fixturePath = join(__dirname, '..', 'fixtures', 'alien-ring-item.html');
export const alienRingFixtureHtml = readFileSync(fixturePath, 'utf-8');

type AlienRingFixtureData = {
  title: string;
  description: string;
  priceText: string;
  priceValue?: number;
  currency?: string;
  condition?: string;
  size?: string;
  material?: string;
  color?: string[];
  categoryPath: string[];
  images: string[];
};

function dedupe<T>(values: (T | null | undefined)[]): T[] {
  const out: T[] = [];
  for (const value of values) {
    if (value == null) continue;
    if (!out.includes(value)) {
      out.push(value);
    }
  }
  return out;
}

function extractFixtureData(): AlienRingFixtureData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(alienRingFixtureHtml, 'text/html');
  const text = (selector: string) => (doc.querySelector(selector)?.textContent ?? '').trim();

  const title = text('[data-testid="item-title"], .box--item-details h1, h1');
  const descriptionElement = doc.querySelector('[itemprop="description"]');
  let description = '';
  if (descriptionElement) {
    const clone = descriptionElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('button').forEach((btn) => btn.remove());
    description = (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  const priceText = text('[data-testid="item-price"], [data-testid="item-price"] p');
  const { value: priceValue, currency } = parsePrice(priceText);

  const condition =
    text(
      '[data-testid="item-attributes-status"] [itemprop="status"], [data-testid="item-attributes-status"] .details-list__item-value:last-child',
    ) || undefined;
  const size =
    text(
      '[data-testid="item-attributes-size"] [itemprop="size"], [data-testid="item-attributes-size"] .details-list__item-value:last-child',
    ) || undefined;
  const material =
    text(
      '[data-testid="item-attributes-material"] [itemprop="material"], [data-testid="item-attributes-material"] .details-list__item-value:last-child',
    ) || undefined;
  const colorText =
    text(
      '[data-testid="item-attributes-color"] [itemprop="color"], [data-testid="item-attributes-color"] .details-list__item-value:last-child',
    ) || '';
  const color = splitColors(colorText);

  const categoryPath = Array.from(
    doc.querySelectorAll(
      '.breadcrumbs li [itemprop="title"], .breadcrumbs li span, .breadcrumbs__item span',
    ),
  )
    .map((element) => (element.textContent ?? '').trim())
    .filter((label) => {
      const normalized = label.toLowerCase();
      return normalized.length > 0 && normalized !== 'home';
    });

  const images = dedupe(
    Array.from(doc.querySelectorAll('[data-testid^="item-photo-"] img, .item-photos img')).map(
      (el) => el.getAttribute('src'),
    ),
  );

  return {
    title,
    description,
    priceText,
    priceValue,
    currency: currency === '€' ? 'EUR' : currency,
    condition,
    size,
    material,
    color,
    categoryPath,
    images,
  };
}

export const alienRingFixture = extractFixtureData();

export function createAlienRingDraft(overrides: Partial<RepublishDraft> = {}): RepublishDraft {
  const draft: RepublishDraft = {
    title: alienRingFixture.title,
    description: alienRingFixture.description,
    priceValue: alienRingFixture.priceValue,
    currency: alienRingFixture.currency,
    categoryPath: alienRingFixture.categoryPath,
    condition: alienRingFixture.condition,
    size: alienRingFixture.size,
    material: alienRingFixture.material,
    color: alienRingFixture.color,
    images: alienRingFixture.images,
    ...overrides,
  } as RepublishDraft;

  return draft;
}

export function cloneAlienRingDocument(): Document {
  const parser = new DOMParser();
  return parser.parseFromString(alienRingFixtureHtml, 'text/html');
}

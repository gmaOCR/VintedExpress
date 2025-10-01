import { beforeEach, describe, expect, it } from 'vitest';

import { extractDraftFromItemPage } from '../src/lib/extractor';
import { alienRingFixture, alienRingFixtureHtml } from './utils/alienRingFixture';

describe('extractDraftFromItemPage (integration)', () => {
  beforeEach(() => {
    document.documentElement.setAttribute('lang', 'en');
    document.body.innerHTML = alienRingFixtureHtml;
  });

  it("extrait un brouillon réaliste depuis la page de l'annonce", () => {
    const draft = extractDraftFromItemPage();

    expect(draft.title).toBe(alienRingFixture.title);
    expect(draft.description).toContain(alienRingFixture.description);
    expect(draft.priceValue).toBe(alienRingFixture.priceValue);
    expect(draft.currency).toBe(alienRingFixture.currency);
    expect(draft.condition).toBe(alienRingFixture.condition);
    expect(draft.size).toBe(alienRingFixture.size);
    expect(draft.material).toBe(alienRingFixture.material);
    expect(draft.color).toEqual(alienRingFixture.color);
    expect(draft.images).toEqual(alienRingFixture.images);
    expect(draft.categoryPath).toEqual(alienRingFixture.categoryPath);
    expect(draft.unisex).toBeUndefined();
  });
});

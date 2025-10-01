import { describe, expect, it } from 'vitest';

import { parsePrice, splitColors } from '../src/lib/extractor';
import { alienRingFixture } from './utils/alienRingFixture';

describe('extractor helpers', () => {
  it('parsePrice extrait correctement le prix de la fixture', () => {
    expect(parsePrice(alienRingFixture.priceText)).toEqual({
      value: alienRingFixture.priceValue,
      currency: alienRingFixture.currency,
    });
  });

  it('parsePrice retourne un objet vide sur texte invalide', () => {
    expect(parsePrice('Not a price')).toEqual({});
  });

  it('splitColors découpe les couleurs de la fixture', () => {
    expect(splitColors(alienRingFixture.color?.join(', ') ?? '')).toEqual(alienRingFixture.color);
  });

  it('splitColors supporte différents séparateurs', () => {
    expect(splitColors('Gris, Argenté')).toEqual(['Gris', 'Argenté']);
    expect(splitColors('Rouge / Noir')).toEqual(['Rouge', 'Noir']);
    expect(splitColors('Bleu · Marine')).toEqual(['Bleu', 'Marine']);
  });
});

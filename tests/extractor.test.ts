import { describe, expect, it } from 'vitest';

import { parsePrice, splitColors } from '../src/lib/extractor';

defineSuite();

function defineSuite() {
  describe('extractor helpers', () => {
    it('parsePrice handles euro with comma', () => {
      expect(parsePrice('22,00 €')).toEqual({ value: 22, currency: 'EUR' });
      expect(parsePrice('23,80 EUR')).toEqual({ value: 23.8, currency: 'EUR' });
    });

    it('parsePrice returns empty on invalid', () => {
      expect(parsePrice('Not a price')).toEqual({});
    });

    it('splitColors splits by common separators', () => {
      expect(splitColors('Gris, Argenté')).toEqual(['Gris', 'Argenté']);
      expect(splitColors('Rouge / Noir')).toEqual(['Rouge', 'Noir']);
      expect(splitColors('Bleu · Marine')).toEqual(['Bleu', 'Marine']);
    });
  });
}

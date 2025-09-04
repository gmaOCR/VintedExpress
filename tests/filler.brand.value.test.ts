import { beforeEach, describe, expect, it } from 'vitest';

import { fillNewItemForm } from '../src/lib/filler';

function makeVisible() {
  // Force visibility for jsdom
  (HTMLElement.prototype as unknown as { getClientRects: () => DOMRectList }).getClientRects =
    function () {
      return [
        { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 },
      ] as unknown as DOMRectList;
    };
}

describe('brand selection writes value to input', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear?.();
    makeVisible();
  });

  it('sets the brand input value after selection (e2e fallback enabled)', async () => {
    // Simule un dropdown de marque minimal
    document.body.innerHTML = `
      <input name="title" />
      <textarea name="description"></textarea>
      <input name="price" />
      <div class="input-dropdown">
        <div class="web_ui__Item__item">
          <input name="brand" id="brand" />
          <div data-testid="brand-select-dropdown-chevron-down"></div>
        </div>
      </div>
      <div class="input-dropdown" data-testid="brand-select-dropdown-content">
        <div role="option" class="web_ui__Cell__cell"><span class="web_ui__Cell__title">Nike</span></div>
      </div>
    `;

    // Activer fallback e2e au besoin
    localStorage.setItem('vx:e2e', '1');

    await fillNewItemForm({
      title: 't',
      description: 'd',
      images: [],
      brand: 'Nike',
    } as unknown as Parameters<typeof fillNewItemForm>[0]);

    const brandInput = document.querySelector<HTMLInputElement>('input[name="brand"],#brand');
    expect(brandInput).toBeTruthy();
    expect(brandInput!.value.trim()).toBe('Nike');
  });
});

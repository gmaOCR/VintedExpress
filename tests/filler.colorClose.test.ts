import { beforeEach, describe, expect, it } from 'vitest';

import { fillNewItemForm } from '../src/lib/filler';

function makeVisible() {
  (HTMLElement.prototype as unknown as { getClientRects: () => DOMRectList }).getClientRects =
    function () {
      return [
        { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 },
      ] as unknown as DOMRectList;
    };
}

describe('color dropdown closing', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear?.();
    makeVisible();
  });

  it('closes the color dropdown after selecting values', async () => {
    document.body.innerHTML = `
      <input name="title" />
      <textarea name="description"></textarea>
      <input name="price" />
      <div>
        <div>
          <input name="color" id="color" data-testid="color-select-dropdown-input" />
        </div>
      </div>
      <div class="input-dropdown" data-testid="color-select-dropdown-content">
        <div class="web_ui__Cell__cell" role="button" tabindex="0">
          <div class="web_ui__Cell__content"><div class="web_ui__Cell__title">Black</div></div>
          <div class="web_ui__Cell__suffix"><label class="web_ui__Checkbox__checkbox"><input type="checkbox"/></label></div>
        </div>
        <div class="web_ui__Cell__cell" role="button" tabindex="0">
          <div class="web_ui__Cell__content"><div class="web_ui__Cell__title">Grey</div></div>
          <div class="web_ui__Cell__suffix"><label class="web_ui__Checkbox__checkbox"><input type="checkbox"/></label></div>
        </div>
      </div>
    `;

    const draft = {
      title: 't',
      description: 'd',
      images: [],
      color: ['Black', 'Grey'],
    };
    await fillNewItemForm(draft);
    // Après remplissage, le contenu du dropdown doit avoir disparu (forceCloseDropdown)
    const node = document.querySelector(
      '[data-testid="color-select-dropdown-content"]',
    ) as HTMLElement | null;
    if (!node) {
      expect(node).toBeNull();
    } else {
      const style = window.getComputedStyle
        ? window.getComputedStyle(node)
        : ({} as CSSStyleDeclaration);
      expect(['none', 'hidden', '0']).toContain(
        style.display === 'none'
          ? 'none'
          : style.visibility === 'hidden'
            ? 'hidden'
            : style.opacity === '0'
              ? '0'
              : '',
      );
    }
  }, 10000);
});

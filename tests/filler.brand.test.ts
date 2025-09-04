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

describe('brand selection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear?.();
    makeVisible();
  });

  it('clicks #empty-brand immediately when draft.brand is empty', async () => {
    // Minimal required fields to avoid timeouts
    document.body.innerHTML = `
      <input name="title" />
      <textarea name="description"></textarea>
      <input name="price" />
      <div>
        <div>
          <input name="brand" id="brand" />
        </div>
      </div>
      <div class="input-dropdown" data-testid="brand-select-dropdown-content">
        <div id="empty-brand" role="button" tabindex="0">List without brand</div>
      </div>
    `;

    const btn = document.getElementById('empty-brand')!;
    const clicked = { count: 0 };
    btn.addEventListener('click', () => (clicked.count += 1));

    await fillNewItemForm({
      title: 't',
      description: 'd',
      images: [],
      brand: undefined,
    });

    expect(clicked.count).toBeGreaterThan(0);
  });
});

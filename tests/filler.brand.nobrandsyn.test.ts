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

describe('brand selection when original listing has no brand', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear?.();
    makeVisible();
  });

  it('selects a known synonym ("Sans marque") when #empty-brand is not present', async () => {
    document.body.innerHTML = `
      <input name="title" />
      <textarea name="description"></textarea>
      <input name="price" />
      <div>
        <div>
          <input name="brand" id="brand" />
          <div data-testid="brand-select-dropdown-chevron-down"></div>
        </div>
      </div>
      <div class="input-dropdown" data-testid="brand-select-dropdown-content">
        <button role="button">Sans marque</button>
        <button role="button">Autre marque</button>
      </div>
    `;

    const target = Array.from(document.querySelectorAll('button')).find((b) =>
      (b.textContent || '').toLowerCase().includes('sans marque'),
    )!;
    const clicked = { count: 0 };
    target.addEventListener('click', () => (clicked.count += 1));

    await fillNewItemForm({ title: 't', description: 'd', images: [], brand: '' });

    expect(clicked.count).toBeGreaterThan(0);
  });

  it('clicks the last option if no known empty-brand option exists', async () => {
    document.body.innerHTML = `
      <input name="title" />
      <textarea name="description"></textarea>
      <input name="price" />
      <div>
        <div>
          <input name="brand" id="brand" />
          <div data-testid="brand-select-dropdown-chevron-down"></div>
        </div>
      </div>
      <div class="input-dropdown" data-testid="brand-select-dropdown-content">
        <div role="option">Foo</div>
        <div role="option">Bar</div>
        <div role="option">Baz</div>
      </div>
    `;

    const options = Array.from(document.querySelectorAll('[role="option"]')) as HTMLElement[];
    const last = options[options.length - 1]!;
    const clicks = { count: 0 };
    last.addEventListener('click', () => (clicks.count += 1));

    await fillNewItemForm({ title: 't', description: 'd', images: [], brand: '' });

    expect(clicks.count).toBeGreaterThan(0);
  }, 10000);
});

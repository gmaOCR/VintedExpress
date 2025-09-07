import { beforeEach, describe, expect, it } from 'vitest';

import { fillSize } from '../src/lib/fillers/size';
import type { RepublishDraft } from '../src/types/draft';

function mountSizeDOM(labels = ['S', 'M', 'L']) {
  document.body.innerHTML = `
    <div>
      <input data-testid="size-select-dropdown-input" type="text" />
      <div data-testid="size-select-dropdown-content">
        <ul class="web_ui__List__list">
          ${labels
            .map(
              (l) => `<li>
              <div class="web_ui__Cell__cell" role="button">
                <div class="web_ui__Cell__content">
                  <div class="web_ui__Cell__heading">
                    <div class="web_ui__Cell__title">${l}</div>
                  </div>
                </div>
              </div>
            </li>`,
            )
            .join('')}
        </ul>
      </div>
    </div>`;
  document
    .querySelectorAll('.web_ui__Cell__cell')
    .forEach((c) => c.addEventListener('click', () => c.classList.add('is-selected')));
}

describe('fillSize force value fallback', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('force une valeur size si input reste vide après sélection UI', async () => {
    mountSizeDOM();
    const draft = { size: 'M' } as RepublishDraft;
    // Simule un clic sur l'option M (2ème cellule)
    const mid = Array.from(document.querySelectorAll('.web_ui__Cell__cell'))[1] as HTMLElement;
    mid.click();
    await fillSize(draft);
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="size-select-dropdown-input"]',
    );
    expect(input).toBeTruthy();
    expect(input!.value).toBe('M');
  });
});

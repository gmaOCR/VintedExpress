import { beforeEach, describe, expect, it } from 'vitest';

import { fillMaterial } from '../src/lib/fillers/material';
import type { RepublishDraft } from '../src/types/draft';

function mountMaterialDOM(label = 'Métal') {
  document.body.innerHTML = `
    <div>
      <div class="input-wrapper">
        <input data-testid="material-multi-list-dropdown-input" type="text" />
        <div data-testid="material-multi-list-dropdown-content">
          <ul class="web_ui__List__list">
            <li>
              <div class="web_ui__Cell__cell" role="button">
                <div class="web_ui__Cell__content">
                  <div class="web_ui__Cell__heading">
                    <div class="web_ui__Cell__title">${label}</div>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>`;
  const cell = document.querySelector('.web_ui__Cell__cell') as HTMLElement;
  cell.addEventListener('click', () => {
    cell.classList.add('is-selected');
    // Simule l'absence de mise à jour de input.value par le site
  });
}

describe('fillMaterial force value fallback', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it("force une valeur finale quand l'UI ne met pas input.value à jour", async () => {
    mountMaterialDOM('Métal');
    const draft = { material: 'Métal' } as RepublishDraft;
    // simulate selection before calling filler (cas réel: l'utilisateur / script clique)
    const cell = document.querySelector('.web_ui__Cell__cell') as HTMLElement;
    cell.click();
    await fillMaterial(draft);
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="material-multi-list-dropdown-input"]',
    );
    expect(input).toBeTruthy();
    expect(input!.value).toBe('Métal');
  });
});

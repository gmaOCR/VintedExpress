import { describe, expect, it } from 'vitest';

import { fillMaterial } from '../src/lib/fillers/material';
import type { RepublishDraft } from '../src/types/draft';

function mountNewMaterialUI() {
  document.body.innerHTML = `
    <div class="c-input c-input--wide c-input--transparent">
      <label for="material" class="c-input__title">Matière (recommandé)</label>
      <div class="c-input__content">
        <input
          data-testid="material-multi-list-dropdown-input"
          id="material"
          name="material"
          readonly
          placeholder="Sélectionne jusqu'à 3 options"
          value=""
        />
        <div data-testid="material-multi-list-dropdown-content">
          <ul>
            <li data-testid="material-multi-list-dropdown-row">
              <button type="button" data-testid="material-multi-list-dropdown-row-button">
                <span data-testid="material-multi-list-dropdown-row-label">Métal</span>
                <input type="checkbox" value="Métal" />
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  `;

  const button = document.querySelector<HTMLButtonElement>(
    '[data-testid="material-multi-list-dropdown-row-button"]',
  );
  const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (button && checkbox) {
    button.addEventListener('click', () => {
      checkbox.checked = true;
    });
  }
}

describe('fillMaterial with new dropdown markup', () => {
  it('sélectionne la matière au lieu de laisser le champ vide', async () => {
    mountNewMaterialUI();
    const draft: RepublishDraft = {
      material: 'Métal',
    } as RepublishDraft;

    await fillMaterial(draft);

    const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="material-multi-list-dropdown-input"]',
    );
    expect(checkbox).toBeTruthy();
    expect(checkbox!.checked).toBe(true);
    expect(input).toBeTruthy();
    expect(input!.value).toBe('Métal');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as domUtils from '../src/lib/dom-utils';
import { fillNewItemForm } from '../src/lib/filler';
import type { RepublishDraft } from '../src/types/draft';
import { alienRingFixture, createAlienRingDraft } from './utils/alienRingFixture';

function mountNewListingV3Dom() {
  document.body.innerHTML = `
    <main>
      <form>
        <div>
          <label for="title">Titre</label>
          <input id="title" name="title" />
        </div>
        <div>
          <label for="description">Description</label>
          <textarea id="description" name="description"></textarea>
        </div>
        <div>
          <label for="price">Prix</label>
          <input data-testid="price-input--input" id="price" name="price" />
        </div>

        <div data-testid="catalog-v3">
          <input
            data-testid="catalog-select-input"
            id="category"
            name="category"
            readonly
            value=""
          />
          <div data-testid="catalog-select-panel">
            <button type="button" data-testid="catalog-select-option">Bijoux</button>
            <button type="button" data-testid="catalog-select-option">Bagues</button>
          </div>
        </div>

        <div data-testid="brand-multi-list">
          <input
            data-testid="brand-multi-list-dropdown-input"
            id="brand"
            name="brand"
            readonly
            value=""
          />
          <div data-testid="brand-multi-list-dropdown-content">
            <ul>
              <li>
                <button type="button" data-testid="brand-multi-list-dropdown-row-button">
                  <span data-testid="brand-multi-list-dropdown-row-label">Alienware</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div data-testid="size-combobox">
          <input
            data-testid="size-combobox-input"
            id="size"
            name="size"
            value=""
            readonly
          />
          <div data-testid="size-combobox-content">
            <ul>
              <li>
                <button type="button" data-testid="size-combobox-row-button">
                  <span data-testid="size-combobox-row-label">Taille unique</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div data-testid="condition-v2">
          <input
            data-testid="condition-v2-dropdown-input"
            id="condition"
            name="condition"
            readonly
            value=""
          />
          <div data-testid="condition-v2-dropdown-content">
            <button type="button" data-testid="condition-v2-option">Très bon état</button>
          </div>
        </div>

        <div data-testid="color-picker">
          <input data-testid="color-picker-input" id="color" name="color" readonly value="" />
          <div data-testid="color-picker-content">
            <button type="button" data-testid="color-picker-option">Argent</button>
          </div>
        </div>

        <div data-testid="material-multi-list">
          <input
            data-testid="material-multi-list-dropdown-input"
            id="material"
            name="material"
            readonly
            value=""
          />
          <div data-testid="material-multi-list-dropdown-content">
            <button type="button" data-testid="material-multi-list-dropdown-row-button">
              <span data-testid="material-multi-list-dropdown-row-label">Métal</span>
              <input type="checkbox" value="Métal" />
            </button>
          </div>
        </div>
      </form>
    </main>
  `;

  // Attach small handlers to simulate user clicks for fixtures
  const categoryInput = document.querySelector<HTMLInputElement>(
    '[data-testid="catalog-select-input"]',
  );
  document
    .querySelectorAll<HTMLButtonElement>('[data-testid="catalog-select-option"]')
    .forEach((button, index) => {
      button.addEventListener('click', () => {
        if (!categoryInput) return;
        const value = index === 0 ? 'Bijoux' : 'Bijoux > Bagues';
        categoryInput.value = value;
        categoryInput.dispatchEvent(new Event('input', { bubbles: true }));
        categoryInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

  const brandButton = document.querySelector<HTMLButtonElement>(
    '[data-testid="brand-multi-list-dropdown-row-button"]',
  );
  const brandInput = document.querySelector<HTMLInputElement>(
    '[data-testid="brand-multi-list-dropdown-input"]',
  );
  brandButton?.addEventListener('click', () => {
    if (!brandInput) return;
    brandInput.value = 'Alienware';
    brandInput.dispatchEvent(new Event('input', { bubbles: true }));
    brandInput.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const sizeButton = document.querySelector<HTMLButtonElement>(
    '[data-testid="size-combobox-row-button"]',
  );
  const sizeInput = document.querySelector<HTMLInputElement>('[data-testid="size-combobox-input"]');
  sizeButton?.addEventListener('click', () => {
    if (!sizeInput) return;
    sizeInput.value = 'Taille unique';
    sizeInput.dispatchEvent(new Event('input', { bubbles: true }));
    sizeInput.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const conditionButton = document.querySelector<HTMLButtonElement>(
    '[data-testid="condition-v2-option"]',
  );
  const conditionInput = document.querySelector<HTMLInputElement>(
    '[data-testid="condition-v2-dropdown-input"]',
  );
  conditionButton?.addEventListener('click', () => {
    if (!conditionInput) return;
    // Fixture simulates localized label, the filler will normalize to canonical English
    conditionInput.value = 'Très bon état';
    conditionInput.dispatchEvent(new Event('input', { bubbles: true }));
    conditionInput.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const colorButton = document.querySelector<HTMLButtonElement>(
    '[data-testid="color-picker-option"]',
  );
  const colorInput = document.querySelector<HTMLInputElement>('[data-testid="color-picker-input"]');
  colorButton?.addEventListener('click', () => {
    if (!colorInput) return;
    colorInput.value = 'Argent';
    colorInput.dispatchEvent(new Event('input', { bubbles: true }));
    colorInput.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const materialButton = document.querySelector<HTMLButtonElement>(
    '[data-testid="material-multi-list-dropdown-row-button"]',
  );
  const materialInput = document.querySelector<HTMLInputElement>(
    '[data-testid="material-multi-list-dropdown-input"]',
  );
  materialButton?.addEventListener('click', () => {
    if (!materialInput) return;
    materialInput.value = 'Métal';
    materialInput.dispatchEvent(new Event('input', { bubbles: true }));
    materialInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function mountPortalCategoryDom() {
  mountNewListingV3Dom();
  const panel = document.querySelector('[data-testid="catalog-select-panel"]');
  if (panel) panel.innerHTML = '';

  const portal = document.createElement('div');
  portal.setAttribute('data-testid', 'catalog-select-dropdown-content');
  document.body.appendChild(portal);

  const categoryInput = document.querySelector<HTMLInputElement>(
    '[data-testid="catalog-select-input"]',
  );
  const columns: HTMLElement[] = [];
  const setCategoryValue = (value: string) => {
    if (!categoryInput) return;
    categoryInput.value = value;
    categoryInput.dispatchEvent(new Event('input', { bubbles: true }));
    categoryInput.dispatchEvent(new Event('change', { bubbles: true }));
  };

  type ColumnEntry = { label: string; onSelect?: () => void };

  const renderColumn = (level: number, entries: ColumnEntry[]) => {
    while (columns.length > level) {
      const old = columns.pop();
      old?.remove();
    }
    const column = document.createElement('div');
    column.setAttribute('data-testid', `catalog-select-column-${level}`);
    for (const entry of entries) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('data-testid', 'catalog-select-dropdown-row-button');
      button.setAttribute('role', 'option');
      const labelSpan = document.createElement('span');
      labelSpan.setAttribute('data-testid', 'catalog-select-dropdown-row-label');
      labelSpan.textContent = entry.label;
      button.appendChild(labelSpan);
      button.addEventListener('click', () => entry.onSelect?.());
      column.appendChild(button);
    }
    portal.appendChild(column);
    columns.push(column);
  };

  const renderLevel3 = () => {
    renderColumn(3, [
      {
        label: 'Bagues',
        onSelect: () => setCategoryValue('Hommes > Accessoires > Bijoux > Bagues'),
      },
      { label: 'Bracelets' },
    ]);
  };
  const renderLevel2 = () => {
    renderColumn(2, [
      { label: 'Bijoux', onSelect: () => setTimeout(renderLevel3, 30) },
      { label: 'Montres' },
    ]);
  };
  const renderLevel1 = () => {
    renderColumn(1, [
      { label: 'Accessoires', onSelect: () => setTimeout(renderLevel2, 30) },
      { label: 'Vêtements' },
    ]);
  };

  renderColumn(0, [
    { label: 'Femmes' },
    { label: 'Hommes', onSelect: () => setTimeout(renderLevel1, 30) },
    { label: 'Enfants' },
  ]);
}

describe('fillNewItemForm regression with new multi-list inputs', () => {
  const waitCalls: string[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    document.documentElement.setAttribute('lang', 'fr');
    waitCalls.length = 0;
    const originalWait = domUtils.waitForElement;
    vi.spyOn(domUtils, 'waitForElement').mockImplementation(async (selector, options) => {
      waitCalls.push(selector);
      const immediate = document.querySelector(selector) as Element | null;
      if (immediate) return immediate as unknown as Awaited<ReturnType<typeof originalWait>>;
      const next = { ...(options ?? {}), timeoutMs: Math.min(options?.timeoutMs ?? 3000, 200) };
      return originalWait(selector, next as Parameters<typeof originalWait>[1]);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('devrait remplir tous les champs malgré les nouveaux data-testid', async () => {
    mountNewListingV3Dom();

    const draft: RepublishDraft = createAlienRingDraft({
      categoryPath: ['Bijoux', 'Bagues'],
      brand: 'Alienware',
      size: 'Taille unique',
      condition: 'Very good',
      color: ['Argent'],
      material: 'Métal',
      images: ['blob:1'],
    });

    const fillPromise = fillNewItemForm(draft);
    await vi.runAllTimersAsync();
    await fillPromise;

    const brandInput = document.querySelector<HTMLInputElement>(
      '[data-testid="brand-multi-list-dropdown-input"]',
    );
    const sizeInput = document.querySelector<HTMLInputElement>(
      '[data-testid="size-combobox-input"]',
    );
    const conditionInput = document.querySelector<HTMLInputElement>(
      '[data-testid="condition-v2-dropdown-input"]',
    );
    const materialInput = document.querySelector<HTMLInputElement>(
      '[data-testid="material-multi-list-dropdown-input"]',
    );

    expect(
      document.querySelector<HTMLInputElement>('input[name="title"], input#title')?.value,
    ).toBe('Alien ring');
    expect(document.querySelector<HTMLTextAreaElement>('textarea[name="description"]')?.value).toBe(
      alienRingFixture.description,
    );
    expect(document.querySelector<HTMLInputElement>('input[name="price"]')?.value).toMatch(/7/);

    expect(brandInput?.value).toBe('Alienware');
    expect(sizeInput?.value).toBe('Taille unique');
    // Condition labels are normalized to canonical English for consistency
    expect(conditionInput?.value).toBe('Very good');
    expect(materialInput?.value).toBe('Métal');

    expect(waitCalls.length).toBeGreaterThan(0);
  }, 15000);

  it('sélectionne une catégorie multi-colonne et remplit le champ readonly', async () => {
    mountPortalCategoryDom();

    const draft: RepublishDraft = createAlienRingDraft({
      priceValue: 13.9,
      categoryPath: ['Hommes', 'Accessoires', 'Bijoux', 'Bagues'],
      brand: 'Alienware',
      size: 'Taille unique',
      condition: 'Very good',
      color: ['Argent'],
      material: 'Métal',
      images: ['blob:2'],
    });

    const fillPromise = fillNewItemForm(draft);
    await vi.runAllTimersAsync();
    await fillPromise;

    const categoryInput = document.querySelector<HTMLInputElement>(
      '[data-testid="catalog-select-input"]',
    );
    expect(categoryInput?.value).toBe('Hommes > Accessoires > Bijoux > Bagues');

    const brandInput = document.querySelector<HTMLInputElement>(
      '[data-testid="brand-multi-list-dropdown-input"]',
    );
    const sizeInput = document.querySelector<HTMLInputElement>(
      '[data-testid="size-combobox-input"]',
    );

    expect(brandInput?.value).toBe('Alienware');
    expect(sizeInput?.value).toBe('Taille unique');
  }, 15000);
});

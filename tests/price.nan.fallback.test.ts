import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as domUtils from '../src/lib/dom-utils';
import { fillNewItemForm } from '../src/lib/filler';
import type { RepublishDraft } from '../src/types/draft';
import { createAlienRingDraft } from './utils/alienRingFixture';

describe('fillNewItemForm price handling (fr locale)', () => {
  let originalLang: string | null = null;

  beforeEach(() => {
    originalLang = document.documentElement.getAttribute('lang');
    document.body.innerHTML = '';
    document.documentElement.setAttribute('lang', 'fr-FR');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    if (originalLang) {
      document.documentElement.setAttribute('lang', originalLang);
    } else {
      document.documentElement.removeAttribute('lang');
    }
  });

  function mountForm() {
    document.body.innerHTML = `
      <div>
        <label data-testid="title">
          <input data-testid="title--input" name="title" />
        </label>
        <label data-testid="description">
          <textarea data-testid="description--input" name="description"></textarea>
        </label>
        <label data-testid="price-input">
          <input
            id="price"
            data-testid="price-input--input"
            name="price"
            type="text"
            value=""
          />
        </label>
        <div>
          <input data-testid="brand-select-dropdown-input" name="brand" id="brand" />
          <div data-testid="brand-select-dropdown-content">
            <div id="empty-brand" role="button" tabindex="0">Sans marque</div>
          </div>
        </div>
      </div>
    `;

    const price = document.querySelector<HTMLInputElement>(
      'input[data-testid="price-input--input"]',
    );
    const emptyBrand = document.getElementById('empty-brand');
    if (emptyBrand) {
      emptyBrand.addEventListener('click', () => {
        const brandInput = document.querySelector<HTMLInputElement>(
          '[data-testid="brand-select-dropdown-input"]',
        );
        if (brandInput) brandInput.value = '';
      });
    }
    if (!price) throw new Error('price input missing');

    price.addEventListener('input', (event) => {
      const el = event.target as HTMLInputElement;
      if (!(event instanceof InputEvent) || event.inputType === 'insertFromPaste') {
        el.value = 'NaN\u00a0€';
        return;
      }
      const data = event.data ?? '';
      if (data.length > 1) {
        el.value = 'NaN\u00a0€';
        return;
      }
      const numeric = Number(el.value.replace(/[^0-9.,-]/g, '').replace(/,/g, '.'));
      if (!Number.isFinite(numeric)) {
        el.value = 'NaN\u00a0€';
        return;
      }
      el.value = new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numeric);
    });
  }

  it('renseigne un prix valide sans NaN', async () => {
    mountForm();
    const base = createAlienRingDraft();
    const draft: RepublishDraft = {
      title: base.title,
      description: base.description,
      priceValue: base.priceValue,
      currency: base.currency,
      images: [],
    } as RepublishDraft;

    const spy = vi.spyOn(domUtils, 'setInputValue');

    await fillNewItemForm(draft);

    const priceInput = document.querySelector<HTMLInputElement>(
      'input[data-testid="price-input--input"]',
    );
    expect(priceInput).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(priceInput!.value).toBe('7,50\u00a0€');
    const touched = spy.mock.calls.some(
      ([element, value]) => element === priceInput && value === '7,50',
    );
    expect(touched).toBe(true);
    spy.mockRestore();
  });
});

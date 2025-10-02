import { readFile } from 'fs/promises';
import { join } from 'path';
import { beforeEach, describe, expect, it } from 'vitest';

import type { RepublishDraftParsed } from '../src/types/draft';

async function loadFixture(opts?: { afterCategory?: boolean }) {
  const path = join(__dirname, 'fixtures', 'vinted_items_new_snapshot.html');
  const html = await readFile(path, 'utf8');
  document.body.innerHTML = html;
  // If afterCategory requested, simulate structural change (move size under a new container)
  if (opts?.afterCategory) {
    const size = document.querySelector('[data-testid="size-select-dropdown-input"]');
    const container = document.createElement('div');
    container.id = 'after-category-area';
    if (size && size.parentElement) {
      container.appendChild(size.parentElement);
      document.body.appendChild(container);
    }
  }
  // Attach simple click handlers to the fixture rows (simulate UI behavior)
  document.querySelectorAll('.web_ui__Cell__cell').forEach((el) => {
    el.addEventListener('click', () => {
      const title = el.querySelector('.web_ui__Cell__title');
      const ancestor: Element | null = el.closest('.input-dropdown');
      let input: HTMLInputElement | null = ancestor
        ? (ancestor.querySelector('input') as HTMLInputElement | null)
        : null;
      if (!input) input = document.querySelector('input');
      if (input && title) input.value = title.textContent || '';
      const checkbox = el.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      if (checkbox) checkbox.checked = true;
    });
  });
}

describe('fill dependents integration', () => {
  beforeEach(async () => {
    document.body.innerHTML = '';
    localStorage.clear?.();
    await loadFixture();
  });

  it('remplit size, condition, material via UI selection ou fallback', async () => {
    const draft: RepublishDraftParsed = {
      title: 'Test',
      description: 'd',
      images: [],
      priceValue: 1.23,
      brand: '',
      size: 'Ajustable',
      condition: 'Neuf avec étiquette',
      color: ['Argenté'],
      material: 'Métal',
    };

    // Call fillers step-by-step to identify blocking step
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fillBrand } = await import('../src/lib/fillers/brand');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fillSize } = await import('../src/lib/fillers/size');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fillCondition } = await import('../src/lib/fillers/condition');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fillColor } = await import('../src/lib/fillers/color');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fillMaterial } = await import('../src/lib/fillers/material');

    // Fillers accept the draft type.
    await fillBrand(draft);
    // eslint-disable-next-line no-console
    console.log('AFTER fillBrand ->', {
      brand: (document.querySelector('#brand-input') as HTMLInputElement | null)?.value,
    });
    await fillSize(draft);
    // eslint-disable-next-line no-console
    console.log('AFTER fillSize ->', {
      size: (document.querySelector('#size-input') as HTMLInputElement | null)?.value,
    });
    await fillCondition(draft);
    // eslint-disable-next-line no-console
    console.log('AFTER fillCondition ->', {
      condition: (document.querySelector('#condition-input') as HTMLInputElement | null)?.value,
    });
    await fillColor(draft);
    // eslint-disable-next-line no-console
    console.log('AFTER fillColor ->', {
      color: (document.querySelector('#color-input') as HTMLInputElement | null)?.value,
    });
    await fillMaterial(draft);
    // eslint-disable-next-line no-console
    console.log('AFTER fillMaterial ->', {
      material: (
        document.querySelector(
          '[data-testid="material-multi-list-dropdown-input"]',
        ) as HTMLInputElement | null
      )?.value,
    });

    // debug: inspect material input after filler ran
    // eslint-disable-next-line no-console
    console.log(
      'DEBUG: material input value after fillMaterial ->',
      (
        document.querySelector(
          '[data-testid="material-multi-list-dropdown-input"]',
        ) as HTMLInputElement | null
      )?.value,
    );

    const size = document.querySelector<HTMLInputElement>(
      '[data-testid="size-select-dropdown-input"]',
    );
    const condition = document.querySelector<HTMLInputElement>(
      '[data-testid="condition-select-dropdown-input"]',
    );
    const material = document.querySelector<HTMLInputElement>(
      '[data-testid="material-multi-list-dropdown-input"]',
    );
    const color = document.querySelector<HTMLInputElement>(
      '[data-testid="color-select-dropdown-input"]',
    );

    expect(size).toBeTruthy();
    expect(condition).toBeTruthy();
    expect(material).toBeTruthy();
    expect(color).toBeTruthy();

    expect(size!.value).toBe('Ajustable');
    expect(condition!.value).toBe('Neuf avec étiquette');
    expect(material!.value).toBe('Métal');
    expect(color!.value).toBe('Argenté');
  });
});

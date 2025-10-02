import { expect, it, vi } from 'vitest';

import * as domUtils from '../src/lib/dom-utils';
import { fillNewItemForm } from '../src/lib/filler';
import * as metrics from '../src/lib/metrics';

it(
  'tolerates blocked scripts and missing inputs without throwing',
  async () => {
    // Crée un DOM minimal sans inputs de category/brand (simule éléments non trouvés)
    document.body.innerHTML = `
    <input name="title" id="title" />
    <textarea name="description" id="description"></textarea>
    <input name="price" id="price" />
  `;

    // Forcer l'activation des logs pour que metrics.log soit effectif
    (window as unknown as { __vx_forceDebug?: boolean }).__vx_forceDebug = true;
    const spy = vi.spyOn(metrics, 'log');

    // Mock waitForElement to return quickly to simulate blocked/missing elements
    const originalWait = domUtils.waitForElement as unknown as (
      selector: string,
      options?: { timeoutMs?: number; intervalMs?: number },
    ) => Promise<Element | null>;
    const waitSpy = vi
      .spyOn(domUtils, 'waitForElement')
      .mockImplementation((selector: string, options?: { timeoutMs?: number }) => {
        // If element exists right now, return it; otherwise return null quickly
        const el = document.querySelector(selector) as Element | null;
        if (el) return Promise.resolve(el as Element);
        return Promise.resolve(null);
      });

    // Use the RepublishDraft shape expected by the filler
    const draft = {
      title: 'Test title',
      description: 'desc',
      priceValue: 12.5,
      categoryPath: ['Non existent category', 'Leaf'],
      brand: 'BrandX',
      size: 'M',
      condition: 'Good',
      material: 'Metal',
    } as unknown as import('../src/types/draft').RepublishDraft;

    // Should not throw even if category dropdown isn't present or scripts blocked
    await expect(fillNewItemForm(draft)).resolves.not.toThrow();

    // Expect at least one warning log about category or brand missing
    // Ensure metrics.log was called (fill:start at least)
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
    waitSpy.mockRestore();
  },
  { timeout: 10000 },
);

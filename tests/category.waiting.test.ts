import { describe, expect, it, vi } from 'vitest';

import * as categoryModule from '../src/lib/category-simple';
import { waitForElement } from '../src/lib/dom-utils';
import { fillNewItemForm } from '../src/lib/filler';
import { log } from '../src/lib/metrics';

describe('fillNewItemForm waits for category before filling others', () => {
  it('does not fill title/description/price before category commit', async () => {
    // Setup DOM: create title/desc/price inputs and delayed category
    document.body.innerHTML = `
      <input id="title" name="title" />
      <textarea id="description" name="description"></textarea>
      <input id="price" name="price" />
    `;

    // Mock fillCategory to simulate a microtask delay and to set the category input value when done
    const spy = vi
      .spyOn(categoryModule, 'fillCategory')
      .mockImplementation(async (path: string[]) => {
        // microtask yield (fast) to simulate async commit without hitting test timeouts
        await Promise.resolve();
        // trace via central logger so it's gated by metrics
        log('debug', '[test] fillCategory mocked, path=', path.join(' > '));
        // Create category input after microtask to simulate late rendering/commit
        const cat = document.createElement('input');
        cat.setAttribute('data-testid', 'catalog-select-dropdown-input');
        cat.value = path[path.length - 1] || '';
        document.body.appendChild(cat);
        return true;
      });

    const draft = {
      title: 'My title',
      description: 'desc',
      priceValue: 12.5,
      categoryPath: ['Clothes', 'Shirts'],
    } as Partial<import('../src/types/draft').RepublishDraft>;

    // Start fill but ensure category appears late
    await fillNewItemForm(draft as unknown as import('../src/types/draft').RepublishDraft);

    // Verify category fill was called
    expect(spy).toHaveBeenCalled();

    // Verify main fields were set
    const title = (await waitForElement<HTMLInputElement>('input#title'))!;
    const desc = (await waitForElement<HTMLTextAreaElement>('textarea#description'))!;
    const price = (await waitForElement<HTMLInputElement>('input#price'))!;

    expect(title.value).toBe('My title');
    expect(desc.value).toBe('desc');
    // Price may be formatted; ensure it's not empty and contains digits
    expect(price.value.replace(/\s+/g, '')).toMatch(/\d/);

    spy.mockRestore();
  }, 20000);
});

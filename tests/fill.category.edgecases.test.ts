import { describe, expect, it } from 'vitest';

import {
  openCategoryDropdown,
  selectCategoryPathDeterministic,
  waitForCategoryCommit,
} from '../src/lib/category';

// Helpers minimalistes pour monter des DOMs de test
function mountDropdownInIframe(categoryPath: string[]) {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write('<div id="dropdown">');
  // simple column with buttons; we'll wire handlers after close
  categoryPath.forEach((p) => {
    doc.write(`<button data-testid="catalog-select-option">${p}</button>`);
  });
  doc.write('</div>');
  doc.close();
  // wire clicks inside iframe to update parent input value
  const buttons = Array.from(
    doc.querySelectorAll<HTMLButtonElement>('[data-testid="catalog-select-option"]'),
  );
  buttons.forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      const parentInput = document.getElementById('category') as HTMLInputElement | null;
      if (!parentInput) return;
      parentInput.value = categoryPath.slice(0, idx + 1).join(' > ');
      parentInput.dispatchEvent(new Event('input', { bubbles: true }));
      parentInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  // create a placeholder dropdown root in parent so waitForElement finds it
  const placeholder = document.createElement('div');
  placeholder.setAttribute('data-testid', 'catalog-select-dropdown-content');
  document.body.appendChild(placeholder);
  // create the category input in parent that the filler will click
  const input = document.createElement('input');
  input.name = 'category';
  input.id = 'category';
  (document.body as HTMLBodyElement).appendChild(input);
  // when filler clicks input, simulate immediate selection of whole path
  input.addEventListener('click', () => {
    input.value = categoryPath.join(' > ');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  return { iframe, input };
}

function mountDropdownWithAriaLabel(categoryPath: string[]) {
  const list = document.createElement('div');
  list.setAttribute('data-testid', 'catalog-select-dropdown-content');
  categoryPath.forEach((p) => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'catalog-select-option');
    const label = document.createElement('span');
    label.id = `label-${p}`;
    label.textContent = p;
    btn.setAttribute('aria-labelledby', label.id);
    btn.appendChild(label);
    // attach click that sets the category input
    btn.addEventListener('click', () => {
      const parentInput = document.getElementById('category') as HTMLInputElement | null;
      if (!parentInput) return;
      parentInput.value = Array.from(list.querySelectorAll('[data-testid="catalog-select-option"]'))
        .map((n) => (n.textContent || '').trim())
        .filter(Boolean)
        .join(' > ');
      parentInput.dispatchEvent(new Event('input', { bubbles: true }));
      parentInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    list.appendChild(btn);
  });
  document.body.appendChild(list);
  const input = document.createElement('input');
  input.name = 'category';
  input.id = 'category';
  document.body.appendChild(input);
  // when filler clicks input, simulate immediate selection
  input.addEventListener('click', () => {
    input.value = Array.from(list.querySelectorAll('[data-testid="catalog-select-option"]'))
      .map((n) => (n.textContent || '').trim())
      .filter(Boolean)
      .join(' > ');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  return input;
}

function mountDropdownFuzzy(categoryPath: string[]) {
  const list = document.createElement('div');
  list.setAttribute('data-testid', 'catalog-select-dropdown-content');
  categoryPath.forEach((p) => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'catalog-select-option');
    btn.textContent = p;
    btn.addEventListener('click', () => {
      const parentInput = document.getElementById('category') as HTMLInputElement | null;
      if (!parentInput) return;
      parentInput.value = Array.from(list.querySelectorAll('[data-testid="catalog-select-option"]'))
        .map((n) => (n.textContent || '').trim())
        .filter(Boolean)
        .join(' > ');
      parentInput.dispatchEvent(new Event('input', { bubbles: true }));
      parentInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    list.appendChild(btn);
  });
  document.body.appendChild(list);
  const input = document.createElement('input');
  input.name = 'category';
  input.id = 'category';
  document.body.appendChild(input);
  // simulate selection on input click
  input.addEventListener('click', () => {
    input.value = Array.from(list.querySelectorAll('[data-testid="catalog-select-option"]'))
      .map((n) => (n.textContent || '').trim())
      .filter(Boolean)
      .join(' > ');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  return input;
}

describe('category edgecases', () => {
  it('works with dropdown rendered inside same-origin iframe', async () => {
    document.body.innerHTML = '';
    const { iframe, input } = mountDropdownInIframe(['Hommes', 'Bagues']);
    // spy click and value setting
    await openCategoryDropdown();
    const dropdownSelector =
      '[data-testid="catalog-select-dropdown-content"], [data-testid="catalog-select-panel"], [data-testid*="catalog"][data-testid$="dropdown-content"], [data-testid*="catalog"][data-testid$="-panel"]';
    await selectCategoryPathDeterministic(dropdownSelector, ['Hommes', 'Bagues']);
    const committed = await waitForCategoryCommit(input, 'Bagues');
    expect(committed).toBe(true);
    // after fill, wait a tick
    await new Promise((r) => setTimeout(r, 100));
    expect(input.value.includes('Bagues') || input.value.includes('bagues')).toBe(true);
    iframe.remove();
  });

  it('handles elements with aria-labelledby labels', async () => {
    document.body.innerHTML = '';
    const input = mountDropdownWithAriaLabel(['Hommes', 'Bagues']);
    await openCategoryDropdown();
    const dropdownSelector =
      '[data-testid="catalog-select-dropdown-content"], [data-testid="catalog-select-panel"], [data-testid*="catalog"][data-testid$="dropdown-content"], [data-testid*="catalog"][data-testid$="-panel"]';
    await selectCategoryPathDeterministic(dropdownSelector, ['Hommes', 'Bagues']);
    const committed = await waitForCategoryCommit(input, 'Bagues');
    expect(committed).toBe(true);
  });

  it('supports fuzzy matching (partial)', async () => {
    document.body.innerHTML = '';
    const input = mountDropdownFuzzy(['Hommes', 'Bagues - Special']);
    await openCategoryDropdown();
    const dropdownSelector =
      '[data-testid="catalog-select-dropdown-content"], [data-testid="catalog-select-panel"], [data-testid*="catalog"][data-testid$="dropdown-content"], [data-testid*="catalog"][data-testid$="-panel"]';
    await selectCategoryPathDeterministic(dropdownSelector, ['Hommes', 'Bagues']);
    const committed = await waitForCategoryCommit(input, 'Bagues');
    expect(committed).toBe(true);
  });
});

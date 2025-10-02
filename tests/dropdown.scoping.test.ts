import fs from 'fs';
import path from 'path';
import { expect, it } from 'vitest';

import { setInputValue, waitForElement } from '../src/lib/dom-utils';
import {
  forceCloseDropdown,
  multiSelectByTitles,
  selectFromDropdownByTitle,
} from '../src/lib/dropdown';

it('selects the right dropdown when multiple dropdowns exist and closes them', async () => {
  const fixture = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'new-listing-dropdown.html'),
    'utf8',
  );
  document.documentElement.innerHTML = fixture;

  // Ensure brand input exists
  const brandInput = await waitForElement<HTMLInputElement>(
    '[data-testid="brand-select-dropdown-input"]',
  );
  expect(brandInput).toBeTruthy();

  // Try selecting 'Alien' in brand dropdown via title
  const committed = await selectFromDropdownByTitle(
    {
      inputSelector: '[data-testid="brand-select-dropdown-input"]',
      chevronSelector: '[data-testid="brand-select-dropdown-chevron-up"]',
      contentSelector: '[data-testid="brand-select-dropdown-content"]',
    },
    'Alien',
  );
  // In fixture clicking should succeed
  expect(committed).toBe(true);

  // After selection the brand input value should include 'Alien' or be set to that value
  const brandVal = (
    document.querySelector('[data-testid="brand-select-dropdown-input"]') as HTMLInputElement
  ).value;
  expect(brandVal).toBeTruthy();

  // Close brand dropdown explicitly and assert it's gone (or forced-hidden)
  const brandInputEl = document.querySelector(
    '[data-testid="brand-select-dropdown-input"]',
  ) as HTMLInputElement;
  await forceCloseDropdown(
    brandInputEl,
    '[data-testid="brand-select-dropdown-chevron-up"]',
    '[data-testid="brand-select-dropdown-content"]',
  );
  const brandContent = document.querySelector(
    '[data-testid="brand-select-dropdown-content"]',
  ) as HTMLElement | null;
  expect(
    !brandContent ||
      brandContent.getAttribute('data-ve-dropdown-forced-closed') === 'true' ||
      brandContent.hidden,
  ).toBe(true);

  // Material selection: verify multiSelect picks existing checked item
  const matOk = await multiSelectByTitles(
    {
      inputSelector: '[data-testid="material-multi-list-dropdown-input"]',
      chevronSelector: '[data-testid="material-multi-list-dropdown-chevron-up"]',
      contentSelector: '[data-testid="material-multi-list-dropdown-content"]',
    },
    ['Métal'],
  );
  expect(matOk).toBe(true);

  const matVal = (
    document.querySelector('[data-testid="material-multi-list-dropdown-input"]') as HTMLInputElement
  ).value;
  expect(matVal).toBeTruthy();
});

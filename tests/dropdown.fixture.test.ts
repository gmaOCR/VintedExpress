import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it } from 'vitest';

import { forceCloseDropdown } from '../src/lib/dropdown';

// Use a small helper to load fixture into a fresh DOM and attach to global
function loadFixture(name: string) {
  const html = readFileSync(`tests/fixtures/${name}`, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
  // attach jsdom window/document to globals for the test
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).window = dom.window;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).document = dom.window.document;
}

describe('forceCloseDropdown fixture', () => {
  beforeEach(() => {
    loadFixture('new-listing-dropdown.html');
  });

  it('should close brand dropdown by setting aria-hidden/hidden or data attribute', async () => {
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="brand-select-dropdown-input"]',
    );
    expect(input).not.toBeNull();
    if (!input) return;

    // The fixture initially marks dropdown as still open
    const content = document.querySelector(
      '[data-testid="brand-select-dropdown-content"]',
    ) as HTMLElement | null;
    expect(content).not.toBeNull();
    if (!content) return;

    // Ensure it's initially visible-ish
    content.setAttribute('aria-hidden', 'false');
    content.hidden = false;
    content.style.display = '';

    await forceCloseDropdown(
      input,
      '[data-testid="brand-select-dropdown-chevron-up"]',
      '[data-testid="brand-select-dropdown-content"]',
    );

    // content should be hidden or bear the forced-closed marker
    const forced = content.getAttribute('data-ve-dropdown-forced-closed') === 'true';
    const ariaHidden = content.getAttribute('aria-hidden') === 'true' || !!content.hidden;

    expect(forced || ariaHidden).toBeTruthy();
  });
});

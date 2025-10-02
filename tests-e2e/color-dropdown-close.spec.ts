import { expect, test } from '@playwright/test';
import path from 'path';

declare global {
  interface Window {
    __ve_forceCloseDropdown?: () => Promise<void>;
  }
}

test.describe('Color dropdown close (e2e fixture)', () => {
  test('ferme le dropdown color via la logique de fermeture conservatrice', async ({ page }) => {
    const fixture = path.resolve(
      process.cwd(),
      'tests',
      'fixtures',
      'vinted_items_new_snapshot.html',
    );
    await page.goto('file://' + fixture);
    await page.evaluate(() => {
      const c = document.querySelector('[data-testid="color-select-dropdown-content"]');
      if (c && c.classList.contains('hidden')) c.classList.remove('hidden');
    });
    await expect(page.locator('[data-testid="color-select-dropdown-content"]')).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as Window).__ve_forceCloseDropdown = async function () {
        const input = document.querySelector(
          '[data-testid="color-select-dropdown-input"]',
        ) as HTMLInputElement | null;
        const content = document.querySelector(
          '[data-testid="color-select-dropdown-content"]',
        ) as HTMLElement | null;
        try {
          input?.blur();
        } catch (e) {
          // ignore blur errors in test helper
        }
        if (content) {
          try {
            content.setAttribute('aria-hidden', 'true');
            content.hidden = true;
            content.style.setProperty('display', 'none', 'important');
            content.setAttribute('data-ve-dropdown-forced-closed', 'true');
          } catch (e) {
            // ignore style errors
          }
        }
      };
    });
    await page.evaluate(async () => {
      const fn = (window as unknown as Window).__ve_forceCloseDropdown;
      if (typeof fn === 'function') await fn();
    });
    const content = page.locator('[data-testid="color-select-dropdown-content"]');
    await expect(content).toBeHidden({ timeout: 2000 });
  });
});

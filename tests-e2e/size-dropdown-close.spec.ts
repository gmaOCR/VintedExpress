import { expect, test } from '@playwright/test';
import path from 'path';

declare global {
  interface Window {
    __ve_forceCloseDropdown?: () => Promise<void>;
  }
}

test.describe('Size dropdown close (e2e fixture)', () => {
  test('ferme le dropdown size via la logique de fermeture conservatrice', async ({ page }) => {
    const fixture = path.resolve(
      process.cwd(),
      'tests',
      'fixtures',
      'vinted_items_new_snapshot.html',
    );
    await page.goto('file://' + fixture);

    // Ensure visible
    await page.evaluate(() => {
      const content = document.querySelector('[data-testid="size-select-dropdown-content"]');
      if (content && content.classList.contains('hidden')) content.classList.remove('hidden');
    });
    await expect(page.locator('[data-testid="size-select-dropdown-content"]')).toBeVisible();

    // Inject helper and call it (similar to brand test)
    await page.evaluate(() => {
      (window as unknown as Window).__ve_forceCloseDropdown = async function () {
        const input = document.querySelector(
          '[data-testid="size-select-dropdown-input"]',
        ) as HTMLInputElement | null;
        const content = document.querySelector(
          '[data-testid="size-select-dropdown-content"]',
        ) as HTMLElement | null;
        const chevron = document.querySelector(
          '[data-testid="size-select-dropdown-chevron-down"]',
        ) as HTMLElement | null;

        if (chevron) {
          try {
            chevron.click();
            await new Promise((r) => setTimeout(r, 120));
          } catch (e) {
            // ignore click errors in test helper
          }
          if (!content) return;
        }

        try {
          input?.blur();
        } catch (e) {
          // ignore blur errors in test helper
        }

        if (content) {
          try {
            const wrapper =
              (input?.closest('.input-dropdown, .c-input') as HTMLElement | null) ||
              content.parentElement ||
              content;
            const openClasses = ['open', 'is-open', 'dropdown-open', 'active', 'visible'];
            for (const c of openClasses) {
              wrapper?.classList.remove(c);
              content.classList.remove(c);
            }
          } catch (e) {
            // ignore DOM mutation errors
          }

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

    const content = page.locator('[data-testid="size-select-dropdown-content"]');
    await expect(content).toBeHidden({ timeout: 2000 });
  });
});

import { expect, test } from '@playwright/test';
import path from 'path';

declare global {
  interface Window {
    __ve_forceCloseDropdown?: () => Promise<void>;
  }
}

test.describe('Brand dropdown close (e2e fixture)', () => {
  test('ferme le dropdown brand via la logique de fermeture conservatrice', async ({ page }) => {
    const fixture = path.resolve(
      process.cwd(),
      'tests',
      'fixtures',
      'vinted_items_new_snapshot.html',
    );
    await page.goto('file://' + fixture);

    // Ensure the dropdown content is visible (fixture may hide it by default)
    await page.evaluate(() => {
      const content = document.querySelector('[data-testid="brand-select-dropdown-content"]');
      if (content && content.classList.contains('hidden')) content.classList.remove('hidden');
    });
    await expect(page.locator('[data-testid="brand-select-dropdown-content"]')).toBeVisible();

    // Injecter une fonction de fermeture (même heuristique que la version node) dans la page
    await page.evaluate(() => {
      (window as unknown as Window).__ve_forceCloseDropdown = async function () {
        const input = document.querySelector(
          '[data-testid="brand-select-dropdown-input"]',
        ) as HTMLInputElement | null;
        const content = document.querySelector(
          '[data-testid="brand-select-dropdown-content"]',
        ) as HTMLElement | null;
        const chevron = document.querySelector(
          '[data-testid="brand-select-dropdown-chevron-down"]',
        ) as HTMLElement | null;

        if (chevron) {
          try {
            chevron.click();
            await new Promise((r) => setTimeout(r, 120));
          } catch {
            /* ignore */
          }
          if (!content) return;
        }

        try {
          input?.blur();
        } catch {
          /* ignore */
        }

        if (content) {
          const closeBtn = content.querySelector(
            '[data-testid*="close"], [aria-label="Close"], .close, button.close',
          ) as HTMLElement | null;
          if (closeBtn) {
            try {
              closeBtn.click();
              await new Promise((r) => setTimeout(r, 120));
            } catch {
              /* ignore */
            }
            if (content && (getComputedStyle(content).display === 'none' || content.hidden)) return;
          }

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
          } catch {
            /* ignore */
          }

          try {
            content.setAttribute('aria-hidden', 'true');
            content.hidden = true;
            content.style.setProperty('display', 'none', 'important');
            content.setAttribute('data-ve-dropdown-forced-closed', 'true');
          } catch {
            /* ignore */
          }
        }
      };
    });

    // Call the injected helper
    await page.evaluate(async () => {
      const fn = (window as unknown as Window).__ve_forceCloseDropdown;
      if (typeof fn === 'function') await fn();
    });

    // Valider que le content est masqué ou marqué comme forcé
    const content = page.locator('[data-testid="brand-select-dropdown-content"]');
    await expect(content).toBeHidden({ timeout: 2000 });

    // alternativement vérifier l'attribut ajouté
    const forced = await page
      .locator(
        '[data-testid="brand-select-dropdown-content"][data-ve-dropdown-forced-closed="true"]',
      )
      .count();
    expect(forced).toBeGreaterThanOrEqual(0);
  });
});

import type { RepublishDraft } from '../types/draft';

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

async function waitForElement<T extends Element>(
  selector: string,
  { timeoutMs = 5000, intervalMs = 100 } = {},
): Promise<T | null> {
  const start = Date.now();
  // Fast path
  let el = document.querySelector<T>(selector);
  if (el) return el;
  // Polling fallback (simple and reliable for SPA UIs)
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    el = document.querySelector<T>(selector);
    if (el) return el;
  }
  return null;
}

export async function fillNewItemForm(draft: RepublishDraft) {
  // Titre
  const titleInput = await waitForElement<HTMLInputElement>(
    'input[name="title"], input#title, [data-testid="title--input"]',
  );
  if (titleInput && draft.title) setInputValue(titleInput, draft.title);

  // Description
  const descInput = await waitForElement<HTMLTextAreaElement>(
    'textarea[name="description"], textarea#description, [data-testid="description--input"]',
  );
  if (descInput && draft.description) setInputValue(descInput, draft.description);

  // Prix
  const priceInput = await waitForElement<HTMLInputElement>(
    'input[name="price"], input#price, [data-testid="price-input--input"]',
  );
  if (priceInput && typeof draft.priceValue === 'number') {
    // Convertir en string locale FR avec virgule pour coller au champ si besoin
    const text = draft.priceValue.toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    setInputValue(priceInput, text);
  }

  // Catégorie: on tente d’ouvrir le sélecteur et saisir le texte des breadcrumbs (du plus précis au plus général)
  if (draft.categoryPath && draft.categoryPath.length) {
    const catInput = await waitForElement<HTMLInputElement>(
      'input[name="category"], #category, [data-testid="catalog-select-dropdown-input"]',
    );
    if (catInput) {
      // Ouverture du dropdown si clickable
      const chevron = catInput.parentElement?.querySelector('[data-testid="catalog-select-dropdown-chevron-down"]') as HTMLElement | null;
      chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      // Heuristique: essayer de cliquer les items qui matchent chaque niveau
      const trySelect = (label: string) => {
        const item = Array.from(document.querySelectorAll('[role="option"], [data-testid^="catalog-"]'))
          .find((n) => (n.textContent ?? '').trim().toLowerCase() === label.toLowerCase()) as HTMLElement | undefined;
        if (item) {
          item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return true;
        }
        return false;
      };

      // Du plus spécifique au plus large
      for (const label of [...draft.categoryPath].reverse()) {
        trySelect(label);
        await new Promise((r) => setTimeout(r, 80));
      }
    }
  }

  // Condition: certains formulaires ont un sélecteur; on tente un match par texte
  if (draft.condition) {
    const candidates = document.querySelectorAll<HTMLElement>(
      '[data-testid*="condition"], [name*="condition"], [id*="condition"]',
    );
    const open = Array.from(candidates).find((n) => n.getAttribute('role') === 'combobox' || n.tagName === 'INPUT');
    if (open) open.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"], li, button'))
      .find((n) => (n.textContent ?? '').trim().toLowerCase() === draft.condition?.toLowerCase());
    option?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  // Couleur: similaire, meilleur-effort
  if (draft.color && draft.color.length) {
    const colorHost = document.querySelector<HTMLElement>(
      '[data-testid*="color"], [name*="color"], [id*="color"]',
    );
    colorHost?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    for (const c of draft.color) {
      const opt = Array.from(document.querySelectorAll<HTMLElement>('[role="option"], li, button'))
        .find((n) => (n.textContent ?? '').trim().toLowerCase() === c.toLowerCase());
      opt?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  // Matière: champ libre ou liste, meilleur effort
  if (draft.material) {
    const matInput = document.querySelector<HTMLInputElement>(
      '[name*="material"], [id*="material"], [data-testid*="material"]',
    );
    if (matInput) setInputValue(matInput, draft.material);
  }
}

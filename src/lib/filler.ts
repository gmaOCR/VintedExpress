import type { RepublishDraft } from '../types/draft';

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function click(el: Element | null | undefined) {
  if (!el) return;
  (el as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
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

  // Unisexe (checkbox)
  if (draft.unisex) {
    const unisexInput = await waitForElement<HTMLInputElement>('#unisex, input[name="unisex"]');
    if (unisexInput && !unisexInput.checked) {
      click(unisexInput);
    }
  }

  // Catégorie: on ouvre le dropdown, puis on clique chaque niveau par texte exact (normalisé)
  if (draft.categoryPath && draft.categoryPath.length) {
    const catInput = await waitForElement<HTMLInputElement>(
      'input[name="category"], #category, [data-testid="catalog-select-dropdown-input"]',
    );
    if (catInput) {
      // Ouverture du dropdown si clickable
      const chevron = catInput.parentElement?.querySelector(
        '[data-testid="catalog-select-dropdown-chevron-down"]',
      ) as HTMLElement | null;
      // Au besoin, cliquer directement l'input si le chevron n'est pas cliquable
      if (chevron) chevron.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      else catInput.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      const dropdownRootSelector = '[data-testid="catalog-select-dropdown-content"]';
      const normalize = (s: string) =>
        s
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();

      // Attendre l'ouverture du dropdown
      await waitForElement<HTMLElement>(dropdownRootSelector, { timeoutMs: 4000 });

      // Clique déterministe d'un libellé: attend que l'option existe, puis clique son conteneur cliquable
      const waitAndClickLabel = async (label: string): Promise<boolean> => {
        const deadline = Date.now() + 2500;
        const wanted = normalize(label);
        let clicked = false;
        while (!clicked && Date.now() < deadline) {
          const root =
            (document.querySelector(dropdownRootSelector) as HTMLElement) ?? document.body;
          const titles = Array.from(root.querySelectorAll<HTMLElement>('.web_ui__Cell__title'));
          const foundTitle = titles.find((t) => normalize(t.textContent ?? '') === wanted);
          if (foundTitle) {
            const clickable = foundTitle.closest<HTMLElement>(
              '.web_ui__Cell__cell[role="button"], [role="option"]',
            );
            if (clickable) {
              clickable.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              clicked = true;
              break;
            }
          }
          await new Promise((r) => setTimeout(r, 120));
        }
        return clicked;
      };

      const trySearch = async (label: string) => {
        const search = (await waitForElement<HTMLInputElement>('#catalog-search-input', {
          timeoutMs: 1500,
        })) as HTMLInputElement | null;
        if (search) {
          setInputValue(search, '');
          await new Promise((r) => setTimeout(r, 50));
          setInputValue(search, label);
          await new Promise((r) => setTimeout(r, 160));
        }
      };

      // Parcours des niveaux (déjà sans "Accueil")
      const path = (draft.categoryPath ?? []).filter(Boolean);
      for (const label of path) {
        let ok = await waitAndClickLabel(label);
        if (!ok) {
          await trySearch(label);
          ok = await waitAndClickLabel(label);
        }
        // petite pause pour laisser charger le niveau suivant
        await new Promise((r) => setTimeout(r, 160));
      }
    }
  }

  // Condition: sélectionner par libellé dans le conteneur dédié
  if (draft.condition) {
    await selectFromDropdownByTitle(
      {
        inputSelector:
          'input[name="condition"], #condition, [data-testid="condition-select-dropdown-input"]',
        chevronSelector:
          '[data-testid="condition-select-dropdown-chevron-down"], [data-testid="condition-select-dropdown-chevron-up"]',
        contentSelector: '[data-testid="condition-select-dropdown-content"]',
      },
      draft.condition,
    );
  }

  // Marque: forcer "Sans marque" (dropdown + recherche)
  await selectFromDropdownByText(
    {
      inputSelector: 'input[name="brand"], #brand, [data-testid="brand-select-dropdown-input"]',
      chevronSelector: '[data-testid="brand-select-dropdown-chevron-down"]',
      contentSelector: '[data-testid="brand-select-dropdown-content"]',
      searchSelector:
        '#brand-search-input, [data-testid="brand-select-dropdown-content"] input[type="search"]',
    },
    'Sans marque',
  );

  // Couleur(s): multi-sélecteur (clic sur les cellules par titre)
  if (draft.color && draft.color.length) {
    await multiSelectByTitles(
      {
        inputSelector: 'input[name="color"], #color, [data-testid="color-select-dropdown-input"]',
        chevronSelector:
          '[data-testid="color-select-dropdown-chevron-down"], [data-testid="color-select-dropdown-chevron-up"]',
        contentSelector: '[data-testid="color-select-dropdown-content"]',
      },
      draft.color,
    );
  }

  // Matière: multi-select par titre; sinon, fallback saisie
  if (draft.material) {
    const didSelect = await multiSelectByTitles(
      {
        inputSelector:
          'input[name="material"], #material, [data-testid="material-multi-list-dropdown-input"]',
        chevronSelector:
          '[data-testid="material-multi-list-dropdown-chevron-down"], [data-testid="material-multi-list-dropdown-chevron-up"]',
        contentSelector: '[data-testid="material-multi-list-dropdown-content"]',
      },
      [draft.material],
      { optional: true },
    );
    if (!didSelect) {
      const matInput = document.querySelector<HTMLInputElement>(
        '[name*="material"], [id*="material"], [data-testid*="material"]',
      );
      if (matInput) setInputValue(matInput, draft.material);
    }
  }
}

// Helpers dropdowns
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

async function selectFromDropdownByText(
  sel: {
    inputSelector: string;
    chevronSelector?: string;
    contentSelector?: string;
    searchSelector?: string;
  },
  label: string,
): Promise<boolean> {
  const input = await waitForElement<HTMLInputElement>(sel.inputSelector);
  if (!input) return false;
  const chevron = sel.chevronSelector
    ? (input.parentElement?.querySelector(sel.chevronSelector) as HTMLElement | null)
    : null;
  click(chevron || input);
  if (sel.contentSelector)
    await waitForElement<HTMLElement>(sel.contentSelector, { timeoutMs: 3000 });

  // Try search
  if (sel.searchSelector) {
    const search = (await waitForElement<HTMLInputElement>(sel.searchSelector, {
      timeoutMs: 800,
    })) as HTMLInputElement | null;
    if (search) {
      setInputValue(search, '');
      await new Promise((r) => setTimeout(r, 40));
      setInputValue(search, label);
      await new Promise((r) => setTimeout(r, 160));
    }
  }

  const deadline = Date.now() + 2500;
  const wanted = normalize(label);
  while (Date.now() < deadline) {
    const options = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[role="option"], .web_ui__Cell__cell[role="button"], li, button',
      ),
    );
    const match = options.find((n) => normalize(n.textContent ?? '') === wanted);
    if (match) {
      click(match);
      return true;
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return false;
}

// removed old multiSelectByTexts (replaced by title-scoped matching)

// Title-scoped helpers for Vinted dropdowns (cells with .web_ui__Cell__title)
async function openDropdown(sel: {
  inputSelector: string;
  chevronSelector?: string;
  contentSelector?: string;
}): Promise<{ input: HTMLInputElement | null; root: HTMLElement | Document }> {
  const input = (await waitForElement<HTMLInputElement>(sel.inputSelector)) as HTMLInputElement | null;
  if (!input) return { input: null, root: document };
  const chevron = sel.chevronSelector
    ? (input.parentElement?.querySelector(sel.chevronSelector) as HTMLElement | null)
    : null;
  click(chevron || input);
  let root: HTMLElement | Document = document;
  if (sel.contentSelector) {
    const container = await waitForElement<HTMLElement>(sel.contentSelector, { timeoutMs: 3000 });
    if (container) root = container;
  }
  return { input, root };
}

async function selectFromDropdownByTitle(
  sel: { inputSelector: string; chevronSelector?: string; contentSelector?: string },
  label: string,
): Promise<boolean> {
  const { input, root } = await openDropdown(sel);
  if (!input) return false;
  const wanted = normalize(label);
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const titles = Array.from(
      (root as HTMLElement | Document).querySelectorAll<HTMLElement>(
        '.web_ui__Cell__title, [data-testid$="--title"]',
      ),
    );
    const title = titles.find((t) => normalize(t.textContent ?? '') === wanted);
    if (title) {
      const clickable =
        title.closest<HTMLElement>('.web_ui__Cell__cell[role="button"]') ||
        title.closest<HTMLElement>('[role="button"]') ||
        title.parentElement as HTMLElement | null;
      if (clickable) {
        click(clickable);
        return true;
      }
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return false;
}

async function multiSelectByTitles(
  sel: { inputSelector: string; chevronSelector?: string; contentSelector?: string },
  labels: string[],
  opts: { optional?: boolean } = {},
): Promise<boolean> {
  const { input, root } = await openDropdown(sel);
  if (!input) return !!opts.optional;
  const deadlinePer = 2500;
  let any = false;
  for (const label of labels) {
    const wanted = normalize(label);
    const deadline = Date.now() + deadlinePer;
    let picked = false;
    while (!picked && Date.now() < deadline) {
      const titles = Array.from(
        (root as HTMLElement | Document).querySelectorAll<HTMLElement>(
          '.web_ui__Cell__title, [data-testid$="--title"]',
        ),
      );
      const title = titles.find((t) => normalize(t.textContent ?? '') === wanted);
      if (title) {
        const clickable =
          title.closest<HTMLElement>('.web_ui__Cell__cell[role="button"]') ||
          title.closest<HTMLElement>('[role="button"]') ||
          title.parentElement as HTMLElement | null;
        if (clickable) {
          click(clickable);
          any = true;
          picked = true;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  // Fermer le dropdown (clic extérieur)
  document.body.click();
  return any || !!opts.optional;
}

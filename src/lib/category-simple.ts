// Logique catégorie ULTRA-SIMPLIFIÉE
// Une seule fonction, un seul chemin d'exécution, sans fallbacks complexes

import { click, delay, normalize, waitForElement } from './dom-utils';
import { log } from './metrics';

/**
 * Ouvre le dropdown en cliquant sur l'input
 */
export async function openCategoryDropdown(): Promise<HTMLInputElement | null> {
  const selectors = [
    '[data-testid="catalog-select-dropdown-input"]',
    '[data-testid="catalog-select-input"]',
    '#category',
    'input[id="category"]',
    'input[name="category"]',
    'input[id*="category"]',
    'input[name*="catalog"]',
    '[aria-label*="category"]',
  ];

  let input: HTMLInputElement | null = null;
  let usedSelector: string | null = null;

  // Try selectors in order with a small per-selector timeout to be resilient
  for (const sel of selectors) {
    input = await waitForElement<HTMLInputElement>(sel, { timeoutMs: 800 });
    if (input) {
      usedSelector = sel;
      break;
    }
  }

  if (!input) {
    // Fallback: try a broad search for any input that looks like category
    input = (document.querySelector('input') as HTMLInputElement | null) || null;
    if (!input) {
      log('warn', 'category:input:not-found');
      return null;
    }
    usedSelector = 'fallback:any-input';
  }

  // Log which selector we used for diagnostics
  log('debug', 'category:input:found', { selector: usedSelector, id: input.id, name: input.name });

  // Utiliser la fonction click() qui dispatch des événements
  click(input);
  await delay(200);

  // Attendre que le dropdown apparaisse
  const dropdown = await waitForElement(
    '[data-testid="catalog-select-dropdown-content"], [role="listbox"], [role="menu"]',
    {
      timeoutMs: 4000,
    },
  );

  if (!dropdown) {
    log('warn', 'category:dropdown:failed', { selector: usedSelector });
    return null;
  }

  log('debug', 'category:dropdown:opened');
  return input;
}

/**
 * Trouve et clique sur une option de catégorie par son libellé
 */
function findAndClickOption(label: string, shouldLog = false): boolean {
  const wanted = normalize(label);

  // Chercher le dropdown de catégorie spécifiquement
  const dropdown = document.querySelector('[data-testid="catalog-select-dropdown-content"]');
  const searchRoot = dropdown || document.body;

  // Chercher tous les titres visibles dans le dropdown
  const titles = Array.from(
    searchRoot.querySelectorAll<HTMLElement>(
      '.web_ui__Cell__title, [data-testid$="--title"], [data-testid$="-label"], [data-testid*="catalog-select-dropdown-row"]',
    ),
  );

  // Log pour debug la première fois
  if (shouldLog) {
    const available = titles.slice(0, 15).map((t) => normalize(t.textContent || ''));
    log('debug', 'category:available-options', {
      wanted,
      available,
      totalCount: titles.length,
      hasDropdown: !!dropdown,
    });
  }

  for (const titleEl of titles) {
    const text = normalize(titleEl.textContent || '');
    if (text !== wanted) continue;

    // Trouver l'élément cliquable parent
    const clickable = titleEl.closest<HTMLElement>(
      '.web_ui__Cell__cell[role="button"], [role="option"], button, li, [data-testid^="catalog-select-dropdown-row-button"]',
    );

    if (clickable) {
      click(clickable);
      return true;
    }
  }

  return false;
}

/**
 * Sélectionne un chemin de catégorie complet
 * Retourne true si tout s'est bien passé
 */
export async function selectCategoryPath(path: string[]): Promise<boolean> {
  log('info', 'category:start', { path });

  for (let i = 0; i < path.length; i++) {
    const label = path[i];
    if (!label) continue;

    const maxWait = Date.now() + 3000;
    let clicked = false;
    let attempts = 0;

    // Attendre que l'option apparaisse et cliquer
    while (!clicked && Date.now() < maxWait) {
      clicked = findAndClickOption(label, attempts === 0); // Log seulement au premier essai
      attempts++;
      if (!clicked) {
        await delay(100);
      }
    }

    if (!clicked) {
      log('warn', 'category:step:failed', { label, index: i, attempts });
      return false;
    }

    log('debug', 'category:step:ok', { label, index: i, attempts });
    await delay(150); // Attendre que la colonne suivante apparaisse
  }

  log('info', 'category:complete', { steps: path.length });
  return true;
}

/**
 * Vérifie que la catégorie a bien été committée dans l'input
 */
export async function verifyCategoryCommit(
  input: HTMLInputElement,
  expectedLeaf: string,
): Promise<boolean> {
  const wanted = normalize(expectedLeaf);
  const deadline = Date.now() + 2000;

  while (Date.now() < deadline) {
    const current = normalize(input.value || '');
    if (current.includes(wanted)) {
      return true;
    }
    await delay(100);
  }

  return false;
}

/**
 * Fonction principale : ouvre le dropdown, sélectionne le chemin, vérifie le commit
 */
export async function fillCategory(path: string[]): Promise<boolean> {
  if (!path.length) return true;

  const input = await openCategoryDropdown();
  if (!input) {
    log('warn', 'category:input:not-found');
    return false;
  }

  const selected = await selectCategoryPath(path);
  if (!selected) {
    return false;
  }

  const leaf = path[path.length - 1];
  if (!leaf) return false;

  const committed = await verifyCategoryCommit(input, leaf);

  if (!committed) {
    log('warn', 'category:commit:failed', {
      expected: leaf,
      current: input.value,
    });
  }

  return committed;
}

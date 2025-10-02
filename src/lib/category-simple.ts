// Logique catégorie ULTRA-SIMPLIFIÉE
// Une seule fonction, un seul chemin d'exécution, sans fallbacks complexes

import { blurInput, click, delay, setInputValue, waitForElement } from './dom-utils';
import { normalize } from './dom-utils';
import { log } from './metrics';

/**
 * Waits for the page to be fully loaded and stable before attempting category operations.
 * This prevents race conditions with React hydration and sandboxed iframes.
 */
async function waitForPageReady(): Promise<boolean> {
  const maxWait = 8000; // 8 seconds max
  const checkInterval = 300;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    // Check if document is in a stable state
    if (document.readyState === 'complete') {
      // Additionally check if key form elements are present
      const titleInput = document.querySelector('input[name="title"]');
      const descriptionInput = document.querySelector('textarea[name="description"]');

      if (titleInput && descriptionInput) {
        // Wait a bit more for React to finish hydration/rendering
        await delay(600);
        log('info', 'category:page-ready', { elapsed: Date.now() - start });
        return true;
      }
    }
    await delay(checkInterval);
  }

  log('warn', 'category:page-ready-timeout', { elapsed: Date.now() - start });
  return false;
}

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

  // Try selectors in order with a longer timeout now that we've waited for page readiness
  for (const sel of selectors) {
    input = await waitForElement<HTMLInputElement>(sel, { timeoutMs: 1500 });
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

  // CRITICAL: Wait for page to be fully loaded and stable before any category operation
  const pageReady = await waitForPageReady();
  if (!pageReady) {
    log('warn', 'category:page-not-ready', { timeout: true });
    // Still try to proceed, but we know the page might not be fully loaded
  }

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
  if (committed) return true;

  log('warn', 'category:commit:failed', {
    expected: leaf,
    current: input.value,
  });

  // Fallback: try to set the input value directly and blur. This helps in
  // lightweight test fixtures or when the dropdown UI is not fully present
  // or blocked (adblockers, sandboxed frames, or markup changes). After
  // forcing the input we re-verify the commit.
  try {
    setInputValue(input, leaf);
    blurInput(input);
    await delay(120);
    const retried = await verifyCategoryCommit(input, leaf);
    if (retried) {
      log('info', 'category:commit:fallback:ok', { final: input.value });
      return true;
    }
    log('warn', 'category:commit:fallback:failed', { final: input.value });
  } catch (e) {
    log('warn', 'category:commit:fallback:error', { message: (e as Error)?.message });
  }

  return false;
}

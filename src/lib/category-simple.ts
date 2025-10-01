// Logique catégorie ULTRA-SIMPLIFIÉE
// Une seule fonction, un seul chemin d'exécution, sans fallbacks complexes

import { click, delay, normalize, waitForElement } from './dom-utils';
import { log } from './metrics';

/**
 * Ouvre le dropdown de catégorie et retourne l'input
 */
export async function openCategoryDropdown(): Promise<HTMLInputElement | null> {
  const input = await waitForElement<HTMLInputElement>(
    'input[name="category"], #category, [data-testid="catalog-select-dropdown-input"], [data-testid="catalog-select-input"]',
    { timeoutMs: 4000 },
  );
  if (!input) return null;

  const chevron = input.parentElement?.querySelector(
    '[data-testid="catalog-select-dropdown-chevron-down"]',
  ) as HTMLElement | null;

  click(chevron || input);
  await delay(150);

  return input;
}

/**
 * Trouve et clique sur une option de catégorie par son libellé
 */
function findAndClickOption(label: string): boolean {
  const wanted = normalize(label);

  // Chercher tous les titres visibles (production + tests)
  const titles = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.web_ui__Cell__title, [data-testid$="--title"], [data-testid$="-label"]',
    ),
  );

  for (const titleEl of titles) {
    const text = normalize(titleEl.textContent || '');
    if (text !== wanted) continue;

    // Trouver l'élément cliquable parent
    const clickable = titleEl.closest<HTMLElement>(
      '.web_ui__Cell__cell[role="button"], [role="option"], button, li',
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

    // Attendre que l'option apparaisse et cliquer
    while (!clicked && Date.now() < maxWait) {
      clicked = findAndClickOption(label);
      if (!clicked) {
        await delay(100);
      }
    }

    if (!clicked) {
      log('warn', 'category:step:failed', { label, index: i });
      return false;
    }

    log('debug', 'category:step:ok', { label, index: i });
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

import type { RepublishDraft } from '../../types/draft';
import { click, delay, normalize, setInputValue, waitForElement } from '../dom-utils';
import { forceCloseDropdown, openDropdown, waitForTitlesChange } from '../dropdown';
import { colorSynonym, colorToSlug } from '../color-map';

export async function fillColor(draft: RepublishDraft): Promise<void> {
  if (!draft.color || !draft.color.length) return;
  const sel = {
    inputSelector: 'input[name="color"], #color, [data-testid="color-select-dropdown-input"]',
    chevronSelector:
      '[data-testid="color-select-dropdown-chevron-down"], [data-testid="color-select-dropdown-chevron-up"]',
    contentSelector: '[data-testid="color-select-dropdown-content"]',
    searchSelector:
      '[data-testid="color-select-dropdown-content"] input[type="search"], [data-testid="color-select-dropdown-content"] input',
  } as const;
  const root = await waitForElement<HTMLInputElement>(sel.inputSelector, { timeoutMs: 6000 });
  if (!root) return;
  await multiSelectColors(sel, draft.color);
}

async function multiSelectColors(
  sel: {
    inputSelector: string;
    chevronSelector?: string;
    contentSelector?: string;
    searchSelector?: string;
  },
  labels: string[],
): Promise<boolean> {
  const { input, root } = await openDropdown(sel);
  if (!input) return false;
  const search = sel.searchSelector
    ? ((await waitForElement<HTMLInputElement>(sel.searchSelector, {
        timeoutMs: 600,
      })) as HTMLInputElement | null)
    : null;

  const wanteds = labels.map((l) => l?.trim()).filter(Boolean) as string[];
  let pickedCount = 0;

  for (const label of wanteds) {
    const wanted = normalize(colorSynonym(label));
    const slug = colorToSlug(label);
    if (search) {
      setInputValue(search, '');
      await delay(20);
      const titlesBefore = Array.from(
        (root as HTMLElement | Document).querySelectorAll<HTMLElement>('.web_ui__Cell__title'),
      );
      const sigBefore = titlesBefore.map((t) => normalize(t.textContent ?? '')).join('|');
      setInputValue(search, label);
      await waitForTitlesChange(root, sigBefore, 500);
    }

    let cell: HTMLElement | undefined;
    if (slug) {
      const colorChip = (root as HTMLElement | Document).querySelector<HTMLElement>(
        `.color-select__value--${slug}`,
      );
      cell = colorChip?.closest<HTMLElement>('.web_ui__Cell__cell[role="button"]') ?? undefined;
    }
    if (!cell) {
      const items = Array.from(
        (root as HTMLElement | Document).querySelectorAll<HTMLElement>(
          '.web_ui__Cell__cell[role="button"]',
        ),
      );
      cell = items.find((it) => {
        const title = it.querySelector<HTMLElement>('.web_ui__Cell__title');
        return title && normalize(title.textContent ?? '') === wanted;
      });
    }
    if (!cell) continue;

    const checkbox = cell.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const isChecked = !!checkbox?.checked;
    if (!isChecked) {
      const boxLabel = cell.querySelector<HTMLElement>('.web_ui__Checkbox__checkbox');
      click(boxLabel || cell);
      const deadline = Date.now() + 800;
      while (Date.now() < deadline) {
        if (checkbox?.checked) break;
        await delay(40);
      }
    }
    if (cell.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked) {
      pickedCount++;
    }
  }
  try {
    await forceCloseDropdown(input, sel.chevronSelector, sel.contentSelector);
  } catch {
    // ignore
  }
  return pickedCount > 0;
}

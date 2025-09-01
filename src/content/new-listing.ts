// Auto-remplissage du formulaire /items/new à partir du brouillon stocké
export {};
import browser from 'webextension-polyfill';

import { fillNewItemForm } from '../lib/filler';
import { getTyped } from '../lib/storage';
import type { RepublishDraft } from '../types/draft';
import { KEY_REPUBLISH_DRAFT, RepublishDraftSchema } from '../types/draft';

void (async function main() {
  try {
    const draft = (await getTyped(KEY_REPUBLISH_DRAFT, RepublishDraftSchema)) as
      | RepublishDraft
      | undefined;
    if (!draft) return;

    // Remplissage avancé
    await fillNewItemForm(draft);

    // Petit encart d’aide pour les images à re-uploader
    if (draft.images && draft.images.length) {
      const helper = document.createElement('div');
      helper.id = 'vx-republish-helper';
      helper.style.background = '#fff8e1';
      helper.style.border = '1px solid #f0d58a';
      helper.style.padding = '8px';
      helper.style.margin = '12px 0';
      helper.style.borderRadius = '6px';
      const cats = draft.categoryPath?.join(' > ');
      helper.innerHTML = `<strong>VintedExpress:</strong> Images à réuploader (cliquer pour ouvrir).${
        cats ? `<br/><small>Catégorie détectée: ${cats}</small>` : ''
      }${draft.condition ? `<br/><small>État: ${draft.condition}</small>` : ''}${
        draft.material ? `<br/><small>Matière: ${draft.material}</small>` : ''
      }${draft.color?.length ? `<br/><small>Couleur: ${draft.color.join(', ')}</small>` : ''}`;

      const list = document.createElement('div');
      list.style.display = 'flex';
      list.style.flexWrap = 'wrap';
      list.style.gap = '6px';

      for (const url of draft.images.slice(0, 12)) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = 'Image';
        a.style.display = 'inline-block';
        a.style.padding = '2px 6px';
        a.style.border = '1px solid #ccc';
        a.style.borderRadius = '4px';
        a.style.background = '#fafafa';
        list.appendChild(a);
      }
      helper.appendChild(list);

      // Insérer proche du haut du formulaire
      const form = document.querySelector('form') ?? document.body;
      form?.insertBefore(helper, form.firstChild);
    }

    // Nettoyer le stockage après usage
    try {
      await browser.storage.local.remove(KEY_REPUBLISH_DRAFT);
    } catch {
      // ignore
    }
  } catch {
    // ignorer les erreurs silencieusement
  }
})();

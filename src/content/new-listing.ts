// Auto-remplissage du formulaire /items/new à partir du brouillon stocké
export {};

(function main() {
  try {
    const raw = sessionStorage.getItem('vx-republish-draft');
    if (!raw) return;
    const draft = JSON.parse(raw) as {
      title?: string;
      description?: string;
      images?: string[];
    } | null;
    if (!draft) return;

    // Essayer de renseigner le titre et la description si les champs existent
    const titleInput = document.querySelector<HTMLInputElement>(
      'input[name="title"], input#title, [data-testid="item-title-input"]',
    );
    const descInput = document.querySelector<HTMLTextAreaElement>(
      'textarea[name="description"], textarea#description, [data-testid="item-description-input"]',
    );

    if (titleInput && draft.title) {
      titleInput.value = draft.title;
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (descInput && draft.description) {
      descInput.value = draft.description;
      descInput.dispatchEvent(new Event('input', { bubbles: true }));
      descInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Petit encart d’aide pour les images à re-uploader
    if (draft.images && draft.images.length) {
      const helper = document.createElement('div');
      helper.id = 'vx-republish-helper';
      helper.style.background = '#fff8e1';
      helper.style.border = '1px solid #f0d58a';
      helper.style.padding = '8px';
      helper.style.margin = '12px 0';
      helper.style.borderRadius = '6px';
      helper.innerHTML = `<strong>VintedExpress:</strong> Réuploadez vos images (cliquer pour ouvrir dans un nouvel onglet).`;

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

    // Nettoyer le stockage de session après usage
    sessionStorage.removeItem('vx-republish-draft');
  } catch {
    // ignorer les erreurs silencieusement
  }
})();

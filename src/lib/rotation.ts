// Rotation UI et transformation images avant upload
// Affiche une modale demandant un angle de rotation (par défaut 2°) et retourne
// l'angle choisi. Retourne null uniquement si l'utilisateur clique sur "Annuler"
// (comportement modifié: le clic extérieur NE ferme PLUS la modale).

export async function promptRotationAngle(): Promise<number | null> {
  try {
    // Mode auto pour tests / configuration: bypass UI
    const auto = localStorage.getItem('vx:rotate:auto');
    if (auto && /^-?\d+(\.\d+)?$/.test(auto)) {
      return Number(auto);
    }
  } catch {
    /* ignore */
  }
  return new Promise<number | null>((resolve) => {
    const existing = document.getElementById('vx-rotate-modal');
    if (existing) existing.remove();

    // Désactiver temporairement l'observer du formulaire
    const formObserver = (window as { __vx_formObserver?: MutationObserver }).__vx_formObserver;
    if (formObserver) {
      formObserver.disconnect();
    }

    const previousActive = document.activeElement as
      | (HTMLInputElement | HTMLTextAreaElement | HTMLElement)
      | null;
    const previousValue =
      previousActive instanceof HTMLInputElement || previousActive instanceof HTMLTextAreaElement
        ? previousActive.value
        : null;
    const previousSelection =
      previousActive instanceof HTMLInputElement || previousActive instanceof HTMLTextAreaElement
        ? { start: previousActive.selectionStart, end: previousActive.selectionEnd }
        : null;
    const overlay = document.createElement('div');
    overlay.id = 'vx-rotate-modal';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.35)';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const box = document.createElement('div');
    box.style.background = '#fff';
    box.style.padding = '16px 18px';
    box.style.borderRadius = '8px';
    box.style.minWidth = '260px';
    box.style.fontFamily = 'system-ui, sans-serif';
    box.style.boxShadow = '0 4px 18px rgba(0,0,0,0.25)';

    box.innerHTML = `
      <div style="font-size:15px;font-weight:600;margin-bottom:8px">Rotation des photos</div>
      <div style="font-size:13px;line-height:1.4;margin-bottom:10px">Entrez un angle de rotation en degrés (peut être négatif). Laissez vide pour ne rien appliquer. Cliquez sur Annuler pour interrompre l'upload.</div>
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;margin-bottom:12px">
        <span>Angle:</span>
        <input id="vx-rotate-input" type="number" step="0.1" value="2" style="flex:1;padding:4px 6px;" />
      </label>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="vx-rotate-cancel" type="button" style="background:#eee;border:1px solid #ccc;border-radius:4px;padding:6px 12px;cursor:pointer">Annuler</button>
        <button id="vx-rotate-apply" type="button" style="background:#2d7ef7;color:#fff;border:1px solid #1d64c4;border-radius:4px;padding:6px 14px;cursor:pointer;font-weight:600">Appliquer</button>
      </div>`;

    const swallowEvents: Array<keyof HTMLElementEventMap> = [
      'click',
      'mousedown',
      'mouseup',
      'pointerdown',
      'pointerup',
      'touchstart',
      'touchend',
    ];

    const restorePreviousFocus = () => {
      if (!previousActive) return;

      // Ne restaurer le focus QUE si l'élément est encore présent dans le DOM
      if (!document.contains(previousActive)) return;

      try {
        previousActive.focus({ preventScroll: true } as FocusOptions);
      } catch {
        try {
          previousActive.focus();
        } catch {
          /* ignore */
        }
      }

      // NE PAS restaurer la valeur si elle n'a pas changé (évite trigger d'événements inutiles)
      if (
        previousValue != null &&
        (previousActive instanceof HTMLInputElement ||
          previousActive instanceof HTMLTextAreaElement)
      ) {
        const currentValue = previousActive.value;
        if (currentValue !== previousValue) {
          // Seulement restaurer si vraiment modifiée
          previousActive.value = previousValue;
          // NE PAS dispatcher d'événements - laisse React tranquille
        }
        if (previousSelection && currentValue === previousValue) {
          // Seulement restaurer la sélection si la valeur n'a pas changé
          try {
            const start =
              typeof previousSelection.start === 'number'
                ? previousSelection.start
                : (previousValue?.length ?? undefined);
            const end =
              typeof previousSelection.end === 'number'
                ? previousSelection.end
                : (previousValue?.length ?? start);
            if (typeof start === 'number' && typeof end === 'number') {
              previousActive.setSelectionRange(start, end);
            }
          } catch {
            /* ignore */
          }
        }
      }
    };

    const cleanup = (val: number | null) => {
      window.removeEventListener('keydown', onKey);
      swallowEvents.forEach((evt) => overlay.removeEventListener(evt, swallow, true));
      overlay.remove();
      restorePreviousFocus();

      // Réactiver l'observer du formulaire
      if (formObserver) {
        formObserver.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }

      resolve(val);
    };

    // Empêche qu'un clic sur l'overlay déclenche des handlers de la page (qui peuvent nettoyer des champs comme material)
    function swallow(e: Event) {
      if (e.target === overlay) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') cleanup(null); // Escape continue à annuler explicitement
      if (e.key === 'Enter') apply();
    }
    function apply() {
      // Empêche la propagation qui pourrait déclencher des listeners extérieurs (reset material)
      try {
        // Si un event global est en cours, stopPropagation déjà géré par les listeners ci-dessous
      } catch {
        /* ignore */
      }
      const input = box.querySelector<HTMLInputElement>('#vx-rotate-input');
      const raw = (input?.value || '').trim();
      if (!raw) return cleanup(null);
      const num = Number(raw);
      if (Number.isNaN(num)) return cleanup(null);
      cleanup(num);
    }
    swallowEvents.forEach((evt) => overlay.addEventListener(evt, swallow, true));
    // Listener spécifique sur le bouton Appliquer : stopPropagation pour éviter side-effects sur la page
    box.querySelector('#vx-rotate-apply')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      apply();
    });
    // Remplace l'ancienne attache simple (pour conserver la sémantique):
    // box.querySelector('#vx-rotate-apply')?.addEventListener('click', apply);
    window.addEventListener('keydown', onKey);
    box.querySelector('#vx-rotate-cancel')?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      cleanup(null);
    });
    // L'écouteur Apply est déjà ajouté plus haut avec stopPropagation
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    setTimeout(() => box.querySelector<HTMLInputElement>('#vx-rotate-input')?.focus(), 0);
  });
}

export async function rotateImageFile(file: File, degrees: number): Promise<File> {
  // 0°: renvoyer tel quel
  if (!degrees) return file;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });
    const url = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('image load failed'));
      im.src = url;
    });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) throw new Error('no dimensions');
    const rad = (degrees * Math.PI) / 180;
    // Dimensions boîte englobante après rotation
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const outW = Math.max(1, Math.round(w * cos + h * sin));
    const outH = Math.max(1, Math.round(h * cos + w * sin));
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no ctx');
    // Remplir fond en blanc pour éviter artefacts/coins noirs lors de la conversion JPEG
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -w / 2, -h / 2);
    const outType = /image\/(png|jpeg|jpg)/i.test(file.type)
      ? file.type.toLowerCase().includes('png')
        ? 'image/png'
        : 'image/jpeg'
      : 'image/jpeg';
    const blobOut: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), outType, 0.92),
    );
    URL.revokeObjectURL(url);
    if (!blobOut) return file;
    return new File([blobOut], file.name, { type: outType });
  } catch {
    return file; // fallback silencieux
  }
}

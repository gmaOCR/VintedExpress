import { beforeEach, describe, expect, it } from 'vitest';

import { promptRotationAngle, rotateImageFile } from '../src/lib/rotation';

// Fournit un faux PNG minimal (en pratique le contenu n'est pas décodé dans jsdom)
function createPng(): File {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  return new File([bytes], 'test.png', { type: 'image/png' });
}

describe('rotation modal + rotateImageFile', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('auto mode via localStorage bypasses modal', async () => {
    localStorage.setItem('vx:rotate:auto', '5');
    const angle = await promptRotationAngle();
    expect(angle).toBe(5);
    expect(document.getElementById('vx-rotate-modal')).toBeNull();
  });

  it('does not close on outside click anymore and cancels via button', async () => {
    const p = promptRotationAngle();
    const overlay = await new Promise<HTMLElement>((resolve) => {
      const deadline = Date.now() + 1000;
      (function wait() {
        const el = document.getElementById('vx-rotate-modal');
        if (el) return resolve(el);
        if (Date.now() > deadline) throw new Error('modal not mounted');
        setTimeout(wait, 10);
      })();
    });
    // Simule un clic "extérieur" (overlay). La modale ne doit plus se fermer.
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // Attendre un tick
    await new Promise((r) => setTimeout(r, 10));
    expect(document.getElementById('vx-rotate-modal')).toBeTruthy();
    // Annuler explicitement
    const cancelBtn = document.getElementById('vx-rotate-cancel') as HTMLButtonElement;
    cancelBtn.click();
    const angle = await p;
    expect(angle).toBeNull();
  });

  it('applies entered angle when clicking Apply', async () => {
    const p = promptRotationAngle();
    await new Promise<HTMLElement>((resolve) => {
      const deadline = Date.now() + 1000;
      (function wait() {
        const overlay = document.getElementById('vx-rotate-modal');
        const input = document.getElementById('vx-rotate-input');
        if (overlay && input) return resolve(overlay);
        if (Date.now() > deadline) throw new Error('modal not mounted');
        setTimeout(wait, 10);
      })();
    });
    const input = document.getElementById('vx-rotate-input') as HTMLInputElement;
    input.value = '7.5';
    const btn = document.getElementById('vx-rotate-apply') as HTMLButtonElement;
    btn.click();
    const angle = await p;
    expect(angle).toBe(7.5);
  });

  it('rotateImageFile returns same file when environment cannot decode (jsdom fallback)', async () => {
    const f = createPng();
    const out = await rotateImageFile(f, 10);
    expect(out).toBeInstanceOf(File);
    // Dans jsdom sans canvas implémenté, rotateImageFile va retourner le fichier initial (fallback)
    // On accepte ce comportement tant que ce n'est pas une régression (pas d'exception).
    expect(out.name).toBe(f.name);
  });

  it('rotateImageFile returns same file if angle=0', async () => {
    const f = createPng();
    const out = await rotateImageFile(f, 0);
    expect(out).toBe(f);
  });
});

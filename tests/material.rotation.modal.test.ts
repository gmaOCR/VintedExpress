import { beforeEach, describe, expect, it } from 'vitest';

import { promptRotationAngle } from '../src/lib/rotation';

// Ce test vérifie que cliquer sur "Appliquer" dans la modale de rotation
// ne réinitialise pas un input "material" déjà saisi.

describe('rotation modal does not reset material input', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('keeps existing material value after clicking Apply', async () => {
    // Simule un champ material existant
    const materialInput = document.createElement('input');
    materialInput.type = 'text';
    materialInput.name = 'material';
    materialInput.id = 'material';
    materialInput.value = 'Cotton';
    document.body.appendChild(materialInput);

    const p = promptRotationAngle();
    // Attendre montage
    await new Promise<void>((resolve) => {
      const deadline = Date.now() + 1000;
      (function wait() {
        if (document.getElementById('vx-rotate-modal')) return resolve();
        if (Date.now() > deadline) throw new Error('modal not mounted');
        setTimeout(wait, 10);
      })();
    });

    const input = document.getElementById('vx-rotate-input') as HTMLInputElement;
    input.value = '3';
    const apply = document.getElementById('vx-rotate-apply') as HTMLButtonElement;
    apply.click();
    const angle = await p;
    expect(angle).toBe(3);
    // Vérifie que la valeur material n'a pas changé
    expect(materialInput.value).toBe('Cotton');
  });
});

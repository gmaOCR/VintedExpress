// Auto-remplissage du formulaire /items/new à partir du brouillon stocké
import { fillNewItemForm } from '../lib/filler';
import { log } from '../lib/metrics';
import type { RepublishDraft } from '../types/draft';
export {};

// Bootstrap minimal: récupérer le brouillon et déclencher le transfert d'images
(async () => {
  try {
    const chromeAny = (window as unknown as { chrome?: unknown }).chrome as
      | {
          storage?: {
            local?: { get?: (k: unknown, cb: (i: Record<string, unknown>) => void) => void };
          };
        }
      | undefined;
    if (!chromeAny?.storage?.local?.get) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    chromeAny.storage?.local?.get?.('vx:republishDraft', async (items: Record<string, unknown>) => {
      type Draft = Partial<RepublishDraft>;
      const draft = ((items && (items['vx:republishDraft'] as Draft)) || {}) as Draft;
      try {
        imgLog('info', 'draft loaded', {
          hasImages: !!draft.images?.length,
          imagesCount: draft.images?.length ?? 0,
          url: location.href,
        });
        imgLog('info', 'env', {
          userAgent: navigator.userAgent,
          location: location.href,
          debug: localStorage.getItem('vx:debug') === '1',
          debugImages: localStorage.getItem('vx:debugImages') === '1',
          e2e: localStorage.getItem('vx:e2e') === '1',
        });
      } catch {
        /* ignore */
      }
      // Si aucune dropzone n'est présente sur la page, logguer l'information (utile en e2e)
      try {
        const hasDropHost = !!(
          document.querySelector('[data-testid="dropzone"]') ||
          document.querySelector('.media-select__input') ||
          document.querySelector('[data-testid="photo-uploader"]')
        );
        if (!hasDropHost) imgLog('debug', 'dropHost not found (initial)');
      } catch {
        /* ignore */
      }
      // ========================================
      // WORKFLOW ULTRA-SIMPLIFIÉ
      // ========================================
      // 1. Attendre chargement page
      // 2. Remplir formulaire
      // 3. FIN - L'utilisateur upload les images manuellement
      // ========================================

      try {
        // Attendre que React charge les champs essentiels
        log('info', 'workflow:wait-page');
        const maxWait = Date.now() + 10000;
        while (Date.now() < maxWait) {
          const ready =
            !!document.querySelector('input[name="title"]') &&
            !!document.querySelector('input[name="price"]') &&
            !!document.querySelector('[data-testid="catalog-select-dropdown-input"]');

          if (ready) {
            await new Promise((r) => setTimeout(r, 500));
            log('info', 'workflow:page-ready');
            break;
          }
          await new Promise((r) => setTimeout(r, 200));
        }

        // Remplir le formulaire
        log('info', 'workflow:fill-start');
        await fillNewItemForm(draft as unknown as RepublishDraft);
        log('info', 'workflow:fill-end');

        // Fermer les dropdowns ouverts
        await new Promise((r) => setTimeout(r, 500));
        const openDropdowns = document.querySelectorAll('[data-testid$="-dropdown-content"]');
        for (const dropdown of Array.from(openDropdowns)) {
          if (dropdown instanceof HTMLElement && dropdown.offsetParent !== null) {
            const input = dropdown.parentElement?.querySelector('input');
            if (input) {
              input.blur();
              document.body.click();
            }
          }
        }

        // PROTECTION ULTRA-AGRESSIVE: Bloquer les resets causés par les clics
        await new Promise((r) => setTimeout(r, 1000));
        log('info', 'workflow:protect-start');
        const capturedValues = captureAllFieldValues();
        log('info', 'workflow:values-captured', { count: capturedValues.size });

        // 1. BLOQUER LES CLICS sur les zones sensibles (état, taille, matière)
        const sensitiveSelectors = [
          '[data-testid="item-status-id-dropdown"]',
          '[data-testid="size-id-dropdown"]',
          '[data-testid="material-id-dropdown"]',
          '[data-testid="item-status-id-dropdown-input"]',
          '[data-testid="size-id-dropdown-input"]',
          '[data-testid="material-id-dropdown-input"]',
        ];

        const blockClick = (e: Event) => {
          const target = e.target as HTMLElement;
          for (const sel of sensitiveSelectors) {
            const elem = document.querySelector(sel);
            if (elem && (elem === target || elem.contains(target))) {
              log('debug', 'workflow:click-blocked', { selector: sel });
              e.stopPropagation();
              e.stopImmediatePropagation();
              e.preventDefault();
              return false;
            }
          }
        };

        // Capturer les clics en phase capture (avant React)
        document.addEventListener('click', blockClick, { capture: true });
        document.addEventListener('mousedown', blockClick, { capture: true });
        document.addEventListener('mouseup', blockClick, { capture: true });
        log('info', 'workflow:click-blocker-active');

        // 2. FORCER les valeurs en continu (polling agressif)
        const forceValues = () => {
          let forced = 0;
          for (const [selector, expectedValue] of capturedValues.entries()) {
            const input = document.querySelector(selector) as
              | HTMLInputElement
              | HTMLTextAreaElement
              | null;
            if (input && input.value !== expectedValue && expectedValue) {
              input.value = expectedValue;
              forced++;
            }
          }
          if (forced > 0) {
            log('debug', 'workflow:force-values', { count: forced });
          }
        };

        // Forcer les valeurs toutes les 100ms pendant 30 secondes
        const forceInterval = setInterval(forceValues, 100);
        setTimeout(() => {
          clearInterval(forceInterval);
          log('info', 'workflow:force-interval-stopped');
        }, 30000);

        // 3. OBSERVER MutationObserver (backup au cas où)
        const observer = new MutationObserver(() => {
          let restored = 0;
          for (const [selector, expectedValue] of capturedValues.entries()) {
            const input = document.querySelector(selector) as
              | HTMLInputElement
              | HTMLTextAreaElement
              | null;
            if (input && input.value !== expectedValue && expectedValue) {
              log('debug', 'workflow:restore-value', { selector, expected: expectedValue });
              input.value = expectedValue;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              restored++;
            }
          }
          if (restored > 0) {
            log('info', 'workflow:values-restored', { count: restored });
          }
        });

        const form = document.querySelector('form');
        if (form) {
          observer.observe(form, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['value'],
          });
          log('info', 'workflow:observer-active');
        }

        // 4. VERROUILLER visuellement les champs sensibles
        const lockFields = () => {
          const fieldsToLock = [
            'item-status-id-dropdown-input',
            'size-id-dropdown-input',
            'material-id-dropdown-input',
          ];

          for (const testId of fieldsToLock) {
            const input = document.querySelector(
              `[data-testid="${testId}"]`,
            ) as HTMLInputElement | null;
            if (input && input.value) {
              // Ajouter un indicateur visuel de verrouillage
              input.style.backgroundColor = '#f0fdf4'; // vert très clair
              input.style.borderColor = '#22c55e'; // vert
              input.style.pointerEvents = 'none'; // Bloquer tous les événements pointer

              // Ajouter un icône de cadenas
              const parent = input.parentElement;
              if (parent && !parent.querySelector('.vx-lock-icon')) {
                const lockIcon = document.createElement('span');
                lockIcon.className = 'vx-lock-icon';
                lockIcon.textContent = '🔒';
                lockIcon.style.cssText = `
                  position: absolute;
                  right: 8px;
                  top: 50%;
                  transform: translateY(-50%);
                  font-size: 14px;
                  pointer-events: none;
                  z-index: 10;
                `;
                parent.style.position = 'relative';
                parent.appendChild(lockIcon);
              }
            }
          }
        };

        lockFields();
        log('info', 'workflow:fields-locked');

        log('info', 'workflow:complete');

        // Ajouter un bouton pour uploader les images manuellement
        if (draft.images && draft.images.length > 0) {
          injectUploadButton(draft.images);
        }
      } catch (error) {
        log('warn', 'workflow:error', {
          message: (error as Error)?.message ?? null,
        });
      }
    });
  } catch {
    /* ignore */
  }
})();

// Expose API e2e
declare global {
  interface Window {
    __vx_invokeFill?: (d: Partial<RepublishDraft>) => Promise<void>;
  }
}

async function __vx_fillDraft(d: Partial<RepublishDraft>) {
  try {
    await fillNewItemForm(d as unknown as RepublishDraft);
  } catch {
    /* ignore */
  }
}

try {
  window.__vx_invokeFill = __vx_fillDraft;
} catch {
  /* ignore */
}

// ===================================================================
// UPLOAD D'IMAGES DÉSACTIVÉ
// ===================================================================
// L'upload automatique des images causait des re-renders React
// qui effaçaient les valeurs du formulaire. Solution: laisser
// l'utilisateur uploader les images manuellement.
// ===================================================================

// Injecte un bouton pour uploader les images manuellement
function injectUploadButton(imageUrls: string[]) {
  // Vérifier si le bouton existe déjà
  if (document.getElementById('vx-upload-btn')) return;

  // Trouver la dropzone
  const dropzone =
    document.querySelector('[data-testid="dropzone"]') ||
    document.querySelector('.media-select__input') ||
    document.querySelector('[data-testid="photo-uploader"]');

  if (!dropzone) {
    log('warn', 'upload-button:no-dropzone');
    return;
  }

  // Créer le bouton
  const btn = document.createElement('button');
  btn.id = 'vx-upload-btn';
  btn.type = 'button';
  btn.textContent = `📤 Uploader ${imageUrls.length} image${imageUrls.length > 1 ? 's' : ''}`;
  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    padding: 12px 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  btn.onmouseover = () => {
    btn.style.transform = 'translateY(-2px)';
    btn.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
  };

  btn.onmouseout = () => {
    btn.style.transform = 'translateY(0)';
    btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  };

  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = '⏳ Upload en cours...';
    btn.style.background = 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)';

    try {
      // Import dynamique du module d'upload
      const { uploadImages } = await import('../lib/image-uploader');
      await uploadImages(imageUrls.slice(0, 10));

      btn.textContent = '✅ Upload terminé !';
      btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';

      setTimeout(() => {
        btn.remove();
      }, 3000);
    } catch (error) {
      log('warn', 'upload-button:error', { message: (error as Error)?.message });
      btn.textContent = '❌ Erreur upload';
      btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      btn.disabled = false;

      setTimeout(() => {
        btn.textContent = `📤 Réessayer (${imageUrls.length} images)`;
        btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      }, 3000);
    }
  };

  document.body.appendChild(btn);
  log('info', 'upload-button:injected', { count: imageUrls.length });
}

// Capture toutes les valeurs des champs du formulaire
function captureAllFieldValues(): Map<string, string> {
  const values = new Map<string, string>();
  const inputs = document.querySelectorAll('input, textarea, select');
  for (const input of Array.from(inputs)) {
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      if (input.value && input.name) {
        values.set(`[name="${input.name}"]`, input.value);
      }
      // Capturer aussi par data-testid pour les dropdowns
      const testId = input.getAttribute('data-testid');
      if (testId && input.value) {
        values.set(`[data-testid="${testId}"]`, input.value);
      }
    }
  }
  return values;
}

// Fonction de log pour le debug (utilisée pour les logs d'images)
function imgLog(level: 'info' | 'warn' | 'debug', ...args: unknown[]) {
  /* eslint-disable no-console */
  try {
    const ls = (k: string) => {
      try {
        return localStorage.getItem(k) === '1';
      } catch {
        return false;
      }
    };
    const isE2E =
      ls('vx:e2e') || (typeof document !== 'undefined' && document.cookie.includes('vx:e2e=1'));
    const isDebug = ls('vx:debug') || ls('vx:debugImages');
    if (!(isE2E || isDebug)) return; // reste silencieux en production

    const prefix = '[VX:img]';
    const fn = level === 'warn' ? console.warn : level === 'debug' ? console.debug : console.log;
    // Normalise les objets pour éviter [object Object] dans msg.text()
    const norm = (v: unknown) =>
      typeof v === 'string'
        ? v
        : (() => {
            try {
              return JSON.stringify(v);
            } catch {
              return String(v);
            }
          })();
    fn(prefix, ...args.map(norm));
  } catch {
    /* ignore */
  }
  /* eslint-enable no-console */
}

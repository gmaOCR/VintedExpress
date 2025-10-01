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

        // Page blocker supprimé - il empìhe de cliquer sur le bouton d'upload
        log('info', 'workflow:no-page-blocker');

        // Remplir le formulaire
        log('info', 'workflow:fill-start');
        await fillNewItemForm(draft as unknown as RepublishDraft);
        log('info', 'workflow:fill-end');

        // Fermer les dropdowns en utilisant blur() seulement (pas de click)
        await new Promise((r) => setTimeout(r, 500));
        const openDropdowns = document.querySelectorAll('[data-testid$="-dropdown-content"]');
        for (const dropdown of Array.from(openDropdowns)) {
          if (dropdown instanceof HTMLElement && dropdown.offsetParent !== null) {
            const input = dropdown.parentElement?.querySelector('input');
            if (input) {
              input.blur();
              // document.body.click() SUPPRIMÉ - peut causer reset des champs
            }
          }
        }

        // PROTECTION ULTRA-RENFORCÉE: Activation IMMÉDIATE (pas d'attente !)
        log('info', 'workflow:protect-start');

        // Capturer les valeurs IMMÉDIATEMENT
        const capturedValues = new Map<string, string>();
        const sensitiveSelectors = [
          '[data-testid="item-status-id-dropdown-input"]',
          '[data-testid="size-id-dropdown-input"]',
          '[data-testid="material-id-dropdown-input"]',
        ];

        // Attendre 100ms seulement pour que React finisse de rendre
        await new Promise((r) => setTimeout(r, 100));

        for (const selector of sensitiveSelectors) {
          const input = document.querySelector(selector) as HTMLInputElement | null;
          if (input && input.value) {
            capturedValues.set(selector, input.value);
            log('debug', 'workflow:value-captured', { selector, value: input.value });
          }
        }

        log('info', 'workflow:values-captured', { count: capturedValues.size });

        const sensitiveInputs = Array.from(
          document.querySelectorAll(sensitiveSelectors.join(', ')),
        ) as HTMLInputElement[];

        // PROTECTION SIMPLIFIÉE: Pas de blocage d'événements (causait des problèmes)
        // Seulement style visuel + polling pour forcer les valeurs
        for (const input of sensitiveInputs) {
          // Style visuel pour indiquer que le champ est protégé
          input.style.backgroundColor = '#f0fdf4';
          input.style.borderColor = '#22c55e';
          input.style.opacity = '1';

          // Empêcher l'édition directe mais permettre les clics
          input.readOnly = true;
          input.tabIndex = -1;
        }

        // COUCHE 2: Polling ULTRA-AGRESSIF pour forcer les valeurs
        const forceValues = () => {
          for (const [selector, expectedValue] of capturedValues.entries()) {
            const input = document.querySelector(selector) as HTMLInputElement | null;
            if (input) {
              if (input.value !== expectedValue) {
                log('warn', 'workflow:value-reset-detected', {
                  selector,
                  expected: expectedValue,
                  current: input.value,
                });
                input.value = expectedValue;
                // Forcer React à voir la valeur
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
                  input,
                  expectedValue,
                );
              }
            }
          }
        };

        // Forcer toutes les 50ms pendant 60 secondes
        const forceInterval = setInterval(forceValues, 50);
        setTimeout(() => {
          clearInterval(forceInterval);
          log('info', 'workflow:force-interval-stopped');
        }, 60000);

        // COUCHE 3: MutationObserver pour détecter les changements DOM
        const observer = new MutationObserver(() => {
          forceValues();
        });

        const form = document.querySelector('form');
        if (form) {
          observer.observe(form, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
          });
        }

        log('info', 'workflow:fields-protected', { count: sensitiveInputs.length });

        // Ajouter icône visuelle
        for (const input of sensitiveInputs) {
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
              z-index: 10000;
            `;
            parent.appendChild(lockIcon);
          }
        }

        // Ajouter un message d'information simple
        const infoBox = document.createElement('div');
        infoBox.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999999;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          pointer-events: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        infoBox.textContent = '✅ Formulaire rempli - Valeurs protégées automatiquement';
        document.body.appendChild(infoBox);

        // Masquer le message après 5 secondes
        setTimeout(() => {
          infoBox.style.opacity = '0';
          infoBox.style.transition = 'opacity 0.5s';
          setTimeout(() => infoBox.remove(), 500);
        }, 5000);

        log('info', 'workflow:protection-active');

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
      log('info', 'upload-button:success', { count: imageUrls.length });

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

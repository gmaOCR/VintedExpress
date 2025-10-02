// Minimal content script for /items/new: load draft, fill form, expose e2e API,
// inject a manual upload button and run a lightweight monitor to reapply
// draft values if React clears them briefly.

import { fillNewItemForm } from '../lib/filler';
import { log } from '../lib/metrics';
import type { RepublishDraft } from '../types/draft';
export {};

// Lightweight helper: show a temporary info box
function showInfo(msg: string) {
  const box = document.createElement('div');
  box.style.cssText = [
    'position:fixed',
    'top:16px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:9999999',
    'background:#10b981',
    'color:#fff',
    'padding:10px 16px',
    'border-radius:8px',
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    'pointer-events:none',
  ].join(';');
  box.textContent = msg;
  document.body.appendChild(box);
  setTimeout(() => {
    box.style.transition = 'opacity 0.4s';
    box.style.opacity = '0';
    setTimeout(() => box.remove(), 450);
  }, 1800);
}

// Minimal monitor: for a short period after fill, if an observed input is
// cleared while we know the draft value, reapply it using the native setter.
function startLightMonitor(
  fields: Array<{ name: string; selector: string }>,
  draft: Partial<RepublishDraft>,
) {
  const handles: Array<MutationObserver> = [];
  const maxTries = 4;

  for (const f of fields) {
    const el = document.querySelector(f.selector) as HTMLInputElement | null;
    if (!el) continue;

    // Avoid `any` casts: treat draft as a loose record to access fields safely
    const draftRecord = draft as Record<string, unknown> | undefined;
    const target = (draftRecord?.[f.name] as string | undefined) ?? el.value ?? '';
    if (!target) continue;

    let tries = 0;
    let last = el.value;

    const applyNative = () => {
      try {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(el, target);
        else el.value = target;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch {
        try {
          el.value = target;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } catch {
          /* ignore */
        }
      }
    };

    const obs = new MutationObserver(() => {
      if (el.value !== last) {
        const wasReset = !!last && !el.value;
        if (wasReset && tries < maxTries) {
          tries += 1;
          log('warn', 'monitor:restore', { field: f.name, attempt: tries });
          applyNative();
          // small later retry to survive quick rerenders
          setTimeout(() => {
            if (el.value !== target && tries < maxTries) applyNative();
          }, 100);
        }
        last = el.value;
      }
    });

    obs.observe(el, { attributes: true, attributeFilter: ['value'], subtree: true });
    handles.push(obs);
  }

  // Stop monitoring after a short grace period
  setTimeout(() => handles.forEach((h) => h.disconnect()), 6000);
}

// Inject manual upload button (kept minimal)
function injectUploadButton(imageUrls: string[] | undefined) {
  if (!imageUrls || imageUrls.length === 0) return;
  if (document.getElementById('vx-upload-btn')) return;

  const dropzone =
    document.querySelector('[data-testid="dropzone"]') ||
    document.querySelector('.media-select__input') ||
    document.querySelector('[data-testid="photo-uploader"]');

  if (!dropzone) return;

  const btn = document.createElement('button');
  btn.id = 'vx-upload-btn';
  btn.type = 'button';
  btn.textContent = `Uploader ${imageUrls.length} image${imageUrls.length > 1 ? 's' : ''}`;
  btn.style.cssText = [
    'position:fixed',
    'right:16px',
    'bottom:16px',
    'z-index:10000',
    'padding:10px 14px',
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    'border-radius:8px',
    'background:#667eea',
    'color:#fff',
    'border:none',
    'cursor:pointer',
  ].join(';');

  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = 'Upload en cours...';
    try {
      const mod = await import('../lib/image-uploader');
      await mod.uploadImages(imageUrls.slice(0, 10));
      btn.textContent = 'Upload terminé';
      setTimeout(() => btn.remove(), 1200);
      log('info', 'upload-button:success', { count: imageUrls.length });
    } catch (err) {
      log('warn', 'upload-button:error', { message: (err as Error)?.message ?? String(err) });
      btn.disabled = false;
      btn.textContent = `Réessayer (${imageUrls.length})`;
    }
  };

  document.body.appendChild(btn);
}

// Main bootstrap: read draft from chrome.storage.local and run fill
(async function main() {
  try {
    const chromeAny = (window as unknown as { chrome?: unknown }).chrome as
      | {
          storage?: {
            local?: { get?: (k: unknown, cb: (i: Record<string, unknown>) => void) => void };
          };
        }
      | undefined;
    if (!chromeAny?.storage?.local?.get) return;

    // small delay for the host page to render initial inputs
    await new Promise((r) => setTimeout(r, 0));

    chromeAny.storage.local.get('vx:republishDraft', async (items: Record<string, unknown>) => {
      try {
        const draft = (items && (items['vx:republishDraft'] as Partial<RepublishDraft>)) || {};

        // Try to wait briefly for minimal form readiness; bail out if not present
        const ready = () => !!document.querySelector('input[name="title"]');
        const start = Date.now();
        while (!ready() && Date.now() - start < 5000) await new Promise((r) => setTimeout(r, 200));

        await fillNewItemForm(draft as RepublishDraft);
        showInfo('Formulaire rempli');
        log('info', 'workflow:fill-complete');

        // Start a light monitor for important fields
        const monitored = [
          {
            name: 'condition',
            selector:
              'input[name="condition"], [data-testid*="condition"][data-testid$="dropdown-input"]',
          },
          {
            name: 'size',
            selector: 'input[name="size"], [data-testid*="size"][data-testid$="dropdown-input"]',
          },
          {
            name: 'material',
            selector:
              'input[name="material"], [data-testid*="material"][data-testid$="dropdown-input"]',
          },
          {
            name: 'brand',
            selector: 'input[name="brand"], [data-testid*="brand"][data-testid$="dropdown-input"]',
          },
        ];
        startLightMonitor(monitored, draft as Partial<RepublishDraft>);

        // Inject upload button if images present
        const draftRecord = draft as Record<string, unknown> | undefined;
        injectUploadButton((draftRecord?.images as string[] | undefined) ?? undefined);
      } catch (err) {
        log('warn', 'workflow:fill-error', { message: (err as Error)?.message ?? String(err) });
      }
    });
  } catch {
    /* ignore */
  }
})();

// Expose e2e API
declare global {
  interface Window {
    __vx_invokeFill?: (d: Partial<RepublishDraft>) => Promise<void>;
  }
}

async function __vx_fillDraft(d: Partial<RepublishDraft>) {
  try {
    await fillNewItemForm(d as RepublishDraft);
    showInfo('Formulaire rempli (e2e)');
  } catch {
    /* ignore */
  }
}

try {
  // attach if possible
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__vx_invokeFill = __vx_fillDraft;
} catch {
  /* ignore */
}

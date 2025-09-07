// Auto-remplissage du formulaire /items/new à partir du brouillon stocké
import { fillNewItemForm } from '../lib/filler';
import {
  ensureExtension,
  ensureUploadableImage,
  inferNameFromUrl,
  prepareFile,
} from '../lib/images';
import { sendMessage } from '../lib/messaging';
import { promptRotationAngle, rotateImageFile } from '../lib/rotation';
import {
  dispatchInputFiles,
  dndOneFile,
  getFeedbackTargets,
  jitter,
  resolveDropHost,
  waitForDropHost,
  waitForMediaFeedback,
} from '../lib/upload';
import type { RepublishDraft } from '../types/draft';
import { ImageConvertJpeg, ImageDownload } from '../types/messages';
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
      // Remplissage générique
      try {
        await __vx_fillDraft(draft);
      } catch {
        /* ignore */
      }
      if (Array.isArray(draft.images) && draft.images.length) {
        imgLog('info', 'images:start', { count: draft.images.length, first: draft.images[0] });
        await tryDropImages(draft.images.slice(0, 10));
        imgLog('info', 'images:end');
      } else {
        imgLog('warn', 'no images found in draft');
      }
    });
  } catch {
    /* ignore */
  }
})();

// Remplissage: expose une API e2e et applique titre/description + sélections simples
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

// Expose pour les tests e2e
try {
  window.__vx_invokeFill = __vx_fillDraft;
} catch {
  /* ignore */
}

async function tryDropImages(urls: string[]) {
  // Cible prioritaire: la dropzone officielle; attendre brièvement si absente
  let dropHost = resolveDropHost();
  if (!dropHost) {
    dropHost = await waitForDropHost(8000);
    if (!dropHost) {
      imgLog('warn', 'dropHost not found');
      // Fallback: tenter directement via un input[type=file] global même sans dropzone
      const anyInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
      if (anyInput) {
        try {
          imgLog('info', 'fallback:global-file-input:found');
          const files: File[] = urls.map(
            (u) =>
              new File(
                [new Blob([''], { type: 'application/octet-stream' })],
                inferNameFromUrl(u) || 'image',
              ),
          );
          dispatchInputFiles(anyInput, files);
          imgLog('info', 'fallback:global-file-input:dispatched', { count: files.length });
        } catch (e) {
          imgLog('warn', 'fallback:global-file-input:failed', { err: (e as Error)?.message });
        }
      }
      return;
    }
  }
  imgLog('info', 'dropHost resolved', {
    hasOverlay: !!dropHost.querySelector('[data-testid="dropzone-overlay"]'),
    hasGrid: !!document.querySelector('[data-testid="media-select-grid"]'),
  });
  dropHost.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // FEATURE rotation: demander l'angle AVANT tout téléchargement/traitement pour garantir affichage modale
  let rotationAngle: number | null = null;
  try {
    rotationAngle = await promptRotationAngle();
    if (rotationAngle === null) {
      imgLog('info', 'rotation:cancelled');
      return; // annule totalement l'upload
    }
    imgLog('info', 'rotation:angle', { angle: rotationAngle });
  } catch {
    /* ignore */
  }

  // Télécharger en background pour contourner CORS et reconstituer des File en mémoire
  const files: File[] = [];
  const enableConcurrency = localStorage.getItem('vx:img:concurrency') === '1';
  const maxConc = Number(localStorage.getItem('vx:img:max')) || 4;
  if (enableConcurrency) {
    // queue simple avec fenêtre de concurrence (maxConc)
    const queue = urls.slice();
    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.max(1, Math.min(maxConc, queue.length)); i++) {
      workers.push(
        (async () => {
          while (queue.length) {
            const url = queue.shift()!;
            await processOne(url);
          }
        })(),
      );
    }
    await Promise.allSettled(workers);
  } else {
    for (const url of urls) {
      await processOne(url);
    }
  }

  async function processOne(url: string) {
    try {
      imgLog('info', 'step:bg-download:request', { url });
      // 1) Tentative via background
      const res = (await sendMessage(ImageDownload, { type: 'image:download', url })) as
        | {
            ok: boolean;
            url: string;
            contentType?: string;
            name?: string;
            bytes?: ArrayBuffer;
            bytesB64?: string;
          }
        | undefined;

      let prepared: File | null = null;

      if (res && res.ok && res.bytes && (res.bytes as ArrayBuffer).byteLength > 0) {
        imgLog('debug', 'image downloaded', {
          url: res.url,
          contentType: res.contentType,
          name: res.name,
          bytes: (res.bytes as ArrayBuffer).byteLength,
        });
        const fetchedType = res.contentType || 'application/octet-stream';
        const fetchedName = res.name || inferNameFromUrl(url) || 'image';
        const srcBlob = new Blob([new Uint8Array(res.bytes)], { type: fetchedType });
        imgLog('info', 'step:bg-download:response', {
          url: res.url,
          type: fetchedType,
          name: fetchedName,
          size: (res.bytes as ArrayBuffer).byteLength,
        });
        // Conversion via background si nécessaire
        if (!/image\/(jpeg|jpg|png)/i.test(fetchedType)) {
          try {
            imgLog('info', 'step:bg-convert:request', {
              name: fetchedName,
              type: fetchedType,
              size: (res.bytes as ArrayBuffer).byteLength,
            });
            const conv = (await sendMessage(ImageConvertJpeg, {
              type: 'image:convert-jpeg',
              name: fetchedName,
              contentType: fetchedType,
              bytes: res.bytes as ArrayBuffer,
            })) as { ok: boolean; name?: string; type?: string; bytes?: ArrayBuffer } | undefined;
            if (
              conv &&
              conv.ok &&
              conv.bytes &&
              conv.type &&
              /image\/(jpeg|jpg|png)/i.test(conv.type)
            ) {
              const outType = conv.type.toLowerCase().includes('png') ? 'image/png' : 'image/jpeg';
              const outName = ensureExtension(
                fetchedName,
                outType === 'image/png' ? '.png' : '.jpg',
              );
              prepared = new File([new Uint8Array(conv.bytes)], outName, { type: outType });
              imgLog('info', 'converted via background', {
                name: outName,
                type: outType,
                size: prepared.size,
              });
            } else {
              imgLog('info', 'step:bg-convert:response:unusable', conv || null);
            }
          } catch {
            // ignore background conversion error; will try in-page
            imgLog('info', 'step:bg-convert:error');
          }
        }
        if (!prepared) {
          imgLog('info', 'step:ensure:start:bg-bytes');
          prepared = await ensureUploadableImage(srcBlob, fetchedName);
          imgLog(
            'info',
            'step:ensure:end:bg-bytes',
            prepared
              ? { name: prepared.name, type: prepared.type, size: prepared.size }
              : { result: null },
          );
        }
      } else if (res && res.ok) {
        // Try base64 fallback
        if (res.bytesB64 && res.bytesB64.length > 0) {
          try {
            const raw = fromBase64(res.bytesB64);
            const ab = raw.buffer as ArrayBuffer;
            const fetchedType = res.contentType || 'application/octet-stream';
            const fetchedName = res.name || inferNameFromUrl(url) || 'image';
            const srcBlob = new Blob([new Uint8Array(ab)], { type: fetchedType });
            imgLog('info', 'step:bg-download:response:b64', {
              url: res.url,
              type: fetchedType,
              name: fetchedName,
              size: ab.byteLength,
            });
            let prepared: File | null = null;
            if (!/image\/(jpeg|jpg|png)/i.test(fetchedType)) {
              try {
                imgLog('info', 'step:bg-convert:request', {
                  name: fetchedName,
                  type: fetchedType,
                  size: ab.byteLength,
                });
                const conv = (await sendMessage(ImageConvertJpeg, {
                  type: 'image:convert-jpeg',
                  name: fetchedName,
                  contentType: fetchedType,
                  bytes: ab,
                })) as
                  | { ok: boolean; name?: string; type?: string; bytes?: ArrayBuffer }
                  | undefined;
                if (
                  conv &&
                  conv.ok &&
                  conv.bytes &&
                  conv.type &&
                  /image\/(jpeg|jpg|png)/i.test(conv.type)
                ) {
                  const outType = conv.type.toLowerCase().includes('png')
                    ? 'image/png'
                    : 'image/jpeg';
                  const outName = ensureExtension(
                    fetchedName,
                    outType === 'image/png' ? '.png' : '.jpg',
                  );
                  prepared = new File([new Uint8Array(conv.bytes)], outName, { type: outType });
                  imgLog('info', 'converted via background', {
                    name: outName,
                    type: outType,
                    size: prepared.size,
                  });
                }
              } catch {
                imgLog('info', 'step:bg-convert:error');
              }
            }
            if (!prepared) {
              imgLog('info', 'step:ensure:start:bg-b64');
              prepared = await ensureUploadableImage(srcBlob, fetchedName);
              imgLog(
                'info',
                'step:ensure:end:bg-b64',
                prepared
                  ? { name: prepared.name, type: prepared.type, size: prepared.size }
                  : { result: null },
              );
            }
            if (prepared) {
              files.push(prepared);
              return; // next URL
            }
          } catch {
            // fall through to in-page fetch
          }
        }
        imgLog('warn', 'bg-download returned empty bytes, will try in-page fetch', {
          url: res.url,
          contentType: res.contentType,
          name: res.name,
          bytes: res.bytes ? (res.bytes as ArrayBuffer).byteLength : 0,
          hasB64: !!res.bytesB64,
        });
      }

      // 2) Fallback côté page: fetch CORS direct et construction de File
      if (!prepared) {
        try {
          imgLog('info', 'step:fetch:start', { url });
          const r = await fetch(url, { mode: 'cors' as RequestMode });
          if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
          const blob = await r.blob();
          const ct = (
            r.headers.get('content-type') ||
            blob.type ||
            'application/octet-stream'
          ).toLowerCase();
          imgLog('info', 'step:fetch:headers', {
            ok: r.ok,
            status: r.status,
            contentType: r.headers.get('content-type') || null,
            blobType: blob.type,
            size: blob.size,
          });
          const base = inferNameFromUrl(url) || 'image';
          if (/image\/(jpeg|jpg|png)/i.test(ct)) {
            prepared = new File(
              [blob],
              ensureExtension(base, ct.includes('png') ? '.png' : '.jpg'),
              {
                type: ct.includes('png') ? 'image/png' : 'image/jpeg',
              },
            );
            imgLog('info', 'file prepared via in-page fetch (native)', {
              name: prepared.name,
              type: prepared.type,
              size: prepared.size,
            });
          } else {
            imgLog('info', 'step:ensure:start:fetch-blob', { type: blob.type, size: blob.size });
            prepared = await ensureUploadableImage(blob, base);
            if (prepared) {
              imgLog('info', 'file prepared via in-page fetch (converted)', {
                name: prepared.name,
                type: prepared.type,
                size: prepared.size,
              });
            } else {
              imgLog('info', 'step:ensure:end:fetch-blob', { result: null });
            }
          }
        } catch (e) {
          imgLog('warn', 'in-page fetch failed', { url, err: (e as Error)?.message, errRaw: e });
        }
      }

      // 3) Ultime contournement côté page: charger via HTMLImageElement + canvas
      if (!prepared) {
        try {
          imgLog('info', 'step:img+canvas:start', { url });
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const im = new Image();
            try {
              // Peut échouer si CORS interdit le dessin, on tente tout de même
              im.crossOrigin = 'anonymous';
            } catch {
              // ignore
            }
            im.onload = () => resolve(im);
            im.onerror = () => reject(new Error('image load failed'));
            im.src = url;
          });
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (!w || !h) throw new Error('image has no dimensions');
          let outBlob: Blob | null = null;
          if ('OffscreenCanvas' in globalThis) {
            const Offs = (
              globalThis as unknown as {
                OffscreenCanvas: new (w: number, h: number) => OffscreenCanvas;
              }
            ).OffscreenCanvas;
            const canvas = new Offs(w, h);
            const ctx = canvas.getContext(
              '2d',
            ) as unknown as OffscreenCanvasRenderingContext2D | null;
            if (ctx) {
              (ctx as unknown as CanvasRenderingContext2D).drawImage(img, 0, 0);
              outBlob = await (
                canvas as unknown as {
                  convertToBlob: (opts: { type: string; quality?: number }) => Promise<Blob>;
                }
              ).convertToBlob({ type: 'image/jpeg', quality: 0.92 });
            }
          } else {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              outBlob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
              );
            }
          }
          if (outBlob) {
            const base = inferNameFromUrl(url) || 'image';
            prepared = new File([outBlob], ensureExtension(base, '.jpg'), { type: 'image/jpeg' });
            imgLog('info', 'file prepared via img+canvas', {
              name: prepared.name,
              type: prepared.type,
              size: prepared.size,
            });
          } else {
            imgLog('warn', 'img+canvas produced no blob');
          }
        } catch (e) {
          imgLog('warn', 'img+canvas failed', { url, err: (e as Error)?.message });
        }
      }

      if (prepared && prepared.size > 0) {
        files.push(prepared);
        imgLog('info', 'file prepared for upload', {
          name: prepared.name,
          type: prepared.type,
          size: prepared.size,
        });
      } else {
        imgLog('warn', 'image download/convert produced empty file, will try page prepareFile()', {
          url,
          resOk: res?.ok,
          hasBytes: !!res?.bytes,
        });
        try {
          const alt = await prepareFile(url);
          if (alt && alt.size > 0) {
            files.push(alt);
            imgLog('info', 'file prepared via prepareFile fallback', {
              name: alt.name,
              type: alt.type,
              size: alt.size,
            });
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      // ignore individual failures
    }
  }
  if (!files.length) {
    imgLog('warn', 'no files prepared for upload');
    return;
  }

  // Appliquer la rotation à chaque fichier (séquentiel pour limiter la charge mémoire)
  if (rotationAngle && Math.abs(rotationAngle) > 0.0001) {
    const rotated: File[] = [];
    for (const f of files) {
      try {
        const r = await rotateImageFile(f, rotationAngle);
        rotated.push(r);
      } catch {
        rotated.push(f);
      }
    }
    files.length = 0;
    for (const rf of rotated) files.push(rf);
  }

  imgLog('info', 'ready to upload files', { count: files.length, rotated: rotationAngle });

  // 1) Par défaut, préférer la simulation DnD (l’input est moins fiable côté Vinted)
  //    Si vous souhaitez forcer l’input, définissez localStorage.vx:preferInput = '1'.
  const preferInput = localStorage.getItem('vx:preferInput') === '1';
  if (preferInput) {
    const input = (dropHost.querySelector('input[type="file"]') ||
      document.querySelector('input[type="file"]')) as HTMLInputElement | null;
    if (input) {
      try {
        imgLog('info', 'step:input:try', {
          files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
        });
        const dtAll = new DataTransfer();
        for (const f of files) dtAll.items.add(f);
        Object.defineProperty(input, 'files', { value: dtAll.files });
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        imgLog('info', 'upload via input[type=file] dispatched', {
          files: files.map((f) => f.name),
        });
        return;
      } catch {
        imgLog('warn', 'input[type=file] path failed, falling back to DnD');
      }
    } else {
      imgLog('debug', 'no input[type=file] found, will use DnD');
    }
  }

  // 2) DnD unitaire: déposer un fichier, attendre que la grille s'incrémente, puis continuer
  // Attendre la grille si nécessaire
  let { grid, live } = getFeedbackTargets(dropHost);
  if (!grid || grid === dropHost) {
    const gDeadline = Date.now() + 3000;
    while ((!grid || grid === dropHost) && Date.now() < gDeadline) {
      await new Promise((r) => setTimeout(r, 120));
      imgLog('debug', 'waiting:grid');
      ({ grid, live } = getFeedbackTargets(dropHost));
    }
  }
  const target =
    (dropHost.querySelector('[data-testid="dropzone-overlay"]') as HTMLElement) || dropHost;
  const rect = target.getBoundingClientRect();
  const clientX = Math.floor(rect.left + rect.width / 2);
  const clientY = Math.floor(rect.top + rect.height / 2);
  imgLog('info', 'DnD setup', {
    gridFound: !!grid,
    liveFound: !!live,
    targetRect: { x: clientX, y: clientY, w: rect.width, h: rect.height },
  });

  let successCount = 0;
  for (const f of files) {
    await jitter(60, 180);
    const beforeCount = grid ? grid.childElementCount : 0;
    const beforeLive = live ? (live.textContent ?? '') : '';
    imgLog('info', 'step:dnd:dispatch', {
      name: f.name,
      type: f.type,
      size: f.size,
      beforeCount,
      beforeLive,
    });
    await dndOneFile(target, f);
    imgLog('debug', 'drop dispatched', { name: f.name, type: f.type, size: f.size });
    const ok = await waitForMediaFeedback(grid, live, beforeCount, beforeLive, 6000);
    if (!ok) {
      imgLog('warn', 'no feedback after drop (timeout)', {
        name: f.name,
        beforeCount,
        afterCount: grid?.childElementCount,
        beforeLive,
        afterLive: live?.textContent,
      });
    } else {
      successCount++;
    }
    await jitter(90, 220);
  }
  // Fallback: si aucun DnD n'a fonctionné, tenter via input (en cliquant le bouton pour dévoiler l'input)
  if (successCount === 0) {
    try {
      const btn = dropHost.querySelector<HTMLButtonElement>('.media-select__input button');
      if (btn) {
        btn.click();
        await new Promise((r) => setTimeout(r, 150));
      }
      const input = (dropHost.querySelector('input[type="file"]') ||
        document.querySelector('input[type="file"]')) as HTMLInputElement | null;
      if (input) {
        dispatchInputFiles(input, files);
        imgLog('info', 'fallback:input-after-dnd:dispatched', { count: files.length });
      } else {
        imgLog('warn', 'fallback:input-after-dnd:not-found');
      }
    } catch (e) {
      imgLog('warn', 'fallback:input-after-dnd:error', { err: (e as Error)?.message });
    }
  }
}

// waitForMediaFeedback déplacé vers lib/upload

// Convertit WEBP/AVIF en JPEG pour compatibilité, garde JPEG/PNG tels quels.
// Si le type est inconnu, on sniffe la signature binaire pour décider.
// En cas d’échec de conversion, on renvoie un File basé sur le blob original.
// helpers déplacés vers lib/images

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

// jitter déplacé vers lib/upload

// (helpers waitForEl/fillLog supprimés; le remplissage est délégué à lib/filler)

function fromBase64(b64: string): Uint8Array {
  try {
    // atob available in content context
    // eslint-disable-next-line no-undef
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff;
    return out;
  } catch {
    return new Uint8Array(0);
  }
}

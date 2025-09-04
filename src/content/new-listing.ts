// Auto-remplissage du formulaire /items/new à partir du brouillon stocké
import { fillNewItemForm } from '../lib/filler';
import { sendMessage } from '../lib/messaging';
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
  let dropHost =
    (document.querySelector('[data-testid="dropzone"]') as HTMLElement | null) ||
    (document.querySelector('.media-select__input') as HTMLElement | null) ||
    (document.querySelector('[data-testid="photo-uploader"]') as HTMLElement | null);
  if (!dropHost) {
    const deadline = Date.now() + 8000;
    while (!dropHost && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 120));
      imgLog('debug', 'waiting:dropHost');
      dropHost =
        (document.querySelector('[data-testid="dropzone"]') as HTMLElement | null) ||
        (document.querySelector('.media-select__input') as HTMLElement | null) ||
        (document.querySelector('[data-testid="photo-uploader"]') as HTMLElement | null);
    }
    if (!dropHost) {
      imgLog('warn', 'dropHost not found');
      // Fallback: tenter directement via un input[type=file] global même sans dropzone
      const anyInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
      if (anyInput) {
        try {
          imgLog('info', 'fallback:global-file-input:found');
          const files: File[] = [];
          for (const u of urls) {
            files.push(
              new File(
                [new Blob([''], { type: 'application/octet-stream' })],
                inferNameFromUrl(u) || 'image',
              ),
            );
          }
          const dtAll = new DataTransfer();
          for (const f of files) dtAll.items.add(f);
          Object.defineProperty(anyInput, 'files', { value: dtAll.files });
          anyInput.dispatchEvent(new Event('input', { bubbles: true }));
          anyInput.dispatchEvent(new Event('change', { bubbles: true }));
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

  // Télécharger en background pour contourner CORS et reconstituer des File en mémoire
  const files: File[] = [];
  for (const url of urls) {
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
              continue; // next URL
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
        imgLog('warn', 'image download/convert produced empty file, skipping', {
          url,
          resOk: res?.ok,
          hasBytes: !!res?.bytes,
        });
      }
    } catch {
      // ignore individual failures
    }
  }
  if (!files.length) {
    imgLog('warn', 'no files prepared for upload');
    return;
  }
  imgLog('info', 'ready to upload files', { count: files.length });

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
  let grid =
    (document.querySelector('[data-testid="media-select-grid"]') as HTMLElement | null) || dropHost;
  if (!grid || grid === dropHost) {
    const gDeadline = Date.now() + 3000;
    while ((!grid || grid === dropHost) && Date.now() < gDeadline) {
      await new Promise((r) => setTimeout(r, 120));
      imgLog('debug', 'waiting:grid');
      grid =
        (document.querySelector('[data-testid="media-select-grid"]') as HTMLElement | null) ||
        dropHost;
    }
  }
  const live =
    (dropHost.querySelector('[role="status"][aria-live="assertive"]') as HTMLElement | null) ||
    (document.getElementById('DndLiveRegion-0') as HTMLElement | null);
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
    const dt = new DataTransfer();
    dt.items.add(f);
    try {
      (dt as DataTransfer).dropEffect = 'copy';
    } catch {
      // ignore
    }
    imgLog('info', 'step:dnd:dispatch', {
      name: f.name,
      type: f.type,
      size: f.size,
      beforeCount,
      beforeLive,
    });

    const dragEnter = new DragEvent('dragenter', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      dataTransfer: dt,
    } as DragEventInit);
    const dragOver = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      clientX: clientX + Math.floor(Math.random() * 6 - 3),
      clientY: clientY + Math.floor(Math.random() * 6 - 3),
      dataTransfer: dt,
    } as DragEventInit);
    const drop = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      dataTransfer: dt,
    } as DragEventInit);

    target.dispatchEvent(dragEnter);
    await jitter(15, 60);
    // quelques dragover successifs pour mimer un mouvement
    for (let k = 0; k < 2; k++) {
      target.dispatchEvent(dragOver);
      await jitter(10, 40);
    }
    target.dispatchEvent(drop);
    // dragleave pour clore proprement la séquence DnD
    const dragLeave = new DragEvent('dragleave', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      dataTransfer: dt,
    } as DragEventInit);
    target.dispatchEvent(dragLeave);
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
        const dtAll = new DataTransfer();
        for (const f of files) dtAll.items.add(f);
        Object.defineProperty(input, 'files', { value: dtAll.files });
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        imgLog('info', 'fallback:input-after-dnd:dispatched', { count: files.length });
      } else {
        imgLog('warn', 'fallback:input-after-dnd:not-found');
      }
    } catch (e) {
      imgLog('warn', 'fallback:input-after-dnd:error', { err: (e as Error)?.message });
    }
  }
}

async function waitForMediaFeedback(
  grid: HTMLElement | null,
  live: HTMLElement | null,
  beforeCount: number,
  beforeLiveText: string,
  timeoutMs = 3000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (grid && grid.childElementCount > beforeCount) {
      imgLog('info', 'grid increment detected', {
        beforeCount,
        afterCount: grid.childElementCount,
      });
      return true;
    }
    if (live) {
      const cur = live.textContent ?? '';
      if (cur && cur !== beforeLiveText) {
        imgLog('info', 'live region changed', { before: beforeLiveText, after: cur });
        return true;
      }
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  return false;
}

// Convertit WEBP/AVIF en JPEG pour compatibilité, garde JPEG/PNG tels quels.
// Si le type est inconnu, on sniffe la signature binaire pour décider.
// En cas d’échec de conversion, on renvoie un File basé sur le blob original.
async function ensureUploadableImage(blob: Blob, baseName: string): Promise<File | null> {
  let type = (blob.type || '').toLowerCase();
  imgLog('info', 'ensure:start', { baseName, type, size: blob.size });
  const acceptable = ['image/jpeg', 'image/jpg', 'image/png'];
  const asFile = (b: Blob, name: string, t: string) => new File([b], name, { type: t });

  // Sniff si type absent ou générique
  if (!type || type === 'application/octet-stream') {
    const sniffed = await sniffImageType(blob).catch(
      (e) => (imgLog('info', 'ensure:sniff:error', e as unknown), null),
    );
    if (sniffed) type = sniffed;
    imgLog('info', 'ensure:sniffed', { baseName, type });
  }

  if (acceptable.includes(type)) {
    const name = ensureExtension(baseName, type.includes('png') ? '.png' : '.jpg');
    imgLog('debug', 'no conversion needed', { baseName, type, outName: name });
    return asFile(blob, name, type.includes('png') ? 'image/png' : 'image/jpeg');
  }

  // Ne tenter la conversion que pour les formats image connus non acceptés (webp/avif)
  const needsConversion = type === 'image/webp' || type === 'image/avif';
  if (!needsConversion) {
    const ext = type.includes('png')
      ? '.png'
      : type.includes('jpeg') || type.includes('jpg')
        ? '.jpg'
        : type.includes('webp')
          ? '.webp'
          : type.includes('avif')
            ? '.avif'
            : '.img';
    const name = ensureExtension(baseName, ext);
    imgLog('info', 'keeping original blob (no conversion attempted)', { baseName, type, name });
    const file = asFile(blob, name, type || 'application/octet-stream');
    imgLog('info', 'ensure:result:original', { name: file.name, type: file.type, size: file.size });
    return file;
  }

  // Tenter conversion pour WEBP/AVIF
  // 1) WebCodecs d'abord (si disponible)
  const wc1 = await tryWebCodecsTranscodeToJpeg(blob, baseName, type).catch((e) => {
    imgLog('debug', 'webcodecs attempt failed', { baseName, type, err: (e as Error)?.message });
    return null;
  });
  if (wc1) return wc1;

  // 2) Canvas (createImageBitmap -> HTMLImageElement)
  try {
    let width = 0;
    let height = 0;
    let drawToCanvas: (ctx: CanvasRenderingContext2D) => void;

    try {
      const bmp = await createImageBitmap(blob);
      width = bmp.width;
      height = bmp.height;
      drawToCanvas = (ctx) => ctx.drawImage(bmp, 0, 0);
      imgLog('info', 'convert:bitmap:ok', { w: width, h: height });
    } catch (e1) {
      imgLog('debug', 'createImageBitmap failed, fallback to Image()', {
        baseName,
        err: (e1 as Error)?.message,
      });
      const url = URL.createObjectURL(blob);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = () => reject(new Error('HTMLImage decode failed'));
          try {
            (im as HTMLImageElement).crossOrigin = 'anonymous';
          } catch {
            /* ignore */
          }
          im.src = url;
        });
        width = img.naturalWidth || img.width;
        height = img.naturalHeight || img.height;
        drawToCanvas = (ctx) => ctx.drawImage(img, 0, 0);
        imgLog('info', 'convert:image:ok', { w: width, h: height });
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    if (!width || !height) throw new Error('no image dimensions');

    let outBlob: Blob | null = null;
    if ('OffscreenCanvas' in globalThis) {
      interface OffscreenLike {
        getContext(type: '2d'): OffscreenCanvasRenderingContext2D | null;
        convertToBlob(opts: { type: string; quality?: number }): Promise<Blob>;
        width: number;
        height: number;
      }
      const Ctor = (
        globalThis as unknown as { OffscreenCanvas: new (w: number, h: number) => OffscreenLike }
      ).OffscreenCanvas;
      const canvas = new Ctor(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      drawToCanvas(ctx as unknown as CanvasRenderingContext2D);
      outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
      imgLog('info', 'convert:offscreencanvas:toBlob:ok', { size: outBlob.size });
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      drawToCanvas(ctx);
      outBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
      );
    }
    if (!outBlob) throw new Error('toBlob returned null');
    const name = ensureExtension(baseName, '.jpg');
    imgLog('info', 'converted image to jpeg', { baseName, outName: name, size: outBlob.size });
    return new File([outBlob], name, { type: 'image/jpeg' });
  } catch (err) {
    imgLog('debug', 'canvas conversion error', { baseName, type, err: (err as Error)?.message });
  }

  // 3) Dernière chance: forcer un JPEG simple (sans décodage)
  try {
    const arr = await blob.arrayBuffer();
    const name = ensureExtension(baseName, '.jpg');
    const forced = new File([new Uint8Array(arr)], name, { type: 'image/jpeg' });
    imgLog('info', 'forced jpeg as ultimate fallback', {
      name: forced.name,
      type: forced.type,
      size: forced.size,
    });
    return forced;
  } catch {
    const ext = type.includes('webp') ? '.webp' : type.includes('avif') ? '.avif' : '.img';
    const name = ensureExtension(baseName, ext);
    imgLog('warn', 'image conversion failed completely; using original blob', {
      baseName,
      type,
      outName: name,
    });
    return asFile(blob, name, type || 'application/octet-stream');
  }
}

// Fallback WebCodecs: transcodage WebP/AVIF -> JPEG sans dépendance externe
async function tryWebCodecsTranscodeToJpeg(
  blob: Blob,
  baseName: string,
  type: string,
): Promise<File | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AnyGlobal: any = globalThis as any;
    if (typeof AnyGlobal.ImageDecoder !== 'function') return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const decoder = new AnyGlobal.ImageDecoder({ data: bytes, type });
    const frame = await decoder.decode({ frameIndex: 0 });
    const w = frame.image.displayWidth || frame.image.codedWidth;
    const h = frame.image.displayHeight || frame.image.codedHeight;
    let outBlob: Blob | null = null;
    if ('OffscreenCanvas' in AnyGlobal) {
      const Offs = AnyGlobal.OffscreenCanvas as new (w: number, h: number) => OffscreenCanvas;
      const canvas = new Offs(w, h);
      const ctx = canvas.getContext('2d') as unknown as OffscreenCanvasRenderingContext2D | null;
      if (!ctx) return null;
      (ctx as unknown as CanvasRenderingContext2D).drawImage(frame.image, 0, 0);
      frame.image.close?.();
      outBlob = await (
        canvas as unknown as {
          convertToBlob: (opts: { type: string; quality?: number }) => Promise<Blob>;
        }
      ).convertToBlob({ type: 'image/jpeg', quality: 0.92 });
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      (ctx as CanvasRenderingContext2D).drawImage(frame.image, 0, 0);
      frame.image.close?.();
      outBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
      );
    }
    if (!outBlob) return null;
    const name = ensureExtension(baseName, '.jpg');
    return new File([outBlob], name, { type: 'image/jpeg' });
  } catch {
    return null;
  }
}

// Lecture des premières octets pour identifier le format (PNG, JPEG, WEBP, AVIF)
async function sniffImageType(blob: Blob): Promise<string | null> {
  try {
    const header = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47 &&
      header[4] === 0x0d &&
      header[5] === 0x0a &&
      header[6] === 0x1a &&
      header[7] === 0x0a
    )
      return 'image/png';
    // JPEG: FF D8 FF
    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'image/jpeg';
    // WEBP: RIFF....WEBP
    if (
      header[0] === 0x52 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x46 &&
      header[8] === 0x57 &&
      header[9] === 0x45 &&
      header[10] === 0x42 &&
      header[11] === 0x50
    )
      return 'image/webp';
    // AVIF: ftyp....avif / mif1 brands
    if (header.length >= 12) {
      const isFtyp =
        header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70;
      if (isFtyp) {
        const brand = String.fromCharCode(
          header[8] as number,
          header[9] as number,
          header[10] as number,
          header[11] as number,
        );
        if (brand.startsWith('avif') || brand === 'mif1') return 'image/avif';
      }
    }
    return null;
  } catch {
    return null;
  }
}

function ensureExtension(name: string, ext: string): string {
  const clean = name.replace(/\?.*$/, '').replace(/#.*$/, '');
  if (clean.toLowerCase().endsWith(ext)) return clean;
  // retire l’ancienne extension si elle n’est pas utile
  const without = clean.replace(/\.[a-z0-9]+$/i, '');
  return `${without}${ext}`;
}

function inferNameFromUrl(u: string): string | null {
  try {
    const p = new URL(u);
    const last = p.pathname.split('/').filter(Boolean).pop() || '';
    return last || null;
  } catch {
    try {
      const m = u.split('/').filter(Boolean).pop() || '';
      return m || null;
    } catch {
      return null;
    }
  }
}

function imgLog(level: 'info' | 'warn' | 'debug', ...args: unknown[]) {
  // logs désactivés
  void level;
  void args;
}

function jitter(minMs: number, maxMs: number): Promise<void> {
  const range = Math.max(0, maxMs - minMs);
  const ms = minMs + Math.floor(Math.random() * (range + 1));
  return new Promise((r) => setTimeout(r, ms));
}

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

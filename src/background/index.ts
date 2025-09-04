import browser from 'webextension-polyfill';

import { onMessage } from '../lib/messaging';
import {
  ContentReady,
  ImageFetch,
  ImageFetchResult,
  Ping,
  RepublishCreate,
  RepublishInjected,
} from '../types/messages';

browser.runtime.onInstalled.addListener(() => {
  /* logs désactivés */
});

onMessage(async (msg) => {
  if (Ping.safeParse(msg).success) {
    return { type: 'pong' } as const;
  }
  if (ContentReady.safeParse(msg).success) {
    // Example: react to content script readiness
  const parsed = ContentReady.parse(msg);
  void parsed;
  }
  if (RepublishCreate.safeParse(msg).success) {
    const { payload } = RepublishCreate.parse(msg);
    // Ouvrir le formulaire de création d’annonce de Vinted
    await browser.tabs.create({ url: payload.targetUrl, active: true });
  }
  if (RepublishInjected.safeParse(msg).success) {
  const { payload } = RepublishInjected.parse(msg);
  void payload;
  }
  if (ImageFetch.safeParse(msg).success) {
    const { url } = ImageFetch.parse(msg);
    try {
      const res = await fetch(url, { method: 'HEAD' });
      const ok = res.ok;
      const contentType = res.headers.get('content-type') || undefined;
      const out: typeof ImageFetchResult._type = { ok, contentType };
      return out;
    } catch {
      const out: typeof ImageFetchResult._type = { ok: false };
      return out;
    }
  }
  // Full download for image, returned as ArrayBuffer (binary)
  if ('type' in msg && msg.type === 'image:download') {
    const url = (msg as { url: string }).url;
    try {
  // logs désactivés
      const res = await fetch(url, {
        method: 'GET',
        // éviter des réponses vides liées au cache intermédiaire
        cache: 'no-store',
        // Référent/Origin explicites pour contourner certaines règles CDN
        // Note: referrerPolicy "no-referrer-when-downgrade" est le défaut; on force une valeur sûre
        referrer: 'https://www.vinted.fr/',
        referrerPolicy: 'strict-origin-when-cross-origin',
        headers: {
          Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
        },
      });
      if (!res.ok) return { ok: false, url } as const;
      const contentType = res.headers.get('content-type') || undefined;
      const buf = await res.arrayBuffer();
      const name = new URL(url).pathname.split('/').pop() || 'image';
  // logs désactivés
      if (!buf || buf.byteLength === 0) {
        // logs désactivés
        return { ok: false, url, contentType, name } as const;
      }
      // Provide a base64 fallback in case ArrayBuffer transfer is dropped by the messaging layer
      let bytesB64: string | undefined;
      try {
        bytesB64 = toBase64(buf);
      } catch {
        bytesB64 = undefined;
      }
      return { ok: true, url, contentType, name, bytes: buf, bytesB64 } as const;
    } catch (e) {
      // logs désactivés
      return { ok: false, url } as const;
    }
  }
  // Convert image blob (ArrayBuffer) to JPEG in a worker-like safe context
  if ('type' in msg && msg.type === 'image:convert-jpeg') {
    const { name, bytes, contentType } = msg as {
      type: 'image:convert-jpeg';
      name: string;
      bytes: ArrayBuffer;
      contentType?: string;
    };
    try {
      const blob = new Blob([new Uint8Array(bytes)], {
        type: contentType || 'application/octet-stream',
      });
      const out = await convertToJpeg(blob, name);
      if (!out) return { ok: false } as const;
      const arr = await out.blob.arrayBuffer();
      return {
        ok: true,
        name: out.name,
        type: out.blob.type,
        bytes: arr,
      } as const;
    } catch {
      return { ok: false } as const;
    }
  }
  return undefined;
});

async function convertToJpeg(
  src: Blob,
  baseName: string,
): Promise<{ name: string; blob: Blob } | null> {
  // Prefer OffscreenCanvas in service worker
  try {
    // Try WebCodecs ImageDecoder first (supports AVIF/WEBP in modern Chromium)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AnyGlobal: any = globalThis as any;
    const type = (src.type || 'application/octet-stream').toLowerCase();
    if (typeof AnyGlobal.ImageDecoder === 'function') {
      try {
        const bytes = new Uint8Array(await src.arrayBuffer());
        const decoder = new AnyGlobal.ImageDecoder({ data: bytes, type });
        const frame = await decoder.decode({ frameIndex: 0 });
        const width = frame.image.displayWidth || frame.image.codedWidth;
        const height = frame.image.displayHeight || frame.image.codedHeight;
        if ('OffscreenCanvas' in AnyGlobal) {
          const Offs = AnyGlobal.OffscreenCanvas as new (w: number, h: number) => OffscreenCanvas;
          const canvas = new Offs(width, height);
          // drawImage accepts VideoFrame (frame.image) in Chrome
          const ctx = canvas.getContext(
            '2d',
          ) as unknown as OffscreenCanvasRenderingContext2D | null;
          if (!ctx) return null;
          (ctx as unknown as CanvasRenderingContext2D).drawImage(frame.image, 0, 0);
          frame.image.close?.();
          const outBlob = await (
            canvas as unknown as {
              convertToBlob: (opts: { type: string; quality?: number }) => Promise<Blob>;
            }
          ).convertToBlob({ type: 'image/jpeg', quality: 0.92 });
          return { name: ensureExt(baseName, '.jpg'), blob: outBlob };
        }
      } catch {
        // fall through to createImageBitmap path
      }
    }
    // createImageBitmap may be available depending on MV3 environment; try it first
    let bmp: ImageBitmap | null = null;
    try {
      // createImageBitmap may or may not exist in SW
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      bmp = await createImageBitmap(src);
    } catch {
      bmp = null;
    }
    if (bmp) {
      if ('OffscreenCanvas' in globalThis) {
        const Ctor = (
          globalThis as unknown as {
            OffscreenCanvas: new (w: number, h: number) => OffscreenCanvas;
          }
        ).OffscreenCanvas;
        const canvas = new Ctor(bmp.width, bmp.height);
        const ctx = canvas.getContext('2d') as unknown as OffscreenCanvasRenderingContext2D | null;
        if (!ctx) return null;
        (ctx as unknown as CanvasRenderingContext2D).drawImage(bmp, 0, 0);
        const outBlob = await (
          canvas as unknown as {
            convertToBlob: (opts: { type: string; quality?: number }) => Promise<Blob>;
          }
        ).convertToBlob({ type: 'image/jpeg', quality: 0.92 });
        return { name: ensureExt(baseName, '.jpg'), blob: outBlob };
      }
    }
  } catch {
    // fall through
  }
  // Fallback: if we cannot convert, just return original blob as-is
  try {
    const forced = new Blob([new Uint8Array(await src.arrayBuffer())], { type: 'image/jpeg' });
    return { name: ensureExt(baseName, '.jpg'), blob: forced };
  } catch {
    return { name: baseName, blob: src };
  }
}

function ensureExt(name: string, ext: string): string {
  const clean = name.replace(/\?.*$/, '').replace(/#.*$/, '');
  if (clean.toLowerCase().endsWith(ext)) return clean;
  const without = clean.replace(/\.[a-z0-9]+$/i, '');
  return `${without}${ext}`;
}

function toBase64(buf: ArrayBuffer): string {
  try {
    // Convert ArrayBuffer -> binary string -> base64
    let binary = '';
    const bytes = new Uint8Array(buf);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i] as number);
    // btoa available in SW
    // eslint-disable-next-line no-undef
    return btoa(binary);
  } catch {
    return '';
  }
}

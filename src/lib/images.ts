// Utilitaires d'images: détections de type, conversion et normalisation pour upload

function ensureExtension(name: string, ext: string): string {
  const clean = name.replace(/\?.*$/, '').replace(/#.*$/, '');
  if (clean.toLowerCase().endsWith(ext)) return clean;
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

async function ensureUploadableImage(blob: Blob, baseName: string): Promise<File | null> {
  let type = (blob.type || '').toLowerCase();
  const acceptable = ['image/jpeg', 'image/jpg', 'image/png'];
  const asFile = (b: Blob, name: string, t: string) => new File([b], name, { type: t });

  // Sniff si type absent ou générique
  if (!type || type === 'application/octet-stream') {
    const sniffed = await sniffImageType(blob).catch(() => null);
    if (sniffed) type = sniffed;
  }

  if (acceptable.includes(type)) {
    const name = ensureExtension(baseName, type.includes('png') ? '.png' : '.jpg');
    return asFile(blob, name, type.includes('png') ? 'image/png' : 'image/jpeg');
  }

  // Conversion que pour WEBP/AVIF
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
    return asFile(blob, name, type || 'application/octet-stream');
  }

  // 1) WebCodecs
  const wc1 = await tryWebCodecsTranscodeToJpeg(blob, baseName, type).catch(() => null);
  if (wc1) return wc1;

  // 2) Canvas
  try {
    let width = 0;
    let height = 0;
    let drawToCanvas: (ctx: CanvasRenderingContext2D) => void;

    try {
      const bmp = await createImageBitmap(blob);
      width = bmp.width;
      height = bmp.height;
      drawToCanvas = (ctx) => ctx.drawImage(bmp, 0, 0);
    } catch {
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
    return new File([outBlob], name, { type: 'image/jpeg' });
  } catch {
    // 3) Forced JPEG bytes
    try {
      const arr = await blob.arrayBuffer();
      const name = ensureExtension(baseName, '.jpg');
      return new File([new Uint8Array(arr)], name, { type: 'image/jpeg' });
    } catch {
      const ext = type.includes('webp') ? '.webp' : type.includes('avif') ? '.avif' : '.img';
      const name = ensureExtension(baseName, ext);
      return asFile(blob, name, type || 'application/octet-stream');
    }
  }
}

export {
  ensureExtension,
  ensureUploadableImage,
  inferNameFromUrl,
  sniffImageType,
  tryWebCodecsTranscodeToJpeg,
};

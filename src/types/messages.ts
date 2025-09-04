import { z } from 'zod';

export const ContentReady = z.object({
  type: z.literal('content:ready'),
  payload: z.object({ url: z.string().url() }),
});

export const Ping = z.object({ type: z.literal('ping') });
export const Pong = z.object({ type: z.literal('pong') });

// Draft pour republication (champs minimaux et sûrs à pré-remplir)
export const RepublishDraft = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  // Astuce: on ne re‑uploade pas d’images côté extension
});
export type RepublishDraft = z.infer<typeof RepublishDraft>;

export const RepublishCreate = z.object({
  type: z.literal('republish:create'),
  payload: z.object({ targetUrl: z.string().url() }),
});
export type RepublishCreate = z.infer<typeof RepublishCreate>;

export const RepublishInjected = z.object({
  type: z.literal('republish:injected'),
  payload: z.object({ where: z.enum(['actions', 'fallback']), url: z.string().url() }),
});
export type RepublishInjected = z.infer<typeof RepublishInjected>;

export const AnyMessage = z.union([ContentReady, Ping, Pong, RepublishCreate, RepublishInjected]);
export type AnyMessage = z.infer<typeof AnyMessage>;

export type ContentReady = z.infer<typeof ContentReady>;
export type Ping = z.infer<typeof Ping>;
export type Pong = z.infer<typeof Pong>;

// Background fetch for images (to bypass CORS in content context)
export const ImageFetch = z.object({ type: z.literal('image:fetch'), url: z.string().url() });
export type ImageFetch = z.infer<typeof ImageFetch>;
export const ImageFetchResult = z.object({ ok: z.boolean(), contentType: z.string().optional() });
export type ImageFetchResult = z.infer<typeof ImageFetchResult>;

// Full image download (blob as bytes)
export const ImageDownload = z.object({ type: z.literal('image:download'), url: z.string().url() });
export type ImageDownload = z.infer<typeof ImageDownload>;
export const ImageDownloadResult = z.object({
  ok: z.boolean(),
  url: z.string().url(),
  contentType: z.string().optional(),
  name: z.string().optional(),
  bytes: z.instanceof(ArrayBuffer).optional(),
  // fallback when ArrayBuffer cannot be transferred across MV3 messaging
  bytesB64: z.string().optional(),
});
export type ImageDownloadResult = z.infer<typeof ImageDownloadResult>;

// Image conversion to JPEG (done in background)
export const ImageConvertJpeg = z.object({
  type: z.literal('image:convert-jpeg'),
  name: z.string(),
  contentType: z.string().optional(),
  bytes: z.instanceof(ArrayBuffer),
});
export type ImageConvertJpeg = z.infer<typeof ImageConvertJpeg>;
export const ImageConvertJpegResult = z.object({
  ok: z.boolean(),
  name: z.string().optional(),
  type: z.string().optional(),
  bytes: z.instanceof(ArrayBuffer).optional(),
});
export type ImageConvertJpegResult = z.infer<typeof ImageConvertJpegResult>;

// Extend the union
export const AnyMessageExtended = z.union([
  ContentReady,
  Ping,
  Pong,
  RepublishCreate,
  RepublishInjected,
  ImageFetch,
  ImageDownload,
  ImageConvertJpeg,
]);
export type AnyMessageExtended = z.infer<typeof AnyMessageExtended>;

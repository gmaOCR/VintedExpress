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

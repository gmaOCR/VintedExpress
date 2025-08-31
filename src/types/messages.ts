import { z } from 'zod';

export const ContentReady = z.object({
  type: z.literal('content:ready'),
  payload: z.object({ url: z.string().url() }),
});

export const Ping = z.object({ type: z.literal('ping') });
export const Pong = z.object({ type: z.literal('pong') });

export const AnyMessage = z.union([ContentReady, Ping, Pong]);
export type AnyMessage = z.infer<typeof AnyMessage>;

export type ContentReady = z.infer<typeof ContentReady>;
export type Ping = z.infer<typeof Ping>;
export type Pong = z.infer<typeof Pong>;

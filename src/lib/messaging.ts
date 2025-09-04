import browser from 'webextension-polyfill';
import { z } from 'zod';

import { AnyMessageExtended } from '../types/messages';

export type MessageHandler = (
  msg: AnyMessageExtended,
  sender: browser.Runtime.MessageSender,
) => Promise<unknown> | unknown;

export function onMessage(handler: MessageHandler) {
  browser.runtime.onMessage.addListener(
    (message: unknown, sender: browser.Runtime.MessageSender) => {
      const result = AnyMessageExtended.safeParse(message);
      if (!result.success) {
        // Ignore messages not matching our schema
        return;
      }
      const parsed = result.data;
      const value = handler(parsed, sender);
      return value instanceof Promise ? value : Promise.resolve(value);
    },
  );
}

export async function sendMessage<T extends z.ZodTypeAny>(schema: T, message: z.infer<T>) {
  // Validate before sending to keep contracts clear in dev
  const result = schema.safeParse(message);
  if (!result.success) {
    throw new Error('Invalid message payload');
  }
  try {
    return await browser.runtime.sendMessage(result.data);
  } catch (err) {
    const msg = (err as Error)?.message || '';
    // Avoid noisy errors when the extension context gets reloaded/navigated
    if (/Extension context invalidated/i.test(msg)) {
      return;
    }
    throw err;
  }
}

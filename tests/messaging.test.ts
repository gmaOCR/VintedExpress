import { describe, expect, it, vi } from 'vitest';
import browser from 'webextension-polyfill';

import { onMessage, sendMessage } from '../src/lib/messaging';
import type { AnyMessageExtended } from '../src/types/messages';
import { ContentReady } from '../src/types/messages';

vi.mock('webextension-polyfill', () => {
  type Listener = (msg: unknown, sender: unknown) => unknown | Promise<unknown>;
  const listeners: Listener[] = [];
  return {
    default: {
      runtime: {
        onMessage: {
          addListener: (cb: Listener) => listeners.push(cb),
          // helper for test to trigger messages
          __emit: async (msg: unknown) => {
            for (const cb of listeners) await cb(msg, {});
          },
        },
        sendMessage: vi.fn(async (m) => m),
      },
    },
  };
});

describe('messaging', () => {
  it('onMessage filters and passes only schema-valid messages', async () => {
    const handler = vi.fn();
    onMessage(handler);

    // invalid message ignored
    await (
      browser.runtime.onMessage as unknown as { __emit: (m: unknown) => Promise<void> }
    ).__emit({ type: 'nope' });
    expect(handler).not.toHaveBeenCalled();

    // valid message goes through
    await (
      browser.runtime.onMessage as unknown as { __emit: (m: AnyMessageExtended) => Promise<void> }
    ).__emit({
      type: 'content:ready',
      payload: { url: 'https://x.test' },
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('sendMessage validates schema and calls browser.runtime.sendMessage', async () => {
    const res = await sendMessage(ContentReady, {
      type: 'content:ready',
      payload: { url: 'https://ok' },
    });
    expect(res).toEqual({ type: 'content:ready', payload: { url: 'https://ok' } });
  });
});

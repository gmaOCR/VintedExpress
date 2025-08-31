import { describe, expect, it } from 'vitest';

import { AnyMessage, ContentReady, Ping } from '../src/types/messages';

describe('messages schema', () => {
  it('validates ping', () => {
    const res = Ping.safeParse({ type: 'ping' });
    expect(res.success).toBe(true);
  });

  it('validates content:ready with URL', () => {
    const res = ContentReady.safeParse({
      type: 'content:ready',
      payload: { url: 'https://example.com' },
    });
    expect(res.success).toBe(true);
  });

  it('rejects invalid message', () => {
    const res = AnyMessage.safeParse({ type: 'unknown' });
    expect(res.success).toBe(false);
  });
});

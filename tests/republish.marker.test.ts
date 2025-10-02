// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Tests for the republish source marker behavior in the new-listing content script.
describe('republish marker behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = `<input name="title" />`;
    // Clean any globals
    // @ts-ignore
    delete (globalThis as any).chrome;
    // @ts-ignore
    delete (globalThis as any).browser;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('does not fill when marker is absent', async () => {
    // legacy chrome.storage.get callback used by the script
    // @ts-ignore
    globalThis.chrome = {
      storage: { local: { get: (k: unknown, cb: (i: Record<string, unknown>) => void) => cb({}) } },
    };
    // Mock the module that the content script imports so `browser` returns no marker
    vi.doMock('webextension-polyfill', () => ({
      default: {
        storage: {
          local: { get: vi.fn(async (k: string) => ({})), remove: vi.fn(async () => ({})) },
        },
      },
    }));

    const fillerMock = { fillNewItemForm: vi.fn(async () => {}) };
    vi.doMock('../src/lib/filler', () => fillerMock);

    await import('../src/content/new-listing');
    await new Promise((r) => setTimeout(r, 20));

    expect(fillerMock.fillNewItemForm).not.toHaveBeenCalled();
  });

  it('fills when marker is present', async () => {
    // chrome callback returns a draft object (could be empty but present)
    // @ts-ignore
    globalThis.chrome = {
      storage: {
        local: {
          get: (k: unknown, cb: (i: Record<string, unknown>) => void) =>
            cb({ ['vx:republishDraft']: {} }),
        },
      },
    };

    // Mock the module that the content script imports so `browser` returns the marker
    vi.doMock('webextension-polyfill', () => ({
      default: {
        storage: {
          local: {
            get: vi.fn(async (key: string) => ({ [key]: { source: 'republish-button' } })),
            remove: vi.fn(async (key: string) => ({})),
          },
        },
      },
    }));

    const fillerMock = { fillNewItemForm: vi.fn(async () => {}) };
    vi.doMock('../src/lib/filler', () => fillerMock);

    await import('../src/content/new-listing');
    await new Promise((r) => setTimeout(r, 20));

    expect(fillerMock.fillNewItemForm).toHaveBeenCalled();
  });
});

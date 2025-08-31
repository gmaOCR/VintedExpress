import browser from 'webextension-polyfill';

import { onMessage } from '../lib/messaging';
import { ContentReady, Ping } from '../types/messages';

browser.runtime.onInstalled.addListener(() => {
  console.warn('Vinted Express installed');
});

onMessage(async (msg) => {
  if (Ping.safeParse(msg).success) {
    return { type: 'pong' } as const;
  }
  if (ContentReady.safeParse(msg).success) {
    // Example: react to content script readiness
    const parsed = ContentReady.parse(msg);
    console.warn('Content ready on', parsed.payload.url);
  }
  return undefined;
});

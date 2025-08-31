import browser from 'webextension-polyfill';

import { onMessage } from '../lib/messaging';
import { ContentReady, Ping, RepublishCreate, RepublishInjected } from '../types/messages';

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
  if (RepublishCreate.safeParse(msg).success) {
    const { payload } = RepublishCreate.parse(msg);
    // Ouvrir le formulaire de création d’annonce de Vinted
    await browser.tabs.create({ url: payload.targetUrl, active: true });
  }
  if (RepublishInjected.safeParse(msg).success) {
    const { payload } = RepublishInjected.parse(msg);
    console.warn('VX injected:', payload.where, 'on', payload.url);
  }
  return undefined;
});

import { sendMessage } from '../lib/messaging';
import { ContentReady } from '../types/messages';

declare global {
  interface Window {
    __vintedExpressInjected?: boolean;
  }
}

(function main() {
  // Minimal guard to avoid multiple injections
  if (window.__vintedExpressInjected) return;
  window.__vintedExpressInjected = true;

  // Notify background we're ready
  void sendMessage(ContentReady, { type: 'content:ready', payload: { url: location.href } });

  // Example DOM access kept minimal and safe
  // Add a data attribute to body for quick visual check in dev
  try {
    document.body.setAttribute('data-vx', 'ready');
  } catch {
    // ignore
  }
})();

import browser from 'webextension-polyfill';

import { sendMessage } from '../lib/messaging';
import { Ping } from '../types/messages';

const versionEl = document.getElementById('version');
const btn = document.getElementById('ping');

(async () => {
  const manifest = browser.runtime.getManifest();
  if (versionEl) versionEl.textContent = `Version ${manifest.version}`;
})();

btn?.addEventListener('click', async () => {
  try {
    const res = await sendMessage(Ping, { type: 'ping' });
  void res;
  } catch (e) {
  // logs désactivés
  }
});

import { z } from 'zod';

import { getTyped, setTyped } from '../lib/storage';

const KEY = 'samplePref';
const Schema = z.string().min(0);

const input = document.getElementById('sample') as HTMLInputElement | null;

(async () => {
  const current = await getTyped(KEY, Schema);
  if (input && current !== undefined) input.value = current;
})();

input?.addEventListener('change', async () => {
  if (!input) return;
  await setTyped(KEY, input.value, Schema);
});

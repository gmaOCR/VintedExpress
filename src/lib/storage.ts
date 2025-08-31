import browser from 'webextension-polyfill';
import { z } from 'zod';

export async function getTyped<T extends z.ZodTypeAny>(
  key: string,
  schema: T,
): Promise<z.infer<T> | undefined> {
  const result = await browser.storage.local.get(key);
  const value = result[key];
  if (value === undefined) return undefined;
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid data in storage for key ${key}`);
  return parsed.data;
}

export async function setTyped<T extends z.ZodTypeAny>(
  key: string,
  value: z.infer<T>,
  schema: T,
): Promise<void> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid value for key ${key}`);
  await browser.storage.local.set({ [key]: parsed.data });
}

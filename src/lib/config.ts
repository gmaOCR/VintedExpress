// Configuration centralisée (timeouts et intervals). Peut être surchargée via localStorage.

export type TimeoutKey =
  | 'wait.element'
  | 'wait.dropdown.content'
  | 'wait.dropdown.search'
  | 'wait.dropdown.titlesChange'
  | 'wait.dropdown.commit'
  | 'wait.media.feedback';

const DEFAULTS: Record<TimeoutKey, number> = {
  'wait.element': 6000,
  'wait.dropdown.content': 3000,
  'wait.dropdown.search': 800,
  'wait.dropdown.titlesChange': 500,
  'wait.dropdown.commit': 3000,
  'wait.media.feedback': 6000,
};

export function getTimeout(key: TimeoutKey): number {
  try {
    const raw = localStorage.getItem(`vx:to:${key}`);
    const n = raw ? Number(raw) : NaN;
    if (!Number.isNaN(n) && n > 0) return n;
  } catch {
    // ignore
  }
  return DEFAULTS[key];
}

export function getIntervalMs(min: number, max: number): number {
  const range = Math.max(0, max - min);
  return min + Math.floor(Math.random() * (range + 1));
}

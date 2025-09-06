export function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function click(el: Element | null | undefined) {
  if (!el) return;
  (el as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

export function blurInput(el: HTMLInputElement | HTMLTextAreaElement | null | undefined) {
  try {
    el?.blur();
  } catch {
    /* ignore */
  }
}

export async function waitForElement<T extends Element>(
  selector: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<T | null> {
  const { timeoutMs = 3000, intervalMs = 60 } = options ?? {};
  const start = Date.now();
  let el = document.querySelector<T>(selector);
  if (el) return el;
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    el = document.querySelector<T>(selector);
    if (el) return el;
  }
  return null;
}

export function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function waitForGone(selector: string, timeoutMs = 800): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const node = document.querySelector(selector) as HTMLElement | null;
    if (!node) return true;
    const st = node ? window.getComputedStyle(node) : null;
    if (st && (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0')) {
      return true;
    }
    await delay(40);
  }
  const node = document.querySelector(selector) as HTMLElement | null;
  if (!node) return true;
  const st = node ? window.getComputedStyle(node) : null;
  return (
    !node || !!(st && (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0'))
  );
}

export async function clickInTheVoid(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tmp = document.createElement('div');
      tmp.style.position = 'fixed';
      tmp.style.left = '0';
      tmp.style.top = '0';
      tmp.style.width = '1px';
      tmp.style.height = '1px';
      tmp.style.opacity = '0';
      tmp.style.pointerEvents = 'auto';
      tmp.style.zIndex = '2147483647';
      document.body.appendChild(tmp);
      tmp.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 }));
      document.body.click();
      requestAnimationFrame(() => {
        try {
          tmp.remove();
        } catch {
          /* ignore */
        }
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function invariant(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    throw new Error(msg);
  }
}

let cachedInputEventCtor: typeof InputEvent | null = null;
let hasCachedInputEventCtor = false;

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = Object.getPrototypeOf(el);
  const desc = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : undefined;
  if (desc?.set) {
    desc.set.call(el, value);
  } else {
    el.value = value;
  }
}

function computeInputEventCtor(): typeof InputEvent {
  let InputEventCtor: typeof InputEvent | undefined;
  if (
    typeof window !== 'undefined' &&
    typeof (window as typeof window & { InputEvent?: typeof InputEvent }).InputEvent === 'function'
  ) {
    InputEventCtor = (window as typeof window & { InputEvent?: typeof InputEvent }).InputEvent;
  } else if (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as typeof globalThis & { InputEvent?: typeof InputEvent }).InputEvent ===
      'function'
  ) {
    InputEventCtor = (globalThis as typeof globalThis & { InputEvent?: typeof InputEvent })
      .InputEvent;
  }

  let needsPolyfill = true;
  if (InputEventCtor) {
    try {
      if (typeof document === 'undefined') {
        needsPolyfill = false;
      } else {
        const probeEl = document.createElement('input');
        let fired = false;
        probeEl.addEventListener('input', () => {
          fired = true;
        });
        const probeEvent = new InputEventCtor('input', {
          bubbles: true,
          data: '',
          inputType: 'insertText',
        });
        probeEl.dispatchEvent(probeEvent);
        needsPolyfill = !(fired && probeEvent instanceof InputEventCtor);
      }
    } catch {
      needsPolyfill = true;
    }
  }

  if (!InputEventCtor || needsPolyfill) {
    class InputEventPolyfill extends Event {
      data: string | null;
      inputType: string;
      constructor(type: string, params?: InputEventInit) {
        super(type, params);
        this.data = params?.data ?? null;
        this.inputType = params?.inputType ?? 'insertText';
      }
    }
    InputEventCtor = InputEventPolyfill as unknown as typeof InputEvent;
    if (typeof globalThis !== 'undefined') {
      (globalThis as typeof globalThis & { InputEvent?: typeof InputEvent }).InputEvent =
        InputEventCtor;
    }
    if (typeof window !== 'undefined') {
      (window as typeof window & { InputEvent?: typeof InputEvent }).InputEvent = InputEventCtor;
    }
  }

  return InputEventCtor;
}

function getInputEventCtor(): typeof InputEvent {
  if (!hasCachedInputEventCtor || !cachedInputEventCtor) {
    cachedInputEventCtor = computeInputEventCtor();
    hasCachedInputEventCtor = true;
  }
  return cachedInputEventCtor;
}

function dispatchInputEvent(
  el: HTMLInputElement | HTMLTextAreaElement,
  data: string | null,
  inputType: string,
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const InputEventCtor = getInputEventCtor();
      const evt = new InputEventCtor('input', {
        bubbles: true,
        data: data ?? null,
        inputType,
      });
      el.dispatchEvent(evt);
      return;
    } catch {
      cachedInputEventCtor = null;
      hasCachedInputEventCtor = false;
    }
  }
  const fallback = new Event('input', { bubbles: true }) as Event & {
    data?: string | null;
    inputType?: string;
  };
  fallback.data = data ?? null;
  fallback.inputType = inputType;
  el.dispatchEvent(fallback);
}

export function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  setNativeValue(el, value);
  dispatchInputEvent(el, value, 'insertText');
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function typeInputLikeUser(
  el: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  options?: { commit?: boolean },
) {
  const commit = options?.commit !== false;
  try {
    el.focus?.();
  } catch {
    /* ignore */
  }

  setNativeValue(el, '');
  dispatchInputEvent(el, '', 'deleteContentBackward');

  if (text) {
    let manualValue = '';
    const chars = Array.from(text);
    for (const char of chars) {
      manualValue += char;
      setNativeValue(el, manualValue);
      dispatchInputEvent(el, char, 'insertText');
    }
  } else {
    dispatchInputEvent(el, '', 'insertText');
  }

  if (commit) {
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
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

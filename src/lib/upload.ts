// Mutualise l'upload via DnD et input[file] et la détection de feedback UI

type FeedbackTargets = {
  grid: HTMLElement | null;
  live: HTMLElement | null;
};

export function resolveDropHost(): HTMLElement | null {
  return (
    (document.querySelector('[data-testid="dropzone"]') as HTMLElement | null) ||
    (document.querySelector('.media-select__input') as HTMLElement | null) ||
    (document.querySelector('[data-testid="photo-uploader"]') as HTMLElement | null)
  );
}

export async function waitForDropHost(timeoutMs = 8000): Promise<HTMLElement | null> {
  let dropHost = resolveDropHost();
  if (dropHost) return dropHost;
  const deadline = Date.now() + timeoutMs;
  while (!dropHost && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 120));
    dropHost = resolveDropHost();
  }
  return dropHost;
}

export function getFeedbackTargets(dropHost: HTMLElement | null): FeedbackTargets {
  const grid =
    (document.querySelector('[data-testid="media-select-grid"]') as HTMLElement | null) || dropHost;
  const live =
    (dropHost?.querySelector('[role="status"][aria-live="assertive"]') as HTMLElement | null) ||
    (document.getElementById('DndLiveRegion-0') as HTMLElement | null);
  return { grid: grid ?? null, live: live ?? null };
}

export async function waitForMediaFeedback(
  grid: HTMLElement | null,
  live: HTMLElement | null,
  beforeCount: number,
  beforeLiveText: string,
  timeoutMs = 3000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (grid && grid.childElementCount > beforeCount) {
      return true;
    }
    if (live) {
      const cur = live.textContent ?? '';
      if (cur && cur !== beforeLiveText) {
        return true;
      }
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  return false;
}

export function dispatchInputFiles(input: HTMLInputElement, files: File[]): void {
  const dtAll = new DataTransfer();
  for (const f of files) dtAll.items.add(f);
  Object.defineProperty(input, 'files', { value: dtAll.files });
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export async function dndOneFile(target: HTMLElement, file: File): Promise<void> {
  const rect = target.getBoundingClientRect();
  const clientX = Math.floor(rect.left + rect.width / 2);
  const clientY = Math.floor(rect.top + rect.height / 2);
  const dt = new DataTransfer();
  dt.items.add(file);
  try {
    (dt as DataTransfer).dropEffect = 'copy';
  } catch {
    // ignore
  }
  const dragEnter = new DragEvent('dragenter', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    dataTransfer: dt,
  } as DragEventInit);
  const dragOver = new DragEvent('dragover', {
    bubbles: true,
    cancelable: true,
    clientX: clientX + Math.floor(Math.random() * 6 - 3),
    clientY: clientY + Math.floor(Math.random() * 6 - 3),
    dataTransfer: dt,
  } as DragEventInit);
  const drop = new DragEvent('drop', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    dataTransfer: dt,
  } as DragEventInit);
  const dragLeave = new DragEvent('dragleave', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    dataTransfer: dt,
  } as DragEventInit);
  target.dispatchEvent(dragEnter);
  await new Promise((r) => setTimeout(r, 20));
  for (let k = 0; k < 2; k++) {
    target.dispatchEvent(dragOver);
    await new Promise((r) => setTimeout(r, 15));
  }
  target.dispatchEvent(drop);
  target.dispatchEvent(dragLeave);
}

export function jitter(minMs: number, maxMs: number): Promise<void> {
  const range = Math.max(0, maxMs - minMs);
  const ms = minMs + Math.floor(Math.random() * (range + 1));
  return new Promise((r) => setTimeout(r, ms));
}

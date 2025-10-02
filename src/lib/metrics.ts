// Logging et métriques activables via plusieurs canaux:
// - localStorage: vx:debug = '1' ou vx:e2e = '1' ou vx:debugImages = '1'
// - URL: ?vxdebug=1 ou #vxdebug=1
// - Cookie: vx:debug=1
// - Flag global: window.__vx_forceDebug = true (injecté automatiquement sur /items/new)
// - Perf: localStorage.vx:perf = '1'
// Objectif de cette révision: garantir l'affichage des logs sans configuration manuelle
// sur la page d'édition nouvelle annonce pour diagnostiquer les problèmes d'autofill.

// Auto-activation: si on est sur /items/new et qu'aucune clé explicite n'est définie,
// on force le debug pour cette session (flag en mémoire, non persistant).
(() => {
  try {
    const path = location.pathname || '';
    const hasExplicit =
      localStorage.getItem('vx:debug') ||
      localStorage.getItem('vx:e2e') ||
      localStorage.getItem('vx:debugImages');
    if (/\/items\/new/i.test(path) && !hasExplicit) {
      (window as unknown as { __vx_forceDebug?: boolean }).__vx_forceDebug = true;
      // Laisse une trace minimale uniquement si le debug est réellement activé
      try {
        if (isEnabled()) {
          // eslint-disable-next-line no-console
          console.log('[VX]', 'auto-debug:enabled', { path });
        }
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
})();

function isEnabled(): boolean {
  try {
    const ls = (k: string) => localStorage.getItem(k) === '1';
    const href = location.href.toLowerCase();
    const hash = location.hash.toLowerCase();
    const search = location.search.toLowerCase();
    const urlFlag =
      href.includes('vxdebug=1') || hash.includes('vxdebug') || search.includes('vxdebug=1');
    const cookieFlag = typeof document !== 'undefined' && /vx:debug=1/.test(document.cookie || '');
    return (
      ls('vx:debug') ||
      ls('vx:e2e') ||
      ls('vx:debugImages') ||
      urlFlag ||
      cookieFlag ||
      (window as unknown as { __vx_forceDebug?: boolean }).__vx_forceDebug === true
    );
  } catch {
    return false;
  }
}

const PERF_STORE: Map<string, number> = new Map();

export function log(level: 'info' | 'debug' | 'warn', ...args: unknown[]) {
  if (!isEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    const fn = level === 'warn' ? console.warn : level === 'debug' ? console.debug : console.log;
    fn('[VX]', ...args);
  } catch {
    /* ignore */
  }
}

export function perf(key: string, action: 'start' | 'end') {
  try {
    const want = (() => {
      try {
        return localStorage.getItem('vx:perf') === '1' || isEnabled();
      } catch {
        return false;
      }
    })();
    if (!want) return;
    if (action === 'start') {
      PERF_STORE.set(key, performance.now());
      return;
    }
    if (action === 'end') {
      const start = PERF_STORE.get(key);
      if (typeof start === 'number') {
        const dur = performance.now() - start;
        log('info', `perf:${key}`, `${dur.toFixed(1)}ms`);
      }
    }
  } catch {
    /* ignore */
  }
}

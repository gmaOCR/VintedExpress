import { extractDraftFromItemPage } from '../lib/extractor';
import { sendMessage } from '../lib/messaging';
import { setTyped } from '../lib/storage';
import type { RepublishDraft } from '../types/draft';
import { KEY_REPUBLISH_DRAFT, RepublishDraftSchema } from '../types/draft';
import { ContentReady, RepublishCreate, RepublishInjected } from '../types/messages';

function debug(...args: unknown[]) {
  try {
    // Activez via localStorage.setItem('vx:debug', '1')
    if (localStorage.getItem('vx:debug') === '1') {
      // eslint-disable-next-line no-console
      console.debug('[VX]', ...args);
    }
  } catch {
    // ignore
  }
}

// --- i18n minimal pour le label du bouton ---
type Locale = 'en' | 'fr' | 'de' | 'es' | 'it' | 'nl' | 'pl' | 'pt' | 'lt' | 'cs';
const LABELS: Record<Locale, { republish: string; duplicate: string }> = {
  en: { republish: 'Republish', duplicate: 'Duplicate' },
  fr: { republish: 'Republier', duplicate: 'Dupliquer' },
  de: { republish: 'Wiederveröffentlichen', duplicate: 'Duplizieren' },
  es: { republish: 'Republicar', duplicate: 'Duplicar' },
  it: { republish: 'Ripubblica', duplicate: 'Duplica' },
  nl: { republish: 'Opnieuw plaatsen', duplicate: 'Dupliceren' },
  pl: { republish: 'Wystaw ponownie', duplicate: 'Duplikuj' },
  pt: { republish: 'Republicar', duplicate: 'Duplicar' },
  lt: { republish: 'Paskelbti iš naujo', duplicate: 'Dubliuoti' },
  cs: { republish: 'Znovu zveřejnit', duplicate: 'Duplikovat' },
};

function detectLocale(): Locale {
  try {
    // 1) <html lang="xx-YY">
    const lang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    if (lang) {
      const base = lang.split('-')[0] as Locale;
      if (base in LABELS) return base;
    }
    // 2) TLD/host heuristique
    const host = location.hostname.toLowerCase();
    if (host.endsWith('.fr')) return 'fr';
    if (host.endsWith('.de')) return 'de';
    if (host.endsWith('.es')) return 'es';
    if (host.endsWith('.it')) return 'it';
    if (host.endsWith('.nl')) return 'nl';
    if (host.endsWith('.pl')) return 'pl';
    if (host.endsWith('.pt')) return 'pt';
    if (host.endsWith('.lt')) return 'lt';
    if (host.endsWith('.cz')) return 'cs';
  } catch {
    // ignore
  }
  return 'en';
}

function tLabel(key: 'republish' | 'duplicate'): string {
  const loc = detectLocale();
  const pack = LABELS[loc] || LABELS.en;
  return pack[key];
}

function hasAncestorWithClass(el: Element, className: string): boolean {
  let cur: HTMLElement | null = el as HTMLElement;
  while (cur) {
    if (cur.classList && cur.classList.contains(className)) return true;
    cur = cur.parentElement;
  }
  return false;
}

function isVisible(el: Element | null): boolean {
  if (!el) return false;
  if (!document.documentElement.contains(el)) return false;
  // Écarter explicitement les conteneurs mobiles cachés
  if (el.closest('.u-mobiles-only,[data-testid="item-mobiles-only-container"]')) return false;
  // Écarter une éventuelle classe utilitaire cachant sur desktop
  // Attention: '@' n'est pas un sélecteur valide en querySelector; utiliser classList
  if (hasAncestorWithClass(el, 'u-hidden@desktops')) return false;

  let cur: HTMLElement | null = el as HTMLElement;
  while (cur) {
    const cs = window.getComputedStyle(cur);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    cur = cur.parentElement;
  }
  const rect = (el as HTMLElement).getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findPreferredDeleteButton(): HTMLButtonElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-testid="item-delete-button"]'),
  );
  if (!candidates.length) return null;
  const ranked = candidates
    .map((el) => {
      const inSidebar = !!el.closest('#sidebar');
      const inDesktops = !!el.closest('.u-desktops-only');
      const inMobiles = !!el.closest('.u-mobiles-only,[data-testid="item-mobiles-only-container"]');
      const visible = isVisible(el) && !inMobiles;
      let score = 0;
      if (visible) score += 10;
      if (inSidebar) score += 5;
      if (inDesktops) score += 3;
      if (inMobiles) score -= 10;
      return { el, score };
    })
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.el ?? null;
}

function findVisibleActionsBlock(): HTMLElement | null {
  const blocks = Array.from(
    document.querySelectorAll<HTMLElement>('.details-list__item.details-list--actions'),
  );
  if (!blocks.length) return null;
  const ranked = blocks
    .map((el) => {
      const inSidebar = !!el.closest('#sidebar');
      const inDesktops = !!el.closest('.u-desktops-only');
      const inMobiles = !!el.closest('.u-mobiles-only,[data-testid="item-mobiles-only-container"]');
      const visible = isVisible(el) && !inMobiles;
      let score = 0;
      if (visible) score += 10;
      if (inSidebar) score += 5;
      if (inDesktops) score += 3;
      if (inMobiles) score -= 10;
      return { el, score };
    })
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.el ?? null;
}

function enhanceListingPage() {
  // Heuristique simple: URL d’une annonce Vinted contient souvent /items/xxx
  const isItem = /\/items\//.test(location.pathname);
  if (!isItem) return;

  // Détecter si l’annonce est vendue (texte indicatif sur la page)
  const statusNode = document.querySelector(
    '[data-testid="item-status--content"], [data-testid="item-status"], ._sold, .is-sold',
  );
  const isSold = /vendu|sold|verkauft|vendido|venduto|verkocht/i.test(
    (statusNode?.textContent ?? '').toLowerCase(),
  );

  // Chercher le conteneur d’actions via le bouton “Supprimer” et cibler la grille .u-grid
  const deleteBtn = findPreferredDeleteButton();
  const actionsBlock = (deleteBtn?.closest('.details-list__item.details-list--actions') ||
    findVisibleActionsBlock()) as HTMLElement | null;
  // La structure courante contient une grille .u-grid à l'intérieur
  const grid = (actionsBlock?.querySelector('.u-grid') ||
    deleteBtn?.closest('.u-grid')) as HTMLElement | null;
  const titleEl = document.querySelector('h1, [data-testid="item-title"]');
  const fallback = (titleEl?.parentElement || titleEl || document.body) as HTMLElement | null;

  debug('enhance check', {
    isItem,
    isSold,
    hasDelete: !!deleteBtn,
    hasActions: !!actionsBlock,
    where: deleteBtn?.closest('#sidebar') ? 'sidebar' : deleteBtn ? 'content' : 'none',
  });

  // Si le bouton existe déjà ailleurs et qu’on a trouvé la grille, déplace-le dedans
  const existing = document.getElementById('vx-republish');
  if (existing && grid && existing.parentElement !== grid) {
    grid.appendChild(existing);
    return;
  }
  // Éviter les doublons globaux
  if (existing) return;
  const container = grid || actionsBlock || fallback;
  if (!container) {
    debug('no container yet, will fallback to FAB');
    ensureFloatingSoon(isSold);
    return;
  }

  const btn = document.createElement('button');
  btn.id = 'vx-republish';
  btn.type = 'button';
  btn.setAttribute('data-testid', 'vx-republish-button');
  // Style natif Vinted pour s’intégrer
  btn.className = 'web_ui__Button__button web_ui__Button__outlined web_ui__Button__medium';
  btn.innerHTML = `<span class="web_ui__Button__content"><span class="web_ui__Button__label">${
    isSold ? tLabel('republish') : tLabel('duplicate')
  }</span></span>`;
  // Assurer un petit espacement visuel et un code couleur distinct du bouton "Supprimer"
  const baseStyle = btn.style as CSSStyleDeclaration;
  baseStyle.marginLeft = '0';
  baseStyle.marginTop = '8px';
  baseStyle.display = 'inline-flex';
  baseStyle.alignItems = 'center';
  baseStyle.justifyContent = 'center';
  baseStyle.gap = '6px';
  // Couleur distincte (vert doux), sans casser le thème Vinted
  baseStyle.border = baseStyle.border || '1px solid #2f855a';
  baseStyle.color = baseStyle.color || '#2f855a';
  baseStyle.background = baseStyle.background || '#f0fff4';

  btn.addEventListener('click', onRepublishClick);
  // Si on a la grille et le bouton supprimer, insérer juste après dans le même parent
  const gridContainer = (
    container.matches('.u-grid') ? container : container.querySelector('.u-grid')
  ) as HTMLElement | null;
  const del = (gridContainer || container).querySelector(
    '[data-testid="item-delete-button"]',
  ) as HTMLElement | null;
  if (gridContainer && del && del.parentElement) {
    del.parentElement.insertBefore(btn, del.nextSibling);
    void sendMessage(RepublishInjected, {
      type: 'republish:injected',
      payload: { where: 'actions', url: location.href },
    });
  } else {
    debug('grid/del not found, appending to container');
    container.appendChild(btn);
    void sendMessage(RepublishInjected, {
      type: 'republish:injected',
      payload: { where: 'fallback', url: location.href },
    });
  }

  // Forcer un style de base visible dans tous les cas
  const s = btn.style as CSSStyleDeclaration;
  s.display = s.display || 'inline-flex';
  s.alignItems = s.alignItems || 'center';
  s.justifyContent = s.justifyContent || 'center';
  s.gap = s.gap || '6px';

  // Vérifier la visibilité après le layout; sinon, fallback flottant
  setTimeout(() => {
    try {
      const cs = window.getComputedStyle(btn);
      const hidden =
        cs.display === 'none' || cs.visibility === 'hidden' || btn.offsetParent === null;
      if (hidden) {
        ensureFloatingButton(isSold);
      }
    } catch (_e) {
      // ignore
    }
  }, 50);
}

function ensureFloatingSoon(isSold: boolean) {
  // Évite de créer plusieurs FAB si les mutations se déclenchent souvent
  if (document.getElementById('vx-republish') || document.getElementById('vx-republish-fab')) {
    return;
  }
  setTimeout(() => {
    if (!document.getElementById('vx-republish') && !document.getElementById('vx-republish-fab')) {
      ensureFloatingButton(isSold);
    }
  }, 200);
}

function ensureStylesInjected() {
  if (document.getElementById('vx-style')) return;
  const style = document.createElement('style');
  style.id = 'vx-style';
  style.textContent = `
  #vx-republish { display: inline-flex !important; visibility: visible !important; opacity: 1 !important; align-items: center; justify-content: center; gap: 6px; }
    #vx-republish .web_ui__Button__label { white-space: nowrap; }
    #vx-republish-fab { font: inherit; }
  `;
  document.documentElement.appendChild(style);
}

function ensureFloatingButton(isSold: boolean) {
  if (document.getElementById('vx-republish-fab')) return;
  const fab = document.createElement('button');
  fab.id = 'vx-republish-fab';
  fab.type = 'button';
  fab.textContent = isSold ? tLabel('republish') : tLabel('duplicate');
  Object.assign(fab.style, {
    position: 'fixed',
    right: '12px',
    bottom: '12px',
    zIndex: '2147483647',
    padding: '8px 12px',
    borderRadius: '999px',
    border: '1px solid #ccc',
    background: '#fff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    cursor: 'pointer',
  } as CSSStyleDeclaration);
  fab.addEventListener('click', onRepublishClick);
  document.body.appendChild(fab);
}

async function onRepublishClick() {
  const draft: RepublishDraft = extractDraftFromItemPage();
  // Ouvre le formulaire de création d’annonce; l’URL exacte peut varier selon la locale
  const targetUrl = new URL('/items/new', location.origin).toString();
  await sendMessage(RepublishCreate, { type: 'republish:create', payload: { targetUrl } });
  // Note: l’auto-remplissage sera géré par un content script sur la page /items/new
  try {
    await setTyped(KEY_REPUBLISH_DRAFT, draft, RepublishDraftSchema);
  } catch (e) {
    console.warn('[VX] save draft error', e);
  }
}

// Exécuter main après la déclaration de toutes les constantes/fonctions pour éviter la TDZ
(function main() {
  // Notify background we're ready
  void sendMessage(ContentReady, { type: 'content:ready', payload: { url: location.href } });

  // Example DOM access kept minimal and safe
  // Add a data attribute to body for quick visual check in dev
  try {
    document.body.setAttribute('data-vx', 'ready');
  } catch {
    // ignore
  }

  // Inject initialement puis observer les mutations (SPA)
  try {
    enhanceListingPage();
  } catch (e) {
    console.warn('[VX] initial enhance error', e);
  }
  const observer = new MutationObserver(() => {
    try {
      enhanceListingPage();
    } catch (e) {
      // silencieux pour éviter le spam
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Forcer styles visibles et robuste aux thèmes
  ensureStylesInjected();

  // Heartbeat: si Vinted re-render et supprime notre bouton, on réinsère
  setInterval(() => {
    try {
      if (/\/items\//.test(location.pathname)) {
        const hasBtn = !!document.getElementById('vx-republish');
        const del = document.querySelector('[data-testid="item-delete-button"]');
        if (!hasBtn && del) {
          enhanceListingPage();
        }
      }
    } catch {
      // ignore
    }
  }, 1500);
})();

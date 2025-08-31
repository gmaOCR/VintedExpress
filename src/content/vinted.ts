import { sendMessage } from '../lib/messaging';
import { ContentReady, RepublishCreate, RepublishInjected } from '../types/messages';

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
})();

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
  const deleteBtn = document.querySelector(
    '[data-testid="item-delete-button"]',
  ) as HTMLButtonElement | null;
  const actionsBlock = deleteBtn?.closest(
    '.details-list__item.details-list--actions',
  ) as HTMLElement | null;
  const grid = (actionsBlock?.querySelector('.u-grid') ||
    deleteBtn?.closest('.u-grid')) as HTMLElement | null;
  const titleEl = document.querySelector('h1, [data-testid="item-title"]');
  const fallback = (titleEl?.parentElement || titleEl || document.body) as HTMLElement | null;

  // Si le bouton existe déjà ailleurs et qu’on a trouvé la grille, déplace-le dedans
  const existing = document.getElementById('vx-republish');
  if (existing && grid && existing.parentElement !== grid) {
    grid.appendChild(existing);
    return;
  }
  // Éviter les doublons globaux
  if (existing) return;
  const container = grid || actionsBlock || fallback;
  if (!container) return;

  const btn = document.createElement('button');
  btn.id = 'vx-republish';
  btn.type = 'button';
  btn.setAttribute('data-testid', 'vx-republish-button');
  // Style natif Vinted pour s’intégrer
  btn.className = 'web_ui__Button__button web_ui__Button__outlined web_ui__Button__medium';
  btn.innerHTML = `<span class="web_ui__Button__content"><span class="web_ui__Button__label">${
    isSold ? 'Republier' : 'Dupliquer'
  }</span></span>`;
  // Assurer un petit espacement visuel
  (btn.style as CSSStyleDeclaration).marginLeft = '8px';

  btn.addEventListener('click', onRepublishClick);
  // Si on a la grille et le bouton supprimer, insérer juste après
  const gridContainer = container.matches('.u-grid') ? container : container.querySelector('.u-grid');
  const del = gridContainer?.querySelector('[data-testid="item-delete-button"]');
  if (gridContainer && del && del.parentNode) {
    del.parentNode.insertBefore(btn, del.nextSibling);
    void sendMessage(RepublishInjected, { type: 'republish:injected', payload: { where: 'actions', url: location.href } });
  // Afficher aussi le bouton flottant de secours pour garantir la visibilité
  ensureFloatingButton(isSold);
  } else {
    container.appendChild(btn);
    void sendMessage(RepublishInjected, { type: 'republish:injected', payload: { where: 'fallback', url: location.href } });
    // Ajouter un bouton flottant de secours si l’insertion est hors zone visible
    ensureFloatingButton(isSold);
  }

  // Forcer un style de base visible dans tous les cas
  const s = btn.style as CSSStyleDeclaration;
  s.display = 'inline-flex';
  s.alignItems = 'center';
  s.gap = '6px';
  s.marginLeft = s.marginLeft || '8px';

  // Vérifier la visibilité après le layout; sinon, fallback flottant
  setTimeout(() => {
    try {
      const cs = window.getComputedStyle(btn);
      const hidden = cs.display === 'none' || cs.visibility === 'hidden' || btn.offsetParent === null;
      if (hidden) {
        ensureFloatingButton(isSold);
      }
    } catch (_e) {
      // ignore
    }
  }, 50);
}

function ensureFloatingButton(isSold: boolean) {
  if (document.getElementById('vx-republish-fab')) return;
  const fab = document.createElement('button');
  fab.id = 'vx-republish-fab';
  fab.type = 'button';
  fab.textContent = isSold ? 'Republier' : 'Dupliquer';
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
  const draft = extractDraft();
  // Ouvre le formulaire de création d’annonce; l’URL exacte peut varier selon la locale
  const targetUrl = new URL('/items/new', location.origin).toString();
  await sendMessage(RepublishCreate, { type: 'republish:create', payload: { targetUrl } });
  // Note: l’auto-remplissage sera géré par un content script sur la page /items/new
  sessionStorage.setItem('vx-republish-draft', JSON.stringify(draft));
}

function extractDraft() {
  // Extraction prudente: on prend le titre et la description si disponibles
  const title = (
    document.querySelector('[data-testid="item-title"], h1')?.textContent ?? ''
  ).trim();
  const desc = (
    document.querySelector(
      '[data-testid="item-description"], .Item__description, [itemprop="description"]',
    )?.textContent ?? ''
  ).trim();
  // Galerie images
  const imgs = Array.from(
    document.querySelectorAll<HTMLImageElement>(
      '[data-testid^="item-photo-"] img, .item-photos img',
    ),
  )
    .map((img) => img.src)
    .filter(Boolean);
  return { title, description: desc, images: imgs };
}

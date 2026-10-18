/* Aurore Plume — navigation créative horizontale.
   Module isolé : n’altère ni l’atelier, ni l’authentification, ni le stockage. */
import './creative-navigation.css';

const channels = [
  { id: 'textes', label: 'Textes', icon: 'Aa', kicker: 'LES MOTS PRENNENT FORME', title: 'Des histoires à rencontrer.', intro: 'Romans, poèmes, nouvelles et fragments : découvrez les voix qui commencent à se faire entendre.', style: 'channel-literature', action: 'Explorer la bibliothèque', view: 'library', tags: ['Poésie', 'Romans', 'Nouvelles', 'Carnets'] },
  { id: 'videos', label: 'Vidéos', icon: '▶', kicker: 'IMAGES EN MOUVEMENT', title: 'Des histoires à regarder.', intro: 'Courts-métrages, animations, documentaires et regards singuliers sur le monde.', style: 'channel-video', action: 'Préparer une vidéo', view: 'atelier', tags: ['Courts-métrages', 'Animation', 'Documentaire', 'Création'] },
  { id: 'arts', label: 'Arts visuels', icon: '✳', kicker: 'LE REGARD DEVIENT ŒUVRE', title: 'L’art de voir autrement.', intro: 'Peintures, photographies, affiches et créations numériques dans une galerie pensée pour l’image.', style: 'channel-art', action: 'Présenter une œuvre', view: 'atelier', tags: ['Peinture', 'Photographie', 'Graphisme', 'Art numérique'] },
  { id: 'dessins', label: 'Dessins', icon: '✎', kicker: 'TRAITS, LIGNES ET IMAGINATION', title: 'Chaque trait a une histoire.', intro: 'Illustrations, croquis, bandes dessinées et personnages inventés prennent leur place dans la galerie.', style: 'channel-drawing', action: 'Présenter un dessin', view: 'atelier', tags: ['Illustration', 'Croquis', 'BD', 'Portraits'] },
  { id: 'musique', label: 'Musique', icon: '♫', kicker: 'LES SONS TROUVENT LEUR PLACE', title: 'À écouter, à ressentir.', intro: 'Chansons originales, compositions, spoken word et créations sonores de nouveaux artistes.', style: 'channel-music', action: 'Présenter une création sonore', view: 'atelier', tags: ['Chanson', 'Instrumental', 'Spoken word', 'Podcast'] },
  { id: 'numerique', label: 'Numérique', icon: '⌘', kicker: 'DES IDÉES QUI PRENNENT VIE', title: 'Des projets à explorer.', intro: 'Sites web, applications, expériences interactives et prototypes créés par des esprits curieux.', style: 'channel-digital', action: 'Présenter un projet', view: 'atelier', tags: ['Sites web', 'Applications', 'Jeux', 'Expériences'] },
  { id: 'scene', label: 'Scène & autres', icon: '✦', kicker: 'LES TALENTS SANS FRONTIÈRES', title: 'Il reste tant à inventer.', intro: 'Danse, théâtre, mode, artisanat et créations qui ne rentrent dans aucune case.', style: 'channel-stage', action: 'Présenter une création', view: 'atelier', tags: ['Danse', 'Théâtre', 'Mode', 'Artisanat'] }
];

let active = 0;
let overlayOpen = false;
let touchStartX = null;
let touchStartY = null;
let lastRoot = null;

function safeText(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function navMarkup() {
  return `<nav class="creative-rail" aria-label="Univers créatifs">
    <div class="creative-rail-head"><span class="creative-rail-label">EXPLORER LES UNIVERS</span><span class="creative-rail-hint">Glissez pour découvrir <span aria-hidden="true">↔</span></span></div>
    <div class="creative-tabs" role="tablist" aria-label="Catégories de créations">
      ${channels.map((c, i) => `<button class="creative-tab ${i === active ? 'is-active' : ''}" role="tab" aria-selected="${i === active}" data-channel-index="${i}"><span class="creative-tab-icon">${c.icon}</span><span>${c.label}</span></button>`).join('')}
    </div>
  </nav>`;
}

function pageMarkup() {
  const c = channels[active];
  return `<section class="creative-page ${c.style}" aria-label="${safeText(c.label)}">
    <div class="creative-page-top"><span class="creative-eyebrow"><span class="creative-eyebrow-dot"></span>${c.kicker}</span><span class="creative-index">0${active + 1} <i>/</i> 0${channels.length}</span></div>
    <div class="creative-hero-grid">
      <div class="creative-copy">
        <h1>${c.title}</h1><p class="creative-intro">${c.intro}</p>
        <div class="creative-tags">${c.tags.map(tag => `<span>${tag}</span>`).join('')}</div>
        <div class="creative-actions"><button class="creative-primary" data-channel-action="${c.view}">${c.action} <span aria-hidden="true">↗</span></button><button class="creative-secondary" data-channel-back>Retour à l’accueil</button></div>
      </div>
      <div class="creative-artwork" aria-hidden="true">
        <div class="creative-art-glow"></div><div class="creative-art-orbit orbit-a"></div><div class="creative-art-orbit orbit-b"></div>
        <div class="creative-art-main"><span class="creative-art-symbol">${c.icon}</span><span class="creative-art-label">AURORE · ${String(active + 1).padStart(2,'0')}</span></div>
        <span class="creative-art-sticker sticker-one">${c.label}</span><span class="creative-art-sticker sticker-two">CRÉER LIBREMENT ✳</span>
      </div>
    </div>
    <div class="creative-bottom"><div><span class="creative-bottom-kicker">LA CRÉATION EST À TOUT LE MONDE</span><p>Les premières œuvres de cet univers seront mises en lumière ici après leur publication.</p></div><span class="creative-bottom-mark">a.</span></div>
    <div class="creative-page-controls"><button data-channel-prev ${active === 0 ? 'disabled' : ''} aria-label="Univers précédent">← <span>Précédent</span></button><div class="creative-progress" aria-label="Univers ${active + 1} sur ${channels.length}">${channels.map((_, i) => `<button data-channel-index="${i}" class="${i === active ? 'is-active' : ''}" aria-label="Aller à ${channels[i].label}"></button>`).join('')}</div><button data-channel-next ${active === channels.length - 1 ? 'disabled' : ''} aria-label="Univers suivant"><span>Suivant</span> →</button></div>
  </section>`;
}

function showChannel(index) {
  active = Math.max(0, Math.min(channels.length - 1, index));
  overlayOpen = true;
  const main = document.querySelector('#app main');
  if (!main) return;
  main.dataset.creativeOriginal ??= main.innerHTML;
  main.innerHTML = pageMarkup();
  syncTabs();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeChannel() {
  overlayOpen = false;
  const main = document.querySelector('#app main');
  if (main?.dataset.creativeOriginal) {
    main.innerHTML = main.dataset.creativeOriginal;
    delete main.dataset.creativeOriginal;
  }
  syncTabs();
}

function syncTabs() {
  document.querySelectorAll('.creative-rail').forEach(el => el.outerHTML = navMarkup());
}

function enhance() {
  const root = document.querySelector('#app');
  if (!root || root === lastRoot && root.querySelector('.creative-rail')) return;
  lastRoot = root;
  const header = root.querySelector('.site-header');
  const main = root.querySelector('main');
  if (!header || !main || header.querySelector('.creative-rail')) return;
  header.insertAdjacentHTML('afterend', navMarkup());
  // Preserve the existing literary home page; category pages open from the new rail.
}

document.addEventListener('click', event => {
  const tab = event.target.closest('[data-channel-index]');
  if (tab) { event.preventDefault(); showChannel(Number(tab.dataset.channelIndex)); return; }
  if (event.target.closest('[data-channel-next]')) { showChannel(active + 1); return; }
  if (event.target.closest('[data-channel-prev]')) { showChannel(active - 1); return; }
  if (event.target.closest('[data-channel-back]')) { closeChannel(); return; }
  const action = event.target.closest('[data-channel-action]');
  if (action) {
    const view = action.dataset.channelAction;
    closeChannel();
    const button = document.querySelector(`#app [data-view="${view}"]`);
    if (button) button.click();
  }
}, true);

document.addEventListener('touchstart', event => {
  if (!overlayOpen || !event.changedTouches?.length) return;
  touchStartX = event.changedTouches[0].clientX;
  touchStartY = event.changedTouches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', event => {
  if (!overlayOpen || touchStartX === null || !event.changedTouches?.length) return;
  const dx = event.changedTouches[0].clientX - touchStartX;
  const dy = event.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.25) showChannel(active + (dx < 0 ? 1 : -1));
  touchStartX = null; touchStartY = null;
}, { passive: true });

document.addEventListener('keydown', event => {
  if (!overlayOpen) return;
  if (event.key === 'ArrowRight') showChannel(active + 1);
  if (event.key === 'ArrowLeft') showChannel(active - 1);
  if (event.key === 'Escape') closeChannel();
});

const observer = new MutationObserver(() => {
  if (!overlayOpen) enhance();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
enhance();

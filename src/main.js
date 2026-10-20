import { createClient } from '@supabase/supabase-js';
import './style.css';
import './editorial-studio.css';
import './plume-editor-fixes.css';
import './aurore-pdf-reader.css';
import './aurore-science-keyboard.css';
import './plume-latex-flow.css';
import './plume-pill-bar.css';
import './plume-theme.css';
import './plume-theme.js';
import './aurore-science-keyboard.js';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
const toastRoot = document.querySelector('#toast-root');

const state = { user: null, view: 'discover', publicWorks: [], publicWorksError: !supabase, myWorks: [], myVideos: [], editing: null, editingVideo: null, workspaceTab: 'textes', showCreateForm: false, showDraftCreate: false, showPublishedWorks: false, editorOpen: false, editorTab: 'cover', editorCoverPreview: null, editorPages: [], editorPageIndex: 0, editorSelectedBlock: null, editorHistory: [], editorHistoryIndex: -1, myCreations: [], editingCreation: null, search: '', storageFiles: [], r2PickerOpen: false, r2PendingRender: false };

// Limite par formule pour préserver la lisibilité et éviter des compositions excessives.
const MAX_LATEX_SOURCE_LENGTH = 3000;

function sanitizePdfColorFunctions(clonedDocument) {
  // html2canvas ne sait pas parser color(srgb ...). Neutraliser ces déclarations
  // dans le document de capture sans modifier l'apparence normale de l'éditeur.
  const safeColor = 'rgb(82, 76, 94)';
  const sanitizeStyle = (style) => {
    if (!style) return;
    for (let index = style.length - 1; index >= 0; index--) {
      const property = style.item(index);
      const value = style.getPropertyValue(property);
      if (/color\s*\(/i.test(value)) style.setProperty(property, value.replace(/color\s*\([^)]*\)/gi, safeColor), style.getPropertyPriority(property));
    }
  };
  try {
    for (const sheet of Array.from(clonedDocument.styleSheets || [])) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      for (const rule of Array.from(rules || [])) {
        if (rule.style) sanitizeStyle(rule.style);
      }
    }
  } catch (error) { console.warn('Nettoyage des couleurs PDF partiel', error); }
  clonedDocument.querySelectorAll('[style]').forEach((node) => sanitizeStyle(node.style));
}

let plumeScienceKeyboard = null;
const plumeSciencePreviewVersions = new WeakMap();

const e = (value = '') => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const authorOf = (work) => Array.isArray(work.plume_profiles) ? work.plume_profiles[0] : (work.plume_profiles || null);
const formatDate = (value) => value ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Récemment';
const words = (value = '') => (String(value).trim().match(/\S+/g) || []).length;
const initials = (value = '') => value.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'A';

// Premier rendu anticipé : une erreur dans un module secondaire ne doit pas laisser
// l’écran « Aurore Plume se prépare… » bloqué indéfiniment.
try {
  render();
} catch (startupError) {
  console.error('Démarrage initial Aurore Plume', startupError);
  const boot = document.querySelector('.boot-screen');
  if (boot) boot.innerHTML = '<span class="brand-sigil">a.</span><p>Le démarrage a rencontré un problème. Rechargez la page ; si cela persiste, transmettez le message de console.</p>';
}

function toast(message, kind = 'success') {
  toastRoot.innerHTML = '<div class="toast toast-' + e(kind) + '">' + e(message) + '</div>';
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => { toastRoot.innerHTML = ''; }, 4200);
}

function shell(content) {
  // Le clavier conserve une référence vers le champ actif : la détacher avant de remplacer le DOM.
  if (plumeScienceKeyboard) plumeScienceKeyboard.hide();
  if (state.editorOpen) {
    app.innerHTML = `<main class="editor-only-shell">${content}</main>`;
    return;
  }
  const nav = [
    ['discover', 'Découvrir'],
    ['library', 'Accueil'],
    ['atelier', 'Mon atelier']
  ];
  app.innerHTML = `
    <header class="site-header">
      <div class="header-inner">
        <button class="brand" data-view="discover" aria-label="Accueil Aurore Plume">
          <span class="brand-sigil">a.</span><span class="brand-name">aurore <b>plume</b><small>ÉCRIRE · PARTAGER · GRANDIR</small></span>
        </button>
        <nav class="desktop-nav" aria-label="Navigation principale">
          ${nav.map(([id, label]) => `<button class="nav-link ${state.view === id ? 'active' : ''}" data-view="${id}">${label}</button>`).join('')}
        </nav>
        <div class="header-actions">
          ${state.user
            ? `<button class="user-chip" data-view="atelier" aria-label="Ouvrir mon atelier"><span class="avatar-mini">${e(initials(state.user.user_metadata?.display_name || state.user.email || 'A'))}</span><span>Mon espace</span></button>`
            : '<button class="button button-quiet sign-in-button" data-action="auth">Se connecter</button>'}
          <button class="button button-primary header-cta" data-view="atelier">Écrire un texte <span aria-hidden="true">↗</span></button>
        </div>
        <button class="mobile-menu" data-action="mobile-menu" aria-label="Ouvrir le menu">☰</button>
      </div>
      <div class="mobile-nav" id="mobile-nav">${nav.map(([id, label]) => `<button class="nav-link" data-view="${id}">${label}</button>`).join('')}${state.user ? '<button class="nav-link" data-action="signout">Se déconnecter</button>' : '<button class="nav-link" data-action="auth">Se connecter</button>'}</div>
    </header>
    <main>${content}</main>
    <footer class="site-footer">
      <div class="footer-brand"><span class="brand-sigil">a.</span><span><b>Aurore Plume</b><small>Les mots trouvent leur place.</small></span></div>
      <p>Un espace pour écrire à son rythme et partager avec justesse.</p>
      <div class="footer-links"><button data-view="discover">Découvrir</button><button data-view="atelier">Mon atelier</button><a href="https://supabase.com/dashboard/project/iymioasfkithmyqtpipd" target="_blank" rel="noreferrer">Espace de données ↗</a></div>
      <small class="copyright">© <span id="year">${new Date().getFullYear()}</span> Aurore · Fait avec attention.</small>
    </footer>
  `;
}

function workCard(work, compact = false) {
  const author = authorOf(work);
  const isDemo = Boolean(work.demo);
  const cover = ['cover-lilac', 'cover-sand', 'cover-rose'][Math.abs((work.title || '').length) % 3];
  return `
    <article class="work-card ${compact ? 'work-card-compact' : ''}">
      <div class="work-cover ${cover}">
        <span class="cover-mark">a.</span>
        <span class="cover-category">${e(work.genre || 'Texte')}</span>
        <span class="cover-lines" aria-hidden="true"></span>
      </div>
      <div class="work-card-body">
        <div class="card-meta"><span>${isDemo ? 'APERÇU FICTIF' : e(work.genre || 'Texte')}</span><span>${e(formatDate(work.published_at || work.created_at))}</span></div>
        <h3>${e(work.title)}</h3>
        ${work.subtitle ? `<p class="work-subtitle">${e(work.subtitle)}</p>` : ''}
        <p class="work-summary">${e(work.summary || 'Un texte à découvrir, écrit avec attention.')}</p>
        <div class="work-card-foot">
          <div class="author-avatar">${e(initials(author?.display_name || 'Aurore'))}</div>
          <div class="author-copy"><strong>${e(author?.display_name || 'Aurore Plume')}</strong><small>${isDemo ? 'Texte d’illustration' : 'Auteur·rice'}</small></div>
          <button class="icon-button" data-read-id="${e(work.id)}" aria-label="Lire ${e(work.title)}">↗</button>
        </div>
      </div>
    </article>`;
}

function renderDiscover() {
  const works = state.publicWorks;
  const worksMarkup = works.length
    ? `<div class="work-grid">${works.slice(0, 9).map((work) => workCard(work)).join('')}</div>`
    : state.publicWorksError
      ? `<div class="empty-state"><span>!</span><h3>Les œuvres sont momentanément indisponibles.</h3><p>Actualisez la page dans un instant. Vos brouillons restent dans votre atelier.</p></div>`
      : `<div class="empty-state"><span>✳</span><h3>Les premières œuvres arrivent.</h3><p>Les textes apparaîtront ici dès qu’ils seront publiés en mode public. Aucun exemple fictif n’est affiché.</p><button class="button button-primary" data-view="atelier">Écrire la première œuvre <span aria-hidden="true">↗</span></button></div>`;
  shell(`
    <section class="discover-intro container discover-intro-minimal">
      <button class="button button-quiet discover-write-button" data-view="atelier">Écrire une œuvre <span aria-hidden="true">↗</span></button>
    </section>
    <section class="section container home-library" id="library-section">
      <div class="section-heading">
        <div><div class="eyebrow">À LIRE · À DÉCOUVRIR</div><h2>Les œuvres publiées</h2><p>Retrouvez ici les œuvres réellement rendues publiques, des plus récentes aux plus anciennes.</p></div>
        <button class="text-link" data-view="library">Toutes les œuvres <span>↗</span></button>
      </div>
      ${worksMarkup}
    </section>
  `);
}

function renderLibrary() {
  const works = state.publicWorks;
  const filtered = works.filter((work) => [work.title, work.subtitle, work.summary, work.genre, authorOf(work)?.display_name].join(' ').toLowerCase().includes(state.search.toLowerCase()));
  let listing = '';
  if (!works.length && state.publicWorksError) {
    listing = '<div class="empty-state"><span>!</span><h3>Les œuvres sont momentanément indisponibles.</h3><p>Actualisez la page dans un instant. Vos brouillons ne sont pas affectés.</p></div>';
  } else if (!works.length) {
    listing = '<div class="empty-state"><span>✳</span><h3>Aucune œuvre publique pour le moment.</h3><p>Les œuvres apparaîtront ici dès qu’un auteur les publiera en mode public. Les brouillons privés restent dans leur atelier.</p></div>';
  } else if (!filtered.length) {
    listing = '<div class="empty-state"><span>⌕</span><h3>Aucun texte ne correspond.</h3><p>Essayez un autre titre, une autre idée ou un autre genre.</p></div>';
  } else {
    listing = `<div class="work-grid">${filtered.map((work) => workCard(work)).join('')}</div>`;
  }
  shell(`
    <section class="page-hero container">
      <div class="eyebrow"><span class="eyebrow-dot"></span> À DÉCOUVRIR</div>
      <h1>Des pages à <em>rencontrer.</em></h1>
      <label class="search-field"><span>⌕</span><input id="library-search" type="search" placeholder="Rechercher un titre, un genre, une idée…" value="${e(state.search)}" autocomplete="off"><kbd>/</kbd></label>
    </section>
    <section class="section container library-results">
      <div class="results-heading"><div><span class="eyebrow">LECTURE LIBRE</span><h2>Textes publiés</h2></div><span class="result-count">${filtered.length} ${filtered.length > 1 ? 'textes' : 'texte'}</span></div>
      ${listing}
    </section>
  `);
  const input = document.querySelector('#library-search');
  input?.addEventListener('input', (event) => {
    state.search = event.target.value;
    const query = state.search.toLowerCase();
    document.querySelectorAll('.work-card').forEach((card) => {
      card.hidden = !card.textContent.toLowerCase().includes(query);
    });
    const visible = [...document.querySelectorAll('.work-card')].filter((card) => !card.hidden).length;
    const count = document.querySelector('.result-count');
    if (count) count.textContent = visible + (visible > 1 ? ' textes' : ' texte');
  });
}

function statusLabel(work) {
  if (work.publication_status === 'published') return ['Publié', 'status-published'];
  if (work.publication_status === 'rejected') return ['À retravailler', 'status-rejected'];
  if (work.publication_status === 'archived') return ['Archivé', 'status-archived'];
  if (work.submission_requested_at) return ['En attente de relecture', 'status-pending'];
  return ['Brouillon', 'status-draft'];
}

async function loadMyVideos() {
  if (!supabase || !state.user) { state.myVideos = []; return; }
  const { data, error } = await supabase.from('plume_videos').select('id,title,description,video_url,category,created_at,updated_at').eq('author_id', state.user.id).order('updated_at', { ascending: false }).limit(60);
  if (error) { console.warn('Vidéos Plume', error.message); toast('Impossible de charger vos vidéos. Vérifiez que la migration plume_videos a été appliquée.', 'error'); return; }
  state.myVideos = data || [];
}

function renderVideoWorkspace() {
  const video = state.editingVideo || {};
  shell('<section class="workspace-header"><div class="container workspace-title-row"><div><div class="eyebrow"><span class="eyebrow-dot"></span> MON ATELIER</div><h1>Mes vidéos.</h1><p>Réunissez vos vidéos et partagez un lien quand vous le souhaitez.</p></div><button class="button button-outline" data-action="signout">Se déconnecter</button></div></section>' +
  '<section class="container video-workspace">' +
  '<div class="editor-panel video-editor-panel" ${state.showCreateForm || video.id ? "" : "hidden"}><div class="panel-top"><div><span class="eyebrow">' + (video.id ? 'MODIFIER UNE VIDÉO' : 'NOUVELLE VIDÉO') + '</span><h2>' + (video.id ? 'Modifier ma vidéo' : 'Ajouter une vidéo') + '</h2></div><span class="editor-icon">▶</span></div>' +
  '<form id="video-form" class="editor-form"><input type="hidden" name="id" value="' + e(video.id || '') + '">' +
  '<label>Titre<input name="title" required maxlength="140" placeholder="Le titre de votre vidéo…" value="' + e(video.title || '') + '"></label>' +
  '<label>Lien de la vidéo<input name="video_url" type="url" required maxlength="1000" placeholder="https://…" value="' + e(video.video_url || '') + '"></label>' +
  '<label>Catégorie<select name="category"><option ' + ((video.category || 'Création') === 'Création' ? 'selected' : '') + '>Création</option><option ' + (video.category === 'Lecture' ? 'selected' : '') + '>Lecture</option><option ' + (video.category === 'Tutoriel' ? 'selected' : '') + '>Tutoriel</option><option ' + (video.category === 'Autre' ? 'selected' : '') + '>Autre</option></select></label>' +
  '<label>Description <span class="optional">facultatif</span><textarea name="description" rows="3" maxlength="1200" placeholder="Quelques mots sur cette vidéo…">' + e(video.description || '') + '</textarea></label>' +
  '<div class="editor-actions"><button class="button button-primary" type="submit">Enregistrer la vidéo ↗</button><button class="button button-outline" type="button" data-video-cancel>Annuler</button></div><p class="editor-hint">Collez un lien YouTube, Vimeo ou un autre lien vidéo. Les fichiers R2 existants ne sont pas modifiés.</p></form></div>' +
  '<section class="my-works-panel video-list-panel"><div class="panel-top"><div><span class="eyebrow">VOTRE COLLECTION</span><h2>Mes vidéos <span class="count-pill">' + state.myVideos.length + '</span></h2></div><button class="button button-primary" data-action="new-video">Nouvelle vidéo +</button></div>' +
  (state.myVideos.length ? '<div class="my-work-list">' + state.myVideos.map((item) => '<article class="my-work-item"><div class="my-work-symbol">▶</div><div class="my-work-copy"><h3>' + e(item.title) + '</h3><p>' + e(item.category || 'Création') + ' · ' + e(formatDate(item.updated_at || item.created_at)) + '</p><a href="' + e(item.video_url) + '" target="_blank" rel="noopener noreferrer">Ouvrir la vidéo ↗</a></div><button class="icon-button" data-edit-video="' + e(item.id) + '" aria-label="Modifier ' + e(item.title) + '">✎</button></article>').join('') + '</div>' : '<div class="empty-state empty-works"><span>▶</span><h3>Votre collection commence ici.</h3><p>Ajoutez un titre et un lien pour retrouver vos vidéos dans votre espace personnel.</p></div>') + '</section></section>');
}



const EDITOR_DOCUMENT_PREFIX = '__AURORE_PLUME_PAGES_V1__';
function editorRecoveryKey(workId) { return 'aurore-plume-editor-recovery:' + String(workId || 'new'); }
function saveEditorRecovery() {
  try {
    if (!state.editing?.id || !state.editorPages?.length) return;
    localStorage.setItem(editorRecoveryKey(state.editing.id), JSON.stringify({ savedAt: Date.now(), serverUpdatedAt: state.editing.updated_at || null, pageIndex: state.editorPageIndex, renderWidth: Number(state.editorRenderWidth) || 0, pages: state.editorPages }));
  } catch (error) { console.warn('Récupération locale indisponible', error); }
}
function clearEditorRecovery(workId) {
  try { if (workId) localStorage.removeItem(editorRecoveryKey(workId)); } catch {}
}
function parseEditorPages(body = '', work = null) {
  const raw = String(body || '');
  let parsedPages = null;
  if (raw.startsWith(EDITOR_DOCUMENT_PREFIX)) {
    try {
      const saved = JSON.parse(raw.slice(EDITOR_DOCUMENT_PREFIX.length));
      const pages = Array.isArray(saved) ? saved : saved.pages;
      const savedRenderWidth = Number(Array.isArray(saved) ? 0 : saved.renderWidth);
      if (savedRenderWidth >= 120 && savedRenderWidth <= 2400) state.editorRenderWidth = Math.round(savedRenderWidth);
      state.editorPageIndex = Math.max(0, Math.min(Number(saved.currentPageIndex || 0), Math.max(0, (pages || []).length - 1)));
      if (Array.isArray(pages) && pages.length) parsedPages = normalizeEditorPages(pages);
    } catch {}
  }
  if (work?.id) {
    try {
      const recovery = JSON.parse(localStorage.getItem(editorRecoveryKey(work.id)) || 'null');
      const serverTime = work.updated_at ? new Date(work.updated_at).getTime() : 0;
      const sameServerVersion = recovery?.serverUpdatedAt ? recovery.serverUpdatedAt === (work.updated_at || null) : !parsedPages;
      if (recovery?.pages?.length && sameServerVersion && Number(recovery.savedAt) > serverTime) {
        const recoveredRenderWidth = Number(recovery.renderWidth);
        if (recoveredRenderWidth >= 120 && recoveredRenderWidth <= 2400) state.editorRenderWidth = Math.round(recoveredRenderWidth);
        state.editorPageIndex = Math.max(0, Math.min(Number(recovery.pageIndex || 0), recovery.pages.length - 1));
        toast('Une progression locale plus récente a été restaurée.', 'success');
        return normalizeEditorPages(recovery.pages);
      }
    } catch {}
  }
  if (parsedPages) return parsedPages;
  state.editorPageIndex = 0;
  return [{ blocks: raw ? [{ id: 'text-' + Date.now(), type: 'text', x: 9, y: 10, w: 82, h: 34, text: raw, font: 'Georgia', size: 18, color: '#302a35', align: 'left', bold: false, italic: false, editorialFont: true, editorialSize: true, editorialLineHeight: true }] : [] }];
}
function editorPagesToBody() {
  const paper = document.querySelector('#plume-editor-canvas');
  const visibleWidth = Math.round(paper?.getBoundingClientRect().width || 0);
  if (visibleWidth >= 120 && visibleWidth <= 2400) state.editorRenderWidth = visibleWidth;
  const renderWidth = Math.max(120, Math.min(2400, Math.round(Number(state.editorRenderWidth) || 560)));
  return EDITOR_DOCUMENT_PREFIX + JSON.stringify({
    currentPageIndex: state.editorPageIndex,
    renderWidth,
    pages: state.editorPages.length ? state.editorPages : [{ blocks: [] }]
  });
}
function recordEditorHistory() {
  if (!state.editorPages) return;
  const snapshot = JSON.stringify({ pages: state.editorPages, pageIndex: state.editorPageIndex });
  const history = state.editorHistory || [];
  if (history[state.editorHistoryIndex] === snapshot) return;
  state.editorHistory = history.slice(0, state.editorHistoryIndex + 1);
  state.editorHistory.push(snapshot);
  if (state.editorHistory.length > 80) state.editorHistory.shift();
  state.editorHistoryIndex = state.editorHistory.length - 1;
  const undo = document.querySelector('[data-editor-undo]'), redo = document.querySelector('[data-editor-redo]');
  if (undo) undo.disabled = state.editorHistoryIndex <= 0;
  if (redo) redo.disabled = state.editorHistoryIndex >= state.editorHistory.length - 1;
}
function travelEditorHistory(direction) {
  const next = state.editorHistoryIndex + direction;
  if (next < 0 || next >= state.editorHistory.length) return;
  state.editorHistoryIndex = next;
  const saved = JSON.parse(state.editorHistory[next]);
  state.editorPages = saved.pages || [{ blocks: [] }]; state.editorPageIndex = Math.max(0, Math.min(saved.pageIndex || 0, state.editorPages.length - 1)); state.editorSelectedBlock = null;
  updateEditorCanvas(); syncEditorCanvas();
  const undo = document.querySelector('[data-editor-undo]'), redo = document.querySelector('[data-editor-redo]');
  if (undo) undo.disabled = state.editorHistoryIndex <= 0;
  if (redo) redo.disabled = state.editorHistoryIndex >= state.editorHistory.length - 1;
}
async function hydrateR2Images(root) {
  if (!root || !state.user) return;
  const images = [...root.querySelectorAll('img[src^="r2:"]')];
  await Promise.all(images.map(async (img) => {
    const key = img.getAttribute('src')?.slice(3);
    if (!key || img.dataset.r2Loading === '1' || img.dataset.r2Loaded === '1') return;
    img.dataset.r2Loading = '1';
    try {
      const response = await r2Request('/api/storage?key=' + encodeURIComponent(key));
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Le fichier stocké n’est pas une image.');
      const objectUrl = URL.createObjectURL(blob);
      img.onload = () => { img.dataset.r2Loaded = '1'; img.dataset.r2Loading = ''; };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); img.dataset.r2Loading = ''; };
      img.src = objectUrl;
    } catch (error) {
      img.dataset.r2Loading = '';
      console.warn('Image du manuscrit non chargée', error.message);
    }
  }));
}
function editorCanvasMarkup(pageOverride = null, settingsOverride = null) {
  const page = pageOverride || state.editorPages[state.editorPageIndex] || { blocks: [] };
  const settings = settingsOverride || editorialSettingsFromForm();
  const pageCover = page.coverImage ? '<img class="plume-page-cover-image" src="'+e(page.coverImage)+'" alt="Image de couverture de la page">' : '';
  return pageCover + page.blocks.map((b) => {
    const useEditorialFont = b.type === 'text' && b.editorialFont !== false;
    const useEditorialSize = b.type === 'text' && b.editorialSize !== false;
    const useEditorialLeading = b.type === 'text' && b.editorialLineHeight !== false;
    const fontFamily = useEditorialFont ? settings.body_font : (b.font || settings.body_font);
    const fontSize = b.latex ? Number(b.size || 9) * 96 / 72 : (useEditorialSize ? Number(settings.font_size) * 96 / 72 : Number(b.size || 18));
    const leading = useEditorialLeading ? Number(settings.line_height) : 1.35;
    const rotation = Math.max(-180, Math.min(180, Number(b.rotation ?? 0) || 0));
    const style = 'left:'+Number(b.x??9)+'%;top:'+Number(b.y??10)+'%;width:'+Number(b.w??82)+'%;height:'+Number(b.h??24)+'%;color:'+e(b.color||'#000000')+';font-family:'+e(fontFamily)+';font-size:'+fontSize+'px;line-height:'+leading+';text-align:'+e(b.align||'left')+';font-weight:'+(b.bold?'700':'400')+' ;font-style:'+(b.italic?'italic':'normal')+';opacity:'+Math.max(0.1,Math.min(1,Number(b.opacity??100)/100))+';--plume-block-rotation:'+rotation+'deg;transform:rotate('+rotation+'deg);transform-origin:center center;'+(b.fill?'background-color:'+e(b.fill)+';':'');
    const selected = b.id === state.editorSelectedBlock ? ' is-selected' : '';
    const rotationLabel = Math.round(rotation) + '°';
    const handles = '<button type="button" class="plume-block-move" aria-label="Déplacer le bloc" title="Déplacer" ></button><button type="button" class="plume-block-actions-toggle" data-block-menu-toggle aria-expanded="false" aria-label="Options de l’élément" title="Rotation ou suppression">⋮</button><div class="plume-block-actions-menu" hidden role="group" aria-label="Options de l’élément"><strong>Options de l’élément</strong><label class="plume-block-rotation-label">Rotation <output data-rotation-output>'+rotationLabel+'</output></label><div class="plume-block-rotation-controls"><button type="button" data-rotate-delta="-15" aria-label="Tourner de 15 degrés vers la gauche" title="−15°">↶</button><input type="range" min="-180" max="180" step="5" value="'+rotation+'" data-block-rotation aria-label="Angle de rotation"><button type="button" data-rotate-delta="15" aria-label="Tourner de 15 degrés vers la droite" title="+15°">↷</button></div><button type="button" class="plume-block-rotation-reset" data-rotate-reset>Réinitialiser la rotation</button><button type="button" class="plume-block-delete-action" data-delete-block="'+e(b.id)+'">Supprimer l’élément</button></div>'+['nw','n','ne','e','se','s','sw','w'].map((dir)=>'<button type="button" class="plume-block-resize resize-'+dir+'" data-resize-dir="'+dir+'" aria-label="Redimensionner"></button>').join('');
    if (b.type === 'image') return '<div class="plume-canvas-block plume-canvas-image'+selected+'" data-block-id="'+e(b.id)+'" style="'+style+';border-radius:'+Math.max(0,Number(b.radius??16))+'px;overflow:visible"><img alt="Image ajoutée" src="'+e(b.src||'')+'" style="border-radius:'+Math.max(0,Number(b.radius??16))+'px">'+handles+'</div>';
    if (b.type === 'shape') return '<div class="plume-canvas-block plume-canvas-shape shape-'+e(b.shape||'round')+selected+'" data-block-id="'+e(b.id)+'" style="'+style+';border-radius:'+Math.max(0,Number(b.radius??16))+'px"><div class="plume-shape-text" contenteditable="true" spellcheck="true" data-block-text="'+e(b.id)+'">'+e(b.label||'')+'</div>'+handles+'</div>';
    if (b.latex) return '<div class="plume-canvas-block plume-canvas-text plume-canvas-latex'+selected+'" data-block-id="'+e(b.id)+'" style="'+style+'"><div class="plume-latex-render" data-latex-render>'+'\\['+e(b.text||'')+'\\]'+'</div>'+handles+'</div>';
    return '<div class="plume-canvas-block plume-canvas-text'+selected+'" data-block-id="'+e(b.id)+'" style="'+style+'"><div class="plume-canvas-text-content" contenteditable="true" spellcheck="true" data-block-text="'+e(b.id)+'">'+e(b.text||'').replace(/\n/g,'<br>')+'</div>'+handles+'</div>';
  }).join('');
}
function updateEditorCanvas() {
  const canvas=document.querySelector('#plume-editor-canvas'); if(canvas) {
    const settings=editorialSettingsFromForm();
    const page=state.editorPages[state.editorPageIndex]||{};
    const pageRotated=Number(page.rotation||0)%180!==0;
    const portraitRatio=settings.page_format==='A4'?'210 / 297':settings.page_format==='Letter'?'8.5 / 11':'148 / 210';
    const landscapeRatio=settings.page_format==='A4'?'297 / 210':settings.page_format==='Letter'?'11 / 8.5':'210 / 148';
    canvas.style.aspectRatio=pageRotated?landscapeRatio:portraitRatio;
    canvas.classList.toggle('plume-page-landscape',pageRotated);
    canvas.style.backgroundColor=page.background||'#ffffff';
    const pageColor=page.background||'#ffffff';
    const customPageColor=document.querySelector('#editor-page-color-custom');
    if(customPageColor&&/^#[0-9a-f]{6}$/i.test(pageColor))customPageColor.value=pageColor;
    document.querySelectorAll('[data-page-color]').forEach((swatch)=>{const active=swatch.dataset.pageColor.toLowerCase()===pageColor.toLowerCase();swatch.setAttribute('aria-pressed',String(active));swatch.classList.toggle('is-selected',active);});
    const measuredWidth=Math.round(canvas.getBoundingClientRect().width||0);
    if(measuredWidth>=120&&measuredWidth<=2400)state.editorRenderWidth=measuredWidth;
    canvas.innerHTML=editorCanvasMarkup();
    const pageTools=document.createElement('div');
    pageTools.className='plume-page-context';
    pageTools.innerHTML='<button type="button" class="plume-page-menu-toggle" data-page-menu-toggle aria-label="Options de la page" aria-expanded="false">⋮</button><div class="plume-page-menu" data-page-menu hidden><button type="button" data-page-rotate>↻ Rotation / orientation</button><button type="button" data-page-import>▧ Importer une image</button><button type="button" data-page-cover>★ Définir comme couverture</button><button type="button" data-page-delete>Supprimer la page</button></div>';
    canvas.appendChild(pageTools);
    canvas.setAttribute('aria-label','Page '+(state.editorPageIndex+1)+', toucher pour sélectionner');
    applyEditorUiPreferences();
    if(canvas.querySelector('[data-latex-render]')){void ensureMathJax().then(async(math)=>{const nodes=[...canvas.querySelectorAll('[data-latex-render]')];await math.typesetPromise(nodes);fitLatexMath(canvas);}).catch((error)=>console.warn('Rendu LaTeX indisponible',error.message));}
    void hydrateR2Images(canvas);
  }
  const thumbs=document.querySelector('#plume-page-thumbnails');
  if(thumbs) thumbs.innerHTML=state.editorPages.map((page,index)=>'<button type="button" class="plume-page-thumb'+(index===state.editorPageIndex?' is-current':'')+'" data-select-page="'+index+'" aria-label="Ouvrir la page '+(index+1)+'"><span class="plume-page-thumb-preview">'+(page.blocks||[]).slice(0,5).map((block)=>'<i class="thumb-block thumb-'+e(block.type||'text')+'"></i>').join('')+'</span><b>Page '+(index+1)+'</b><small>'+((page.blocks||[]).length)+' élément'+((page.blocks||[]).length===1?'':'s')+'</small></button>').join('');
  const selectedPageNumber=document.getElementById('editor-selected-page-number'); if(selectedPageNumber) selectedPageNumber.textContent=String(state.editorPageIndex+1);
  const count=document.getElementById('editor-page-count'); if(count&&state.editorTab==='manuscript') count.textContent=String(state.editorPageIndex+1).padStart(2,'0')+' / '+String(state.editorPages.length).padStart(2,'0');
  const prev=document.querySelector('[data-editor-page-prev]'); const next=document.querySelector('[data-editor-page-next]');
  if(prev&&state.editorTab==='manuscript') prev.disabled=state.editorPageIndex===0;

  enhanceEditorialWorkspace();
}
function syncEditorCanvas() {
  const field=document.querySelector('#work-form [name="body"]'); if(field) field.value=editorPagesToBody();
  updateEditorPreviews(); const label=document.querySelector('#editor-save-label'); if(label) label.textContent='Modifications à enregistrer';
}
function findFreeLatexPosition(page) {
  const x = 9, w = 82, h = 18, gap = 1.5;
  const occupied = (page.blocks || []).map((block) => ({
    x: Number(block.x ?? 10), y: Number(block.y ?? 10),
    w: Number(block.w ?? 78), h: Number(block.h ?? 24)
  }));
  for (let y = 7; y <= 78; y += 2.5) {
    const collision = occupied.some((box) =>
      x < box.x + box.w + gap &&
      x + w + gap > box.x &&
      y < box.y + box.h + gap &&
      y + h + gap > box.y
    );
    if (!collision) return { x, y, w, h };
  }
  return null;
}
function addEditorBlock(type, shape='round') {
  if(!state.editorPages.length) state.editorPages=[{blocks:[]}];
  let page=state.editorPages[state.editorPageIndex]||(state.editorPages[state.editorPageIndex]={blocks:[]});
  const id='block-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
  let latexPosition = null;
  if (type === 'latex') {
    latexPosition = findFreeLatexPosition(page);
    if (!latexPosition) {
      // Ne jamais poser une formule sur le texte existant : ouvrir une page dédiée.
      state.editorPages.push({ blocks: [] });
      state.editorPageIndex = state.editorPages.length - 1;
      page = state.editorPages[state.editorPageIndex];
      latexPosition = { x: 9, y: 8, w: 82, h: 18 };
      toast('La page était trop occupée : une nouvelle page a été créée pour placer la formule sans chevauchement.');
    }
  }
  const nextY=Math.min(84,12+(page.blocks.length%7)*8);
  const shapePresets={
    round:{label:'Votre texte',x:12,y:nextY,w:45,h:15,color:'#5d4776',fill:'#eee6f7',radius:14},
    circle:{label:'',x:15,y:nextY,w:18,h:12,color:'#46654d',fill:'#e2ece4',radius:999},
    square:{label:'Votre texte',x:12,y:nextY,w:45,h:15,color:'#745b37',fill:'#f4eadb',radius:5},
    line:{label:'',x:10,y:nextY,w:80,h:1,color:'#88709f',radius:0},
    'dotted-line':{label:'',x:10,y:nextY,w:80,h:1,color:'#88709f',radius:0},
    'double-line':{label:'',x:10,y:nextY,w:80,h:2,color:'#88709f',radius:0},
    quote:{label:'« Votre citation ici »',x:12,y:nextY,w:66,h:16,color:'#66543e',fill:'#f7f2e9',radius:12},
    label:{label:'REPÈRE',x:12,y:nextY,w:29,h:9,color:'#8b5264',fill:'#f7e8ec',radius:7},
    pill:{label:'NOTE',x:12,y:nextY,w:30,h:9,color:'#5d4776',fill:'#e8def3',radius:999},
    banner:{label:'TITRE DE SECTION',x:10,y:nextY,w:78,h:12,color:'#765b3c',fill:'#f2e7d8',radius:7},
    ribbon:{label:'SECTION',x:12,y:nextY,w:58,h:12,color:'#624b7e',fill:'#ece4f6',radius:3},
    badge:{label:'✦',x:15,y:nextY,w:18,h:12,color:'#4e7758',fill:'#e1eee4',radius:999},
    diamond:{label:'✦',x:15,y:nextY,w:18,h:12,color:'#975f70',fill:'#f6e3e7',radius:2},
    triangle:{label:'▲',x:15,y:nextY,w:18,h:12,color:'#67527f',fill:'#eee6f7',radius:0},
    heart:{label:'♡',x:15,y:nextY,w:18,h:12,color:'#a54e68',fill:'#f8e5ec',radius:0},
    arrow:{label:'➜',x:12,y:nextY,w:35,h:10,color:'#5d4776',fill:'#eee6f7',radius:0},
    'arrow-left':{label:'←',x:12,y:nextY,w:35,h:10,color:'#5d4776',fill:'#eee6f7',radius:0},
    star:{label:'✦',x:15,y:nextY,w:18,h:12,color:'#8a6b2f',fill:'#f8efcf',radius:0},
    sparkle:{label:'✧',x:15,y:nextY,w:18,h:12,color:'#80639e',fill:'#f0eafb',radius:0},
    flower:{label:'✿',x:15,y:nextY,w:18,h:12,color:'#7d557e',fill:'#f5e7f2',radius:0},
    sunburst:{label:'✺',x:15,y:nextY,w:18,h:12,color:'#916b36',fill:'#fbefd9',radius:0},
    wave:{label:'〰',x:12,y:nextY,w:60,h:8,color:'#88709f',fill:'transparent',radius:0},
    frame:{label:'Votre texte',x:12,y:nextY,w:55,h:19,color:'#6f5a87',fill:'transparent',radius:6},
    callout:{label:'À retenir : votre note ici.',x:10,y:nextY,w:78,h:15,color:'#47623b',fill:'#edf5e7',radius:12},
    number:{label:'01',x:15,y:nextY,w:18,h:12,color:'#5d4776',fill:'#eee6f7',radius:999},
    highlight:{label:'Votre phrase à retenir',x:10,y:nextY,w:78,h:10,color:'#514323',fill:'#fff0a8',radius:3},
    underline:{label:'Votre titre',x:12,y:nextY,w:52,h:9,color:'#5d4776',fill:'transparent',radius:0},
    'vertical-line':{label:'',x:12,y:nextY,w:2,h:28,color:'#88709f',fill:'#88709f',radius:0},
    bookmark:{label:'★',x:15,y:nextY,w:18,h:17,color:'#fff',fill:'#80639e',radius:3},
    'check-list':{label:'✓',x:15,y:nextY,w:13,h:10,color:'#426849',fill:'#e2efe4',radius:999},
    bullet:{label:'•',x:15,y:nextY,w:12,h:10,color:'#67527f',fill:'transparent',radius:0},
    'page-number':{label:'03',x:82,y:90,w:10,h:7,color:'#756984',fill:'transparent',radius:0},
    brackets:{label:'[ Votre texte ]',x:12,y:nextY,w:50,h:13,color:'#67527f',fill:'transparent',radius:0},
    cross:{label:'✣',x:15,y:nextY,w:18,h:12,color:'#7d557e',fill:'#f5e7f2',radius:0},
    plus:{label:'＋',x:15,y:nextY,w:14,h:10,color:'#80639e',fill:'transparent',radius:0},
    corner:{label:'',x:12,y:nextY,w:24,h:18,color:'#88709f',fill:'transparent',radius:0},
    'dot-row':{label:'•••',x:30,y:nextY,w:40,h:8,color:'#88709f',fill:'transparent',radius:0}
  };
  const preset=shapePresets[shape]||{label:'Votre élément',x:12,y:nextY,w:42,h:14,color:'#67527f',fill:'#eee6f7',radius:16};
  const block=type==='shape'
    ? {id,type,shape,...preset}
    : {id,type:'text',latex:type==='latex',x:latexPosition?.x ?? 10,y:latexPosition?.y ?? 12+(page.blocks.length%5)*7,w:latexPosition?.w ?? 78,h:latexPosition?.h ?? 24,text:type==='latex'?String(shape||'\\frac{a}{b}'):'',font:'Georgia',size:type==='latex'?9:18,color:'#302a35',align:type==='latex'?'center':'left',bold:false,italic:false,editorialFont:type!=='latex',editorialSize:type!=='latex',editorialLineHeight:type!=='latex'};
  page.blocks.push(block); state.editorSelectedBlock=id; updateEditorCanvas(); syncEditorCanvas(); recordEditorHistory(); saveEditorRecovery();
  if(type==='text') document.querySelector('[data-block-text="'+id+'"]')?.focus();
}
function navigateCanvasPage(direction) {
  if(!state.editorPages.length) state.editorPages=[{blocks:[]}];
  const next=state.editorPageIndex+direction; if(next<0)return;
  if(next>=state.editorPages.length) state.editorPages.push({blocks:[]});
  state.editorPageIndex=next; state.editorSelectedBlock=null; updateEditorCanvas(); syncEditorCanvas(); recordEditorHistory(); saveEditorRecovery();
}

const DEFAULT_EDITORIAL_SETTINGS = { page_format: 'A5', body_font: 'Georgia', font_size: 12, line_height: 1.7, margins: 'standard' };
function editorialSettingsFromForm(form = document.querySelector('#work-form')) {
  const value = (name) => form?.querySelector('[name="' + name + '"]')?.value;
  const settings = { ...DEFAULT_EDITORIAL_SETTINGS };
  if (!form) return settings;
  settings.page_format = ['A5', 'A4', 'Letter'].includes(value('page_format')) ? value('page_format') : settings.page_format;
  settings.body_font = ['Georgia', 'Arial', 'Times New Roman', 'system-ui'].includes(value('body_font')) ? value('body_font') : settings.body_font;
  settings.font_size = [10, 11, 12, 13, 14].includes(Number(value('font_size'))) ? Number(value('font_size')) : settings.font_size;
  settings.line_height = [1.4, 1.6, 1.7, 1.9].includes(Number(value('line_height'))) ? Number(value('line_height')) : settings.line_height;
  settings.margins = ['narrow', 'standard', 'wide'].includes(value('margins')) ? value('margins') : settings.margins;
  return settings;
}
function normalizeEditorPages(pages) {
  return (Array.isArray(pages) ? pages : []).map((page) => ({
    // La couleur de fond appartient à la page et doit survivre au chargement,
    // à l'historique, à la récupération locale et à l'export PDF.
    background: /^#[0-9a-f]{6}$/i.test(String(page?.background || '')) ? String(page.background) : '#ffffff',
    rotation: Number(page?.rotation)===90 ? 90 : 0,
    isCover: page?.isCover===true,
    coverImage: typeof page?.coverImage === 'string' && page.coverImage.startsWith('data:image/') ? page.coverImage : '',
    blocks: (Array.isArray(page?.blocks) ? page.blocks : []).map((block) => {
      const normalized = { ...block };
      if (normalized.type === 'text') {
        if (typeof normalized.editorialFont !== 'boolean') normalized.editorialFont = !normalized.font || normalized.font === 'Georgia';
        if (typeof normalized.editorialSize !== 'boolean') normalized.editorialSize = !normalized.size || Number(normalized.size) === 18;
        if (typeof normalized.editorialLineHeight !== 'boolean') normalized.editorialLineHeight = true;
      }
      return normalized;
    })
  }));
}

function manuscriptPreviewHtml(value = '', editorialSettings = {}) {
  const settings = { ...DEFAULT_EDITORIAL_SETTINGS, ...(editorialSettings && typeof editorialSettings === 'object' ? editorialSettings : {}) };
  const raw = String(value || '');
  if (raw.startsWith(EDITOR_DOCUMENT_PREFIX)) {
    try {
      const saved = JSON.parse(raw.slice(EDITOR_DOCUMENT_PREFIX.length));
      const pages = Array.isArray(saved) ? saved : saved.pages;
      const pageRatio = settings.page_format === 'A4' ? '210 / 297' : settings.page_format === 'Letter' ? '8.5 / 11' : '148 / 210';
      return normalizeEditorPages(pages).map((page) => '<section class="plume-rendered-page" style="aspect-ratio:'+pageRatio+';min-height:auto;">' + page.blocks.map((b) => {
        const useEditorialFont = b.type === 'text' && b.editorialFont !== false;
        const useEditorialSize = b.type === 'text' && b.editorialSize !== false;
        const useEditorialLeading = b.type === 'text' && b.editorialLineHeight !== false;
        const fontFamily = useEditorialFont ? settings.body_font : (b.font || settings.body_font);
        const fontSize = b.latex ? Number(b.size || 9) * 96 / 72 : (useEditorialSize ? Number(settings.font_size) * 96 / 72 : Number(b.size || 18));
        const leading = useEditorialLeading ? Number(settings.line_height) : 1.35;
        const rotation = Math.max(-180,Math.min(180,Number(b.rotation??0)||0));
        const style = 'left:'+Number(b.x??9)+'%;top:'+Number(b.y??10)+'%;width:'+Number(b.w??82)+'%;height:'+Number(b.h??24)+'%;color:'+e(b.color||'#302a35')+';font-family:'+e(fontFamily)+';font-size:'+fontSize+'px;line-height:'+leading+';text-align:'+e(b.align||'left')+';font-weight:'+(b.bold?'700':'400')+';font-style:'+(b.italic?'italic':'normal')+';opacity:'+Math.max(0.1,Math.min(1,Number(b.opacity??100)/100))+';transform:rotate('+rotation+'deg);transform-origin:center center;'+(b.fill?'background-color:'+e(b.fill)+';':'');
        if (b.type === 'image') return '<div class="plume-rendered-block plume-rendered-image" style="'+style+'border-radius:'+Math.max(0,Number(b.radius??16))+'px;overflow:hidden"><img alt="" src="'+e(b.src||'')+'" style="border-radius:'+Math.max(0,Number(b.radius??16))+'px"></div>';
        if (b.type === 'shape') return '<div class="plume-rendered-block plume-rendered-shape shape-'+e(b.shape||'round')+'" style="'+style+'border-radius:'+Math.max(0,Number(b.radius??16))+'px">'+e(b.label||'')+'</div>';
        return '<div class="plume-rendered-block" style="'+style+'">'+e(b.text||'').replace(/\n/g,'<br>')+'</div>';
      }).join('') + '</section>').join('');
    } catch { return '<p class="preview-empty">Impossible de lire la mise en page de cette œuvre.</p>'; }
  }
  return raw.split(/\n\s*\n/).map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (/^---+$/.test(trimmed)) return '<hr class="manuscript-divider">';
    if (trimmed.startsWith('### ')) return '<h3>' + e(trimmed.slice(4)) + '</h3>';
    if (trimmed.startsWith('## ')) return '<h2>' + e(trimmed.slice(3)) + '</h2>';
    if (trimmed.split('\n').every((line) => line.startsWith('> '))) return '<blockquote>' + trimmed.split('\n').map((line) => e(line.slice(2))).join('<br>') + '</blockquote>';
    const safe = e(trimmed).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
    return '<p>' + safe.replace(/\n/g, '<br>') + '</p>';
  }).join('');
}

function activateEditorTab(tab) {
  const allowed = ['cover', 'manuscript', 'layout', 'preview'];
  state.editorTab = allowed.includes(tab) ? tab : 'cover';
  document.querySelectorAll('.editor-commandbar [data-editor-tool].is-active').forEach((button) => button.classList.remove('is-active'));
  document.querySelectorAll('[data-editor-tab]').forEach((button) => {
    const active = button.dataset.editorTab === state.editorTab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.editor-tab-panel').forEach((panel) => {
    panel.hidden = panel.id !== 'editor-panel-' + state.editorTab;
  });
  if (state.editorTab === 'manuscript') {
    const paper = document.querySelector('#plume-editor-canvas');
    const measuredWidth = Math.round(paper?.getBoundingClientRect().width || 0);
    if (measuredWidth >= 120 && measuredWidth <= 2400) state.editorRenderWidth = measuredWidth;
  }
  const pageOrder = ['cover', 'manuscript', 'layout', 'preview'];
  const pageIndex = pageOrder.indexOf(state.editorTab);
  const pageCount = document.getElementById('editor-page-count');
  if (pageCount) pageCount.textContent = state.editorTab === 'manuscript' ? String(state.editorPageIndex + 1).padStart(2, '0') + ' / ' + String(state.editorPages.length).padStart(2, '0') : String(pageIndex + 1).padStart(2, '0') + ' / ' + String(pageOrder.length).padStart(2, '0');
  const previous = document.querySelector('[data-editor-page-prev]');
  const next = document.querySelector('[data-editor-page-next]');
  if (previous) previous.disabled = pageIndex <= 0;
  if (next) next.disabled = pageIndex >= pageOrder.length - 1;
  updateEditorPreviews();
}

function navigateEditorPage(direction) {
  const pages = ['cover', 'manuscript', 'layout', 'preview'];
  const index = pages.indexOf(state.editorTab);
  const next = Math.max(0, Math.min(pages.length - 1, index + direction));
  activateEditorTab(pages[next]);
  document.querySelector('.editor-tabs .is-active')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function updateEditorPreviews() {
  const form = document.querySelector('#work-form');
  if (!form) return;
  const value = (name, fallback = '') => String(form.querySelector('[name="' + name + '"]')?.value ?? fallback);
  const title = value('title').trim() || 'Titre de votre œuvre';
  const subtitle = value('subtitle').trim();
  const genre = value('genre', 'Texte libre');
  const body = value('body');
  const summary = value('summary').trim();
  const settings = editorialSettingsFromForm(form);
  const paperTitle = document.getElementById('editor-paper-title');
  if (paperTitle) paperTitle.textContent = title;
  ['editor-cover-title', 'editor-print-cover-title', 'editor-preview-title'].forEach((id) => {
    const node = document.getElementById(id);
    if (node) node.textContent = title;
  });
  ['editor-cover-subtitle', 'editor-print-cover-subtitle', 'editor-preview-subtitle'].forEach((id) => {
    const node = document.getElementById(id);
    if (node) { node.textContent = subtitle; node.hidden = !subtitle; }
  });
  ['editor-cover-genre', 'editor-print-cover-genre'].forEach((id) => {
    const node = document.getElementById(id);
    if (node) node.textContent = genre;
  });
  const previewBody = document.getElementById('editor-preview-body');
  if (previewBody) { previewBody.innerHTML = manuscriptPreviewHtml(body, settings) || '<p class="preview-empty">Votre manuscrit apparaîtra ici au fur et à mesure de l’écriture.</p>'; void hydrateR2Images(previewBody); }
  const previewSummary = document.getElementById('editor-preview-summary');
  if (previewSummary) { previewSummary.textContent = summary; previewSummary.hidden = !summary; }
  const counter = document.getElementById('word-count');
  if (counter) counter.textContent = words(body);
  const paperCounter = document.getElementById('editor-paper-word-count');
  if (paperCounter) paperCounter.textContent = words(body) + ' mots';
  const paper = document.getElementById('editor-preview-paper');
  if (paper) {
    paper.style.setProperty('--preview-font', settings.body_font);
    paper.style.setProperty('--preview-size', settings.font_size + 'pt');
    paper.style.setProperty('--preview-leading', settings.line_height);
    paper.dataset.format = settings.page_format;
    paper.dataset.margins = settings.margins;
    paper.style.aspectRatio = settings.page_format === 'A4' ? '210 / 297' : settings.page_format === 'Letter' ? '8.5 / 11' : '148 / 210';
    paper.style.minHeight = 'auto';
  }
  const printStyle = document.getElementById('editor-print-page-style');
  if (printStyle) {
    const format = settings.page_format === 'A4' ? 'A4' : settings.page_format === 'Letter' ? 'Letter' : 'A5';
    const margin = settings.margins === 'narrow' ? '12mm' : settings.margins === 'wide' ? '25mm' : '18mm';
    printStyle.textContent = '@page { size: ' + format + ' portrait; margin: ' + margin + '; }';
  }
}

function insertEditorToken(kind) {
  const field = document.querySelector('#work-form [name="body"]');
  if (!field) return;
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  const selected = field.value.slice(start, end);
  const tokens = {
    bold: ['**', '**', 'texte en gras'],
    italic: ['*', '*', 'texte en italique'],
    heading: ['### ', '', 'Titre de section'],
    quote: ['> ', '', 'Citation'],
    chapter: ['', '', 'Chapitre I\n\n'],
    divider: ['', '', '\n\n---\n\n']
  };
  const token = tokens[kind];
  if (!token) return;
  const content = selected || token[2];
  const insertion = (kind === 'chapter' || kind === 'divider') ? token[2] : token[0] + content + token[1];
  field.setRangeText(insertion, start, end, 'select');
  field.focus();
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

async function loadEditorCoverPreview(key) {
  if (!key) return;
  try {
    const response = await r2Request('/api/storage?key=' + encodeURIComponent(key));
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return;
    if (state.editorCoverPreview) URL.revokeObjectURL(state.editorCoverPreview);
    state.editorCoverPreview = URL.createObjectURL(blob);
    ['editor-cover-image', 'editor-print-cover-image'].forEach((id) => {
      const img = document.getElementById(id);
      if (img) { img.src = state.editorCoverPreview; img.hidden = false; }
    });
    document.querySelectorAll('.editor-cover-placeholder').forEach((node) => { node.hidden = true; });
  } catch (error) {
    console.warn('Couverture Plume non chargée', error.message);
  }
}

function renderTextEditor() {
  const work = state.editing || {};
  let cachedSettings = {};
  try { cachedSettings = JSON.parse(localStorage.getItem('aurore-plume-editor-settings:' + String(state.user?.id || 'local') + ':' + String(work.id || 'new')) || '{}'); } catch {}
  const settings = { ...DEFAULT_EDITORIAL_SETTINGS, ...(work.editorial_settings && typeof work.editorial_settings === 'object' ? work.editorial_settings : {}), ...cachedSettings };
  const coverKey = work.cover_media_key || '';
  shell(`
    <section class="text-editor-shell">
      <div class="text-editor-top">
        <button type="button" class="editor-exit-button" data-editor-back aria-label="Retour à la page simple" title="Retour à la page simple"><span aria-hidden="true">←</span><span class="editor-exit-label">Page simple</span></button>
        <div class="text-editor-heading">
          <h1 class="editor-document-title">${e(work.title || 'Sans titre')}</h1>
          <span class="editor-save-state"><span class="save-state-dot"></span><span id="editor-save-label">Brouillon privé</span></span>
        </div>
      </div>
      <div class="editor-commandbar" aria-label="Outils de l’atelier">
        <div class="editor-command-group">
          <button type="button" class="editor-command" data-editor-tool="text"><span aria-hidden="true">T</span><b>Zone de texte</b></button><button type="button" class="editor-command" data-editor-tool="latex"><span aria-hidden="true">∑</span><b>LaTeX</b></button>
          <button type="button" class="editor-command" data-editor-tool="elements"><span aria-hidden="true">◇</span><b>Éléments</b></button>
          <button type="button" class="editor-command" data-editor-tool="images"><span aria-hidden="true">▧</span><b>Images</b></button>
          <button type="button" class="editor-command" data-editor-tool="page"><span aria-hidden="true">▤</span><b>Page</b></button><button type="button" class="editor-command editor-cover-shortcut" data-editor-tab="cover"><span aria-hidden="true">▧</span><b>Couverture</b></button>
        </div>
        <div class="editor-history-nav" aria-label="Historique des modifications"><button type="button" data-editor-undo disabled aria-label="Annuler la modification" title="Annuler">↶</button><button type="button" data-editor-redo disabled aria-label="Rétablir la modification" title="Rétablir">↷</button></div>
        <div class="editor-page-nav">
          <button type="button" data-editor-page-prev ${state.editorTab === 'cover' ? 'disabled' : ''} aria-label="Étape précédente">←</button>
          <span id="editor-page-count">01 / 04</span>
          <button type="button" data-editor-page-next aria-label="Étape suivante">→</button>
        </div>
      </div>
      <form id="work-form" class="dedicated-work-form" method="post" action="/">
        <input type="hidden" name="id" value="${e(work.id || '')}">
        <input type="hidden" name="existing_cover_media_key" value="${e(coverKey)}">
        <section class="editor-tab-panel manuscript-panel" id="editor-panel-manuscript" role="tabpanel" ${state.editorTab === 'manuscript' ? '' : 'hidden'}>
          <div class="editor-panel-intro"><div><span class="eyebrow">VOTRE ŒUVRE</span><h2>Tout commence par les mots.</h2><p>Choisissez le type d’œuvre, puis écrivez à votre rythme. Vous pourrez revenir sur ces réglages à tout moment.</p></div><div class="word-count-box"><span class="word-count-number" id="word-count">${words(work.body || '')}</span><span>mots</span></div></div>
          <div class="editor-meta-grid">
            <label>Titre de l’œuvre<input name="title" maxlength="140" placeholder="Le titre qui vous ressemble…" value="${e(work.title || '')}"></label>
            <label>Sous-titre <span class="optional">facultatif</span><input name="subtitle" maxlength="180" placeholder="Une précision, une intention…" value="${e(work.subtitle || '')}"></label>
            <label>Type d’œuvre<select name="genre">
              ${['Texte libre','Roman','Nouvelle','Poésie','Recueil de poésie','Conte','Théâtre','Essai','Récit personnel','Carnet'].map((genre) => `<option value="${e(genre)}" ${(work.genre || 'Texte libre') === genre ? 'selected' : ''}>${e(genre)}</option>`).join('')}
            </select></label>
            <label class="editor-summary-field">Description <span class="optional">facultatif</span><textarea name="summary" maxlength="1200" rows="2" placeholder="Quelle idée traverse cette œuvre ?">${e(work.summary || '')}</textarea></label>
          </div>
          <div class="manuscript-tools">
            <div><span class="eyebrow">OUTILS D’ÉCRITURE</span><p>Ajoutez des titres, citations et séparateurs à votre manuscrit.</p></div>
            <div class="editor-tool-list"><button type="button" class="editor-tool" data-insert-token="bold"><b>B</b> Gras</button><button type="button" class="editor-tool" data-insert-token="italic"><i>I</i> Italique</button><button type="button" class="editor-tool" data-insert-token="heading">Titre</button><button type="button" class="editor-tool" data-insert-token="quote">Citation</button><button type="button" class="editor-tool" data-insert-token="chapter">Chapitre</button><button type="button" class="editor-tool" data-insert-token="divider">Séparateur</button></div>
          </div>
          <div class="editor-paper-desk">
            <div class="editor-paper-ruler"><span>MANUSCRIT · PAGE DE TRAVAIL</span><span>MODIFIABLE</span></div>
            <div class="editor-paper-sheet">
              <div class="editor-paper-sheet-top"><span>AURORE PLUME</span><span id="editor-paper-title">${e(work.title || 'Titre de votre œuvre')}</span></div>
              <input type="file" id="plume-image-file" accept="image/*" hidden><textarea name="body" class="plume-document-store" hidden>${e(work.body || '')}</textarea><div class="plume-editor-workspace"><div class="plume-canvas-desk"><div class="plume-canvas-paper" id="plume-editor-canvas" aria-label="Page éditable" style="background-color:${e((state.editorPages[state.editorPageIndex]||{}).background||"#ffffff")}">${editorCanvasMarkup()}</div><div class="plume-page-thumbnails" id="plume-page-thumbnails" aria-label="Miniatures des pages"></div><div class="plume-color-popover" id="plume-color-popover" hidden><strong id="plume-palette-title" hidden>Couleur de l’élément</strong><div class="plume-palette-scroll" aria-label="Palette de couleurs" hidden><button type="button" class="plume-palette-close" data-close-editor-palette aria-label="Fermer la palette">× Fermer</button></div><input type="color" id="plume-custom-color" value="#000000" aria-label="Couleur personnalisée" hidden></div></div><section class="plume-elements-page" id="plume-elements-page" hidden aria-label="Catalogue d’éléments">
  <div class="plume-elements-library-shell">
    <header class="plume-elements-page-top">
      <div class="plume-elements-identity">
        <span class="plume-elements-mark" aria-hidden="true">a.</span>
        <div class="plume-elements-heading-spacer" aria-hidden="true"></div>
      </div>
      <button type="button" class="plume-elements-back" data-elements-close><span aria-hidden="true">↗</span> Revenir à l’édition</button>
    </header>
    <div class="plume-elements-explorer">
      <label class="plume-elements-search"><span aria-hidden="true">⌕</span><input id="plume-element-search" type="search" placeholder="Rechercher une forme, un séparateur, une citation…" autocomplete="off" aria-label="Rechercher dans les éléments"><kbd>⌘ K</kbd></label>
      <div class="plume-elements-results"><span id="plume-element-results-count" aria-live="polite">37 éléments à explorer</span><span>Choisissez · Insérez · Personnalisez</span></div>
      <nav class="plume-elements-filters" aria-label="Catégories d’éléments">
        <button type="button" data-element-filter="all" aria-pressed="true">Tout <span data-filter-count>37</span></button>
        <button type="button" data-element-filter="forms" aria-pressed="false">Formes <span data-filter-count>0</span></button>
        <button type="button" data-element-filter="layout" aria-pressed="false">Mise en page <span data-filter-count>0</span></button>
        <button type="button" data-element-filter="separators" aria-pressed="false">Séparateurs <span data-filter-count>0</span></button>
        <button type="button" data-element-filter="ornaments" aria-pressed="false">Ornements <span data-filter-count>0</span></button>
      </nav>
    </div>
    <div class="plume-elements-grid">
      <button type="button" data-add-shape="round" data-element-category="forms"><span class="shape-preview round">Aa</span><span class="element-card-copy"><b>Bloc arrondi</b><small>Fond doux pour un texte</small><em>FORME</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="square" data-element-category="forms"><span class="shape-preview square">Aa</span><span class="element-card-copy"><b>Rectangle</b><small>Encadré classique</small><em>FORME</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="circle" data-element-category="forms"><span class="shape-preview circle"></span><span class="element-card-copy"><b>Cercle</b><small>Accent circulaire</small><em>FORME</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="triangle" data-element-category="forms"><span class="shape-preview triangle">▲</span><span class="element-card-copy"><b>Triangle</b><small>Repère géométrique</small><em>FORME</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="diamond" data-element-category="forms"><span class="shape-preview diamond">✦</span><span class="element-card-copy"><b>Losange</b><small>Accent graphique</small><em>FORME</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="heart" data-element-category="ornaments"><span class="shape-preview heart">♡</span><span class="element-card-copy"><b>Cœur</b><small>Une touche sensible</small><em>ORNEMENT</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="quote" data-element-category="layout"><span class="shape-preview quote">“</span><span class="element-card-copy"><b>Citation</b><small>Faire respirer une phrase</small><em>MISE EN PAGE</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="callout" data-element-category="layout"><span class="shape-preview callout">À retenir</span><span class="element-card-copy"><b>Note importante</b><small>Mettre une idée en avant</small><em>MISE EN PAGE</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="frame" data-element-category="layout"><span class="shape-preview frame">Votre texte</span><span class="element-card-copy"><b>Cadre fin</b><small>Créer une zone de lecture</small><em>MISE EN PAGE</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="banner" data-element-category="layout"><span class="shape-preview banner">TITRE</span><span class="element-card-copy"><b>Bandeau</b><small>Ouvrir une nouvelle section</small><em>MISE EN PAGE</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="ribbon" data-element-category="layout"><span class="shape-preview ribbon">SECTION</span><span class="element-card-copy"><b>Ruban</b><small>Baliser un chapitre</small><em>MISE EN PAGE</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="label" data-element-category="layout"><span class="shape-preview label">REPÈRE</span><span class="element-card-copy"><b>Étiquette</b><small>Ajouter un petit libellé</small><em>MISE EN PAGE</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="pill" data-element-category="layout"><span class="shape-preview pill">NOTE</span><span class="element-card-copy"><b>Pilule</b><small>Petit badge arrondi</small><em>MISE EN PAGE</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="number" data-element-category="layout"><span class="shape-preview number">01</span><span class="element-card-copy"><b>Numéro de section</b><small>Structurer son texte</small><em>MISE EN PAGE</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="line" data-element-category="separators"><span class="shape-preview line"></span><span class="element-card-copy"><b>Trait simple</b><small>Séparation discrète</small><em>SÉPARATEUR</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="dotted-line" data-element-category="separators"><span class="shape-preview dotted-line"></span><span class="element-card-copy"><b>Pointillés</b><small>Rythmer une page</small><em>SÉPARATEUR</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="double-line" data-element-category="separators"><span class="shape-preview double-line"></span><span class="element-card-copy"><b>Double ligne</b><small>Un séparateur éditorial</small><em>SÉPARATEUR</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="wave" data-element-category="separators"><span class="shape-preview wave">〰</span><span class="element-card-copy"><b>Onde</b><small>Transition légère</small><em>SÉPARATEUR</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="arrow" data-element-category="forms"><span class="shape-preview arrow">➜</span><span class="element-card-copy"><b>Flèche</b><small>Indiquer une direction</small><em>FORME</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="arrow-left" data-element-category="forms"><span class="shape-preview arrow-left">←</span><span class="element-card-copy"><b>Flèche retour</b><small>Pointer vers la gauche</small><em>FORME</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="star" data-element-category="ornaments"><span class="shape-preview star">✦</span><span class="element-card-copy"><b>Étoile</b><small>Mettre en lumière</small><em>ORNEMENT</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="sparkle" data-element-category="ornaments"><span class="shape-preview sparkle">✧</span><span class="element-card-copy"><b>Étincelle</b><small>Un accent délicat</small><em>ORNEMENT</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="flower" data-element-category="ornaments"><span class="shape-preview flower">✿</span><span class="element-card-copy"><b>Fleur</b><small>Ornement littéraire</small><em>ORNEMENT</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="sunburst" data-element-category="ornaments"><span class="shape-preview sunburst">✺</span><span class="element-card-copy"><b>Rosace</b><small>Petit motif rayonnant</small><em>ORNEMENT</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="badge" data-element-category="ornaments"><span class="shape-preview badge">✦</span><span class="element-card-copy"><b>Médaillon</b><small>Un point d’attention</small><em>ORNEMENT</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="highlight" data-element-category="layout"><span class="shape-preview highlight">Texte</span><span class="element-card-copy"><b>Surlignage</b><small>Faire ressortir une phrase</small><em>MISE EN PAGE</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="underline" data-element-category="separators"><span class="shape-preview underline">Ligne</span><span class="element-card-copy"><b>Soulignement</b><small>Souligner un titre ou un mot</small><em>SÉPARATEUR</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="vertical-line" data-element-category="separators"><span class="shape-preview vertical-line"></span><span class="element-card-copy"><b>Trait vertical</b><small>Structurer deux zones</small><em>SÉPARATEUR</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="bookmark" data-element-category="layout"><span class="shape-preview bookmark">★</span><span class="element-card-copy"><b>Signet</b><small>Marquer un passage important</small><em>MISE EN PAGE</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="check-list" data-element-category="layout"><span class="shape-preview check-list">✓</span><span class="element-card-copy"><b>Repère validé</b><small>Mettre en avant une étape</small><em>MISE EN PAGE</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="bullet" data-element-category="layout"><span class="shape-preview bullet">•</span><span class="element-card-copy"><b>Puces décoratives</b><small>Introduire une idée ou une liste</small><em>MISE EN PAGE</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="page-number" data-element-category="layout"><span class="shape-preview page-number">03</span><span class="element-card-copy"><b>Numéro de page</b><small>Repère discret de pagination</small><em>MISE EN PAGE</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="brackets" data-element-category="forms"><span class="shape-preview brackets">[ ]</span><span class="element-card-copy"><b>Crochets</b><small>Encadrer un détail</small><em>FORME</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="cross" data-element-category="ornaments"><span class="shape-preview cross">✣</span><span class="element-card-copy"><b>Rosace croisée</b><small>Petit ornement géométrique</small><em>ORNEMENT</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="plus" data-element-category="ornaments"><span class="shape-preview plus">＋</span><span class="element-card-copy"><b>Plus graphique</b><small>Ajouter un accent visuel</small><em>ORNEMENT</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="corner" data-element-category="forms"><span class="shape-preview corner">⌜</span><span class="element-card-copy"><b>Angle de cadre</b><small>Créer un repère minimaliste</small><em>FORME</em></span><span class="element-card-add">＋</span></button>
      <button type="button" data-add-shape="dot-row" data-element-category="separators"><span class="shape-preview dot-row">•••</span><span class="element-card-copy"><b>Rangée de points</b><small>Transition typographique</small><em>SÉPARATEUR</em></span><span class="element-card-add">＋</span></button>
    </div>
    <div class="plume-elements-empty" id="plume-elements-empty" hidden><span>⌕</span><b>Aucun élément trouvé</b><small>Essayez un autre mot ou une autre catégorie.</small></div>
    <footer class="plume-elements-library-footer"><span>✳ Chaque élément reste modifiable après insertion.</span><button type="button" data-elements-close>Retourner à ma page <span aria-hidden="true">↗</span></button></footer>
  </div>
</section></div>
              <div class="editor-paper-footer"><span>Une phrase après l’autre.</span><span id="editor-paper-word-count">${words(work.body || '')} mots</span></div>
            </div>
          </div>
          <p class="editor-hint"><span>✳</span> Votre texte reste privé. Les modifications sont conservées lorsque vous enregistrez le brouillon.</p>
        </section>
        <section id="plume-latex-editor" class="plume-latex-editor" hidden aria-label="Éditeur LaTeX"><div class="plume-latex-card"><header><h2>Écrire en LaTeX</h2><button type="button" data-latex-close aria-label="Fermer">×</button></header><p>Saisis ou colle ta formule. Vérifie l’aperçu, puis insère-la dans la page.</p><div class="plume-latex-input-meta"><label class="plume-latex-input-label" for="plume-latex-source">Code LaTeX brut</label><span id="plume-latex-count" aria-live="polite">0 / 3 000 caractères</span></div><textarea id="plume-latex-source" spellcheck="false" maxlength="3000" aria-describedby="plume-latex-help plume-latex-status" placeholder="Ex. : \\frac{a}{b}"></textarea><div class="plume-latex-editor-tools"><button type="button" class="plume-latex-keyboard" data-latex-keyboard>∑ Ouvrir le clavier scientifique</button><span class="plume-latex-keyboard-note">Le clavier insère les symboles au curseur. Vous pouvez toujours écrire ou coller le LaTeX brut.</span></div><p id="plume-latex-help">3 000 caractères maximum par formule. Pour un long calcul, répartis les étapes.</p><div class="plume-latex-preview"><small>Aperçu mathématique</small><div id="plume-latex-preview-text" aria-live="polite"></div><p id="plume-latex-status" role="status">Saisis une expression pour voir l’aperçu.</p></div><div class="plume-latex-actions"><button type="button" class="plume-latex-cancel" data-latex-close>Annuler</button><button type="button" data-latex-apply>Valider et insérer</button></div></div></section><section class="editor-tab-panel cover-panel" id="editor-panel-cover" role="tabpanel" ${state.editorTab === 'cover' ? '' : 'hidden'}>
          <div class="cover-editor-grid">
            <div class="editor-cover-preview-stage" id="editor-cover-preview-stage">
              <div class="editor-cover-placeholder"><span>a.</span><small>AURORE PLUME · ${e(work.genre || 'Texte libre')}</small><h2 id="editor-cover-title">${e(work.title || 'Titre de votre œuvre')}</h2><p id="editor-cover-subtitle" ${work.subtitle ? '' : 'hidden'}>${e(work.subtitle || '')}</p><i>✳</i></div>
              <img class="editor-cover-image" id="editor-cover-image" alt="Aperçu de la couverture importée" ${coverKey ? '' : 'hidden'}><label class="cover-upload-button editor-cover-select-image">▧ <span>Choisir une nouvelle image de couverture</span><input id="editor-cover-image-file" type="file" accept="image/*"></label>
              <div class="editor-cover-overlay"><span id="editor-cover-genre">${e(work.genre || 'Texte libre')}</span><h3>${e(state.user?.user_metadata?.display_name || state.user?.email?.split('@')[0] || 'Auteur')}</h3></div>
            </div>
            <div class="cover-editor-controls"><label class="cover-upload-button">▧ <span>Importer une couverture</span><input id="editor-cover-file" name="cover_file" type="file" accept="image/*"></label></div>
          </div>
        </section>
        <section class="editor-tab-panel layout-panel" id="editor-panel-layout" role="tabpanel" ${state.editorTab === 'layout' ? '' : 'hidden'}>
          <div class="editor-panel-intro"><div><span class="eyebrow">PRÉPARATION DU LIVRE</span><h2>Une page qui vous ressemble.</h2><p>Ces réglages sont enregistrés avec votre œuvre et utilisés dans l’aperçu avant impression PDF.</p></div></div><section class="editor-page-color-card editor-page-actions-card"><h3>Page sélectionnée</h3><p>Page <span id="editor-selected-page-number">${state.editorPageIndex + 1}</span> sur ${state.editorPages.length || 1}. Vous pouvez importer une image ou supprimer cette page.</p><div class="editor-page-actions"><label class="button button-outline editor-page-cover-upload">▧ Importer une image pour cette page<input type="file" id="editor-page-cover-file" accept="image/*" hidden></label><button type="button" class="button button-outline editor-page-delete-button" data-editor-delete-page>Supprimer la page sélectionnée</button></div><small>L’image conserve ses proportions et ses détails : elle est ajustée à la feuille sans zoom ni recadrage forcé. Taille maximale : 5 Mo.</small></section><section class="editor-page-color-card"><h3>Couleur de la page sélectionnée</h3><p>Sélectionne une page dans les miniatures, puis choisis sa couleur de fond.</p><div class="editor-page-color-swatches"><button type="button" data-page-color="#ffffff" style="--page-swatch:#ffffff" aria-label="Blanc"></button><button type="button" data-page-color="#fff3df" style="--page-swatch:#fff3df" aria-label="Crème"></button><button type="button" data-page-color="#f7e8ee" style="--page-swatch:#f7e8ee" aria-label="Rose"></button><button type="button" data-page-color="#e9f2ff" style="--page-swatch:#e9f2ff" aria-label="Bleu"></button><button type="button" data-page-color="#e9f5e9" style="--page-swatch:#e9f5e9" aria-label="Vert"></button><button type="button" data-page-color="#eee7f7" style="--page-swatch:#eee7f7" aria-label="Lavande"></button><button type="button" data-page-color="#272433" style="--page-swatch:#272433" aria-label="Charbon"></button><label class="editor-page-custom-color">Personnalisée <input type="color" id="editor-page-color-custom" value="#ffffff" aria-label="Couleur personnalisée"></label></div></section>
          <div class="editor-layout-grid">
            <label>Format de page<select name="page_format"><option value="A5" ${settings.page_format === 'A5' ? 'selected' : ''}>A5 — livre</option><option value="A4" ${settings.page_format === 'A4' ? 'selected' : ''}>A4 — document</option><option value="Letter" ${settings.page_format === 'Letter' ? 'selected' : ''}>Letter</option></select></label>
            <label>Police du corps<select name="body_font"><option value="Georgia" ${settings.body_font === 'Georgia' ? 'selected' : ''}>Georgia — littéraire</option><option value="Arial" ${settings.body_font === 'Arial' ? 'selected' : ''}>Arial — moderne</option><option value="Times New Roman" ${settings.body_font === 'Times New Roman' ? 'selected' : ''}>Times New Roman — classique</option><option value="system-ui" ${settings.body_font === 'system-ui' ? 'selected' : ''}>Sans sérif — système</option></select></label>
            <label>Taille du texte<select name="font_size"><option value="10" ${Number(settings.font_size) === 10 ? 'selected' : ''}>10 pt</option><option value="11" ${Number(settings.font_size) === 11 ? 'selected' : ''}>11 pt</option><option value="12" ${Number(settings.font_size) === 12 ? 'selected' : ''}>12 pt</option><option value="13" ${Number(settings.font_size) === 13 ? 'selected' : ''}>13 pt</option><option value="14" ${Number(settings.font_size) === 14 ? 'selected' : ''}>14 pt</option></select></label>
            <label>Interligne<select name="line_height"><option value="1.4" ${Number(settings.line_height) === 1.4 ? 'selected' : ''}>Compact</option><option value="1.6" ${Number(settings.line_height) === 1.6 ? 'selected' : ''}>Équilibré</option><option value="1.7" ${Number(settings.line_height) === 1.7 ? 'selected' : ''}>Aéré</option><option value="1.9" ${Number(settings.line_height) === 1.9 ? 'selected' : ''}>Très aéré</option></select></label>
            <label>Marges<select name="margins"><option value="narrow" ${settings.margins === 'narrow' ? 'selected' : ''}>Étroites</option><option value="standard" ${settings.margins === 'standard' ? 'selected' : ''}>Standard</option><option value="wide" ${settings.margins === 'wide' ? 'selected' : ''}>Confortables</option></select></label>
          </div>
          <div class="editor-layout-note"><span>✳</span><div><strong>Une œuvre, une mise en page cohérente.</strong><p>Les réglages s’appliqueront à l’aperçu imprimable. Le manuscrit enregistré conserve son contenu d’origine.</p></div></div>
        </section>
        <section class="editor-tab-panel preview-panel" id="editor-panel-preview" role="tabpanel" ${state.editorTab === 'preview' ? '' : 'hidden'}>
          <div class="editor-panel-intro"><div><span class="eyebrow">VÉRIFICATION FINALE</span><h2>Votre œuvre prend forme.</h2><p>Vérifiez la couverture et la typographie avant de lancer l’impression ou l’enregistrement en PDF.</p></div><div class="editor-preview-actions"><button class="button button-outline" type="button" data-editor-return-edit>← Retour à l’édition</button><button class="button button-outline" type="button" data-editor-print>Imprimer / PDF ↗</button></div></div>
          <div class="editor-preview-spread">
            <div class="editor-print-cover" id="editor-print-cover">
              <div class="editor-cover-preview-stage editor-print-cover-stage">
                <div class="editor-cover-placeholder"><span>a.</span><small>AURORE PLUME</small><h2 id="editor-print-cover-title">${e(work.title || 'Titre de votre œuvre')}</h2><p id="editor-print-cover-subtitle" ${work.subtitle ? '' : 'hidden'}>${e(work.subtitle || '')}</p><i>✳</i></div>
                <img id="editor-print-cover-image" alt="" ${coverKey ? '' : 'hidden'}>
                <div class="editor-cover-overlay"><span id="editor-print-cover-genre">${e(work.genre || 'Texte libre')}</span><h3>${e(state.user?.user_metadata?.display_name || state.user?.email?.split('@')[0] || 'Auteur')}</h3></div>
              </div>
            </div>
            <article class="editor-preview-paper" id="editor-preview-paper" data-format="${e(settings.page_format)}" data-margins="${e(settings.margins)}">
              <div class="editor-preview-kicker">AURORE PLUME · ${e(work.genre || 'Texte libre')}</div>
              <h1 id="editor-preview-title">${e(work.title || 'Titre de votre œuvre')}</h1><p id="editor-preview-subtitle" class="editor-preview-subtitle" ${work.subtitle ? '' : 'hidden'}>${e(work.subtitle || '')}</p><p class="editor-preview-summary" id="editor-preview-summary" ${work.summary ? '' : 'hidden'}>${e(work.summary || '')}</p><div class="editor-preview-rule"></div><div id="editor-preview-body" class="editor-preview-body">${manuscriptPreviewHtml(work.body || '') || '<p class="preview-empty">Votre manuscrit apparaîtra ici au fur et à mesure de l’écriture.</p>'}</div>
            </article>
          </div>
          <p class="editor-hint"><span>✳</span> L’aperçu est un premier rendu éditorial. Vérifiez toujours le PDF final avant de le partager ou de l’imprimer.</p>
        </section>
        <div class="plume-typography-bar" aria-label="Mise en forme du texte"><label>Police<select data-text-style="font"><option>Georgia</option><option>Arial</option><option>Times New Roman</option><option>Verdana</option><option>Courier New</option><option>Montserrat</option><option>Kalam</option></select></label><label>Taille<select data-text-style="size"><option value="12">12</option><option value="14">14</option><option value="16">16</option><option value="18" selected>18</option><option value="22">22</option><option value="28">28</option><option value="36">36</option><option value="48">48</option></select></label><button type="button" data-text-style="bold" aria-label="Gras"><b>B</b></button><button type="button" data-text-style="italic" aria-label="Italique"><i>I</i></button><div class="plume-customizer-color-wrap"><button type="button" class="plume-palette-toggle" data-open-editor-palette aria-expanded="false">Palette ▾</button><div class="plume-palette-scroll" aria-label="Palette de couleurs" hidden><button type="button" data-block-color="#1F2937" style="--swatch:#1F2937" aria-label="Couleur #1F2937" title="#1F2937"></button><button type="button" data-block-color="#374151" style="--swatch:#374151" aria-label="Couleur #374151" title="#374151"></button><button type="button" data-block-color="#6B7280" style="--swatch:#6B7280" aria-label="Couleur #6B7280" title="#6B7280"></button><button type="button" data-block-color="#9CA3AF" style="--swatch:#9CA3AF" aria-label="Couleur #9CA3AF" title="#9CA3AF"></button><button type="button" data-block-color="#D1D5DB" style="--swatch:#D1D5DB" aria-label="Couleur #D1D5DB" title="#D1D5DB"></button><button type="button" data-block-color="#F3F4F6" style="--swatch:#F3F4F6" aria-label="Couleur #F3F4F6" title="#F3F4F6"></button><button type="button" data-block-color="#FFFFFF" style="--swatch:#FFFFFF" aria-label="Couleur #FFFFFF" title="#FFFFFF"></button><button type="button" data-block-color="#000000" style="--swatch:#000000" aria-label="Couleur #000000" title="#000000"></button><button type="button" data-block-color="#7F1D1D" style="--swatch:#7F1D1D" aria-label="Couleur #7F1D1D" title="#7F1D1D"></button><button type="button" data-block-color="#B91C1C" style="--swatch:#B91C1C" aria-label="Couleur #B91C1C" title="#B91C1C"></button><button type="button" data-block-color="#DC2626" style="--swatch:#DC2626" aria-label="Couleur #DC2626" title="#DC2626"></button><button type="button" data-block-color="#EF4444" style="--swatch:#EF4444" aria-label="Couleur #EF4444" title="#EF4444"></button><button type="button" data-block-color="#F87171" style="--swatch:#F87171" aria-label="Couleur #F87171" title="#F87171"></button><button type="button" data-block-color="#FCA5A5" style="--swatch:#FCA5A5" aria-label="Couleur #FCA5A5" title="#FCA5A5"></button><button type="button" data-block-color="#FEE2E2" style="--swatch:#FEE2E2" aria-label="Couleur #FEE2E2" title="#FEE2E2"></button><button type="button" data-block-color="#FFF1F2" style="--swatch:#FFF1F2" aria-label="Couleur #FFF1F2" title="#FFF1F2"></button><button type="button" data-block-color="#7C2D12" style="--swatch:#7C2D12" aria-label="Couleur #7C2D12" title="#7C2D12"></button><button type="button" data-block-color="#C2410C" style="--swatch:#C2410C" aria-label="Couleur #C2410C" title="#C2410C"></button><button type="button" data-block-color="#EA580C" style="--swatch:#EA580C" aria-label="Couleur #EA580C" title="#EA580C"></button><button type="button" data-block-color="#F97316" style="--swatch:#F97316" aria-label="Couleur #F97316" title="#F97316"></button><button type="button" data-block-color="#FB923C" style="--swatch:#FB923C" aria-label="Couleur #FB923C" title="#FB923C"></button><button type="button" data-block-color="#FDBA74" style="--swatch:#FDBA74" aria-label="Couleur #FDBA74" title="#FDBA74"></button><button type="button" data-block-color="#FFEDD5" style="--swatch:#FFEDD5" aria-label="Couleur #FFEDD5" title="#FFEDD5"></button><button type="button" data-block-color="#FFF7ED" style="--swatch:#FFF7ED" aria-label="Couleur #FFF7ED" title="#FFF7ED"></button><button type="button" data-block-color="#78350F" style="--swatch:#78350F" aria-label="Couleur #78350F" title="#78350F"></button><button type="button" data-block-color="#B45309" style="--swatch:#B45309" aria-label="Couleur #B45309" title="#B45309"></button><button type="button" data-block-color="#D97706" style="--swatch:#D97706" aria-label="Couleur #D97706" title="#D97706"></button><button type="button" data-block-color="#F59E0B" style="--swatch:#F59E0B" aria-label="Couleur #F59E0B" title="#F59E0B"></button><button type="button" data-block-color="#FBBF24" style="--swatch:#FBBF24" aria-label="Couleur #FBBF24" title="#FBBF24"></button><button type="button" data-block-color="#FDE68A" style="--swatch:#FDE68A" aria-label="Couleur #FDE68A" title="#FDE68A"></button><button type="button" data-block-color="#FEF3C7" style="--swatch:#FEF3C7" aria-label="Couleur #FEF3C7" title="#FEF3C7"></button><button type="button" data-block-color="#FFFBEB" style="--swatch:#FFFBEB" aria-label="Couleur #FFFBEB" title="#FFFBEB"></button><button type="button" data-block-color="#365314" style="--swatch:#365314" aria-label="Couleur #365314" title="#365314"></button><button type="button" data-block-color="#4D7C0F" style="--swatch:#4D7C0F" aria-label="Couleur #4D7C0F" title="#4D7C0F"></button><button type="button" data-block-color="#65A30D" style="--swatch:#65A30D" aria-label="Couleur #65A30D" title="#65A30D"></button><button type="button" data-block-color="#84CC16" style="--swatch:#84CC16" aria-label="Couleur #84CC16" title="#84CC16"></button><button type="button" data-block-color="#A3E635" style="--swatch:#A3E635" aria-label="Couleur #A3E635" title="#A3E635"></button><button type="button" data-block-color="#BEF264" style="--swatch:#BEF264" aria-label="Couleur #BEF264" title="#BEF264"></button><button type="button" data-block-color="#ECFCCB" style="--swatch:#ECFCCB" aria-label="Couleur #ECFCCB" title="#ECFCCB"></button><button type="button" data-block-color="#F7FEE7" style="--swatch:#F7FEE7" aria-label="Couleur #F7FEE7" title="#F7FEE7"></button><button type="button" data-block-color="#14532D" style="--swatch:#14532D" aria-label="Couleur #14532D" title="#14532D"></button><button type="button" data-block-color="#15803D" style="--swatch:#15803D" aria-label="Couleur #15803D" title="#15803D"></button><button type="button" data-block-color="#16A34A" style="--swatch:#16A34A" aria-label="Couleur #16A34A" title="#16A34A"></button><button type="button" data-block-color="#22C55E" style="--swatch:#22C55E" aria-label="Couleur #22C55E" title="#22C55E"></button><button type="button" data-block-color="#4ADE80" style="--swatch:#4ADE80" aria-label="Couleur #4ADE80" title="#4ADE80"></button><button type="button" data-block-color="#86EFAC" style="--swatch:#86EFAC" aria-label="Couleur #86EFAC" title="#86EFAC"></button><button type="button" data-block-color="#DCFCE7" style="--swatch:#DCFCE7" aria-label="Couleur #DCFCE7" title="#DCFCE7"></button><button type="button" data-block-color="#F0FDF4" style="--swatch:#F0FDF4" aria-label="Couleur #F0FDF4" title="#F0FDF4"></button><button type="button" data-block-color="#134E4A" style="--swatch:#134E4A" aria-label="Couleur #134E4A" title="#134E4A"></button><button type="button" data-block-color="#0F766E" style="--swatch:#0F766E" aria-label="Couleur #0F766E" title="#0F766E"></button><button type="button" data-block-color="#0D9488" style="--swatch:#0D9488" aria-label="Couleur #0D9488" title="#0D9488"></button><button type="button" data-block-color="#14B8A6" style="--swatch:#14B8A6" aria-label="Couleur #14B8A6" title="#14B8A6"></button><button type="button" data-block-color="#2DD4BF" style="--swatch:#2DD4BF" aria-label="Couleur #2DD4BF" title="#2DD4BF"></button><button type="button" data-block-color="#5EEAD4" style="--swatch:#5EEAD4" aria-label="Couleur #5EEAD4" title="#5EEAD4"></button><button type="button" data-block-color="#CCFBF1" style="--swatch:#CCFBF1" aria-label="Couleur #CCFBF1" title="#CCFBF1"></button><button type="button" data-block-color="#F0FDFA" style="--swatch:#F0FDFA" aria-label="Couleur #F0FDFA" title="#F0FDFA"></button><button type="button" data-block-color="#164E63" style="--swatch:#164E63" aria-label="Couleur #164E63" title="#164E63"></button><button type="button" data-block-color="#0369A1" style="--swatch:#0369A1" aria-label="Couleur #0369A1" title="#0369A1"></button><button type="button" data-block-color="#0284C7" style="--swatch:#0284C7" aria-label="Couleur #0284C7" title="#0284C7"></button><button type="button" data-block-color="#0EA5E9" style="--swatch:#0EA5E9" aria-label="Couleur #0EA5E9" title="#0EA5E9"></button><button type="button" data-block-color="#38BDF8" style="--swatch:#38BDF8" aria-label="Couleur #38BDF8" title="#38BDF8"></button><button type="button" data-block-color="#7DD3FC" style="--swatch:#7DD3FC" aria-label="Couleur #7DD3FC" title="#7DD3FC"></button><button type="button" data-block-color="#E0F2FE" style="--swatch:#E0F2FE" aria-label="Couleur #E0F2FE" title="#E0F2FE"></button><button type="button" data-block-color="#F0F9FF" style="--swatch:#F0F9FF" aria-label="Couleur #F0F9FF" title="#F0F9FF"></button><button type="button" data-block-color="#1E3A8A" style="--swatch:#1E3A8A" aria-label="Couleur #1E3A8A" title="#1E3A8A"></button><button type="button" data-block-color="#1D4ED8" style="--swatch:#1D4ED8" aria-label="Couleur #1D4ED8" title="#1D4ED8"></button><button type="button" data-block-color="#2563EB" style="--swatch:#2563EB" aria-label="Couleur #2563EB" title="#2563EB"></button><button type="button" data-block-color="#3B82F6" style="--swatch:#3B82F6" aria-label="Couleur #3B82F6" title="#3B82F6"></button><button type="button" data-block-color="#60A5FA" style="--swatch:#60A5FA" aria-label="Couleur #60A5FA" title="#60A5FA"></button><button type="button" data-block-color="#93C5FD" style="--swatch:#93C5FD" aria-label="Couleur #93C5FD" title="#93C5FD"></button><button type="button" data-block-color="#DBEAFE" style="--swatch:#DBEAFE" aria-label="Couleur #DBEAFE" title="#DBEAFE"></button><button type="button" data-block-color="#EFF6FF" style="--swatch:#EFF6FF" aria-label="Couleur #EFF6FF" title="#EFF6FF"></button><button type="button" data-block-color="#312E81" style="--swatch:#312E81" aria-label="Couleur #312E81" title="#312E81"></button><button type="button" data-block-color="#4338CA" style="--swatch:#4338CA" aria-label="Couleur #4338CA" title="#4338CA"></button><button type="button" data-block-color="#6366F1" style="--swatch:#6366F1" aria-label="Couleur #6366F1" title="#6366F1"></button><button type="button" data-block-color="#818CF8" style="--swatch:#818CF8" aria-label="Couleur #818CF8" title="#818CF8"></button><button type="button" data-block-color="#A5B4FC" style="--swatch:#A5B4FC" aria-label="Couleur #A5B4FC" title="#A5B4FC"></button><button type="button" data-block-color="#C7D2FE" style="--swatch:#C7D2FE" aria-label="Couleur #C7D2FE" title="#C7D2FE"></button><button type="button" data-block-color="#E0E7FF" style="--swatch:#E0E7FF" aria-label="Couleur #E0E7FF" title="#E0E7FF"></button><button type="button" data-block-color="#EEF2FF" style="--swatch:#EEF2FF" aria-label="Couleur #EEF2FF" title="#EEF2FF"></button><button type="button" data-block-color="#581C87" style="--swatch:#581C87" aria-label="Couleur #581C87" title="#581C87"></button><button type="button" data-block-color="#7E22CE" style="--swatch:#7E22CE" aria-label="Couleur #7E22CE" title="#7E22CE"></button><button type="button" data-block-color="#9333EA" style="--swatch:#9333EA" aria-label="Couleur #9333EA" title="#9333EA"></button><button type="button" data-block-color="#A855F7" style="--swatch:#A855F7" aria-label="Couleur #A855F7" title="#A855F7"></button><button type="button" data-block-color="#C084FC" style="--swatch:#C084FC" aria-label="Couleur #C084FC" title="#C084FC"></button><button type="button" data-block-color="#D8B4FE" style="--swatch:#D8B4FE" aria-label="Couleur #D8B4FE" title="#D8B4FE"></button><button type="button" data-block-color="#F3E8FF" style="--swatch:#F3E8FF" aria-label="Couleur #F3E8FF" title="#F3E8FF"></button><button type="button" data-block-color="#FAF5FF" style="--swatch:#FAF5FF" aria-label="Couleur #FAF5FF" title="#FAF5FF"></button><button type="button" data-block-color="#701A75" style="--swatch:#701A75" aria-label="Couleur #701A75" title="#701A75"></button><button type="button" data-block-color="#A21CAF" style="--swatch:#A21CAF" aria-label="Couleur #A21CAF" title="#A21CAF"></button><button type="button" data-block-color="#C026D3" style="--swatch:#C026D3" aria-label="Couleur #C026D3" title="#C026D3"></button><button type="button" data-block-color="#D946EF" style="--swatch:#D946EF" aria-label="Couleur #D946EF" title="#D946EF"></button><button type="button" data-block-color="#E879F9" style="--swatch:#E879F9" aria-label="Couleur #E879F9" title="#E879F9"></button><button type="button" data-block-color="#F0ABFC" style="--swatch:#F0ABFC" aria-label="Couleur #F0ABFC" title="#F0ABFC"></button><button type="button" data-block-color="#FAE8FF" style="--swatch:#FAE8FF" aria-label="Couleur #FAE8FF" title="#FAE8FF"></button><button type="button" data-block-color="#FDF4FF" style="--swatch:#FDF4FF" aria-label="Couleur #FDF4FF" title="#FDF4FF"></button><button type="button" data-block-color="#831843" style="--swatch:#831843" aria-label="Couleur #831843" title="#831843"></button><button type="button" data-block-color="#9D174D" style="--swatch:#9D174D" aria-label="Couleur #9D174D" title="#9D174D"></button><button type="button" data-block-color="#BE185D" style="--swatch:#BE185D" aria-label="Couleur #BE185D" title="#BE185D"></button><button type="button" data-block-color="#DB2777" style="--swatch:#DB2777" aria-label="Couleur #DB2777" title="#DB2777"></button><button type="button" data-block-color="#EC4899" style="--swatch:#EC4899" aria-label="Couleur #EC4899" title="#EC4899"></button><button type="button" data-block-color="#F472B6" style="--swatch:#F472B6" aria-label="Couleur #F472B6" title="#F472B6"></button><button type="button" data-block-color="#FBCFE8" style="--swatch:#FBCFE8" aria-label="Couleur #FBCFE8" title="#FBCFE8"></button><button type="button" data-block-color="#FCE7F3" style="--swatch:#FCE7F3" aria-label="Couleur #FCE7F3" title="#FCE7F3"></button><button type="button" data-block-color="#4C1D95" style="--swatch:#4C1D95" aria-label="Couleur #4C1D95" title="#4C1D95"></button><button type="button" data-block-color="#67527F" style="--swatch:#67527F" aria-label="Couleur #67527F" title="#67527F"></button><button type="button" data-block-color="#80639E" style="--swatch:#80639E" aria-label="Couleur #80639E" title="#80639E"></button><button type="button" data-block-color="#A78BFA" style="--swatch:#A78BFA" aria-label="Couleur #A78BFA" title="#A78BFA"></button><button type="button" data-block-color="#C4B5FD" style="--swatch:#C4B5FD" aria-label="Couleur #C4B5FD" title="#C4B5FD"></button><button type="button" data-block-color="#D9C7EF" style="--swatch:#D9C7EF" aria-label="Couleur #D9C7EF" title="#D9C7EF"></button><button type="button" data-block-color="#EDE9FE" style="--swatch:#EDE9FE" aria-label="Couleur #EDE9FE" title="#EDE9FE"></button><button type="button" data-block-color="#F5F3FF" style="--swatch:#F5F3FF" aria-label="Couleur #F5F3FF" title="#F5F3FF"></button><button type="button" data-block-color="#713F12" style="--swatch:#713F12" aria-label="Couleur #713F12" title="#713F12"></button><button type="button" data-block-color="#A16207" style="--swatch:#A16207" aria-label="Couleur #A16207" title="#A16207"></button><button type="button" data-block-color="#CA8A04" style="--swatch:#CA8A04" aria-label="Couleur #CA8A04" title="#CA8A04"></button><button type="button" data-block-color="#EAB308" style="--swatch:#EAB308" aria-label="Couleur #EAB308" title="#EAB308"></button><button type="button" data-block-color="#FACC15" style="--swatch:#FACC15" aria-label="Couleur #FACC15" title="#FACC15"></button><button type="button" data-block-color="#FDE047" style="--swatch:#FDE047" aria-label="Couleur #FDE047" title="#FDE047"></button><button type="button" data-block-color="#FEF9C3" style="--swatch:#FEF9C3" aria-label="Couleur #FEF9C3" title="#FEF9C3"></button><button type="button" data-block-color="#FEFCE8" style="--swatch:#FEFCE8" aria-label="Couleur #FEFCE8" title="#FEFCE8"></button><button type="button" data-block-color="#3F3F46" style="--swatch:#3F3F46" aria-label="Couleur #3F3F46" title="#3F3F46"></button><button type="button" data-block-color="#71717A" style="--swatch:#71717A" aria-label="Couleur #71717A" title="#71717A"></button><button type="button" data-block-color="#A1A1AA" style="--swatch:#A1A1AA" aria-label="Couleur #A1A1AA" title="#A1A1AA"></button><button type="button" data-block-color="#D4D4D8" style="--swatch:#D4D4D8" aria-label="Couleur #D4D4D8" title="#D4D4D8"></button><button type="button" data-block-color="#E4E4E7" style="--swatch:#E4E4E7" aria-label="Couleur #E4E4E7" title="#E4E4E7"></button><button type="button" data-block-color="#F4F4F5" style="--swatch:#F4F4F5" aria-label="Couleur #F4F4F5" title="#F4F4F5"></button><button type="button" data-block-color="#FAFAFA" style="--swatch:#FAFAFA" aria-label="Couleur #FAFAFA" title="#FAFAFA"></button><button type="button" data-block-color="#302A35" style="--swatch:#302A35" aria-label="Couleur #302A35" title="#302A35"></button></div></div><button type="button" data-text-style="align-left">☰</button><button type="button" data-text-style="align-center">≡</button><button type="button" data-text-style="align-right" aria-label="Aligner le texte à droite">☷</button><div class="plume-rounding-toolbar"><button type="button" data-editor-rounding hidden aria-expanded="false">Arrondir ▾</button><div class="plume-rounding-control" id="plume-rounding-control" hidden><label for="plume-corner-radius"><span>Arrondi des coins</span><output id="plume-corner-radius-value">16 px</output></label><input type="range" id="plume-corner-radius" min="0" max="100" step="1" value="16" aria-label="Arrondi des coins"><small>Faites glisser pour arrondir plus ou moins.</small></div></div><button type="button" data-block-action="duplicate">Dupliquer</button><button type="button" data-block-action="front">Premier plan</button><button type="button" data-block-action="back">Arrière-plan</button><button type="button" data-block-action="align-left">Objet à gauche</button><button type="button" data-block-action="align-center-x">Centrer l’objet</button><button type="button" data-block-action="align-right">Objet à droite</button><div class="plume-nudge" role="group" aria-label="Ajustement précis"><div class="plume-nudge-head"><strong class="plume-nudge-title">Déplacer</strong><button type="button" class="plume-nudge-drag-handle" aria-label="Saisir et déplacer le panneau" title="Faire glisser le panneau">⠿</button><button type="button" class="plume-nudge-toggle" data-toggle-nudge-float aria-pressed="false">Détacher</button></div><div class="plume-nudge-controls"><button type="button" data-nudge="up" aria-label="Déplacer vers le haut">↑</button><button type="button" data-nudge="left" aria-label="Déplacer vers la gauche">←</button><label><select data-nudge-step aria-label="Pas de déplacement"><option value="1">1 mm</option><option value="2">2 mm</option><option value="5">5 mm</option><option value="10">10 mm</option></select></label><button type="button" data-nudge="right" aria-label="Déplacer vers la droite">→</button><button type="button" data-nudge="down" aria-label="Déplacer vers le bas">↓</button></div></div><label class="plume-opacity-control">Opacité <input type="range" data-block-opacity min="10" max="100" step="5" value="100" aria-label="Transparence de l’élément"></label><button type="button" data-block-delete>Supprimer</button></div>
        <input type="hidden" name="publish_visibility" value="private">
        <div class="editor-actionbar">
          <button class="button button-primary" name="intent" value="draft" type="submit">Enregistrer le brouillon <span>↗</span></button>
          <button class="button button-outline" type="button" data-publish-open>Publier ↗</button>
          <button class="button button-outline" type="button" data-download-pdf>Télécharger le PDF ↓</button>
          <button class="button button-quiet editor-print-action" type="button" data-editor-print>Aperçu avant impression</button>
        </div>
      </form>
      <style id="editor-print-page-style"></style>
    </section>
  `);
  state.editorPages = parseEditorPages(work.body || '', work); state.editorPageIndex = Math.max(0, Math.min(state.editorPageIndex, state.editorPages.length - 1)); state.editorSelectedBlock = null; state.editorHistory = []; state.editorHistoryIndex = -1;
  updateEditorCanvas(); updateEditorPreviews(); recordEditorHistory();
  const pageCoverInput = document.querySelector('#editor-page-cover-file');
  pageCoverInput?.addEventListener('change', () => {
    const file = pageCoverInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Choisissez un fichier image valide.', 'error'); pageCoverInput.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { toast('L’image de page doit faire 5 Mo maximum.', 'error'); pageCoverInput.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      const page = state.editorPages[state.editorPageIndex];
      if (!page || typeof reader.result !== 'string') return;
      page.coverImage = reader.result;
      updateEditorCanvas(); syncEditorCanvas(); recordEditorHistory(); saveEditorRecovery();
      toast('Image appliquée à la page en conservant ses proportions.');
      pageCoverInput.value = '';
    };
    reader.onerror = () => toast('Impossible de lire cette image.', 'error');
    reader.readAsDataURL(file);
  });
  const workForm = document.querySelector('#work-form');
  const markEditorDirty = () => {
    updateEditorPreviews();
    const saveLabel = document.querySelector('#editor-save-label');
    if (saveLabel) saveLabel.textContent = 'Modifications à enregistrer';
  };
  workForm?.addEventListener('input', markEditorDirty);
  workForm?.addEventListener('change', (event) => {
    markEditorDirty();
    if (['page_format', 'body_font', 'font_size', 'line_height', 'margins'].includes(event.target?.name)) {
      updateEditorCanvas();
      scheduleEditorialSettingsSave();
    }
  });
  if (coverKey) loadEditorCoverPreview(coverKey);
}

function renderDraftCreate() {
  shell(`
    <section class="draft-create-screen">
      <form id="draft-create-form" class="draft-create-card">
        <button type="button" class="draft-create-close" data-draft-cancel aria-label="Annuler">×</button>
        <span class="eyebrow">NOUVELLE ŒUVRE</span>
        <h1>Créer un brouillon</h1>
        <label>Titre de l’œuvre<input name="title" maxlength="140" required placeholder="Le titre de votre œuvre"></label>
        <label>Description<textarea name="summary" maxlength="1200" rows="3" placeholder="Quelques mots pour présenter votre idée…"></textarea></label>
        <label>Type d’œuvre<select name="genre">${['Texte libre','Roman','Nouvelle','Poésie','Recueil de poésie','Conte','Théâtre','Essai','Récit personnel','Carnet'].map((genre) => `<option value="${e(genre)}">${e(genre)}</option>`).join('')}</select></label>
        <button class="button button-primary draft-create-submit" type="submit">Créer le brouillon <span>↗</span></button>
      </form>
    </section>
  `);
}

function renderAtelier() {
  if (!state.user) {
    shell(`
      <section class="workspace-guest container">
        <div class="workspace-decoration"><span class="decor-big">Aa</span><span class="decor-small">✳</span></div>
        <div class="eyebrow"><span class="eyebrow-dot"></span> VOTRE ESPACE PERSONNEL</div>
        <h1>Une page blanche.<br><em>Toutes les possibilités.</em></h1>
        <p>Connectez-vous pour conserver vos idées, développer vos textes et choisir simplement ce que vous souhaitez partager.</p>
        <div class="workspace-benefits"><span>✓ Brouillons privés</span><span>✓ Édition à tout moment</span><span>✓ Partage public ou privé</span></div>
        <button class="button button-primary button-large" data-action="auth">Créer mon espace <span>↗</span></button>
        <p class="fine-print">Pas de publication automatique. Vous restez maître de vos textes.</p>
      </section>
    `);
    return;
  }
  if (state.workspaceTab === 'videos') { renderVideoWorkspace(); return; }
  if (state.editorOpen && state.workspaceTab === 'textes') { renderTextEditor(); return; }
  if (state.showDraftCreate && state.workspaceTab === 'textes') { renderDraftCreate(); return; }
  const editing = state.editing || {};
  if (GENERIC_CREATION_KINDS.includes(state.workspaceTab)) { renderGenericCreationWorkspace(); return; }
  shell(`
    <section class="workspace-header"><div class="container workspace-title-row"><div><div class="eyebrow"><span class="eyebrow-dot"></span> MON ATELIER</div><h1>Mon atelier éditorial.</h1><p>Vos œuvres en cours, réunies dans un espace privé. Reprenez chaque manuscrit là où vous l’avez laissé.</p></div><button class="button button-outline" data-action="signout">Se déconnecter</button></div></section>
    <section class="container workspace-grid workspace-grid-single">
      <aside class="my-works-panel">
        <div class="panel-top"><div><span class="eyebrow">MON CARNET</span><h2>Brouillons privés <span class="count-pill">${state.myWorks.filter((work)=>work.publication_status!=='published'||!work.is_public).length}</span></h2></div><button class="button button-primary" data-action="new-text">Nouveau texte +</button></div>
        ${state.myWorks.filter((work)=>work.publication_status!=='published'||!work.is_public).length ? `<div class="work-grid workspace-draft-grid">${state.myWorks.filter((work)=>work.publication_status!=='published'||!work.is_public).map((work) => { const [label, cls] = statusLabel(work); const cover = ['cover-lilac','cover-sand','cover-rose'][Math.abs((work.title || '').length)%3]; return `<article class="work-card workspace-work-card draft-work-card"><div class="work-cover ${cover}"><span class="cover-mark">a.</span><span class="cover-category">${e(work.genre || 'Texte libre')}</span><span class="cover-lines" aria-hidden="true"></span></div><div class="work-card-body"><div class="card-meta"><span>${e(work.genre || 'Texte libre')}</span><span>${e(formatDate(work.updated_at || work.created_at))}</span></div><h3>${e(work.title)}</h3><p class="work-summary">${e(work.summary || 'Aucun résumé pour le moment.')}</p><div class="work-card-foot draft-work-card-foot"><span class="status-pill ${cls}">${e(label)}</span><button class="button button-quiet text-edit-button" data-edit-id="${e(work.id)}" title="Éditer cette œuvre" aria-label="Éditer ${e(work.title)}">Éditer ↗</button></div></div></article>`; }).join('')}</div>` : '<div class="empty-state empty-works"><span>✎</span><h3>Aucun brouillon privé.</h3><p>Créez un texte ou continuez une œuvre déjà commencée.</p></div>'}
        <div class="private-note"><span>♧</span><p><strong>Votre espace est privé.</strong><br>Les brouillons ne sont visibles que par vous.</p></div>
        ${supabase ? '' : '<div class="notice notice-error">La configuration de Supabase manque. Ajoutez les variables Vercel indiquées dans le README.</div>'}
      </aside>
      <aside class="my-works-panel plume-published-panel">
        <div class="panel-top"><div><span class="eyebrow">VOTRE ESPACE</span><h2>Mes publications <span class="count-pill">${state.myWorks.filter((work)=>work.publication_status==='published'&&work.is_public).length}</span></h2></div><button class="button button-quiet published-toggle" type="button" data-toggle-published aria-expanded="${state.showPublishedWorks ? 'true' : 'false'}">${state.showPublishedWorks ? 'Masquer' : 'Afficher'} ↕</button></div>
        ${state.showPublishedWorks ? (state.myWorks.some((work)=>work.publication_status==='published'&&work.is_public) ? `<div class="my-work-list plume-published-grid">${state.myWorks.filter((work)=>work.publication_status==='published'&&work.is_public).map((work)=>`<article class="my-work-item published-work-item"><div class="my-work-symbol">Aa</div><div class="my-work-copy"><h3>${e(work.title)}</h3><p class="draft-card-summary">${e(work.summary||'Votre texte publié sur Aurore Plume.')}</p><p class="draft-card-meta">${e(work.genre||'Texte libre')} · Publié le ${e(formatDate(work.published_at||work.updated_at))}</p><span class="status-pill status-published">Publié · public</span><div class="published-card-actions"><button class="button button-primary" data-read-id="${e(work.id)}">Lire ↗</button><button class="button button-quiet text-edit-button" data-edit-id="${e(work.id)}">Éditer</button></div></div></article>`).join('')}</div>` : '<div class="empty-state empty-works"><span>↗</span><h3>Aucune publication pour le moment.</h3><p>Choisissez « Publier » dans l’éditeur lorsqu’un texte est prêt.</p></div>') : '<p class="published-collapsed-note">Vos œuvres publiées sont masquées. Appuyez sur « Afficher » pour les retrouver.</p>'}
      </aside>
    </section>
  `);
  document.querySelector('[data-toggle-published]')?.addEventListener('click', () => {
    state.showPublishedWorks = !state.showPublishedWorks;
    renderAtelier();
  });
  document.querySelector('[name="body"]')?.addEventListener('input', (event) => {
    const counter = document.querySelector('#word-count');
    if (counter) counter.textContent = words(event.target.value);
  });
}



const GENERIC_CREATION_KINDS = ['arts', 'dessins', 'musique', 'numerique', 'scene'];
const GENERIC_CREATION_META = {
  arts: { label: 'Mes arts visuels', singular: 'œuvre', icon: '✳', intro: 'Rassemblez peintures, photographies, affiches et créations visuelles.', categories: ['Peinture','Photographie','Graphisme','Art numérique','Autre'] },
  dessins: { label: 'Mes dessins', singular: 'dessin', icon: '✎', intro: 'Gardez vos illustrations, croquis, bandes dessinées et personnages.', categories: ['Illustration','Croquis','Bande dessinée','Portrait','Autre'] },
  musique: { label: 'Ma musique', singular: 'création sonore', icon: '♫', intro: 'Retrouvez chansons, compositions et créations sonores.', categories: ['Chanson','Instrumental','Spoken word','Podcast','Autre'] },
  numerique: { label: 'Mes projets numériques', singular: 'projet', icon: '⌘', intro: 'Présentez vos sites, applications, jeux et expériences interactives.', categories: ['Site web','Application','Jeu','Prototype','Autre'] },
  scene: { label: 'Scène & autres', singular: 'création', icon: '✦', intro: 'Réunissez danse, théâtre, mode, artisanat et créations singulières.', categories: ['Danse','Théâtre','Mode','Artisanat','Autre'] }
};

async function loadMyCreations() {
  if (!supabase || !state.user) { state.myCreations = []; return; }
  const { data, error } = await supabase.from('plume_creations').select('id,kind,title,description,media_url,media_key,category,created_at,updated_at').eq('author_id', state.user.id).order('updated_at', { ascending: false }).limit(100);
  if (error) { console.warn('Créations Plume', error.message); toast('Impossible de charger vos créations. Vérifiez la migration plume_creations.', 'error'); return; }
  state.myCreations = data || [];
}

function renderGenericCreationWorkspace() {
  const kind = state.workspaceTab;
  const meta = GENERIC_CREATION_META[kind] || GENERIC_CREATION_META.arts;
  const editing = state.editingCreation || {};
  const items = state.myCreations.filter(item => item.kind === kind);
  const showForm = state.showCreateForm || Boolean(editing.id);
  const form = showForm ? `<div class="editor-panel generic-creation-editor"><div class="panel-top"><div><span class="eyebrow">${editing.id ? 'MODIFIER' : 'NOUVELLE CRÉATION'}</span><h2>${editing.id ? 'Modifier ma création' : 'Ajouter ' + meta.singular}</h2></div><span class="editor-icon">${meta.icon}</span></div>
    <form id="creation-form" class="editor-form"><input type="hidden" name="id" value="${e(editing.id || '')}"><input type="hidden" name="kind" value="${e(kind)}"><input type="hidden" name="existing_media_key" value="${e(editing.media_key || '')}">
      <label>Titre<input name="title" required maxlength="140" placeholder="Donnez un titre à votre création…" value="${e(editing.title || '')}"></label>
      <label>Catégorie<select name="category">${meta.categories.map(item => `<option ${(editing.category || meta.categories[0]) === item ? 'selected' : ''}>${e(item)}</option>`).join('')}</select></label>
      <label>Lien de la création <span class="optional">facultatif</span><input name="media_url" type="url" maxlength="1000" placeholder="https://…" value="${e(editing.media_url || '')}"></label><label>Ou choisir un fichier <span class="optional">10 Mo maximum</span><input name="media_file" type="file" accept="${kind === 'arts' || kind === 'dessins' ? 'image/*,.pdf' : kind === 'musique' ? 'audio/*,video/*' : kind === 'numerique' ? '.zip,.html,.pdf,image/*,video/*' : 'image/*,audio/*,video/*,.pdf'}"></label>${editing.media_key ? '<p class="editor-hint">Un fichier est déjà associé à cette création. Laissez le sélecteur vide pour le conserver.</p>' : ''}
      <label>Description <span class="optional">facultatif</span><textarea name="description" rows="4" maxlength="1800" placeholder="Présentez votre création en quelques mots…">${e(editing.description || '')}</textarea></label>
      <div class="editor-actions"><button class="button button-primary" type="submit">Enregistrer ${meta.singular} ↗</button><button class="button button-outline" type="button" data-creation-cancel>Annuler</button></div>
      <p class="editor-hint">Cette fiche privée enregistre le titre, la catégorie, la description et un lien éventuel. Pour un fichier, ajoutez un lien accessible ; le téléversement direct sera raccordé séparément à R2.</p>
    </form></div>` : '';
  shell(`<section class="workspace-header"><div class="container workspace-title-row"><div><div class="eyebrow"><span class="eyebrow-dot"></span> MON ATELIER</div><h1>${e(meta.label)}.</h1><p>${e(meta.intro)}</p></div><button class="button button-outline" data-action="signout">Se déconnecter</button></div></section>
    <section class="container generic-creation-workspace">${form}
      <section class="my-works-panel creation-list-panel"><div class="panel-top"><div><span class="eyebrow">VOTRE COLLECTION</span><h2>${e(meta.label)} <span class="count-pill">${items.length}</span></h2></div><button class="button button-primary" data-action="new-creation">Nouvelle création +</button></div>
      ${items.length ? `<div class="my-work-list">${items.map(item => `<article class="my-work-item"><div class="my-work-symbol">${meta.icon}</div><div class="my-work-copy"><h3>${e(item.title)}</h3><p>${e(item.category || meta.label)} · ${e(formatDate(item.updated_at || item.created_at))}</p>${item.media_url ? `<a href="${e(item.media_url)}" target="_blank" rel="noopener noreferrer">Ouvrir le lien ↗</a>` : ''}${item.media_key ? `<button type="button" class="text-link creation-file-open" data-creation-open="${e(item.media_key)}">Ouvrir le fichier enregistré ↗</button>` : ''}${item.description ? `<p class="creation-description">${e(item.description)}</p>` : ''}</div><button class="icon-button" data-edit-creation="${e(item.id)}" aria-label="Modifier ${e(item.title)}">✎</button></article>`).join('')}</div>` : `<div class="empty-state empty-works"><span>${meta.icon}</span><h3>Votre collection commence ici.</h3><p>Appuyez sur « Nouvelle création » pour ajouter votre première fiche.</p></div>`}
    </section></section>`);
}

const R2_STORAGE_URL = 'https://aurore-plume.oualikevin6.workers.dev';
const R2_CATEGORIES = [{"value":"manuscrits","label":"Manuscrits"},{"value":"couvertures","label":"Couvertures et images"},{"value":"documents","label":"Documents joints"},{"value":"autres","label":"Autres fichiers"}];

function renderR2StoragePanel() {
  return `<section class="container r2-storage-panel">
    <div class="side-card">
      <div class="panel-top"><div><span class="eyebrow">STOCKAGE PERSONNEL</span><h2>Mes fichiers R2</h2></div><span class="little-spark">↥</span></div>
      <p class="editor-hint">Vos fichiers restent privés et sont associés à votre compte. Taille maximale : 10 Mo par fichier.</p>
      <form id="r2-upload-form" class="editor-form">
        <label>Classer dans<select name="category">${R2_CATEGORIES.map((item) => `<option value="${item.value}">${item.label}</option>`).join('')}</select></label>
        <div class="r2-picker-block">
          <label for="r2-files-input">Sélecteur 1 — fichiers à envoyer</label>
          <button class="button button-secondary" id="r2-pick-files" type="button">Parcourir les fichiers de mon téléphone</button>
          <input id="r2-files-input" type="file" name="files" multiple aria-describedby="r2-selected-files">
          <div id="r2-selected-files" class="r2-selected-files" role="status" aria-live="polite">Aucun fichier sélectionné. Vous pouvez utiliser l’un ou l’autre des deux sélecteurs.</div>
        </div>
        <div class="r2-picker-block r2-picker-secondary">
          <label for="r2-files-input-secondary">Sélecteur 2 — solution alternative</label>
          <button class="button button-outline" id="r2-pick-files-secondary" type="button">Choisir un PDF avec le second sélecteur</button>
          <input id="r2-files-input-secondary" type="file" name="files-secondary" multiple aria-describedby="r2-selected-files-secondary">
          <div id="r2-selected-files-secondary" class="r2-selected-files" role="status" aria-live="polite">Aucun fichier sélectionné dans le second sélecteur.</div>
        </div>
        <button class="button button-primary" type="submit">Envoyer vers mon stockage ↗</button>
      </form>
      <div class="r2-message" role="status" aria-live="polite"></div>
      <section class="r2-diagnostic" aria-labelledby="r2-diagnostic-title">
        <div class="r2-diagnostic-heading"><strong id="r2-diagnostic-title">Diagnostic en temps réel</strong><button type="button" class="button button-quiet" id="r2-diagnostic-clear">Effacer</button></div>
        <p class="r2-diagnostic-intro">Les événements ci-dessous distinguent la sélection locale, l’envoi réseau et la liste des fichiers déjà enregistrés.</p>
        <ol id="r2-diagnostic-log" class="r2-diagnostic-log" aria-live="polite"><li><time>—</time> Diagnostic prêt ; attente d’une sélection.</li></ol>
      </section>
      <div class="r2-file-list" aria-live="polite"><p class="editor-hint">Chargement de la liste des fichiers déjà enregistrés…</p></div>
    </div>
  </section>`;
}

function r2Diagnostic(message, level = 'info') {
  const log = document.querySelector('#r2-diagnostic-log');
  if (!log) return;
  const item = document.createElement('li');
  item.className = 'r2-diagnostic-' + level;
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString();
  const detail = document.createElement('span');
  detail.textContent = message;
  item.append(time, detail);
  log.append(item);
  while (log.children.length > 30) log.firstElementChild?.remove();
  log.scrollTop = log.scrollHeight;
}

function renderR2FileList() {
  const container = document.querySelector('.r2-file-list');
  if (!container) return;
  if (!state.storageFiles?.length) {
    container.innerHTML = '<p class="editor-hint">Aucun fichier déjà envoyé dans le stockage. Cette liste est distincte du fichier sélectionné ci-dessus.</p>';
    return;
  }
  container.innerHTML = '<div class="r2-file-items">' + state.storageFiles.map((file) => {
    const name = file.key.split('/').pop() || file.key;
    const size = file.size < 1024 * 1024 ? Math.max(1, Math.round(file.size / 1024)) + ' Ko' : (file.size / (1024 * 1024)).toFixed(1) + ' Mo';
    return `<div class="r2-file-item"><div class="r2-file-copy"><strong>${e(name)}</strong><small>${e(file.key.split('/').slice(0, -1).join('/') || 'Autres')} · ${size}</small></div><div class="r2-file-actions"><button type="button" class="button button-outline" data-r2-download="${e(file.key)}">Ouvrir</button><button type="button" class="button button-quiet" data-r2-delete="${e(file.key)}" aria-label="Supprimer ${e(name)}">Supprimer</button></div></div>`;
  }).join('') + '</div>';
}

async function r2Request(path, options = {}) {
  if (!supabase) throw new Error('Supabase n’est pas configuré.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Connectez-vous pour accéder à vos fichiers.');
  const response = await fetch(R2_STORAGE_URL + path, {
    ...options,
    headers: { Authorization: 'Bearer ' + token, ...(options.headers || {}) }
  });
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json()).error || ''; } catch {}
    throw new Error(detail || 'Erreur du stockage (' + response.status + ').');
  }
  return response;
}

async function loadR2Files() {
  const container = document.querySelector('.r2-file-list');
  if (!container || !state.user) return;
  r2Diagnostic('Vérification de la liste des fichiers déjà enregistrés dans R2…');
  try {
    const response = await r2Request('/api/storage/list');
    const result = await response.json();
    state.storageFiles = Array.isArray(result.objects) ? result.objects : [];
    r2Diagnostic('Réponse de la liste R2 : ' + state.storageFiles.length + ' fichier(s) déjà enregistré(s).');
    renderR2FileList();
  } catch (error) {
    r2Diagnostic('Échec du chargement de la liste R2 : ' + (error?.message || 'erreur inconnue'), 'error');
    container.innerHTML = '<p class="editor-hint">Impossible de charger les fichiers : ' + e(error.message) + '</p>';
  }
}

async function uploadR2Files(form) {
  const message = form.querySelector('.r2-message') || document.querySelector('.r2-message');
  const submit = form.querySelector('button[type="submit"]');
  try {
    const data = new FormData(form);
    const files = [
      ...(form.querySelector('[name="files"]')?.files || []),
      ...(form.querySelector('[name="files-secondary"]')?.files || [])
    ];
    r2Diagnostic('Clic sur « Envoyer » : ' + files.length + ' fichier(s) trouvé(s) dans les deux sélecteurs.');
    if (message) message.textContent = 'Préparation de l’envoi…';
    if (!files.length) throw new Error('Choisissez au moins un fichier avec l’un des deux sélecteurs.');
    if (files.some((file) => file.size > 10 * 1024 * 1024)) {
      throw new Error('Chaque fichier doit faire 10 Mo maximum.');
    }
    files.forEach((file, index) => r2Diagnostic('Fichier ' + (index + 1) + ' prêt : ' + file.name + ' (' + Math.round(file.size / 1024) + ' Ko).'));
    if (submit) submit.disabled = true;
    if (message) message.textContent = 'Envoi des fichiers…';
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const safeName = file.name.normalize('NFKC').replace(/[^\\p{L}\\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '').slice(-160) || 'fichier';
      const key = String(data.get('category') || 'autres') + '/' + Date.now() + '-' + index + '-' + safeName;
      r2Diagnostic('Début de l’envoi réseau du fichier ' + (index + 1) + '/' + files.length + '…');
      await r2Request('/api/storage?key=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file
      });
      r2Diagnostic('Le serveur a accepté la requête d’envoi du fichier ' + (index + 1) + '/' + files.length + '.', 'success');
    }
    form.reset();
    document.querySelector('#r2-selected-files').textContent = 'Aucun fichier sélectionné.';
    document.querySelector('#r2-selected-files-secondary').textContent = 'Aucun fichier sélectionné dans le second sélecteur.';
    if (message) message.textContent = 'Fichier(s) envoyé(s) dans votre espace privé.';
    r2Diagnostic('Envoi terminé ; vérification de la présence des fichiers dans la liste R2…', 'success');
    await loadR2Files();
  } catch (error) {
    console.error('Aurore Plume R2 upload', error);
    r2Diagnostic('ÉCHEC : ' + (error?.message || 'erreur inconnue pendant l’envoi.'), 'error');
    if (message) message.textContent = error?.message || 'Envoi impossible.';
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function openR2File(key) {
  const response = await r2Request('/api/storage?key=' + encodeURIComponent(key));
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = key.split('/').pop() || 'fichier';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
}

async function deleteR2File(key) {
  if (!window.confirm('Supprimer définitivement ce fichier de votre stockage ?')) return;
  await r2Request('/api/storage?key=' + encodeURIComponent(key), { method: 'DELETE' });
  state.storageFiles = (state.storageFiles || []).filter((file) => file.key !== key);
  renderR2FileList();
}

function render() {
  // Android peut déclencher un rendu d'authentification pendant que le sélecteur
  // de fichiers est ouvert. Ne remplaçons pas le formulaire avant son retour.
  // Après le retour Android, conserver aussi le formulaire tant qu'un fichier
  // est sélectionné : le remplacer détruirait l'objet File avant le clic Envoyer.
  const uploadForm = document.querySelector('#r2-upload-form');
  const hasSelectedR2Files = uploadForm && [...uploadForm.querySelectorAll('input[type="file"]')]
    .some((input) => input.files?.length > 0);
  if (state.r2PickerOpen || (state.view === 'atelier' && hasSelectedR2Files)) {
    state.r2PendingRender = true;
    r2Diagnostic(state.r2PickerOpen
      ? 'Rendu de page différé : le sélecteur Android est ouvert.'
      : 'Rendu de page différé : un PDF est sélectionné et doit rester attaché au formulaire.');
    return;
  }
  if (state.view === 'atelier') renderAtelier();
  else if (state.view === 'library') renderLibrary();
  else renderDiscover();
}

async function ensureProfile(user) {
  if (!supabase || !user) return;
  const { data, error } = await supabase.from('plume_profiles').select('id').eq('id', user.id).maybeSingle();
  if (error) { console.warn('Profil Plume non chargé', error.message); return; }
  if (data) return;
  const base = (user.user_metadata?.display_name || user.email?.split('@')[0] || 'auteur').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 18) || 'auteur';
  const { error: insertError } = await supabase.from('plume_profiles').insert({
    id: user.id,
    display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Auteur',
    handle: `${base}-${user.id.slice(0, 6)}`
  });
  if (insertError && insertError.code !== '23505') console.warn('Profil Plume non créé', insertError.message);
}

async function loadPublicWorks() {
  if (!supabase) {
    state.publicWorksError = true;
    return;
  }
  const { data, error } = await supabase.from('plume_works')
    .select('id,title,subtitle,summary,genre,body,editorial_settings,created_at,published_at,author_id,plume_profiles(display_name,handle)')
    .eq('publication_status', 'published').eq('is_public', true)
    .order('published_at', { ascending: false }).limit(24);
  if (error) {
    state.publicWorksError = true;
    console.warn('Bibliothèque Plume', error.message);
    return;
  }
  state.publicWorksError = false;
  state.publicWorks = data || [];
}

async function loadMyWorks() {
  if (!supabase || !state.user) { state.myWorks = []; return; }
  const { data, error } = await supabase.from('plume_works')
    .select('id,title,subtitle,summary,genre,body,cover_media_key,editorial_settings,publication_status,is_public,submission_requested_at,created_at,updated_at')
    .eq('author_id', state.user.id).order('updated_at', { ascending: false }).limit(60);
  if (error) { console.warn('Carnet Plume', error.message); toast('Impossible de charger vos textes pour le moment.', 'error'); return; }
  state.myWorks = data || [];
}

function showAuth(mode = 'signin') {
  if (!supabase) {
    modalRoot.innerHTML = '<div class="modal-backdrop" id="auth-overlay"><section class="auth-modal"><button class="modal-close" data-action="close-modal" aria-label="Fermer">×</button><div class="auth-symbol">a.</div><h2>Encore un petit réglage.</h2><p>Les identifiants Supabase ne sont pas configurés pour cette version. Consultez le fichier README du dépôt pour terminer le raccordement.</p><button class="button button-primary full-width" data-action="close-modal">Compris</button></section></div>';
    return;
  }
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';
  const title = isSignup ? 'Faites une place à vos idées.' : isForgot ? 'Retrouvons votre accès.' : isReset ? 'Choisissez un nouveau mot de passe.' : 'Heureux de vous retrouver.';
  const intro = isSignup ? 'Créez votre espace privé et gardez le fil de vos textes.' : isForgot ? 'Nous vous enverrons un lien pour choisir un nouveau mot de passe.' : isReset ? 'Choisissez un mot de passe d’au moins 8 caractères pour retrouver votre atelier.' : 'Reconnectez-vous à votre atelier et à vos brouillons.';
  const submitLabel = isSignup ? 'Créer mon espace' : isForgot ? 'Envoyer le lien' : isReset ? 'Enregistrer le mot de passe' : 'Me connecter';
  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="auth-overlay">
      <section class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button class="modal-close" data-action="close-modal" aria-label="Fermer">×</button>
        <div class="auth-symbol">a.</div><div class="eyebrow">VOTRE ESPACE D’ÉCRITURE</div>
        <h2 id="auth-title">${e(title)}</h2>
        <p>${e(intro)}</p>
        ${isForgot || isReset ? '' : `<div class="sso-entry">
          <button class="button button-sso button-large full-width" type="button" data-action="aurore-id"><span class="sso-mark">ID</span><span class="sso-label">Continuer avec Aurore ID</span><span aria-hidden="true">↗</span></button>
          <p class="sso-subtitle">Un accès unique pour les services Aurore.</p>
          <div class="sso-divider"><span>ou avec votre compte local</span></div>
        </div>`}
        <form id="auth-form" data-mode="${e(mode)}" class="auth-form">
          ${isSignup ? '<label>Nom d’auteur<input name="display_name" autocomplete="name" maxlength="80" required placeholder="Comment vous appeler ?"></label>' : ''}
          <label>Adresse e-mail<input name="email" type="email" autocomplete="email" ${isReset ? 'disabled' : ''} required placeholder="vous@exemple.com" value="${isReset ? e(state.user?.email || '') : ''}"></label>
          ${isForgot ? '' : '<label>Mot de passe<input name="password" type="password" minlength="8" autocomplete="' + (isSignup || isReset ? 'new-password' : 'current-password') + '" required placeholder="8 caractères minimum"></label>'}
          <button class="button button-primary button-large full-width" type="submit">${e(submitLabel)} <span>↗</span></button>
          ${mode === 'signin' ? '<button class="auth-forgot" type="button" data-auth-mode="forgot">Mot de passe oublié ?</button>' : ''}
          <p class="auth-message" id="auth-message" role="status" aria-live="polite"></p>
        </form>
        <div class="auth-switch">${isSignup ? 'Vous avez déjà un espace ?' : isForgot || isReset ? 'Vous vous souvenez de votre mot de passe ?' : 'Nouveau sur Aurore Plume ?'} <button data-auth-mode="${isSignup ? 'signin' : 'signin'}">${isSignup ? 'Se connecter' : 'Retour à la connexion'}</button></div>
        ${isForgot || isReset ? '' : '<button class="sso-guest" type="button" data-action="close-modal">Visiter Aurore Plume sans compte</button>'}
        <small class="auth-privacy">Vos brouillons restent privés. Aucun texte n’est publié sans validation.</small>
      </section>
    </div>`;
  document.querySelector('#auth-overlay input:not([disabled])')?.focus();
}
async function startAuroreIdSignIn(button) {
  const message = modalRoot.querySelector('#auth-message');
  if (!supabase) {
    if (message) message.textContent = 'La connexion Aurore ID n’est pas disponible pour le moment. Réessayez plus tard.';
    return;
  }
  const label = button.querySelector('.sso-label');
  button.disabled = true;
  if (label) label.textContent = 'Redirection vers Aurore ID…';
  try {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'custom:aurore-id' });
    if (error) throw error;
  } catch (error) {
    if (message) message.textContent = error?.message || 'La connexion avec Aurore ID n’a pas abouti. Vérifiez la configuration du fournisseur.';
    button.disabled = false;
    if (label) label.textContent = 'Continuer avec Aurore ID';
  }
}


function pdfRgb(color, fallback = [48, 42, 53]) {
  const match = String(color || '').match(/^#?([0-9a-f]{6})$/i);
  if (!match) return fallback;
  const number = Number.parseInt(match[1], 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}
function pdfFontName(font) {
  const name = String(font || '').toLowerCase();
  if (name.includes('courier')) return 'courier';
  if (name.includes('georgia') || name.includes('times')) return 'times';
  return 'helvetica';
}
function pdfFontStyle(block) {
  return block.bold && block.italic ? 'bolditalic' : block.bold ? 'bold' : block.italic ? 'italic' : 'normal';
}
async function imageDataForPdf(source) {
  let blob;
  if (String(source || '').startsWith('r2:')) {
    blob = await (await r2Request('/api/storage?key=' + encodeURIComponent(String(source).slice(3)))).blob();
  } else {
    const response = await fetch(String(source || ''));
    if (!response.ok) throw new Error('Une image du manuscrit ne peut pas être chargée.');
    blob = await response.blob();
  }
  if (!blob.type.startsWith('image/')) throw new Error('Un élément image du manuscrit est invalide.');
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectUrl;
    if (image.decode) await image.decode();
    else await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, image.naturalWidth || image.width);
    canvas.height = Math.max(1, image.naturalHeight || image.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Impossible de préparer une image pour le PDF.');
    context.drawImage(image, 0, 0);
    return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
  } finally { URL.revokeObjectURL(objectUrl); }
}
function drawPdfTextBox(doc, text, block, settings, pageWidth, pageHeight, overrides = {}) {
  const x = Math.max(0, Number(block.x ?? 0) / 100 * pageWidth);
  const y = Math.max(0, Number(block.y ?? 0) / 100 * pageHeight);
  const width = Math.max(1, Math.min(pageWidth - x, Number(block.w ?? 82) / 100 * pageWidth));
  const height = Math.max(1, Math.min(pageHeight - y, Number(block.h ?? 24) / 100 * pageHeight));
  const useGlobalFont = block.editorialFont !== false;
  const useGlobalSize = block.editorialSize !== false;
  const family = pdfFontName(useGlobalFont ? settings.body_font : (block.font || settings.body_font));
  const fontStyle = pdfFontStyle(block);
  let fontPt = overrides.fontSize || (useGlobalSize ? Number(settings.font_size) : Number(block.size || 18) * .75);
  const leading = block.editorialLineHeight === false ? 1.35 : Number(settings.line_height) || 1.7;
  const rawLines = String(text ?? '').replace(/\r/g, '').split('\n');
  const makeLines = (fontSize) => {
    doc.setFont(family, fontStyle); doc.setFontSize(fontSize);
    return rawLines.flatMap((line) => line === '' ? [''] : doc.splitTextToSize(line, width));
  };
  const mmPerPt = 25.4 / 72;
  let lines = makeLines(fontPt), lineStep = fontPt * mmPerPt * leading;
  while (fontPt > 5 && lines.length * lineStep > height) {
    fontPt = Math.max(5, fontPt - .5);
    lines = makeLines(fontPt); lineStep = fontPt * mmPerPt * leading;
  }
  doc.setTextColor(...pdfRgb(overrides.color || block.color || '#302a35'));
  doc.setFont(family, fontStyle); doc.setFontSize(fontPt);
  const alignment = overrides.align || (['left', 'center', 'right'].includes(block.align) ? block.align : 'left');
  let baseline = y + fontPt * mmPerPt * .9;
  lines.forEach((line) => {
    if (line !== '') {
      const textX = alignment === 'center' ? x + width / 2 : alignment === 'right' ? x + width : x;
      doc.text(line, textX, baseline, { align: alignment });
    }
    baseline += lineStep;
  });
}
async function buildWorkPdfBlob(work) {
  const { jsPDF } = await import('jspdf');
  const settings = { ...DEFAULT_EDITORIAL_SETTINGS, ...(work.editorial_settings && typeof work.editorial_settings === 'object' ? work.editorial_settings : {}) };
  const formatConfig = settings.page_format === 'A4'
    ? { format: 'a4', width: 210, height: 297 }
    : settings.page_format === 'Letter'
      ? { format: 'letter', width: 215.9, height: 279.4 }
      : { format: 'a5', width: 148, height: 210 };
  const pageWidth = formatConfig.width, pageHeight = formatConfig.height;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: formatConfig.format, compress: true });
  const body = String(work.body || '');

  // Les pages créées dans l'éditeur sont rendues avec le même DOM et les mêmes
  // règles CSS que la feuille visible. Le PDF reprend cette image fidèle, puis
  // ajoute une couche de texte invisible pour conserver la sélection/recherche.
  if (body.startsWith(EDITOR_DOCUMENT_PREFIX)) {
    let pages = [];
    let savedRenderWidth = 0;
    try {
      const saved = JSON.parse(body.slice(EDITOR_DOCUMENT_PREFIX.length));
      pages = normalizeEditorPages(Array.isArray(saved) ? saved : saved.pages);
      savedRenderWidth = Number(Array.isArray(saved) ? 0 : saved.renderWidth) || 0;
    } catch { pages = []; }
    if (!pages.length) pages = [{ blocks: [] }];

    const { default: html2canvas } = await import('html2canvas');
    const liveCanvas = document.querySelector('#plume-editor-canvas');
    const liveWidth = Math.round(liveCanvas?.getBoundingClientRect().width || 0);
    const previewPage = document.querySelector('.plume-rendered-page');
    const previewWidth = Math.round(previewPage?.getBoundingClientRect().width || 0);
    // L'éditeur positionne ses blocs en pourcentage, mais leurs polices sont
    // exprimées en pixels CSS. Reprendre la largeur de conception sauvegardée
    // évite de redimensionner la page sans redimensionner la typographie.
    const renderWidth = Math.max(120, Math.min(2400,
      liveWidth >= 120 ? liveWidth :
      savedRenderWidth >= 120 && savedRenderWidth <= 2400 ? savedRenderWidth :
      previewWidth >= 120 && previewWidth <= 900 ? previewWidth : 560
    ));
    const renderHeight = Math.round(renderWidth * pageHeight / pageWidth);

    // Réutiliser l'aperçu de couverture de l'atelier : il contient déjà
    // les valeurs réellement affichées, le thème de Claude et l'image choisie,
    // même si le brouillon n'a pas encore été enregistré.
    const coverSource = document.querySelector('#editor-cover-preview-stage');
    if (!coverSource) throw new Error('Aperçu de couverture introuvable dans l’éditeur.');
    const coverSurface = coverSource.cloneNode(true);
    coverSurface.removeAttribute('id');
    coverSurface.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    coverSurface.classList.add('plume-pdf-export-cover');
    coverSurface.setAttribute('aria-hidden', 'true');
    coverSurface.querySelectorAll('.cover-upload-button, input, label').forEach((node) => node.remove());
    coverSurface.style.cssText += ';position:fixed;left:-10000px;top:0;z-index:2147483000;pointer-events:none;width:'+renderWidth+'px;max-width:none;height:'+renderHeight+'px;min-height:0;aspect-ratio:auto;overflow:hidden;box-sizing:border-box;border-radius:0;box-shadow:none!important;margin:0!important;transform:none;';
    const coverHost = document.querySelector('.editor-only-shell') || document.body;
    coverHost.appendChild(coverSurface);
    try {
      await hydrateR2Images(coverSurface);
      const coverImage = coverSurface.querySelector('img');
      if (coverImage) {
        await new Promise((resolve) => {
          if (coverImage.complete) return resolve();
          coverImage.addEventListener('load', resolve, { once: true });
          coverImage.addEventListener('error', resolve, { once: true });
          window.setTimeout(resolve, 10000);
        });
        if (!coverImage.naturalWidth) coverImage.hidden = true;
      }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const coverCanvas = await html2canvas(coverSurface, {
        backgroundColor: null,
        scale: Math.max(2, Math.min(4, 2000 / renderWidth)),
        useCORS: true,
        logging: false,
        width: renderWidth,
        height: renderHeight,
        windowWidth: Math.max(window.innerWidth, renderWidth),
        windowHeight: Math.max(window.innerHeight, renderHeight),
        onclone: (clonedDocument) => sanitizePdfColorFunctions(clonedDocument)
      });
      doc.addImage(coverCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    } finally {
      coverSurface.remove();
    }

    const surface = document.createElement('div');
    surface.className = 'plume-canvas-paper plume-pdf-export-surface';
    // Le PDF reprend les aides visuelles réellement activées dans l'éditeur.
    // Ces classes pilotent la grille et les repères CSS (::before / ::after).
    const liveCanvasForPreferences = document.querySelector('#plume-editor-canvas');
    ['plume-grid-visible', 'plume-guides-visible', 'plume-center-visible'].forEach((className) => {
      surface.classList.toggle(className, !!liveCanvasForPreferences?.classList.contains(className));
    });
    surface.setAttribute('aria-hidden', 'true');
    surface.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:2147483000;pointer-events:none;width:'+renderWidth+'px;max-width:none;height:'+renderHeight+'px;min-height:0;aspect-ratio:auto;overflow:hidden;box-sizing:border-box;box-shadow:none!important;margin:0!important;padding:0!important;transform:none;';
    // Le clone doit rester dans .editor-only-shell : ses règles CSS sont
    // scoppées à cet ancêtre. Dans body, les styles de blocs étaient perdus.
    const exportHost = document.querySelector('.editor-only-shell') || document.body;
    exportHost.appendChild(surface);
    try {
      for (let index = 0; index < pages.length; index++) {
        const page = pages[index] || {};
        surface.style.width = renderWidth + 'px';
        surface.style.height = renderHeight + 'px';
        surface.style.backgroundColor = page.background || '#ffffff';
        surface.innerHTML = editorCanvasMarkup(page, settings);
        const seenExportBlockIds = new Set();
        surface.querySelectorAll('.plume-canvas-block[data-block-id]').forEach((blockNode) => {
          const id = blockNode.getAttribute('data-block-id');
          if (!id) return;
          if (seenExportBlockIds.has(id)) blockNode.remove(); else seenExportBlockIds.add(id);
        });
        const latexNodes=[...surface.querySelectorAll('[data-latex-render]')];
        if(latexNodes.length){
          const math=await ensureMathJax();
          // Nettoyer l'état MathJax puis composer chaque bloc une seule fois.
          try{math.typesetClear?.([surface]);}catch{}
          for(const node of latexNodes){
            const blockId=node.closest('[data-block-id]')?.getAttribute('data-block-id');
            const block=(pages[index]?.blocks||[]).find((item)=>String(item.id)===String(blockId));
            let source=String(block?.text??'').trim();
            // Retirer les délimiteurs déjà enregistrés, même s'ils sont imbriqués.
            for(let pass=0;pass<6;pass++){
              let next=source;
              if(next.startsWith('\\[')&&next.endsWith('\\]'))next=next.slice(2,-2).trim();
              else if(next.startsWith('\\(')&&next.endsWith('\\)'))next=next.slice(2,-2).trim();
              else if(next.startsWith('$$')&&next.endsWith('$$'))next=next.slice(2,-2).trim();
              else if(next.startsWith('$')&&next.endsWith('$'))next=next.slice(1,-1).trim();
              if(next===source)break;
              source=next;
            }
            if(!source)throw new Error('Un bloc LaTeX est vide. Corrige sa formule avant le téléchargement.');
            try{math.typesetClear?.([node]);}catch{}
            node.replaceChildren(document.createTextNode('\\['+source+'\\]'));
          }
          // Ne pas scanner la feuille entière : traiter les blocs ciblés uniquement.
          await math.typesetPromise(latexNodes);
          if(surface.querySelector('.mjx-merror,.MathJax_Error'))throw new Error('Une formule LaTeX ne peut pas être convertie pour le PDF. Corrige-la puis réessaie.');
          for(const node of latexNodes){
            // Un bloc LaTeX exporté ne doit contenir qu’un seul rendu MathJax.
            // Garder uniquement le premier conteneur visible élimine les rendus
            // résiduels que MathJax peut laisser dans un clone destiné au PDF.
            const output=node.querySelector('mjx-container');
            if(output) node.replaceChildren(output);
          }
          fitLatexMath(surface);
        }
        surface.querySelectorAll('.is-selected,.plume-block-move,.plume-block-delete-corner,.plume-block-actions-toggle,.plume-block-actions-menu,.plume-block-resize').forEach((node) => {
          node.classList.remove('is-selected');
          if (node.matches('.plume-block-move,.plume-block-delete-corner,.plume-block-resize')) node.remove();
        });
        await hydrateR2Images(surface);
        await Promise.all([...surface.querySelectorAll('img')].map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((resolve) => {
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
            window.setTimeout(done, 10000);
          });
        }));
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const renderedCanvas = await html2canvas(surface, {
          backgroundColor: null,
          scale: Math.max(2, Math.min(4, 2000 / renderWidth)),
          useCORS: true,
          logging: false,
          width: renderWidth,
          height: renderHeight,
          windowWidth: Math.max(window.innerWidth, renderWidth),
          windowHeight: Math.max(window.innerHeight, Math.round(renderWidth * pageHeight / pageWidth)),
          onclone: (clonedDocument) => sanitizePdfColorFunctions(clonedDocument)
        });
        // La couverture occupe déjà la première page du PDF.
        doc.addPage(formatConfig.format, 'portrait');
        doc.addImage(renderedCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');

        // Couche invisible : le rendu visible reste strictement celui de la feuille.
        // Le texte demeure disponible pour la sélection, la recherche et l'extraction.
        const mmPerPx = pageWidth / renderWidth;
        for (const block of (pages[index].blocks || [])) {
          const isText = !block.latex && (block.type === 'text' || (block.type === 'shape' && block.label));
          if (!isText) continue;
          const value = String(block.type === 'shape' ? block.label : block.text || '');
          if (!value) continue;
          const x = Math.max(0, Number(block.x ?? 9) / 100 * pageWidth + 6 * mmPerPx);
          const y = Math.max(0, Number(block.y ?? 10) / 100 * pageHeight + 6 * mmPerPx);
          const width = Math.max(1, Number(block.w ?? 82) / 100 * pageWidth - 12 * mmPerPx);
          const useEditorialFont = block.type === 'text' && block.editorialFont !== false;
          const useEditorialSize = block.type === 'text' && block.editorialSize !== false;
          const fontFamily = useEditorialFont ? settings.body_font : (block.font || settings.body_font);
          const cssFontPx = useEditorialSize ? Number(settings.font_size) * 96 / 72 : Math.max(5, Number(block.size || 18));
          const fontPt = Math.max(1, cssFontPx * (pageWidth / renderWidth) * (72 / 25.4));
          const fontName = pdfFontName(fontFamily);
          const fontStyle = (block.bold ? 'bold' : '') + (block.italic ? 'italic' : '') || 'normal';
          doc.setFont(fontName, fontStyle);
          doc.setFontSize(Math.max(5, Math.min(72, fontPt)));
          const textLines = String(value).split(/\r?\n/).flatMap((line) => line ? doc.splitTextToSize(line, width) : ['']);
          const leading = block.type === 'text' && block.editorialLineHeight !== false ? Number(settings.line_height || 1.7) : 1.35;
          const lineStep = fontPt * (25.4 / 72) * leading;
          let baseline = y + fontPt * (25.4 / 72) * .9;
          const align = ['left','center','right'].includes(block.align) ? block.align : 'left';
          for (const line of textLines) {
            if (line) doc.text(line, align === 'center' ? x + width / 2 : align === 'right' ? x + width : x, baseline, { align, renderingMode: 'invisible' });
            baseline += lineStep;
          }
        }
      }
    } finally {
      surface.remove();
    }
    return doc.output('blob');
  }

  // Compatibilité avec les anciens textes sans mise en page par blocs.
  const author = authorOf(work)?.display_name || 'Aurore Plume';
  const coverImageKey = String(work.cover_media_key || '');
  if (coverImageKey) {
    try {
      const coverImage = await imageDataForPdf('r2:' + coverImageKey);
      const scale = Math.max(pageWidth / coverImage.width, pageHeight / coverImage.height);
      const drawWidth = coverImage.width * scale, drawHeight = coverImage.height * scale;
      doc.addImage(coverImage.dataUrl, 'PNG', (pageWidth - drawWidth) / 2, (pageHeight - drawHeight) / 2, drawWidth, drawHeight);
    } catch (error) { console.warn('Couverture non intégrée au PDF', error.message); }
  } else {
    doc.setFillColor(255, 255, 255); doc.rect(0, 0, pageWidth, pageHeight, 'F');
  }
  const coverInk = coverImageKey ? [255, 255, 255] : [48, 42, 53];
  doc.setTextColor(128, 99, 158); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text('a. aurore plume', pageWidth * .1, pageHeight * .22);
  doc.setDrawColor(128, 99, 158); doc.setLineWidth(.8);
  doc.line(pageWidth * .1, pageHeight * .25, pageWidth * .35, pageHeight * .25);
  doc.setTextColor(...coverInk); doc.setFont('times', 'bold'); doc.setFontSize(28);
  const titleLines = doc.splitTextToSize(String(work.title || 'Sans titre'), pageWidth * .78);
  doc.text(titleLines, pageWidth * .1, pageHeight * .39, { lineHeightFactor: 1.15 });
  if (work.subtitle) {
    doc.setFont('times', 'italic'); doc.setFontSize(15);
    doc.text(doc.splitTextToSize(String(work.subtitle), pageWidth * .78), pageWidth * .1, pageHeight * .39 + titleLines.length * 11 + 8);
  }
  doc.setTextColor(...coverInk); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(String(work.genre || 'Texte libre') + ' · ' + author, pageWidth * .1, pageHeight * .72);
  doc.setFontSize(7); doc.text('ÉCRIRE · PARTAGER · GRANDIR', pageWidth * .1, pageHeight * .9);
  const marginMm=settings.margins==='narrow'?12:settings.margins==='wide'?25:18;
  const fontPt=Number(settings.font_size)||12;
  const lineStep=fontPt*(25.4/72)*(Number(settings.line_height)||1.7);
  let x=marginMm,y=marginMm;
  const plain=body.replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1').replace(/^#{1,3}\s+/gm,'').replace(/^>\s?/gm,'');
  doc.addPage(formatConfig.format,'portrait');doc.setFont(pdfFontName(settings.body_font),'normal');doc.setFontSize(fontPt);doc.setTextColor(48,42,53);
  for(const paragraph of plain.split(/\r?\n/)){
    const lines=paragraph?doc.splitTextToSize(paragraph,pageWidth-marginMm*2):[''];
    for(const line of lines){
      if(y+lineStep>pageHeight-marginMm){doc.addPage(formatConfig.format,'portrait');y=marginMm;doc.setFont(pdfFontName(settings.body_font),'normal');doc.setFontSize(fontPt);}
      if(line)doc.text(line,x,y+fontPt*(25.4/72)*.9);
      y+=lineStep;
    }
    y+=lineStep*.35;
  }
  return doc.output('blob');
}
function downloadBlob(blob,filename) {
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;link.style.display='none';document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}
let plumePdfDocument=null, plumePdfScale=1, plumePdfPage=1, plumePdfBlob=null, plumePdfObserver=null, plumePdfKeyHandler=null, plumePdfResizeHandler=null;
async function openPdfReader(blob,title='Lecture du document',workId=null) {
  if (!(blob instanceof Blob)) throw new Error('Le document PDF est indisponible.');
  closePdfReader();
  plumePdfBlob=blob; plumePdfScale=1; plumePdfPage=1;
  const recentKey='aurore_plume_pdf_recents_v1';
  let recent=[]; try { recent=JSON.parse(localStorage.getItem(recentKey)||'[]'); if(!Array.isArray(recent))recent=[]; } catch {}
  recent=[{id:workId,title:String(title||'Document'),openedAt:Date.now()},...recent.filter(x=>x.id!==workId)].slice(0,8);
  try { localStorage.setItem(recentKey,JSON.stringify(recent)); } catch {}
  const titleHtml=e(title||'Lecture du document');
  modalRoot.innerHTML = "<div class='plume-pdf-reader-overlay' id='pdfViewerOverlay' role='dialog' aria-modal='true' aria-labelledby='pdfViewerTitre'><div class='pdf-reader-shell'><div class='pdf-reader-topbar'><button type='button' class='pdf-reader-back' data-pdf-reader-close>← Retour</button><strong id='pdfViewerTitre' class='pdf-reader-title'>" + titleHtml + "</strong><span class='pdf-reader-badge'>LECTURE</span><button type='button' class='pdf-reader-menu-toggle' data-pdf-menu-toggle aria-expanded='false' aria-label='Outils du lecteur'>⋮</button><div class='pdf-reader-menu-panel plume-pdf-menu' data-pdf-menu hidden><div class='pdf-menu-section'><span class='pdf-menu-section-title'>Zoom</span><div class='pdf-menu-zoom-row'><button type='button' data-pdf-zoom-out>−</button><span data-pdf-zoom-label>100%</span><button type='button' data-pdf-zoom-in>+</button></div><button type='button' class='pdf-menu-item' data-pdf-fit>↔ Ajuster à la largeur</button></div><div class='pdf-menu-divider'></div><button type='button' class='pdf-menu-item' data-pdf-mode aria-pressed='false'>⇄ Lecture horizontale</button><button type='button' class='pdf-menu-item' data-pdf-recent-toggle aria-expanded='false'>◷ Documents récents</button><div class='pdf-recent-panel' data-pdf-recent hidden><div class='pdf-recent-panel-title'>Documents précédemment ouverts</div><div class='pdf-recent-list' data-pdf-recent-list></div></div><div class='pdf-menu-divider'></div><button type='button' class='pdf-menu-item' data-pdf-download>↓ Télécharger le PDF</button></div></div><div class='pdf-load-progress-dock is-visible' data-pdf-progress><div class='pdf-load-progress-head'><span data-pdf-progress-stage>Préparation du document…</span><strong data-pdf-progress-percent>0%</strong></div><div class='pdf-load-progress-speed' data-pdf-progress-speed>Ouverture du fichier</div><div class='pdf-load-progress-track'><div class='pdf-load-progress-bar' data-pdf-progress-bar></div></div></div><div class='pdf-reader-zone-wrap'><div class='pdf-reader-zone' data-pdf-zone tabindex='0' aria-label='Pages du document PDF'><div class='pdf-reader-loading' data-pdf-loading><div class='pdf-spinner'></div><p>Préparation du document…</p></div><div class='pdf-reader-erreur' data-pdf-error hidden role='alert'></div><div class='pdf-reader-pages' data-pdf-pages></div></div></div><div class='pdf-reader-bottombar'><button type='button' data-pdf-prev>← Précédent</button><div class='pdf-page-jump-wrap'><button type='button' data-pdf-page-toggle aria-expanded='false'><span data-pdf-page-count>1 / —</span> ▾</button><div class='pdf-page-jump-panel' data-pdf-page-panel hidden><input type='number' min='1' inputmode='numeric' placeholder='N° de page' aria-label='Numéro de page' data-pdf-page-input><button type='button' data-pdf-page-go>Aller</button></div></div><button type='button' data-pdf-next>Suivant →</button></div></div><button type='button' class='pdf-load-progress-sphere' data-pdf-progress-sphere aria-label='État du chargement'><span data-pdf-sphere-percent>100%</span></button></div>";
  const overlay=modalRoot.querySelector('#pdfViewerOverlay'), zone=overlay.querySelector('[data-pdf-zone]'), pages=overlay.querySelector('[data-pdf-pages]');
  const progress=(pct,label,detail)=>{overlay.querySelector('[data-pdf-progress-bar]').style.width=pct+'%';overlay.querySelector('[data-pdf-progress-percent]').textContent=Math.round(pct)+'%';overlay.querySelector('[data-pdf-progress-stage]').textContent=label;overlay.querySelector('[data-pdf-progress-speed]').textContent=detail||'';overlay.querySelector('[data-pdf-sphere-percent]').textContent=Math.round(pct)+'%';};
  const changeScale=async delta=>{plumePdfScale=Math.max(.5,Math.min(3,Math.round((plumePdfScale+delta)*100)/100));overlay.querySelector('[data-pdf-zoom-label]').textContent=Math.round(plumePdfScale*100)+'%';await renderPages(true);};
  const goPage=n=>{if(!plumePdfDocument)return;plumePdfPage=Math.max(1,Math.min(plumePdfDocument.numPages,Math.round(n)||1));pages.querySelector('[data-page="'+plumePdfPage+'"]')?.scrollIntoView({behavior:'smooth',block:'start',inline:'center'});overlay.querySelector('[data-pdf-page-count]').textContent=plumePdfPage+' / '+plumePdfDocument.numPages;overlay.querySelector('[data-pdf-page-input]').value=String(plumePdfPage);overlay.querySelector('[data-pdf-prev]').disabled=plumePdfPage<=1;overlay.querySelector('[data-pdf-next]').disabled=plumePdfPage>=plumePdfDocument.numPages;};
  plumePdfObserver=null; const rendering=new Set();
  async function renderPage(n,force=false){if(!plumePdfDocument||n<1||n>plumePdfDocument.numPages||rendering.has(n))return;const canvas=pages.querySelector('canvas[data-page="'+n+'"]');if(!canvas||canvas.dataset.rendered==='true'&&!force)return;rendering.add(n);try{const page=await plumePdfDocument.getPage(n);const base=page.getViewport({scale:1});const fit=Math.max(.5,Math.min(3,(zone.clientWidth-28)/base.width));const viewport=page.getViewport({scale:fit*plumePdfScale});const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.floor(viewport.width*ratio);canvas.height=Math.floor(viewport.height*ratio);canvas.style.width=Math.floor(viewport.width)+'px';canvas.style.height=Math.floor(viewport.height)+'px';await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0],background:'#fff'}).promise;canvas.dataset.rendered='true';}finally{rendering.delete(n);}}
  async function renderPages(force=false){if(!plumePdfDocument)return;const visible=[...pages.querySelectorAll('canvas[data-page]')].filter(c=>{const r=c.getBoundingClientRect(),z=zone.getBoundingClientRect();return r.bottom>=z.top-600&&r.top<=z.bottom+600;}).map(c=>Number(c.dataset.page));await Promise.all([...new Set([plumePdfPage,...visible])].map(n=>renderPage(n,force).catch(()=>{})));}
  overlay.querySelector('[data-pdf-reader-close]').addEventListener('click',closePdfReader);
  overlay.addEventListener('click',ev=>{if(ev.target===overlay)closePdfReader();});
  overlay.querySelector('[data-pdf-menu-toggle]').addEventListener('click',ev=>{const m=overlay.querySelector('[data-pdf-menu]');m.hidden=!m.hidden;ev.currentTarget.setAttribute('aria-expanded',String(!m.hidden));});
  overlay.querySelector('[data-pdf-zoom-in]').addEventListener('click',()=>changeScale(.15));overlay.querySelector('[data-pdf-zoom-out]').addEventListener('click',()=>changeScale(-.15));
  overlay.querySelector('[data-pdf-fit]').addEventListener('click',()=>{plumePdfScale=1;overlay.querySelector('[data-pdf-zoom-label]').textContent='100%';renderPages(true);});
  overlay.querySelector('[data-pdf-mode]').addEventListener('click',ev=>{const horizontal=zone.classList.toggle('pdf-reading-horizontal');ev.currentTarget.setAttribute('aria-pressed',String(horizontal));ev.currentTarget.textContent=horizontal?'⇵ Lecture verticale':'⇄ Lecture horizontale';});
  overlay.querySelector('[data-pdf-download]').addEventListener('click',()=>downloadBlob(plumePdfBlob,(String(title||'aurore-plume').replace(/[^a-z0-9_-]+/gi,'-')||'aurore-plume')+'.pdf'));
  overlay.querySelector('[data-pdf-prev]').addEventListener('click',()=>goPage(plumePdfPage-1));overlay.querySelector('[data-pdf-next]').addEventListener('click',()=>goPage(plumePdfPage+1));
  overlay.querySelector('[data-pdf-page-toggle]').addEventListener('click',()=>{const p=overlay.querySelector('[data-pdf-page-panel]');p.hidden=!p.hidden;overlay.querySelector('[data-pdf-page-toggle]').setAttribute('aria-expanded',String(!p.hidden));});
  overlay.querySelector('[data-pdf-page-go]').addEventListener('click',()=>goPage(Number(overlay.querySelector('[data-pdf-page-input]').value)));
  overlay.querySelector('[data-pdf-page-input]').addEventListener('keydown',ev=>{if(ev.key==='Enter')goPage(Number(ev.currentTarget.value));});
  overlay.querySelector('[data-pdf-recent-toggle]').addEventListener('click',()=>{const p=overlay.querySelector('[data-pdf-recent]');p.hidden=!p.hidden;overlay.querySelector('[data-pdf-recent-toggle]').setAttribute('aria-expanded',String(!p.hidden));});
  const recentList=overlay.querySelector('[data-pdf-recent-list]');recentList.innerHTML=recent.map(x=>"<button type='button' class='pdf-recent-item' data-reopen-work='"+e(x.id||'')+"'>"+e(x.title||'Document')+"</button>").join('')||"<p class='pdf-recent-empty'>Aucun document récent.</p>";
  recentList.addEventListener('click',ev=>{const b=ev.target.closest('[data-reopen-work]');if(b&&b.dataset.reopenWork){const id=b.dataset.reopenWork;closePdfReader();openRead(id);}});
  if(plumePdfKeyHandler)document.removeEventListener('keydown',plumePdfKeyHandler);plumePdfKeyHandler=ev=>{if(!modalRoot.querySelector('#pdfViewerOverlay'))return;if(ev.key==='Escape')closePdfReader();else if(ev.key==='ArrowRight')goPage(plumePdfPage+1);else if(ev.key==='ArrowLeft')goPage(plumePdfPage-1);};document.addEventListener('keydown',plumePdfKeyHandler);
  try{
    progress(10,'Préparation du document…','Lecture du fichier PDF');
    const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=pdfWorkerUrl;
    const bytes=await blob.arrayBuffer();progress(38,'Ouverture du document…','Préparation des pages');
    plumePdfDocument=await pdfjs.getDocument({data:bytes,stopAtErrors:false}).promise;
    if(!plumePdfDocument.numPages)throw new Error('Le PDF ne contient aucune page lisible.');
    for(let n=1;n<=plumePdfDocument.numPages;n++){const wrap=document.createElement('div');wrap.className='pdf-reader-page-wrap';wrap.dataset.page=String(n);const canvas=document.createElement('canvas');canvas.className='pdf-reader-page';canvas.dataset.page=String(n);wrap.appendChild(canvas);pages.appendChild(wrap);}
    overlay.querySelector('[data-pdf-loading]').hidden=true;overlay.querySelector('[data-pdf-progress]').classList.remove('is-visible');overlay.querySelector('[data-pdf-progress-sphere]').classList.add('is-visible');
    progress(100,'Document prêt','Vous pouvez commencer la lecture');
    if('IntersectionObserver' in window){plumePdfObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)renderPage(Number(entry.target.dataset.page)).catch(()=>{});}),{root:zone,rootMargin:'600px 0px'});pages.querySelectorAll('.pdf-reader-page-wrap').forEach(el=>plumePdfObserver.observe(el));}
    zone.addEventListener('scroll',()=>{const mid=zone.getBoundingClientRect().top+zone.clientHeight*.35;const all=[...pages.querySelectorAll('.pdf-reader-page-wrap')].map(el=>({n:Number(el.dataset.page),r:el.getBoundingClientRect()}));const found=all.find(x=>x.r.top<=mid&&x.r.bottom>=mid);if(found&&found.n!==plumePdfPage){plumePdfPage=found.n;overlay.querySelector('[data-pdf-page-count]').textContent=plumePdfPage+' / '+plumePdfDocument.numPages;overlay.querySelector('[data-pdf-page-input]').value=String(plumePdfPage);overlay.querySelector('[data-pdf-prev]').disabled=plumePdfPage<=1;overlay.querySelector('[data-pdf-next]').disabled=plumePdfPage>=plumePdfDocument.numPages;}renderPages(false);},{passive:true});
    await renderPage(1);goPage(1);
    if(plumePdfResizeHandler)window.removeEventListener('resize',plumePdfResizeHandler);plumePdfResizeHandler=()=>renderPages(true);window.addEventListener('resize',plumePdfResizeHandler,{passive:true});
  }catch(error){console.error('Lecteur PDF Aurore Plume',error);overlay.querySelector('[data-pdf-loading]').hidden=true;const box=overlay.querySelector('[data-pdf-error]');box.hidden=false;box.textContent='Le lecteur PDF n’a pas pu ouvrir ce document. Vérifiez la connexion puis réessayez.';progress(0,'Ouverture impossible',error?.message||'Erreur PDF');}
}
function updatePlumePdfReader(){ }
function closePdfReader(){if(plumePdfObserver){plumePdfObserver.disconnect();plumePdfObserver=null;}if(plumePdfKeyHandler){document.removeEventListener('keydown',plumePdfKeyHandler);plumePdfKeyHandler=null;}if(plumePdfResizeHandler){window.removeEventListener('resize',plumePdfResizeHandler);plumePdfResizeHandler=null;}modalRoot.innerHTML='';plumePdfDocument=null;plumePdfBlob=null;plumePdfPage=1;plumePdfScale=1;}
async function openRead(id) {
  const work = state.publicWorks.find((item) => item.id === id) || state.myWorks.find((item) => item.id === id);
  if (!work) return;
  try { toast('Préparation du PDF de lecture…'); const blob=await buildWorkPdfBlob(work); await openPdfReader(blob,work.title||'Lecture',work.id); }
  catch(error){console.error('PDF lecture Aurore Plume',error);toast(error.message||'Le PDF ne peut pas être préparé.','error');}
}

function positionBlockActionMenu(owner,menu){
  if(!owner||!menu)return;
  menu.classList.remove('opens-up','opens-right');
  const paper=owner.closest('.plume-canvas-paper');
  const paperRect=paper?.getBoundingClientRect();
  const blockRect=owner.getBoundingClientRect();
  if(!paperRect)return;
  const width=Math.min(236,Math.max(190,window.innerWidth-32));
  const height=Math.min(menu.scrollHeight||190,window.innerHeight-24);
  if(blockRect.bottom+height+20>paperRect.bottom)menu.classList.add('opens-up');
  if(blockRect.right-4-width<paperRect.left)menu.classList.add('opens-right');
}

function filterEditorialElements() {
  const root=document.querySelector('#plume-elements-page');
  if(!root)return;
  const query=(root.querySelector('#plume-element-search')?.value||'').trim().toLocaleLowerCase('fr');
  const category=root.querySelector('[data-element-filter][aria-pressed="true"]')?.dataset.elementFilter||'all';
  const buttons=[...root.querySelectorAll('[data-add-shape]')];
  const matchesQuery=(button)=>!query||(button.textContent.toLocaleLowerCase('fr')+' '+(button.dataset.addShape||'')).includes(query);
  let visible=0;
  for(const button of buttons){
    const group=button.dataset.elementCategory||'';
    const show=(category==='all'||group===category)&&matchesQuery(button);
    button.hidden=!show;
    if(show)visible++;
  }
  // Compteurs calculés depuis les cartes réelles, y compris pendant une recherche.
  root.querySelectorAll('[data-element-filter]').forEach((filter)=>{
    const group=filter.dataset.elementFilter||'all';
    const badge=filter.querySelector('[data-filter-count]');
    if(badge)badge.textContent=String(buttons.filter((button)=>(group==='all'||button.dataset.elementCategory===group)&&matchesQuery(button)).length);
  });
  const count=root.querySelector('#plume-element-results-count');
  if(count)count.textContent=visible+' élément'+(visible===1?'':'s')+(query?' trouvé'+(visible===1?'':'s'):' à explorer');
  const empty=root.querySelector('#plume-elements-empty');
  if(empty)empty.hidden=visible!==0;
}
app.addEventListener('input',(event)=>{
  if(event.target.matches('#plume-element-search'))filterEditorialElements();
});
document.addEventListener('keydown',(event)=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'&&!document.querySelector('#plume-elements-page[hidden]')){
    event.preventDefault();
    document.querySelector('#plume-element-search')?.focus();
  }
});


app.addEventListener('click', async (event) => {
  if (!event.target.closest('.plume-block-actions-menu, .plume-block-actions-toggle')) {
    document.querySelectorAll('.plume-block-actions-menu:not([hidden])').forEach((menu)=>{menu.hidden=true;menu.closest('.plume-canvas-block')?.querySelector('[data-block-menu-toggle]')?.setAttribute('aria-expanded','false');});
  }
  const blockMenuToggle=event.target.closest('[data-block-menu-toggle]');
  if(blockMenuToggle){
    const owner=blockMenuToggle.closest('.plume-canvas-block');
    if(!owner)return;
    document.querySelectorAll('.plume-canvas-block').forEach((node)=>node.classList.toggle('is-selected',node===owner));
    state.editorSelectedBlock=owner.dataset.blockId||null;
    document.querySelectorAll('.plume-block-actions-menu').forEach((menu)=>{if(menu!==owner.querySelector('.plume-block-actions-menu')){menu.hidden=true;menu.closest('.plume-canvas-block')?.querySelector('[data-block-menu-toggle]')?.setAttribute('aria-expanded','false');}});
    const menu=owner.querySelector('.plume-block-actions-menu');
    if(menu){const opening=menu.hidden;menu.hidden=!opening;blockMenuToggle.setAttribute('aria-expanded',String(opening));if(opening)positionBlockActionMenu(owner,menu);}
    return;
  }
  const editorTabButton = event.target.closest('[data-editor-tab]');
  if (editorTabButton) { activateEditorTab(editorTabButton.dataset.editorTab); return; }
  if (event.target.closest('[data-editor-undo]')) { travelEditorHistory(-1); return; }
  if (event.target.closest('[data-editor-redo]')) { travelEditorHistory(1); return; }
  if (event.target.closest('#plume-editor-canvas') && !event.target.closest('.plume-canvas-block,.plume-page-context')) { state.editorSelectedBlock = null; const pop=document.querySelector('#plume-color-popover'); if(pop)pop.hidden=true; document.activeElement?.blur?.(); updateEditorCanvas(); return; }
  if (event.target.closest('[data-editor-page-prev]')) { if(state.editorTab!=='manuscript')activateEditorTab('manuscript');navigateCanvasPage(-1);return; }
  if (event.target.closest('[data-editor-page-next]')) { if(state.editorTab!=='manuscript')activateEditorTab('manuscript');navigateCanvasPage(1);return; }
  const editorTool = event.target.closest('[data-editor-tool]');
  if (editorTool) {
    const tool=editorTool.dataset.editorTool;
    if(tool==='text'){activateEditorTab('manuscript');addEditorBlock('text');}else if(tool==='latex'){activateEditorTab('manuscript');const panel=document.querySelector('#plume-latex-editor'),field=document.querySelector('#plume-latex-source'),preview=document.querySelector('#plume-latex-preview-text'),status=document.querySelector('#plume-latex-status');hidePlumeScienceKeyboard();if(panel&&field){field.value='';updateLatexSourceCount(field);if(preview){try{window.MathJax?.typesetClear?.([preview]);}catch{}preview.replaceChildren();}if(status)status.textContent='Saisis une expression pour voir l’aperçu.';panel.hidden=false;}}
    else if(tool==='elements'){activateEditorTab('manuscript');const panel=document.querySelector('#plume-elements-page');if(panel)panel.hidden=false;}
    else if(tool==='images'){activateEditorTab('manuscript');document.querySelector('#plume-image-file')?.click();}
    else if(tool==='page')activateEditorTab('layout');
    document.querySelectorAll('.editor-commandbar [data-editor-tool]').forEach((button)=>button.classList.toggle('is-active',button===editorTool));
    return;
  }
  if(event.target.closest('[data-elements-close]')){const panel=document.querySelector('#plume-elements-page');if(panel)panel.hidden=true;activateEditorTab('manuscript');document.querySelector('#plume-editor-canvas')?.scrollIntoView({block:'nearest',behavior:'smooth'});return;}
  const elementFilter=event.target.closest('[data-element-filter]');
  if(elementFilter){
    document.querySelectorAll('[data-element-filter]').forEach((button)=>{button.setAttribute('aria-pressed',String(button===elementFilter));});
    filterEditorialElements();
    return;
  }
  const shapeButton=event.target.closest('[data-add-shape]');if(shapeButton){const library=document.querySelector('#plume-elements-page');if(library)library.hidden=true;addEditorBlock('shape',shapeButton.dataset.addShape);return;}
  if(event.target.closest('[data-latex-keyboard]')){openPlumeScienceKeyboard();return;}
  if(event.target.closest('[data-latex-close]')){hidePlumeScienceKeyboard();const panel=document.querySelector('#plume-latex-editor');if(panel)panel.hidden=true;return;}
  if(event.target.closest('[data-latex-apply]')){
    const button=event.target.closest('[data-latex-apply]'),field=document.querySelector('#plume-latex-source'),panel=document.querySelector('#plume-latex-editor'),status=document.querySelector('#plume-latex-status');
    if(!field||!field.value.trim()){toast('Saisis une expression LaTeX avant de valider.','error');return;}
    if(field.value.length>MAX_LATEX_SOURCE_LENGTH){updateLatexSourceCount(field);if(status)status.textContent='Cette formule dépasse la limite de '+MAX_LATEX_SOURCE_LENGTH.toLocaleString('fr-FR')+' caractères. Sépare-la en plusieurs étapes.';toast('La formule est trop longue pour un bloc unique.','error');return;}
    button.disabled=true;button.textContent='Vérification…';
    void (async()=>{
      try{
        const formula=field.value.trim(),preview=document.querySelector('#plume-latex-preview-text');
        await renderLatexMath(preview,formula);
        if(preview?.querySelector('.mjx-merror,.MathJax_Error'))throw new Error('La formule contient une erreur de syntaxe.');
        addEditorBlock('latex',formula);hidePlumeScienceKeyboard();if(panel)panel.hidden=true;
        toast('Formule LaTeX vérifiée et insérée sans chevaucher les blocs existants.');
      }catch(error){if(status)status.textContent=error.message||'Impossible de convertir cette formule.';toast(error.message||'Conversion LaTeX impossible.','error');}
      finally{button.disabled=false;button.textContent='Valider et insérer';}
    })();
    return;
  }
  const pageMenuToggle=event.target.closest('[data-page-menu-toggle]');
  if(pageMenuToggle){const menu=pageMenuToggle.parentElement?.querySelector('[data-page-menu]');if(menu){menu.hidden=!menu.hidden;pageMenuToggle.setAttribute('aria-expanded',String(!menu.hidden));}return;}
  const pageImport=event.target.closest('[data-page-import]');
  if(pageImport){document.querySelector('#editor-page-cover-file')?.click();return;}
  const pageRotate=event.target.closest('[data-page-rotate]');
  if(pageRotate){const page=state.editorPages[state.editorPageIndex];if(page){page.rotation=(Number(page.rotation||0)+90)%180;updateEditorCanvas();syncEditorCanvas();recordEditorHistory();saveEditorRecovery();toast(page.rotation?'Page en orientation paysage.':'Page en orientation portrait.');}return;}
  const pageCover=event.target.closest('[data-page-cover]');
  if(pageCover){state.editorPages.forEach((page,index)=>{page.isCover=index===state.editorPageIndex;});updateEditorCanvas();syncEditorCanvas();recordEditorHistory();saveEditorRecovery();toast('Cette page est définie comme couverture.');return;}
  const pageDelete=event.target.closest('[data-page-delete]');
  if(pageDelete){const deleteButton=document.querySelector('[data-editor-delete-page]');deleteButton?.click();return;}
  const canvasBlank=event.target.closest('#plume-editor-canvas');
  if(canvasBlank&&!event.target.closest('.plume-canvas-block,.plume-page-context')){
    state.editorSelectedBlock=null;
    document.querySelectorAll('.plume-canvas-block.is-selected').forEach((node)=>node.classList.remove('is-selected'));
    canvasBlank.classList.add('plume-page-selected');
  }
  const pageColorButton=event.target.closest('[data-page-color]');if(pageColorButton){const p=state.editorPages[state.editorPageIndex];if(p){p.background=pageColorButton.dataset.pageColor;const c=document.querySelector('#plume-editor-canvas');if(c)c.style.backgroundColor=p.background;const custom=document.querySelector('#editor-page-color-custom');if(custom)custom.value=p.background;updateEditorPreviews();syncEditorCanvas();recordEditorHistory();saveEditorRecovery();}return;}
  const rotateButton=event.target.closest('[data-rotate-delta]');
  const rotateResetButton=event.target.closest('[data-rotate-reset]');
  if(rotateButton||rotateResetButton){
    const owner=(rotateButton||rotateResetButton).closest('.plume-canvas-block');
    const page=state.editorPages[state.editorPageIndex],block=(page?.blocks||[]).find((item)=>item.id===owner?.dataset.blockId);
    if(!block)return;
    const delta=Number(rotateButton?.dataset.rotateDelta||0);
    block.rotation=rotateResetButton?0:Math.max(-180,Math.min(180,Math.round((Number(block.rotation)||0)+delta)));
    updateEditorCanvas();syncEditorCanvas();recordEditorHistory();saveEditorRecovery();
    const menu=document.querySelector('.plume-canvas-block.is-selected .plume-block-actions-menu');
    if(menu){menu.hidden=false;menu.closest('.plume-canvas-block')?.querySelector('[data-block-menu-toggle]')?.setAttribute('aria-expanded','true');positionBlockActionMenu(menu.closest('.plume-canvas-block'),menu);const output=menu.querySelector('[data-rotation-output]');if(output)output.textContent=block.rotation+'°';}
    return;
  }
  const cornerDelete = event.target.closest('[data-delete-block]');
  if (cornerDelete) {
    const page = state.editorPages[state.editorPageIndex], id = cornerDelete.dataset.deleteBlock;
    if (page) page.blocks = page.blocks.filter((block) => block.id !== id);
    state.editorSelectedBlock = null;
    const pop = document.querySelector('#plume-color-popover'); if (pop) pop.hidden = true;
    updateEditorCanvas(); syncEditorCanvas(); recordEditorHistory(); saveEditorRecovery();
    toast('Élément supprimé. Vous pouvez annuler avec ↶.');
    return;
  }
  const deletePageButton = event.target.closest('[data-editor-delete-page]');
  if (deletePageButton) {
    if (!window.confirm('Supprimer la page sélectionnée ? Cette action peut être annulée avec ↶.')) return;
    if (state.editorPages.length > 1) { state.editorPages.splice(state.editorPageIndex, 1); state.editorPageIndex = Math.min(state.editorPageIndex, state.editorPages.length - 1); }
    else { state.editorPages[0] = { ...state.editorPages[0], coverImage: '', blocks: [] }; }
    state.editorSelectedBlock = null; updateEditorCanvas(); syncEditorCanvas(); recordEditorHistory(); saveEditorRecovery();
    toast('Page supprimée.'); return;
  }
  const pageThumb = event.target.closest('[data-select-page]');
  if (pageThumb) { state.editorPageIndex = Math.max(0, Math.min(Number(pageThumb.dataset.selectPage)||0, state.editorPages.length-1)); state.editorSelectedBlock = null; updateEditorCanvas(); syncEditorCanvas(); recordEditorHistory(); saveEditorRecovery(); return; }
  const nudgeButton = event.target.closest('[data-nudge]');
  if (nudgeButton) {
    const page = state.editorPages[state.editorPageIndex], block = (page?.blocks||[]).find((item)=>item.id===state.editorSelectedBlock);
    if (!block) { toast('Sélectionnez d’abord un élément.'); return; }
    const step = Math.max(1,Number(document.querySelector('[data-nudge-step]')?.value)||1);
    const format = editorialSettingsFromForm().page_format;
    const physical = format === 'A4' ? { width: 210, height: 297 } : format === 'Letter' ? { width: 215.9, height: 279.4 } : { width: 148, height: 210 };
    const dx = step / physical.width * 100, dy = step / physical.height * 100, direction = nudgeButton.dataset.nudge;
    if (direction === 'left') block.x = Math.max(0,Number(block.x||0)-dx);
    if (direction === 'right') block.x = Math.min(100-(Number(block.w)||4),Number(block.x||0)+dx);
    if (direction === 'up') block.y = Math.max(0,Number(block.y||0)-dy);
    if (direction === 'down') block.y = Math.min(100-(Number(block.h)||3),Number(block.y||0)+dy);
    updateEditorCanvas(); syncEditorCanvas(); recordEditorHistory(); saveEditorRecovery(); return;
  }
  const blockAction = event.target.closest('[data-block-action]');
  if (blockAction) {
    const page = state.editorPages[state.editorPageIndex], index = (page?.blocks||[]).findIndex((block)=>block.id===state.editorSelectedBlock);
    if (!page || index < 0) { toast('Sélectionnez d’abord un élément.'); return; }
    const action = blockAction.dataset.blockAction, block = page.blocks[index];
    if (action === 'duplicate') { const copy = JSON.parse(JSON.stringify(block)); copy.id = 'block-'+Date.now()+'-'+Math.random().toString(36).slice(2,7); copy.x = Math.min(96-(copy.w||4), (Number(copy.x)||0)+3); copy.y = Math.min(96-(copy.h||3), (Number(copy.y)||0)+3); page.blocks.splice(index+1,0,copy); state.editorSelectedBlock = copy.id; }
    else if (action === 'front') { page.blocks.splice(index,1); page.blocks.push(block); }
    else if (action === 'back') { page.blocks.splice(index,1); page.blocks.unshift(block); }
    else if (action === 'align-left') block.x = 5;
    else if (action === 'align-center-x') block.x = Math.max(0,(100-(Number(block.w)||4))/2);
    else if (action === 'align-right') block.x = Math.max(0,95-(Number(block.w)||4));
    updateEditorCanvas(); syncEditorCanvas(); recordEditorHistory(); saveEditorRecovery(); return;
  }
  if(event.target.closest('[data-block-delete]')){const page=state.editorPages[state.editorPageIndex];if(page&&state.editorSelectedBlock)page.blocks=page.blocks.filter((b)=>b.id!==state.editorSelectedBlock);state.editorSelectedBlock=null;updateEditorCanvas();syncEditorCanvas();recordEditorHistory();saveEditorRecovery();return;}
  const styleButton=event.target.closest('[data-text-style]');
  if(styleButton){if(styleButton.tagName!=='BUTTON')return;const block=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((b)=>b.id===state.editorSelectedBlock);if(!block||block.type!=='text'){toast('Sélectionnez une zone de texte.');return;}const kind=styleButton.dataset.textStyle;if(kind==='bold')block.bold=!block.bold;else if(kind==='italic')block.italic=!block.italic;else if(kind.startsWith('align-'))block.align=kind.slice(6);updateEditorCanvas();syncEditorCanvas();recordEditorHistory();return;}

  const insertTokenButton = event.target.closest('[data-insert-token]');
  if (insertTokenButton) { insertEditorToken(insertTokenButton.dataset.insertToken); return; }
  if (event.target.closest('[data-draft-cancel]')) { state.showDraftCreate = false; render(); return; }
  if (event.target.closest('[data-editor-back]')) { state.editorOpen = false; state.showDraftCreate = false; state.editing = null; state.showCreateForm = false; if (state.editorCoverPreview) URL.revokeObjectURL(state.editorCoverPreview); state.editorCoverPreview = null; render(); return; }
  if (event.target.closest('[data-editor-return-edit]')) { activateEditorTab('manuscript'); document.querySelector('#plume-editor-canvas')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (event.target.closest('[data-editor-print]')) {
    if (state.editorTab !== 'preview') activateEditorTab('preview');
    window.setTimeout(() => window.print(), 120);
    return;
  }
  if (event.target.closest('[data-publish-open]')) {
    modalRoot.innerHTML='<div class="modal-backdrop" id="publish-overlay"><section class="auth-modal plume-publish-modal" role="dialog" aria-modal="true" aria-labelledby="publish-title"><button type="button" class="modal-close" data-publish-cancel aria-label="Fermer">×</button><div class="auth-symbol">↗</div><h2 id="publish-title">Publier votre œuvre</h2><p>Choisissez qui pourra la voir. Vous pourrez revenir modifier votre texte depuis votre atelier.</p><button type="button" class="button button-primary full-width" data-publish-visibility="public">Public — sur Aurore Plume</button><button type="button" class="button button-outline full-width" data-publish-visibility="private">Privé — moi uniquement</button><small class="auth-privacy">Le mode public rend le texte accessible à tous les visiteurs d’Aurore Plume.</small></section></div>';
    modalRoot.querySelectorAll('[data-publish-visibility]').forEach((choice) => {
      choice.addEventListener('click', (choiceEvent) => {
        choiceEvent.preventDefault();
        choiceEvent.stopPropagation();
        const form = document.querySelector('#work-form');
        const visibilityField = form?.querySelector('[name="publish_visibility"]');
        const submitButton = form?.querySelector('button[type="submit"][name="intent"]');
        const visibility = choice.dataset.publishVisibility === 'public' ? 'public' : 'private';
        if (!form || !visibilityField || !submitButton) {
          modalRoot.innerHTML = '';
          toast('Impossible de préparer la publication. Fermez puis rouvrez votre œuvre.', 'error');
          return;
        }
        const titleField = form.querySelector('[name="title"]');
        if (!String(titleField?.value || '').trim()) {
          modalRoot.innerHTML = '';
          activateEditorTab('manuscript');
          titleField?.focus();
          toast('Ajoutez un titre avant de publier.', 'error');
          return;
        }
        visibilityField.value = visibility;
        modalRoot.innerHTML = '';
        toast(visibility === 'public' ? 'Publication en cours…' : 'Enregistrement privé en cours…');
        void saveWorkForm(form, null, { intent: 'publish', visibility });
      });
    });
    return;
  }
  if (event.target.closest('[data-publish-cancel]')) { modalRoot.innerHTML=''; return; }
  if(event.target.closest('[data-download-pdf]')){
    const form=document.querySelector('#work-form');
    if(!form)return;
    const data=new FormData(form);
    document.querySelectorAll('#plume-editor-canvas [data-block-text]').forEach((node)=>{const block=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((item)=>item.id===node.dataset.blockText);if(block){if(block.type==='shape')block.label=node.innerText;else block.text=node.innerText;}});
    const work={title:String(data.get('title')||'Sans titre'),subtitle:String(data.get('subtitle')||''),genre:String(data.get('genre')||'Texte libre'),body:editorPagesToBody(),editorial_settings:editorialSettingsFromForm(form),plume_profiles:{display_name:state.user?.user_metadata?.display_name||state.user?.email?.split('@')[0]||'Auteur'}};
    const button=event.target.closest('[data-download-pdf]');button.disabled=true;button.textContent='Création du PDF…';
    try{const blob=await buildWorkPdfBlob(work);downloadBlob(blob,(work.title||'aurore-plume').replace(/[^a-z0-9_-]+/gi,'-')+'.pdf');toast('PDF téléchargé.');}
    catch(error){console.error('Export PDF Aurore Plume',error);toast(error.message||'Le PDF n’a pas pu être créé.','error');}
    finally{button.disabled=false;button.textContent='Télécharger le PDF ↓';}
    return;
  }
  if (event.target.closest('[data-editor-preview-refresh]')) { updateEditorPreviews(); toast('Aperçu de la couverture actualisé.'); return; }
  const workspaceTabButton = event.target.closest('[data-workspace-tab]');
  if (workspaceTabButton) { state.workspaceTab = workspaceTabButton.dataset.workspaceTab; state.editing = null; state.editorOpen = false; state.editingVideo = null; state.editingCreation = null; state.showCreateForm = false; if (state.workspaceTab === 'videos') await loadMyVideos(); if (GENERIC_CREATION_KINDS.includes(state.workspaceTab)) await loadMyCreations(); render(); return; }
  if (event.target.closest('[data-action="new-video"]')) { state.workspaceTab = 'videos'; state.editingVideo = null; state.showCreateForm = true; await loadMyVideos(); render(); document.querySelector('#video-form [name="title"]')?.focus(); return; }
  if (event.target.closest('[data-action="new-text"]')) { state.workspaceTab = 'textes'; state.editing = null; state.editorOpen = false; state.showDraftCreate = true; state.showCreateForm = false; render(); document.querySelector('#draft-create-form [name="title"]')?.focus(); return; }
  const editVideoButton = event.target.closest('[data-edit-video]');
  if (editVideoButton) { state.workspaceTab = 'videos'; state.editingVideo = state.myVideos.find((item) => item.id === editVideoButton.dataset.editVideo) || null; state.showCreateForm = true; render(); return; }
  if (event.target.closest('[data-action="new-creation"]')) { state.editingCreation = null; state.showCreateForm = true; render(); document.querySelector('#creation-form [name="title"]')?.focus(); return; }
  const editCreationButton = event.target.closest('[data-edit-creation]');
  if (editCreationButton) { state.editingCreation = state.myCreations.find((item) => item.id === editCreationButton.dataset.editCreation) || null; state.workspaceTab = state.editingCreation?.kind || 'arts'; state.showCreateForm = true; render(); return; }
  if (event.target.closest('[data-video-cancel], [data-creation-cancel]')) { state.editingVideo = null; state.editing = null; state.editingCreation = null; state.showCreateForm = false; render(); return; }
  const pickFilesButton = event.target.closest('#r2-pick-files, #r2-pick-files-secondary');
  if (pickFilesButton) {
    const inputId = pickFilesButton.id === 'r2-pick-files-secondary' ? '#r2-files-input-secondary' : '#r2-files-input';
    const fileInput = document.querySelector(inputId);
    if (fileInput instanceof HTMLInputElement) {
      state.r2PickerOpen = true;
      state.r2PendingRender = false;
      r2Diagnostic('Ouverture du ' + (inputId.includes('secondary') ? 'second' : 'premier') + ' sélecteur Android…');
      fileInput.click();
    } else {
      r2Diagnostic('Impossible de trouver le champ de sélection du fichier.', 'error');
    }
    return;
  }
  if (event.target.closest('#r2-diagnostic-clear')) {
    const log = document.querySelector('#r2-diagnostic-log');
    if (log) log.innerHTML = '';
    r2Diagnostic('Journal effacé manuellement.');
    return;
  }
  const r2Download = event.target.closest('[data-r2-download]');
  if (r2Download) { try { await openR2File(r2Download.dataset.r2Download); } catch (error) { toast(error.message || 'Ouverture impossible.', 'error'); } return; }
  const r2Delete = event.target.closest('[data-r2-delete]');
  if (r2Delete) { try { await deleteR2File(r2Delete.dataset.r2Delete); toast('Fichier supprimé.'); } catch (error) { toast(error.message || 'Suppression impossible.', 'error'); } return; }
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) {
    state.view = viewButton.dataset.view;
    state.editing = null;
    state.editorOpen = false;
    render();
    if (state.view === 'atelier' && state.user) { await loadMyWorks(); render(); }
    if (state.view === 'library') { await loadPublicWorks(); render(); }
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'auth') showAuth('signin');
  if (action === 'mobile-menu') document.querySelector('#mobile-nav')?.classList.toggle('mobile-nav-open');
  if (action === 'signout' && supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) toast('La déconnexion n’a pas abouti.', 'error');
    else { state.user = null; state.myWorks = []; state.view = 'discover'; state.editing = null; render(); toast('Vous êtes déconnecté.'); }
  }
  if (action === 'close-modal') modalRoot.innerHTML = '';
  const editButton = event.target.closest('[data-edit-id]');
  if (editButton) {
    state.editing = state.myWorks.find((work) => work.id === editButton.dataset.editId) || null;
    state.workspaceTab = 'textes'; state.editorOpen = true; state.showDraftCreate = false; state.editorTab = 'manuscript'; state.showCreateForm = false;
    if (state.editorCoverPreview) URL.revokeObjectURL(state.editorCoverPreview);
    state.editorCoverPreview = null;
    state.view = 'atelier';
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const readButton = event.target.closest('[data-read-id]');
  if (readButton) openRead(readButton.dataset.readId);
  const modeButton = event.target.closest('[data-auth-mode]');
  if (modeButton) showAuth(modeButton.dataset.authMode);
  if (event.target.id === 'auth-overlay' || event.target.id === 'read-overlay') modalRoot.innerHTML = '';
});

let plumePaletteHistoryOpen = false;
function closeEditorPalette({restoreHistory = true} = {}) {
  const wrap=document.querySelector('.plume-customizer-color-wrap');
  const palette=wrap?.querySelector('.plume-palette-scroll');
  const trigger=wrap?.querySelector('[data-open-editor-palette]');
  if(!palette || palette.hidden)return;
  palette.hidden=true;
  trigger?.setAttribute('aria-expanded','false');
  if(trigger)trigger.textContent='Palette ▾';
  if(restoreHistory && plumePaletteHistoryOpen && history.state?.plumeEditorPalette){
    plumePaletteHistoryOpen=false;
    history.back();
  } else {
    plumePaletteHistoryOpen=false;
  }
}
app.addEventListener('click',(event)=>{
  const openPalette=event.target.closest('[data-open-editor-palette]');
  if(openPalette){
    const wrap=openPalette.closest('.plume-customizer-color-wrap'),palette=wrap?.querySelector('.plume-palette-scroll');
    if(palette){
      if(!palette.hidden){closeEditorPalette();return;}
      palette.hidden=false;
      openPalette.setAttribute('aria-expanded','true');
      openPalette.textContent='Palette ▴';
      if(!history.state?.plumeEditorPalette){history.pushState({...history.state,plumeEditorPalette:true},'','#palette-couleurs');plumePaletteHistoryOpen=true;}
    }
    return;
  }
  if(event.target.closest('[data-close-editor-palette]')){closeEditorPalette();return;}
  if(event.target.closest('[data-block-color]')){closeEditorPalette();return;}
});
document.addEventListener('click',(event)=>{
  const wrap=document.querySelector('.plume-customizer-color-wrap');
  if(wrap && !wrap.contains(event.target))closeEditorPalette();
});
document.addEventListener('keydown',(event)=>{
  if(event.key==='Escape')closeEditorPalette();
});
window.addEventListener('popstate',()=>{
  const wrap=document.querySelector('.plume-customizer-color-wrap');
  const palette=wrap?.querySelector('.plume-palette-scroll');
  if(palette && !palette.hidden){
    plumePaletteHistoryOpen=false;
    closeEditorPalette({restoreHistory:false});
  }
});

let plumeNudgeDrag=null;
app.addEventListener('pointerdown',(event)=>{const handle=event.target.closest('.plume-nudge-drag-handle');const panel=handle?.closest('.plume-nudge.is-floating');if(!panel)return;const rect=panel.getBoundingClientRect();plumeNudgeDrag={panel,startX:event.clientX,startY:event.clientY,left:rect.left,top:rect.top,width:rect.width,height:rect.height,pointerId:event.pointerId};panel.style.willChange='transform';try{handle.setPointerCapture(event.pointerId);}catch{}event.preventDefault();});
window.addEventListener('pointermove',(event)=>{const drag=plumeNudgeDrag;if(!drag||(event.pointerId!==undefined&&event.pointerId!==drag.pointerId))return;const left=Math.max(8,Math.min(Math.max(8,window.innerWidth-drag.width-8),drag.left+event.clientX-drag.startX));const top=Math.max(8,Math.min(Math.max(8,window.innerHeight-drag.height-8),drag.top+event.clientY-drag.startY));drag.panel.style.transform='translate3d('+(left-drag.left)+'px,'+(top-drag.top)+'px,0)';event.preventDefault();},{passive:false});
const finishNudgeDrag=()=>{if(!plumeNudgeDrag)return;const drag=plumeNudgeDrag,rect=drag.panel.getBoundingClientRect();drag.panel.style.left=Math.max(8,Math.min(window.innerWidth-rect.width-8,rect.left))+'px';drag.panel.style.top=Math.max(8,Math.min(window.innerHeight-rect.height-8,rect.top))+'px';drag.panel.style.transform='';drag.panel.style.willChange='';plumeNudgeDrag=null;};window.addEventListener('pointerup',finishNudgeDrag);window.addEventListener('pointercancel',finishNudgeDrag);window.addEventListener('resize',()=>{const panel=document.querySelector('.plume-nudge.is-floating');if(!panel)return;const rect=panel.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(window.innerWidth-rect.width-8,rect.left))+'px';panel.style.top=Math.max(8,Math.min(window.innerHeight-rect.height-8,rect.top))+'px';});
app.addEventListener('click', (event) => {
  if (!state.editorOpen) return;
  const canvas = event.target.closest('#plume-editor-canvas');
  if (!canvas) return;
  const blockNode = event.target.closest('.plume-canvas-block');
  if (blockNode) {
    state.editorSelectedBlock = blockNode.dataset.blockId || null;
    canvas.querySelectorAll('.plume-canvas-block').forEach((node) => node.classList.toggle('is-selected', node === blockNode));
    return;
  }
  state.editorSelectedBlock = null;
  canvas.querySelectorAll('.plume-canvas-block.is-selected').forEach((node) => node.classList.remove('is-selected'));
  const popover = document.querySelector('#plume-color-popover');
  if (popover) popover.hidden = true;
  const rounding = document.querySelector('#plume-rounding-control');
  if (rounding) rounding.hidden = true;
  const roundingButton = document.querySelector('[data-editor-rounding]');
  if (roundingButton) roundingButton.setAttribute('aria-expanded', 'false');
});
let plumeBlockDrag=null;
app.addEventListener('pointerdown',(event)=>{if(event.target.closest('[data-delete-block], .plume-block-actions-toggle, .plume-block-actions-menu'))return;const node=event.target.closest('.plume-canvas-block'),canvas=event.target.closest('#plume-editor-canvas');if(!node||!canvas)return;const block=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((b)=>b.id===node.dataset.blockId);if(!block)return;const resize=event.target.closest('[data-resize-dir]'),moveGrip=event.target.closest('.plume-block-move');if(event.target.closest('[contenteditable="true"]')&&!resize&&!moveGrip)return;state.editorSelectedBlock=block.id;document.querySelectorAll('.plume-canvas-block').forEach((x)=>x.classList.toggle('is-selected',x.dataset.blockId===block.id));const pop=document.querySelector('#plume-color-popover');if(pop){pop.hidden=false;pop.style.left=Math.min(Math.max(8,event.clientX+12),window.innerWidth-260)+'px';pop.style.top=Math.min(Math.max(8,event.clientY+12),window.innerHeight-190)+'px';const palette=pop.querySelector('.plume-palette-scroll');if(palette)palette.hidden=true;const title=document.querySelector('#plume-palette-title');if(title)title.hidden=true;const colorsButton=pop.querySelector('[data-editor-colors]');if(colorsButton)colorsButton.setAttribute('aria-expanded','false');const round=document.querySelector('#plume-rounding-control');if(round)round.hidden=true;const roundButton=document.querySelector('[data-editor-rounding]');if(roundButton){roundButton.hidden=!(block.type==='shape'||block.type==='image');roundButton.setAttribute('aria-expanded','false');}const radius=pop.querySelector('#plume-corner-radius');if(radius){radius.value=String(block.radius??16);const output=pop.querySelector('#plume-corner-radius-value');if(output)output.textContent=radius.value+' px';}}const editableText=node.querySelector('[data-block-text]');
const baseFontPx=block.type==='text'?(Number.parseFloat(getComputedStyle(editableText||node).fontSize)||18):0;
plumeBlockDrag={id:block.id,startX:event.clientX,startY:event.clientY,x:Number(block.x),y:Number(block.y),w:Number(block.w),h:Number(block.h),cw:canvas.clientWidth,ch:canvas.clientHeight,baseFontPx,dir:resize?.dataset.resizeDir||'',moving:Boolean(moveGrip)||(!resize&&!event.target.closest('[contenteditable="true"]'))};if(plumeBlockDrag.moving||plumeBlockDrag.dir){event.preventDefault();const captureTarget=resize||moveGrip||node;try{captureTarget.setPointerCapture(event.pointerId);}catch{}}});
app.addEventListener('pointermove',(event)=>{
  if(!plumeBlockDrag)return;
  const b=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((x)=>x.id===plumeBlockDrag.id);
  if(!b)return;
  const dx=(event.clientX-plumeBlockDrag.startX)/Math.max(1,plumeBlockDrag.cw)*100;
  const dy=(event.clientY-plumeBlockDrag.startY)/Math.max(1,plumeBlockDrag.ch)*100;
  if(plumeBlockDrag.dir){
    const d=plumeBlockDrag.dir;
    let x=plumeBlockDrag.x,y=plumeBlockDrag.y,w=plumeBlockDrag.w,h=plumeBlockDrag.h;
    if(d.includes('e'))w=Math.max(4,plumeBlockDrag.w+dx);
    if(d.includes('s'))h=Math.max(3,plumeBlockDrag.h+dy);
    if(d.includes('w')){w=Math.max(4,plumeBlockDrag.w-dx);x=plumeBlockDrag.x+dx;}
    if(d.includes('n')){h=Math.max(3,plumeBlockDrag.h-dy);y=plumeBlockDrag.y+dy;}
    b.x=Math.max(0,Math.min(99,x)); b.y=Math.max(0,Math.min(99,y));
    b.w=Math.max(4,Math.min(100-b.x,w)); b.h=Math.max(3,Math.min(100-b.y,h));
    if(b.type==='text'){
      // La typographie suit aussi les poignées verticales : réduire le bloc
      // depuis le bas ou le haut réduit la taille au lieu de laisser le texte déborder.
      const widthRatio=b.w/Math.max(4,plumeBlockDrag.w);
      const heightRatio=b.h/Math.max(3,plumeBlockDrag.h);
      const ratio=Math.sqrt(Math.max(.12,widthRatio)*Math.max(.12,heightRatio));
      b.size=Math.round(Math.max(7,Math.min(72,plumeBlockDrag.baseFontPx*ratio))*10)/10;
      b.editorialSize=false;
    }
  }else if(plumeBlockDrag.moving){
    let nextX=Math.max(0,Math.min(100-b.w,plumeBlockDrag.x+dx));
    let nextY=Math.max(0,Math.min(100-b.h,plumeBlockDrag.y+dy));
    if (readEditorUiPreferences().snap) {
      nextX=Math.round(nextX/5)*5; nextY=Math.round(nextY/5)*5;
      nextX=Math.max(0,Math.min(100-b.w,nextX)); nextY=Math.max(0,Math.min(100-b.h,nextY));
    }
    b.x=nextX; b.y=nextY;
  }
  const node=document.querySelector('.plume-canvas-block.is-selected');
  if(node){
    node.style.left=b.x+'%';node.style.top=b.y+'%';node.style.width=b.w+'%';node.style.height=b.h+'%';
    if(b.type==='text'&&plumeBlockDrag.dir)node.style.fontSize=b.size+'px';
    const textNode=node.querySelector('[data-block-text]');
    if(textNode&&b.type==='text'&&plumeBlockDrag.dir)textNode.style.fontSize=b.size+'px';
  }
});
const finishPlumeBlockDrag=()=>{if(!plumeBlockDrag)return;const finished=plumeBlockDrag;plumeBlockDrag=null;const block=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((item)=>item.id===finished.id);if(block?.type==='text'){const textNode=document.querySelector('#plume-editor-canvas [data-block-text="'+block.id+'"]');if(textNode)fitPastedTextBlock(textNode,block);}syncEditorCanvas();recordEditorHistory();saveEditorRecovery();};
app.addEventListener('pointerup',finishPlumeBlockDrag);
app.addEventListener('pointercancel',finishPlumeBlockDrag);
function fitPastedTextBlock(node,block){
  const canvas=document.querySelector('#plume-editor-canvas'),blockNode=node?.closest('.plume-canvas-block');
  if(!canvas||!blockNode||!block||block.type!=='text')return;
  const pageHeight=Math.max(1,canvas.clientHeight);
  const currentHeight=Math.max(3,Number(block.h)||3);
  // Mesurer le texte sans la contrainte de hauteur du cadre, puis agrandir le cadre.
  blockNode.style.overflow='visible';
  node.style.height='auto';
  node.style.maxHeight='none';
  node.style.overflow='visible';
  node.style.overflowWrap='anywhere';
  node.style.whiteSpace='pre-wrap';
  const contentHeight=Math.ceil(Math.max(node.scrollHeight,node.getBoundingClientRect().height)+10);
  const needed=Math.max(3,Math.ceil(contentHeight/pageHeight*100)+0.5);
  // L'adaptation peut dépasser le bas de la page : le texte reste visible au lieu d'être coupé.
  // On n'écrase jamais la taille de police pour faire rentrer le texte dans un cadre trop petit.
  block.h=block.autoFitHeight ? needed : Math.max(currentHeight,needed);
  block.autoFitHeight=true;
  blockNode.style.height=block.h+'%';
  blockNode.style.overflow='visible';
  node.style.height='100%';
  node.style.maxHeight='none';
  node.style.overflow='visible';
}
app.addEventListener('paste',(event)=>{
  const node=event.target.closest?.('[data-block-text]');
  if(!node)return;
  const block=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((item)=>item.id===node.dataset.blockText);
  if(!block||block.type==='shape')return;
  const clipboard=event.clipboardData;
  const raw=clipboard?.getData('text/plain');
  if(typeof raw!=='string')return;
  event.preventDefault();
  const text=raw.replace(/\r\n?/g,'\n').replace(/\u0000/g,'').replace(/\u00a0/g,' ');
  node.focus();
  let inserted=false;
  try{inserted=document.execCommand('insertText',false,text);}catch{}
  if(!inserted){
    const selection=window.getSelection();
    if(selection?.rangeCount){
      const range=selection.getRangeAt(0);range.deleteContents();
      const textNode=document.createTextNode(text);range.insertNode(textNode);
      range.setStartAfter(textNode);range.collapse(true);selection.removeAllRanges();selection.addRange(range);
    }else node.appendChild(document.createTextNode(text));
    node.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste',data:text}));
  }
});
app.addEventListener('input',(event)=>{const n=event.target.closest('[data-block-text]');if(!n)return;const b=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((x)=>x.id===n.dataset.blockText);if(b){if(b.type==='shape')b.label=n.innerText;else b.text=n.innerText;if(b.type==='text')fitPastedTextBlock(n,b);const field=document.querySelector('#work-form [name="body"]');if(field)field.value=editorPagesToBody();updateEditorPreviews();const label=document.querySelector('#editor-save-label');if(label)label.textContent='Modifications à enregistrer';saveEditorRecovery();}});
app.addEventListener('focusout',(event)=>{if(!event.target.matches('[data-block-text]'))return;recordEditorHistory();});
app.addEventListener('input',(event)=>{if(event.target.matches('[data-text-style="color"]')){const b=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((x)=>x.id===state.editorSelectedBlock);if(b&&b.type==='text'){b.color=event.target.value;updateEditorCanvas();syncEditorCanvas();recordEditorHistory();saveEditorRecovery();}}});
app.addEventListener('change',(event)=>{
  const rotationControl=event.target.closest('[data-block-rotation]');
  if(rotationControl){
    const owner=rotationControl.closest('.plume-canvas-block'),page=state.editorPages[state.editorPageIndex];
    const block=(page?.blocks||[]).find((item)=>item.id===owner?.dataset.blockId);
    if(block){
      block.rotation=Math.max(-180,Math.min(180,Number(rotationControl.value)||0));
      updateEditorCanvas();syncEditorCanvas();recordEditorHistory();saveEditorRecovery();
      const menu=document.querySelector('.plume-canvas-block.is-selected .plume-block-actions-menu');
      if(menu){menu.hidden=false;menu.closest('.plume-canvas-block')?.querySelector('[data-block-menu-toggle]')?.setAttribute('aria-expanded','true');positionBlockActionMenu(menu.closest('.plume-canvas-block'),menu);const output=menu.querySelector('[data-rotation-output]');if(output)output.textContent=block.rotation+'°';}
    }
    return;
  }
  if(event.target.matches('[data-text-style="size"], [data-text-style="font"]')){
    const b=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((x)=>x.id===state.editorSelectedBlock);
    if(b&&b.type==='text'){
      if(event.target.matches('[data-text-style="size"]')){b.size=Number(event.target.value)||18;b.editorialSize=false;}
      else{b.font=event.target.value;b.editorialFont=false;}
      updateEditorCanvas();syncEditorCanvas();recordEditorHistory();
    }
  }
});
app.addEventListener('click',(event)=>{
  const nudgeToggle=event.target.closest('[data-toggle-nudge-float]');
  if(nudgeToggle){
    const panel=nudgeToggle.closest('.plume-nudge');if(!panel)return;
    const floating=!panel.classList.contains('is-floating');
    if(floating){
      panel._plumeNudgePlaceholder=document.createComment('position originale du panneau Déplacer');
      panel.parentNode?.insertBefore(panel._plumeNudgePlaceholder,panel);
      app.appendChild(panel);
      panel.classList.add('is-floating');
      panel.style.position='fixed';
      panel.style.left=Math.max(8,window.innerWidth-Math.min(340,window.innerWidth-16)-16)+'px';
      panel.style.top=Math.max(8,Math.min(96,window.innerHeight-180))+'px';
      panel.style.right='auto';panel.style.bottom='auto';panel.style.transform='none';
    }else{
      panel.classList.remove('is-floating');
      const placeholder=panel._plumeNudgePlaceholder;
      if(placeholder?.parentNode)placeholder.parentNode.insertBefore(panel,placeholder);
      placeholder?.remove();delete panel._plumeNudgePlaceholder;
      panel.style.position='';panel.style.left='';panel.style.top='';panel.style.right='';panel.style.bottom='';panel.style.transform='';
    }
    nudgeToggle.textContent=floating?'Fixer':'Détacher';
    nudgeToggle.setAttribute('aria-pressed',String(floating));
    nudgeToggle.setAttribute('aria-label',floating?'Fixer le panneau Déplacer':'Détacher le panneau Déplacer');
    return;
  }
  const textChip=event.target.closest('[data-open-text-color]');
  if(textChip){const input=textChip.parentElement?.querySelector('[data-text-style="color"]');input?.click();return;}
  const customChip=event.target.closest('[data-open-custom-color]');
  if(customChip){document.querySelector('#plume-custom-color')?.click();return;}
  const colors=event.target.closest('[data-editor-colors]');
  if(colors){const pop=document.querySelector('#plume-color-popover'),palette=pop?.querySelector('.plume-palette-scroll'),title=document.querySelector('#plume-palette-title');if(pop)pop.hidden=false;if(palette){palette.hidden=!palette.hidden;colors.setAttribute('aria-expanded',String(!palette.hidden));if(title)title.hidden=palette.hidden;const block=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((item)=>item.id===state.editorSelectedBlock);if(block){const custom=document.querySelector('#plume-custom-color');if(custom)custom.value=(block.type==='shape'||block.type==='image'?block.fill:block.color)||'#000000';if(title)title.textContent=(block.type==='shape'||block.type==='image')?'Couleur de remplissage':'Couleur du texte';}}return;}
  const rounding=event.target.closest('[data-editor-rounding]');
  if(rounding){const panel=document.querySelector('#plume-rounding-control');if(panel){panel.hidden=!panel.hidden;rounding.setAttribute('aria-expanded',String(!panel.hidden));}return;}
});
app.addEventListener('input',(event)=>{
 if(event.target.id!=='plume-corner-radius')return;
 const block=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((item)=>item.id===state.editorSelectedBlock);
 if(!block||!['image','shape'].includes(block.type))return;
 block.radius=Number(event.target.value)||0;
 const output=document.querySelector('#plume-corner-radius-value');if(output)output.textContent=block.radius+' px';
 const node=document.querySelector('.plume-canvas-block.is-selected');if(node){node.style.borderRadius=block.radius+'px';const image=node.querySelector('img');if(image)image.style.borderRadius=block.radius+'px';}
 syncEditorCanvas();recordEditorHistory();saveEditorRecovery();
});
app.addEventListener('click',(event)=>{const swatch=event.target.closest('[data-block-color]');if(swatch){const trigger=document.querySelector('.plume-color-trigger-swatch');if(trigger)trigger.style.backgroundColor=swatch.dataset.blockColor;const b=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((x)=>x.id===state.editorSelectedBlock);if(b){if(b.type==='image'||b.type==='shape')b.fill=swatch.dataset.blockColor;else b.color=swatch.dataset.blockColor;const custom=document.querySelector('#plume-custom-color');if(custom)custom.value=swatch.dataset.blockColor;const chip=document.querySelector('[data-open-custom-color]');if(chip)chip.style.setProperty('--chip-color',swatch.dataset.blockColor);const textInput=document.querySelector('[data-text-style="color"]');if(textInput&&b.type==='text')textInput.value=swatch.dataset.blockColor;const textChip=document.querySelector('[data-open-text-color]');if(textChip&&b.type==='text')textChip.style.setProperty('--chip-color',swatch.dataset.blockColor);updateEditorCanvas();syncEditorCanvas();recordEditorHistory();saveEditorRecovery();}return;}const n=event.target.closest('.plume-canvas-block');if(n){state.editorSelectedBlock=n.dataset.blockId;document.querySelectorAll('.plume-canvas-block').forEach((x)=>x.classList.toggle('is-selected',x.dataset.blockId===state.editorSelectedBlock));const b=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((x)=>x.id===state.editorSelectedBlock);if(b){const fontControl=document.querySelector('[data-text-style="font"]'),sizeControl=document.querySelector('[data-text-style="size"]'),colorControl=document.querySelector('[data-text-style="color"]'),opacityControl=document.querySelector('[data-block-opacity]');const docSettings=editorialSettingsFromForm();if(fontControl)fontControl.value=b.editorialFont!==false?docSettings.body_font:(b.font||docSettings.body_font);const effectiveSize=b.editorialSize!==false?Number(docSettings.font_size)*96/72:Number(b.size||18);const sizeOptions=[12,14,16,18,22,28,36,48];const shownSize=sizeOptions.reduce((best,current)=>Math.abs(current-effectiveSize)<Math.abs(best-effectiveSize)?current:best,sizeOptions[0]);if(sizeControl)sizeControl.value=String(shownSize);if(colorControl)colorControl.value=b.color||'#302a35';if(opacityControl)opacityControl.value=String(b.opacity??100);}const pop=document.querySelector('#plume-color-popover');if(pop){pop.hidden=!b;if(!pop.hidden){const rect=n.getBoundingClientRect();pop.style.left=Math.min(Math.max(8,rect.left),window.innerWidth-260)+'px';pop.style.top=Math.min(Math.max(8,rect.bottom+8),window.innerHeight-190)+'px';const palette=pop.querySelector('.plume-palette-scroll');if(palette)palette.hidden=true;const title=document.querySelector('#plume-palette-title');if(title)title.hidden=true;const colorsButton=pop.querySelector('[data-editor-colors]');if(colorsButton)colorsButton.setAttribute('aria-expanded','false');const round=document.querySelector('#plume-rounding-control');if(round)round.hidden=true;const roundButton=document.querySelector('[data-editor-rounding]');if(roundButton){roundButton.hidden=!(b.type==='shape'||b.type==='image');roundButton.setAttribute('aria-expanded','false');}const radius=pop.querySelector('#plume-corner-radius');if(radius){radius.value=String(b.radius??16);const output=pop.querySelector('#plume-corner-radius-value');if(output)output.textContent=radius.value+' px';}}}}});
app.addEventListener('input',(event)=>{
  if (event.target.matches('[data-block-opacity]')) {
    const block=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((item)=>item.id===state.editorSelectedBlock);
    if(block){block.opacity=Number(event.target.value)||100;const node=document.querySelector('.plume-canvas-block.is-selected');if(node)node.style.opacity=String(block.opacity/100);const field=document.querySelector('#work-form [name="body"]');if(field)field.value=editorPagesToBody();const label=document.querySelector('#editor-save-label');if(label)label.textContent='Modifications à enregistrer';saveEditorRecovery();}
    return;
  }
  if(event.target.id!=='plume-custom-color')return;const trigger=document.querySelector('.plume-color-trigger-swatch');if(trigger)trigger.style.backgroundColor=event.target.value;const b=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((x)=>x.id===state.editorSelectedBlock);if(!b)return;if(b.type==='image'||b.type==='shape')b.fill=event.target.value;else b.color=event.target.value;const chip=document.querySelector('[data-open-custom-color]');if(chip)chip.style.setProperty('--chip-color',event.target.value);const textInput=document.querySelector('[data-text-style="color"]');if(textInput&&b.type==='text')textInput.value=event.target.value;const textChip=document.querySelector('[data-open-text-color]');if(textChip&&b.type==='text')textChip.style.setProperty('--chip-color',event.target.value);updateEditorCanvas();syncEditorCanvas();recordEditorHistory();saveEditorRecovery();});
let plumePageSwipeStart = null;
app.addEventListener('touchstart', (event) => {
  if (!state.editorOpen || event.touches.length !== 1) return;
  const target = event.target;
  if (target.closest('button,a,input,textarea,select,[contenteditable="true"],.plume-typography-bar,.plume-palette-scroll,.plume-page-thumbnails,.plume-block-move,.plume-block-resize,.plume-canvas-block')) return;
  if (!target.closest('.editor-only-shell,.text-editor-shell,.plume-editor-workspace,.plume-canvas-desk,.plume-canvas-paper')) return;
  const touch = event.touches[0];
  plumePageSwipeStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });
app.addEventListener('touchend', (event) => {
  if (!plumePageSwipeStart || !event.changedTouches?.length) { plumePageSwipeStart = null; return; }
  const start = plumePageSwipeStart;
  plumePageSwipeStart = null;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
  if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
  if (!state.editorOpen || !document.querySelector('.text-editor-shell,.editor-only-shell')) return;
  if (state.editorTab !== 'manuscript') activateEditorTab('manuscript');
  navigateCanvasPage(dx < 0 ? 1 : -1);
}, { passive: true });
document.addEventListener('keydown', (event) => {
  if (!state.editorOpen || !document.querySelector('.text-editor-shell')) return;
  if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (event.key === 'ArrowRight') navigateEditorPage(1);
  if (event.key === 'ArrowLeft') navigateEditorPage(-1);
});


modalRoot.addEventListener('click', (event) => {
  const auroreIdButton = event.target.closest('[data-action="aurore-id"]');
  if (auroreIdButton) { startAuroreIdSignIn(auroreIdButton); return; }
  if (event.target.closest('[data-action="close-modal"]')) { modalRoot.innerHTML = ''; return; }
  const modeButton = event.target.closest('[data-auth-mode]');
  if (modeButton) { showAuth(modeButton.dataset.authMode); return; }
  if (event.target === modalRoot.firstElementChild) modalRoot.innerHTML = '';
});

modalRoot.addEventListener('click', (event) => {
  if(event.target.closest('[data-publish-cancel]')){modalRoot.innerHTML='';return;}
  if(event.target.classList?.contains('plume-pdf-reader-overlay')){closePdfReader();return;}
  const choice=event.target.closest('[data-publish-visibility]');
  if(!choice)return;
  const form=document.querySelector('#work-form');
  if(!form)return;
  const visibilityField = form.querySelector('[name="publish_visibility"]');
  if (!visibilityField) { toast('Impossible de préparer la publication : champ de visibilité introuvable.', 'error'); return; }
  const submitButton = form.querySelector('button[type="submit"][name="intent"]');
  if (!submitButton) { toast('Impossible de lancer la publication : bouton d’enregistrement introuvable.', 'error'); return; }
  visibilityField.value = choice.dataset.publishVisibility;
  // Déclencher le gestionnaire via le vrai bouton submit avec une intention
  // explicite : ne pas dépendre d’un submitter null ou d’un événement synthétique.
  const previousValue = submitButton.value;
  submitButton.value = 'publish';
  form.dataset.submitIntent = 'publish';
  if (!form.checkValidity()) {
    modalRoot.innerHTML = '';
    form.reportValidity();
    submitButton.value = previousValue;
    delete form.dataset.submitIntent;
    toast('Vérifiez les champs obligatoires avant de publier.', 'error');
    return;
  }
  modalRoot.innerHTML = '';
  try {
    form.requestSubmit(submitButton);
  } catch (error) {
    submitButton.value = previousValue;
    delete form.dataset.submitIntent;
    console.error('Aurore Plume publication submit', error);
    toast('Le formulaire n’a pas pu démarrer la publication. Réessayez après avoir enregistré le brouillon.', 'error');
    return;
  }
  submitButton.value = previousValue;
});
modalRoot.addEventListener('submit', async (event) => {
  if (event.target.id !== 'auth-form') return;
  event.preventDefault();
  if (!supabase) return;
  const form = event.target;
  const data = new FormData(form);
  const mode = form.dataset.mode;
  const message = document.querySelector('#auth-message');
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true; submit.textContent = 'Un instant…';
  if (message) message.textContent = '';
  try {
    let result;
    if (mode === 'forgot') {
      const email = String(data.get('email') || '').trim();
      result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/?reset-password=1' });
      if (result.error) throw result.error;
      if (message) message.textContent = 'Si cette adresse correspond à un compte, un lien de réinitialisation a été envoyé. Vérifiez aussi les courriers indésirables.';
      submit.disabled = false; submit.textContent = 'Envoyer le lien ↗';
      return;
    }
    if (mode === 'reset') {
      const password = String(data.get('password') || '');
      result = await supabase.auth.updateUser({ password });
      if (result.error) throw result.error;
      await supabase.auth.signOut();
      state.user = null;
      state.myWorks = [];
      showAuth('signin');
      const resetMessage = modalRoot.querySelector('#auth-message');
      if (resetMessage) resetMessage.textContent = 'Mot de passe mis à jour. Vous pouvez vous connecter.';
      return;
    }
    if (mode === 'signup') {
      result = await supabase.auth.signUp({ email: String(data.get('email')).trim(), password: String(data.get('password')), options: { data: { display_name: String(data.get('display_name') || '').trim() } } });
    } else {
      result = await supabase.auth.signInWithPassword({ email: String(data.get('email')).trim(), password: String(data.get('password')) });
    }
    if (result.error) throw result.error;
    if (mode === 'signup' && result.data.user && Array.isArray(result.data.user.identities) && result.data.user.identities.length === 0) {
      if (message) message.textContent = 'Cette adresse semble déjà associée à un compte. Essayez de vous connecter ou utilisez « Mot de passe oublié ? ».';
      submit.disabled = false; submit.textContent = 'Créer mon espace ↗';
      return;
    }
    if (mode === 'signup' && !result.data.session) {
      if (message) message.textContent = 'Compte créé. Vérifiez votre boîte e-mail pour confirmer l’adresse, puis revenez vous connecter. Si aucun message n’arrive, utilisez « Mot de passe oublié ? » ou vérifiez la configuration e-mail.';
      submit.disabled = false; submit.textContent = 'Créer mon espace ↗';
      return;
    }
    state.user = result.data.user || result.data.session?.user || null;
    if (state.user) { await ensureProfile(state.user); await loadMyWorks(); }
    modalRoot.innerHTML = '';
    state.view = 'atelier';
    render();
    toast(mode === 'signup' ? 'Votre espace est prêt. Bienvenue !' : 'Vous voilà de retour.');
  } catch (error) {
    if (message) message.textContent = error.message || 'Connexion impossible.';
    submit.disabled = false; submit.textContent = mode === 'signup' ? 'Créer mon espace ↗' : mode === 'forgot' ? 'Envoyer le lien ↗' : mode === 'reset' ? 'Enregistrer le mot de passe ↗' : 'Me connecter ↗';
  }
});

// Ne pas utiliser le retour de focus pour relancer render() : sur Android,
// focus peut arriver avant change et remplacer le champ juste avant sa sélection.
// L'événement cancel permet de libérer le rendu uniquement si le sélecteur est annulé.
app.addEventListener('cancel', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !['r2-files-input', 'r2-files-input-secondary'].includes(input.id)) return;
  state.r2PickerOpen = false;
  r2Diagnostic('Sélecteur Android fermé sans confirmer de nouveau fichier.');
  if (state.r2PendingRender) {
    state.r2PendingRender = false;
    render();
  }
});

let plumeLatexPreviewTimer=null,plumeLatexPreviewVersion=0;
function ensureMathJax(){
  if(window.MathJax?.typesetPromise)return Promise.resolve(window.MathJax);
  if(window.__plumeMathJaxPromise)return window.__plumeMathJaxPromise;
  window.MathJax={tex:{
    inlineMath:[['\\(','\\)']],displayMath:[['\\[','\\]']],
    packages:{'[+]':['ams','cancel','textmacros']},
    macros:{llbracket:'\\mathopen{\\lbrack\\!\\lbrack}',rrbracket:'\\mathclose{\\rbrack\\!\\rbrack}'}
  },options:{skipHtmlTags:['script','noscript','style','textarea','pre','code']},startup:{typeset:false}};
  window.__plumeMathJaxPromise=new Promise((resolve,reject)=>{
    const sources=[
      'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js',
      'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-chtml.js',
      'https://unpkg.com/mathjax@3/es5/tex-chtml.js'
    ];
    let index=0;
    const loadNext=()=>{
      if(index>=sources.length){window.__plumeMathJaxPromise=null;reject(new Error('Impossible de charger le moteur LaTeX depuis les serveurs disponibles. Vérifie la connexion ou réessaie plus tard.'));return;}
      const script=document.createElement('script');
      script.src=sources[index++];script.async=true;script.crossOrigin='anonymous';
      script.onload=()=>{
        if(window.MathJax?.typesetPromise)resolve(window.MathJax);
        else {script.remove();loadNext();}
      };
      script.onerror=()=>{script.remove();loadNext();};
      document.head.appendChild(script);
    };
    loadNext();
  });
  return window.__plumeMathJaxPromise;
}
async function renderLatexMath(root,formula){if(!root)throw new Error('Zone d’aperçu introuvable.');const math=await ensureMathJax();try{math.typesetClear?.([root]);}catch{}root.textContent='\\['+formula+'\\]';await math.typesetPromise([root]);if(root.querySelector('.mjx-merror,.MathJax_Error'))throw new Error('La formule contient une erreur de syntaxe.');return true;}
function updateLatexSourceCount(field=document.querySelector('#plume-latex-source')){
  const counter=document.querySelector('#plume-latex-count');
  if(!field||!counter)return;
  const length=field.value.length;
  counter.textContent=length.toLocaleString('fr-FR')+' / '+MAX_LATEX_SOURCE_LENGTH.toLocaleString('fr-FR')+' caractères';
  counter.classList.toggle('is-near-limit',length>=MAX_LATEX_SOURCE_LENGTH-300);
}
function openPlumeScienceKeyboard(){
  const field=document.querySelector('#plume-latex-source');
  if(!field){toast('Le champ LaTeX est introuvable.','error');return;}
  if(!window.AuroreScienceKeyboard?.create){toast('Le clavier scientifique n’a pas pu être chargé.','error');return;}
  if(!plumeScienceKeyboard||!plumeScienceKeyboard.el?.isConnected){
    plumeScienceKeyboard=window.AuroreScienceKeyboard.create({
      toSource:(raw)=>'\\['+String(raw||'').trim()+'\\]',
      render:(root)=>renderPlumeSciencePreview(root),
      onNative:(target)=>{if(target){try{target.focus({preventScroll:true})}catch{target.focus()}}}
    });
  }
  plumeScienceKeyboard.show(field);
}
function hidePlumeScienceKeyboard(){if(plumeScienceKeyboard)plumeScienceKeyboard.hide();}
function renderPlumeSciencePreview(root){
  if(!root)return;
  const version=(plumeSciencePreviewVersions.get(root)||0)+1;
  plumeSciencePreviewVersions.set(root,version);
  void ensureMathJax().then(async(math)=>{
    if(!root.isConnected||plumeSciencePreviewVersions.get(root)!==version)return;
    try{math.typesetClear?.([root]);}catch{}
    if(!root.isConnected||plumeSciencePreviewVersions.get(root)!==version)return;
    await math.typesetPromise([root]);
  }).catch(()=>{ /* L’aperçu du clavier ne doit jamais bloquer la saisie brute. */ });
}
function fitLatexMath(root){
  const nodes=root?.matches?.('[data-latex-render]')?[root]:[...(root?.querySelectorAll?.('[data-latex-render]')||[])];
  for(const node of nodes){
    node.style.removeProperty('font-size');
    const minFont=7.5;
    for(let attempt=0;attempt<8;attempt++){
      const width=node.clientWidth,height=node.clientHeight;
      if(width<1||height<1)break;
      const measuredWidth=Math.max(node.scrollWidth,node.firstElementChild?.scrollWidth||0);
      const measuredHeight=Math.max(node.scrollHeight,node.firstElementChild?.scrollHeight||0);
      const ratio=Math.min(measuredWidth>width+1?width/measuredWidth:1,measuredHeight>height+1?height/measuredHeight:1);
      if(!Number.isFinite(ratio)||ratio>=0.995)break;
      const current=parseFloat(getComputedStyle(node).fontSize)||18;
      const next=Math.max(minFont,current*ratio*0.96);
      if(next>=current-0.1)break;
      node.style.fontSize=next.toFixed(2)+'px';
    }
  }
}
async function refreshLatexPreview(){
  const field=document.querySelector('#plume-latex-source'),preview=document.querySelector('#plume-latex-preview-text'),status=document.querySelector('#plume-latex-status');
  if(!field||!preview)return;
  const version=++plumeLatexPreviewVersion,formula=field.value.trim();
  updateLatexSourceCount(field);
  if(field.value.length>MAX_LATEX_SOURCE_LENGTH){if(status)status.textContent='Limite de '+MAX_LATEX_SOURCE_LENGTH.toLocaleString('fr-FR')+' caractères dépassée. Sépare cette formule en plusieurs blocs.';return;}
  if(!formula){try{window.MathJax?.typesetClear?.([preview]);}catch{}preview.replaceChildren();if(status)status.textContent='Saisis une expression pour voir l’aperçu.';return;}
  if(status)status.textContent='Conversion mathématique…';
  try{await renderLatexMath(preview,formula);if(version===plumeLatexPreviewVersion&&status)status.textContent='Aperçu mathématique prêt. Valide pour insérer la formule.';}
  catch(error){if(version===plumeLatexPreviewVersion&&status)status.textContent=error.message||'Conversion impossible.';}
}
app.addEventListener('input',(event)=>{if(event.target.id==='plume-latex-source'){updateLatexSourceCount(event.target);clearTimeout(plumeLatexPreviewTimer);plumeLatexPreviewTimer=setTimeout(()=>void refreshLatexPreview(),220);}});
app.addEventListener('change', (event) => {
  if(event.target.id==='editor-page-color-custom'){const p=state.editorPages[state.editorPageIndex];if(p){p.background=event.target.value;const c=document.querySelector('#plume-editor-canvas');if(c)c.style.backgroundColor=p.background;updateEditorPreviews();syncEditorCanvas();recordEditorHistory();saveEditorRecovery();}return;}
  if(event.target.id==='editor-cover-image-file'){const f=event.target.files?.[0];if(f){const input=document.querySelector('#work-form [name="cover_file"]');if(input){const dt=new DataTransfer();dt.items.add(f);input.files=dt.files;}const img=document.querySelector('#editor-cover-image');if(img){img.src=URL.createObjectURL(f);img.hidden=false;}toast('Image choisie comme couverture. Enregistre l’œuvre pour conserver ce choix.');}return;}
  const styleControl=event.target.closest('[data-text-style]');
  if(styleControl && styleControl.tagName!=='BUTTON'){const block=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((b)=>b.id===state.editorSelectedBlock);if(block&&block.type==='text'){const kind=styleControl.dataset.textStyle;if(kind==='font'){block.font=styleControl.value;block.editorialFont=false;}else if(kind==='size'){block.size=Number(styleControl.value);block.editorialSize=false;}else if(kind==='color')block.color=styleControl.value;updateEditorCanvas();syncEditorCanvas();}}
  const imageInput=event.target;
  if(imageInput instanceof HTMLInputElement&&imageInput.id==='plume-image-file'){
    const file=imageInput.files?.[0];if(!file)return;
    if(!file.type.startsWith('image/')){toast('Choisissez une image.','error');imageInput.value='';return;}
    if(file.size>1500000){toast('Image limitée à 1,5 Mo pour garder le brouillon léger.','error');imageInput.value='';return;}
    const reader=new FileReader();reader.onload=()=>{const page=state.editorPages[state.editorPageIndex];if(page){const id='image-'+Date.now();page.blocks.push({id,type:'image',src:String(reader.result),x:12,y:12,w:58,h:32});state.editorSelectedBlock=id;updateEditorCanvas();syncEditorCanvas();recordEditorHistory();saveEditorRecovery();}};reader.readAsDataURL(file);imageInput.value='';return;
  }
  const coverInput = event.target;
  if (coverInput instanceof HTMLInputElement && coverInput.name === 'cover_file') {
    const file = coverInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { coverInput.value = ''; toast('Choisissez une image pour la couverture.', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { coverInput.value = ''; toast('La couverture doit faire 10 Mo maximum.', 'error'); return; }
    if (state.editorCoverPreview) URL.revokeObjectURL(state.editorCoverPreview);
    state.editorCoverPreview = URL.createObjectURL(file);
    ['editor-cover-image', 'editor-print-cover-image'].forEach((id) => {
      const img = document.getElementById(id);
      if (img) { img.src = state.editorCoverPreview; img.hidden = false; }
    });
    document.querySelectorAll('.editor-cover-placeholder').forEach((node) => { node.hidden = true; });
    return;
  }
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !['files', 'files-secondary'].includes(input.name) || !input.closest('#r2-upload-form')) return;
  state.r2PickerOpen = false;
  const files = [...(input.files || [])];
  // Si un fichier a été choisi, on annule tout rendu en attente : il effacerait
  // le champ file et ferait croire que la sélection Android a échoué.
  if (files.length) state.r2PendingRender = false;
  const secondary = input.name === 'files-secondary';
  const display = document.querySelector(secondary ? '#r2-selected-files-secondary' : '#r2-selected-files');
  const message = document.querySelector('.r2-message');
  if (display) {
    if (!files.length) {
      display.textContent = secondary ? 'Aucun fichier sélectionné dans le second sélecteur.' : 'Aucun fichier sélectionné.';
    } else {
      display.innerHTML = '<strong>' + files.length + (files.length > 1 ? ' fichiers sélectionnés' : ' fichier sélectionné') + '</strong><ul>' + files.map((file) => {
        const size = file.size < 1024 * 1024 ? Math.max(1, Math.round(file.size / 1024)) + ' Ko' : (file.size / (1024 * 1024)).toFixed(2) + ' Mo';
        return '<li>' + e(file.name) + ' <span>· ' + size + '</span></li>';
      }).join('') + '</ul>';
    }
  }
  r2Diagnostic(files.length
    ? (secondary ? 'Second sélecteur : ' : 'Premier sélecteur : ') + files.length + ' fichier(s) remis par Android ; ' + files.map((file) => file.name + ' (' + Math.round(file.size / 1024) + ' Ko)').join(', ')
    : (secondary ? 'Second sélecteur' : 'Premier sélecteur') + ' : aucun fichier retourné par Android.',
    files.length ? 'success' : 'warn');
  if (message) message.textContent = files.length ? 'Fichier prêt à être envoyé.' : '';
});

document.addEventListener('submit', async (event) => {
  if (event.target.id === 'draft-create-form') {
    event.preventDefault();
    if (!supabase || !state.user) { showAuth('signin'); return; }
    const form = event.target;
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    if (!title) { form.querySelector('[name="title"]')?.focus(); return; }
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    const payload = { title, summary: String(data.get('summary') || '').trim(), genre: String(data.get('genre') || 'Texte libre'), subtitle: '', body: '', editorial_settings: DEFAULT_EDITORIAL_SETTINGS, cover_media_key: null, author_id: state.user.id };
    try {
      const { error } = await supabase.from('plume_works').insert(payload);
      if (error) throw error;
      state.showDraftCreate = false;
      await loadMyWorks();
      render();
      toast('Brouillon créé.');
    } catch (error) {
      console.error('Aurore Plume draft creation', error);
      toast(error.message || 'Le brouillon n’a pas pu être créé.', 'error');
      if (button) button.disabled = false;
    }
    return;
  }
  if (event.target.id === 'r2-upload-form') { event.preventDefault(); await uploadR2Files(event.target); return; }
  if (event.target.id === 'creation-form') {
    event.preventDefault();
    if (!supabase || !state.user) { showAuth('signin'); return; }
    const form = event.target; const data = new FormData(form); const id = String(data.get('id') || '');
    const kind = String(data.get('kind') || state.workspaceTab);
    if (!GENERIC_CREATION_KINDS.includes(kind)) { toast('Catégorie inconnue.', 'error'); return; }
    const mediaUrl = String(data.get('media_url') || '').trim();
    if (mediaUrl && !/^https?:\/\//i.test(mediaUrl)) { toast('Le lien doit commencer par https:// ou http://.', 'error'); return; }
    const selectedFile = form.querySelector('[name="media_file"]')?.files?.[0] || null;
    if (selectedFile && selectedFile.size > 10 * 1024 * 1024) { toast('Chaque fichier doit faire 10 Mo maximum.', 'error'); return; }
    const button = form.querySelector('button[type="submit"]'); if (button) button.disabled = true;
    try {
      let mediaKey = String(data.get('existing_media_key') || '');
      if (selectedFile) {
        const safeName = selectedFile.name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-160) || 'creation';
        mediaKey = kind + '/' + Date.now() + '-' + safeName;
        await r2Request('/api/storage?key=' + encodeURIComponent(mediaKey), { method: 'POST', headers: { 'Content-Type': selectedFile.type || 'application/octet-stream' }, body: selectedFile });
      }
      const payload = { kind, title: String(data.get('title') || '').trim(), category: String(data.get('category') || 'Autre'), media_url: mediaUrl || null, media_key: mediaKey || null, description: String(data.get('description') || '').trim(), updated_at: new Date().toISOString() };
      const result = id
        ? await supabase.from('plume_creations').update(payload).eq('id', id).eq('author_id', state.user.id)
        : await supabase.from('plume_creations').insert({ ...payload, author_id: state.user.id });
      if (result.error) throw result.error;
      toast(id ? 'Création mise à jour.' : 'Création enregistrée.');
      state.editingCreation = null; state.showCreateForm = false; await loadMyCreations(); render();
    } catch (error) {
      console.error('Aurore Plume creation save', error);
      toast(error.message || 'La création n’a pas pu être enregistrée. Vérifiez la migration plume_creations.', 'error');
      if (button) button.disabled = false;
    }
    return;
  }
  if (event.target.id === 'video-form') {
    event.preventDefault();
    if (!supabase || !state.user) { showAuth('signin'); return; }
    const form = event.target; const data = new FormData(form); const id = String(data.get('id') || '');
    const payload = { title: String(data.get('title') || '').trim(), video_url: String(data.get('video_url') || '').trim(), category: String(data.get('category') || 'Création'), description: String(data.get('description') || '').trim(), updated_at: new Date().toISOString() };
    if (!(payload.video_url.startsWith('https://') || payload.video_url.startsWith('http://'))) { toast('Le lien doit commencer par https:// ou http://.', 'error'); return; }
    const button = form.querySelector('button[type="submit"]'); if (button) button.disabled = true;
    try {
      const result = id ? await supabase.from('plume_videos').update(payload).eq('id', id).eq('author_id', state.user.id) : await supabase.from('plume_videos').insert({ title: payload.title, video_url: payload.video_url, category: payload.category, description: payload.description, author_id: state.user.id });
      if (result.error) throw result.error;
      toast(id ? 'Vidéo mise à jour.' : 'Vidéo enregistrée.'); state.editingVideo = null; state.showCreateForm = false; await loadMyVideos(); render();
    } catch (error) { console.error('Aurore Plume video save', error); toast(error.message || 'La vidéo n’a pas pu être enregistrée. Appliquez la migration SQL plume_videos.', 'error'); if (button) button.disabled = false; }
    return;
  }
  if (event.target.id !== 'work-form') return;
  event.preventDefault();
  await saveWorkForm(event.target, event.submitter);

});

async function saveWorkForm(formElement, submitter = null, options = {}) {
  if (!supabase || !state.user) { showAuth('signin'); return; }
  const form = formElement;
  const data = new FormData(form);
  // L’intention posée par la boîte de publication est prioritaire : certains WebView Android
  // exposent encore la valeur initiale « draft » dans le bouton de soumission après requestSubmit().
  const intent = options.intent || form.dataset.submitIntent || submitter?.value || 'draft';
  delete form.dataset.submitIntent;
  const publishVisibility = String(options.visibility || data.get('publish_visibility') || 'private');
  const id = String(data.get('id') || '');
  // Flush contenteditable fields before serializing, including the last Android keystroke.
  document.querySelectorAll('#plume-editor-canvas [data-block-text]').forEach((node) => {
    const block = (state.editorPages[state.editorPageIndex]?.blocks || []).find((item) => item.id === node.dataset.blockText);
    if (block) { if (block.type === 'shape') block.label = node.innerText; else block.text = node.innerText; }
  });
  if (state.editorPages.length) data.set('body', editorPagesToBody());
  const title = String(data.get('title') || '').trim();
  if (!title) { activateEditorTab('manuscript'); form.querySelector('[name="title"]')?.focus(); toast('Ajoutez un titre avant d’enregistrer.', 'error'); return; }
  const selectedCover = form.querySelector('[name="cover_file"]')?.files?.[0] || null;
  if (selectedCover && !selectedCover.type.startsWith('image/')) { activateEditorTab('cover'); toast('Choisissez un fichier image pour la couverture.', 'error'); return; }
  if (selectedCover && selectedCover.size > 10 * 1024 * 1024) { activateEditorTab('cover'); toast('La couverture doit faire 10 Mo maximum.', 'error'); return; }
  const previousCoverKey = String(data.get('existing_cover_media_key') || '');
  let uploadedCoverKey = '';
  const editorialSettings = {
    page_format: String(data.get('page_format') || DEFAULT_EDITORIAL_SETTINGS.page_format),
    body_font: String(data.get('body_font') || DEFAULT_EDITORIAL_SETTINGS.body_font),
    font_size: Number(data.get('font_size') || DEFAULT_EDITORIAL_SETTINGS.font_size),
    line_height: Number(data.get('line_height') || DEFAULT_EDITORIAL_SETTINGS.line_height),
    margins: String(data.get('margins') || DEFAULT_EDITORIAL_SETTINGS.margins)
  };
  const payload = {
    title,
    subtitle: String(data.get('subtitle') || '').trim(),
    genre: String(data.get('genre') || 'Texte libre'),
    summary: String(data.get('summary') || '').trim(),
    body: state.editorPages.length ? editorPagesToBody() : String(data.get('body') || ''),
    editorial_settings: editorialSettings,
    cover_media_key: previousCoverKey || null,
    updated_at: new Date().toISOString()
  };
  if (intent === 'review') payload.submission_requested_at = new Date().toISOString();
  if (intent === 'publish') { payload.publication_status = publishVisibility === 'public' ? 'published' : 'draft'; payload.is_public = publishVisibility === 'public'; if (publishVisibility === 'public') payload.published_at = new Date().toISOString(); }
  const buttons = [...form.querySelectorAll('button[type="submit"]')];
  if (form.dataset.saving === '1') return;
  form.dataset.saving = '1';
  buttons.forEach((button) => { button.disabled = true; });
  let savedWorkId = id;
  const uploadedInlineKeys = [];
  const uploadedInlineOriginals = [];
  try {
    // Stocker les images intégrées dans R2 et conserver uniquement leurs clés dans la base.
    for (const page of (state.editorPages || [])) {
      for (const block of (page.blocks || [])) {
        if (block.type !== 'image' || !String(block.src || '').startsWith('data:image/')) continue;
        const response = await fetch(String(block.src));
        const imageBlob = await response.blob();
        if (!imageBlob.type.startsWith('image/')) throw new Error('Une image du document est invalide. Réinsérez-la puis réessayez.');
        const extension = (imageBlob.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'png';
        const key = 'manuscript-images/' + state.user.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + extension;
        await r2Request('/api/storage?key=' + encodeURIComponent(key), { method: 'POST', headers: { 'Content-Type': imageBlob.type }, body: imageBlob });
        uploadedInlineKeys.push(key);
        uploadedInlineOriginals.push({ block, src: block.src, key });
        block.src = 'r2:' + key;
      }
    }
    payload.body = state.editorPages.length ? editorPagesToBody() : String(data.get('body') || '');
    if (selectedCover) {
      const safeName = selectedCover.name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-140) || 'couverture';
      uploadedCoverKey = 'covers/' + Date.now() + '-' + safeName;
      await r2Request('/api/storage?key=' + encodeURIComponent(uploadedCoverKey), { method: 'POST', headers: { 'Content-Type': selectedCover.type || 'application/octet-stream' }, body: selectedCover });
      payload.cover_media_key = uploadedCoverKey;
    }
    if (id) {
      // Demander les lignes réellement modifiées : PostgREST peut sinon renvoyer
      // aucune erreur même si le filtre/RLS n'a modifié aucune œuvre.
      const result = await supabase.from('plume_works')
        .update(payload)
        .eq('id', id)
        .eq('author_id', state.user.id)
        .select('id,title,publication_status,is_public,published_at')
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) {
        throw new Error('La publication n’a pas été confirmée : aucune œuvre n’a été modifiée. Rechargez votre atelier puis réessayez.');
      }
      savedWorkId = result.data.id || id;
      if (intent === 'publish') {
        const expectedPublic = publishVisibility === 'public';
        if ((result.data.publication_status === 'published') !== expectedPublic || result.data.is_public !== expectedPublic) {
          throw new Error('La base n’a pas confirmé le mode de publication choisi. Votre texte reste dans votre atelier.');
        }
      }
    } else {
      const { updated_at, ...insertPayload } = payload;
      const result = await supabase.from('plume_works').insert({ ...insertPayload, author_id: state.user.id, ...(intent === 'review' ? { submission_requested_at: new Date().toISOString() } : {}), ...(intent === 'publish' ? { publication_status: publishVisibility === 'public' ? 'published' : 'draft', is_public: publishVisibility === 'public', ...(publishVisibility === 'public' ? { published_at: new Date().toISOString() } : {}) } : {}) }).select('id,title,publication_status,is_public,published_at').single();
      if (result.error) throw result.error;
      savedWorkId = result.data.id;
      if (intent === 'publish') {
        const expectedPublic = publishVisibility === 'public';
        if ((result.data.publication_status === 'published') !== expectedPublic || result.data.is_public !== expectedPublic) {
          throw new Error('La base n’a pas confirmé le mode de publication choisi. Votre texte reste dans votre atelier.');
        }
      }
    }
    if (uploadedCoverKey && previousCoverKey && previousCoverKey !== uploadedCoverKey) {
      try { await r2Request('/api/storage?key=' + encodeURIComponent(previousCoverKey), { method: 'DELETE' }); } catch (cleanupError) { console.warn('Ancienne couverture non supprimée', cleanupError.message); }
    }
    if (intent === 'draft') {
      clearEditorRecovery(savedWorkId);
      await loadMyWorks();
      state.editing = state.myWorks.find((item) => item.id === savedWorkId) || {
        ...(state.editing || {}), ...payload, id: savedWorkId,
        author_id: state.user.id, updated_at: new Date().toISOString()
      };
      state.view = 'atelier';
      state.workspaceTab = 'textes';
      state.editorOpen = true;
      state.showDraftCreate = false;
      state.showCreateForm = false;
      delete form.dataset.saving;
      render();
      toast('Brouillon enregistré. Vous pouvez continuer votre édition.');
      return;
    }
    toast(intent === 'review' ? 'Texte envoyé à la file de relecture.' : (publishVisibility === 'public' ? 'Œuvre publiée sur Aurore Plume.' : 'Œuvre enregistrée en privé.'));
    clearEditorRecovery(savedWorkId || id);
    state.editing = null; state.editorOpen = false; state.showCreateForm = false;
    if (state.editorCoverPreview) URL.revokeObjectURL(state.editorCoverPreview);
    state.editorCoverPreview = null;
    await loadMyWorks();
    if (intent === 'publish' && publishVisibility === 'public') await loadPublicWorks();
    delete form.dataset.saving;
    render();
  } catch (error) {
    delete form.dataset.saving;
    console.error('Aurore Plume save', error);
    if (uploadedCoverKey) { try { await r2Request('/api/storage?key=' + encodeURIComponent(uploadedCoverKey), { method: 'DELETE' }); } catch {} }
    for (const key of uploadedInlineKeys) { try { await r2Request('/api/storage?key=' + encodeURIComponent(key), { method: 'DELETE' }); } catch {} }
    for (const item of uploadedInlineOriginals) item.block.src = item.src;
    toast(error.message || 'Le texte n’a pas pu être enregistré.', 'error');
    buttons.forEach((button) => { button.disabled = false; });
  }
}




const EDITOR_UI_DEFAULTS = { grid: false, guides: false, center: false, snap: false };
function editorUiPreferenceKey() { return 'aurore-plume-editor-ui:' + String(state.user?.id || 'local') + ':' + String(state.editing?.id || 'new'); }
function readEditorUiPreferences() {
  try { return { ...EDITOR_UI_DEFAULTS, ...JSON.parse(localStorage.getItem(editorUiPreferenceKey()) || '{}') }; }
  catch { return { ...EDITOR_UI_DEFAULTS }; }
}
function applyEditorUiPreferences() {
  const prefs = readEditorUiPreferences(), canvas = document.querySelector('#plume-editor-canvas'), tools = document.querySelector('#plume-editor-smart-tools');
  if (canvas) {
    canvas.classList.toggle('plume-grid-visible', !!prefs.grid);
    canvas.classList.toggle('plume-guides-visible', !!prefs.guides);
    canvas.classList.toggle('plume-center-visible', !!prefs.center);
    canvas.classList.toggle('plume-snap-active', !!prefs.snap);
  }
  tools?.querySelectorAll('[data-editor-pref]').forEach((button) => {
    const active = !!prefs[button.dataset.editorPref];
    button.setAttribute('aria-pressed', String(active)); button.classList.toggle('is-active', active);
  });
}
function setEditorUiPreference(name, enabled) {
  if (!Object.prototype.hasOwnProperty.call(EDITOR_UI_DEFAULTS, name)) return;
  const prefs = readEditorUiPreferences(); prefs[name] = !!enabled;
  try { localStorage.setItem(editorUiPreferenceKey(), JSON.stringify(prefs)); } catch (error) { console.warn('Préférences locales de mise en page indisponibles', error); }
  applyEditorUiPreferences();
}
let editorialSettingsSaveTimer = null, editorialSettingsSaveRevision = 0;
function scheduleEditorialSettingsSave() {
  const form = document.querySelector('#work-form');
  const workId = String(form?.querySelector('[name="id"]')?.value || state.editing?.id || '');
  const settings = editorialSettingsFromForm(form);
  if (state.editing) state.editing.editorial_settings = settings;
  try { localStorage.setItem('aurore-plume-editor-settings:' + String(state.user?.id || 'local') + ':' + (workId || 'new'), JSON.stringify(settings)); } catch {}
  if (!workId || !supabase || !state.user) return;
  const revision = ++editorialSettingsSaveRevision;
  window.clearTimeout(editorialSettingsSaveTimer);
  editorialSettingsSaveTimer = window.setTimeout(async () => {
    try {
      const result = await supabase.from('plume_works').update({ editorial_settings: settings })
        .eq('id', workId).eq('author_id', state.user.id).select('id').maybeSingle();
      if (revision !== editorialSettingsSaveRevision) return;
      if (result.error) throw result.error;
      if (!result.data) throw new Error('La préférence n’a pas été confirmée par la base.');
      if (state.editing?.id === workId) state.editing.editorial_settings = settings;
      const label = document.querySelector('#editor-save-label');
      if (label) label.textContent = 'Préférences enregistrées';
      label?.closest('.editor-save-state')?.classList.remove('is-dirty');
    } catch (error) {
      console.warn('Enregistrement automatique des préférences éditoriales', error);
      const label = document.querySelector('#editor-save-label');
      if (label) label.textContent = 'Préférences conservées sur cet appareil';
    }
  }, 650);
}
function enhanceEditorialWorkspace() {
  const commandbar = document.querySelector('.editor-commandbar');
  const canvas = document.querySelector('#plume-editor-canvas');
  if (!commandbar || !canvas) return;
  let tools = document.querySelector('#plume-editor-smart-tools');
  if (!tools) {
    tools = document.createElement('section');
    tools.id = 'plume-editor-smart-tools';
    tools.className = 'plume-editor-smart-tools';
    tools.setAttribute('aria-label', 'Outils avancés de mise en page');
    tools.innerHTML = '<div class="plume-smart-tools-heading"><span class="eyebrow">MISE EN PAGE</span><span class="plume-smart-hint">Des outils rapides pour composer votre page</span></div><div class="plume-smart-tools-row"><label class="plume-template-picker">Modèle de bloc<select data-editor-template aria-label="Insérer un modèle de mise en page"><option value="">Choisir un modèle…</option><option value="title">Titre de section</option><option value="chapter">Ouverture de chapitre</option><option value="quote">Citation mise en valeur</option><option value="two-columns">Deux colonnes</option><option value="callout">Encadré de note</option></select></label><button type="button" data-editor-add-page class="plume-smart-button">＋ Page</button><button type="button" data-editor-duplicate-page class="plume-smart-button">▣ Dupliquer la page</button><button type="button" data-editor-pref="grid" aria-pressed="false" class="plume-smart-button">▦ Grille</button><button type="button" data-editor-pref="guides" aria-pressed="false" class="plume-smart-button">⌗ Marges</button><button type="button" data-editor-pref="center" aria-pressed="false" class="plume-smart-button">⊕ Centrage</button><button type="button" data-editor-pref="snap" aria-pressed="false" class="plume-smart-button">✣ Aimantation</button><span class="plume-smart-shortcuts">Réglages mémorisés · Ctrl/⌘ Z · Ctrl/⌘ S · Suppr</span></div>';
    commandbar.insertAdjacentElement('afterend', tools);
  }
  applyEditorUiPreferences();
  const status = document.querySelector('#editor-save-label');
  if (status && !status.dataset.statusEnhanced) {
    status.dataset.statusEnhanced = '1';
    const form = document.querySelector('#work-form');
    form?.addEventListener('input', () => {
      status.textContent = 'Modifications non enregistrées';
      status.closest('.editor-save-state')?.classList.add('is-dirty');
    });
  }
}
function makeEditorialBlock(type, values = {}) {
  return { id: 'block-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7), type: 'text', x: 9, y: 10, w: 82, h: 18, text: '', color: '#26252e', size: 24, font: 'Georgia', editorialFont: false, editorialSize: false, editorialLineHeight: false, ...values };
}
function insertEditorialTemplate(template) {
  const page = state.editorPages[state.editorPageIndex];
  if (!page) return;
  const existing = page.blocks || (page.blocks = []);
  const y = Math.min(82, 9 + existing.length * 5);
  const templates = {
    title: [makeEditorialBlock('text', { text: 'Titre de section', x: 9, y, w: 82, h: 12, size: 30, bold: true, color: '#493b72' })],
    chapter: [makeEditorialBlock('text', { text: 'CHAPITRE I', x: 9, y, w: 82, h: 8, size: 12, bold: true, color: '#80639e' }), makeEditorialBlock('text', { text: 'Le commencement', x: 9, y: y + 9, w: 82, h: 17, size: 28, bold: true }), makeEditorialBlock('text', { text: 'Commencez votre texte ici…', x: 9, y: y + 28, w: 82, h: 18, size: 16 })],
    quote: [makeEditorialBlock('shape', { shape: 'quote', label: '« Votre citation ici »', x: 12, y, w: 76, h: 23, size: 19, italic: true, color: '#493b72', fill: '#f0eaf7', radius: 12 })],
    'two-columns': [makeEditorialBlock('text', { text: 'Colonne gauche…', x: 7, y, w: 40, h: 38, size: 15 }), makeEditorialBlock('text', { text: 'Colonne droite…', x: 53, y, w: 40, h: 38, size: 15 })],
    callout: [makeEditorialBlock('shape', { shape: 'round', label: 'À retenir : ajoutez votre note ici.', x: 10, y, w: 80, h: 22, size: 16, bold: true, color: '#365314', fill: '#ecfccb', radius: 12 })]
  };
  const blocks = templates[template];
  if (!blocks) return;
  existing.push(...blocks);
  state.editorSelectedBlock = blocks[0].id;
  updateEditorCanvas(); syncEditorCanvas(); recordEditorHistory();
  const selector = document.querySelector('[data-editor-template]');
  if (selector) selector.value = '';
}
app.addEventListener('change', (event) => {
  const picker = event.target.closest('[data-editor-template]');
  if (picker?.value) insertEditorialTemplate(picker.value);
});
app.addEventListener('click', (event) => {
  const addPage = event.target.closest('[data-editor-add-page]');
  const duplicatePage = event.target.closest('[data-editor-duplicate-page]');
  const preferenceButton = event.target.closest('[data-editor-pref]');
  if (preferenceButton) {
    const name = preferenceButton.dataset.editorPref;
    setEditorUiPreference(name, preferenceButton.getAttribute('aria-pressed') !== 'true');
    return;
  }
  if (addPage || duplicatePage) {
    if (!Array.isArray(state.editorPages)) state.editorPages = [];
    if (duplicatePage) {
      const current = state.editorPages[state.editorPageIndex] || { blocks: [] };
      state.editorPages.splice(state.editorPageIndex + 1, 0, JSON.parse(JSON.stringify(current)));
    } else {
      state.editorPages.splice(state.editorPageIndex + 1, 0, { background: '#ffffff', blocks: [] });
    }
    state.editorPageIndex += 1;
    state.editorSelectedBlock = null;
    updateEditorCanvas(); syncEditorCanvas(); recordEditorHistory();
    const canvas = document.querySelector('#plume-editor-canvas');
    if (canvas) canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
document.addEventListener('keydown', (event) => {
  if (!document.querySelector('.text-editor-shell') || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.key.toLowerCase() === 'z') {
    event.preventDefault(); travelEditorHistory(event.shiftKey ? 1 : -1); return;
  }
  if (mod && event.key.toLowerCase() === 'y') {
    event.preventDefault(); travelEditorHistory(1); return;
  }
  if (mod && event.key.toLowerCase() === 's') {
    event.preventDefault();
    const form = document.querySelector('#work-form');
    if (form) form.requestSubmit(form.querySelector('[name="intent"][value="draft"]') || undefined);
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    const selected = state.editorSelectedBlock;
    if (!selected) return;
    const page = state.editorPages[state.editorPageIndex];
    if (!page) return;
    page.blocks = (page.blocks || []).filter((block) => block.id !== selected);
    state.editorSelectedBlock = null;
    updateEditorCanvas(); syncEditorCanvas(); recordEditorHistory();
  }
});

// Affiche immédiatement l’application : l’attente de la session Supabase ne doit pas laisser l’écran de démarrage bloqué.
render();

if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      showAuth('reset');
      return;
    }
    state.user = session?.user || null;
    render();
    Promise.resolve().then(async () => {
      if (state.user) { await ensureProfile(state.user); await loadMyWorks(); }
      else state.myWorks = [];
      await loadPublicWorks();
      render();
    });
  });
  supabase.auth.getSession().then(async ({ data }) => {
    state.user = data.session?.user || null;
    if (state.user) { await ensureProfile(state.user); await loadMyWorks(); }
    await loadPublicWorks();
    render();
  }).catch(() => render());
} else {
  render();
}
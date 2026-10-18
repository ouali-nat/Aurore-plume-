import { createClient } from '@supabase/supabase-js';
import './style.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
const toastRoot = document.querySelector('#toast-root');

const demoWorks = [
  { id: 'demo-1', demo: true, title: 'La lumière entre par les phrases', subtitle: 'Notes sur le courage tranquille', genre: 'Carnet', summary: 'Un texte bref sur ces petits recommencements que personne ne voit, mais qui changent tout.', body: 'Il y a des matins qui ne font pas de bruit. Ils posent seulement une lumière douce sur la table, comme pour nous rappeler que recommencer peut aussi être un geste calme.\n\nJ’ai longtemps cru qu’il fallait attendre le grand élan. Maintenant, j’apprends à faire confiance aux pages modestes : une ligne, puis une autre. La suite finit souvent par nous rejoindre.', plume_profiles: { display_name: 'Exemple fictif', handle: 'aperçu' } },
  { id: 'demo-2', demo: true, title: 'Au bord de la saison', subtitle: 'Poème — extrait de démonstration', genre: 'Poésie', summary: 'Une promenade entre les pluies, les souvenirs et ce que l’on choisit de garder.', body: 'Le vent replie la cour / dans le silence des feuilles. / La saison change de nom / sans nous demander la permission.', plume_profiles: { display_name: 'Exemple fictif', handle: 'aperçu' } },
  { id: 'demo-3', demo: true, title: 'Le carnet des choses simples', subtitle: 'Fragments d’un quotidien attentif', genre: 'Fragments', summary: 'Des fragments courts pour apprendre à regarder le monde d’un peu plus près.', body: 'Le voisin a réparé sa chaise. La petite fille a partagé sa mangue. Une vieille chanson a traversé la cour. Ce n’était pas une journée extraordinaire. C’était mieux : une journée habitée.', plume_profiles: { display_name: 'Exemple fictif', handle: 'aperçu' } }
];

const state = { user: null, view: 'discover', publicWorks: [], myWorks: [], myVideos: [], editing: null, editingVideo: null, workspaceTab: 'textes', showCreateForm: false, showDraftCreate: false, editorOpen: false, editorTab: 'cover', editorCoverPreview: null, editorPages: [], editorPageIndex: 0, editorSelectedBlock: null, myCreations: [], editingCreation: null, search: '', storageFiles: [], r2PickerOpen: false, r2PendingRender: false };

const e = (value = '') => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const authorOf = (work) => Array.isArray(work.plume_profiles) ? work.plume_profiles[0] : (work.plume_profiles || null);
const formatDate = (value) => value ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Récemment';
const words = (value = '') => (String(value).trim().match(/\S+/g) || []).length;
const initials = (value = '') => value.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'A';

function toast(message, kind = 'success') {
  toastRoot.innerHTML = '<div class="toast toast-' + e(kind) + '">' + e(message) + '</div>';
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => { toastRoot.innerHTML = ''; }, 4200);
}

function shell(content) {
  if (state.editorOpen) {
    app.innerHTML = `<main class="editor-only-shell">${content}</main>`;
    return;
  }
  const nav = [
    ['discover', 'Découvrir'],
    ['library', 'La bibliothèque'],
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
  const works = state.publicWorks.length ? state.publicWorks : demoWorks;
  shell(`
    <section class="hero-wrap">
      <div class="hero container">
        <div class="hero-copy">
          <div class="eyebrow"><span class="eyebrow-dot"></span> L’atelier littéraire d’Aurore</div>
          <h1>Les mots trouvent <em>leur place.</em></h1>
          <p class="hero-lead">Un espace pour déposer une idée, lui donner forme et faire grandir vos textes. Écrivez à votre rythme, sans perdre le fil.</p>
          <div class="hero-actions">
            <button class="button button-primary button-large" data-view="atelier">Ouvrir mon atelier <span aria-hidden="true">↗</span></button>
            <button class="button button-outline button-large" data-view="library">Explorer les textes <span aria-hidden="true">↓</span></button>
          </div>
          <div class="hero-note"><span class="note-avatar">✳</span><span><strong>Votre voix, votre rythme.</strong><small>Brouillons personnels · Relecture humaine · Publication choisie</small></span></div>
        </div>
        <div class="hero-art" aria-label="Aperçu d’une page d’écriture">
          <div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div>
          <div class="paper-back paper-back-one"></div><div class="paper-back paper-back-two"></div>
          <div class="paper-card">
            <div class="paper-top"><span>CAHIER N° 01</span><span class="paper-star">✳</span></div>
            <p class="paper-small">Une note à garder</p>
            <h2>« Il suffit parfois<br>de commencer<br><em>par une phrase.</em> »</h2>
            <div class="paper-rule"></div>
            <p class="paper-foot">Les idées deviennent des histoires quand on leur laisse le temps.</p>
            <div class="paper-signature">aurore plume <span>✦</span></div>
          </div>
          <div class="floating-note floating-top"><span class="floating-icon">✎</span><span><b>Un espace à soi</b><small>Gardez vos brouillons</small></span></div>
          <div class="floating-note floating-bottom"><span class="floating-icon soft">♡</span><span><b>Une voix qui compte</b><small>Partagez à votre rythme</small></span></div>
        </div>
      </div>
    </section>
    <section class="trust-strip"><div class="container trust-inner"><span><b>01</b> Écrire sans pression</span><i></i><span><b>02</b> Organiser ses idées</span><i></i><span><b>03</b> Choisir de publier</span><i></i><span class="trust-muted">La publication est toujours relue.</span></div></section>
    <section class="section container">
      <div class="section-heading">
        <div><div class="eyebrow">LE PLAISIR DE CRÉER</div><h2>Un atelier, plusieurs chemins.</h2><p>Que vous écriviez depuis longtemps ou que vous commenciez aujourd’hui, trouvez la bonne place pour vos idées.</p></div>
        <button class="text-link" data-view="atelier">Découvrir mon atelier <span>↗</span></button>
      </div>
      <div class="feature-grid">
        <article class="feature-card feature-purple"><div class="feature-icon">✎</div><span class="feature-step">01 / CRÉER</span><h3>Écrivez, simplement.</h3><p>Commencez un texte, enrichissez-le au fil des jours et retrouvez vos brouillons dans un espace personnel.</p><button data-view="atelier" class="feature-link">Commencer à écrire <span>↗</span></button><span class="feature-watermark">Aa</span></article>
        <article class="feature-card feature-cream"><div class="feature-icon">⌑</div><span class="feature-step">02 / CULTIVER</span><h3>Donnez forme à vos idées.</h3><p>Classez vos textes par genre, ajoutez un résumé et prenez le temps de trouver votre voix.</p><button data-view="atelier" class="feature-link">Organiser mes textes <span>↗</span></button><span class="feature-watermark">✳</span></article>
        <article class="feature-card feature-green"><div class="feature-icon">↗</div><span class="feature-step">03 / PARTAGER</span><h3>Publiez quand c’est prêt.</h3><p>Proposez votre texte à une relecture humaine. Rien n’est publié automatiquement.</p><button data-view="atelier" class="feature-link">Comprendre le parcours <span>↗</span></button><span class="feature-watermark">✦</span></article>
      </div>
    </section>
    <section class="section library-section" id="library-section">
      <div class="container">
        <div class="section-heading">
          <div><div class="eyebrow">PAGES À DÉCOUVRIR</div><h2>Des mots qui font leur chemin.</h2><p>Une bibliothèque appelée à grandir avec les textes relus et partagés par leurs auteur·rices.</p></div>
          <button class="text-link" data-view="library">Toute la bibliothèque <span>↗</span></button>
        </div>
        ${state.publicWorks.length ? '<div class="live-note"><span class="live-dot"></span> Textes publiés et visibles sur Aurore Plume</div>' : '<div class="live-note demo-note"><span class="live-dot"></span> Aperçus fictifs — la bibliothèque s’ouvrira aux premiers textes validés.</div>'}
        <div class="work-grid">${works.slice(0, 3).map((work) => workCard(work)).join('')}</div>
      </div>
    </section>
    <section class="closing-band container"><div class="closing-spark">✳</div><div><p class="eyebrow">LA PREMIÈRE PHRASE EST LA PLUS IMPORTANTE</p><h2>Votre prochaine page vous attend.</h2><p>Gardez vos idées en mouvement. Le reste vient en écrivant.</p></div><button class="button button-light button-large" data-view="atelier">Commencer un texte <span>↗</span></button><div class="closing-orb"></div></section>
  `);
}

function renderLibrary() {
  const works = state.publicWorks.length ? state.publicWorks : demoWorks;
  const filtered = works.filter((work) => [work.title, work.subtitle, work.summary, work.genre, authorOf(work)?.display_name].join(' ').toLowerCase().includes(state.search.toLowerCase()));
  shell(`
    <section class="page-hero container">
      <div class="eyebrow"><span class="eyebrow-dot"></span> LA BIBLIOTHÈQUE</div>
      <h1>Des pages à <em>rencontrer.</em></h1>
      <p>Parcourez les textes rendus publics après relecture. Chaque voix a sa manière de regarder le monde.</p>
      <label class="search-field"><span>⌕</span><input id="library-search" type="search" placeholder="Rechercher un titre, un genre, une idée…" value="${e(state.search)}" autocomplete="off"><kbd>/</kbd></label>
    </section>
    <section class="section container library-results">
      <div class="results-heading"><div><span class="eyebrow">LECTURE LIBRE</span><h2>${state.publicWorks.length ? 'Textes publiés' : 'Un avant-goût de la bibliothèque'}</h2></div><span class="result-count">${filtered.length} ${filtered.length > 1 ? 'textes' : 'texte'}</span></div>
      ${state.publicWorks.length ? '' : '<div class="notice notice-demo">Les cartes marquées « Aperçu fictif » servent uniquement à présenter le design. Les contenus réels apparaîtront ici après leur validation éditoriale.</div>'}
      ${filtered.length ? `<div class="work-grid">${filtered.map((work) => workCard(work)).join('')}</div>` : '<div class="empty-state"><span>⌕</span><h3>Aucun texte ne correspond.</h3><p>Essayez un autre titre ou un genre différent.</p></div>'}
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
function parseEditorPages(body = '') {
  const raw = String(body || '');
  if (raw.startsWith(EDITOR_DOCUMENT_PREFIX)) { try { const pages = JSON.parse(raw.slice(EDITOR_DOCUMENT_PREFIX.length)); if (Array.isArray(pages) && pages.length) return pages.map((page) => ({ blocks: Array.isArray(page.blocks) ? page.blocks : [] })); } catch {} }
  return [{ blocks: raw ? [{ id: 'text-' + Date.now(), type: 'text', x: 9, y: 10, w: 82, h: 34, text: raw, font: 'Georgia', size: 18, color: '#302a35', align: 'left', bold: false, italic: false }] : [] }];
}
function editorPagesToBody() { return EDITOR_DOCUMENT_PREFIX + JSON.stringify(state.editorPages.length ? state.editorPages : [{ blocks: [] }]); }
function editorCanvasMarkup() {
  const page = state.editorPages[state.editorPageIndex] || { blocks: [] };
  return page.blocks.map((b) => {
    const style = 'left:'+Number(b.x??9)+'%;top:'+Number(b.y??10)+'%;width:'+Number(b.w??82)+'%;height:'+Number(b.h??24)+'%;color:'+e(b.color||'#302a35')+';font-family:'+e(b.font||'Georgia')+';font-size:'+Number(b.size||18)+'px;text-align:'+e(b.align||'left')+';font-weight:'+(b.bold?'700':'400')+';font-style:'+(b.italic?'italic':'normal')+';';
    const selected = b.id === state.editorSelectedBlock ? ' is-selected' : '';
    const handles = '<button type="button" class="plume-block-move" aria-label="Déplacer le bloc">⠿</button>'+['nw','n','ne','e','se','s','sw','w'].map((dir)=>'<button type="button" class="plume-block-resize resize-'+dir+'" data-resize-dir="'+dir+'" aria-label="Redimensionner"></button>').join('');
    if (b.type === 'image') return '<div class="plume-canvas-block plume-canvas-image'+selected+'" data-block-id="'+e(b.id)+'" style="'+style+'"><img alt="Image ajoutée" src="'+e(b.src||'')+'">'+handles+'</div>';
    if (b.type === 'shape') return '<div class="plume-canvas-block plume-canvas-shape shape-'+e(b.shape||'round')+selected+'" data-block-id="'+e(b.id)+'" style="'+style+'"><span>'+e(b.label||'')+'</span>'+handles+'</div>';
    return '<div class="plume-canvas-block plume-canvas-text'+selected+'" data-block-id="'+e(b.id)+'" style="'+style+'"><button type="button" class="plume-block-move" aria-label="Déplacer la zone de texte">⠿</button><div class="plume-canvas-text-content" contenteditable="true" spellcheck="true" data-block-text="'+e(b.id)+'">'+e(b.text||'').replace(/\n/g,'<br>')+'</div>'+handles+'</div>';
  }).join('');
}
function updateEditorCanvas() {
  const canvas=document.querySelector('#plume-editor-canvas'); if(canvas) canvas.innerHTML=editorCanvasMarkup();
  const count=document.getElementById('editor-page-count'); if(count&&state.editorTab==='manuscript') count.textContent=String(state.editorPageIndex+1).padStart(2,'0')+' / '+String(state.editorPages.length).padStart(2,'0');
  const prev=document.querySelector('[data-editor-page-prev]'); const next=document.querySelector('[data-editor-page-next]');
  if(prev&&state.editorTab==='manuscript') prev.disabled=state.editorPageIndex===0;
  if(next&&state.editorTab==='manuscript') next.disabled=false;
}
function syncEditorCanvas() {
  const field=document.querySelector('#work-form [name="body"]'); if(field) field.value=editorPagesToBody();
  updateEditorPreviews(); const label=document.querySelector('#editor-save-label'); if(label) label.textContent='Modifications à enregistrer';
}
function addEditorBlock(type, shape='round') {
  if(!state.editorPages.length) state.editorPages=[{blocks:[]}];
  const page=state.editorPages[state.editorPageIndex]||(state.editorPages[state.editorPageIndex]={blocks:[]});
  const id='block-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
  const block=type==='shape'?{id,type,shape,x:12,y:14+(page.blocks.length%4)*8,w:35,h:13,color:'#67527f',label:['line','circle'].includes(shape)?'':'Votre élément'}:{id,type:'text',x:10,y:12+(page.blocks.length%5)*7,w:78,h:24,text:'',font:'Georgia',size:18,color:'#302a35',align:'left',bold:false,italic:false};
  page.blocks.push(block); state.editorSelectedBlock=id; updateEditorCanvas(); syncEditorCanvas();
  if(type==='text') document.querySelector('[data-block-text="'+id+'"]')?.focus();
}
function navigateCanvasPage(direction) {
  if(!state.editorPages.length) state.editorPages=[{blocks:[]}];
  const next=state.editorPageIndex+direction; if(next<0)return;
  if(next>=state.editorPages.length) state.editorPages.push({blocks:[]});
  state.editorPageIndex=next; state.editorSelectedBlock=null; updateEditorCanvas();
}

const DEFAULT_EDITORIAL_SETTINGS = { page_format: 'A5', body_font: 'Georgia', font_size: 12, line_height: 1.7, margins: 'standard' };

function manuscriptPreviewHtml(value = '') {
  const raw = String(value || '');
  if (raw.startsWith(EDITOR_DOCUMENT_PREFIX)) {
    try {
      const pages = JSON.parse(raw.slice(EDITOR_DOCUMENT_PREFIX.length));
      return pages.map((page) => '<section class="plume-rendered-page">' + (page.blocks || []).map((b) => {
        const style = 'left:'+Number(b.x??9)+'%;top:'+Number(b.y??10)+'%;width:'+Number(b.w??82)+'%;height:'+Number(b.h??24)+'%;color:'+e(b.color||'#302a35')+';font-family:'+e(b.font||'Georgia')+';font-size:'+Number(b.size||18)+'px;text-align:'+e(b.align||'left')+';font-weight:'+(b.bold?'700':'400')+';font-style:'+(b.italic?'italic':'normal')+';';
        if (b.type === 'image') return '<div class="plume-rendered-block plume-rendered-image" style="'+style+'"><img alt="" src="'+e(b.src||'')+'"></div>';
        if (b.type === 'shape') return '<div class="plume-rendered-block plume-rendered-shape shape-'+e(b.shape||'round')+'" style="'+style+'">'+e(b.label||'')+'</div>';
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
  document.querySelectorAll('[data-editor-tab]').forEach((button) => {
    const active = button.dataset.editorTab === state.editorTab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.editor-tab-panel').forEach((panel) => {
    panel.hidden = panel.id !== 'editor-panel-' + state.editorTab;
  });
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
  if (previewBody) previewBody.innerHTML = manuscriptPreviewHtml(body) || '<p class="preview-empty">Votre manuscrit apparaîtra ici au fur et à mesure de l’écriture.</p>';
  const previewSummary = document.getElementById('editor-preview-summary');
  if (previewSummary) { previewSummary.textContent = summary; previewSummary.hidden = !summary; }
  const counter = document.getElementById('word-count');
  if (counter) counter.textContent = words(body);
  const paperCounter = document.getElementById('editor-paper-word-count');
  if (paperCounter) paperCounter.textContent = words(body) + ' mots';
  const settings = {
    page_format: value('page_format', DEFAULT_EDITORIAL_SETTINGS.page_format),
    body_font: value('body_font', DEFAULT_EDITORIAL_SETTINGS.body_font),
    font_size: value('font_size', DEFAULT_EDITORIAL_SETTINGS.font_size),
    line_height: value('line_height', DEFAULT_EDITORIAL_SETTINGS.line_height),
    margins: value('margins', DEFAULT_EDITORIAL_SETTINGS.margins)
  };
  const paper = document.getElementById('editor-preview-paper');
  if (paper) {
    paper.style.setProperty('--preview-font', settings.body_font);
    paper.style.setProperty('--preview-size', settings.font_size + 'pt');
    paper.style.setProperty('--preview-leading', settings.line_height);
    paper.dataset.format = settings.page_format;
    paper.dataset.margins = settings.margins;
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
  const settings = { ...DEFAULT_EDITORIAL_SETTINGS, ...(work.editorial_settings && typeof work.editorial_settings === 'object' ? work.editorial_settings : {}) };
  const coverKey = work.cover_media_key || '';
  shell(`
    <section class="text-editor-shell">
      <div class="text-editor-top">
        <button type="button" class="editor-exit-button" data-editor-back aria-label="Fermer l’éditeur">×</button>
        <div class="text-editor-heading">
          <h1 class="editor-document-title">${e(work.title || 'Sans titre')}</h1>
          <span class="editor-save-state"><span class="save-state-dot"></span><span id="editor-save-label">Brouillon privé</span></span>
        </div>
      </div>
      <div class="editor-commandbar" aria-label="Outils de l’atelier">
        <div class="editor-command-group">
          <button type="button" class="editor-command" data-editor-tool="text"><span aria-hidden="true">T</span><b>Zone de texte</b></button>
          <button type="button" class="editor-command" data-editor-tool="elements"><span aria-hidden="true">◇</span><b>Éléments</b></button>
          <button type="button" class="editor-command" data-editor-tool="images"><span aria-hidden="true">▧</span><b>Images</b></button>
          <button type="button" class="editor-command" data-editor-tool="page"><span aria-hidden="true">▤</span><b>Page</b></button><button type="button" class="editor-command editor-cover-shortcut" data-editor-tab="cover"><span aria-hidden="true">▧</span><b>Couverture</b></button>
        </div>
        <div class="editor-page-nav">
          <button type="button" data-editor-page-prev ${state.editorTab === 'cover' ? 'disabled' : ''} aria-label="Étape précédente">←</button>
          <span id="editor-page-count">01 / 04</span>
          <button type="button" data-editor-page-next aria-label="Étape suivante">→</button>
        </div>
      </div>
      <form id="work-form" class="dedicated-work-form">
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
              <input type="file" id="plume-image-file" accept="image/*" hidden><textarea name="body" class="plume-document-store" hidden>${e(work.body || '')}</textarea><div class="plume-editor-workspace"><div class="plume-canvas-desk"><div class="plume-canvas-paper" id="plume-editor-canvas" aria-label="Page éditable">${editorCanvasMarkup()}</div><div class="plume-color-popover" id="plume-color-popover" hidden><strong>Couleur du bloc</strong><div class="plume-color-swatches"><button data-block-color="#67527f" style="--swatch:#67527f"></button><button data-block-color="#d9c7ef" style="--swatch:#d9c7ef"></button><button data-block-color="#e7b8c4" style="--swatch:#e7b8c4"></button><button data-block-color="#e9d5b0" style="--swatch:#e9d5b0"></button><button data-block-color="#b9d9c1" style="--swatch:#b9d9c1"></button><button data-block-color="#a9c9e8" style="--swatch:#a9c9e8"></button><button data-block-color="#ffffff" style="--swatch:#ffffff"></button><button data-block-color="#302a35" style="--swatch:#302a35"></button></div><label>Personnaliser <input type="color" id="plume-custom-color" value="#67527f"></label></div></div><aside class="plume-elements-panel" id="plume-elements-panel" hidden><div class="plume-elements-heading"><strong>Éléments</strong><button type="button" data-elements-close aria-label="Fermer">×</button></div><p>Ajoutez des formes à la page, puis déplacez-les ou redimensionnez-les.</p><div class="plume-elements-grid"><button type="button" data-add-shape="round"><span class="shape-preview round"></span>Bloc arrondi</button><button type="button" data-add-shape="circle"><span class="shape-preview circle"></span>Cercle</button><button type="button" data-add-shape="square"><span class="shape-preview square"></span>Rectangle</button><button type="button" data-add-shape="line"><span class="shape-preview line"></span>Ligne</button><button type="button" data-add-shape="quote"><span class="shape-preview quote">“</span>Citation</button><button type="button" data-add-shape="label"><span class="shape-preview label">Aa</span>Étiquette</button></div></aside></div>
              <div class="editor-paper-footer"><span>Une phrase après l’autre.</span><span id="editor-paper-word-count">${words(work.body || '')} mots</span></div>
            </div>
          </div>
          <p class="editor-hint"><span>✳</span> Votre texte reste privé. Les modifications sont conservées lorsque vous enregistrez le brouillon.</p>
        </section>
        <section class="editor-tab-panel cover-panel" id="editor-panel-cover" role="tabpanel" ${state.editorTab === 'cover' ? '' : 'hidden'}>
          <div class="cover-editor-grid">
            <div class="editor-cover-preview-stage" id="editor-cover-preview-stage">
              <div class="editor-cover-placeholder"><span>a.</span><small>AURORE PLUME · ${e(work.genre || 'Texte libre')}</small><h2 id="editor-cover-title">${e(work.title || 'Titre de votre œuvre')}</h2><p id="editor-cover-subtitle" ${work.subtitle ? '' : 'hidden'}>${e(work.subtitle || '')}</p><i>✳</i></div>
              <img id="editor-cover-image" alt="Aperçu de la couverture importée" ${coverKey ? '' : 'hidden'}>
              <div class="editor-cover-overlay"><span id="editor-cover-genre">${e(work.genre || 'Texte libre')}</span><h3>${e(state.user?.user_metadata?.display_name || state.user?.email?.split('@')[0] || 'Auteur')}</h3></div>
            </div>
            <div class="cover-editor-controls"><label class="cover-upload-button">▧ <span>Importer une couverture</span><input id="editor-cover-file" name="cover_file" type="file" accept="image/*"></label></div>
          </div>
        </section>
        <section class="editor-tab-panel layout-panel" id="editor-panel-layout" role="tabpanel" ${state.editorTab === 'layout' ? '' : 'hidden'}>
          <div class="editor-panel-intro"><div><span class="eyebrow">PRÉPARATION DU LIVRE</span><h2>Une page qui vous ressemble.</h2><p>Ces réglages sont enregistrés avec votre œuvre et utilisés dans l’aperçu avant impression PDF.</p></div></div>
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
          <div class="editor-panel-intro"><div><span class="eyebrow">VÉRIFICATION FINALE</span><h2>Votre œuvre prend forme.</h2><p>Vérifiez la couverture et la typographie avant de lancer l’impression ou l’enregistrement en PDF.</p></div><button class="button button-outline" type="button" data-editor-print>Imprimer / PDF ↗</button></div>
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
        <div class="plume-typography-bar" aria-label="Mise en forme du texte"><label>Police<select data-text-style="font"><option>Georgia</option><option>Arial</option><option>Times New Roman</option><option>Verdana</option><option>Courier New</option></select></label><label>Taille<select data-text-style="size"><option value="12">12</option><option value="14">14</option><option value="16">16</option><option value="18" selected>18</option><option value="22">22</option><option value="28">28</option><option value="36">36</option><option value="48">48</option></select></label><button type="button" data-text-style="bold" aria-label="Gras"><b>B</b></button><button type="button" data-text-style="italic" aria-label="Italique"><i>I</i></button><label>Couleur<input type="color" value="#302a35" data-text-style="color"></label><button type="button" data-text-style="align-left">☰</button><button type="button" data-text-style="align-center">≡</button><button type="button" data-text-style="align-right">☷</button><button type="button" data-block-delete>Supprimer l’élément</button></div>
        <div class="editor-actionbar">
          <button class="button button-primary" name="intent" value="draft" type="submit">Enregistrer le brouillon <span>↗</span></button>
          <button class="button button-outline" name="intent" value="review" type="submit">Proposer à la relecture</button>
          <button class="button button-quiet editor-print-action" type="button" data-editor-print>Exporter en PDF</button>
        </div>
      </form>
      <style id="editor-print-page-style"></style>
    </section>
  `);
  state.editorPages = parseEditorPages(work.body || ''); state.editorPageIndex = 0; state.editorSelectedBlock = null;
  updateEditorCanvas(); updateEditorPreviews();
  const workForm = document.querySelector('#work-form');
  const markEditorDirty = () => {
    updateEditorPreviews();
    const saveLabel = document.querySelector('#editor-save-label');
    if (saveLabel) saveLabel.textContent = 'Modifications à enregistrer';
  };
  workForm?.addEventListener('input', markEditorDirty);
  workForm?.addEventListener('change', markEditorDirty);
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
        <p>Connectez-vous pour garder vos idées, rédiger vos textes et suivre les propositions de relecture dans un espace qui vous appartient.</p>
        <div class="workspace-benefits"><span>✓ Brouillons privés</span><span>✓ Édition à tout moment</span><span>✓ Publication après relecture</span></div>
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
        <div class="panel-top"><div><span class="eyebrow">MON CARNET</span><h2>Brouillon privé <span class="count-pill">${state.myWorks.length}</span></h2></div><button class="button button-primary" data-action="new-text">Nouveau texte +</button></div>
        ${state.myWorks.length ? `<div class="my-work-list">${state.myWorks.map((work) => { const [label, cls] = statusLabel(work); return `<article class="my-work-item draft-work-item" data-edit-id="${e(work.id)}"><div class="my-work-symbol">Aa</div><div class="my-work-copy"><h3>${e(work.title)}</h3><p class="draft-card-summary">${e(work.summary || 'Aucun résumé pour le moment.')}</p><p class="draft-card-meta">${e(work.genre || 'Texte libre')} · ${e(formatDate(work.updated_at || work.created_at))}</p><span class="status-pill ${cls}">${e(label)}</span></div><button class="button button-quiet text-edit-button" data-edit-id="${e(work.id)}" title="Éditer cette œuvre" aria-label="Éditer ${e(work.title)}">Éditer ↗</button></article>`; }).join('')}</div>` : '<div class="empty-state empty-works"><span>✎</span><h3>Votre carnet est prêt.</h3><p>Le premier brouillon n’a pas besoin d’être parfait. Il a seulement besoin d’exister.</p></div>'}
        <div class="private-note"><span>♧</span><p><strong>Votre espace est privé.</strong><br>Vos brouillons restent visibles uniquement par vous jusqu’à ce qu’un texte soit validé et rendu public.</p></div>
        ${supabase ? '' : '<div class="notice notice-error">La configuration de Supabase manque. Ajoutez les variables Vercel indiquées dans le README.</div>'}
      </aside>
    </section>
  `);
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
  if (!supabase) return;
  const { data, error } = await supabase.from('plume_works')
    .select('id,title,subtitle,summary,genre,body,created_at,published_at,author_id,plume_profiles(display_name,handle)')
    .eq('publication_status', 'published').eq('is_public', true)
    .order('published_at', { ascending: false }).limit(24);
  if (error) { console.warn('Bibliothèque Plume', error.message); return; }
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

function openRead(id) {
  const work = state.publicWorks.find((item) => item.id === id) || demoWorks.find((item) => item.id === id);
  if (!work) return;
  const author = authorOf(work);
  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="read-overlay"><article class="read-modal" role="dialog" aria-modal="true" aria-labelledby="read-title">
      <button class="modal-close" data-action="close-modal" aria-label="Fermer">×</button>
      <div class="read-cover"><span class="cover-mark">a.</span><span class="cover-category">${e(work.genre || 'Texte')}</span><span class="cover-lines"></span></div>
      ${work.demo ? '<div class="notice notice-demo">Texte d’illustration fictif — aucune œuvre d’un auteur réel.</div>' : ''}
      <div class="read-meta"><span>${e(work.genre || 'Texte')}</span><span>${e(formatDate(work.published_at || work.created_at))}</span></div>
      <h2 id="read-title">${e(work.title)}</h2>${work.subtitle ? `<p class="read-subtitle">${e(work.subtitle)}</p>` : ''}
      <p class="read-byline">Par <strong>${e(author?.display_name || 'Aurore Plume')}</strong></p>
      <div class="read-body">${e(work.body || 'Ce texte ne contient pas encore de version lisible.')}</div>
      <div class="read-end">✳ <span>Merci d’avoir pris le temps de lire.</span></div>
    </article></div>`;
}

app.addEventListener('click', async (event) => {
  const editorTabButton = event.target.closest('[data-editor-tab]');
  if (editorTabButton) { activateEditorTab(editorTabButton.dataset.editorTab); return; }
  if (event.target.closest('[data-editor-page-prev]')) { if(state.editorTab!=='manuscript')activateEditorTab('manuscript');navigateCanvasPage(-1);return; }
  if (event.target.closest('[data-editor-page-next]')) { if(state.editorTab!=='manuscript')activateEditorTab('manuscript');navigateCanvasPage(1);return; }
  const editorTool = event.target.closest('[data-editor-tool]');
  if (editorTool) {
    const tool=editorTool.dataset.editorTool;
    if(tool==='text'){activateEditorTab('manuscript');addEditorBlock('text');}
    else if(tool==='elements'){activateEditorTab('manuscript');const panel=document.querySelector('#plume-elements-panel');if(panel)panel.hidden=!panel.hidden;}
    else if(tool==='images'){activateEditorTab('manuscript');document.querySelector('#plume-image-file')?.click();}
    else if(tool==='page')activateEditorTab('layout');
    return;
  }
  if(event.target.closest('[data-elements-close]')){const panel=document.querySelector('#plume-elements-panel');if(panel)panel.hidden=true;return;}
  const shapeButton=event.target.closest('[data-add-shape]');if(shapeButton){addEditorBlock('shape',shapeButton.dataset.addShape);return;}
  if(event.target.closest('[data-block-delete]')){const page=state.editorPages[state.editorPageIndex];if(page&&state.editorSelectedBlock)page.blocks=page.blocks.filter((b)=>b.id!==state.editorSelectedBlock);state.editorSelectedBlock=null;updateEditorCanvas();syncEditorCanvas();return;}
  const styleButton=event.target.closest('[data-text-style]');
  if(styleButton){if(styleButton.tagName!=='BUTTON')return;const block=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((b)=>b.id===state.editorSelectedBlock);if(!block||block.type!=='text'){toast('Sélectionnez une zone de texte.');return;}const kind=styleButton.dataset.textStyle;if(kind==='bold')block.bold=!block.bold;else if(kind==='italic')block.italic=!block.italic;else if(kind.startsWith('align-'))block.align=kind.slice(6);updateEditorCanvas();syncEditorCanvas();return;}

  const insertTokenButton = event.target.closest('[data-insert-token]');
  if (insertTokenButton) { insertEditorToken(insertTokenButton.dataset.insertToken); return; }
  if (event.target.closest('[data-draft-cancel]')) { state.showDraftCreate = false; render(); return; }
  if (event.target.closest('[data-editor-back]')) { state.editorOpen = false; state.showDraftCreate = false; state.editing = null; state.showCreateForm = false; if (state.editorCoverPreview) URL.revokeObjectURL(state.editorCoverPreview); state.editorCoverPreview = null; render(); return; }
  if (event.target.closest('[data-editor-print]')) { activateEditorTab('preview'); window.setTimeout(() => window.print(), 120); return; }
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

let plumeBlockDrag=null;
app.addEventListener('pointerdown',(event)=>{const node=event.target.closest('.plume-canvas-block'),canvas=event.target.closest('#plume-editor-canvas');if(!node||!canvas)return;const block=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((b)=>b.id===node.dataset.blockId);if(!block)return;const resize=event.target.closest('[data-resize-dir]'),moveGrip=event.target.closest('.plume-block-move');if(event.target.closest('[contenteditable="true"]')&&!resize&&!moveGrip)return;state.editorSelectedBlock=block.id;document.querySelectorAll('.plume-canvas-block').forEach((x)=>x.classList.toggle('is-selected',x.dataset.blockId===block.id));const pop=document.querySelector('#plume-color-popover');if(pop){pop.hidden=!(block.type==='shape'||block.type==='image');if(!pop.hidden){pop.style.left=Math.min(Math.max(8,event.clientX+12),window.innerWidth-220)+'px';pop.style.top=Math.min(Math.max(8,event.clientY+12),window.innerHeight-170)+'px';const custom=document.querySelector('#plume-custom-color');if(custom)custom.value=block.fill||block.color||'#67527f';}}plumeBlockDrag={id:block.id,startX:event.clientX,startY:event.clientY,x:Number(block.x),y:Number(block.y),w:Number(block.w),h:Number(block.h),cw:canvas.clientWidth,ch:canvas.clientHeight,dir:resize?.dataset.resizeDir||'',moving:Boolean(moveGrip)||(!resize&&!event.target.closest('[contenteditable="true"]'))};if(plumeBlockDrag.moving||plumeBlockDrag.dir)event.preventDefault();});
app.addEventListener('pointermove',(event)=>{if(!plumeBlockDrag)return;const b=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((x)=>x.id===plumeBlockDrag.id);if(!b)return;const dx=(event.clientX-plumeBlockDrag.startX)/Math.max(1,plumeBlockDrag.cw)*100,dy=(event.clientY-plumeBlockDrag.startY)/Math.max(1,plumeBlockDrag.ch)*100;if(plumeBlockDrag.dir){const d=plumeBlockDrag.dir;let x=plumeBlockDrag.x,y=plumeBlockDrag.y,w=plumeBlockDrag.w,h=plumeBlockDrag.h;if(d.includes('e'))w=Math.max(4,plumeBlockDrag.w+dx);if(d.includes('s'))h=Math.max(3,plumeBlockDrag.h+dy);if(d.includes('w')){w=Math.max(4,plumeBlockDrag.w-dx);x=plumeBlockDrag.x+dx;}if(d.includes('n')){h=Math.max(3,plumeBlockDrag.h-dy);y=plumeBlockDrag.y+dy;}b.x=Math.max(0,Math.min(96,x));b.y=Math.max(0,Math.min(96,y));b.w=Math.max(4,Math.min(100-b.x,w));b.h=Math.max(3,Math.min(100-b.y,h));}else if(plumeBlockDrag.moving){b.x=Math.max(0,Math.min(100-b.w,plumeBlockDrag.x+dx));b.y=Math.max(0,Math.min(100-b.h,plumeBlockDrag.y+dy));}const n=document.querySelector('.plume-canvas-block.is-selected');if(n){n.style.left=b.x+'%';n.style.top=b.y+'%';n.style.width=b.w+'%';n.style.height=b.h+'%';}});
app.addEventListener('pointerup',()=>{if(plumeBlockDrag){plumeBlockDrag=null;syncEditorCanvas();}});
app.addEventListener('input',(event)=>{const n=event.target.closest('[data-block-text]');if(!n)return;const b=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((x)=>x.id===n.dataset.blockText);if(b){b.text=n.innerText;const field=document.querySelector('#work-form [name="body"]');if(field)field.value=editorPagesToBody();updateEditorPreviews();const label=document.querySelector('#editor-save-label');if(label)label.textContent='Modifications à enregistrer';}});
app.addEventListener('click',(event)=>{const swatch=event.target.closest('[data-block-color]');if(swatch){const b=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((x)=>x.id===state.editorSelectedBlock);if(b){if(b.type==='image')b.fill=swatch.dataset.blockColor;else b.color=swatch.dataset.blockColor;syncEditorCanvas();}return;}const n=event.target.closest('.plume-canvas-block');if(n){state.editorSelectedBlock=n.dataset.blockId;document.querySelectorAll('.plume-canvas-block').forEach((x)=>x.classList.toggle('is-selected',x.dataset.blockId===state.editorSelectedBlock));const b=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((x)=>x.id===state.editorSelectedBlock);const pop=document.querySelector('#plume-color-popover');if(pop){pop.hidden=!(b&&(b.type==='shape'||b.type==='image'));if(!pop.hidden){const rect=n.getBoundingClientRect();pop.style.left=Math.min(Math.max(8,rect.left),window.innerWidth-220)+'px';pop.style.top=Math.min(Math.max(8,rect.bottom+8),window.innerHeight-170)+'px';const custom=document.querySelector('#plume-custom-color');if(custom)custom.value=b.fill||b.color||'#67527f';}}}});
app.addEventListener('input',(event)=>{if(event.target.id!=='plume-custom-color')return;const b=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((x)=>x.id===state.editorSelectedBlock);if(!b)return;if(b.type==='image')b.fill=event.target.value;else b.color=event.target.value;syncEditorCanvas();});
let editorTouchStartX = null;
let editorTouchStartY = null;
let editorTouchStartedOnControl = false;
app.addEventListener('touchstart', (event) => {
  if (!state.editorOpen || !event.target.closest('.text-editor-shell') || !event.changedTouches?.length) return;
  editorTouchStartX = event.changedTouches[0].clientX;
  editorTouchStartY = event.changedTouches[0].clientY;
  editorTouchStartedOnControl = Boolean(event.target.closest('button, a, input, select, .plume-canvas-block, .plume-typography-bar, [contenteditable="true"]'));
}, { passive: true });
app.addEventListener('touchend', (event) => {
  if (editorTouchStartX === null || !event.changedTouches?.length) return;
  const dx = event.changedTouches[0].clientX - editorTouchStartX;
  const dy = event.changedTouches[0].clientY - editorTouchStartY;
  const inEditor = event.target.closest('.text-editor-shell');
  if (inEditor && !editorTouchStartedOnControl && Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.35) {
    if (state.editorTab !== 'manuscript') activateEditorTab('manuscript');
    navigateCanvasPage(dx < 0 ? 1 : -1);
  }
  editorTouchStartX = null;
  editorTouchStartY = null;
  editorTouchStartedOnControl = false;
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

app.addEventListener('change', (event) => {
  const styleControl=event.target.closest('[data-text-style]');
  if(styleControl && styleControl.tagName!=='BUTTON'){const block=(state.editorPages[state.editorPageIndex]?.blocks||[]).find((b)=>b.id===state.editorSelectedBlock);if(block&&block.type==='text'){const kind=styleControl.dataset.textStyle;if(kind==='font')block.font=styleControl.value;else if(kind==='size')block.size=Number(styleControl.value);else if(kind==='color')block.color=styleControl.value;updateEditorCanvas();syncEditorCanvas();}}
  const imageInput=event.target;
  if(imageInput instanceof HTMLInputElement&&imageInput.id==='plume-image-file'){
    const file=imageInput.files?.[0];if(!file)return;
    if(!file.type.startsWith('image/')){toast('Choisissez une image.','error');imageInput.value='';return;}
    if(file.size>1500000){toast('Image limitée à 1,5 Mo pour garder le brouillon léger.','error');imageInput.value='';return;}
    const reader=new FileReader();reader.onload=()=>{const page=state.editorPages[state.editorPageIndex];if(page){const id='image-'+Date.now();page.blocks.push({id,type:'image',src:String(reader.result),x:12,y:12,w:58,h:32});state.editorSelectedBlock=id;updateEditorCanvas();syncEditorCanvas();}};reader.readAsDataURL(file);imageInput.value='';return;
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

app.addEventListener('submit', async (event) => {
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
  if (!supabase || !state.user) { showAuth('signin'); return; }
  const form = event.target;
  const data = new FormData(form);
  const intent = event.submitter?.value || 'draft';
  const id = String(data.get('id') || '');
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
  const buttons = [...form.querySelectorAll('button[type="submit"]')];
  buttons.forEach((button) => { button.disabled = true; });
  try {
    if (selectedCover) {
      const safeName = selectedCover.name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-140) || 'couverture';
      uploadedCoverKey = 'covers/' + Date.now() + '-' + safeName;
      await r2Request('/api/storage?key=' + encodeURIComponent(uploadedCoverKey), { method: 'POST', headers: { 'Content-Type': selectedCover.type || 'application/octet-stream' }, body: selectedCover });
      payload.cover_media_key = uploadedCoverKey;
    }
    if (id) {
      const result = await supabase.from('plume_works').update(payload).eq('id', id).eq('author_id', state.user.id);
      if (result.error) throw result.error;
    } else {
      const { updated_at, ...insertPayload } = payload;
      const result = await supabase.from('plume_works').insert({ ...insertPayload, author_id: state.user.id, ...(intent === 'review' ? { submission_requested_at: new Date().toISOString() } : {}) }).select('id').single();
      if (result.error) throw result.error;
    }
    if (uploadedCoverKey && previousCoverKey && previousCoverKey !== uploadedCoverKey) {
      try { await r2Request('/api/storage?key=' + encodeURIComponent(previousCoverKey), { method: 'DELETE' }); } catch (cleanupError) { console.warn('Ancienne couverture non supprimée', cleanupError.message); }
    }
    toast(intent === 'review' ? 'Texte envoyé à la file de relecture.' : 'Brouillon enregistré.');
    state.editing = null; state.editorOpen = false; state.showCreateForm = false;
    if (state.editorCoverPreview) URL.revokeObjectURL(state.editorCoverPreview);
    state.editorCoverPreview = null;
    await loadMyWorks();
    render();
  } catch (error) {
    console.error('Aurore Plume save', error);
    if (uploadedCoverKey) { try { await r2Request('/api/storage?key=' + encodeURIComponent(uploadedCoverKey), { method: 'DELETE' }); } catch {} }
    toast(error.message || 'Le texte n’a pas pu être enregistré.', 'error');
    buttons.forEach((button) => { button.disabled = false; });
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
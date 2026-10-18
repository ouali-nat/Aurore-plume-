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

const state = { user: null, view: 'discover', publicWorks: [], myWorks: [], myVideos: [], editing: null, editingVideo: null, workspaceTab: 'textes', showCreateForm: false, myCreations: [], editingCreation: null, search: '', storageFiles: [], r2PickerOpen: false, r2PendingRender: false };

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
  const editing = state.editing || {};
  if (state.workspaceTab === 'videos') { renderVideoWorkspace(); return; }
  if (GENERIC_CREATION_KINDS.includes(state.workspaceTab)) { renderGenericCreationWorkspace(); return; }
  shell(`
    <section class="workspace-header"><div class="container workspace-title-row"><div><div class="eyebrow"><span class="eyebrow-dot"></span> MON ATELIER</div><h1>Bonjour, ${e((state.user.user_metadata?.display_name || state.user.email?.split('@')[0] || 'auteur').split(' ')[0])}.</h1><p>Chaque texte avance à son rythme. Reprenez là où vous en étiez.</p></div><button class="button button-outline" data-action="signout">Se déconnecter</button></div></section>
    <section class="container workspace-grid">
      
      <div class="editor-panel" ${state.showCreateForm || editing.id ? "" : "hidden"}>
        <div class="panel-top"><div><span class="eyebrow">${editing.id ? 'REPRENDRE UN TEXTE' : 'UNE NOUVELLE PAGE'}</span><h2>${editing.id ? 'Continuer mon texte' : 'Commencer à écrire'}</h2></div><span class="editor-icon">✎</span></div>
        <form id="work-form" class="editor-form">
          <input type="hidden" name="id" value="${e(editing.id || '')}">
          <label>Titre du texte<input name="title" required maxlength="140" placeholder="Le titre qui vous ressemble…" value="${e(editing.title || '')}"></label>
          <label>Sous-titre <span class="optional">facultatif</span><input name="subtitle" maxlength="180" placeholder="Une précision, une intention…" value="${e(editing.subtitle || '')}"></label>
          <div class="form-row"><label>Genre<select name="genre"><option ${(editing.genre || 'Texte libre') === 'Texte libre' ? 'selected' : ''}>Texte libre</option><option ${editing.genre === 'Roman' ? 'selected' : ''}>Roman</option><option ${editing.genre === 'Poésie' ? 'selected' : ''}>Poésie</option><option ${editing.genre === 'Nouvelle' ? 'selected' : ''}>Nouvelle</option><option ${editing.genre === 'Essai' ? 'selected' : ''}>Essai</option><option ${editing.genre === 'Théâtre' ? 'selected' : ''}>Théâtre</option><option ${editing.genre === 'Carnet' ? 'selected' : ''}>Carnet</option><option ${editing.genre === 'Conte' ? 'selected' : ''}>Conte</option></select></label><div class="word-count-box"><span class="word-count-number" id="word-count">${words(editing.body || '')}</span><span>mots</span></div></div>
          <label>Quelques mots sur ce texte <span class="optional">pour le retrouver</span><textarea name="summary" maxlength="1200" rows="2" placeholder="Quelle idée traverse ce texte ?">${e(editing.summary || '')}</textarea></label>
          <label>Votre texte<textarea class="body-editor" name="body" rows="11" placeholder="Laissez venir la première phrase…">${e(editing.body || '')}</textarea></label>
          <div class="editor-actions"><button class="button button-primary" name="intent" value="draft" type="submit">Enregistrer le brouillon <span>↗</span></button><button class="button button-outline" name="intent" value="review" type="submit">Proposer à la relecture</button></div>
          <p class="editor-hint"><span>✳</span> Proposer à la relecture ne publie pas automatiquement votre texte. Une validation humaine est nécessaire.</p>
        </form>
      </div>
      <aside class="my-works-panel">
        <div class="panel-top"><div><span class="eyebrow">MON CARNET</span><h2>Mes textes <span class="count-pill">${state.myWorks.length}</span></h2></div><button class="button button-primary" data-action="new-text">Nouveau texte +</button></div>
        ${state.myWorks.length ? `<div class="my-work-list">${state.myWorks.map((work) => { const [label, cls] = statusLabel(work); return `<article class="my-work-item"><div class="my-work-symbol">Aa</div><div class="my-work-copy"><h3>${e(work.title)}</h3><p>${e(work.genre || 'Texte libre')} · ${e(formatDate(work.updated_at || work.created_at))}</p><span class="status-pill ${cls}">${e(label)}</span></div><button class="icon-button" data-edit-id="${e(work.id)}" title="Modifier le texte" aria-label="Modifier ${e(work.title)}">↗</button></article>`; }).join('')}</div>` : '<div class="empty-state empty-works"><span>✎</span><h3>Votre carnet est prêt.</h3><p>Le premier brouillon n’a pas besoin d’être parfait. Il a seulement besoin d’exister.</p></div>'}
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
  const { data, error } = await supabase.from('plume_creations').select('id,kind,title,description,media_url,category,created_at,updated_at').eq('author_id', state.user.id).order('updated_at', { ascending: false }).limit(100);
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
    <form id="creation-form" class="editor-form"><input type="hidden" name="id" value="${e(editing.id || '')}"><input type="hidden" name="kind" value="${e(kind)}">
      <label>Titre<input name="title" required maxlength="140" placeholder="Donnez un titre à votre création…" value="${e(editing.title || '')}"></label>
      <label>Catégorie<select name="category">${meta.categories.map(item => `<option ${(editing.category || meta.categories[0]) === item ? 'selected' : ''}>${e(item)}</option>`).join('')}</select></label>
      <label>Lien de la création <span class="optional">facultatif</span><input name="media_url" type="url" maxlength="1000" placeholder="https://…" value="${e(editing.media_url || '')}"></label>
      <label>Description <span class="optional">facultatif</span><textarea name="description" rows="4" maxlength="1800" placeholder="Présentez votre création en quelques mots…">${e(editing.description || '')}</textarea></label>
      <div class="editor-actions"><button class="button button-primary" type="submit">Enregistrer ${meta.singular} ↗</button><button class="button button-outline" type="button" data-creation-cancel>Annuler</button></div>
      <p class="editor-hint">Cette fiche privée enregistre le titre, la catégorie, la description et un lien éventuel. Pour un fichier, ajoutez un lien accessible ; le téléversement direct sera raccordé séparément à R2.</p>
    </form></div>` : '';
  shell(`<section class="workspace-header"><div class="container workspace-title-row"><div><div class="eyebrow"><span class="eyebrow-dot"></span> MON ATELIER</div><h1>${e(meta.label)}.</h1><p>${e(meta.intro)}</p></div><button class="button button-outline" data-action="signout">Se déconnecter</button></div></section>
    <section class="container generic-creation-workspace">${form}
      <section class="my-works-panel creation-list-panel"><div class="panel-top"><div><span class="eyebrow">VOTRE COLLECTION</span><h2>${e(meta.label)} <span class="count-pill">${items.length}</span></h2></div><button class="button button-primary" data-action="new-creation">Nouvelle création +</button></div>
      ${items.length ? `<div class="my-work-list">${items.map(item => `<article class="my-work-item"><div class="my-work-symbol">${meta.icon}</div><div class="my-work-copy"><h3>${e(item.title)}</h3><p>${e(item.category || meta.label)} · ${e(formatDate(item.updated_at || item.created_at))}</p>${item.media_url ? `<a href="${e(item.media_url)}" target="_blank" rel="noopener noreferrer">Ouvrir la création ↗</a>` : ''}${item.description ? `<p class="creation-description">${e(item.description)}</p>` : ''}</div><button class="icon-button" data-edit-creation="${e(item.id)}" aria-label="Modifier ${e(item.title)}">✎</button></article>`).join('')}</div>` : `<div class="empty-state empty-works"><span>${meta.icon}</span><h3>Votre collection commence ici.</h3><p>Appuyez sur « Nouvelle création » pour ajouter votre première fiche.</p></div>`}
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
    .select('id,title,subtitle,summary,genre,body,publication_status,is_public,submission_requested_at,created_at,updated_at')
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
  const workspaceTabButton = event.target.closest('[data-workspace-tab]');
  if (workspaceTabButton) { state.workspaceTab = workspaceTabButton.dataset.workspaceTab; state.editing = null; state.editingVideo = null; state.editingCreation = null; state.showCreateForm = false; if (state.workspaceTab === 'videos') await loadMyVideos(); if (GENERIC_CREATION_KINDS.includes(state.workspaceTab)) await loadMyCreations(); render(); return; }
  if (event.target.closest('[data-action="new-video"]')) { state.workspaceTab = 'videos'; state.editingVideo = null; state.showCreateForm = true; await loadMyVideos(); render(); document.querySelector('#video-form [name="title"]')?.focus(); return; }
  if (event.target.closest('[data-action="new-text"]')) { state.workspaceTab = 'textes'; state.editing = null; state.showCreateForm = true; render(); document.querySelector('#work-form [name="title"]')?.focus(); return; }
  const editVideoButton = event.target.closest('[data-edit-video]');
  if (editVideoButton) { state.workspaceTab = 'videos'; state.editingVideo = state.myVideos.find((item) => item.id === editVideoButton.dataset.editVideo) || null; render(); return; }
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
    state.workspaceTab = 'textes'; state.showCreateForm = true;
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
  if (event.target.id === 'r2-upload-form') { event.preventDefault(); await uploadR2Files(event.target); return; }
  if (event.target.id === 'creation-form') {
    event.preventDefault();
    if (!supabase || !state.user) { showAuth('signin'); return; }
    const form = event.target; const data = new FormData(form); const id = String(data.get('id') || '');
    const kind = String(data.get('kind') || state.workspaceTab);
    if (!GENERIC_CREATION_KINDS.includes(kind)) { toast('Catégorie inconnue.', 'error'); return; }
    const mediaUrl = String(data.get('media_url') || '').trim();
    if (mediaUrl && !/^https?:\/\//i.test(mediaUrl)) { toast('Le lien doit commencer par https:// ou http://.', 'error'); return; }
    const payload = { kind, title: String(data.get('title') || '').trim(), category: String(data.get('category') || 'Autre'), media_url: mediaUrl || null, description: String(data.get('description') || '').trim(), updated_at: new Date().toISOString() };
    const button = form.querySelector('button[type="submit"]'); if (button) button.disabled = true;
    try {
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
  const payload = {
    title: String(data.get('title') || '').trim(),
    subtitle: String(data.get('subtitle') || '').trim(),
    genre: String(data.get('genre') || 'Texte libre'),
    summary: String(data.get('summary') || '').trim(),
    body: String(data.get('body') || ''),
    updated_at: new Date().toISOString()
  };
  if (intent === 'review') payload.submission_requested_at = new Date().toISOString();
  const buttons = [...form.querySelectorAll('button[type="submit"]')];
  buttons.forEach((button) => { button.disabled = true; });
  try {
    let query;
    if (id) query = supabase.from('plume_works').update(payload).eq('id', id).eq('author_id', state.user.id);
    else { const { updated_at, ...insertPayload } = payload; query = supabase.from('plume_works').insert({ ...insertPayload, author_id: state.user.id, ...(intent === 'review' ? { submission_requested_at: new Date().toISOString() } : {}) }); }
    const { error } = await query;
    if (error) throw error;
    toast(intent === 'review' ? 'Texte envoyé à la file de relecture.' : 'Brouillon enregistré.');
    state.editing = null; state.showCreateForm = false;
    await loadMyWorks();
    render();
  } catch (error) {
    console.error('Aurore Plume save', error);
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
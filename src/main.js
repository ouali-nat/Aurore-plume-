import '../style.css';
import './plume-memoire-theme.css';
import './plume-memoire-parity.css';
import './plume-rebuild.css';

const app = document.querySelector('#app');
const STORE = 'aurore-plume-projects-v1';
const state = { view: 'home', editingId: null };
const icon = { text:'✎', image:'▧', music:'♫', video:'▷', digital:'⌘', stage:'✧', library:'⌕', drafts:'▤' };
function readDrafts(){ try { const v=JSON.parse(localStorage.getItem(STORE)||'[]'); return Array.isArray(v)?v:[]; } catch { return []; } }
function saveDrafts(v){ localStorage.setItem(STORE,JSON.stringify(v)); }
function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toast(message){ const el=document.querySelector('#plumeToast'); if(!el)return; el.textContent=message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),2600); }
function go(view){ state.view=view; render(); window.scrollTo({top:0,behavior:'smooth'}); }
function header(){ return `<header class="topbar"><div class="wrap topbar-inner">
  <a class="brand" href="#" data-view="home" aria-label="Aurore Plume, accueil"><span class="brand-mark">a.</span><span class="brand-copy"><strong>Aurore</strong><small>Plume</small></span></a>
  <div class="header-right"><nav class="top-actions" aria-label="Navigation principale">
    <a class="nav-link ${state.view==='home'?'active':''}" href="#" data-view="home">Accueil</a>
    <a class="nav-link ${state.view==='atelier'?'active':''}" href="#" data-view="atelier">Atelier</a>
    <a class="nav-link ${state.view==='creations'?'active':''}" href="#" data-view="creations">Mes créations</a>
  </nav><div class="appearance">
    <button class="theme-btn" type="button" id="themeToggle" aria-label="Basculer le thème" title="Mode clair / sombre">◐</button>
    <div class="color-theme-wrap"><button class="theme-btn color-theme-btn" id="colorThemeToggle" type="button" aria-expanded="false" aria-controls="colorThemePanel"><span class="color-dot"></span><span class="color-btn-label">Couleur</span></button>
    <div class="color-theme-panel" id="colorThemePanel" hidden><div class="color-theme-head"><strong>Couleur du site</strong><small>Ton choix est conservé sur cet appareil</small></div><div class="color-theme-grid">
    ${[['violet','Violet'],['rouge','Rouge'],['vert','Vert'],['bleu','Bleu'],['orange','Orange'],['rose','Rose'],['indigo','Indigo'],['emeraude','Émeraude'],['lime','Lime'],['corail','Corail'],['bordeaux','Bordeaux'],['azur','Azur'],['petrole-cuivre','Pétrole'],['nuit-peche','Nuit pêche'],['prune-rouge','Prune'],['terre-orange','Terre'],['rose-sable','Rose sable'],['sarcelle-creme','Sarcelle']].map(([v,l])=>`<button class="color-theme-choice" type="button" data-color-choice="${v}" aria-pressed="false"><span></span><b>${l}</b></button>`).join('')}
    </div></div></div></div></div></div></header>`; }
function home(){ const drafts=readDrafts(); return `<main class="wrap main-content plume-main">
<section class="plume-mini-hero"><p class="eyebrow"><span class="eyebrow-mark"></span> ATELIER CRÉATIF</p><h1>Donne forme à ce que <em>tu imagines.</em></h1><p>Écris, compose, dessine, expérimente. Un espace à toi pour créer librement, garder tes projets et choisir ce que tu souhaites partager.</p>
<div class="plume-toolbar"><button class="plume-btn plume-btn-primary" data-view="atelier">＋ Ouvrir mon atelier</button><button class="plume-btn" data-view="creations">Mes créations <span>↗</span></button></div></section>
<section class="plume-section"><div class="plume-section-heading"><div><p class="plume-kicker">ESPACE PERSONNEL</p><h2>Retrouver mon univers</h2></div></div>
<div class="plume-card-grid">
<a class="plume-card" href="#" data-view="creations"><span class="plume-card-symbol">▤</span><span class="plume-card-copy"><strong>Mes créations</strong><small>Retrouve tes brouillons et poursuis tes idées là où tu les as laissées.</small><small><b>${drafts.length}</b> projet${drafts.length>1?'s':''} enregistré${drafts.length>1?'s':''} sur cet appareil</small></span><span class="plume-card-arrow">↗</span></a>
<a class="plume-card" href="#" data-view="atelier"><span class="plume-card-symbol">✎</span><span class="plume-card-copy"><strong>Créer quelque chose</strong><small>Commence par un texte, une idée de projet ou une page à construire.</small><small>Ton espace de création t’attend.</small></span><span class="plume-card-arrow">↗</span></a>
</div></section>
<button class="plume-create-banner" data-view="atelier"><span class="plume-create-plus">＋</span><span class="plume-create-copy"><strong>Commencer un nouveau projet</strong><small>Un titre, quelques lignes, une idée : tu peux commencer simplement et continuer plus tard.</small></span><span class="plume-create-arrow">→</span></button>
<section class="plume-section"><div class="plume-section-heading"><div><p class="plume-kicker">LES ESPACES DE CRÉATION</p><h2>À chacun sa manière de créer</h2></div></div>
<div class="plume-work-grid">
<button class="plume-work-card" data-view="atelier" data-kind="Texte"><span class="plume-work-icon">✎</span><strong>Textes & écriture</strong><small>Récits, poèmes, journaux, essais et idées.</small></button>
<button class="plume-work-card" data-view="atelier" data-kind="Dessin"><span class="plume-work-icon">▧</span><strong>Arts visuels & dessins</strong><small>Prépare tes projets visuels et conserve tes notes.</small></button>
<button class="plume-work-card" data-view="atelier" data-kind="Musique"><span class="plume-work-icon">♫</span><strong>Musique & sons</strong><small>Paroles, idées, compositions et projets sonores.</small></button>
<button class="plume-work-card" data-view="atelier" data-kind="Vidéo"><span class="plume-work-icon">▷</span><strong>Vidéos & scène</strong><small>Scénarios, concepts, répétitions et projets.</small></button>
<button class="plume-work-card" data-view="atelier" data-kind="Projet numérique"><span class="plume-work-icon">⌘</span><strong>Projets numériques</strong><small>Conçois et organise tes idées numériques.</small></button>
<button class="plume-work-card" data-view="creations"><span class="plume-work-icon">⌕</span><strong>Bibliothèque</strong><small>Retrouve les projets que tu as enregistrés ici.</small></button>
</div></section><footer class="plume-footer"><strong>Aurore Plume</strong><span>Un espace pour créer, apprendre et partager à ton rythme.</span></footer></main>`; }
function atelier(){ const d=readDrafts().find(x=>x.id===state.editingId); const draft=d||{title:'',kind:'Texte',content:''}; return `<main class="wrap main-content plume-main"><section class="plume-mini-hero"><p class="eyebrow"><span class="eyebrow-mark"></span> ATELIER PERSONNEL</p><h1>${d?'Reprendre ton projet.':'Tout commence par une idée.'}</h1><p>Écris librement, sauvegarde ton brouillon sur cet appareil et reviens le poursuivre quand tu le souhaites.</p><div class="plume-toolbar"><button class="plume-btn" data-view="home">← Accueil</button><button class="plume-btn" data-view="creations">Mes créations</button></div></section>
<form id="plumeEditor" class="plume-editor-card"><div class="plume-field"><label for="draftTitle">Titre du projet</label><input id="draftTitle" name="title" maxlength="180" required placeholder="Donne un nom à ton idée" value="${escapeHtml(draft.title)}"></div>
<div class="plume-field"><label for="draftKind">Univers créatif</label><select id="draftKind" name="kind">${['Texte','Vidéo','Arts visuels','Dessin','Musique','Projet numérique','Scène & autres'].map(k=>`<option ${draft.kind===k?'selected':''}>${k}</option>`).join('')}</select></div>
<div class="plume-field"><label for="draftContent">Ton contenu</label><textarea id="draftContent" name="content" placeholder="Pose ici tes premières idées…">${escapeHtml(draft.content)}</textarea></div>
<div class="plume-toolbar"><button class="plume-btn plume-btn-primary" type="submit">Enregistrer le brouillon</button><button class="plume-btn" type="button" id="downloadDraft">Télécharger en .txt</button><button class="plume-btn" type="button" data-view="creations">Annuler</button></div>
<p style="color:var(--muted);font-size:.75rem;margin-bottom:0">Enregistrement local sur cet appareil. La synchronisation cloud et la publication publique ne sont pas encore branchées dans cette nouvelle base.</p></form><footer class="plume-footer"><strong>Aurore Plume</strong><span>Ton travail reste entre tes mains.</span></footer></main>`; }
function creations(){ const drafts=readDrafts(); return `<main class="wrap main-content plume-main"><section class="plume-mini-hero"><p class="eyebrow"><span class="eyebrow-mark"></span> ESPACE PERSONNEL</p><h1>Mes <em>créations.</em></h1><p>Tes brouillons enregistrés sur cet appareil, réunis au même endroit.</p><div class="plume-toolbar"><button class="plume-btn plume-btn-primary" data-view="atelier">＋ Nouveau projet</button><button class="plume-btn" data-view="home">← Accueil</button></div></section>
${drafts.length?'<div class="plume-draft-list">'+drafts.slice().reverse().map(d=>`<article class="plume-draft"><p class="plume-kicker">${escapeHtml(d.kind||'Projet')} · BROUILLON PRIVÉ</p><h3>${escapeHtml(d.title||'Sans titre')}</h3><p>${escapeHtml((d.content||'').slice(0,240))}${(d.content||'').length>240?'…':''}</p><div class="plume-draft-actions"><button class="plume-btn" data-edit="${d.id}">Continuer</button><button class="plume-btn" data-download="${d.id}">Télécharger</button><button class="plume-btn" data-delete="${d.id}">Supprimer</button></div></article>`).join('')+'</div>':'<div class="plume-empty"><strong>Ton espace est encore vide</strong>Quand une idée te vient, commence un projet. Il apparaîtra ici après son enregistrement.<div class="plume-toolbar" style="justify-content:center"><button class="plume-btn plume-btn-primary" data-view="atelier">Créer mon premier projet</button></div></div>'}
<footer class="plume-footer" style="margin-top:32px"><strong>Aurore Plume</strong><span>Les idées grandissent quand on leur donne une place.</span></footer></main>`; }
function render(){ app.innerHTML=header()+({home,atelier,creations}[state.view]||home)()+`<nav class="plume-bottom-nav" aria-label="Navigation rapide">
<button type="button" data-view="home" aria-current="${state.view==='home'?'page':'false'}"><span>⌂</span><small>Accueil</small></button>
<button type="button" data-view="creations" aria-current="${state.view==='creations'?'page':'false'}"><span>▤</span><small>Bibliothèque</small></button>
<button type="button" data-view="atelier" aria-current="${state.view==='atelier'?'page':'false'}"><span>＋</span><small>Créer</small></button>
<button type="button" data-view="creations" aria-current="false"><span>♡</span><small>Enregistrés</small></button>
</nav>`+'<div class="plume-toast" id="plumeToast" role="status" aria-live="polite"></div>';
 bind(); }
function bind(){
 app.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault(); if(el.dataset.kind) state.nextKind=el.dataset.kind; state.editingId=null; go(el.dataset.view);}));
 app.querySelectorAll('[data-kind]').forEach(el=>el.addEventListener('click',()=>{state.nextKind=el.dataset.kind;}));
 const themeBtn=document.querySelector('#themeToggle'); themeBtn?.addEventListener('click',()=>{const root=document.documentElement;const light=root.dataset.theme!=='light';root.dataset.theme=light?'light':'dark';root.dataset.themeChoix=light?'clair':'sombre';localStorage.setItem('auraster-theme',light?'clair':'sombre');});
 const colorToggle=document.querySelector('#colorThemeToggle'), panel=document.querySelector('#colorThemePanel'); colorToggle?.addEventListener('click',()=>{panel.hidden=!panel.hidden;colorToggle.setAttribute('aria-expanded',String(!panel.hidden));});
 app.querySelectorAll('[data-color-choice]').forEach(btn=>{const active=btn.dataset.colorChoice===(document.documentElement.dataset.colorTheme||'violet');btn.setAttribute('aria-pressed',String(active));btn.addEventListener('click',()=>{document.documentElement.dataset.colorTheme=btn.dataset.colorChoice;localStorage.setItem('auraster-color-theme',btn.dataset.colorChoice);panel.hidden=true;colorToggle.setAttribute('aria-expanded','false');bindThemeColors();});});
 const form=document.querySelector('#plumeEditor'); form?.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form);const all=readDrafts();const old=all.find(x=>x.id===state.editingId);const item={id:state.editingId||crypto.randomUUID(),title:String(fd.get('title')||'').trim(),kind:String(fd.get('kind')||'Texte'),content:String(fd.get('content')||''),updatedAt:new Date().toISOString()};if(old)all[all.findIndex(x=>x.id===state.editingId)]=item;else all.push(item);saveDrafts(all);state.editingId=item.id;toast('Brouillon enregistré sur cet appareil.');go('creations');});
 document.querySelector('#downloadDraft')?.addEventListener('click',()=>{const title=document.querySelector('#draftTitle').value||'mon-projet';downloadText(title,document.querySelector('#draftContent').value);});
 app.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>{state.editingId=b.dataset.edit;go('atelier');}));
 app.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>{if(!confirm('Supprimer ce brouillon enregistré sur cet appareil ?'))return;saveDrafts(readDrafts().filter(x=>x.id!==b.dataset.delete));toast('Brouillon supprimé.');render();}));
 app.querySelectorAll('[data-download]').forEach(b=>b.addEventListener('click',()=>{const d=readDrafts().find(x=>x.id===b.dataset.download);if(d)downloadText(d.title,d.content);}));
}
function bindThemeColors(){document.querySelectorAll('[data-color-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.colorChoice===document.documentElement.dataset.colorTheme)));}
function downloadText(title,content){const blob=new Blob([String(content||'')],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=(String(title||'aurore-plume').replace(/[\\/:*?"<>|]+/g,'-').trim()||'aurore-plume')+'.txt';a.click();URL.revokeObjectURL(url);}
render();

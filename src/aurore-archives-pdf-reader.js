import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let documentPdf = null;
let currentBlob = null;
let currentScale = 1;
let currentPage = 1;
let observer = null;
let keyHandler = null;
let resizeHandler = null;
let renderQueue = new Set();
let readerOptions = {};

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root = () => document.querySelector('#modal-root');
const recentKey = 'aurore_plume_pdf_recents_v1';

function getRecents() {
  try { const value = JSON.parse(localStorage.getItem(recentKey) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
}
function saveRecent(workId, title) {
  const rows = [{ id: workId, title: String(title || 'Document'), openedAt: Date.now() }, ...getRecents().filter((x) => x.id !== workId)].slice(0, 10);
  try { localStorage.setItem(recentKey, JSON.stringify(rows)); } catch {}
  return rows;
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function closePanels(overlay) {
  overlay.querySelectorAll('.pdf-reader-menu-panel,.pdf-page-jump-panel,.pdf-download-choice-overlay').forEach((el) => { el.classList.remove('open'); el.hidden = true; });
}
function teardown() {
  if (observer) { observer.disconnect(); observer = null; }
  if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
  if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
  renderQueue.clear();
  const host = root(); if (host) host.innerHTML = '';
  documentPdf = null; currentBlob = null; currentScale = 1; currentPage = 1;
}
export function closeArchivesPdfReader() { teardown(); }

export async function openArchivesPdfReader(blob, options = {}) {
  if (!(blob instanceof Blob)) throw new Error('Le document PDF est indisponible.');
  teardown();
  readerOptions = options;
  currentBlob = blob; currentScale = 1; currentPage = 1;
  const title = String(options.title || 'Lecture du document');
  const recents = saveRecent(options.workId || null, title);
  const host = root();
  if (!host) throw new Error('La zone de lecture PDF est introuvable.');
  host.innerHTML = `
  <div id="pdfViewerOverlay" class="plume-pdf-reader-overlay" role="dialog" aria-modal="true" aria-labelledby="pdfViewerTitre">
    <div class="pdf-reader-shell">
      <div class="pdf-reader-topbar">
        <button type="button" class="pdf-reader-back" id="pdfViewerRetour">← Retour</button>
        <strong id="pdfViewerTitre" class="pdf-reader-title">${esc(title)}</strong>
        <span class="pdf-reader-badge">LECTURE PDF</span>
        <button type="button" class="pdf-reader-menu-toggle" id="pdfViewerMenuToggle" aria-expanded="false" aria-label="Ouvrir les outils">⋮</button>
        <div class="pdf-reader-menu-panel" id="pdfViewerMenuPanel" role="menu" hidden>
          <section class="pdf-menu-section"><span class="pdf-menu-section-title">ZOOM</span>
            <div class="pdf-menu-zoom-row"><button type="button" id="pdfViewerZoomOut" class="pdf-menu-zoom-btn" aria-label="Réduire">−</button><strong id="pdfViewerZoomLevel">100%</strong><button type="button" id="pdfViewerZoomIn" class="pdf-menu-zoom-btn" aria-label="Agrandir">+</button></div>
            <button type="button" class="pdf-menu-item" id="pdfViewerAjuster">↔ Ajuster à la largeur</button>
          </section>
          <div class="pdf-menu-divider"></div>
          <button type="button" class="pdf-menu-item" id="pdfViewerModeLecture" aria-pressed="false">⇄ Lecture horizontale</button>
          <button type="button" class="pdf-menu-item" id="pdfViewerImmersive" aria-pressed="false">⛶ Lecture immersive</button>
          <button type="button" class="pdf-menu-item" id="pdfViewerTelecharger">↓ Télécharger le PDF…</button>
          <div class="pdf-menu-divider"></div>
          <div class="pdf-recent-access"><button type="button" class="pdf-menu-item" id="pdfViewerRecentToggle" aria-expanded="false">◷ Documents récents</button>
            <div class="pdf-recent-panel" id="pdfViewerRecentPanel" hidden><span class="pdf-recent-panel-title">Documents récemment ouverts</span><div class="pdf-recent-list" id="pdfViewerRecentList"></div></div>
          </div>
        </div>
      </div>
      <div class="pdf-load-progress-dock is-visible" id="pdfViewerProgress"><div class="pdf-load-progress-head"><span id="pdfViewerProgressLabel">Préparation du document…</span><strong id="pdfViewerProgressPercent">0%</strong></div><div class="pdf-load-progress-track"><div class="pdf-load-progress-bar" id="pdfViewerProgressBar"></div></div></div>
      <div class="pdf-reader-zone-wrap"><div class="pdf-reader-zone" id="pdfViewerZone" tabindex="0" aria-label="Pages du PDF"><div class="pdf-reader-loading" id="pdfViewerLoading"><div class="pdf-spinner"></div><p id="pdfViewerStatut">Préparation du document…</p></div><div class="pdf-reader-erreur" id="pdfViewerError" hidden></div><div class="pdf-reader-pages" id="pdfViewerPages"></div></div><div class="pdf-reader-scrollbar" id="pdfViewerScrollbar"><div class="pdf-reader-scrollbar-thumb" id="pdfViewerScrollbarThumb"></div></div></div>
      <div class="pdf-reader-bottombar"><button type="button" id="pdfViewerPrev" disabled>← Précédent</button><div class="pdf-page-jump-wrap"><button type="button" id="pdfViewerPageJumpToggle" aria-expanded="false"><span id="pdfViewerPage">1 / —</span> ▾</button><div class="pdf-page-jump-panel" id="pdfViewerPageJumpPanel" hidden><input id="pdfViewerPageJumpInput" type="number" min="1" inputmode="numeric" placeholder="N° de page" aria-label="Numéro de page"><button type="button" id="pdfViewerPageJumpGo">Aller</button></div></div><button type="button" id="pdfViewerNext" disabled>Suivant →</button></div>
    </div>
    <button type="button" class="pdf-load-progress-sphere" id="pdfViewerSphere" aria-label="Progression du chargement"><span id="pdfViewerSpherePercent">0%</span></button>
  </div>
  <div id="pdfDownloadChoiceOverlay" class="pdf-download-choice-overlay" hidden><div class="pdf-download-choice-card"><div class="pdf-download-choice-head"><div><div class="pdf-download-choice-eyebrow">EXPORTATION</div><h2 class="pdf-download-choice-title">Télécharger le document</h2><p class="pdf-download-choice-description">Choisis comment enregistrer ce PDF.</p></div><button type="button" class="pdf-download-choice-close" id="pdfDownloadChoiceClose" aria-label="Fermer">×</button></div><div class="pdf-download-choice-options"><button class="pdf-download-choice-option" id="pdfDownloadAll" type="button"><span class="pdf-download-choice-icon">PDF</span><span><strong>Document complet</strong><small>Toutes les pages du fichier original</small></span></button><button class="pdf-download-choice-option" id="pdfDownloadCurrent" type="button"><span class="pdf-download-choice-icon">↧</span><span><strong>Enregistrer le fichier original</strong><small>Conserve le PDF sans le modifier</small></span></button></div><button type="button" class="pdf-download-choice-cancel" id="pdfDownloadChoiceCancel">Annuler</button></div></div>`;
  const overlay = host.querySelector('#pdfViewerOverlay');
  const zone = overlay.querySelector('#pdfViewerZone');
  const pages = overlay.querySelector('#pdfViewerPages');
  const progress = (pct, label) => {
    overlay.querySelector('#pdfViewerProgressLabel').textContent = label;
    overlay.querySelector('#pdfViewerProgressPercent').textContent = Math.round(pct) + '%';
    overlay.querySelector('#pdfViewerProgressBar').style.width = pct + '%';
    overlay.querySelector('#pdfViewerSpherePercent').textContent = Math.round(pct) + '%';
  };
  const updatePage = (n, scroll = true) => {
    if (!documentPdf) return;
    currentPage = Math.max(1, Math.min(documentPdf.numPages, Math.round(n) || 1));
    const target = pages.querySelector('[data-page="' + currentPage + '"]');
    if (scroll && target) target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'center' });
    overlay.querySelector('#pdfViewerPage').textContent = currentPage + ' / ' + documentPdf.numPages;
    overlay.querySelector('#pdfViewerPageJumpInput').value = String(currentPage);
    overlay.querySelector('#pdfViewerPrev').disabled = currentPage <= 1;
    overlay.querySelector('#pdfViewerNext').disabled = currentPage >= documentPdf.numPages;
  };
  const renderPage = async (n, force = false) => {
    if (!documentPdf || n < 1 || n > documentPdf.numPages || renderQueue.has(n)) return;
    const canvas = pages.querySelector('canvas[data-page="' + n + '"]');
    if (!canvas || (canvas.dataset.rendered === 'true' && !force)) return;
    renderQueue.add(n);
    try {
      const page = await documentPdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const fit = Math.max(.2, (zone.clientWidth - 24) / base.width);
      const viewport = page.getViewport({ scale: fit * currentScale });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * ratio); canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = Math.floor(viewport.width) + 'px'; canvas.style.height = Math.floor(viewport.height) + 'px';
      await page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport, transform: ratio === 1 ? null : [ratio,0,0,ratio,0,0], background: '#fff' }).promise;
      canvas.dataset.rendered = 'true';
    } finally { renderQueue.delete(n); }
  };
  const renderVisible = async (force = false) => {
    if (!documentPdf) return;
    const visible = [...pages.querySelectorAll('canvas[data-page]')].filter((c) => { const r=c.getBoundingClientRect(), z=zone.getBoundingClientRect(); return r.bottom >= z.top - 700 && r.top <= z.bottom + 700; }).map((c)=>Number(c.dataset.page));
    await Promise.all([...new Set([currentPage, ...visible])].map((n)=>renderPage(n, force).catch(()=>{})));
  };
  const setScale = async (next) => { currentScale = Math.max(.25, Math.min(5, Math.round(next * 100) / 100)); overlay.querySelector('#pdfViewerZoomLevel').textContent = Math.round(currentScale * 100) + '%'; await renderVisible(true); };
  overlay.querySelector('#pdfViewerRetour').addEventListener('click', closeArchivesPdfReader);
  overlay.querySelector('#pdfViewerMenuToggle').addEventListener('click', (ev) => { const menu=overlay.querySelector('#pdfViewerMenuPanel'); menu.hidden=!menu.hidden; ev.currentTarget.setAttribute('aria-expanded', String(!menu.hidden)); });
  overlay.querySelector('#pdfViewerZoomIn').addEventListener('click', () => setScale(currentScale + .01));
  overlay.querySelector('#pdfViewerZoomOut').addEventListener('click', () => setScale(currentScale - .01));
  overlay.querySelector('#pdfViewerAjuster').addEventListener('click', () => setScale(1));
  overlay.querySelector('#pdfViewerModeLecture').addEventListener('click', (ev) => { const horizontal=zone.classList.toggle('pdf-reading-horizontal'); ev.currentTarget.setAttribute('aria-pressed', String(horizontal)); ev.currentTarget.textContent=horizontal?'⇵ Lecture verticale':'⇄ Lecture horizontale'; });
  overlay.querySelector('#pdfViewerImmersive').addEventListener('click', (ev) => { const active=overlay.classList.toggle('pdf-immersive'); ev.currentTarget.setAttribute('aria-pressed', String(active)); ev.currentTarget.textContent=active?'⛶ Quitter la lecture immersive':'⛶ Lecture immersive'; });
  const downloadChoice=host.querySelector('#pdfDownloadChoiceOverlay');
  const closeDownload=()=>{downloadChoice.hidden=true;downloadChoice.classList.remove('open');};
  overlay.querySelector('#pdfViewerTelecharger').addEventListener('click',()=>{downloadChoice.hidden=false;downloadChoice.classList.add('open');});
  host.querySelector('#pdfDownloadChoiceClose').addEventListener('click',closeDownload);host.querySelector('#pdfDownloadChoiceCancel').addEventListener('click',closeDownload);
  const filename=(title.replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'')||'aurore-plume')+'.pdf';
  host.querySelector('#pdfDownloadAll').addEventListener('click',()=>{download(currentBlob,filename);closeDownload();});
  host.querySelector('#pdfDownloadCurrent').addEventListener('click',()=>{download(currentBlob,filename);closeDownload();});
  const recentList=overlay.querySelector('#pdfViewerRecentList');
  recentList.innerHTML=recents.map((r)=>'<button type="button" class="pdf-recent-item" data-reopen-work="'+esc(r.id||'')+'">'+esc(r.title||'Document')+'</button>').join('') || '<p>Aucun document récent.</p>';
  overlay.querySelector('#pdfViewerRecentToggle').addEventListener('click',(ev)=>{const panel=overlay.querySelector('#pdfViewerRecentPanel');panel.hidden=!panel.hidden;ev.currentTarget.setAttribute('aria-expanded',String(!panel.hidden));});
  recentList.addEventListener('click',(ev)=>{const button=ev.target.closest('[data-reopen-work]');if(!button||!button.dataset.reopenWork||!readerOptions.onReopen)return;const id=button.dataset.reopenWork;closeArchivesPdfReader();readerOptions.onReopen(id);});
  overlay.querySelector('#pdfViewerPageJumpToggle').addEventListener('click',(ev)=>{const panel=overlay.querySelector('#pdfViewerPageJumpPanel');panel.hidden=!panel.hidden;ev.currentTarget.setAttribute('aria-expanded',String(!panel.hidden));});
  overlay.querySelector('#pdfViewerPageJumpGo').addEventListener('click',()=>updatePage(Number(overlay.querySelector('#pdfViewerPageJumpInput').value)));
  overlay.querySelector('#pdfViewerPageJumpInput').addEventListener('keydown',(ev)=>{if(ev.key==='Enter')updatePage(Number(ev.currentTarget.value));});
  overlay.querySelector('#pdfViewerPrev').addEventListener('click',()=>updatePage(currentPage-1));overlay.querySelector('#pdfViewerNext').addEventListener('click',()=>updatePage(currentPage+1));
  const thumb=overlay.querySelector('#pdfViewerScrollbarThumb');
  overlay.querySelector('#pdfViewerScrollbar').addEventListener('click',(ev)=>{const rect=ev.currentTarget.getBoundingClientRect();zone.scrollTop=(ev.clientY-rect.top)/rect.height*zone.scrollHeight;});
  let dragY=0, startScroll=0;
  thumb.addEventListener('pointerdown',(ev)=>{dragY=ev.clientY;startScroll=zone.scrollTop;thumb.setPointerCapture(ev.pointerId);});
  thumb.addEventListener('pointermove',(ev)=>{if(!thumb.hasPointerCapture(ev.pointerId))return;zone.scrollTop=startScroll+(ev.clientY-dragY)*(zone.scrollHeight/Math.max(1,zone.clientHeight));});
  zone.addEventListener('scroll',()=>{const ratio=zone.scrollTop/Math.max(1,zone.scrollHeight-zone.clientHeight);thumb.style.top=(ratio*85)+'%';const mid=zone.getBoundingClientRect().top+zone.clientHeight*.35;const found=[...pages.querySelectorAll('.pdf-reader-page-wrap')].map(el=>({n:Number(el.dataset.page),r:el.getBoundingClientRect()})).find(x=>x.r.top<=mid&&x.r.bottom>=mid);if(found)updatePage(found.n,false);renderVisible();},{passive:true});
  let pinchDistance=0;
  zone.addEventListener('touchstart',(ev)=>{if(ev.touches.length===2)pinchDistance=Math.hypot(ev.touches[0].clientX-ev.touches[1].clientX,ev.touches[0].clientY-ev.touches[1].clientY);},{passive:true});
  zone.addEventListener('touchmove',(ev)=>{if(ev.touches.length!==2||!pinchDistance)return;const d=Math.hypot(ev.touches[0].clientX-ev.touches[1].clientX,ev.touches[0].clientY-ev.touches[1].clientY);if(Math.abs(d-pinchDistance)>24){setScale(currentScale+(d>pinchDistance?.02:-.02));pinchDistance=d;}},{passive:true});
  if(keyHandler)document.removeEventListener('keydown',keyHandler);
  keyHandler=(ev)=>{if(!root()?.querySelector('#pdfViewerOverlay'))return;if(ev.key==='Escape'){if(!downloadChoice.hidden)closeDownload();else closeArchivesPdfReader();}else if(ev.key==='ArrowRight')updatePage(currentPage+1);else if(ev.key==='ArrowLeft')updatePage(currentPage-1);};document.addEventListener('keydown',keyHandler);
  try {
    progress(12,'Préparation du document…'); const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=pdfWorkerUrl;
    const bytes=await blob.arrayBuffer();progress(36,'Ouverture du PDF…');
    documentPdf=await pdfjs.getDocument({data:bytes,stopAtErrors:false}).promise;
    if(!documentPdf.numPages)throw new Error('Aucune page lisible.');
    for(let n=1;n<=documentPdf.numPages;n++){const wrap=document.createElement('div');wrap.className='pdf-reader-page-wrap';wrap.dataset.page=String(n);const canvas=document.createElement('canvas');canvas.className='pdf-reader-page';canvas.dataset.page=String(n);wrap.appendChild(canvas);pages.appendChild(wrap);}
    const loadingEl=overlay.querySelector('#pdfViewerLoading');loadingEl.hidden=true;loadingEl.style.display='none';const progressEl=overlay.querySelector('#pdfViewerProgress');progressEl.classList.remove('is-visible');progressEl.hidden=true;progressEl.style.display='none';overlay.querySelector('#pdfViewerSphere').classList.add('is-visible');progress(100,'Document prêt');
    if('IntersectionObserver'in window){observer=new IntersectionObserver((entries)=>entries.forEach((entry)=>{if(entry.isIntersecting)renderPage(Number(entry.target.dataset.page)).catch(()=>{});}),{root:zone,rootMargin:'650px 0px'});pages.querySelectorAll('.pdf-reader-page-wrap').forEach((el)=>observer.observe(el));}
    await renderPage(1);updatePage(1,false);await renderVisible();
    if(resizeHandler)window.removeEventListener('resize',resizeHandler);resizeHandler=()=>renderVisible(true);window.addEventListener('resize',resizeHandler,{passive:true});
  } catch(error) {
    console.error('Lecteur PDF Aurore Plume',error);
    const loadingEl=overlay.querySelector('#pdfViewerLoading');loadingEl.hidden=true;loadingEl.style.display='none';const box=overlay.querySelector('#pdfViewerError');box.hidden=false;box.style.display='block';box.textContent='Impossible d’ouvrir ce PDF. Vérifie le fichier puis réessaie.';
    progress(0,'Ouverture impossible');
  }
}

/* Aurore Plume — modes clair/sombre/système et palette inspirée d’Aurore Archives. */
const THEME_KEY='auraster-theme', COLOR_KEY='auraster-color-theme';
const systemLight=window.matchMedia('(prefers-color-scheme: light)');
const PALETTES=[
{id:'violet',name:'Violet',color:'#6D28D9'},{id:'rouge',name:'Rouge',color:'#B91C1C'},
{id:'vert',name:'Vert',color:'#15803D'},{id:'bleu',name:'Bleu',color:'#1D4ED8'},
{id:'orange',name:'Orange',color:'#C85C0D'},{id:'rose',name:'Rose',color:'#BE185D'},
{id:'lime',name:'Citron vert',color:'#65A30D'},{id:'bordeaux',name:'Bordeaux',color:'#8B1E3F'},
{id:'azur',name:'Azur',color:'#0369A1'},{id:'jaune',name:'Jaune',color:'#D9A406'},
{id:'olive',name:'Olive',color:'#4A5520'},{id:'chocolat',name:'Chocolat',color:'#5C300F'},
{id:'sauge',name:'Sauge',color:'#4A7A5C'},{id:'magenta',name:'Magenta',color:'#A21CAF'},
{id:'petrole-cuivre',name:'Pétrole',color:'#104C64'},{id:'prune-rouge',name:'Prune',color:'#341A2C'},
{id:'rose-sable',name:'Rose poudré',color:'#EFC1B5'},{id:'sarcelle-creme',name:'Sarcelle',color:'#0D6B70'}
];
const allowed=new Set(PALETTES.map(p=>p.id));
const get=(k,f)=>{try{return localStorage.getItem(k)||f}catch{return f}};
const set=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
let dock,trigger,panel,modes,swatches,colorName,colorChoice='violet',themeChoice='sombre';
function displayTheme(choice){return choice==='systeme'?(systemLight.matches?'clair':'sombre'):choice}
function metaColor(){
 const meta=document.querySelector('meta[name="theme-color"]');
 const item=PALETTES.find(p=>p.id===colorChoice)||PALETTES[0];
 if(meta)meta.setAttribute('content',displayTheme(themeChoice)==='sombre'?'#09080F':item.color);
}
function applyTheme(choice,save=true){
 themeChoice=['clair','sombre','systeme'].includes(choice)?choice:'sombre';
 const light=displayTheme(themeChoice)==='clair';
 document.documentElement.setAttribute('data-theme',light?'light':'dark');
 document.documentElement.setAttribute('data-theme-choix',themeChoice);
 if(save)set(THEME_KEY,themeChoice);
 modes?.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===themeChoice)));
 metaColor();
}
function applyColor(choice,save=true){
 colorChoice=allowed.has(choice)?choice:'violet';
 document.documentElement.setAttribute('data-color-theme',colorChoice);
 if(save)set(COLOR_KEY,colorChoice);
 swatches?.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.colorChoice===colorChoice)));
 const chosen=PALETTES.find(p=>p.id===colorChoice)||PALETTES[0];
 if(colorName)colorName.textContent=chosen.name;
 const dot=trigger?.querySelector('.plume-theme-trigger-dot');
 if(dot)dot.style.backgroundColor=chosen.color;
 metaColor();
}
function togglePanel(open){
 if(!panel||!trigger)return;
 panel.hidden=!open;panel.classList.toggle('is-open',open);trigger.setAttribute('aria-expanded',String(open));
}
function initThemeDock(){
 if(document.getElementById('aurore-plume-theme-dock'))return;
 dock=document.createElement('div');dock.id='aurore-plume-theme-dock';
 dock.innerHTML=`
 <button type="button" id="plume-theme-trigger" class="plume-theme-trigger" aria-expanded="false" aria-controls="plume-theme-panel" title="Thème et couleurs du site">
 <span class="plume-theme-trigger-icon" aria-hidden="true">◐</span><span>Apparence</span><span class="plume-theme-trigger-dot" aria-hidden="true"></span></button>
 <section id="plume-theme-panel" class="plume-theme-panel" aria-label="Apparence du site" hidden>
 <header class="plume-theme-panel-head"><div><span class="plume-theme-eyebrow">PERSONNALISATION</span><strong>Apparence du site</strong></div><button type="button" class="plume-theme-close" data-theme-close aria-label="Fermer la palette">×</button></header>
 <section class="plume-theme-mode-section" aria-label="Mode d'affichage"><span class="plume-theme-section-label">Mode d’affichage</span>
 <div class="plume-theme-mode-switch" role="group" aria-label="Choisir le mode clair, sombre ou système">
 <button type="button" class="plume-theme-mode" data-theme-choice="clair" aria-pressed="false"><span aria-hidden="true">☀</span><span>Clair</span></button>
 <button type="button" class="plume-theme-mode" data-theme-choice="sombre" aria-pressed="false"><span aria-hidden="true">☾</span><span>Sombre</span></button>
 <button type="button" class="plume-theme-mode" data-theme-choice="systeme" aria-pressed="false"><span aria-hidden="true">▣</span><span>Système</span></button></div></section>
 <section class="plume-theme-color-section" aria-label="Palette de couleurs du site">
 <div class="plume-theme-section-heading"><span class="plume-theme-section-label">Couleur du site</span><strong id="plume-theme-color-current">Violet</strong></div>
 <div class="plume-theme-palette"></div>
 <p class="plume-theme-note">Les accents, commandes et états actifs changent de couleur. Le fond personnalisé de tes pages reste intact.</p></section></section>`;
 dock.querySelector('.plume-theme-palette').innerHTML=PALETTES.map(p=>'<button type="button" class="plume-theme-swatch" data-color-choice="'+p.id+'" title="'+p.name+'" aria-label="Couleur '+p.name+'" aria-pressed="false" style="--swatch:'+p.color+'"><span aria-hidden="true"></span></button>').join('');
 document.body.appendChild(dock);
 trigger=dock.querySelector('#plume-theme-trigger');panel=dock.querySelector('#plume-theme-panel');
 modes=[...dock.querySelectorAll('[data-theme-choice]')];swatches=[...dock.querySelectorAll('[data-color-choice]')];colorName=dock.querySelector('#plume-theme-color-current');
 trigger.addEventListener('click',e=>{e.stopPropagation();togglePanel(panel.hidden)});
 dock.querySelector('[data-theme-close]')?.addEventListener('click',()=>togglePanel(false));
 modes.forEach(b=>b.addEventListener('click',()=>applyTheme(b.dataset.themeChoice)));
 swatches.forEach(b=>b.addEventListener('click',()=>{applyColor(b.dataset.colorChoice);togglePanel(false)}));
 document.addEventListener('click',e=>{if(!dock.contains(e.target))togglePanel(false)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')togglePanel(false)});
 systemLight.addEventListener?.('change',()=>{if(get(THEME_KEY,'sombre')==='systeme')applyTheme('systeme',false)});
 applyTheme(get(THEME_KEY,'sombre'),false);applyColor(get(COLOR_KEY,'violet'),false);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initThemeDock,{once:true});else initThemeDock();

import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { ArrowDownRight, ArrowRight, BookOpen, Feather, Heart, Menu, PenLine, Search, Sparkles, X } from 'lucide-react';
import './styles.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://iymioasfkithmyqtpipd.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_wH_5VIVgu_1cCI13J3-VXA_APkuHr2H';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const inspirations = [
  { id: 'inspiration-1', title: 'Les choses que la pluie nous apprend', subtitle: 'Fragments de vie', genre: 'Poésie', summary: 'Il y a des jours où le ciel écrit à notre place.', author: 'La rédaction', handle: 'aurore', label: 'EXEMPLE', body: 'Une inspiration de lecture apparaîtra ici.' },
  { id: 'inspiration-2', title: 'Le cahier bleu', subtitle: 'Nouvelle', genre: 'Fiction', summary: 'Un cahier oublié, une adresse, et le début d’une histoire.', author: 'La rédaction', handle: 'aurore', label: 'EXEMPLE', body: 'Une inspiration de lecture apparaîtra ici.' },
  { id: 'inspiration-3', title: 'À ceux qui recommencent', subtitle: 'Lettre ouverte', genre: 'Réflexion', summary: 'Recommencer n’efface pas le chemin déjà parcouru.', author: 'La rédaction', handle: 'aurore', label: 'EXEMPLE', body: 'Une inspiration de lecture apparaîtra ici.' }
];

function App() {
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('Tout');
  const [activeWork, setActiveWork] = useState(null);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showWritePanel, setShowWritePanel] = useState(false);

  useEffect(() => {
    let alive = true;
    async function loadWorks() {
      const { data, error } = await supabase
        .from('plume_works')
        .select('id,title,subtitle,summary,genre,body,published_at,author:plume_profiles(display_name,handle)')
        .eq('publication_status', 'published')
        .eq('is_public', true)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(30);
      if (alive) {
        setWorks(!error && data ? data : []);
        setLoading(false);
      }
    }
    loadWorks();
    return () => { alive = false; };
  }, []);

  const genres = useMemo(() => ['Tout', ...new Set(works.map(w => w.genre).filter(Boolean))], [works]);
  const filtered = useMemo(() => works.filter(w => {
    const text = [w.title, w.subtitle, w.summary, w.genre, w.author?.display_name].join(' ').toLowerCase();
    return text.includes(query.toLowerCase()) && (genre === 'Tout' || w.genre === genre);
  }), [works, query, genre]);
  const examples = !loading && works.length === 0;
  const displayed = examples ? inspirations.filter(w => [w.title, w.summary, w.genre].join(' ').toLowerCase().includes(query.toLowerCase()) && (genre === 'Tout' || w.genre === genre)) : filtered;

  return <div className="app-shell">
    <div className="announcement"><Sparkles size={14} /> Un lieu pour les voix qui méritent d’être lues <span>—</span> <a href="#decouvrir">Découvrir Plume <ArrowRight size={13}/></a></div>
    <header className="site-header">
      <a className="brand" href="#" aria-label="Aurore Plume, accueil"><span className="brand-mark"><Feather size={20}/></span><span>aurore<span className="brand-light">plume</span><small>LES MOTS PRENNENT LEUR ENVOL</small></span></a>
      <nav className={showMobileNav ? 'nav-links nav-open' : 'nav-links'}>
        <a href="#decouvrir" onClick={() => setShowMobileNav(false)}>Découvrir</a><a href="#manifeste" onClick={() => setShowMobileNav(false)}>Notre esprit</a><a href="#auteurs" onClick={() => setShowMobileNav(false)}>Pour les auteurs</a>
      </nav>
      <div className="header-actions"><button className="btn btn-outline" onClick={() => setShowWritePanel(true)}><PenLine size={16}/> Écrire</button><button className="menu-button" aria-label="Ouvrir le menu" onClick={() => setShowMobileNav(!showMobileNav)}>{showMobileNav ? <X/> : <Menu/>}</button></div>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line"/> L’ATELIER DES HISTOIRES</div>
          <h1>Vos mots ont<br/>un <em>lieu.</em></h1>
          <p className="hero-lede">Des histoires à découvrir. Des idées à faire grandir. Une communauté pour celles et ceux qui ont quelque chose à raconter.</p>
          <div className="hero-actions"><a className="btn btn-dark" href="#decouvrir">Lire les histoires <ArrowRight size={17}/></a><button className="btn btn-text" onClick={() => setShowWritePanel(true)}>Commencer à écrire <ArrowDownRight size={17}/></button></div>
          <div className="hero-note"><div className="avatar-stack"><span>A</span><span>✦</span><span>✍</span></div><span><strong>Chaque voix compte.</strong><br/>La vôtre aussi.</span></div>
        </div>
        <div className="hero-art" aria-label="Illustration abstraite d'un carnet et d'une plume">
          <div className="art-sun"/><div className="art-paper paper-back"><span>les idées<br/>deviennent<br/><i>des mondes</i></span></div><div className="art-paper paper-front"><div className="paper-top"><span>AURORE / CARNET N°01</span><span>✳</span></div><div className="paper-lines"/><div className="paper-title">Écrire,<br/><em>c’est semer.</em></div><div className="paper-footer">UNE PAGE À LA FOIS <ArrowDownRight size={16}/></div></div><div className="art-stamp"><Feather size={25}/><span>ÉCRIRE<br/>LIBREMENT</span></div><span className="art-orbit orbit-one"/><span className="art-orbit orbit-two"/></div>
      </section>

      <section className="manifesto-strip" id="manifeste"><span>01 / LIRE</span><p>Des textes qui touchent.</p><span>02 / ÉCRIRE</span><p>Un espace pour créer.</p><span>03 / PARTAGER</span><p>Des voix qui se rencontrent.</p></section>

      <section className="discover section-wrap" id="decouvrir">
        <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> LE SALON DE LECTURE</div><h2>À la rencontre<br/>des <em>mots.</em></h2></div><p>Chaque texte ouvre une fenêtre. Parcourez les univers, prenez le temps, laissez-vous surprendre.</p></div>
        <div className="search-row"><label className="search-box"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Un titre, une idée, un auteur…" aria-label="Rechercher un texte"/></label><div className="genre-list">{genres.map(g => <button key={g} className={genre === g ? 'genre-chip selected' : 'genre-chip'} onClick={() => setGenre(g)}>{g}</button>)}</div></div>
        {loading ? <div className="loading-state"><span className="loader"/> Les histoires arrivent…</div> : <div className="works-grid">
          {displayed.map((work, i) => <article className={'work-card card-tone-' + (i % 3)} key={work.id}>
            <div className="work-card-top"><span className="work-category">{work.genre || 'Texte libre'}</span><button className="icon-button" aria-label="Lire le texte" onClick={() => setActiveWork(work)}><ArrowUpRightIcon/></button></div>
            <div className="work-ornament">{i % 3 === 0 ? <span className="ornament-sun">✳</span> : i % 3 === 1 ? <span className="ornament-loop">〰</span> : <span className="ornament-star">✦</span>}</div>
            <h3>{work.title}</h3>{work.subtitle && <p className="work-subtitle">{work.subtitle}</p>}<p className="work-summary">{work.summary || (work.body || '').slice(0, 115)}</p>
            <div className="work-card-bottom"><div className="author-dot">{(work.author?.display_name || work.author || 'A').toString().slice(0,1).toUpperCase()}</div><span>par <strong>{work.author?.display_name || work.author || 'Auteur Aurore'}</strong>{work.label && <small className="sample-label">{work.label}</small>}</span><button onClick={() => setActiveWork(work)} className="read-link">Lire <ArrowRight size={15}/></button></div>
          </article>)}
          {displayed.length === 0 && <div className="empty-state"><BookOpen size={26}/><h3>Aucun texte pour l’instant</h3><p>Essayez un autre mot ou revenez bientôt : de nouvelles voix prendront place ici.</p><button className="btn btn-outline" onClick={() => {setQuery('');setGenre('Tout')}}>Effacer les filtres</button></div>}
        </div>}
        {examples && <p className="demo-note">Les cartes marquées « EXEMPLE » sont des aperçus de design, pas des publications réelles.</p>}
      </section>

      <section className="writer-banner" id="auteurs"><div className="writer-mark"><PenLine size={27}/></div><div><div className="eyebrow light"><span className="eyebrow-line"/> VOTRE HISTOIRE COMMENCE ICI</div><h2>Une idée vous habite ?<br/><em>Donnez-lui des mots.</em></h2><p>Un carnet à vous, un espace pour vos brouillons, et la possibilité de partager votre texte quand vous serez prêt.</p></div><button className="btn btn-cream" onClick={() => setShowWritePanel(true)}>Ouvrir mon carnet <ArrowRight size={17}/></button><span className="banner-spark">✳</span></section>
    </main>

    <footer className="site-footer"><a className="brand footer-brand" href="#"><span className="brand-mark"><Feather size={18}/></span><span>aurore<span className="brand-light">plume</span><small>LES MOTS PRENNENT LEUR ENVOL</small></span></a><p>Un espace de création, de lecture et de rencontre.</p><span>© {new Date().getFullYear()} Aurore · Une voix après l’autre.</span></footer>

    {activeWork && <div className="modal-backdrop" onClick={() => setActiveWork(null)}><article className="reading-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setActiveWork(null)} aria-label="Fermer"><X/></button><span className="work-category">{activeWork.genre || 'Texte libre'}</span><h2>{activeWork.title}</h2>{activeWork.subtitle && <p className="modal-subtitle">{activeWork.subtitle}</p>}<p className="modal-byline">Par {activeWork.author?.display_name || activeWork.author || 'Auteur Aurore'}</p><div className="reading-body">{activeWork.body || activeWork.summary || 'Ce texte sera bientôt disponible.'}</div>{activeWork.label && <p className="demo-note">Aperçu de démonstration — pas une œuvre publiée.</p>}</article></div>}
    {showWritePanel && <div className="modal-backdrop" onClick={() => setShowWritePanel(false)}><section className="write-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setShowWritePanel(false)} aria-label="Fermer"><X/></button><span className="modal-icon"><Feather/></span><div className="eyebrow"><span className="eyebrow-line"/> VOTRE CARNET</div><h2>La première phrase<br/><em>vous appartient.</em></h2><p>La base d’Aurore Plume est en place. L’espace de rédaction privé, la sauvegarde des brouillons et l’envoi en relecture seront activés avec le parcours de connexion sécurisé.</p><div className="next-steps"><span><Heart size={16}/> Vos textes restent privés par défaut</span><span><BookOpen size={16}/> Vous gardez le contrôle de la publication</span></div><button className="btn btn-dark full-width" onClick={() => setShowWritePanel(false)}>J’ai hâte de commencer <ArrowRight size={16}/></button></section></div>}
  </div>;
}

function ArrowUpRightIcon() { return <ArrowDownRight size={17} style={{ transform: 'rotate(-135deg)' }} />; }
createRoot(document.getElementById('root')).render(<App />);
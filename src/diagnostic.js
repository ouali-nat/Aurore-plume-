import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const worker = 'https://aurore-plume.oualikevin6.workers.dev';
const client = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
const rows = document.querySelector('#results');
const overall = document.querySelector('#overall');
const updated = document.querySelector('#updated');
const button = document.querySelector('#refresh');

function add(name, status, detail) {
  const tr = document.createElement('tr');
  const label = document.createElement('td'); label.textContent = name;
  const state = document.createElement('td');
  const badge = document.createElement('span'); badge.className = 'status ' + (status === 'OK' ? 'ok' : status === 'À vérifier' ? 'warn' : status === 'Test requis' ? 'run' : 'bad'); badge.textContent = status;
  state.append(badge);
  const info = document.createElement('td'); info.textContent = detail;
  tr.append(label, state, info); rows.append(tr);
}
async function run() {
  button.disabled = true; rows.replaceChildren(); overall.textContent = 'Diagnostic en cours…';
  let failures = 0; let warnings = 0;
  const check = (name, status, detail) => { add(name, status, detail); if (status === 'Échec') failures++; if (status === 'À vérifier' || status === 'Test requis') warnings++; };
  check('Configuration Supabase', client ? 'OK' : 'Échec', client ? 'URL et clé publique disponibles dans cette version.' : 'VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY manque dans la compilation Vercel.');
  if (client) {
    try {
      const res = await fetch(url.replace(/\/$/, '') + '/auth/v1/health', { headers: { apikey: key } });
      check('Service Auth Supabase', res.ok ? 'OK' : 'Échec', 'Réponse HTTP ' + res.status + '.');
    } catch (err) { check('Service Auth Supabase', 'Échec', err.message || 'Requête impossible.'); }
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      const session = data.session;
      check('Session utilisateur', session ? 'OK' : 'Test requis', session ? 'Session présente ; aucun jeton n’est affiché.' : 'Connectez-vous sur le site principal dans ce navigateur, puis relancez le diagnostic.');
      const { error: dbError } = await client.from('plume_profiles').select('id', { head: true, count: 'exact' }).limit(1);
      check('Table plume_profiles', dbError ? 'Échec' : 'OK', dbError ? dbError.message : 'Lecture de contrôle autorisée.');
      if (session) {
        try {
          const response = await fetch(worker + '/api/storage/list', { headers: { Authorization: 'Bearer ' + session.access_token } });
          let body = {};
          try { body = await response.json(); } catch {}
          const status = response.ok ? 'OK' : 'Échec';
          let detail = response.ok ? 'Le Worker a répondu ; liste privée accessible.' : 'HTTP ' + response.status + (body.error ? ' — ' + body.error : '');
          if (response.status === 500 && String(body.error || '').includes('SUPABASE_PUBLISHABLE_KEY')) detail += ' : ajouter la variable SUPABASE_PUBLISHABLE_KEY au Worker Cloudflare.';
          check('Worker Cloudflare / accès R2', status, detail);
        } catch (err) { check('Worker Cloudflare / accès R2', 'Échec', err.message || 'Requête impossible.'); }
      } else {
        check('Worker Cloudflare / accès R2', 'Test requis', 'Ce test nécessite une session connectée.');
      }
    } catch (err) { check('Session et base de données', 'Échec', err.message || 'Vérification impossible.'); }
  }
  overall.textContent = failures ? 'Diagnostic terminé : ' + failures + ' échec(s)' : warnings ? 'Diagnostic terminé : vérifications restantes' : 'Diagnostic terminé : contrôles réussis';
  updated.textContent = 'Dernière vérification : ' + new Date().toLocaleString('fr-FR') + '. Aucun fichier n’a été envoyé ou modifié.';
  button.disabled = false;
}
button.addEventListener('click', run);
run();

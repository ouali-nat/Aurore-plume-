# Aurore Plume

**L'atelier où les idées deviennent des histoires.** Aurore Plume est un espace francophone d'écriture et de publication littéraire : découverte des textes, atelier personnel et circuit de relecture humaine.

## Stack
- Vite 8 + JavaScript moderne
- Supabase Auth + PostgreSQL Data API
- Row Level Security (RLS) et droits SQL au niveau des colonnes
- Vercel pour l'hébergement statique

## Développement
1. Copier `.env.example` en `.env.local`.
2. Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Installer les dépendances avec `npm install`.
4. Lancer `npm run dev`; produire le site avec `npm run build`.

## Supabase
Projet : https://supabase.com/dashboard/project/iymioasfkithmyqtpipd

La migration `supabase/migrations/20261017090000_initial_aurore_plume_schema.sql` crée les profils d'auteurs, les textes et les commentaires. Toutes les tables exposées ont RLS. La clé publishable est prévue pour le navigateur ; aucune clé service-role ne doit être ajoutée au site.

## Publication éditoriale
Les auteurs peuvent créer et modifier leurs brouillons et demander une relecture. Les rôles clients ne peuvent pas écrire les colonnes `publication_status`, `is_public`, `published_at` ou `review_status`. Une personne de confiance doit approuver les textes depuis l'espace SQL Supabase. Exemple pour un texte relu :

```sql
update public.plume_works
set publication_status = 'published', is_public = true, published_at = now()
where id = '<UUID_DU_TEXTE>' and submission_requested_at is not null;
```

Un commentaire n'est public qu'après validation de `review_status = 'visible'`. Ne publiez que les textes dont les droits et l'accord de l'auteur ont été vérifiés.

## Configuration Vercel
Variables à ajouter aux environnements Production, Preview et Development :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

N'ajoutez jamais une clé `service_role` ou une clé Supabase secrète aux variables préfixées `VITE_`.

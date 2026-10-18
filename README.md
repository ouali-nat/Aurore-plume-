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

## Publication des œuvres

Le bouton **Publier** enregistre réellement le choix de visibilité :
- **Public — dans la bibliothèque** : l’œuvre passe à `publication_status = 'published'`, `is_public = true` et reçoit une date de publication. Après confirmation de Supabase, elle apparaît sur l’accueil et dans la bibliothèque.
- **Privé — moi uniquement** : l’œuvre reste en brouillon privé et n’est pas visible dans la bibliothèque publique.

La migration `supabase/migrations/20261018120000_allow_author_direct_publication.sql` accorde aux utilisateurs connectés les droits sur les seules colonnes de visibilité et de date nécessaires à ce choix. Les politiques RLS continuent de limiter chaque écriture aux œuvres dont `author_id = auth.uid()`. Les visiteurs non connectés ne peuvent lire que les œuvres publiées et publiques.

Les commentaires restent soumis à validation : un commentaire n’est public qu’après passage à `review_status = 'visible'`. Ne publiez que des textes dont vous possédez les droits.

## Configuration Vercel
Variables à ajouter aux environnements Production, Preview et Development :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

N'ajoutez jamais une clé `service_role` ou une clé Supabase secrète aux variables préfixées `VITE_`.

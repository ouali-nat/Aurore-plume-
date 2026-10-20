# Reconstruction d’Aurore Plume — référence Aurore Mémoire

## Règles de sécurité
- Cette branche de travail est séparée de `main`.
- La branche `archive/site-original-2026-10-20` conserve l’état d’origine du site.
- Aucun changement Supabase, R2, Aurore ID ou autre dépôt dans cette phase.
- Pas de déploiement en production depuis cette branche.
- Chaque étape doit être testée avant de continuer.

## Référence de design observée
Sources : dépôt `ouali-nat/Aurore-memories`, fichiers `style.css`, `aurore-pill.css`, `index.html`.
- Fond sombre : `#09080F`; surface : `#12101A`; surface élevée : `#181523`.
- Texte : `#F8F7FF`; texte secondaire : `#A9A3B8`; bordure : `#2A2438`.
- Accent violet initial : `#8B5CF6`; accent clair : `#C084FC`; accent profond : `#6D28D9`.
- En-tête vitré, halos d’accent, navigation en capsule, cartes et panneaux arrondis, transitions sobres.
- Thèmes clair/sombre et choix de couleur conservés.
- Les feuilles de papier et la composition des documents éditoriaux restent des surfaces de travail indépendantes : le thème du site ne doit pas recolorer le contenu du document.

## Inventaire fonctionnel à préserver ou reconstruire
- Découvrir et bibliothèque publique : lecture et recherche des œuvres réellement publiées.
- Atelier personnel : textes, vidéos, créations et brouillons privés.
- Authentification Aurore ID et état de session Supabase.
- Éditeur : pages, couverture, blocs de texte, images, éléments, LaTeX, réglages de page et typographie.
- Sauvegarde et publication des textes ; gestion des statuts.
- Export PDF et lecteur PDF.
- Clavier scientifique, modales, notifications et choix d’apparence.
- Intégration Worker/R2 existante à auditer avant toute modification.

## Séquence
1. Établir le socle visuel commun sans changer les données ni le flux d’authentification.
2. Refaire et vérifier l’en-tête, la navigation, les panneaux et les cartes.
3. Refaire les écrans Découvrir, Bibliothèque et Atelier.
4. Reconcevoir l’éditeur comme un espace de travail cohérent, puis tester l’export PDF.
5. Vérifier mobile, thèmes, session, brouillons, publication, lecture PDF et build.
6. Déployer en production seulement après validation explicite des contrôles.

## État au démarrage
L’application utilise Vite et une entrée principale `src/main.js`, qui construit les vues à partir de fonctions de rendu JS. Les styles sont répartis dans plusieurs feuilles de style. La refonte doit réduire les règles concurrentes progressivement, sans supprimer les capacités de l’éditeur avant que leurs remplacements soient testés.

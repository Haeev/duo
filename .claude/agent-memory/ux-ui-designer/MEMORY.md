# Carnet de ux-ui-designer

Apprentissages durables (conventions, pièges, astuces vérifiées). Pas d'avancement ici.

## Conventions de rédaction de l'interface

- Rédaction neutre: le genre des joueurs n'est pas connu (le PC est celui de la compagne du client). Participes avec « avoir » (« Sacha a rejoint »), jamais avec « être » (« Sacha est prête »). « Sacha est là », « Connexion perdue avec Sacha », « Sacha est de retour », « sur les deux ordinateurs » au lieu de « tous les deux ». Lexique complet: `docs/plateforme/ux/parcours.md`, section 0.2.
- État de départ d'un joueur: bouton « C'est parti ! » et puces « C'est parti » / « Pas encore » (neutres). La puce reprend toujours le libellé du bouton (« Veut rejouer », « Veut continuer »).
- Élision devant un pseudo ou un nom de jeu variable: « d'Inès », ou placer le nom après un deux-points.
- Docs: style maison sans espace avant « : » dans la prose; textes d'interface avec espaces insécables. `design/maquettes/plateforme-wireframes/typographier.py` applique la typographie aux HTML (idempotent, saute script et style).

## Tailles d'écran à tester (points logiques)

- 1280x720: écran 1080p réglé à 150 % dans Windows, fréquent sur les portables. Cible « sans défilement ».
- 1366x689 et 1280x640: fenêtres agrandies avec barre des tâches de Windows 11 (48 px) et barre de titre. Défilement vertical permis, action principale visible.
- 1093x615: 1366x768 avec l'interface à 125 %. Jamais de défilement horizontal.
- Test d'effort: police forcée en DejaVu Sans (environ 10 % plus large que Segoe UI) et pseudos de 16 caractères (« Maximilien-Louis »). Script: `verifier-mise-en-page.js`.

## Pièges vérifiés (Chromium et Playwright)

- `system-ui` donne Inter dans l'environnement cloud: plus étroit que DejaVu, proche de SF Pro et Segoe UI.
- Ne jamais nommer un état d'écran (ancre `#etat`) comme un `id` de la page: la navigation vers l'ancre retire le focus posé au chargement.
- Un focus posé par script au chargement est bien `:focus-visible` dans Chromium.
- `page.goto` vers la même adresse avec la même ancre ne recharge pas: passer par `about:blank`.
- En JavaScript, `\s` attrape aussi U+00A0 et U+202F: pour comparer des textes typographiés, normaliser seulement `[ \t\r\n]`.
- Un pseudo-élément décoratif en `inset` négatif gonfle `scrollWidth` et fausse les détecteurs de débordement: utiliser `outline` et `outline-offset`.
- Un élément positionné plus loin dans le DOM passe devant un badge absolu: donner un `z-index` au badge.
- `dialog.showModal()` respecte `autofocus` à l'intérieur; Tab peut sortir de la fenêtre en headless, d'où un piège à focus explicite dans `commun.js`.
- Les vignettes provisoires (« Vignette ») polluent le nom des cartes lu par les lecteurs d'écran: `aria-hidden="true"`.

## Boîte à outils des wireframes

- `design/maquettes/plateforme-wireframes/commun.css` et `commun.js`: états par ancre (`data-si`), focus par défaut (`data-focus`, priorité numérique), Échap (`data-retour` ou `Duo.surEchap`), anti-double-appui de 300 ms, grille à flèches, onglets, compte à rebours, piège à focus des fenêtres.
- `capturer.js` (captures et planche), `verifier-mise-en-page.js` (débordements et contrastes WCAG), `verifier-clavier.js` (clavier seul, comptage des actions). Les trois se lancent depuis la racine du dépôt avec `node`.

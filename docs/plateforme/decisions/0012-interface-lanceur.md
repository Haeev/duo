# ADR 0012: Interface du lanceur

| Champ | Valeur |
|---|---|
| Statut | proposée |
| Date | 2026-10-30 |
| Rédacteur | architecte-technique |
| À relire par | dev-plateforme (lot L10), ux-ui-designer, directeur-artistique (jetons de l'identité) |
| Fonctions du cahier | F01 à F14 (écrans E01 à E19); section 5 (identité, accessibilité, tailles d'écran) |
| Liens | ADR 0003 (preload et IPC), 0004 (superpositions), 0013 (tests) |

## Contexte

La spécification UX décrit 20 écrans, des superpositions par-dessus le jeu, des notifications, des fenêtres de confirmation et une dizaine d'états par écran (vide, chargement, erreur, attente de l'autre, déconnexion, versions). Exigences du cahier 1.0 (section 5): navigation complète au clavier, contraste WCAG AA, distinction des joueurs sans la couleur, réduction des animations, aucun défilement jusqu'à 1280x720 points, taille de l'interface 100, 125 ou 150 % (F10). Identité retenue: piste B « Étoile double » (Q1): sombre et calme, traits fins, SVG et CSS, animations lentes de `transform` et `opacity`, polices Jost et DM Sans. Le lanceur doit tenir 60 images par seconde sur le PC de référence (CA-PF-095).

L'état qui compte (présence, salon, partie, téléchargements, données du duo) vit dans le processus principal (ADR 0003): l'interface en est une projection, plus son propre état d'écran (focus, fenêtres ouvertes, saisies).

Poids mesurés le 2026-10-30 avec esbuild (minifié, puis gzip -9) sur un composant à état minimal: Preact 11.1.0 avec `preact/hooks` et @preact/signals 2.11.4, 8 424 octets; React 19.3.1 avec `react-dom/client`, 68 903 octets.

## Options

| Option | Pour | Contre |
|---|---|---|
| TypeScript et DOM sans bibliothèque | aucune dépendance | simple au début, lourd à mesure que les états d'écran se multiplient: chaque mise à jour du DOM s'écrit à la main |
| Preact 11.1 et @preact/signals 2.11 | API de React, la plus connue des agents et des outils; 8,4 Ko gzip avec les hooks et les signaux (mesuré); signaux pour un état fin sans re-rendu global; JSX typé par TypeScript | majeure 11 sortie le 2026-09-30, donc jeune |
| Svelte 5.57 | compilateur, peu de code à l'exécution | syntaxe et « runes » récentes, moins connues; outillage de types à part |
| React 19.3 | la référence | 68,9 Ko gzip avec ReactDOM (mesuré), huit fois Preact, sans besoin qui le justifie (pas de rendu serveur, pas d'écosystème spécifique) |

Le guide de passage à Preact 11 (dépôt `preactjs/preact-www`, lu le 2026-10-30) ne change rien de structurant pour nous: distribution en modules ES seulement (Vite les gère), TypeScript 5.1 au moins (nous sommes en 6.0), `useRef` exige une valeur initiale, `defaultProps` et le suffixe `px` automatique passent dans `preact/compat`. @preact/signals 2.11.4 déclare accepter Preact 11 (`preact >=11.0.0-0`).

## Décision

**Preact 11.1.0 et @preact/signals 2.11.4**, sans `preact/compat`, sans routeur ni gestionnaire d'état tiers.

1. **État**: le principal publie des flux d'état typés (présence, duo, salon, partie, téléchargements, versions), que `preload-platform` expose en abonnements (ADR 0003); le lanceur les range dans des signaux. L'état local de l'interface (écran courant, focus, fenêtres, saisies) vit aussi dans des signaux. Aucune règle de jeu ni de session dans l'interface: elle envoie des intentions (« héberger », « c'est parti »), le principal décide.
2. **Écrans**: une union discriminée `Screen` (E01 à E19 et leurs sous-états), et un composant par écran choisi par un `switch` exhaustif (contrôlé par `switch-exhaustiveness-check`, ADR 0002). Pas de routeur d'adresses: l'interface n'a pas de navigation par URL.
3. **Textes**: un seul fichier de textes en français (`textes.ts`), typé (clé, texte ou fonction pour les textes à variables), avec les règles de l'UX: tutoiement, rédaction neutre, espaces insécables, apostrophe typographique, élision devant un nom (« le salon d'Inès »). Un test unitaire vérifie sa typographie (proposition UX 0.3, confiée à ingenieur-build). Passer au vouvoiement ou corriger un mot ne touche que ce fichier.
4. **Identité**: les jetons de directeur-artistique (couleurs des joueurs et de l'interface, rayons, durées, courbes) en propriétés CSS personnalisées dans un seul fichier, généré à partir de la source des jetons pour rester identique à leur document; polices `@fontsource-variable/jost` et `@fontsource-variable/dm-sans` (5.3.0, OFL-1.1, vérifié sur npm), embarquées; symboles des joueurs et ciel figé en SVG. CSS ordinaire, sans cadre CSS.
5. **Taille de l'interface** (H-24): facteur appliqué à la taille de police de la racine, tout en `rem`, et non le zoom de Chromium: la mise en page garde la largeur réelle de la fenêtre, et la règle de défilement de la section 5 du cahier reste vérifiable (H-31).
6. **Accessibilité**: une petite bibliothèque interne pour le focus (focus par défaut de chaque écran, retour du focus à la fermeture d'une fenêtre, focus gardé dans une fenêtre de confirmation, anti-double-appui de 300 ms, répétition automatique ignorée), `aria-live` pour les notifications, contrôles natifs (`button`, `input`, groupes de boutons radio) plutôt que des éléments recréés. Le champ d'adresse IP lit les touches de la rangée des chiffres par `KeyboardEvent.code` (H-05).
7. **Superpositions en partie**: la même application, dans la vue plateforme transparente (ADR 0004); panneaux indigo opaques à 92 %, sans flou.
8. **Performances**: animations limitées à `transform` et `opacity`, cinq étoiles scintillantes au plus (piste B), aucune animation avec « Réduire les animations » (qui suit d'abord `prefers-reduced-motion`); listes longues (historique de 2 000 parties) affichées par pages de 20 (UX 5.1).
9. **Tests**: chaque élément interactif porte un attribut `data-testid` stable, chaque message son identifiant `data-message="M-xx"` (prérequis 2 de qa-testeur). Le lanceur tourne aussi dans Chromium seul, avec un faux pont qui imite `preload-platform` d'après la même table de canaux: les tests à deux contextes (P2) le pilotent sans Electron (ADR 0013).

## Conséquences

- Les agents écrivent du JSX et des hooks qu'ils connaissent; les écarts propres à Preact 11 sont à lire dans sa documentation, conformément à la règle de l'ADR 0001.
- Repli si Preact 11 révèle un défaut bloquant: Preact 10.29.8 (dernière 10.x, 2026-08-01), au prix de quelques ajustements (refs, `useRef`), puisque nous n'employons ni `preact/compat` ni `defaultProps`.
- L'interface ne contient aucune logique métier: elle se teste par ses écrans, la logique par les tests unitaires du principal.
- Le style dépend des jetons de directeur-artistique; tant qu'ils ne sont pas livrés, le lot L10 travaille avec des jetons provisoires de même structure.

### À vérifier

- 60 images par seconde du lanceur sur le PC de référence, ciel et orbites compris (CA-PF-095, banc de mesure dès le prototype).
- Lecture d'écran (VoiceOver, Narrateur) des notifications et des puces d'état: hors critères pour l'instant, à proposer à qa-testeur si le client en exprime le besoin.

# Interface (lot L7)

DOM sans bibliothèque (socle repris de l'ancien jeu). Elle lit l'état par `GameView` et envoie des intentions. Maquettes: `docs/jeux/jeu-1/refonte/interface.md`. Une vue ne se redessine que sur la révision de la tranche qu'elle lit.

## Fichiers

- `index.ts`: `createInterface({ root, view, send, cameraYaw, projectToScreen?, keyLabel?, reducedMotion?, onBabble? })` rend `frame(dt)` (secondes), `capturing()` (dialogue, carnet ou rangement ouvert: la boucle n'envoie alors ni déplacement ni Espace) et `dispose()`.
- `modeles.ts`: modèles de vue purs (horloge, besoins, repli de la barre, bulle, pagination et écriture lettre par lettre, coup d'œil), testés dans `tests/interface.test.ts`.
- `hud.ts`, `dialogue.ts`, `carnet.ts`: les écrans. `textes.ts`: tous les textes. `reglages.ts`: durées et seuils.
- `carnet/`: les six onglets du carnet autres que le Sac (quêtes, habitants, collections, carte, tenues, réglages), chacun avec un modèle de vue pur testé (`tests/carnet-onglets.test.ts`). `lectures.ts` fixe les interfaces de lecture étroites (`QuestLineRead`, `VillagerRead`, `CollectionRead`, `MapRead`, `SettingsPort`) et `worldSources(content, extras)` les remplit depuis l'état réel (ce qui n'existe pas est vide); `fictif.ts` tient l'état factice (démonstration, tests). `plan.ts` lit un plan de lieu (format `plan-de-lieu`, essayé avec `docs/jeux/jeu-1/refonte/carte-aubrune/plan.json`); `carte.ts` en dessine la carte en SVG. `textes.ts` et `parametres.ts`: textes et réglages des onglets. `index.ts`: `createCarnetTabs`.
- `pictos.ts`, `portrait.ts`: pictos du studio; vignettes et portraits provisoires générés depuis l'identifiant.
- `boutique/`: écran de boutique (`ecran.ts`), modèle de vue pur (`modele.ts`, testé dans `tests/commerces.test.ts`), textes (`textes.ts`), styles; démonstration sur une vraie simulation: `boutique/demo/index.html` (`#acheter`, `#vendre`, `#refus`, `#achat`, `#vente`, `#pauvre`). Touches: A et E onglets, flèches (ou Z et S) vignettes, Q et D quantité, 1 à 5 quantité directe, V coffre commun, Entrée ou Espace acheter ou vendre, Retour sortir.
- `editeur/`: éditeur de personnage (5.8). `modele.ts` pur (rayons, choix, hasard, testé dans `tests/editeur.test.ts`), `editeur.ts` l'écran, `reglages.ts` (rayons par emplacement, réserves, tailles), `textes.ts`. S'ouvre seul tant que le joueur n'a pas d'apparence (`editorAtStart`), et sur l'événement `mirror_opened`. Aperçu 3D injecté par `characterPreview` (`rendu/personnages/apercu.ts`). Démo: `/src/interface/editeur/demo/index.html` (`#miroir`). Une pièce ajoutée au catalogue y paraît sans code; une pièce étiquetée `habitants` est masquée.
- `polices/`: Fraunces et Nunito Sans (OFL, déjà dans `CREDITS.md`).
- `demo/index.html`: l'interface seule sur un état factice (`#repos`, `#bulle`, `#coup-d-oeil`, `#dialogue-ecriture`, `#dialogue-choix`, `#carnet-sans-sac`, `#carnet-sac`, `#rangement`, et un onglet: `#carnet-quetes`, `-habitants`, `-collections`, `-carte`, `-tenues`, `-reglages`), servie par `pnpm --filter @duo/la-petite-ligne-2 dev` à `/src/interface/demo/index.html`.

Touches (manifeste): G coup d'œil, C carnet; dans le carnet A et E onglets, Z Q S D ou flèches, Espace prendre puis poser, Entrée manger, P poser, T donner, V verser et R retirer au coffre (Maj: par 10 €), Retour fermer.

## Onglets du carnet: se brancher

`createInterface({ ..., notebook: { sources, sourcesExtras, settings, openEditor, follow } })`, tout facultatif.

- **Quêtes, habitants, collections**: quand le système existe, adapter la fonction correspondante de `worldSources` (`lectures.ts`); les modèles et l'affichage ne changent pas. Aujourd'hui lus dans l'état: `progress.quests` et les fiches du lieu, `places[lieu].villagers` (rencontre, position), `progress.bonds` (100 points par cœur), `progress.collections`.
- **Carte**: `sourcesExtras.plans[lieu]` reçoit un plan lu par `parsePlan`; sans plan, l'onglet dit « pas de plan ». Zones fermées: `sourcesExtras.closed(lieu, monde)`.
- **Suite suivie**: `follow` (`FollowStore`), propre à chaque joueur; le coup d'œil (G) la lira. Pas encore d'intention réseau.
- **Réglages**: `settings` (`SettingsPort`): `graphics()` et `setGraphics()` du rendu, plus volume, besoins toujours visibles, taille et mouvement réduit. Taille: `zoom` sur la couche; mouvement réduit: `data-motion`; besoins: `HudFrame.needsAlways`. Le volume reste à brancher au SDK audio (`main.ts`).
- **Tenues**: le bouton appelle `openEditor`; l'éditeur se loge dans `[data-slot="editeur-personnage"]`.
- Touches: A et E (codes KeyQ, KeyE) changent d'onglet (pages d'abord dans les quêtes), Z Q S D et flèches choisissent, Entrée agit (suivre, voir sur la carte, régler), Tab et Maj+Tab changent de famille de collection.

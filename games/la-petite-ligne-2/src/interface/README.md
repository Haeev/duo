# Interface (lot L7)

DOM sans bibliothèque (socle repris de l'ancien jeu). Elle lit l'état par `GameView` et envoie des intentions. Maquettes: `docs/jeux/jeu-1/refonte/interface.md`. Une vue ne se redessine que sur la révision de la tranche qu'elle lit.

## Fichiers

- `index.ts`: `createInterface({ root, view, send, cameraYaw, projectToScreen?, keyLabel?, reducedMotion?, onBabble? })` rend `frame(dt)` (secondes), `capturing()` (dialogue, carnet ou rangement ouvert: la boucle n'envoie alors ni déplacement ni Espace) et `dispose()`.
- `modeles.ts`: modèles de vue purs (horloge, besoins, repli de la barre, bulle, pagination et écriture lettre par lettre, coup d'œil), testés dans `tests/interface.test.ts`.
- `hud.ts`, `dialogue.ts`, `carnet.ts`: les écrans. `textes.ts`: tous les textes. `reglages.ts`: durées et seuils.
- `pictos.ts`, `portrait.ts`: pictos du studio; vignettes et portraits provisoires générés depuis l'identifiant.
- `boutique/`: écran de boutique (`ecran.ts`), modèle de vue pur (`modele.ts`, testé dans `tests/commerces.test.ts`), textes (`textes.ts`), styles; démonstration sur une vraie simulation: `boutique/demo/index.html` (`#acheter`, `#vendre`, `#refus`, `#achat`, `#vente`, `#pauvre`). Touches: A et E onglets, flèches (ou Z et S) vignettes, Q et D quantité, 1 à 5 quantité directe, V coffre commun, Entrée ou Espace acheter ou vendre, Retour sortir.
- `polices/`: Fraunces et Nunito Sans (OFL, déjà dans `CREDITS.md`).
- `demo/index.html`: l'interface seule sur un état factice (`#repos`, `#bulle`, `#coup-d-oeil`, `#dialogue-ecriture`, `#dialogue-choix`, `#carnet-sans-sac`, `#carnet-sac`, `#rangement`), servie par `pnpm --filter @duo/la-petite-ligne-2 dev` à `/src/interface/demo/index.html`.

Touches (manifeste): G coup d'œil, C carnet; dans le carnet A et E onglets, Z Q S D ou flèches, Espace prendre puis poser, Entrée manger, P poser, T donner, V verser et R retirer au coffre (Maj: par 10 €), Retour fermer.

# La Petite Ligne: état du code (démo)

Point d'avancement du dev gameplay, du plus récent au plus ancien.

## Demandes du rendu

Tenue par le dev rendu 3D (`src/rendu/`). Chaque point dit ce que le rendu fait en attendant.

1. `cameraYaw()` (convention proposée par le rendu): angle, dans le repère du sol et avec la convention de `facing` (0 vers l'est, PI/2 vers le sud), de la direction « haut de l'écran » posée au sol. Z (haut): `(cos yaw, sin yaw)`; D (droite): `(cos(yaw + PI/2), sin(yaw + PI/2))`; S et Q à l'opposé. La valeur suit l'orientation visée (pas l'animation de 0,3 s), pour que la marche tourne d'un coup avec la touche. Première orientation: caméra au sud-est, `yaw = -3 PI/4` (Z part vers le nord-ouest).
2. `GameMap.props[i]`: ajouter `height` (la `hauteur` du type dans la carte) et `category` (`categorie`: `batiment`, `sol`, `equipement`, `mobilier`, `decor`, `arbre`). Le rendu en a besoin pour poser les personnages sur les sols surélevés (`platform` 0,4 m, `pontoon` 0,5 m) et pour dimensionner les substituts. En attendant: table de secours dans `src/rendu/reglages.ts` (`floorProps`).
3. Arbres: le rendu suppose que `map.trees` ne contient que les 12 arbres à couper de la lisière, et que les autres arbres de la carte (`tree_oak`, `tree_fir`) restent dans `map.props` (décor fusionné, jamais abattu).
4. Rotation des meubles (`PlacedFurniture.rotation`, `PlacementPreview.rotation`): le rendu applique la convention de la carte (`rotation.y = rotation x PI/2`, 0 face au sud, 1 face à l'est). À confirmer: `types.ts` dit « sens horaire vu de dessus », ce qui donnerait l'ouest pour 1.
5. Facultatif: savoir quelles cases sont en « herbe haute » (`,` de la carte) pour y pousser des touffes plus denses. En attendant, les touffes suivent un bruit déterministe.

## 2026-10-30, étape 1: contrats publiés

- `src/README.md`: modules, propriétaires, flux des données, contrats du rendu et de l'interface.
- `src/etat/types.ts` (état du monde), `src/etat/actions.ts` (intentions), `src/etat/carte.ts` (carte statique), `src/etat/vue.ts` (`GameView`, `createRenderer`, `createInterface`), `src/donnees/types.ts` (contenu).
- En attente: `packages/sdk` (pas encore là: adaptateur local dans `src/plateforme/`), `donnees/cartes/` (carte de secours d'après `demo.md` en attendant).

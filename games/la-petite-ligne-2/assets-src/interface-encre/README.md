# Interface encrée: sources et outils

- `generer-cadres.mjs`: cadres de `src/interface/encre/cadres.css` (thème sombre, liseré fin).
- `encrer.mjs`: le moteur « à la plume » (contour plein et délié, tremblé, effilé; liseré clair).
- `generer-images.mjs`: vignettes, pictos et portraits depuis `vignettes/`, `pictos/pictos.svg`, `portraits/`.
- `planche-images.cjs`: planche de contrôle (vignettes en 96 et 48 px, pictos, portraits).
- `capturer.cjs`, `verifier.cjs`: captures et contrôles de l'interface (voir `src/interface/encre/README.md`).

Outils lancés depuis le paquet, avec `NODE_PATH=/opt/node-tools/node_modules` (Playwright) et `rsvg-convert` (`outils/installer-outils.sh`).

## Ajouter une vignette d'objet

1. Copier `vignettes/_gabarit.svg` en `vignettes/<id de l'objet>.svg` (l'id de `donnees/commun/objets/`).
2. Dessiner en suivant les règles du gabarit: grille 96, formes trapues un peu de travers, couleurs du nuancier, ombre en aplat (`data-w="0"`, `data-clip`), éclat, 3 à 5 hachures.
3. `node assets-src/interface-encre/generer-images.mjs vignettes <id>`: écrit `assets/commun/interface/vignettes/<id>.svg`, `-96.png` et `-48.png`.
4. Regarder `node assets-src/interface-encre/planche-images.cjs /tmp/v.png vignettes --grand`.
5. Rien d'autre: l'interface prend le dessin à la place de la pastille (`itemThumb`), et `tests/interface-plume.test.ts` contrôle couleurs et tailles.

## Ajouter un picto ou un portrait

- Picto: un `<symbol id>` de plus dans `pictos/pictos.svg`, puis `generer-images.mjs pictos` (réécrit `src/interface/pictos-encre.ts`); `icon('<id>')` l'affiche.
- Portrait: copier `portraits/odette.svg` sous l'id de l'habitant, garder les trois calques `data-expr` (neutre, content, soucieux) et une `class="bouche"` par calque, puis `generer-images.mjs portraits <id>`. `portraitMarkup(id)` le prend; sinon, substitut généré.

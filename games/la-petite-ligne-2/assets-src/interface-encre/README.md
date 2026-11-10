# Interface encrée: sources et outils

- `generer-cadres.mjs`: cadres de `src/interface/encre/cadres.css` (thème sombre, liseré fin).
- `encrer.mjs`: le moteur « à la plume » (contour plein et délié, tremblé, effilé; liseré clair).
- `generer-images.mjs`: vignettes, pictos et portraits depuis `vignettes/`, `pictos/pictos.svg`, `portraits/`.
- `planche-images.cjs`: planche de contrôle (vignettes en 96 et 48 px, pictos, portraits).
- `generer-meubles.py`: écrit les sources des vignettes de meubles (même projection de trois quarts, séries de couleur miel et sauge); on modifie le script, pas ces SVG.
- `planche-serie.cjs`: planches de la série des vignettes par famille (outils, poissons, potager, cuisine, provisions, meubles), en 96 et 48 px sur case sombre; `--grand` ajoute le 192 px.
- `capturer.cjs`, `verifier.cjs`: captures et contrôles de l'interface (voir `src/interface/encre/README.md`).

Outils lancés depuis le paquet, avec `NODE_PATH=/opt/node-tools/node_modules` (Playwright) et `rsvg-convert` (`outils/installer-outils.sh`).

## Ajouter une vignette d'objet

Chaque objet de `donnees/commun/objets/` et chaque meuble posable (`placeable`) de `donnees/commun/meubles/` a sa vignette; `tests/interface-plume.test.ts` échoue sinon (exceptions justifiées dans `WITHOUT_THUMB`).

1. Copier `vignettes/_gabarit.svg` en `vignettes/<id>.svg` (l'id de l'objet), ou la vignette la plus proche de sa famille (même sachet, même assiette). Un meuble: une ligne et une fonction dans `generer-meubles.py`, puis `python3 assets-src/interface-encre/generer-meubles.py <id>`.
2. Dessiner en suivant les règles du gabarit: grille 96, formes trapues un peu de travers, couleurs du nuancier, ombre en aplat (`data-w="0"`, `data-clip`), éclat, 3 à 5 hachures, détail intérieur en traits colorés (`data-teinte`). Une variante de couleur (série miel, sauge) se fait par échange de tons sur la source voisine.
3. `node assets-src/interface-encre/generer-images.mjs vignettes <id>[,<id>...]`: écrit `assets/commun/interface/vignettes/<id>.svg`, `-96.png` et `-48.png`.
4. Regarder `node assets-src/interface-encre/planche-serie.cjs /tmp <id>[,<id>...] --grand`, puis la planche de sa famille (`planche-serie.cjs <dossier> <famille>`).
5. Rien d'autre: l'interface prend le dessin à la place de la pastille (`itemThumb`), et le test contrôle couleurs, tailles et couverture.

## Ajouter un picto ou un portrait

- Picto: un `<symbol id>` de plus dans `pictos/pictos.svg`, puis `generer-images.mjs pictos` (réécrit `src/interface/pictos-encre.ts`); `icon('<id>')` l'affiche.
- Portrait: copier `portraits/odette.svg` sous l'id de l'habitant, garder les trois calques `data-expr` (neutre, content, soucieux) et une `class="bouche"` par calque, puis `generer-images.mjs portraits <id>`. `portraitMarkup(id)` le prend; sinon, substitut généré.

# Interface encrée: sources et outils

- `generer-cadres.mjs`: cadres de `src/interface/encre/cadres.css` (thème sombre, liseré fin).
- `encrer.mjs`: le moteur « à la plume » (contour plein et délié, tremblé, effilé; liseré clair).
- `generer-images.mjs`: vignettes, pictos et portraits depuis `vignettes/`, `pictos/pictos.svg`, `portraits/`.
- `planche-images.cjs`: planche de contrôle (vignettes en 96 et 48 px, pictos, portraits).
- `generer-portraits.mjs`: écrit les sources des portraits composés depuis `portraits/fiches.json` (même trait que les portraits faits main, cinq expressions); `planche-portraits.cjs`: planche de tous les portraits d'habitants.
- `generer-meubles.py`: écrit les sources des vignettes de meubles (même projection de trois quarts, séries de couleur miel et sauge); on modifie le script, pas ces SVG.
- `planche-serie.cjs`: planches de la série des vignettes par famille (outils, poissons, potager, cuisine, provisions, meubles), en 96 et 48 px sur case sombre; `--grand` ajoute le 192 px.
- `generer-sachets.mjs`: écrit les sources des sachets de graines de fleurs et de légumes (`graines-<fleur>`, `graines-carotte`, `graines-poireau`: le sachet de `graines-radis`, une bande, la plante en petit, les graines tombées); on modifie le script, pas ces SVG.
- `generer-meubles.py` écrit aussi les objets d'intérieur d'Aubrune (lampes, horloges, cadres, vaisselle, tapis, lumignon...), chacun dessiné d'après son modèle 3D (`assets-src/decors/recoltables-aubrune/interieurs.py`, `fetes.py`).
- `planche-collections.cjs`: planches des vignettes des collections du carnet par famille (poissons, insectes, fleurs, graines, tresors, plats) en 192, 96 et 44 px (case de la barre du sac) sur case sombre, et en 44 px sur le papier du carnet.
- `capturer.cjs`, `verifier.cjs`: captures et contrôles de l'interface (voir `src/interface/encre/README.md`).

Outils lancés depuis le paquet, avec `NODE_PATH=/opt/node-tools/node_modules` (Playwright) et `rsvg-convert` (`outils/installer-outils.sh`).

## Ajouter une vignette d'objet

Chaque objet de `donnees/commun/objets/` et chaque meuble posable (`placeable`) de `donnees/commun/meubles/` a sa vignette; `tests/interface-plume.test.ts` échoue sinon (exceptions justifiées dans `WITHOUT_THUMB`).

1. Copier `vignettes/_gabarit.svg` en `vignettes/<id>.svg` (l'id de l'objet), ou la vignette la plus proche de sa famille (même sachet, même assiette). Un meuble: une ligne et une fonction dans `generer-meubles.py`, puis `python3 assets-src/interface-encre/generer-meubles.py <id>`.
2. Dessiner en suivant les règles du gabarit: grille 96, formes trapues un peu de travers, couleurs du nuancier, ombre en aplat (`data-w="0"`, `data-clip`), éclat, 3 à 5 hachures, détail intérieur en traits colorés (`data-teinte`). Une variante de couleur (série miel, sauge) se fait par échange de tons sur la source voisine.
3. `node assets-src/interface-encre/generer-images.mjs vignettes <id>[,<id>...]`: écrit `assets/commun/interface/vignettes/<id>.svg`, `-96.png` et `-48.png`.
4. Regarder `node assets-src/interface-encre/planche-serie.cjs /tmp <id>[,<id>...] --grand`, puis la planche de sa famille (`planche-serie.cjs <dossier> <famille>`).
5. Rien d'autre: l'interface prend le dessin à la place de la pastille (`itemThumb`), et le test contrôle couleurs, tailles et couverture.

## Ajouter une vignette de collection (poisson, insecte, fleur, trésor, plat)

Le carnet montre chaque entrée de `donnees/commun/carnet/` par sa vignette: celle de l'objet de la source pour une recette (`source.item`, le plat), sinon celle qui porte l'identifiant de l'entrée (insecte, trésor de l'histoire). `tests/interface-plume.test.ts` exige un dessin pour chaque insecte et chaque prise posée à la main.

1. Copier la vignette la plus proche de la famille sous `vignettes/<id>.svg`: poisson de profil tête à gauche (`gardon`), insecte vu de dessus ailes ouvertes (`papillon-citron`) ou de profil (`criquet-des-patures`), fleur coupée avec sa tige (`marguerite`), plat dans son contenant (`truite-grillee`, `compotee-de-mures`, `tarte-aux-mures`). Un sachet de graines de fleur: une entrée dans `generer-sachets.mjs`, puis `node assets-src/interface-encre/generer-sachets.mjs <id>`.
2. Donner à chaque espèce sa silhouette et deux couleurs qui la distinguent de ses voisines de famille; les petites formes colorées prennent `data-w` 0,4 à 0,5 (le contour plein les noircit à 44 px).
3. `NODE_PATH=/opt/node-tools/node_modules node assets-src/interface-encre/generer-images.mjs vignettes <id>`.
4. `NODE_PATH=/opt/node-tools/node_modules node assets-src/interface-encre/planche-collections.cjs /tmp <famille>`: regarder la vignette à 44 px sur fond sombre et sur papier, près de ses voisines.
5. `pnpm exec vitest run --clearCache`, puis `pnpm exec vitest run tests/interface-plume.test.ts`. Rien d'autre: la pastille à lettres disparaît du carnet et du sac.

## Ajouter un picto

- Picto: un `<symbol id>` de plus dans `pictos/pictos.svg`, puis `generer-images.mjs pictos` (réécrit `src/interface/pictos-encre.ts`); `icon('<id>')` l'affiche.

## Ajouter un portrait d'habitant

Chaque habitant de chaque lieu a son portrait, en cinq expressions (neutre, content, soucieux, surpris, fache); `tests/portraits-habitants.test.ts` échoue sinon, ou si une réplique demande une expression absente (émotion de la réplique: `moodOfEmote` dans `src/interface/portrait.ts`).

1. Lire la fiche de l'habitant (`donnees/lieux/<lieu>/habitants/<id>.json`): silhouette, peau, pièces et couleurs du catalogue; et ses trois lignes dans `ecriture-habitants.md` (âge, métier, caractère).
2. Copier l'entrée la plus proche de `portraits/fiches.json` sous l'id de l'habitant (le `_gabarit` liste les champs et leurs valeurs); reprendre ses couleurs, choisir l'humeur au repos (`bouche`) et un ou deux accessoires de métier (`PROPS` de `generer-portraits.mjs`; un accessoire nouveau s'y ajoute en quelques lignes). Même personne sous deux ids: `{ "comme": "<id>" }`.
3. `node assets-src/interface-encre/generer-portraits.mjs <id>`: écrit la source `portraits/<id>.svg` (ne pas la retoucher).
4. `NODE_PATH=/opt/node-tools/node_modules node assets-src/interface-encre/generer-images.mjs portraits <id>`: écrit le portrait encré et un PNG par expression.
5. Regarder `NODE_PATH=/opt/node-tools/node_modules node assets-src/interface-encre/planche-portraits.cjs /tmp/planche.png <id>` (tous en neutre avec leur nom, les cinq expressions de `<id>`, la rangée en 64 px): silhouette reconnaissable en petit, rien qui dépasse.
6. `pnpm exec vitest run --clearCache` (le cache de Vitest ne voit pas un SVG nouveau), puis `pnpm exec vitest run tests/portraits-habitants.test.ts`. Rien d'autre: `portraitMarkup(id)` le prend, l'étiquette « provisoire » disparaît. Un portrait fait main (Odette, Firmin) garde les cinq calques `data-expr` et une `class="bouche"` par calque.

# Essai de style 4: personnages encrés, denses, lisibles de haut

Essai du tech-artist (2026-11-10), style « bande dessinée encrée » de la bible 0.2. Rien n'est livré dans le jeu.
Planche: `comparaison.png`. Mesures et coûts: `mesures.json`. Tâches Meshy et crédits: `meshy/corps.meshy.json`.

## Ce qui change depuis l'essai 3

- **Corps**: un par gabarit (femme, homme, costaud, âgée, enfant), chacun parti d'une image de concept
  (`meshy/*-concept.jpg`), puis image vers 3D sans texture et rig. Mains, pieds, tête et repères du visage
  viennent de la fiche du corps (`gabarits/corps/`).
- **Coiffures**: une calotte plus de vraies mèches en volume, découpées par la coque d'encre (4 fiches).
- **Volume**: le canal alpha de l'atlas est une carte de hauteur (couches, ourlets, poches, boutons, ceinture,
  semelles, plis): le nuanceur en tire le relief et pousse les sommets. Le col de chemise est une pièce de
  géométrie commune (`scripts/col.py`, 56 triangles), posée sur chaque corps.
- **Nuanceur encré** (`scripts/scene.html`, un programme par variante): ombre teintée, troisième ton dans les
  creux, hachures ancrées à l'objet et à pas constant à l'écran, liseré côté soleil, ombre portée nette,
  flaque de lanterne à deux anneaux, vignette dans le matériau. Aucune passe plein écran.
- **Lisibilité de loin**: les niveaux de mip 2 et suivants de l'atlas sont des aplats sans trait (fichier
  `atlas/<nom>.loin.png`); hachures et traits du visage fondent sous 150 px par mètre. La planche montre la
  même vue avec et sans.
- **Sol d'essai**: la texture ne garde que le dessin à plat; pierres de bordure, cailloux, touffes hautes et
  piquets sont des volumes instanciés avec coque d'encre et ombre portée.

## Chaîne

1. `scripts/meshy_corps.py <dossier hors dépôt> concept|modele|rig`: concept, image vers 3D, rig (13 crédits).
2. `scripts/conformer_corps.py`: soudure, échelles de la fiche, 2 300 triangles, UV par bandes, seconde UV du
   visage calée sur les repères de la fiche, occlusion cuite, clips `marche` et `repos`.
   `scripts/reperes.py` rend la planche de réglage `.travail/reperes-<corps>.png`.
3. `scripts/coiffure.py` et `scripts/col.py`: pièces posées par rayons sur chaque corps.
4. `scripts/peindre.py`: atlas de 512 px (couleur et hauteur), niveaux de loin, atlas commun des traits.
5. `scripts/exporter_corps.py`, puis `scripts/scene.html` et `scripts/capturer.mjs` pour la planche:
   `node scripts/capturer.mjs <dossier de three> comparaison.png 1800 2000 "" mesures-brutes.json`
   (`?vue=jeu|proche|visages|portraits|croix` rend une seule case en grand).

Tout se reconstruit par `python3 scripts/construire.py` (1 min; `--corps <dossier des rigs>` pour reconformer,
`--seulement atlas` pour ne repeindre que les textures).

## Traits et plis dessinés à la plume (artiste 2D, 2026-11-10)

Planche: `comparaison-plume.png` (avant | après). Sources dessinées, encrées par le moteur de l'interface
(`games/la-petite-ligne-2/assets-src/interface-encre/encrer.mjs`, via `scripts/encrer-lot.mjs`):

- `gabarits/visages/traits.svg`: pièces du visage (7 yeux, 4 sourcils, 9 bouches, 3 nez, pommettes, rougeur,
  taches, pattes d'oie, poches, sillons, fossettes, moustache, barbe, lunettes, rides du front, menton).
  `expressions.toml`: 12 cellules (neutre, joie, rire, surprise, souci, colère, sommeil, parole, parole fermée,
  clin d'oeil, bouderie, réflexion) et marques de l'âge (jeune, adulte, âgé). Bloc `[visage]` des personnages.
- `scripts/traits.py`: un atlas par personnage `atlas/traits-<id>.png` (4 x 3 cellules de 128 px, nez et
  étirement de la cellule propres au corps, couleurs du personnage) et `atlas/traits.json`; front, menton et
  barbe passent dans l'atlas du corps (`peindre.py`). Coût: 0,7 Mo par personnage proche (512 x 384 et mips).
- `gabarits/plis/plis.svg` et `plis.toml`: coude, genou, aine, taille, aisselle, ourlet, couture, poches,
  bouton, côtes, torsades, carreaux, rayures, pois, en calques encre, ombre, clair et zones; `scripts/plis.py`
  en tire les calques et la hauteur (canal alpha de l'atlas); planche de contrôle `.travail/plis/planche.png`.
- Repère du nez: `[visage] nez` de la fiche du corps (fraction des yeux à la bouche, 0,62 par défaut); le point
  « nez » du conformateur est souvent la lèvre.

## Ajouter du contenu

- Une expression (dix lignes au plus):
  1. copier un bloc `[[expression]]` à la fin de `gabarits/visages/expressions.toml`, changer `nom`;
  2. choisir `yeux` (ou `yeux_g`/`yeux_d`), `sourcils`, `bouche`, `extras` parmi les pièces de `traits.svg`;
  3. s'il faut une forme neuve: copier un `<symbol>` de la même famille dans `traits.svg` (`oeil-*` dans le
     repère de l'oeil gauche, `bouche-*` centré sur la bouche), garder les couleurs `#FF00A1` à `#FF00A8`;
  4. `python3 scripts/construire.py --seulement atlas`, puis `?vue=expressions&qui=<id>` pour la voir;
  5. la scène la trouve par son nom (`EXPRESSION[nom]`), sans autre changement.
- Un motif de pli ou d'encre (dix lignes au plus):
  1. copier le `<symbol id="coude">` de `gabarits/plis/plis.svg` sous un nouvel id, garder `data-repere`;
  2. dessiner dans les calques `encre` (traits `fill="none"`, noirs en `fill="#000"`), `ombre`, `clair`;
  3. ajouter `[tampons.<id>]` dans `plis.toml` (support, centre, angle, hauteur) ou, pour une seule tenue,
     `[plis] coude = "<id>"` dans sa fiche (`= ""` ôte un pli);
  4. `python3 scripts/construire.py --seulement atlas`, regarder `.travail/plis/planche.png` et la scène.

- Une tenue: copier `gabarits/tenues/carreaux-jean.toml`, changer `id`, cotes (relatives au corps) et couleurs
  du nuancier (`!nom` garde la couleur vive: un seul accent par tenue). Blocs facultatifs: `[gilet]`,
  `[bavette]`, `[foulard]`, `[chaussettes]`.
- Un coloris: un bloc `[coloris]` dans la fiche du personnage.
- Une coiffure: copier `gabarits/coiffures/carre.toml` (calotte, groupes de mèches, boules).
- Un personnage: copier `gabarits/personnages/maelle.toml` (corps, tenue, coiffure, peau, cheveux).
- Un corps: copier `gabarits/corps/femme.toml`, déposer le rig dans `<dossier>/<id>/marche.glb`, lancer
  `construire.py --corps <dossier>`, régler les repères du visage sur la planche de réglage.

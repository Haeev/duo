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

## Ajouter du contenu

- Une tenue: copier `gabarits/tenues/carreaux-jean.toml`, changer `id`, cotes (relatives au corps) et couleurs
  du nuancier (`!nom` garde la couleur vive: un seul accent par tenue). Blocs facultatifs: `[gilet]`,
  `[bavette]`, `[foulard]`, `[chaussettes]`.
- Un coloris: un bloc `[coloris]` dans la fiche du personnage.
- Une coiffure: copier `gabarits/coiffures/carre.toml` (calotte, groupes de mèches, boules).
- Un personnage: copier `gabarits/personnages/maelle.toml` (corps, tenue, coiffure, peau, cheveux).
- Un corps: copier `gabarits/corps/femme.toml`, déposer le rig dans `<dossier>/<id>/marche.glb`, lancer
  `construire.py --corps <dossier>`, régler les repères du visage sur la planche de réglage.

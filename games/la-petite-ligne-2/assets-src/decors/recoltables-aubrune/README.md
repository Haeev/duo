# Récoltables d'Aubrune: tout ce qu'on récolte et tout ce qui pousse dehors

Style encré validé (référence: la végétation de la scène d'essai, `src/rendu/demo-encre/vegetation.ts`), porté en modèles livrés. Identité du lieu: campagne, herbe tendre, terre blonde, bois miel. Un autre lieu aura son dossier, son nuancier et ses essences.

```text
bash games/la-petite-ligne-2/assets-src/decors/recoltables-aubrune/construire.sh     (tout, 10 s)
bash games/la-petite-ligne-2/assets-src/decors/recoltables-aubrune/planche/planche.sh (planche, 3 min)
```

Sorties, dans `assets/commun/decors/` (les fiches de meubles de `donnees/commun/` servent dans plusieurs lieux et `DecorModels` charge ce dossier une fois; le nom du fichier porte le lieu): `aubrune-arbres.glb`, `aubrune-recoltes.glb`, `aubrune-potager.glb`, et leurs entrées dans le manifeste commun `decors.json` (`source: "recoltables-aubrune"`, tables `materials` et `crops`). Le script finit par `VERIFICATION recoltables: ... 0 erreur(s)`.

## Ajouter un récoltable (aucun code)

1. Ouvre `recoltables.toml` et copie l'entrée `[[modeles]]` la plus proche (même `famille`: arbre, buisson, rocher, fleur, bois, repere, parcelle, culture).
2. Change `id` (anglais, minuscules, traits d'union) et `graine` (elle fixe la forme).
3. Arbre: choisis ou copie une `[essences.<nom>]` (fût, houppier, teintes, fruits). Culture: `culture` est l'identifiant de sa fiche `donnees/commun/cultures/`, dont le nombre de stades est lu.
4. Ajoute au besoin `variantes` (autres formes tirées à la pose) et `etats` (`stump`, `winter`, `bare`, `chipped`; pour un arbre semé, `far` et `shade`: ses versions allégées, réglées par `[allege.far]` et `[allege.shade]`, que le rendu pose loin du couloir de jeu et dont il fait les ombres portées).
   `pose = { cap = true, echelle = [a, b] }`: écarts de pose propres au modèle et à ses variantes, à la place de ceux de la famille (un modèle trop petit à la caméra de jeu se grossit ici, sans retoucher les formes).
5. Une teinte nouvelle: une ligne dans `[teintes]` (deux ou trois tons, une pièce tire le sien).
6. `bash construire.sh`: modèles, manifeste et contrôle (budget, sol, matériaux, états attendus par les fiches).
7. Branche la fiche: `"model": "<id>"` dans `donnees/commun/meubles/<meuble>.json`, ou `"model": "crop-<culture>"` dans la fiche de la culture.
8. Regarde-le: ajoute-le à une vue de `planche/monter.py`, puis `planche/planche.sh`.
9. `pnpm exec vitest run tests/rendu/recoltables.test.ts`: aucune ressource des données sans modèle.

## Ce que le rendu lit

- **Modèle d'un meuble**: `model` de sa fiche (inchangé). `DecorModels.instantiate(model, clé, état)` tire la forme (`variants`), le cap et l'échelle (`jitter`) de la clé de l'exemplaire (son identifiant dans le lieu: la même forme chez les deux joueurs); l'état garde ce cap et cette échelle. Ce que le jeu lit dans l'état transmis: `src/rendu/lieu/recoltes.ts` (README du dossier).
- **États** (`decors-manifeste.ts`): `stateModel(model, état)` rend le modèle de `stump` (arbre abattu), `bare` (sans fruits, tas vide), `winter` (sans feuilles), `chipped` (rocher entamé), `tilled` et `watered` (case bêchée, arrosée, de 1 m, à poser sur le potager); `null`: il ne reste rien (`after: "gone"`).
- **Cultures**: `cropModel(crop.model, stade, à arroser)` rend le modèle d'une case (le stade `stages.length` est mûr). Les plants sont posés sur les billons: même origine que la case bêchée.
- **Matériaux** (table `materials` du manifeste, lue par `mergeNamed` de `decors.ts`): la couche de traits et la prise au vent viennent du NOM; la teinte de `COLOR_0`. Chaque modèle est fusionné au chargement en un seul maillage (un appel de dessin par exemplaire).

| Matériau    | Emploi                                 | Couche  | Vent                  |
| ----------- | -------------------------------------- | ------- | --------------------- |
| `feuillage` | touffes, feuilles des ronces           | `leaf`  | plie et frémit        |
| `ecorce`    | tronc et branches d'un arbre vivant    | `bark`  | plie avec le houppier |
| `bois`      | souche, bûche, piquet, branche morte   | `grain` |                       |
| `pierre`    | rochers, cailloux, éclats              | `face`  |                       |
| `mousse`    | plaques de mousse                      | `leaf`  |                       |
| `terre`     | friche, billons, mottes, flaques       | `dirt`  |                       |
| `tige`      | tiges, herbes, feuilles des plants     | `plain` | plie                  |
| `fruit`     | pommes, mûres, radis, tomates          | `plain` | plie                  |
| `fleur`     | corolles, ombelles, massettes, bouchon | `plain` | plie                  |

- **Vent**: le nuanceur du jeu plie ce qui est souple selon la hauteur au-dessus de l'origine du modèle (le pied). Il n'y a donc pas d'attribut de poids dans les GLB: l'origine au pied suffit.
- **Normales**: imposées. À plat pour la pierre et le bois; rayonnant du coeur de chaque touffe pour le feuillage (l'ombre dessine une masse); lissées pour la terre (pas d'arête tracée entre deux billons).
- **Faces absentes**: ni dessous ni UV (la caméra plonge de 35 à 50 degrés, la matière encrée projette ses traits).

## Raisons d'être

- Le houppier commence à la hauteur du fût (2,9 m pour le chêne): on passe dessous. À 50 degrés de plongée il cache quand même le haut du personnage qui travaille au pied: l'effacement du rendu doit suivre `size` du manifeste (largeur réelle du houppier), pas la case du tronc.
- Une branche finit dans une touffe; une ronce retombe sur son fourré; les fruits sont posés sur le dessus des masses, là où la caméra les voit.
- Une case bêchée est une planche de terre relevée de 7 cm (plus haute que les bosses de la friche qu'elle recouvre) qui porte trois billons; les plants poussent sur les crêtes; l'eau brille au fond des sillons d'une case arrosée; une plante à arroser a les feuilles tombantes et jaunies, sur une terre claire.
- Le piquet d'un pied de tomate est planté dès la première vraie feuille et dépasse toujours la plante.
- Repères: la fouille se voit à ses éclats clairs sur une motte, la pêche à son bouchon rouge et blanc pendu au piquet, le coin à insectes à ses ombelles blanches.

## Fichiers

| Fichier                          | Rôle                                                                       |
| -------------------------------- | -------------------------------------------------------------------------- |
| `recoltables.toml`               | budgets, matériaux, nuancier, essences, modèles: la seule chose à modifier |
| `formes.py`                      | atelier des formes (touffe, fût, galet, feuille), numpy et scipy           |
| `familles.py`                    | une fonction par famille, variantes et états                               |
| `construire.py`, `construire.sh` | écriture des GLB par Blender, manifeste, puis contrôle                     |
| `verifier.py`                    | contrôle sans Blender (GLB, budgets, sol, fiches du jeu)                   |
| `planche/`                       | page de contrôle sur le rendu encré du jeu, captures, montage              |

## Livrés sans fiche de jeu (à brancher par le game designer et le level designer)

`berry-bush` (buisson à baies), `rock`, `rock-mossy`, `boulder`, `boulder-mossy` et leurs états `chipped` (aucune ressource de pierre à miner dans les données), `wild-herbs`. Les états `winter` attendent que le rendu lise la saison.

Branchés sans meuble: `fishing-spot` sur la berge de chaque coin de pêche de `lieu.json`, `insect-spot` dans les zones de `nature.json` (`markers` de `src/rendu/lieu/reglages-recoltes.ts`); `oak-tree`, `ash-tree`, `birch-tree` et `berry-bush-bare` pour la végétation semée par tuile (`semis`).

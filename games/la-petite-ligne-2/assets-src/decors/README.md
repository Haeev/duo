# Décors: sources des meubles, du mobilier de lieu, de la végétation et des maisons

Tout sort d'un fichier de données, `gabarits.toml`, par un script unique (environ 10 s):

```text
bash games/la-petite-ligne-2/assets-src/decors/construire.sh
```

Sorties: `assets/commun/decors/<fichier>.glb` (`furniture`, `street`, `plants`, `houses`: un nœud racine par modèle, nommé par son `id`) et `assets/commun/decors/decors.json` (manifeste: fichier, emprise, triangles, accroches, collision). Le script finit par `VERIFICATION decors: ... 0 erreur(s)`.

## Ajouter un décor (aucun code)

1. Ouvre `gabarits.toml` et repère une entrée `[[modeles]]` de la même `famille` (chaise, banc, table, lit, armoire, maison...).
2. Copie-la juste en dessous et change `id` (anglais, minuscules et traits d'union: `chair-garden`, `house-corner`).
3. Règle la forme: champs de la famille (en tête de chaque fonction de `familles.py`, et en tête de `maison.py` pour les maisons).
4. Choisis les couleurs: `couleurs = { bois = "...", peinture = "...", tissu = "...", metal = "..." }` (noms de `[couleurs]` ou des tissus du nuancier des personnages). Une maison: `murs`, `toit`, `menuiseries`, `volets`, `porte`, `soubassement`, `enseigne`, `store`.
5. Lance `construire.sh`: modèles, manifeste et contrôle.
6. Regarde-le: `duo-python assets-src/decors/planche.py assets/commun/decors <sortie.png> furniture` (ou `street,plants`, `houses`), avec le mannequin de 1,80 m.
7. Pour qu'un meuble du jeu l'affiche: son `id` dans le champ `model` de sa fiche (`donnees/commun/meubles/<id>.json`). Le rendu le trouve seul; une assise donne sa hauteur aux personnages assis (`decorSeats`).

Preuve: `chair-farm-sage` (coloris sauge de la chaise de ferme) tient en 3 lignes; `shed` (remise de 6 x 5, toit en appentis, porte à l'ouest) est une maison de plus en 15 lignes.

## Conventions

- 1 unité = 1 m; origine au centre de l'emprise, au sol; avant vers le sud (+Z glTF, -Y dans Blender). Rien sous le sol (contrôlé à 2 mm).
- Un matériau `decor` pour tout (couleurs de sommets, rugosité 0,8), aucune texture. `TEXCOORD_0.x = (zone + 0,5) / 8`: 0 bois, 1 peinture, 2 tissu, 3 métal, 6 fixe, pour recolorer une série au rendu plus tard (bible 7.4, 4 coloris par série).
- Bords arrondis (biseau à 2 segments, arêtes posées au sol laissées vives) et normales pondérées par l'aire: grandes faces planes, arrondis doux, aucun coin vif.
- Maisons: deux enfants, `<id>_walls` (murs, soubassement, portes, fenêtres, devanture) et `<id>_roof` (toit, faîtière, cheminée), pour effacer le toit seul. Panneaux posés devant le mur (6 mm), jamais en retrait.
- Accroches au manifeste (repère du jeu: x est, y sud): `seat` (dessus de l'assise, bord avant), `top` (plateau), `bed` (couchage), `doors` (milieu du seuil dehors, hauteur), `collision` (boîte ou cylindre de tronc).
- Cotes contrôlées par `verifier_decors.py`: assise 0,43 à 0,47 m, plateau de table 0,73 à 0,77 m, couchage 0,45 à 0,55 m, porte de 2,0 à 2,2 m, budget de triangles par famille (`[budgets]`), emprise d'un meuble dans les cases de sa fiche.

## Fichiers

| Fichier | Rôle |
|---|---|
| `gabarits.toml` | nuancier des décors, fichiers et budgets par famille, couleurs par défaut, modèles: la seule chose à modifier pour ajouter du contenu |
| `construire.sh` | construit et contrôle tout |
| `construire_decors.py` | lit les gabarits, construit chaque modèle, exporte les GLB et le manifeste (`DECORS_BLEND=<chemin>` garde un .blend à ouvrir) |
| `formes.py` | pièces arrondies (boîte, cylindre, boule, enveloppe, prisme), couleurs par pièce, fusion lissée |
| `familles.py` | une fonction par famille de meubles, de mobilier de lieu et de végétation |
| `maison.py` | maison paramétrique: largeur, profondeur, étages, toit (deux pans, croupe, appentis), portes, fenêtres, devanture, cheminée |
| `verifier_decors.py` | contrôle sans Blender (GLB, manifeste, cotes, budgets, fiches de meubles) |
| `planche.py` | planche Cycles d'un ou plusieurs fichiers, mannequin de 1,80 m |
| `meshy/` | fiches des essais Meshy (sorties brutes hors dépôt) |

## Meshy ou script ? (avis du 2026-11-10, essai de 10 crédits)

- **Script** (gardé): tout ce qui a une cote humaine ou une emprise de carte (assises, plateaux, lits, portes, maisons, barrières, quais), tout ce qui se décline en série et en coloris (une entrée de gabarit), et les arbres et buissons en boules de mousse, que le script tient dans le style de la bible avec des couleurs de nuancier exactes et un dégradé par la normale.
- **Meshy ferait mieux**: le décor riche et organique, cher à scripter, sans cote critique: ferronnerie en volutes (console de réverbère, grilles, enseignes à potence), objets de table et de décoration (vaisselle, bocaux, paniers, pots fleuris), nourriture, plantes à feuilles (fougères, potager), rochers et galets, statues et fontaines. L'essai (`meshy/essai-decors.meshy.json`) le confirme: le réverbère de Meshy a sa console en volute (1 058 triangles, le double du script), son arbre a un houppier plus vivant mais des boules détachées et un tronc trop mince.
- Route conseillée pour ces familles: image de référence du directeur artistique, `meshy-t2` en topologie intelligente au plafond de la famille, puis conformité (taille de la fiche, couleur de nuancier par pièce, origine au sol) et ajout comme une entrée `base = "meshy"` à créer dans ces gabarits sur le modèle du bonnet des personnages.

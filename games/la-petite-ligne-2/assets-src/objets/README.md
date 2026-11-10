# Objets: sources des modèles 3D (ce qu'on tient, ramasse, range, vend, mange)

Tout sort d'un fichier de données, `gabarits.toml`, par un script unique (moins de 5 s):

```text
bash games/la-petite-ligne-2/assets-src/objets/construire.sh            # GLB, index, contrôle
bash games/la-petite-ligne-2/assets-src/objets/construire.sh --planche  # plus planches/planche-objets.png
```

Sorties: `assets/commun/objets/<famille>.glb` (un nœud par objet, nommé par son `id`, et son enfant `<id>--grip`, point de prise en main) et `assets/commun/objets/index.json` (fichier, nœud, taille, prise, triangles). Le script finit par `VERIFICATION objets: ... 0 erreur(s)`.

## Ajouter un objet (aucun code)

1. Ouvre `gabarits.toml`, repère une entrée `[[objets]]` de la même `famille` (fruit, legume, poisson, bocal, bouteille, pain, plat, outil, sac, graine, fleur, caillou, bois, courrier, cle, piece, provision).
2. Copie-la juste en dessous; change `id`, `forme` (liste en tête de chaque famille), `taille` (plus grande dimension, m) et `couleurs` (noms du nuancier de la bible 2.4 ou des couleurs d'Aubrune, 7.1).
3. Lance `construire.sh`.
4. Dans la fiche du jeu `donnees/commun/objets/<id>.json`, mets `"model": "<id du gabarit>"`. Sans ce champ, le sac et la boutique montrent une vignette générique marquée « provisoire » (test `tests/rendu/objets.test.ts`).
5. Regarde-le: `duo-python assets-src/objets/planche_objets.py assets/commun/objets <sortie.png>` (`--echelle` pour la taille réelle à côté d'un mannequin de 1,80 m), ou la page de la visionneuse (`src/rendu/objets/demo/`).

Preuve du 2026-11-10: les 27 objets apportés par les lots pêche et cuisine en cours de mission ont été couverts par 15 entrées de gabarit et une famille `provision` (4 formes).

## Fichiers

| Fichier | Rôle |
|---|---|
| `gabarits.toml` | familles (bornes de taille, couleurs par défaut), triangles permis, couleurs d'Aubrune, objets |
| `formes.py` | bibliothèque de formes en Python pur: révolution, superquadrique, tube balayé, feuille, spirale |
| `familles.py` | un constructeur par famille, paramétré par `forme` et `couleurs` |
| `construire_objets.py` | Blender: mise à l échelle, origine au centre du dessous, normales lisses (arêtes vives au-delà de 70 degrés), UV, atlas de la famille, export |
| `verifier_objets.py` | contrôle sans Blender: nœud, prise, matériau `objet`, attributs, 200 à 800 triangles, taille à 12 % et dans les bornes de la famille, origine, couleurs du nuancier |
| `planche_objets.py` | planche Cycles de tous les objets depuis les GLB livrés |
| `meshy/` | essai Meshy du 2026-11-10 et sa fiche |
| `planches/` | planche des objets et capture de la page de la visionneuse |

## Conventions

- 1 unité = 1 m, Y en haut, avant vers +Z glTF (-Y dans Blender), transformations appliquées.
- Un matériau `objet-<famille>` par GLB (rugosité 0,75) et un atlas par famille (256 px par objet, UV par projection intelligente). Texture provisoire: les couleurs unies des pièces peintes dans les îlots UV; une texture peinte (ou celle de Meshy, `meshy/conformer_essai.py`) la remplacera objet par objet.
- Outils debout, tête en haut, prise au tiers bas du manche; poissons sur le ventre, tête vers l'avant; objets plats (pièce, lettre, planche) couchés.
- Index `size` et `grip` en coordonnées glTF (x, y, z).

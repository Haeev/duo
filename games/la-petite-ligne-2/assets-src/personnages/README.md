# Personnages: sources du catalogue (lot L5)

Tout le catalogue sort d'un fichier de données, `gabarits.toml`, par un script unique (4 s):

```text
bash games/la-petite-ligne-2/assets-src/personnages/construire.sh
```

Sorties: `assets/commun/personnages/<emplacement>.glb` (un nœud par pièce, squelette commun `duo-24`, clips dans `body.glb`), `donnees/commun/personnages/catalogue.json` (contrat de `src/donnees/schemas/personnage.ts`) et `morphologies.json` (ce que le contrat ne porte pas encore).

## Ajouter une pièce, une coiffure ou une corpulence (aucun code)

1. Ouvre `gabarits.toml` et repère une entrée du même genre (`[[pieces]]` de même `base`, ou `[corpulences.*]`, `[[morphologies]]`).
2. Copie-la juste en dessous et change `id` (emplacement en tête: `top-`, `bottom-`, `dress-`, `shoes-`, `hair-`, `head-`, `hat-`, `accessory-`).
3. Règle la forme (champs commentés dans `gabarits.toml` au-dessus de chaque base): `torse`, `veste` (gilet, cardigan, veste: V, emmanchures, boutons, poches, revers), `jambes` (`revers` au bas), `salopette`, `jupe` et `robe` (`suivi` dès que l'ourlet passe sous le genou), `galet`, `sabot`, `casquette`, `chapeau`, `echarpe`, `foulard`, `tablier`, `coiffure`, `tete`.
4. Choisis les couleurs: `zones` (famille du nuancier, couleur par défaut, liste `couleurs` pour restreindre), un `nom` et une `description` d'une ligne.
5. Ajoute des `tags` (lieu, saison, caractère) pour le tirage des habitants; `a-gagner` pour une pièce de récompense ou de boutique (cachée de l'éditeur jusqu'à l'effet `give_piece`), plus `mercerie` et `prix` (centimes) pour une pièce vendue.
6. Lance `construire.sh`: il fabrique les GLB, le catalogue, et contrôle tout (`VERIFICATION ... 0 erreur(s)`); puis `pnpm exec prettier --write` sur `catalogue.json` et `morphologies.json`.
7. Regarde la pièce dans le rendu encré du jeu: ajoute-la à `PIECES` de `planche-encre/planche_tenues.py`, puis `bash planche-encre/planche.sh planche <sortie.png> <id>` (face et dos, deux silhouettes) et `bash planche-encre/planche.sh controle <sortie.png> <id>` (marche, course, assis, couché); `ECHELLE=2.5` pour des vues plus grandes.
8. Pièce de Meshy (chapeau, sac): pose son GLB dans `meshy/` avec sa fiche, puis copie l'entrée `hat-beanie-pompom` (`base = "meshy-rigide"`: `os`, `largeur`, `bas`).
9. Les sections du corps masquées (`covers`) se déduisent des longueurs; les corpulences et silhouettes s'appliquent d'office à la nouvelle pièce.
10. Preuve du 2026-11-10: le gilet `accessory-vest` a été ajouté par sa seule entrée (12 lignes), 2 s de script.

## Garde-robe d'Aubrune (2026-11-11)

Douze pièces à gagner (étiquette `a-gagner`), toutes faites par le script, aucun crédit Meshy:

| Id | Nom | Source |
|---|---|---|
| `top-cardigan` | Gilet de laine | mercerie, 28 € |
| `bottom-corduroy` | Pantalon de velours | mercerie, 24 € |
| `bottom-long-skirt` | Jupe longue | mercerie, 22 € |
| `shoes-clogs` | Sabots | mercerie, 16 € |
| `accessory-scarf` | Écharpe | mercerie, 12 € |
| `hat-cap` | Casquette | mercerie, 9 € |
| `top-work-jacket` | Veste de travail | récompense |
| `bottom-overalls` | Salopette | récompense |
| `dress-sunday` | Robe du dimanche | récompense (fête) |
| `hat-straw` | Chapeau de paille | récompense (fête) |
| `accessory-neckerchief` | Foulard | récompense |
| `accessory-apron` | Tablier | récompense |

Brique qui manque pour la vente: un commerce ne vend que des objets (`sells[].item`). Il faudrait une ligne de vente de pièce (`{ "piece": "<id>", "price": 2800 }` dans `sells`, ou un objet de famille `clothing` avec un champ `piece`, comme `bag`) dont l'achat appelle `givePiece` (`src/simulation/regles/recompenses.ts`). D'ici là, les six pièces `mercerie` restent à gagner; leur `prix` est dans `gabarits.toml` (non exporté). Les pièces à gagner peuvent être portées par les habitants (tirage de `composeLook`), jamais par le look de départ d'un joueur.

Le gilet `accessory-vest` a été refait le 2026-11-11 (même id, trois zones au lieu d'une: les apparences qui le portent restent valides, les zones nouvelles prennent leur couleur par défaut).

## Fichiers

| Fichier | Rôle |
|---|---|
| `gabarits.toml` | corpulences, silhouettes, morphologies, pièces: la seule chose à modifier pour ajouter du contenu |
| `construire_catalogue.py` | lit les gabarits, fabrique corps, vêtements, têtes, coiffures, clips du studio (`idle`, `sit`, `carry`), exporte |
| `figurine.py` | volumes balayés, bords épais, zones de couleur, sections, cibles de morphose |
| `verifier_catalogue.py` | contrôle rapide (nœuds, attributs, un matériau, triangles, identifiants), sans Blender |
| `nuancier.json` | copie de `docs/jeux/jeu-1/refonte/planches/source/nuancier.json` (à recopier si la bible change) |
| `source/squelette-meshy.glb` | squelette de 24 os et clips `walk` et `run` du rig de Meshy (tâche `01a1c4e7-6e4d-754d-884c-8c8d594ec9ad`), par `extraire_squelette.py` |
| `meshy/` | pièces rigides générées par Meshy et leurs fiches |
| `planche-encre/` | planche des tenues dans l'aperçu encré du jeu (`planche.sh`, page servie par Vite, `planche_tenues.py` pour la liste des vues et le montage) |

## Conventions lues par l'assemblage (L6)

- Un matériau `figurine`, couleurs de sommets. `TEXCOORD_0.x = (zone + 0,5) / 8`: zones 0 à 2 teintables (ordre de `zones` au catalogue), 6 couleur fixe (garder `COLOR_0`), 7 peau. `TEXCOORD_0.y = (section + 0,5) / 16`, sections dans l'ordre de `regions` (`morphologies.json`); seules les sections de `body-base` se retirent.
- Corpulence et silhouette: cibles de morphose `slim`, `round`, `f`, `m` sur le corps et les vêtements, à cuire dans les positions à la fusion (`shapes.<id>.morphs`).
- Âge: `scale` sur la racine, `head` sur l'os `Head`, `legs`, `arms`, `torso` en facteur des translations de repos des os (les segments coulissent l'un dans l'autre, aucune échelle non uniforme); des clips on ne rejoue que les rotations et la translation de `Hips`, multipliée par `(0,10 + 0,80 x legs) / 0,90`.
- Tête: nœud à part, cibles `joy`, `surprise`, `thinking`, `embarrassed`, `sad`, `angry`, `sleepy`, `blink`, `talk` (une à la fois; neutre = toutes à 0). Elle reste un second maillage: 2 appels de dessin par personnage.
- Sous une coiffe dont `hair` vaut `flat`, prendre le nœud `<coiffure>--flat` du même fichier.
- Exemple d'assemblage complet: `docs/production/essais-meshy/personnage-modulaire/banc/essai3.html` (fonction `createCharacter`).

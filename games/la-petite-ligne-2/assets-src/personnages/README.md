# Personnages: sources du catalogue (lot L5)

Tout le catalogue sort d'un fichier de données, `gabarits.toml`, par un script unique (4 s):

```text
bash games/la-petite-ligne-2/assets-src/personnages/construire.sh
```

Sorties: `assets/commun/personnages/<emplacement>.glb` (un nœud par pièce, squelette commun `duo-24`, clips dans `body.glb`), `donnees/commun/personnages/catalogue.json` (contrat de `src/donnees/schemas/personnage.ts`) et `morphologies.json` (ce que le contrat ne porte pas encore).

## Ajouter une pièce, une coiffure ou une corpulence (aucun code)

1. Ouvre `gabarits.toml` et repère une entrée du même genre (`[[pieces]]` de même `base`, ou `[corpulences.*]`, `[[morphologies]]`).
2. Copie-la juste en dessous et change `id` (emplacement en tête: `top-`, `bottom-`, `dress-`, `shoes-`, `hair-`, `head-`, `hat-`, `accessory-`).
3. Règle la forme: `couche`, `ourlet`, `manches`, `ouverture`, `col` (base `torse`); `longueur` (`jambes`); `bas`, `evasement` (`jupe`, `robe`); `tige` (`galet`); `front`, `nuque`, `meches` (`coiffure`); `machoire`, `menton`, `nez` (`tete`).
4. Choisis les couleurs: `zones` (famille du nuancier, couleur par défaut, liste `couleurs` pour restreindre).
5. Ajoute des `tags` (lieu, saison, caractère) pour le tirage des habitants.
6. Lance `construire.sh`: il fabrique les GLB, le catalogue, et contrôle tout (`VERIFICATION ... 0 erreur(s)`).
7. Regarde la pièce: `node docs/production/essais-meshy/personnage-modulaire/banc/capturer3.mjs games/la-petite-ligne/node_modules/three <sortie.png> 1400 560 "planche=piece&id=<id>"` après avoir ajouté deux tenues d'essai sous `pieces` dans `banc/essai3-looks.json`.
8. Pièce de Meshy (chapeau, sac): pose son GLB dans `meshy/` avec sa fiche, puis copie l'entrée `hat-beanie-pompom` (`base = "meshy-rigide"`: `os`, `largeur`, `bas`).
9. Les sections du corps masquées (`covers`) se déduisent des longueurs; les corpulences et silhouettes s'appliquent d'office à la nouvelle pièce.
10. Preuve du 2026-11-10: le gilet `accessory-vest` a été ajouté par sa seule entrée (12 lignes), 2 s de script.

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

## Conventions lues par l'assemblage (L6)

- Un matériau `figurine`, couleurs de sommets. `TEXCOORD_0.x = (zone + 0,5) / 8`: zones 0 à 2 teintables (ordre de `zones` au catalogue), 6 couleur fixe (garder `COLOR_0`), 7 peau. `TEXCOORD_0.y = (section + 0,5) / 16`, sections dans l'ordre de `regions` (`morphologies.json`); seules les sections de `body-base` se retirent.
- Corpulence et silhouette: cibles de morphose `slim`, `round`, `f`, `m` sur le corps et les vêtements, à cuire dans les positions à la fusion (`shapes.<id>.morphs`).
- Âge: `scale` sur la racine, `head` sur l'os `Head`, `legs`, `arms`, `torso` en facteur des translations de repos des os (les segments coulissent l'un dans l'autre, aucune échelle non uniforme); des clips on ne rejoue que les rotations et la translation de `Hips`, multipliée par `(0,10 + 0,80 x legs) / 0,90`.
- Tête: nœud à part, cibles `joy`, `surprise`, `thinking`, `embarrassed`, `sad`, `angry`, `sleepy`, `blink`, `talk` (une à la fois; neutre = toutes à 0). Elle reste un second maillage: 2 appels de dessin par personnage.
- Sous une coiffe dont `hair` vaut `flat`, prendre le nœud `<coiffure>--flat` du même fichier.
- Exemple d'assemblage complet: `docs/production/essais-meshy/personnage-modulaire/banc/essai3.html` (fonction `createCharacter`).

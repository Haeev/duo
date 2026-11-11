# Personnages: sources du catalogue (lot L5)

Tout le catalogue sort d'un fichier de données, `gabarits.toml`, par un script unique (4 s):

```text
bash games/la-petite-ligne-2/assets-src/personnages/construire.sh
```

Sorties: `assets/commun/personnages/<emplacement>.glb` (un nœud par pièce, squelette commun `duo-24`, clips dans `body.glb`), `donnees/commun/personnages/catalogue.json` (contrat de `src/donnees/schemas/personnage.ts`) et `morphologies.json` (ce que le contrat ne porte pas encore).

## Ajouter une pièce, une coiffure ou une corpulence (aucun code)

1. Ouvre `gabarits.toml` et repère une entrée du même genre (`[[pieces]]` de même `base`, ou `[corpulences.*]`, `[[morphologies]]`).
2. Copie-la juste en dessous et change `id` (emplacement en tête: `top-`, `bottom-`, `dress-`, `shoes-`, `hair-`, `head-`, `hat-`, `accessory-`).
3. Règle la forme (champs commentés dans `gabarits.toml` au-dessus de chaque base): `torse`, `debardeur`, `veste` (gilet, cardigan, veste: V, emmanchures, boutons, poches, col et revers, couture et martingale du dos), `jambes` (`droite`, `revers` au bas), `salopette`, `jupe` et `robe` (`portee` et `profondeur` dès que l'ourlet passe sous le genou), `galet`, `sabot`, `casquette`, `chapeau`, `echarpe`, `foulard`, `tablier`, `coiffure`, `tete`. Choisis sa `couche` dans la table des couches en tête des pièces.
4. Choisis les couleurs: `zones` (famille du nuancier, couleur par défaut, liste `couleurs` pour restreindre), un `nom` et une `description` d'une ligne.
5. Ajoute des `tags` (lieu, saison, caractère) pour le tirage des habitants; `a-gagner` pour une pièce de récompense ou de boutique (cachée de l'éditeur jusqu'à l'effet `give_piece`), plus `mercerie` et `prix` (centimes) pour une pièce vendue.
6. Lance `construire.sh`: il fabrique les GLB, le catalogue, et contrôle tout (`VERIFICATION ... 0 erreur(s)`); puis `pnpm exec prettier --write` sur `catalogue.json` et `morphologies.json`.
7. Regarde la pièce dans le rendu encré du jeu: ajoute-la à `PIECES` de `planche-encre/planche_tenues.py`, puis `ECHELLE=2 bash planche-encre/planche.sh essai <dossier> <id>` (debout, quatre angles, trois silhouettes, en grand) et `ECHELLE=2 VUES_DIR=<dossier des vues> bash planche-encre/planche.sh etude <dossier> <id>` (debout, marche, course, assis, couché, cinq angles, trois silhouettes: l'examen à passer avant de rendre une pièce; les vues en grand restent dans `VUES_DIR`). Si elle se porte avec une autre, ajoute le couple à `MARIAGES` et lance le mode `mariages`. Si elle couvre les jambes, sonde-la: `LPL_SONDE="<id>:body-base/thigh-b+shin,shoes-pebble" bash construire.sh` (voir `sonde.py`).
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

Vente: une ligne `pieces` du commerce (`{ "piece": "<id>", "price": 2800 }`, schéma `src/donnees/schemas/commerce.ts`) met en vente une pièce `a-gagner`; l'achat l'ajoute à la garde-robe de l'acheteur seul. Le `prix` de référence des pièces `mercerie` est dans `gabarits.toml` (non exporté). Les pièces à gagner peuvent être portées par les habitants (tirage de `composeLook`), jamais par le look de départ d'un joueur.

Le gilet `accessory-vest` a été refait le 2026-11-11 (même id, trois zones au lieu d'une: les apparences qui le portent restent valides, les zones nouvelles prennent leur couleur par défaut).

## Reprise du 2026-11-11: ce qui fait une pièce juste

Toutes les pièces de la garde-robe, le gilet et le débardeur ont été reprises (mêmes ids, mêmes zones). Les règles qui en sortent valent pour toute pièce nouvelle:

- **Aplat sans bosse**: le rendu encré n'a que deux tons; une nappe à facettes se tache près de la limite d'ombre. Les coques (`Body.coque`, `anneaux`, `plaque`, `trait`) portent la normale du buste lissé (`Body.normale`), bords compris: l'ombre coupe le vêtement d'une ligne nette et aucun bout de trait ne naît le long d'un bord.
- **Les détails se lisent par la teinte, pas par le relief**: le trait du rendu ne cerne que les silhouettes et les arêtes de plus de 70 degrés; une poche en relief de 6 mm donnait un pointillé. Coutures, bords de poche, bord de col et de revers, côtes: des traits d'encre en géométrie (teinte fixe `encre_trait` du nuancier, `Body.trait` et le liseré de `Body.plaque`), larges de 7 à 8 mm.
- **Les couches** (table en tête des pièces de `gabarits.toml`): près du corps, puis gilet et bavette, puis veste, puis tablier, 4 mm d'écart au moins; une coque posée sur un tour à seize pans a des arcs fins (ou ses colonnes sur les pans).
- **Une largeur d'étoffe se compte sur l'étoffe** (`Body.meridien`): un col défini en hauteur s'étalait sur tout le plat de l'épaule.
- **Jupe sous le genou** (`portee = true`): chaque moitié suit la cuisse puis le tibia de son côté, colonnes serrées au milieu, envers jusqu'à mi-cuisse (`doublure`), et peu de profondeur d'avant en arrière. Assise, elle se pose sur les cuisses et retombe des genoux; en marche rien ne sort. Limite connue: en course (genou plié à 113 degrés dans le clip), la jambe d'appui se découvre par une échancrure au milieu du devant et la jambe levée sort par l'ourlet soulevé; sans simulation d'étoffe, c'est le moins mauvais partage (voir `w_porte`).
- **Jambes amples** (`droite = true`): le côté de la jambe prolonge la hanche; sans cela le bassin déborde en boule au-dessus de deux jambes étroites (c'était la « couche » de la salopette).
- **Soudure par distance** (`Builder.weld`): les vecteurs sont en simple précision; l'arrondi à 7 chiffres donnait des topologies différentes d'une corpulence à l'autre. En cas de refus (« n'a pas la topologie de la base »), le script nomme les sommets en cause.
- **Coiffes au lit**: le moteur ne retire aucune pièce en posture couchée (les pièces sont fusionnées à l'assemblage). Mesure avec `python3 assets-src/personnages/verifier_couche.py assets/commun/personnages/hat.glb`: le bord du chapeau de paille passe 17 cm sous le couchage, le pompon du bonnet dépasse la tête de lit. Brique à écrire côté moteur: assembler le dormeur sans son emplacement `hat` en posture `lie`.

## Fichiers

| Fichier | Rôle |
|---|---|
| `gabarits.toml` | corpulences, silhouettes, morphologies, pièces: la seule chose à modifier pour ajouter du contenu |
| `construire_catalogue.py` | lit les gabarits, fabrique corps, vêtements, têtes, coiffures, clips du studio (`idle`, `sit`, `carry`), exporte |
| `figurine.py` | volumes balayés, bords épais, zones de couleur, sections, cibles de morphose |
| `verifier_catalogue.py` | contrôle rapide (nœuds, attributs, un matériau, triangles, identifiants), sans Blender |
| `sonde.py` | sonde des traversées: triangles d'une pièce qui coupent le corps ou une autre pièce, clip par clip (`LPL_SONDE`) |
| `verifier_couche.py` | coiffes en posture couchée: dépassement sous le couchage et au-dessus de la tête |
| `nuancier.json` | copie de `docs/jeux/jeu-1/refonte/planches/source/nuancier.json` (à recopier si la bible change) |
| `source/squelette-meshy.glb` | squelette de 24 os et clips `walk` et `run` du rig de Meshy (tâche `01a1c4e7-6e4d-754d-884c-8c8d594ec9ad`), par `extraire_squelette.py` |
| `meshy/` | pièces rigides générées par Meshy et leurs fiches |
| `planche-encre/` | planches des tenues dans l'aperçu encré du jeu (`planche.sh`: modes `planche`, `essai`, `etude`, `mariages`, `controle`, `avant`; page servie par un Vite sans rechargement, `planche_tenues.py` pour la liste des vues et le montage, `avant/` pour les vues d'avant reprise que la planche relit) |

## Conventions lues par l'assemblage (L6)

- Un matériau `figurine`, couleurs de sommets. `TEXCOORD_0.x = (zone + 0,5) / 8`: zones 0 à 2 teintables (ordre de `zones` au catalogue), 6 couleur fixe (garder `COLOR_0`), 7 peau. `TEXCOORD_0.y = (section + 0,5) / 16`, sections dans l'ordre de `regions` (`morphologies.json`); seules les sections de `body-base` se retirent.
- Corpulence et silhouette: cibles de morphose `slim`, `round`, `f`, `m` sur le corps et les vêtements, à cuire dans les positions à la fusion (`shapes.<id>.morphs`).
- Âge: `scale` sur la racine, `head` sur l'os `Head`, `legs`, `arms`, `torso` en facteur des translations de repos des os (les segments coulissent l'un dans l'autre, aucune échelle non uniforme); des clips on ne rejoue que les rotations et la translation de `Hips`, multipliée par `(0,10 + 0,80 x legs) / 0,90`.
- Tête: nœud à part, cibles `joy`, `surprise`, `thinking`, `embarrassed`, `sad`, `angry`, `sleepy`, `blink`, `talk` (une à la fois; neutre = toutes à 0). Elle reste un second maillage: 2 appels de dessin par personnage.
- Sous une coiffe dont `hair` vaut `flat`, prendre le nœud `<coiffure>--flat` du même fichier.
- Exemple d'assemblage complet: `docs/production/essais-meshy/personnage-modulaire/banc/essai3.html` (fonction `createCharacter`).

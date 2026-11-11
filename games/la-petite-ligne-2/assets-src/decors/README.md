# Décors: sources des modèles du lieu

Tout ce que le jeu dessine dehors et dans les pièces sort de deux chaînes encrées:

| Chaîne                 | Ce qu'elle fait                                                                                                                      | Sorties                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `recoltables-aubrune/` | arbres, buissons, récoltes, potager, haies, meubles, mobilier, objets d'intérieur, luminaires, fêtes, ouvrages, trains vus du dehors | `assets/commun/decors/aubrune-*.glb` et le manifeste `decors.json` |
| `batiments-aubrune/`   | les bâtiments du bourg et le jeu de pièces de façade                                                                                 | `assets/lieux/aubrune/batiments/`                                  |

Chacune a son README (recette d'ajout sans code, contrôle, planche sur le rendu du jeu).

## L'ancienne chaîne arrondie (retirée le 2026-11-11)

Elle produisait `furniture.glb`, `houses.glb`, `street.glb` et `train.glb` (modèles arrondis d'avant le style encré, couleurs par zone). Le tri du 2026-11-11 (remarques du client: « très moche », « à refaire »):

- **Refaits dans la chaîne encrée** (`recoltables-aubrune/mobilier.py`, mêmes identifiants, fiches inchangées), parce qu'une fiche de meuble ou le rendu les dessine encore: `bed-double`, `bed-single`, `chair-farm`, `table-farm`, `wardrobe`, `chest`, `bench-platform`, `tub`, `fence` (barrière de la voie, `decor.fenceModel`), `platform-sign`, `water-pump`, et la voiture du train de nuit (`train-wall`, `train-wall-window`, `train-wall-map`, `train-wall-corner`, `train-door`, `train-wall-lamp`, `train-luggage-rack`, `train-luggage-rack-empty`, `train-table`, `train-seat`, `train-berth`).
- **Retirés** (aucune fiche, aucune carte, aucun code ne les dessinait; le plan du level designer les cite seulement comme repère d'ancien gabarit): `house-town`, `shed`, `shop-front`, `stool`, `bench-farm`, `bench-park`, `chair-bedroom`, `chair-farm-sage`, `lamp-floor`, `rug-oval`, `shelf`, `sink-stone`, `stove`, `table-round`, `barrel`, `crate`, `log-pile`, `mailbox`, `signpost`, `street-lamp`, `well`.

Restent ici pour mémoire: `meshy/` (fiche de l'essai Meshy du 2026-11-10) et `planches/` (planches de l'ancienne chaîne).

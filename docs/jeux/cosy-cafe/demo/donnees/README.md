# Deux Tabliers, démo v0.1: format des données

Données de la démo (Ormeval, jours 1 à 15), prêtes à charger. Le schéma de l'architecte (`games/deux-tabliers/donnees/SCHEMA.md`) n'était pas publié au moment de l'écriture: ce format est provisoire, les devs l'adaptent au schéma définitif. Conception: `docs/jeux/cosy-cafe/demo/demo-v0-1.md`.

## Conventions

- Identifiants en anglais `snake_case` pour le code, sauf les identifiants de contenu déjà fixés par le cahier (recettes, profils, postes: `espresso`, `presses`, `vapeur`), gardés tels quels pour rester valables pour toujours (SV-06).
- Clés en `camelCase`; textes en français, tutoiement, écriture neutre, sans tiret cadratin ni demi-cadratin.
- Chaque fichier porte `format` et `version` (`demo-0.1`). Un lecteur ignore les clés qu'il ne connaît pas (`note`, `sim`, `text`).
- Unités: euros, secondes réelles (gestes, limites d'événements), minutes et heures de jeu (horaires, séjours), mètres (`size`: `w` largeur, `d` profondeur, `h` hauteur).
- Les blocs `sim` des événements sont lus par la simulation seulement; le jeu lit `trigger`, `goal`, `outcomes`, `rewards`.

## Fichiers

| Fichier | Contenu | Source |
|---|---|---|
| `recettes.json` | les 17 recettes de la démo: prix conseillé, coût des matières (somme exacte des ingrédients), ingrédients, gestes par poste (à la main, machine, machine avancée), déblocage | généré par `demo/simulations/demo_v0_1.py --donnees` |
| `ingredients-fournisseurs.json` | 21 ingrédients (coût unitaire, rangement, conservation, cartons lourds), 5 fournisseurs, règles de commande et de dépannage | généré |
| `profils.json` | les 10 profils (copie de la table du cahier) et le flux d'Ormeval | généré depuis `simulations/cosy_cafe.py` |
| `catalogue.json` | 61 meubles et objets achetables ou de brocante, 12 pièces uniques, mobilier de départ, règles de pose | généré |
| `postes-equipements.json` | postes à l'arrivée, 14 achats d'équipement, 2 extensions, paliers de déblocage | généré |
| `reglages-economie.json` | caisse, loyer, charges, réserve, réputation, offre, fête, ambiance, brocante | généré |
| `evenements.json` | 11 événements (déclencheur, scène, objectif, réussites, récompenses) | écrit à la main |
| `habitues.json` | niveaux de lien, 6 habitués de la démo, répliques et étapes d'histoire | écrit à la main |
| `journees.json` | horaires, coups de feu, déroulé des 15 jours, « Nos projets » de la démo | écrit à la main |
| `textes.json` | textes de l'interface, dialogues du prologue et de la lettre, livre d'or | écrit à la main |

Ne retouchez pas à la main les fichiers générés: modifiez `demo_v0_1.py`, puis relancez `--donnees` et `--simuler`. La simulation relit les JSON (pas ses constantes) et vérifie que chaque coût de recette égale la somme de ses ingrédients et que chaque objet cité par un événement existe (code de sortie 1 sinon).

## Vocabulaire

- `unlock` des recettes: `start`, `purchase` (`item`), `regular` (`regular`, `level` de lien).
- `unlock` du catalogue: `{"tier": "t0".."t3"}` (paliers de `postes-equipements.json`: réputation `cups` atteinte, ou jour `orDay` atteint, la première des deux), `{"source": "brocante"}` (tirage du lundi), ou, pour une pièce unique, `{"source": "regular" | "event", "ref": ...}`.
- `effect` des équipements: `poste:<poste>:<niveau>`, `equip:<équipement recherché>`, `recette:<id>`, `vaisselle:<pièces>`, `ext:<extension>`; plusieurs effets séparés par `;`.
- `placement`: clé de `catalogue.placements` (sol, mur, plafond, comptoir, terrasse...). `heavy`: se porte à deux (ou glisse seul de 1 m au plus). `rotationStep`: 90 ou 15 degrés, 0 pour un objet mural.
- `seats`: places apportées par une assise (`table`, `comfort`, `counter`). Une assise compte comme place quand elle est à 0,6 m au plus d'une table (ou d'une table basse pour un fauteuil), avec un passage de 0,9 m (C13).
- `charm`: points de charme (AM-01, AM-02); revêtements: au mur (`priceUnit: wall`) ou au m² (`m2`); mobilier de Simone `worn`: charme compté à moitié jusqu'à la rénovation (`renovationPrice`).
- `style`: un des six styles de la roue, ou `neutre` (ne compte pas dans la cohérence).

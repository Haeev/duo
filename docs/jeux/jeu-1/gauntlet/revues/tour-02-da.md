# Gauntlet, tour 2: revue adverse du directeur artistique (épreuve G6, piliers 2 et 3)

| Champ | Valeur |
|---|---|
| Relecteur | directeur-artistique (n'a rien produit de ce tour) |
| Date | 2026-10-31, de 10 h 25 à 10 h 40 UTC |
| Arbre relu | `/home/user/duo`, branche `claude/stoic-lamport-lueey2`, commit `4029680` |
| Référence | ma revue du tour 1 (`tour-01-da.md`): pilier 2 à 5/10, pilier 3 à 6/10 |
| Verdict G6 | **pilier 2: mieux qu'avant (oui)**; **pilier 3: ni mieux ni moins bien, aucune régression** |
| Notes | **pilier 2: 6/10** (5 avant); **pilier 3: 6/10** (inchangé) |

## Méthode

- Serveur Vite à moi sur le port 5301, redémarré pour servir l'arbre actuel (le précédent gardait en mémoire des modules du tour 1). Rendu normal, fenêtre de 1366 x 768, Playwright avec `timeout` sur chaque capture.
- Mêmes adresses et mêmes cadrages qu'au tour 1: place à 8 h 15 (trois images à 0,7 s), potager à 10 h 30 (cinq images à 0,5 s), place à 18 h 30 et à 22 h 30, quai à 10 h, gué à 14 h, intérieur à 19 h 45, pluie à 11 h.
- Comparaison avant et après pixel à pixel (`compare -metric AE -fuzz 4%`), niveaux de gris (moyenne et écart type sur 0 à 255), écart entre images successives amplifié pour voir ce qui bouge.
- Planches du technical artist relues (`ta-01` à `ta-05`). Sections « gauntlet tour 2 » de `ETAT.md` lues.

## Ce qui a changé, preuves

| Mesure | Tour 1 | Tour 2 |
|---|---|---|
| Place, 8 h 15 (moyenne, écart) | 109, 25 | 109, 25 |
| Place, 18 h 30 | 80, 19 | 80, 19 |
| Place, 22 h 30 | 53, 37 | 53, 37 |
| Intérieur, 19 h 45 | 45, 17 | 45, 17 |
| Quai, 10 h | 118, 31 | 118, 30 |
| Budgets (appels, triangles, programmes) | 44 à 112, 128 000 à 207 000, 10 à 11 | 45 à 103, 128 000 à 207 000, 10 à 11 |

- **Vent: réussi.** Sur la place à 8 h 15, vie figée, l'écart amplifié entre deux images à 1,4 s fait ressortir les buissons, les arbustes, le bord du store et le lierre de la tonnelle. Les maisons, les bancs, les lampadaires et le sol restent immobiles (`da-01-vent-ecart-matin.png`; les grandes taches diffuses sont les ombres de nuages et la brume du matin, déjà là au tour 1). Le mouvement reste discret, sans tremblement des ombres, et va bien avec le style en facettes. Les chênes de `ta-05` se balancent par le haut, le pied reste fixe: c'est juste.
- **Fumées de cheminée: présentes, trop timides.** Visibles sur l'épicerie à 19 h 45 (`da-04`, en bas à droite) et sur les planches `ta-03` et `ta-04`. À 1366 x 768 en plan large, on les remarque à peine. Comme la vapeur du train, ce sont des disques flous, seul élément « doux » dans un monde en facettes.
- **Gestes et marche: mieux.** Le cycle de marche reste propre sur cinq images (`da-02-potager-marche.png`). D'après `ETAT.md`, les gestes d'outil partent sur l'appui et la marche sur place a disparu. Le calage à 80 ms ne se juge pas à 10 images par seconde en rendu logiciel: c'est à tester chez le client.
- **Aucune régression visuelle.** Avant et après se superposent: les écarts mesurés (4 000 à 25 000 pixels sur 1 049 000) viennent tous du vent, de l'eau, des nuages, du bouchon et des fumées. Lumière, palette, valeurs et cadrage n'ont pas changé (`da-03-avant-apres-soir-nuit.png`, `da-04-avant-apres-gue-interieur.png`). Budgets inchangés.

## Pilier 2: vie du monde et animation, 6/10 (5 avant)

Le défaut n° 1 du tour 1 (aucun vent, aucune fumée) est corrigé pour l'essentiel: le décor n'est plus une maquette figée. Les gestes calés sur l'appui renforcent la sensation de vie. Je n'accorde pas encore les +1 prévus en entier: les fumées se voient trop peu, et les quatre autres défauts restent ouverts. Il manque toujours la petite faune, des attentes variées, des habitants qui réagissent aux joueurs, et les gestes empruntés (cuisiner joue toujours « scier »). On passe de « nu » à « vivant par endroits ».

## Pilier 3: direction artistique, 6/10 (inchangé)

Ce tour ne visait pas la direction artistique, et ses cinq défauts restent tels quels, aux mêmes mesures: sol en damier et en escalier (`da-03`, place), rivière en canal avec un gué en dallage (`da-04`, en haut), soir terne (écart 19), intérieur sombre (moyenne 45, écart 17), marquise nue. Le vent s'intègre au style sans le casser: pas de baisse.

## Priorités pour le tour suivant

1. **Le sol** (pilier 3, défaut 1 du tour 1): pavés de la place en vrai appareillage avec un écart de gris réduit, teinte continue de l'herbe, coins coupés aux chemins et aux berges. tech-artist, dev rendu, artiste-3d, environ 300 min, +1 à +1,5. C'est le défaut le plus visible du jeu, dans tous les plans.
2. **La petite faune** (pilier 2, défaut 2): moineaux qui s'envolent quand un joueur approche, papillons de jour, lucioles la nuit au bord de l'eau. artiste-3d, tech-artist, dev rendu, environ 240 min, +1.
3. **Le soir et l'intérieur** (pilier 3, défaut 3), plus les fumées: hémisphérique refroidie le soir (cible écart d'au moins 25 à 18 h 30), lumière de foyer dans la maisonnette (cible moyenne d'au moins 70), et des fumées 1,5 fois plus opaques, en bouffées à facettes plutôt qu'en disques flous. tech-artist, environ 120 min, +0,5 sur chaque pilier.

## À tester chez le client

- Le vent sur l'UHD 620: aucun scintillement, aucun coût ressenti.
- Le calage des gestes sur l'appui (moins de 80 ms) et l'absence de glissement des pieds, à la vraie cadence.

## Captures

Dans `docs/jeux/jeu-1/gauntlet/captures/tour-02/`:

- `da-01-vent-ecart-matin.png`: la place à 8 h 15 et, à droite, l'écart amplifié entre deux images (ce qui bouge en rouge).
- `da-02-potager-marche.png`: cinq images successives du potager (0,5 s).
- `da-03-avant-apres-soir-nuit.png`: la place à 18 h 30 et 22 h 30, tour 1 à gauche, tour 2 à droite.
- `da-04-avant-apres-gue-interieur.png`: le gué à 14 h et l'intérieur à 19 h 45, tour 1 à gauche, tour 2 à droite (fumée de l'épicerie en bas à droite).

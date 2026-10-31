# Gauntlet, tour 4: revue adverse du directeur artistique (épreuve G6, piliers 2 et 3)

| Champ | Valeur |
|---|---|
| Relecteur | directeur-artistique (n'a rien produit de ce tour) |
| Date | 2026-10-31, de 12 h 12 à 12 h 20 UTC |
| Référence | `tour-03-da.md`: pilier 2 à 6/10, pilier 3 à 6,5/10 |
| Verdict G6 | **pilier 2: mieux qu'avant (oui)**; **pilier 3: mieux qu'avant (oui)**; une régression mineure (bêche brandie pendant l'attente), aucune régression de rendu |
| Notes | **pilier 2: 7/10** (6 avant); **pilier 3: 7/10** (6,5 avant) |

## Méthode

- Serveur Vite redémarré sur le port 5301, rendu normal, 1366 x 768, `timeout` sur chaque capture. Mêmes cadrages qu'aux tours précédents: place à 8 h 15, 18 h 30 et 22 h 30, quai à 10 h, potager à 10 h 30 (cinq images), intérieur réparé à 19 h 45, pluie à 11 h, plus la vraie simulation avec l'interface (`scenario=jour`, quatre images).
- Planches du dev rendu relues dans `/tmp/lpl-rendu-YHE6/vie/` (`planche-poses`, `planche-rencontre`, `planche-repas`) et captures du technical artist `captures/tour-04/ta-01` à `ta-03`.
- Niveaux de gris: image entière et zone centrale de la place (rectangle de 500 x 300 au même endroit à chaque tour).

## Mesures

| Plan | Tour 3 (moyenne, écart; écart de la zone de la place) | Tour 4 |
|---|---|---|
| Place, 8 h 15 | 109, 25; 19,5 | 110, 24; **16,9** |
| Place, 18 h 30 | 82, 22; 16,2 | 82, 22; 13,3 |
| Place, 22 h 30 | 53, 37; 24,4 | 54, 37; 23,8 |
| Quai, 10 h | 118, 31 | 122, 31 |
| Pluie, 11 h | 87, 20 | 86, 19 |

Budgets inchangés: 67 à 113 appels, au plus 207 000 triangles, 10 à 11 programmes. Aucune erreur de console.

L'écart de la zone de la place baisse parce que le damier a disparu: les ombres portées, les bancs, le puits et les personnages y portent désormais tout le contraste.

## La place unie se lit-elle plus mal que le damier?

Non: elle se lit **mieux**, et je le dis franchement (`da-01-place-avant-apres.png`). Sans le damier, l'œil va droit aux personnages, au puits, aux bancs et aux longues ombres du matin. Le damier faisait vibrer toute la moitié de l'écran et noyait les ombres. Mais la place est maintenant **nue**: un grand aplat gris-beige sans matière, qu'on prend pour du béton ou de la terre battue grise. C'est un état d'attente acceptable pour un tour, pas une finition. Les pavés en appareillage de la bible (section 8.7: rangs décalés ou éventails, joints sombres, écart de 8 niveaux au plus) restent nécessaires pour monter au-dessus de 7. En attendant, on garde l'aplat plutôt que de revenir au damier.

## Ce qui a changé, preuves

- **Herbe en teinte continue: réussie.** Plus aucun carré à bord franc; les trois verts se fondent en taches douces à la bonne échelle (`da-03-herbe-continue-jeu-reel.png`, en haut en gros plan, en bas dans le jeu réel avec l'interface). C'est le plus gros gain visuel depuis le tour 1.
- **Fumées: corrigées.** Elles naissent petites et transparentes et montent en volute pâle (`ta-03`, à droite). On ne voit plus de bloc posé sur la cheminée.
- **Habitants qui réagissent: réussi.** Firmin tourne la tête, salue Camille qui passe près de la tonnelle, puis revient à son attente (`planche-rencontre`). Le geste est lisible au zoom de jeu.
- **Repas assis: juste.** `sit_eat` à table, sans le geste de scie (`planche-repas`). La table reste vide: une assiette posée pendant le repas compléterait la scène.
- **Attentes variées: une réussite, avec un défaut.** Les attentes procédurales existent, mais pendant l'une d'elles, Camille lève le bras et garde la bêche brandie à la verticale au-dessus de la tête pendant plusieurs secondes (`da-02-attente-beche-levee.png`, huit images d'affilée). Elle a l'air de brandir un outil ou de faire signe, pas de s'étirer. Correction: ranger l'outil (comme pour `HANDS_FREE`) pendant les attentes qui lèvent les bras, ou réserver cette attente aux mains vides; 20 min, dev rendu. C'est la seule régression visible du tour.
- **Aucune régression de rendu.** Nuit, quai, intérieur réparé et pluie gardent leurs valeurs (tableau ci-dessus). Le foyer du tour 3 est intact.

## Pilier 2: vie du monde et animation, 7/10 (6 avant)

Vent, fumées, gestes calés, attentes variées, habitants qui saluent et regardent, repas et gestes justes: le monde vit maintenant entre deux actions. On passe de « vivant par endroits » à « vivant ». Reste un manque qu'un joueur remarque encore: aucune petite faune hors des poules. Il faut aussi corriger la bêche brandie. Avec la faune, le pilier peut viser 8.

## Pilier 3: direction artistique, 7/10 (6,5 avant)

Le damier et les carrés d'herbe, mon défaut n° 1 du tour 1, sont traités à moitié: l'herbe est finie, la place attend ses pavés. La lumière tient toute la journée. Ce qui plafonne encore la note: chemins et berges à angles droits, rivière en canal et gué en dallage, place nue, marquise plate, et le passage au low poly arrondi décidé par le client, encore à venir.

## Trois priorités pour le tour 5

1. **Le sol, partie restante** (pilier 3): pavés en appareillage sur la place, chemins et berges courbes à coins arrondis (bible, section 8.7). tech-artist, dev rendu, artiste-3d; environ 240 min, +0,5 à +1.
2. **La petite faune** (pilier 2): moineaux qui s'envolent à l'approche d'un joueur, papillons de jour, lucioles la nuit. Corriger au passage la bêche brandie pendant l'attente. artiste-3d, tech-artist, dev rendu; environ 240 min, +1.
3. **La rivière et le gué** (pilier 3), à faire avec les berges courbes: pierres plates espacées sous la lame d'eau, roseaux, écume au pied des berges. level-designer, artiste-3d, tech-artist; environ 180 min, +0,5.

Le low poly arrondi (bible, section 8) se branche sur ces trois chantiers: les nouveaux modèles de pavés, de pierres et de roseaux doivent suivre ses chanfreins et ses budgets dès maintenant.

## Remarque hors périmètre

Dans la vraie simulation, Sacha (joué par le robot) reste toujours immobile près du poulailler de 9 h 30 à 9 h 40 avec « En chemin » sur sa carte, comme au tour 1 (`da-03`, en bas). À vérifier par la QA.

## Captures

Dans `docs/jeux/jeu-1/gauntlet/captures/tour-04/`:

- `da-01-place-avant-apres.png`: la place à 8 h 15, tour 3 (damier) à gauche, tour 4 (aplat) à droite.
- `da-02-attente-beche-levee.png`: planche des attentes du dev rendu, bêche brandie au-dessus de la tête pendant l'attente.
- `da-03-herbe-continue-jeu-reel.png`: en haut le potager en gros plan (trois images à 1 s), en bas le jeu réel avec l'interface à 9 h 30 et 9 h 40.

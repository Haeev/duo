# Gauntlet de qualité: journal

Un bloc par tour, du plus récent au plus ancien: pilier visé, changements, notes avant et après, épreuves G1 à G7, preuves, suite.

## Tour 1 (2026-10-31): notation de départ et plan des 100 heures

- Notes de départ (relecteurs qui n'ont pas produit le travail, `revues/tour-01-*.md`): ressenti 4,5; vie du monde 5; direction artistique 6; son 7 sur dossier; interface 6,5; contenu 5; coopération 6; robustesse 6,5. Moyenne 5,8.
- Plan des 100 heures: `docs/jeux/jeu-1/plan-100-heures.md` (8 arcs, règles anti-répétition R1 à R16, jalons J1 à J9, décisions D1 à D9 pour le client).
- Références visuelles du client (vidéo YouTube, galerie du wiki) non consultables: domaines bloqués par la politique réseau de l'environnement.

## Tour 5 (2026-10-31): low poly arrondi, détails de construction, cohérence du monde, s'asseoir

- Changements: tout le bourg en low poly arrondi (bible, section 8), audit de détail des modèles (établi, ponton, puits, tonnelle, pain, panneau AUBRUNE, cloche sans toit), sol à coins arrondis, berges, gué et rails de la voie de garage; barrières du passage à niveau en travers de la route et qui se lèvent enfin, platelage en long avec ornières et rampes; draisine sur l'axe des rails, garée à l'écart du train et qu'on ne traverse plus; cloche et banc au bout ouest du quai pour que l'ombre de l'énigme tombe au soleil, Firmin à l'ouest de la cloche; habitants et joueurs assis sur les bancs (deux places par banc, envies de banc et passage des oies assis); budget du PC tenu (tri de la passe d'ombre, décor en morceaux de 12 m).
- Deux nouvelles épreuves, demandées par le client: G8 (détails de construction) et G9 (cohérence du monde).
- Épreuves: G1 (lint, types, 355 tests du jeu, contrôles du dépôt), G2 (13 parties jusqu'au jour 15 avec reprises à chaque aube, vraies sauvegardes du format 1, invariants des bancs), G3 (18 tests de bout en bout, essai long à deux instances sans erreur), G4 (place à 19 h: 143 800 et 182 500 triangles, 65 et 110 appels, 11 programmes), G5 (`captures/tour-05/place-avant-apres.png` et planches du dossier), G6 (directeur artistique, game designer et QA: mieux qu'avant, après deux séries de correctifs), G7, G8 et G9 (contrôle après correctifs, `revues/tour-05-directeur-artistique.md`). Reporté sur `main`.
- Notes: direction artistique 7,5 (7), contenu 7,5 (7), les autres inchangées; moyenne 7,3 (7,1).
- Restes non bloquants: ombre de la cloche à peine lisible (cloche à agrandir), flancs des rampes en lame, ornières trop claires, page de rendu qui place mal Jeanne; vues de la maisonnette et du passage à niveau au zoom large au-dessus de 150 appels.
- Tour 6 prévu: moments rares visibles et sonores (héron, oies, échelle, nichoir), une information que seul l'un des deux voit, petite faune; pavés de la place et berges courbes.

## Tour 4 (2026-10-31): gestes à deux, jours creux, vie du monde, sol

- Changements: draisine poussée à deux et colis lourd du catalogue porté à deux, quatre buts d'après-midi (jours 6, 10, 11, 13), rendez-vous du jour 14 qui ne se perd plus; attentes variées, habitants qui suivent du regard et saluent, clips sit_eat, give, pet et high_five branchés; herbe en teinte continue, place sans damier, fumées qui naissent petites. Correctifs exigés en revue: draisine dessinée au bout de la voie, plus d'outil brandi pendant les attentes.
- Épreuves G1 à G7 passées (307 tests, 18 tests de bout en bout). Reporté sur `main`.
- Notes: vie du monde 7 (6), direction artistique 7 (6,5), contenu 7 (6,5), coopération 7,5 (6,5); moyenne 7,1 (6,8).
- Décision du client pendant le tour: passer au low poly arrondi (bible, section 8); planche de trois modèles témoins en cours, à valider par le client avant de l'appliquer au bourg.
- Tour 5 prévu: low poly arrondi (si validé), pavés et chemins courbes, petite faune, rivière et gué; jour 6 joué par les robots, une information propre à chacun, des buts qui ne sont pas des apports.

## Tour 3 (2026-10-31): contenu et rythme, soir et foyer

- Changements: 56 répliques quotidiennes et règle « la moins récemment entendue » (redites de 55 % à 7 à 9 % à une conversation par jour), quêtes de la semaine 2 étalées et un événement par jour du 11 au 14, second chemin vers la remise sans l'énigme, 15 envies de plus et pas de retour avant 7 jours, robot corrigé (porte); soir plus contrasté, foyer de la maisonnette, fumées plus visibles.
- Épreuves: G1 et G2 (294 tests du jeu, validateur, robots sur les deux semaines), G3 (18 tests de bout en bout), G4 (budgets inchangés), G5 (captures avant et après), G6 (contenu et coopération mieux, direction artistique mieux, vie du monde stable avec une réserve sur la forme des fumées, aucune régression), G7. Reporté sur `main`.
- Notes: contenu 6,5 (5), coopération 6,5 (6), direction artistique 6,5 (6), vie du monde 6; moyenne 6,8 (6,5).
- Tour 4 prévu: gestes à deux (pousser la draisine, colis porté à deux), but d'après-midi pour les jours creux, rendez-vous du jour 14 qui ne se perd plus, attentes variées et habitants qui réagissent, forme des fumées; ensuite le sol, la rivière et la petite faune.

## Tour 2 (2026-10-31): ressenti, vie du monde, interface, son, robustesse

- Résultat: reporté sur `main` après les épreuves G1 à G7 (290 tests du jeu, robots sur les deux semaines, 18 tests de bout en bout de Duo et essai long à deux instances, budgets tenus, captures avant et après, revues adverses toutes « mieux » sauf la direction artistique, non visée, et trois correctifs exigés par la revue de robustesse: sauvegarde refusée jamais écrasée, variantes sans ombre compilées d'avance, Espace tenu jamais deviné). Notes: ressenti 7 (4,5), vie du monde 6 (5), direction artistique 6, son 7,5, interface 7 (6,5), contenu 5, coopération 6, robustesse 7,5 (6,5); moyenne 6,5 (5,8).
- Tour 3 prévu: contenu et rythme (5): répliques qui se répètent, jours vides de la semaine 2, envies épuisées; puis le sol et la petite faune.

- Cible principale: le pilier le plus faible, le ressenti (4,5): gestes d'outil joués une fois à la bonne durée et retour à l'attente, appuis mémorisés, Espace tenu, tape de pavé tactile, correction de coin (simulation); clips et marche sur place (rendu); saccade et pas muets de l'invité (réseau).
- En parallèle: vent et fumées (tech-artist), aménagement à 125 et 150 % et refus distincts (interface), sons d'interface et de refus (sound-designer), repli automatique vers le mode léger, sauvegardes vérifiées avant acceptation, sauvegardes de référence, alerte de taille d'état (architecte, copie isolée).


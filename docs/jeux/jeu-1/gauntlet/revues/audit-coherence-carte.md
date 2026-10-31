# Audit de cohérence de la carte de la Halte d'Aubrune

| Champ | Valeur |
|---|---|
| Relecteur | level-designer, auteur de la carte, en critique de son propre travail |
| Date | 2026-10-31 |
| Règle | `CLAUDE.md`, « Cohérence du monde et sens du détail », épreuve G9: chaque élément est-il au bon endroit, dans le bon sens, à la bonne taille, et pourquoi ? |
| Sources | `games/la-petite-ligne/donnees/cartes/halte.json` (construit par `outils/construire_carte_halte.py`), ses aperçus, et le rendu réel: `rendu.html` servi par Vite, 1366x768, mode léger, captures dans quatre orientations |
| Captures | `docs/jeux/jeu-1/gauntlet/captures/tour-05/coherence-01` à `coherence-07` |

## La carte racontée par un habitant

La vieille route vient du sud, passe l'Aubrune au gué, monte vers le nord, croise la voie au passage à niveau et file vers la scierie et le bois de la Côte: c'est la route du bois, celle des charrettes de grumes. Le train vient de la ville par l'ouest, passe la barrière du garde-barrière et s'arrête le long du quai; la halte est au bout est, la remise de la draisine au-delà, côté Vergers. La rue de la Gare part de la route vers l'est, longe la place et finit dans la cour de la halte, où s'arrêtent les charrettes du samedi. L'eau se prend au puits de la place, au tonneau de la maisonnette ou à la rivière; le bois descend de la lisière à l'établi de Basile.

Cette histoire tient. Les défauts sont surtout des orientations, des liaisons de chemins et des modèles qui ne disent pas ce qu'ils sont.

## Ce que j'ai corrigé dans la carte

Modifications dans `outils/construire_carte_halte.py`, carte reconstruite (le JSON n'est jamais retouché à la main), aperçus régénérés.

| Élément | Avant | Après | Preuve |
|---|---|---|---|
| Barrières du passage à niveau (`level_crossing_gate_north`, `_south`) | rotations 1 et 3: lisses abaissées **le long** de la route, sur le bas-côté; elles ne barraient rien | rotations 0 et 2: lisses **en travers** de la route, poteau à droite de qui arrive (au nord-ouest pour qui descend, au sud-est pour qui monte), comme une demi-barrière | `coherence-01-barrieres-avant-apres.png` (même cadrage, orientation 1) et `coherence-03` (orientation par défaut) |
| Sentier du jardin (x 13) | montait droit jusqu'aux rails et les traversait à 4 m du passage à niveau: deux traversées côte à côte, dont une sauvage, devant la maison de celui qui garde la barrière | il tourne en y 15 et rejoint le passage à niveau | idem, `coherence-01` (après) |
| Porte de Firmin | deux cases d'herbe entre la porte et le sentier de la voie | un bout de chemin de la porte au sentier, qui mène à la traversée de service | carte reconstruite |

Essai annulé: le banc du quai tourné vers la voie (rotation 2). C'est plus juste, mais le dossier passe de l'autre côté et l'ombre de la cloche touche alors le banc dès 16 h 30: `src/rendu/lumiere.test.ts` (« ne le touche pas à 16 h 30 ni à 18 h ») a échoué. Banc remis tel quel; capture de l'essai: `coherence-02-banc-quai-essai.png`.

Contrôles: `valider_carte.py` 0 erreur (4 avertissements anciens: des pissenlits cachés par le train à quai le samedi, sans effet le jour 6); suite du jeu: voir le compte rendu.

## Audit, classé par visibilité

Visibilité: **forte** (vue dès la première minute ou à chaque journée), **moyenne** (vue souvent), **faible** (il faut la chercher).

| Vis. | Élément | Problème | Pourquoi c'est faux | Correction proposée | Qui |
|---|---|---|---|---|---|
| forte | Barrières du passage à niveau | lisses le long de la route | une barrière barre la route; parallèle, elle ne protège rien | **corrigé** (rotations 0 et 2) | level-designer |
| forte | Planches du passage à niveau | caisson brun d'environ 40 cm posé **sur** les rails (`coherence-03`) | un platelage est au ras du champignon du rail, sinon les roues du train le heurtent; les rails doivent rester visibles de part et d'autre | modèle à la hauteur du rail (5 à 8 cm au-dessus du ballast), planches entre et de part et d'autre des files de rails | artiste-3d ou dev rendu |
| forte | Banc du quai | dos à la voie (`coherence-02`) | on attend le train en le regardant | le tourner (rotation 2) **et** recaler l'énigme: soit l'heure (17 h à 17 h 30), soit la place du banc d'une case vers l'est, puis le test d'ombre de `lumiere.test.ts`. Essayé seul, il casse l'énigme | level-designer, tech-artist, game-designer |
| forte | Cloche et banc du quai | posés sur la bande de gazon au sud du quai, pas sur le quai (`coherence-06`) | une cloche de quai se fixe au quai ou au mur de la halte, là où passe le chef de halte | les remonter d'une case (y 18) demande de recaler l'énigme de l'ombre (heure, point `bell_shadow_spot`, test d'ombre); à décider avec le game designer, à faire ensemble | level-designer, game-designer |
| forte | Place du bourg | 18 x 11 m entièrement pavés, vides, pour un hameau de quatre habitants (`coherence-06`) | un hameau a une place de terre battue ou de gravier, pavée seulement devant l'épicerie et autour du puits; tant de pavés disent « ville » et rendent la place froide | garder l'emprise (fêtes), peindre en terre battue tout sauf un parvis devant l'épicerie et un cercle autour du puits. Demande une nature de sol « gravier » au rendu, ou à défaut le chemin de terre actuel | level-designer après accord du rendu |
| forte | Gué de l'Aubrune | se lit comme une chaussée pavée à sec, entre deux quais de canal en pierre (`coherence-05`) | un gué est un haut-fond: l'eau passe par-dessus des galets; et une rivière de campagne a des berges de terre et d'herbe, pas des quais droits | eau peu profonde animée sur le gué, galets, berges en pente douce sans bordure de pierre | tech-artist (eau), dev rendu (berges) |
| forte | Maisonnette du garde-barrière | dos à la voie, porte au sud, à environ 15 m du passage à niveau (`coherence-07`) | le garde-barrière surveille la voie: sa maison touche le passage, une fenêtre ou la porte donne sur la barrière | à moyen terme, rapprocher la maison du passage (x 12 à 16, y 16 à 21) et ouvrir une fenêtre côté voie; pas maintenant: la pièce jouable, le potager, la poutre et les tests des robots en dépendent. À défaut, ajouter une fenêtre côté voie au modèle | artiste-3d (fenêtre), décision manager |
| moyenne | Remise de la draisine, voie de garage | trois cases de voie à angle droit sur la ligne, rendues en dalle grise **sans rails** (`coherence-04`) | un rail ne tourne pas à angle droit; une voie de garage part en biais par un aiguillage. Sans rails, la draisine n'a rien sur quoi rouler | rendre des rails sur les cases `=` de la voie de garage; à terme, voie en biais (deux cases vers l'ouest) avec un aiguillage | dev rendu, puis level-designer |
| moyenne | Poussée de la draisine | de (56,5; 9,5) à (50,5; 13,5): **en diagonale**, à travers le ballast, hors des rails | une draisine roule sur ses rails ou ne bouge pas | `reglages.json`, `carry.handcar.toOffset` à [0, 3]: elle descend la voie de garage jusqu'à la ligne. Données du game designer | game-designer |
| moyenne | Halte (bâtiment voyageurs) | une seule porte, côté cour; aucune ouverture sur le quai | les voyageurs passent de la salle d'attente au quai | ajouter une porte côté quai au modèle (façade ouest ou nord) | artiste-3d |
| moyenne | Sentier du jardin (x 13) | traversait la voie à 4 m du passage à niveau | voir plus haut | **corrigé** | level-designer |
| moyenne | Porte de Firmin | ne menait à aucun chemin | un chemin naît d'une porte | **corrigé** | level-designer |
| moyenne | Lisière (12 arbres à couper) | disposés en quinconce régulier, un tous les deux mètres | une lisière naturelle est irrégulière; la grille dit « verger » | décaler chaque arbre d'une case au hasard, en gardant la portée de la hache et la règle des deux cases au nord des cueillettes; à faire avec un test des robots | level-designer (tour suivant) |
| moyenne | Socle de la maisonnette | dalle orange plus large que la maison de plus d'un mètre (`coherence-07`) | un soubassement suit le mur | ajuster au modèle | artiste-3d |
| faible | Bancs de la place | l'un face au sud (la promenade), l'autre face au puits | sur une place, les bancs regardent ce qui s'y passe | tourner `square_bench` vers le puits (rotation 2) au prochain passage, avec une capture | level-designer |
| faible | Clôture du jardin | ferme seulement le sud (la berge) et le bas de l'est | elle tient les poules loin de la rivière et du chemin: c'est son rôle, cohérent; l'ouest et le nord sont ouverts parce que la maison et la haie les bordent | aucune | |
| faible | Boîte aux lettres | au bord de la route, à l'entrée du chemin de la maison | juste: la factrice passe par la route | aucune | |
| faible | Lampadaires | quai, place, carrefour du passage; aucun sur la promenade ni au ponton | un bourg de cette taille éclaire le quai et la place, pas la rivière | aucune | |
| faible | Puits | au centre de la place, à 9 m de l'épicerie | juste: l'eau commune au milieu du bourg | aucune | |
| faible | Ponton | à l'est du gué, face à la place, à moitié sur la berge | juste: là où l'eau est profonde et calme, près du banc de la berge | aucune | |
| faible | Scierie et établi | contre le bois, sur la route du passage à niveau | juste: le bois descend tout seul à la scie, la route sort les planches | aucune | |
| faible | Cour de la halte | sert d'aire aux charrettes, mais rien ne le dit | une cour de gare a son abreuvoir, son anneau à cheval ou une charrette | ajouter une charrette à bras ou une brouette près du tonneau (52, 23) quand le modèle existe | artiste-3d, level-designer |

## Ce qui demande un autre membre

- **artiste-3d**: planches du passage au ras du rail; porte côté quai à la halte; fenêtre côté voie et socle ajusté de la maisonnette; une charrette ou une brouette pour la cour.
- **dev rendu et tech-artist**: rails sur la voie de garage; gué en eau peu profonde avec galets; berges de rivière en pente, sans quais de pierre; nature de sol « gravier » pour la place.
- **tech-artist et game-designer**: banc et cloche du quai tournés vers la voie, avec l'énigme de l'ombre recalée.
- **game-designer**: poussée de la draisine le long de la voie de garage (`carry.handcar.toOffset` à [0, 3]); accord pour remonter la cloche et le banc sur le quai en recalant l'énigme.
- **manager**: décision sur le rapprochement de la maisonnette du passage à niveau (gros chantier: pièce, potager, poutre, tests).

## Non vérifié

- La lisse abaissée seulement quand le train est là: vue avec le train à quai (lisses baissées); lisses levées non capturées.
- Le rendu de nuit et les orientations 3 des lieux corrigés.

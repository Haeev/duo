# Carte du bourg: La Halte d'Aubrune (démo)

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne (titre provisoire) |
| Statut | blockout validé par script; à voir en jeu dès que le rendu charge la carte |
| Version du document | 0.1 |
| Dernière mise à jour | 2026-10-31 |
| Rédaction | level-designer |
| Documents liés | cahier des charges: `docs/jeux/jeu-1/cahier-des-charges.md` (sections 4.4, 4.7, 4.10, 4.15, 6.1 à 6.3); périmètre de la démo: `docs/jeux/jeu-1/demo.md` (fait foi); points attendus par les données: `games/la-petite-ligne/donnees/README.md` (section 5) |
| Fichiers | carte: `games/la-petite-ligne/donnees/cartes/halte.json`; aperçus: `halte-apercu.png` (vue de dessus) et `halte-apercu-iso.png` (caméra par défaut), même dossier; outils: `games/la-petite-ligne/outils/construire_carte_halte.py`, `valider_carte.py`, `apercu_carte.py` |

## En bref

- **Une seule zone de 64x48 m**, la partie habitée de l'enveloppe de 120x90 m du cahier. Un anneau de 2 m autour est du décor lointain, jamais franchissable.
- **La composition**: la voie traverse le nord de la carte; le quai est au cœur, la halte à son bout est; la maisonnette du garde-barrière est au passage à niveau, à l'ouest du quai; la place du bourg s'ouvre juste au sud du quai; la lisière du bois de la Côte borde la voie côté nord, l'Aubrune coule au sud.
- **Tout est proche**: depuis la porte de la maisonnette, le potager est à 1 m, le poulailler à 2,5 s, la caisse du quai à 7,5 s, le comptoir d'Odette à 8,3 s, l'établi de Basile à 6,6 s, la lisière à 8,6 s, le gué à 5,7 s. Le plus long trajet contrôlé (la remise de la draisine, qui ne sert qu'à la fin) prend 16 s. Plafond demandé: 25 s.
- **Pensée pour la caméra isométrique**: ce qui est haut est au nord et à l'ouest, ce qui compte est au sud-est de ce qui est haut. Chaque lieu important est vu depuis la caméra par défaut (sud-est) et depuis au moins une autre des quatre orientations.
- **Contrôles**: `python3 games/la-petite-ligne/outils/valider_carte.py` (0 erreur) et `python3 games/la-petite-ligne/outils/valider_donnees.py` (0 erreur, tous les points des données trouvés).

## 1. Intention

| | |
|---|---|
| Ce que la carte enseigne | Où vivent les choses, en une journée: la maison, le potager, le quai et l'épicerie forment une boucle de moins de 30 s; la lisière et la rivière sont au bord, pour l'envie d'aller voir. |
| Ce qu'elle met à l'épreuve | S'organiser à deux pour la commande du samedi: les quatre lignes viennent de trois directions (radis et laitues au potager, à l'ouest; œufs au poulailler, juste à côté; planches au nord, de la lisière à l'établi) et se déposent au centre, à la caisse du quai. « Je fais le bois, tu t'occupes du potager ? » vient tout seul. |
| Émotion visée | Être accueilli et se sentir chez soi: on descend du train sur un quai fleuri, la place est à deux pas, la maison a son jardin et sa barrière. Rien ne presse: aucun lieu du quotidien (potager, poulailler, quai, épicerie, puits, établi, lisière, gué) n'est à plus de 10 s de la maison. |
| Difficulté | 1 sur 5 (cahier, section 6.1): aucune impasse, aucun obstacle à contourner pour aller à un lieu utile, des chemins qui montrent la route. |

## 2. Composition

| Lieu | Où (cases) | Pourquoi là |
|---|---|---|
| La voie | rangées y 12 à 14, de bord à bord; passage à niveau en x 17 à 19; traversée de service en x 50 | Le train vient de la ville par l'ouest, passe le passage à niveau du garde-barrière et s'arrête le long du quai; les Vergers sont à l'est (chapitre 2). Au nord du quai, le train à l'arrêt ne cache jamais le quai depuis les caméras du sud. Le ballast est franchissable partout, sauf sous le train à quai le samedi. |
| Le quai et la halte | quai x 21 à 50, y 15 à 18; halte x 51 à 60, y 15 à 20, porte au sud | Le quai est le cœur: caisse, tableau, cloche et banc sont groupés au milieu, à moins de 10 m de la porte de la voiture (`train_stop`). La halte est au bout est, en ligne avec le quai: placée au sud, elle aurait caché le quai à la caméra. |
| La maisonnette du garde-barrière | x 5 à 11, y 21 à 26, porte au sud, pièce de 5x4 | Au passage à niveau, au bout ouest du quai: c'est la première chose que le train croise en arrivant. Son jardin borde la voie; le potager de 12 cases est juste devant la porte, le tonneau d'eau à 1 m, le poulailler à côté. |
| La place du bourg | pavés x 31 à 48, y 23 à 33; puits au centre (x 39 et 40, y 27 et 28) | Juste au sud du quai: on y entre en descendant du quai. L'épicerie-pension Ferrand la borde à l'ouest, façade et comptoir tournés vers la place, avec la tonnelle du souper. L'est de la place reste dégagé pour les fêtes (arbre de mai, foire). |
| La lisière du bois de la Côte | zone x 15 à 39, y 3 à 10, au nord de la voie | Les 12 arbres à couper (chênes et sapins), des sureaux, des ronces, les pissenlits. Au fond de l'image vue par la caméra par défaut: ses grands arbres ne cachent rien d'important. |
| La scierie de Basile | x 2 à 11, y 2 à 9, établi sous auvent en x 12 et 13, y 7 et 8 | Contre le bois, au bout de la lisière: le premier arbre est à 1 s de l'établi. De l'autre côté de la voie par rapport à la maisonnette, à 6,6 s par le petit sentier du jardin. |
| La maison de Firmin | x 41 à 47, y 2 à 7, porte au sud | En face du quai, de l'autre côté de la voie: Firmin traverse chaque matin par la traversée de service au bout du quai, libre même quand le train est là. |
| La remise de la draisine | x 54 à 59, y 4 à 8, porte au sud sur une courte voie de garage | Au bout est, côté Vergers: fermée toute la semaine, elle s'ouvre à la fin pour annoncer la suite. |
| L'Aubrune | eau profonde y 38 à 42 (berges aux anses irrégulières), gué x 16 à 20 | Au premier plan de la caméra, basse: rien de haut sur la rive sud. Le gué prolonge la route du passage à niveau; le banc de la berge et le ponton sont à l'est du gué, devant l'épicerie et la place. |
| Le pré de l'est | x 50 à 61, y 24 à 33 | Herbes hautes, rochers, buissons: l'espace qui respire entre la halte et la rivière, le chemin de Jeanne. |

Réserves pour le jeu complet, inutilisées par la démo et laissées sans rien de fixe: le plan de la maison (14x12, règle MA-01) au nord de la maisonnette, entre elle et la voie, pour qu'une maison agrandie pousse derrière et ne cache jamais le potager; le potager de 96 cases (règle FE-01) autour de celui de la démo, jusqu'à la clôture de la berge.

## 3. Schéma

Aperçus générés par `apercu_carte.py`: `games/la-petite-ligne/donnees/cartes/halte-apercu.png` (vue de dessus, points numérotés, trajets des habitants, zones) et `halte-apercu-iso.png` (blockout vu par la caméra par défaut).

Grille ASCII (nord en haut; x de 0 à 63, y de 0 à 47):

```text
     0         1         2         3         4         5         6
     0123456789012345678901234567890123456789012345678901234567890123
  0  TXXXXXXXTXXXTXXXTXXXTXTXXXXXTXTXTXXXTXTXXXTXTXXXXXXXXXXXXXXXTXTX
  1  XXTXTXTXXXTXXXTXXXTXXXXXTXTXXXXXXXTXXXXXTXXXXXTXTXTXTXTXTXTXXXXX
  2  XXSSSSSSSSSS.,,,....,,,,..,...,.,...,.,..FFFFFFF,,.T.,,...,,.,XX
  3  XXSSSSSSSSSS...,.,A....,...,A.,,.,,,.,A.,FFFFFFF,..,..,,,,..T.XX
  4  TXSSSSSSSSSS,.,,,,,..,..A......,.,A,.,.,,FFFFFFF,.,,.,RRRRRR..XX
  5  XXSSSSSSSSSS...,,..,A,,,......A,.,,,..,..FFFFFFF....T.RRRRRR,,XX
  6  XXSSSSSSSSSS,,,.A.......,.A.....,...A..,.FFFFFFF..,...RRRRRR.TXX
  7  TXSSSSSSSSSSww....,,..A,.,,...,.A...,,.,.FFFDFFF.,..,,RRRRRR,,XX
  8  XXSSSSSSSSSSww...,...,.,.,,,.,.,,.,,.,,..,...,.,..,..,RRDRRR,,XX
  9  XXSSSSSDSSSS...,,...,,,,,,,,,,,,.......,...,.,,......,,.=.,.,.XX
 10  TX::::::::::::::::::::::::::::::::::::::::::::::::::::::=:::::XX
 11  XX::::::::::::::::::::::::::::::::::::::::::::::::::::::=:::::XX
 12  =================###==============================#=============
 13  =================###==============================#=============
 14  =================###==============================#=============
 15  XX...........:...:::.qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqHHHHHHHHHH.XX
 16  XX...........:...:::.qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqHHHHHHHHHH.XX
 17  XX...........:...:::.qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqHHHHHHHHHH.XX
 18  XX...........:...:::.qqqlqqqqiqqcqqqqqqqqqqqqqqlqqqHHHHHHHHHH.XX
 19  XX...........:...:::..........++....k..nn..++......HHHHHHHHHH.XX
 20  XX...........:...:::l.........++...........++......HHHHDHHHHH.XX
 21  XX...MMMMMMM.:...:::++++++++++++++++++++++++++++++++++++++++++XX
 22  XX...M     M.:...:::++++++++++++++++++++++++++++++++++++++++++XX
 23  XX...M     M.:...:::...EEEEEEEE++++++++++++++++++..+++++++++++XX
 24  XX...M     M.:...:::...EEEEEEEE+++l++++++++++++l+.,,,....,,.,,XX
 25  XX...M     M.:...:::...EEEEEEEE++++++++++++++++++.,,,,,.,.,,..XX
 26  XX...MMMDMMMu:..m:::...EEEEEEEC++++++++++++++++++....,.,..,,..XX
 27  XX.:::::::::::::::::...EEEEEEEE++++++++OO++++++++.,,,,,,.,..,,XX
 28  XX.....pppp...PPP:::...EEEEEEEE+aaa++++OO+n++++++.......,,...,XX
 29  XX.....pppp...PPP:::...EEEEEEEE+aaa+++++++n++++++..,,.,,,,,,,,XX
 30  XX.....pppp...PDP:::...EEEEEEED++++++++++++++++++..,,,.,.,..,,XX
 31  XX...............:::...EEEEEEEE++++nn++++++++++++.,,,,,.,,.,.,XX
 32  XX..............|:::...EEEEEEEE++++++++++++++++l+.,.,,,,..,,,,XX
 33  XX..............|:::...........++++++++++++++++++.,,,,.,.,,,,.XX
 34  XX..............|:::::::::::::::::::::::::::::::::::::::::::::XX
 35  XX..............|:::::::::::::::::::::::::::::::::::::::::::::XX
 36  XX--------------.:::,......nn.,..,,,.,,,.,.,,,.,,.,,.,.,,.,...XX
 37  bbbbbbbbbbbbbbbbgggggbbbbbbbbbbbbbbbbbbbbbbbvvbbbbbbbbbbbbbbbbbb
 38  bbbbbbbb~~~~~~~~ggggg~~~~~~bbbbbbbb~~~~~~~~~vv~~~~~~~~bbbbbbbb~~
 39  ~~~~~~~~~~~~~~~~ggggg~~~~~~~~~~~~~~~~~~~~~~~vv~~~~~~~~~~~~~~~~~~
 40  ~~~~~~~~~~~~~~~~ggggg~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 41  ~~~~~~~~~~~~~~~~ggggg~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 42  ~~~~~~~~~~~~~~~~ggggg~~bbbbbbbbb~~~~~~~~~~~~~~~~~~~~~~~bbbbbbbbb
 43  bbbbbbbbbbbbbbbbgggggbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
 44  XX,.,,,,,...,..,,:::.,,,,,.,,,,,,.,,,,,..,,,,,,,,,.,.,.,,,.,.,XX
 45  XX,..,,,.,.,.,,.,:::,..,,,,..,,,,,.,.,.,.,,,,.,...,.,,,,.,..,,XX
 46  XXXXXXXXXXXXXXXXX:::XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
 47  XXXXXXXXXXXXXXXXX:::XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Terrain: `.` herbe, `,` herbe haute, `:` chemin de terre, `+` pavés, `p` potager, `~` eau profonde, `g` gué, `b` berge, `=` voie, `#` traversée en planches, `q` quai, `X` bord. Objets: `H` halte, `M` maisonnette (pièce en blanc), `E` épicerie-pension, `F` maison de Firmin, `S` scierie, `R` remise, `P` poulailler, `D` porte, `C` comptoir d'Odette, `O` puits, `a` tonnelle, `w` établi, `c` caisse, `i` tableau, `k` cloche, `n` banc, `l` lampadaire, `u` tonneau d'eau, `m` boîte aux lettres, `v` ponton, `-` et `|` clôtures, `A` arbre à couper, `T` arbre de décor. Buissons et rochers ne sont pas dessinés ici.

## 4. Parcours du joueur pendant la première heure

### Arrivée (jour 1, 10 h)

Le train sort du bord ouest, passe le passage à niveau (barrière baissée) et longe le jardin de la maisonnette avant de s'arrêter le long du quai, la voiture au milieu. Les deux joueurs apparaissent sur le quai devant la porte de la voiture (`spawn_1`, `spawn_2`, tournés vers le sud); Firmin les attend à `train_stop`, tourné vers eux.

Ce que montre la caméra par défaut (sud-est), centrée sur le quai, sur un écran 16:9:

| Zoom (largeur de vue) | Ce qu'on voit |
|---|---|
| 16 m | Firmin, la cloche et son banc, la caisse, le tableau, le bord de la lisière derrière le train |
| 24 m | en plus: le puits et la tonnelle d'Odette sur la place, la maison de Firmin de l'autre côté de la voie |
| 36 m | en plus: la façade de l'épicerie et son comptoir, la halte, le passage à niveau et sa barrière, la poutre de Basile |

La maisonnette n'est pas dans la première image: Firmin la désigne « là-bas, au passage à niveau ». On longe le quai vers l'ouest; la barrière rouge et blanche du passage à niveau sert de balise; la maisonnette et Basile sont derrière, à 10 s de marche.

### Découverte, jour par jour (aligné sur `demo.md`, section 1.1)

| Jour | Où l'on va | Ce que la carte fait pour ce moment |
|---|---|---|
| 1, samedi | quai, maisonnette, épicerie | Basile attend à `beam_pickup`, au coin du jardin près du passage à niveau; la poutre se porte à deux sur 6,4 m (3,6 s à 1,8 m/s) jusqu'au pignon est (`house_beam_spot`), dans un couloir d'au moins 3 m. Le chantier du toit et de la porte se joue devant la porte. Odette (graines, pain) est à 8,3 s par la rue de la Gare. Retour pour la première veillée. |
| 2, dimanche | potager, puits | Le potager de 12 cases est juste devant la porte; le tonneau est à 1,4 m; le puits de la place, à 9 s, sert de second point d'eau. On se répartit le potager et le bois. |
| 3, lundi | lisière, scierie, quai | Jeanne joue sur le banc du quai le matin. Petit sentier du jardin vers le nord, la voie, l'établi de Basile: le premier arbre est à 1 s de l'établi, le plus loin à 7,7 s. Le poulailler à réparer est à 2,5 s de la porte. |
| 4, mardi | potager, épicerie | La boucle récolte, vente chez Odette, retour fait moins de 20 s de marche. |
| 5, mercredi | poulailler, place | Les œufs. À 19 h, le souper sous la tonnelle d'Odette, au bord de la place. Jeanne est sur la berge l'après-midi, sur la place le soir. |
| 6, jeudi | tableau du quai | Le catalogue au tableau, à 6,7 s de la porte. |
| 7, vendredi | cloche et banc | L'énigme: le banc est 3,5 m à l'est de la cloche, sur l'herbe du talus du quai; on bêche au pied du banc (`bell_shadow_spot`), dans l'herbe, pas sur les dalles. |
| 8, samedi | quai, remise | Le train revient; la caisse est au milieu du quai, jamais cachée par le train (il est au nord). Le rassemblement final se fait à la cloche; la remise, au bout est, s'ouvre sur la draisine. |

Boucle type d'un matin: porte, potager (sur place), tonneau (1 m), poulailler (2,5 s), comptoir d'Odette (8 s), caisse du quai (2 s), retour (7,5 s): environ 20 s de marche, soit moins d'une heure de jeu avec l'horloge de la démo (0,35 s par minute).

Facultatif, pour l'envie d'explorer: la rive sud par le gué, le ponton, le banc de la berge, le pré de l'est, la cueillette le long de la lisière.

## 5. Repères visuels

- **La barrière rouge et blanche du passage à niveau**: « chez nous ». On la voit depuis le quai au zoom large.
- **La cloche sur son poteau et le panneau « Aubrune »**: le quai, la commande, Firmin.
- **La façade colorée de l'épicerie et sa tonnelle**: la place, Odette.
- **Le puits**: le centre du bourg, l'eau.
- **Le tas de bois et l'auvent de l'établi**: le travail du bois.
- **La remise fermée au bout de la voie**: le mystère de la fin, la suite de la ligne.
- **Les sols disent où l'on est**: pavés au bourg, chemin de terre vers la nature (lisière, jardin, rivière), planches aux traversées de la voie.

## 6. Distances de marche entre les lieux clés

Chemin le plus court sur la grille (huit directions, sans couper les angles), à 3,5 m/s, calculé par `valider_carte.py`. Le samedi, le train à quai occupe la voie le long du quai: la dernière colonne donne le temps dans ce cas quand il change.

| De | À | Distance | Temps | Train à quai |
|---|---|---|---|---|
| porte de la maisonnette | potager | 1 m | 0,3 s | |
| porte de la maisonnette | poulailler | 8,7 m | 2,5 s | |
| porte de la maisonnette | gué | 20,1 m | 5,7 s | |
| porte de la maisonnette | établi de Basile | 23,0 m | 6,6 s | |
| porte de la maisonnette | tableau du quai | 23,3 m | 6,7 s | |
| porte de la maisonnette | berge (banc) | 24,1 m | 6,9 s | |
| porte de la maisonnette | caisse de la coopérative | 26,3 m | 7,5 s | |
| porte de la maisonnette | comptoir d'Odette | 29,1 m | 8,3 s | |
| porte de la maisonnette | arbre du milieu de la lisière | 30,0 m | 8,6 s | |
| porte de la maisonnette | cloche (Firmin) | 31,7 m | 9,1 s | |
| porte de la maisonnette | porte de la voiture | 34,1 m | 9,8 s | |
| porte de la maisonnette | puits | 34,3 m | 9,8 s | |
| porte de la maisonnette | place (Jeanne le soir) | 35,1 m | 10,0 s | |
| porte de la maisonnette | ponton | 42,6 m | 12,2 s | |
| porte de la maisonnette | maison de Firmin | 43,9 m | 12,5 s | 13,7 s |
| porte de la maisonnette | remise de la draisine | 55,5 m | 15,8 s | 16,0 s |
| potager | tonneau d'eau | 1,4 m | 0,4 s | |
| potager | puits | 32,3 m | 9,2 s | |
| caisse | comptoir d'Odette | 6,0 m | 1,7 s | |
| caisse | établi de Basile | 21,3 m | 6,1 s | |
| caisse | poulailler | 23,3 m | 6,7 s | |
| établi | premier arbre de la lisière | 3,4 m | 1,0 s | |
| établi | arbre le plus loin de la lisière | 27,1 m | 7,7 s | |
| établi | comptoir d'Odette | 27,4 m | 7,8 s | |
| comptoir d'Odette | place | 7,2 m | 2,1 s | |
| porte de la voiture | comptoir d'Odette | 11,1 m | 3,2 s | |
| porte de la voiture | remise | 21,3 m | 6,1 s | 6,3 s |
| porte de la voiture | berge | 25,3 m | 7,2 s | |
| cloche | pied du banc (énigme) | 5,4 m | 1,5 s | |
| berge | gué | 11,8 m | 3,4 s | |
| cour de la scierie | berge | 37,2 m | 10,6 s | |
| maison de Firmin | comptoir d'Odette | 22,0 m | 6,3 s | 9,5 s |
| cueillette de la lisière (est) | porte de la maisonnette | 37,5 m | 10,7 s | 11,9 s |

Comparaison avec les places indicatives de `demo.md` (section 1.2): la halte à 6,7 à 9,8 s (prévu 6 s), la place à 8,3 à 10 s (9 s), la scierie à 6,6 s (13 s), la lisière à 8,6 s (14 s), la rivière à 5,7 à 6,9 s (10 s), la remise à 15,8 s (40 m, environ 11 s). La journée marche donc moins que prévu, ce qui laisse plus de temps aux gestes avec l'horloge rapide de la démo.

## 7. Éléments placés

### Bâtiments et équipements

Position: centre de l'emprise; rotation en quarts de tour, 0 pour une porte au sud.

| Objet (type) | Emprise (x, y, l, p) | Rotation | Ouvertures | Pièce jouable |
|---|---|---|---|---|
| `station` | 51, 15, 10x6 | 0 | porte en (55, 20) | non (démo) |
| `platform` | 21, 15, 30x4 | 0 | | sol franchissable |
| `gatekeeper_house` | 5, 21, 7x6 | 0 | porte en (8, 26) | oui, pièce x 6 à 10, y 22 à 25 |
| `ferrand_shop` | 23, 23, 8x10 | 1 (façade à l'est) | comptoir en (30, 26), porte en (30, 30) | non: on joue au comptoir depuis la place |
| `firmin_house` | 41, 2, 7x6 | 0 | porte en (44, 7) | non |
| `sawmill` | 2, 2, 10x8 | 0 | porte en (7, 9) | non |
| `handcar_shed` | 54, 4, 6x5 | 0 | porte en (56, 8), voie de garage x 56, y 9 à 11 | non |
| `henhouse` | 14, 28, 3x3 | 0 | porte en (15, 30) | non |
| `well` | 39, 27, 2x2 | 0 | | |
| `workbench` (établi sous auvent) | 12, 7, 2x2 | 0 | | |
| `arbor` (tonnelle d'Odette) | 32, 28, 3x2 | 0 | | |
| `coop_crate` | 32, 18 | 0 | | |
| `notice_board` | 29, 18 | 0 | | |
| `bell_post` | 36, 19 | 0 | | |
| `bench` du quai | 39, 19, 2x1 | 0 | | |
| `water_barrel` | 12, 26 | 0 | | |
| `pontoon` | 44, 37, 2x3 | 0 | | sol franchissable sur l'eau |
| `level_crossing_gate` | (16, 11) et (20, 15) | 1 et 3 | | |

Décor: lampadaires, bancs de la place et de la berge, tonneaux, boîte aux lettres, panneau « Aubrune » (facultatif), tas de bois, clôture du jardin, 79 buissons, 12 rochers, 51 arbres (dont 12 à couper). Le détail est dans le fichier.

### Points

| Point | x, y | Rôle |
|---|---|---|
| `train_stop` | 38,5 ; 17,5 | porte de la voiture: Firmin attend le train, rendez-vous du samedi |
| `spawn_1`, `spawn_2` | 37,5 et 39,5 ; 15,5 | apparition des deux joueurs en descendant du train |
| `quay_bell` | 29,5 ; 17,5 | Firmin au nord de la cloche (cloche en x 29,5, hors de la marquise, gauntlet tour 5); rassemblement de la fin |
| `quay_bench` | 33,0 ; 18,5 | le banc du quai (entre deux poteaux de la marquise, 3,5 m à l'est de la cloche), Jeanne le matin |
| `bell_shadow_spot` | 34,7 ; 19,8 | derrière le bout est du banc, dans l'herbe: on y bêche pour l'énigme |
| `coop_crate` | 35,5 ; 18,5 | la caisse de la coopérative, sous la marquise |
| `notice_board` | 41,5 ; 18,5 | le tableau: commande, catalogue, courrier, sous la marquise |
| `house_door` | 8,5 ; 27,5 | devant la porte de la maisonnette: toit et porte à construire |
| `house_spawn` | 8,5 ; 24,5 | dans la pièce: retour de minuit |
| `house_attic` | 8,5 ; 23,0 | le grenier: la boîte en fer |
| `house_beam_spot` | 13,5 ; 24,5 | où poser la poutre, contre le pignon est |
| `beam_pickup` | 14,5 ; 18,5 | la poutre et Basile au jour 1 |
| `water_barrel` | 12,5 ; 26,5 | le tonneau: remplir l'arrosoir |
| `chicken_coop` | 15,5 ; 31,5 | devant le poulailler |
| `hen_feeder` | 13,5 ; 31,5 | la mangeoire |
| `village_square` | 38,5 ; 30,5 | la place, Jeanne le soir |
| `well` | 40,0 ; 28,0 | le puits (on agit depuis une case qui le touche) |
| `grocery_counter` | 30,5 ; 26,5 | Odette derrière son comptoir, ouvert sur la place (portée 2,5 m) |
| `grocery_door` | 31,5 ; 30,5 | devant la porte d'Odette |
| `grocery_terrace` | 33,5 ; 29,0 | la tonnelle du souper de bienvenue |
| `firmin_house` | 44,5 ; 8,5 | devant la porte de Firmin |
| `sawmill_yard` | 9,5 ; 10,5 | la cour de la scierie, Basile chez lui |
| `sawmill_workbench` | 13,0 ; 9,5 | devant l'établi |
| `handcar_shed` | 56,5 ; 9,5 | devant la remise |
| `riverbank` | 28,0 ; 37,5 | la berge devant le banc: Jeanne l'après-midi, regarder la rivière |
| `river_ford` | 18,5 ; 40,5 | le gué (pêche en P1) |
| `fishing_ford_north`, `fishing_ford_south`, `fishing_pontoon` | 21,5 ; 37,5, puis 15,5 ; 43,5, puis 45,0 ; 39,5 | autres coins de pêche (P1), tous à moins de 6 m d'eau profonde |
| `forage_edge_01` à `forage_edge_05` | y 9,5, de x 19,5 à 38,5 | cueillette au bord du bois |
| `station_door`, `sawmill_door`, `level_crossing`, `mailbox` | | repères secondaires |
| `village_exit` | 61,5 ; 34,5 | bout de la promenade: un habitant « hors carte » (`offstage`) y entre et disparaît |

### Zones

| Zone | Rectangle (x, y, l, h) | Rôle |
|---|---|---|
| `garden` | 7, 28, 4x3 | les 12 cases du potager; ordre des cases: ligne par ligne, d'ouest en est, du nord au sud |
| `house_interior` | 6, 22, 5x4 | la pièce de la maisonnette |
| `forest_edge` | 15, 3, 25x8 | la lisière et ses 12 arbres à couper, et eux seuls |
| `quay`, `square`, `river`, `river_ford_area`, `meadow`, `level_crossing_area` | | le quai, la place, la rivière, le gué, le pré, le passage à niveau |
| `hen_pen` | 13, 31, 4x4 | où les poules picorent |
| `train_at_platform` | 23, 12, 27x3 | les cases du train à quai, infranchissables le samedi de 10 h à 16 h (train de 27 m au plus) |
| `house_plan_reserved`, `garden_extension_reserved` | 2, 15, 14x12 et 2, 28, 12x8 | réserves du jeu complet |

Meubles déjà posés (`maison.mobilier_depart`, d'après `objets.json`): deux paillasses côte à côte au nord-ouest de la pièce (la place du futur lit double), le réchaud au nord-est, le coffre au sud-ouest. L'entrée et le centre de la pièce restent libres pour la table et les chaises.

### Habitants

`habitants.json` fait foi pour les heures; la carte dit où, et par quel chemin.

| Habitant | Matin | Midi | Soir | Cas particuliers | Trajets |
|---|---|---|---|---|---|
| Firmin | `quay_bell` | `quay_bell` | `firmin_house` | jours 1 et 8: `train_stop` | maison, traversée de service au bout du quai, quai |
| Odette | `grocery_counter` | `grocery_counter` | `grocery_door` | jour 5 à 19 h: `grocery_terrace` | entre la porte, le comptoir et la tonnelle, le long de sa façade |
| Basile | `sawmill_workbench` | `sawmill_workbench` | `sawmill_yard` | jour 1: `beam_pickup`; jour 8: `train_stop` | cour et établi; jour 1 par-dessus la voie; jour 8 par le passage à niveau et le quai |
| Jeanne | `quay_bench` | `riverbank` | `village_square` | absente les jours 1 et 2 | elle arrive par la promenade de l'est (`village_exit`), va au banc du quai, descend à la berge, remonte sur la place, repart par la promenade |

## 8. Caméra isométrique

Règle de composition: ce qui est haut (bois, scierie, maison de Firmin, épicerie, halte) est au nord et à l'ouest des lieux importants, puisque la caméra par défaut regarde vers le nord-ouest et que tout volume cache ce qui est derrière lui dans cette direction. Le premier plan (rivière, rive sud, pré) reste bas: buissons et rochers seulement.

Contrôle (`valider_carte.py`, section 7): rayon du buste d'un personnage (1 m de haut) vers la caméra orthographique à 35,264 degrés, contre des volumes pleins jusqu'au faîte (prudent: un vrai toit est plus bas aux égouts); houppiers des arbres comptés comme des cubes; poteaux, lampadaires et troncs de moins de 0,6 m ignorés.

Résultat: les 31 lieux importants sont tous visibles depuis l'orientation par défaut, et chacun depuis au moins une autre orientation; les deux places d'apparition (vues au moment de l'arrivée seulement) et les 12 cases du potager sont visibles depuis l'orientation par défaut. Ce qui reste caché dans les autres orientations est attendu:

- vers le sud-ouest, l'épicerie masque le groupe du quai (caisse, tableau, cloche): on le revoit depuis les deux orientations du nord;
- vers le nord, la maisonnette masque son potager, et la lisière masque ses cueillettes: on les voit depuis les deux orientations du sud;
- le samedi, le train à quai masque, depuis le sud-est, le bord de la lisière derrière lui (quatre coins de cueillette): avertissement seulement, le samedi n'est pas un jour de cueillette.

Part des cases franchissables où un personnage est caché par un volume: 24 % depuis le sud-est, 22 % depuis le sud-ouest, 43 % depuis chacune des orientations du nord (surtout dans le bois et derrière l'épicerie). **Le rendu doit donc rendre transparents, ou découper, le bâtiment, l'arbre ou le train qui cache un personnage**; la carte garantit seulement qu'aucun lieu utile n'en dépend depuis la caméra par défaut.

## 9. Format du fichier, pour le développeur

`halte.json`, clés principales:

| Clé | Contenu |
|---|---|
| `taille` | `largeur` 64, `hauteur` 48, `bord` 2 (anneau infranchissable) |
| `conventions` | unités, axes (x vers l'est, y vers le sud; Three.js: y du monde vers +Z), cases, rotation (`rotation.y = rotation x PI/2` pour un modèle dont la porte regarde +Z; `facing = PI/2 - rotation x PI/2` pour un point) |
| `terrain` | `legende` (code, nom, `sol` au sens de `GroundKind`, franchissable, bruit de pas) et `lignes` (48 chaînes de 64 codes) |
| `types` | catalogue des objets: catégorie, emprise à la rotation 0, hauteur, ouvertures, pièce jouable, volumes d'occultation |
| `objets` | `id`, `type` (nom du modèle), `x`, `y` (centre), `rotation`, `rect` (emprise en cases); `coupable: true` pour les 12 arbres de la lisière |
| `points` | liste d'objets avec `id`, `x`, `y`, `role`, et selon le cas `objet`, `portee`, `rayon`, `rotation`, `interieur` |
| `zones` | liste d'objets avec `id`, `rect` (un seul rectangle par zone, comme `GameMap.zones`) |
| `maison` | objet, pièce, case de la porte, point de retour de minuit, meubles de départ (`item`, `cx`, `cy`, `rotation`, `cx` et `cy` étant la case nord-ouest du meuble) |
| `habitants`, `trajets` | emplacements matin, midi, soir, et chemins en lignes brisées (`par`, en mètres) |
| `infranchissable` | règles et `grille` (48 chaînes: `#` bloqué, `.` libre), recalculée et comparée par le validateur |
| `trajets_cles`, `portage`, `sorties` | ce que contrôle le validateur; sorties toutes fermées dans la démo |

Correspondance avec `GameMap` (`src/etat/carte.ts`): `ground` vient de `terrain.legende[code].sol`, `blocked` de `infranchissable.grille`, `points` de la liste des points (`x`, `y`), `zones` de la liste des zones, `house` de la clé `maison` (pièce = zone `house_interior`, porte = `maison.porte`, retour = point `house_spawn`), `garden` des cases de la zone `garden` dans l'ordre ci-dessus, `trees` des objets `tree_oak` et `tree_fir` (genre `oak` ou `fir`), `props` des autres objets (`model` = `type`, `pos` = `x`, `y`, `rect`). Le samedi de 10 h à 16 h, ajouter la zone `train_at_platform` aux cases bloquées.

## 10. Progression

La démo n'a qu'une zone; la progression se fait par les lieux qu'on découvre.

| Jour | Lieu introduit | Nouveauté | Difficulté (1 à 5) | Durée de jeu estimée |
|---|---|---|---|---|
| 1 | quai, maisonnette, épicerie | marcher, parler, porter à deux, construire | 1 | 11 min (création des personnages et scène d'arrivée comprises) |
| 2 | potager, puits | bêcher, semer, arroser | 1 | 7 min |
| 3 | lisière, scierie, poulailler | couper, scier, réparer | 1 | 7 min |
| 4 à 6 | place, tonnelle, tableau | vendre, souper chez Odette, catalogue à deux | 1 | 7 min par jour |
| 7 | cloche et banc | observer l'ombre, bêcher au bon endroit | 2 | 7 min |
| 8 | quai, remise | caisse, départ du train, suite annoncée | 1 | 7 à 8 min, fin comprise |

Durées estimées avec les hypothèses de la simulation de `demo.md` (dehors de 6 h à 19 h 30 en 4,7 min, veillée, dialogues, petit-déjeuner; 63 min au total).

## 11. Écarts avec les places indicatives de `demo.md`, et décisions

- **Bois au nord de la voie** (au lieu du coin sud-est): avec la caméra au sud-est, des grands arbres au sud-est auraient caché la scierie et le pré; au nord, ils font le fond de l'image. La scierie suit le bois, au nord-ouest.
- **Halte au bout est du quai, en ligne**: au sud du quai, elle l'aurait caché. Le quai fait 30 m (emprise des modèles) au lieu des 16 m indicatifs.
- **Épicerie à l'ouest de la place, façade à l'est**: tournée vers l'ouest comme dans les places indicatives, sa façade aurait été cachée depuis la caméra par défaut.
- **Maison de Firmin en face du quai, de l'autre côté de la voie**, et non entre la maisonnette et la halte, où passe la route du gué.
- **Potager de 12 cases (4x3)**, comme la démo et `reglages.json`; le rectangle de 6x4 du cahier et les 96 cases sont des réserves.
- **Puits** au centre de la place, à la place de la fontaine (même emprise de 2x2).
- **Lucie** n'a pas de maison sur la carte: elle est absente de la démo.
- **Ballast franchissable** partout: on traverse la voie où l'on veut, sauf sous le train à quai. Les chemins montrent quand même les deux traversées.

## 12. À aligner avec les autres membres

- **artiste-3d** (par le manager): noms des types et emprises (section 7), hauteurs au faîte retenues pour le contrôle de la caméra (halte 7 m, épicerie 8,5 m, scierie 7,5 m, maison de Firmin 6 m, maisonnette 5,5 m, remise 4,5 m, chêne 8 m, sapin 9 m), ouvertures décalées depuis la gauche de la façade vue de dehors (halte 4, maisonnette 3, épicerie porte 2 et comptoir 6, Firmin 3, scierie 5, remise 2, poulailler 1), murs d'une case autour de la pièce de 5x4 de la maisonnette. Types de décor ajoutés: `bell_post`, `notice_board`, `coop_crate`, `bench`, `arbor`, `workbench`, `log_pile`, `water_barrel`, `mailbox`, `lamp_post`, `level_crossing_gate`, `station_sign` (facultatif), `barrel`, `bush`, `rock`, `fence`, `pontoon`.
- **Développeur du jeu**: lecture du format (section 9), cases bloquées par le train le samedi, transparence des volumes qui cachent un personnage.
- **tech-artist**: l'énigme veut qu'entre 17 h et 17 h 30, par soleil, l'ombre de la cloche (poteau de 3 m) touche le banc posé 3,5 m à l'est (2 m entre le poteau et le bout du banc): le soleil doit alors venir de l'ouest.

## 13. Outils et vérifications

```text
python3 games/la-petite-ligne/outils/construire_carte_halte.py   # écrit halte.json
python3 games/la-petite-ligne/outils/valider_carte.py            # contrôles, code 1 en cas d'erreur
python3 games/la-petite-ligne/outils/apercu_carte.py             # aperçus PNG (rsvg-convert)
python3 games/la-petite-ligne/outils/valider_donnees.py          # données du jeu, points de la carte compris
```

La carte se retouche dans `construire_carte_halte.py`, jamais à la main dans le JSON: la grille `infranchissable` et les rectangles des objets en dépendent, et le validateur refuse un fichier incohérent. Le validateur a été éprouvé sur quinze cartes cassées exprès (porte bloquée, point dans l'eau, chevauchement, poche isolée, point enclos, trajet trop long, lieu caché à la caméra, point attendu absent, potager occupé, treizième arbre dans la lisière, couloir de portage trop étroit, pêche loin de l'eau, trajet d'habitant bloqué, tiret long, grille périmée): les quinze défauts sont signalés.

Pas encore vérifié: la carte vue dans le jeu (capture Playwright), dès que le rendu la charge.

# ADR 0016: Intérieurs sur la carte et carte élargie (La Petite Ligne, tour 10)

| Champ | Valeur |
|---|---|
| Statut | acceptée (2026-11-01, par le manager) |
| Date | 2026-11-01 |
| Rédacteur | architecte-technique |
| À relire par | dev-gameplay-3d (simulation et rendu), dev-reseau (portes et prédiction de l'invité), level-designer (format des intérieurs), tech-artist (lumières de sol, budgets), qa-testeur (T10-04, T10-12) |
| Jeu | `games/la-petite-ligne`, cahier `docs/jeux/jeu-1/cahier-des-charges.md`, conception `docs/jeux/jeu-1/tour-10-conception.md` (sections 1.3, 1.6, 7.2, 10 et 11) |
| Liens | ADR 0005 (contrat des jeux, boucle à pas fixe), 0007 (l'hôte fait autorité, état complet répliqué), 0009 (sauvegardes) |

Premier ADR propre à un jeu: il est rangé ici, avec ceux de la plateforme, parce qu'il fixe une règle que les jeux suivants reprendront (un intérieur tient dans son bâtiment, sur la même carte) et parce qu'il n'existe pas encore de dossier de décisions par jeu.

## Contexte

Le tour 10 élargit la carte de la Halte de 64 x 48 m à 100 x 48 m (la rue Haute, à l'est du ru de la Côte) et ouvre deux intérieurs: l'épicerie-pension d'Odette et la mercerie-coiffure de Solange. Le client a tranché le 2026-11-01 que les bâtiments visitables passent avant les extérieurs: après ce tour viennent la halte, le fournil, l'école, la scierie, puis le moulin. Il y aura donc une dizaine d'intérieurs, et les deux joueurs seront souvent à deux endroits différents (l'un au salon, l'autre au fournil).

Ce qui existe (branche `claude/stoic-lamport-lueey2` à `115120b`):

- Un seul intérieur, la maisonnette: `GameMap.house` (`src/etat/carte.ts`: une pièce `room`, une porte, un point de retour), un booléen `Character.inHouse` (`src/etat/types.ts`) recalculé à chaque pas par `updateInside` (`src/simulation/deplacement.ts`), lu par une quarantaine d'endroits (simulation, robots, rendu, audio, interface).
- La coupe: `StagedBuilding` de `src/rendu/maison.ts` (piloté par `HousePart`) retire le toit et les murs qui regardent la caméra (`WALL_FACES_CAMERA`) quand le joueur **local** est dedans; chez l'autre, le bâtiment reste entier. Les pièces fixes sont fusionnées en un appel tant que rien n'est coupé. Les meubles ne sont dessinés que toit ouvert (`roofed`). Une lampe `PointLight` et une lumière de sol `hearth` éclairent la pièce. Côté son, `inHouse` du joueur local étouffe le dehors (`src/audio/moteur.ts`, `updateInterior`).
- Le modèle de la maisonnette porte déjà ses métadonnées d'intérieur (`assets-src/modeles/bourg.py`: `footprint`, `door_cell`, `cut_walls`, `interior`).
- Réseau (ADR 0007): l'hôte simule tout et envoie l'état complet au plus cinq fois par seconde; la carte ne passe jamais sur le réseau (chaque machine la lit dans ses fichiers). Borne de l'état: 52 000 octets à chaque aube (I-06, tour 9).
- Budgets du PC de référence (Intel UHD 620, 1366 x 768): 225 000 triangles passe d'ombre comprise, 150 appels de dessin, 12 programmes (11 utilisés). La caméra montre au plus 36 m de large (`viewWidths` 16, 24, 36).

Deux questions sont posées (conception, section 11): les intérieurs sur la carte ou en scènes à part, et le coût de rendu de la carte élargie.

## Options pour les intérieurs

### A. Sur la carte, à leur place, coupe des murs pour le joueur local (la règle de la maisonnette, généralisée)

Chaque bâtiment visitable garde son intérieur dans son emprise, sur la même grille. On entre en passant la porte; chez le joueur qui est dedans, le toit, l'étage et les murs côté caméra s'effacent.

- Pour: aucun chargement ni changement de scène; une seule grille, un seul A*, un seul monde pour la simulation, l'hôte et la prédiction de l'invité; distances vraies (retrouvailles à 30 m, Cœur à 8 m, sons spatialisés), habitants qui entrent et sortent à pied par la porte, l'autre joueur voit où l'on va (conception 1.6); un intérieur ne peut pas être plus grand que son bâtiment, ce qui sert directement la règle de cohérence du monde du client; le code existe (maisonnette) et se généralise.
- Contre: un intérieur est petit (5 x 5 m pour la mercerie, 6 x 5 m pour la boutique d'Odette): le contenu doit tenir dans l'emprise, et la caméra isométrique doit le montrer (zoom 1 ou 0, mur côté caméra coupé); un étage visitable demande une coupe par niveau (pas avant l'école); tout intérieur est dans la scène de rendu, donc il faut le masquer quand personne n'y est.

### B. Scènes à part (un « lieu » par intérieur, chargé en passant la porte)

- Pour: taille libre, cadrage dédié, éclairage propre, rien à couper.
- Contre: la simulation doit de toute façon faire vivre tous les lieux à la fois (les habitants suivent leurs emplois du temps, l'hôte fait autorité sur les deux joueurs): on ajoute un champ `location` à chaque personnage et à chaque habitant, une grille et un A* par lieu, des portails entre grilles, des trajets d'habitants qui changent de grille; les distances entre deux lieux n'ont plus de sens (retrouvailles, Cœur, sons de l'autre); chaque machine doit construire et garder deux scènes de rendu quand les joueurs sont à deux endroits (ou recharger à chaque porte), avec des matériaux et des programmes de plus, donc un risque direct sur le budget de 12 programmes et sur le temps de compilation des nuanceurs du PC de référence; un fondu ou un écran de chargement casse « l'autre voit où l'on va »; un intérieur plus grand que sa façade contredit la règle de cohérence du monde.

### C. Hybride: sur la carte, mais avec une caméra dédiée à l'intérieur (cadrage serré, rotation bloquée)

- Pour: même simulation que A, cadrage plus lisible des petites pièces.
- Contre: un deuxième comportement de caméra à régler et à tester, et une rupture visuelle à chaque porte. Rien dans la conception ne le demande: on le garde en réserve si les captures des petits intérieurs le montrent nécessaire.

## Décision pour les intérieurs

**Option A**, avec ces règles.

### 1. Données de la carte (contrat entre level designer, simulation et rendu)

- La carte décrit une liste de **bâtiments visitables** (`interieurs` dans `halte.json`, `GameMap.buildings: Record<BuildingId, MapBuilding>` après lecture), un par bâtiment: `id`, objet de la carte qui le porte (`objet`), une ou plusieurs **pièces** (rectangles de cases franchissables, dans l'emprise et à l'intérieur des murs), ses **portes** (case franchissable sur le pourtour, du côté de la façade), un point d'apparition, l'identifiant de ses **heures** (clé de `reglages.json`, absente pour la maisonnette) et l'identifiant de son **ambiance sonore**.
- La maisonnette devient le bâtiment `house`; ses pièces bâties à deux (cellier, chambre, conception section 4) sont des pièces de plus du même bâtiment, actives seulement une fois bâties. `GameMap.house` reste, lu depuis `buildings.house`, le temps de migrer ses lecteurs.
- `valider_carte.py` contrôle: pièces dans l'emprise et hors des murs, porte sur le pourtour et devant une case libre du dehors, au moins une case entre deux bâtiments visitables, aucune pièce partagée entre deux bâtiments.

### 2. Simulation

- `Character.inside: BuildingId | null` remplace la lecture du booléen: `updateInside` cherche la pièce qui contient le personnage (au plus une dizaine de rectangles, une fois par pas et par personnage). `inHouse` devient une fonction `inHouse(c) = c.inside === 'house'` (et non plus un champ), migrée lecteur par lecteur; les règles qui voulaient dire « à l'abri » (pluie, moments rares, poules, bancs, lisière) lisent `inside !== null`, celles qui voulaient dire « chez soi » (aménagement, coucher, minuit, sieste) lisent `inside === 'house'`. Le dev simulation fait ce tri cas par cas: c'est le cœur du risque de régression.
- **Portes fermées**: une porte hors des heures est une case bloquée de la couche dynamique (`refreshBlockers`), recalculée quand l'heure franchit un bord; la règle est déterministe (horloge du monde), donc identique chez l'hôte et dans la prédiction de l'invité. Un joueur déjà dedans à la fermeture n'est jamais déplacé (conception 1.6): la porte reste franchissable vers le dehors pour lui (sortie toujours permise).
- **Porter à deux**: une case de porte refuse le passage de la charge (`portages.ts`), avec le message `no_door_carry`.
- Habitants: ils entrent et sortent par les portes comme les joueurs (`inside` aussi, pour le son et l'interface); `absent` garde son sens (« chez lui », hors de la carte jouée).
- État: `inside` coûte une courte chaîne par personnage (quelques dizaines d'octets pour 8 personnages), sans rapport avec la borne de 52 000 octets. Rien de la géométrie des intérieurs ne passe sur le réseau.

### 3. Rendu

- `StagedBuilding` sort de `maison.ts` dans un module `src/rendu/interieurs.ts`, une instance par bâtiment visitable, avec la coupe telle qu'elle est (toit, étage, murs qui regardent la caméra), la fusion des pièces fixes en un appel tant que rien n'est coupé, et le retour aux pièces séparées pour **le seul bâtiment** où se trouve le joueur local.
- **Contenu masqué**: tout ce qui est dedans (meubles, rayonnages, fauteuil, bocaux) est dans un groupe `visible = false` tant que le joueur local n'est pas dans ce bâtiment. Hors de l'intérieur où l'on est, un intérieur ne coûte donc ni triangle, ni appel, ni ombre. Le joueur local n'est jamais dans deux bâtiments: au pire une seule pièce ouverte à l'écran.
- **L'autre joueur dans un autre bâtiment**: chez moi son bâtiment reste entier et son personnage est caché par les murs; l'interface dit où il est (`places` de `modele.ts`, nom du bâtiment au lieu de `house_interior`), et je l'entends étouffé. La silhouette à travers les murs n'est pas demandée à ce tour.
- **Lumière intérieure**: aucune `PointLight` de plus. Le nombre de lumières ponctuelles entre dans la clé des programmes de Three.js: en ajouter une recompile tous les matériaux éclairés et fait sortir du budget de 12 programmes. La lampe actuelle de la maisonnette devient **une lampe unique**, déplacée dans le bâtiment où se trouve le joueur local (intensité et couleur par bâtiment); quand il n'est dans aucun autre intérieur, elle reste à la maisonnette, comme aujourd'hui. Elle n'est jamais retirée de la scène (une lampe d'intensité nulle compte encore dans la clé des programmes, ce qui la garde stable). Le reste passe par les lumières de sol existantes (`glow`, 12 emplacements, 6 en mode léger): un type `interior` par pièce, prioritaire quand le joueur local est dedans, comme `hearth` aujourd'hui.
- **Caméra**: inchangée (même isométrie, mêmes zooms et orientations). En entrant dans un intérieur de moins de 6 m, la caméra peut proposer le zoom 1 sans l'imposer; à décider sur captures (option C en réserve).
- **Occlusion du dehors**: un bâtiment au sud de celui où l'on est peut cacher la pièce ouverte en orientation 0; la règle de placement de la conception (bâtiments bas au sud des rues, faîtage à 5 m au plus) et les lignes de vue de `moments_tour7_geometrie.py` s'appliquent aussi depuis l'intérieur.

### 4. Audio

`listener.inHouse` devient `listener.inside: BuildingId | null`: le filtre du dehors s'applique à tout intérieur, l'ambiance (`room-tone-shop`, `room-tone-salon`) se choisit par bâtiment, et les pas d'intérieur suivent `inside !== null`.

## Coût de la carte de 100 m

### Prototype de mesure (2026-11-01, hors du dépôt)

Dossier `/tmp/archi-t10/` (non versionné): un greffon Vite élargit `halte.json` **au moment où il est servi** (rien n'est modifié dans le dépôt). Le jeu de production, lui, est inchangé et lit la carte élargie sans erreur (`loadMap` renvoie `source: 'level'`).

- Carte **L** (« large », pire cas): la bande x 26 à 61 du bourg recopiée en x 62 à 97, avec 99 objets (une seconde halte, la maison de Firmin, la remise, le puits, la tonnelle, 29 arbres, 44 buissons, bancs, lampadaires). C'est plus dense que la rue Haute prévue (quatre bâtiments, l'école, quatre arbres): une borne haute.
- Carte **N** (« nue »): mêmes 100 m, sol seul, aucun objet: ce que coûte la surface seule.
- Mesure: `rendu.html` de la branche à `115120b`, 1366 x 768, `vie=0`, 19 h (ombres), `lplRendu.triangleSplit()` (passe d'ombre comprise), `programsInUse()`, Chromium et SwiftShader; scripts `mesure.cjs`, `ecart.cjs` (écart par maillage), `parts.cjs`.

| Vue | Carte 64 | Carte N (100, nue) | Carte L (100, dense) |
|---|---|---|---|
| Place, zoom 2, orientation 0 | 192 402 tri., 116 appels | 196 960, 111 | 211 388, 113 |
| Place, zoom 2, orientation 2 (la pire connue) | 201 830, 127 | 207 178, 123 | **227 148**, 126 |
| Pont de la rue (63,5 ; 21,5), zoom 2, orientations 0 à 3 | | 150 608, 81 (o0) | 213 682 / 214 152 / 218 358 / 206 834; 95 à 102 appels |
| Rue Haute (77 ; 24), zoom 2 et zoom 1 | | | 186 656, 80; 165 788, 61 |
| Pont, mode léger | | | 101 896, 55 (7 programmes) |
| Maisonnette ouverte, zoom 1, 21 h | 132 056, 111 | | 146 004, 112 |

Programmes: 11 en cache partout (10 au zoom 1 de la rue Haute), aucun de plus avec la carte élargie.

### Lecture

- **Ce qui coûte, c'est la vue, pas la carte**: la caméra montre au plus 36 m de large; la région est, vue de près, coûte comme le bourg (207 000 à 218 000 triangles pour un second bourg entier). Ni niveaux de détail (la caméra isométrique est toujours à la même distance: un niveau de détail ne servirait jamais), ni chargement par zones (toute la géométrie de la carte L tient en 251 000 triangles en mémoire, 72 géométries), ni « mode léger au-delà de 40 m » (conception 1.3: au-delà de 40 m, rien n'est à l'écran).
- **Mais une partie du coût fuit hors de la vue**, et grandit avec la carte. Écart par maillage, place orientation 2, carte N contre carte L (le contenu ajouté commence 23 m à l'est du point suivi): +7 000 triangles dans la passe principale et +11 300 dans la passe d'ombre pour le décor fusionné (un bloc de petits morceaux regroupés couvre 24 m, `chunkMergeBlock`, et se dessine en entier dès qu'un de ses morceaux est visible; la passe d'ombre prend des morceaux entiers), +3 500 pour les arbres de la lisière (`arbres de la lisiere`, jamais éliminés: leurs 4 604 triangles passent dans la passe d'ombre même depuis l'intérieur de la maisonnette au zoom 1). Entre la carte 64 et la carte N, la surface seule ajoute environ 5 000 triangles: sol et eau d'un seul tenant (`terrain/sol`, `terrain/eau`, +3 000) et semis de touffes, fleurs et galets dessinés sur toute la carte (+1 000 à +4 500 selon le zoom).
- **Conséquence**: la vue la plus chargée de la place passe de 201 830 à 227 148 triangles, au-dessus du budget de 225 000, alors qu'on n'y voit rien de nouveau. Les appels restent sous 150 (127 au plus). Le budget n'est pas tenu en l'état; il l'est dès que le coût suit la vue.

### Décision pour le rendu de la carte élargie

1. **Tout ce qui couvre la carte se découpe et s'élimine hors du cadre**, comme le lit de la rivière et la forêt du pourtour le font déjà: sol et eau du terrain en morceaux de 12 m; semis (touffes, fleurs, galets) répartis par morceaux; arbres de la lisière par tronçons. Règle durable: aucun maillage dont la taille croît avec la carte n'est dessiné d'un seul tenant. Les étapes 3 et 4 du monde (amont, bois de la Côte) n'auront alors aucun coût hors de leur vue.
2. **Regroupement des petits morceaux limité à ce qui est proche de la vue**: régler `chunkMergeBelow` ou `chunkMergeBlock` pour qu'un bloc regroupé ne déborde pas de plus de 12 m du cadre; vérifier que la passe d'ombre élimine par morceau (tri de `ombre-tri.ts`). La mesure du tour 5 dit l'échange: moins de triangles contre une dizaine d'appels de plus; la marge d'appels le permet (127 au pire pour 150).
3. **Intérieurs**: contenu masqué hors de l'intérieur où l'on est (section 3 ci-dessus); pièces fixes et mobilier fixe d'un intérieur fusionnés avec le bâtiment, une seule fois coupés quand on y entre.
4. **Cible de mesure du tour 10** (T10-04): sur la vraie carte, vues sans habitants à l'écran au plus **205 000 triangles et 135 appels**, ce qui garde 20 000 triangles et 15 appels pour les six habitants, les deux joueurs et les effets de T10-04. Vues imposées: place orientation 2 au zoom 2; pont de la rue, quatre orientations au zoom 2; rue Haute zoom 1 et 2; mercerie ouverte zoom 1; épicerie ouverte zoom 1; maisonnette avec cellier et chambre bâtis, orientation 3 au zoom 2. Programmes: 11 au plus, mesure de `programsInUse()` après être entré dans chaque intérieur.
5. **Simulation**: aucune mesure à prendre. A* de `grille.ts` sur les cartes N et L, depuis la porte de la maisonnette vers six points de l'est: 1 156 nœuds au plus (carte N; 1 063 sur la carte L) (limite actuelle `maxNodes` 4 000), 1 ms de processeur au plus par appel dans Node (`process.cpuUsage`, 50 appels). Un but inatteignable (porte fermée) plafonne à 4 000 nœuds, quelques millisecondes: acceptable, mais les robots et habitants ne doivent pas viser une porte fermée en boucle.

## Conséquences

- Ajouter un intérieur coûte: un bâtiment modélisé avec ses métadonnées (`interior`, `cut_walls`, pièces et portes), une entrée `interieurs` dans la carte, ses heures dans `reglages.json`, son ambiance; aucun code nouveau au-delà du contenu (comptoirs, panneaux).
- Un intérieur tient dans sa façade. Une pièce plus grande que le bâtiment n'est pas possible: c'est voulu.
- Le premier étage visitable (archives de l'école, chambres de la pension) demandera une coupe par niveau et une hauteur de sol par pièce: nouvel ADR à ce moment-là, pas avant.
- `inHouse` disparaît comme champ: format de sauvegarde 7 (déjà prévu par la conception, 7.2), migration qui recalcule `inside` à partir de la position.
- Le découpage des tâches est dans `docs/jeux/jeu-1/tour-10-conception.md`, section 13.

## À vérifier

- Sur le PC de la compagne: tenue des budgets au pont de la rue et dans la mercerie ouverte (T10-04), à lire dans l'affichage des performances et le rapport de diagnostic (ADR 0015).
- Lisibilité des intérieurs de 5 x 5 m au zoom 1 et 2 à 1366 x 768: captures du dev rendu au premier jalon.
- Prédiction de l'invité devant une porte qui ferme pendant qu'il la passe: test à deux contextes (T10-12).

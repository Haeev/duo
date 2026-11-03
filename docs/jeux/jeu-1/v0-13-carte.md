# La Petite Ligne 0.13: le village agrandi (conception de la carte)

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne |
| Statut | lot L1 produit (section 17): carte agrandie écrite par `construire_carte_halte.py --0.13` dans `games/la-petite-ligne/donnees/cartes-0-13/halte.json`, en attente du lot L0 (le jeu ne lit pas encore l'origine de grille); `halte.json` inchangé |
| Version du document | 1 |
| Date | 2026-11-03 |
| Rédaction | level-designer, sur brief du manager (demande du client: agrandir le village; église, cimetière, forêt explorable, habitations, lieux de métiers, plus de cultures et de récoltes; une vingtaine d'habitants) |
| Point de départ | branche `claude/stoic-lamport-lueey2` (carte du tour 10: 100 x 48 m) |
| Sources | `carte-halte.md` (version 0.3), ADR 0016 (intérieurs sur la carte, budgets, découpage par morceaux), `tour-10-conception.md` (étapes du monde, section 1.2), `v0-12-conception.md` (chèvre, marché, halle), `cahier-des-charges.md` (FE-01, FE-07, FE-08, enveloppe 120 x 90 m de la Halte) |
| Habitants | `v0-13-habitants.md` (game designer, en parallèle) n'existait pas encore à la rédaction: les identifiants des lieux sont proposés ici (section 7.3) et seront alignés par le manager |
| Maquette | `docs/jeux/jeu-1/simulations/v0_13_carte_maquette.py` (bibliothèque standard, 1 s): pose la carte actuelle dans la grille élargie, dessine les régions de ce document, sème la forêt, puis calcule distances, lignes de vue, nœuds d'A* et triangles par vue. Toutes les mesures de ce document en sortent |
| Plan | `docs/jeux/jeu-1/captures/apercu/v0-13-plan.png` (vue de dessus de la maquette, lieux importants en blanc, secrets en rose, carte actuelle en tirets rouges) |

## En bref

- **La carte passe de 100 x 48 m à 164 x 78 m** (2,7 fois la surface): 24 m de plus à l'ouest (l'amont de l'Aubrune), 30 m au nord (le coteau et son bois), 40 m à l'est (la route des hameaux jusqu'au hameau). La rive sud ne bouge pas.
- **Rien de ce qui existe ne change de coordonnées.** La grille gagne une origine (`taille.origine`, x -24, y -30): les régions neuves sont en x et y négatifs ou au-delà de x 99. Sauvegardes, moments, tests et données gardent leurs nombres (section 2). C'est le seul changement de code préalable, à trancher par l'architecte.
- **Les régions neuves**, chacune avec sa raison d'être: l'église Saint-Aubin au bout de la rue de l'Église, son parvis, le presbytère, le cimetière derrière le chevet; le carrefour de l'Église avec le café, la forge et la menuiserie; les jardins de la Rive (potager collectif), le lavoir, la ferme, ses champs et le verger communal; trois maisons de hameau; à l'ouest, deux maisons de cheminots, la friche à défricher et le moulin de la Vanne sur son bief; au nord, le bois de la Côte, explorable.
- **La forêt explorable**: cinq sentiers en boucles (aucune impasse hors belvédère et secrets), une clairière centrale avec le Vieux Chêne, la mare, la source du ru et son oratoire, la coupe de Basile, la maison forestière, le belvédère, deux secrets; environ 140 arbres semés (un pour 15 m² de sous-bois), cueillette, bois mort, champignons et faune placés par règles.
- **13 maisons d'habitants** en plus de celles qui existent (dont 3 logis de métier), toutes avec porte, point devant la porte et trajet mesuré.
- **Cultures**: 4 parcelles à défricher à 4 s de la maisonnette (48 cases), 4 carrés de potager collectif (70 cases), 2 champs à louer (126 cases), un verger communal de 9 arbres, la vigne du curé, les prés du Haut en réserve.
- **Caméra**: les 41 lieux importants neufs sont vus depuis la caméra par défaut et depuis au moins une autre orientation (maquette); les clairières sont allongées sur la diagonale nord-ouest et sud-est, cônes de la caméra laissés sans houppier.
- **Distances** (3,5 m/s, depuis la porte de la maisonnette): moulin 5,6 s, friche 4 s, clairière 14,5 s, source 21,7 s, café 24,1 s, jardins 25 s, église 28,6 s, cimetière 33 s, ferme 33,4 s, verger 36,8 s. Depuis la place: église 21,4 s, café 15,9 s, ferme 24,3 s.
- **Budgets**: forêt et ouest dans les clous (estimation 160 000 à 190 000 triangles); les vues de l'est du bourg (carrefour, forge, jardins) sont à la limite de 205 000 avec les plafonds de modèles proposés: à mesurer dès le blockout (section 11).
- **Lots**: L0 origine de la grille (code), L1 générateur et validateur (level designer), L2 modèles (artiste 3D), L3 rendu, L4 simulation et données, L5 recette. Critères testables en section 14.

## 1. Intention

| | |
|---|---|
| Ce que la carte enseigne | Le bourg a une vie au-delà de la maison et du quai: on va à la messe ou à la noce au bout de la rue de l'Église, au café le soir, chez le forgeron, à la ferme; on cueille et on cultive plus loin, en forêt et aux champs. Chaque lieu neuf est une raison de traverser le bourg, et chaque trajet croise des habitants. |
| Ce qu'elle met à l'épreuve | S'orienter à deux dans une forêt sous une caméra qui ne montre que 36 m (repères: le ru, le Vieux Chêne, l'oratoire, le clocher); se répartir des cultures dispersées (friche près de la maison, jardins de la Rive, champs du Haut); revenir à temps (le café ferme, la messe sonne). |
| Émotion visée | La surprise d'un monde plus grand qu'on ne croyait, sans se perdre: le clocher qu'on voit pointer au-dessus des toits, la clairière qui s'ouvre au bout du sentier, la cloche de l'angélus qui donne l'heure à tout le bourg. |
| Difficulté | 1 sur 5 dans le bourg (chemins évidents, aucune impasse); 2 sur 5 en forêt (sentiers en boucle, repères à reconnaître, deux secrets hors des sentiers). |

## 2. Décision structurante: grandir vers le nord et l'ouest sans rien déplacer

Le bois de la Côte est au nord (c'est le fond de l'image pour la caméra par défaut, qui regarde vers le nord-ouest) et l'amont de l'Aubrune à l'ouest (étapes 3 et 4 du monde, `tour-10-conception.md`, 1.2). Une forêt au sud, sur l'autre rive, aurait tourné sa lisière dos à la caméra et caché la rivière. Grandir vers le nord et l'ouest est donc juste pour le monde et pour la caméra; reste à le faire sans décaler toutes les coordonnées.

| Option | Ce qu'elle change | Coût mesuré | Risque |
|---|---|---|---|
| **A. Origine de la grille** (recommandée) | `taille.origine: { x: -24, y: -30 }`: la ligne 0 de `terrain.lignes` est la rangée y -30, le caractère 0 la colonne x -24. `GameMap` gagne `originX`, `originY`; l'indice d'une case devient `(cy - originY) * width + (cx - originX)`; les boucles `for cx = 0; cx < width` partent de `originX` | 32 calculs d'indice dans 13 fichiers de `src/` (hors tests), plus les boucles du rendu (`terrain.ts`, `vegetation.ts`, `voie.ts`, `champs.ts`, `brume.ts`, `paves.ts`), les bornes de la caméra et des contrôles de positions; les trois outils Python | Localisé: une boucle oubliée laisse un trou dans les régions neuves, visible et testable; l'existant est intact |
| B. Décalage de tout (+24, +30) | toutes les coordonnées de la carte, des données, des tests et des sauvegardes | 272 coordonnées écrites en dur dans 60 fichiers de `src/` et `tests/` (dont 42 dans la carte de secours, qui resterait telle quelle), `moments.json`, `pieces.json`, `forestClearings`, les positions des sauvegardes (personnages, habitants, poules, arbres, draisine) avec une migration de format | Diffus: touche les lots de la 0.12 en cours, et les vraies sauvegardes du client |

Test qui garde l'option A honnête: la même carte avec l'origine (0, 0) puis translatée de (-24, -30) donne la même partie (mêmes chemins d'A*, mêmes évènements, positions décalées), sur une graine. À trancher par l'architecte (avenant à l'ADR 0016), avant le lot L1.

## 3. Plan d'ensemble

Dimensions: x de -24 à 139 (164 m), y de -30 à 47 (78 m), anneau de 2 m de décor lointain inchangé, 12 792 cases dont 9 399 franchissables (toutes atteignables depuis la porte de la maisonnette, maquette). Surface: 12 800 m², soit un peu plus que l'enveloppe de 120 x 90 m du cahier (10 800 m²): à inscrire dans l'historique du cahier (question Q1).

Schéma indicatif (proportions approchées; nord en haut; abscisses des repères en tête):

```text
x:  -24        0              40           63      84            108           139
y -30 +--------------------------------------------------------------------------+
      | Maison   Belvédère              Mare    Source |Bois de la  Prés du Haut   |
      | forest.    \___ sentier des crêtes ___/  oratoire|  Cure    (pâture d'été) |
      | La coupe        Clairière du Vieux Chêne     ru |   ÉGLISE+clocher CIMETIÈRE|
      | (Basile)     BOIS DE LA CÔTE (forêt explorable) |       PARVIS   (derrière  |
      |  chemin       sentier de la Côte   sentier du ru| Presb.  |       le chevet)|
y   0 | forestier  .......................................jardin  1 vigne champs verger
      | grumes SCIERIE   lisière (12 arbres)  Firmin remise  coteau | du Haut       |
y  12 |====VOIE====PN gardé=================traversée===ru======PN Église==PN ferme=|
      | cheminots      maisonnette  quai   halte  fournil école CAFÉ|FORGE MENUIS 2 3|
y  21 |  6  7  chemin    potager   rue de la halte  pont  carrefour ...route des hameaux
      | MOULIN  friche  jardin  épicerie place pré  mercerie Lucie jardins grange logis 5
      | bief                                                     lavoir cour  pâture|
y  37 |~~~~~~~~~~~~~~~~~ gué ~~~~~~~~~~~~~~ L'AUBRUNE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~|
y  47 +--------------------------------------------------------------------------+
```

La grille complète à 1 m est en annexe A (générée par la maquette); le plan PNG est `captures/apercu/v0-13-plan.png`.

**Le récit, comme un habitant le raconterait.** Le vieux village est né sur le coteau de la Côte, au soleil et hors des crues: l'église Saint-Aubin y domine la vallée depuis bien avant le train, son cimetière derrière le chevet, le presbytère et sa vigne en contrebas. La rue de l'Église descendait jusqu'à la route des hameaux; quand on a posé la voie au pied du coteau, elle l'a coupée, d'où le passage à niveau de l'Église, sans barrière, une simple croix de Saint-André. Au carrefour où la rue rejoint la route, le café est le voisin de la mairie-école; un peu plus loin, la forge et la menuiserie travaillent sur la route, là où passent les charrettes, loin des maisons pour le bruit et le feu. Puis viennent le hameau, sa ferme tournée au midi et ses champs du Haut, de l'autre côté de la voie par le passage de la ferme. Entre la route et la rivière, les jardins de la Rive (chacun son carré) et le lavoir au bord de l'eau. À l'ouest, la compagnie du chemin de fer a bâti deux maisons de cheminots près de la maisonnette du garde-barrière; plus loin, au bout du chemin du moulin, le moulin de la Vanne tourne sur son bief. Au-dessus de tout cela, le bois de la Côte, où Basile tire ses grumes, où l'on cueille, où le ru prend sa source.

## 4. Régions et raison d'être

Coordonnées dans le repère de la carte actuelle (x vers l'est, y vers le sud), cases entières, bornes comprises.

### 4.1 L'église, le parvis, le presbytère, le cimetière

| Élément | Où | Pourquoi là, dans ce sens, à cette taille |
|---|---|---|
| La rue de l'Église | pavés x 94 à 96 (3 m), du carrefour (y 21) au parvis (y -1); passage à niveau en planches sur la voie (y 12 à 14) | Elle monte de la route des hameaux au vieux village: « au bout de la rue, l'église ». 3 m: une noce ou un cortège à deux de front, une charrette. Le portail sud est dans son axe (x 95). |
| Le passage à niveau de l'Église | x 94 à 96, y 12 à 14, code `#`; deux croix de Saint-André (y 11 et y 15, côté droit de la rue en montant et en descendant) | Une rue qui croise une ligne à faible trafic: passage non gardé, d'où la croix et non la barrière (celle du garde-barrière reste unique, à l'ouest). Le train siffle à l'approche (sound designer). |
| L'église Saint-Aubin | emprise x 85 à 105, y -17 à -6 (21 x 12); nef x 90 à 101, chœur et chevet x 102 à 105 (plus bas), clocher-porche x 85 à 89, y -15 à -9 (20 m à la pointe); portail sud en (95, -6) | Orientée comme il se doit, chœur à l'est; le portail latéral sud est celui du village, tourné vers la rue et vers la caméra par défaut. Le clocher, le plus haut volume de la carte, est à l'ouest de la nef: il ne cache que le bois de la Cure, au nord-ouest. Nef à 7 m à l'égout et 11 m au faîte (faîtage est-ouest). C'est le repère du nord-est, vu de tout l'est du bourg. Nom: écho de l'Aubrune; à confirmer (question Q4). |
| Le parvis (place de l'Église) | pavés x 84 à 106, y -5 à 0 | Assez grand pour la sortie de la messe, la noce, une fête (lampions entre le clocher et le presbytère). Le chemin de la Procession y arrive par l'ouest, la rue par le sud, l'allée du cimetière part à l'est. |
| Le presbytère | x 76 à 82, y -5 à 1 (7 x 7), deux niveaux (égout 4 m, faîte 7,5 m, faîtage nord-sud), porte à l'est en (82, -2), sur le parvis | À côté de l'église, à l'ouest du parvis: le curé sort de chez lui sur le parvis. Au sud-ouest du clocher, il n'est pas dans son ombre de caméra. |
| Le jardin du curé | x 76 à 83, y 2 à 9, potager et simples, muret | Sous les fenêtres du presbytère, plein sud, sur la pente: le jardin d'un presbytère. Il n'est pas aux joueurs (le curé peut en donner). |
| La maison du sacristain (maison 1) | x 87 à 92, y 3 à 8 (6 x 6), égout 3 m, faîte 5,5 m, porte à l'est en (92, 5) sur la rue | Le sonneur vit au pied de l'église. Côté ouest de la rue: un volume à l'est d'une rue nord-sud la cache à la caméra par défaut (carnet), un volume à l'ouest jamais. |
| La vigne du curé | x 100 à 107, y 1 à 10 (8 rangs de 9 m), haie existante en x 99 (les buissons de l'ancien bord est) | Côté est de la rue, rien de haut (rangs de 1,5 m): la rue reste vue. Sur un coteau au midi, une vigne de presbytère. Vendange d'automne avec le curé (game designer). |
| Le cimetière | x 108 à 124, y -20 à -4 (17 x 17), mur de 1,2 m, grille en (112 et 113, -4) au bout d'une allée de gravier (x 107 à 113, y -3 à -1); croix au centre, 48 tombes en rangs nord-sud, pieds à l'est | « Derrière » l'église, c'est-à-dire derrière le chevet: à l'est. Placé au nord, il aurait été caché par la nef depuis la caméra par défaut; à l'est, il est au sud-est du seul volume haut. Les tombes donnent des points d'histoire (l'ancien garde-barrière, Émile Lacombe), à confirmer par le game designer. |

### 4.2 Le carrefour de l'Église et la route des hameaux

| Élément | Où | Pourquoi |
|---|---|---|
| La placette du carrefour | pavés x 85 à 97, y 21 à 23 | Là où la rue de l'Église rejoint la route: une petite place devant le café et la mairie, la terrasse sur son bord nord. La route reste pavée jusque-là, en terre au-delà (hors du bourg). |
| Le café de la Côte | x 87 à 93, y 15 à 20, deux niveaux (égout 6 m, faîte 8,5 m), porte au sud en (90, 20); terrasse x 87 à 89, y 21 | À côté de la mairie-école, au coin de la rue de l'Église: le café de la sortie de la messe et des parties de cartes. Au nord de la route, contre la voie, il ne cache rien d'utile (il cache la voie, au nord-ouest). Salle du fond pour le bal et les banquets (le cahier prévoit un premier bal). Café plutôt qu'auberge: l'épicerie-pension d'Odette loge déjà les voyageurs. |
| La forge | x 98 à 103, y 15 à 20, un niveau (égout 3 m, faîte 5,5 m), grande porte à l'est en (103, 17 et 18), cour x 104 à 106 avec l'enclume et le travail ferré | Sur la route où passent les chevaux et les charrettes, à l'entrée du bourg, contre la voie: le bruit et le feu loin des maisons, la cheminée au nord. La cour à l'est: elle est au sud-est du bâtiment, donc vue (une cour à l'ouest serait cachée par la forge). |
| La menuiserie | x 107 à 113, y 15 à 20 (égout 3,2 m, faîte 6 m), porte à l'est en (113, 18), cour x 114 à 116 sous auvent (planches qui sèchent) | À côté de la forge (le charron a besoin des deux), même règle de cour à l'est. Le bois de Basile arrive par la voie (wagonnet du samedi) ou par la route. |
| Maisons du hameau A et B (maisons 2 et 3) | A: x 118 à 123, y 15 à 20, porte (120, 20); B: x 128 à 133, porte (130, 20); un niveau, faîte 5,5 m | Le long de la route, côté voie, porte au sud sur la route. Entre les deux, le chemin du passage de la ferme. |
| Le passage de la ferme | x 125 et 126, y 12 à 14 (planches), chemin de y 0 à y 20 | Passage à niveau privé: le fermier mène ses bêtes et sa charrette à ses champs du Haut, de l'autre côté de la voie. |
| La route des hameaux | y 21 et 22, en terre de x 98 à 139; `village_exit` déménage en (137,5 ; 21,5) | Elle continue vers les hameaux de l'est, hors de la carte. Seule sortie, comme au tour 10. |

### 4.3 Jardins, lavoir, ferme et champs

| Élément | Où | Pourquoi |
|---|---|---|
| Les jardins de la Rive (potager collectif) | x 91 à 98, y 24 à 34; allées en croix (x 94, y 29), pompe à bras au croisement (94, 29); 4 carrés (section 6) | Entre la route et la rivière, sur la terre alluviale, à côté du verger de Lucie: les jardins ouvriers d'un bourg. La haie existante (x 99) les ferme à l'est; ses trouées (y 26 et 27, y 29 et 30, y 32 et 33) laissent passer. |
| Le chemin du lavoir | x 100 et 101, y 23 à 34 | De la route au lavoir: on y va vraiment, le linge sur la brouette. |
| Le lavoir | x 99 à 103, y 35 à 37, toit à un pan bas (égout 2,4 m, faîte 3,6 m), ouvert au nord en (101, 35), bassin sur la grève | Au bord de l'Aubrune, en aval du bourg: l'eau propre de l'amont sert au moulin et au puits, le lavoir est en aval. Bas, au premier plan de la caméra: il ne cache rien. |
| La grange-étable | x 105 à 111, y 29 à 35 (égout 4,5 m, faîte 8 m), porte de l'étable à l'est en (111, 32) | La grange au-dessus de l'étable, comme dans les fermes de la vallée. À l'ouest de la cour, à 7 rangs de la route: son toit ne cache pas la route en orientation 0. |
| Le logis de la ferme (maison 4) | x 114 à 122, y 27 à 32, deux niveaux (égout 5 m, faîte 8 m), porte au sud en (118, 32) | La ferme tourne sa façade au midi et le dos à la route (comme les fermes réelles, pour le soleil): la cour est au sud-est des deux volumes hauts, donc vue de la caméra par défaut. Un jardin de fleurs (courtil) entre la route et le logis, x 114 à 122, y 23 à 26. |
| La cour de ferme | x 112 à 124, y 33 à 36, terre battue; chemin d'accès x 123 et 124 depuis la route | Fumier, pompe, charrette, poules de la ferme. Entrée par l'est: le portail ne passe pas sous les fenêtres. |
| La maison du hameau C (maison 5) | x 128 à 133, y 25 à 30, porte au nord en (130, 25) vers la route, un niveau (faîte 5 m) | La dernière maison avant les champs: tournée vers la route, en retrait de deux rangées (son égout ne cache pas la route, règle du tour 10). |
| La pâture et sa mare | x 126 à 135, y 31 à 37, mare en (131, 34) | Les vaches de la ferme, au bord de la rivière. |
| Les champs du Haut | 1: x 109 à 115; 2: x 117 à 123; y 1 à 9; chemin des Champs le long de la voie (y 10 et 11) et entre les champs (x 116) | Sur le coteau au midi, entre le cimetière et la voie: les champs du fermier, à louer au duo. |
| Le verger communal | x 127 à 135, y 0 à 8, 9 arbres en trois rangs (3 m d'écart): pommiers, poiriers, pruniers, un cerisier, un noyer | Au bout des champs, au pied des prés: le verger que le bourg partage (FE-08 appelle des fruitiers; ceux-ci sont communaux, ceux du duo restent aux Vergers). |
| Les prés du Haut | x 108 à 137, y -28 à -21 et x 127 à 137, y -20 à -1; le chemin de la ferme y monte (x 125 et 126) | La pâture d'été et la fauche: réserve pour l'étape suivante (foin pour l'hiver, v0.12 section 8). Rien de fixe à ce tour. |

### 4.4 L'ouest: cheminots, friche, moulin, parc à grumes

| Élément | Où | Pourquoi |
|---|---|---|
| Le chemin du moulin | prolonge vers l'ouest le chemin de la maisonnette (y 27) de x 2 à x -1, puis 2 m (y 27 et 28) jusqu'à x -10, et descend à la porte du moulin (x -10 et -9, y 29 à 31) | Le chemin de la maisonnette s'arrêtait au bord parce que la carte s'arrêtait. Il mène maintenant à un lieu où l'on va (le moulin), en longeant la friche. |
| Les maisons de cheminots (maisons 6 et 7) | ouest x -15 à -10, est x -8 à -3, y 16 à 21, portes au sud en (-12, 21) et (-5, 21), un niveau et demi (égout 3,2 m, faîte 6 m); chemin des Cheminots y 22 et 23, jonction x -2 et -1 | Logements de la compagnie, près de la halte et de la maisonnette du garde-barrière, au bord de la voie: le cantonnier et le poseur de la ligne. Deux maisons jumelles: un même modèle, retourné. |
| La friche du garde-barrière | x -8 à 1, y 30 à 35: ronces, souches, cailloux; 4 parcelles à défricher (section 6) | Le terrain de la maisonnette continuait au-delà de sa clôture, retourné en friche: on le défriche à côté de chez soi (FE-01). Elle touche la réserve du potager agrandi (x 2 à 13, y 28 à 35). |
| Le moulin de la Vanne | x -17 à -11, y 28 à 34 (égout 5,5 m, faîte 9 m), porte à l'est en (-11, 31), roue au sud sur le bief | Étape 3 du monde (Berthe, la meunière), posé ici. La roue au sud, contre le pignon, face à la caméra par défaut. Au sud-ouest de tout ce qui compte: il ne cache que le bord de la carte. |
| Le bief et la vanne | bief x -22 à -9, y 35 et 36 (code `k`, eau vive), canal de fuite x -9 et -8, y 36 et 37; passerelle de la vanne x -19 et -18, y 35 et 36 | Le bief prend l'eau en amont (bord ouest), passe sous la roue et rend l'eau à l'Aubrune. La vanne en amont de la roue: on la lève à deux (geste prévu à l'étape 3). |
| Le parc à grumes | x -10 à -4, y 1 à 8 | Les grumes du bois attendent la scie de Basile, de l'autre côté du chemin forestier. |
| La lisière ouest | x -22 à -11, y -2 à 7 | Le bois descend jusqu'à la voie vers la ville: le train sort de la forêt avant le passage à niveau. |

### 4.5 Liaisons avec l'existant

| Liaison | Ce qui change |
|---|---|
| Rue Haute et route des hameaux | La route continue vers l'est de l'école (x 86) au nouveau bord (x 137), pavée jusqu'au carrefour de l'Église (x 97), en terre au-delà. `village_exit` passe de (97,5 ; 21,5) à (137,5 ; 21,5): les habitants hors carte marchent 40 m de plus (11 s), à reprendre dans `habitants.json`. |
| Ru de la Côte | Il remonte de y 0 à sa source (y -21), bassin de la fontaine x 62 à 65, y -23 et -22. Clé `ru`: `de_y` passe de 0 à -21. Un passage de plus: la planche de la Source (x 63 et 64, y -16 et -15, code `Y`, à ajouter à `ouvrages`). Le sentier du ru suit la rive ouest. |
| La gare et la voie | La voie va de bord à bord (x -24 à 139). Deux traversées neuves en planches (`#`): le passage à niveau de l'Église (x 94 à 96) et le passage de la ferme (x 125 et 126). Le train vient toujours de l'ouest et s'arrête au même endroit; son entrée et sa sortie de carte sont plus longues (24 m à l'ouest, 40 m à l'est), à vérifier dans `voie.ts` (horaires de l'arrivée). |
| La maisonnette | Le chemin de sa façade (y 27) mène au moulin et aux cheminots; la friche touche la réserve du potager. Rien ne change dans le jardin. |
| La lisière | Le sentier de la Côte part du chemin de la voie (y 10) entre la lisière et la maison de Firmin (x 40, 1 m de large dans la lisière, aucun des 12 arbres touché), puis entre dans le bois. Les arbres de l'ancien bord nord (y 0 et 1) deviennent les premiers arbres du bois, à leur place. |
| La scierie | Le chemin forestier (x -3 à -1, 3 m) longe son pignon ouest et monte à la coupe et à la maison forestière: « le chemin forestier derrière la scierie » de l'étape 4. |
| Bords | Les anciens bords ouest (x 0 et 1), nord (y 0 et 1) et est (x 98 et 99) deviennent des cases ordinaires; les buissons de la haie de l'ancien bord est (x 99) restent, comme haie de la vigne et des jardins (sauf deux, section 12). |

## 5. La forêt explorable

Le bois de la Côte (ouest du ru, x 2 à 62, y -28 à 1), le bois de la Cure (est du ru, hêtres, x 65 à 83) et la lisière ouest forment une seule forêt de 2 140 m² de sous-bois, en plus de la lisière existante.

### 5.1 Sentiers

| Sentier | De, à | Largeur, sol | Pourquoi on y va |
|---|---|---|---|
| Chemin forestier | chemin de la voie (y 10) au pied ouest de la scierie, puis x -3 à -1 jusqu'à y -16; embranchement vers la maison forestière | 3 m, terre (`:`) | Le chemin des grumes: Basile y passe avec sa charrette. Il dessert la coupe et la maison du garde. |
| Sentier de la Côte | chemin de la voie (40, 10), par la lisière, jusqu'au bout sud-est de la clairière (34, -6) | 1 m dans la lisière, puis 2 m, terre de forêt (`;`) | Le sentier des cueilleurs: le plus court du bourg à la clairière. |
| Sentier des crêtes | haut du chemin forestier (-1, -16), belvédère (embranchement), Vieux Chêne, rive sud de la mare, source | 2 m | Il relie les lieux du haut du bois d'ouest en est; c'est la boucle. |
| Sentier du ru | chemin de la voie (62, 10), rive ouest du ru, jusqu'à la source | 1 m au pied (entre la remise et le ru), puis 2 m | On remonte l'eau jusqu'à sa source: le guide le plus lisible du bois (une ligne bleue nord-sud). |
| Chemin de la Procession | de la source, par la planche, à travers le bois de la Cure jusqu'au parvis (83, -3) | 2 m, terre | Aux Rogations, le curé mène le bourg de l'église à l'oratoire de la source. Il relie la forêt à l'église. |
| Sentier de la coupe | du chemin forestier (-1, -10) à la clairière (16, -12) | 2 m | De la coupe de Basile à la clairière: il ferme la boucle ouest. |
| Coulées (secrets) | vers le rond des fées (de 40, -3 à 47, -11) et vers la charbonnière (de -14, -3 à -16, -1) | 1 m, sans sol de chemin (herbe foulée) | Passages de bêtes, qu'on remarque si l'on regarde: pas de sol de sentier, seulement une trouée dans les fougères. |

Boucles: bourg, sentier de la Côte, clairière, sentier des crêtes, source, sentier du ru, bourg; source, Procession, église, rue de l'Église, bourg; clairière, sentier de la coupe, chemin forestier, scierie. Impasses voulues et seulement elles: l'embranchement du belvédère, celui de la maison forestière, les deux coulées.

### 5.2 Clairières et lieux

| Lieu | Où | Ce qu'on y trouve | Lisibilité |
|---|---|---|---|
| Clairière du Vieux Chêne | ellipse de centre (26, -13), 20 m sur la diagonale nord-ouest et sud-est, 12 m en travers; le Vieux Chêne (12 m, houppier de 3,4 m) au bord nord-est en (31,5 ; -18,5) | le tronc couché où l'on s'assoit (`clearing_center`), fraises des bois, champignons en bordure, chevreuils à l'aube | allongée sur la diagonale de la caméra: vue du sud-est et du nord-ouest; le Vieux Chêne, seule silhouette de 12 m du bois, sert de repère au loin |
| La mare de la Côte | ellipse de centre (44, -20), eau 7 x 5 m, berge d'une case | grenouilles, libellules, salamandres après la pluie, souille de sangliers à l'ouest | le sentier des crêtes passe sur sa rive sud: on la voit au-dessus du sentier, jamais derrière |
| La source et l'oratoire | clairière de centre (57, -18); bassin (fontaine) x 62 à 65, y -23 et -22; oratoire en (59,5 ; -21,5) | l'eau, le cresson et l'ail des ours au printemps, la statue de l'oratoire | la pierre claire de l'oratoire et le bassin au bout du ru |
| Le belvédère | (6,5 ; -24,5), rochers et banc | la vue sur la vallée, le terrier du renard sous les rochers, les châtaigniers | au bout d'un embranchement; vu du sud-est et du sud-ouest (le bord nord est trop près pour les orientations du nord) |
| La coupe de Basile | x -19 à -5, y -14 à -3 | souches, piles de bois, framboisiers et mûriers dans les rejets, bois mort à ramasser, arbres marqués en bordure (coupe raisonnée de l'étape 4) | ouverte, lumineuse: le seul grand vide de l'ouest |
| La maison forestière | x -10 à -5, y -24 à -19, porte (-7, -19) | le garde forestier (visiteur régulier de l'étape 4, ou habitant: game designer) | au bout du chemin forestier |

### 5.3 Cueillette, bois mort, champignons

Placés par le générateur selon des règles, pas à la main: chaque point sur une case franchissable, à au moins 1,6 m de son hôte (règle `HOST_REACH` du rendu, contrôlée par le validateur), à au moins deux cases au nord de tout tronc qui le cacherait (carnet), et hors des sentiers.

| Famille | Nombre | Où | Hôte |
|---|---|---|---|
| Mûres, framboises | 4 | bords de la coupe, bord sud de la clairière | ronces, framboisiers |
| Noisettes | 2 | le long du sentier des crêtes | noisetiers (`bush_hazel`) |
| Châtaignes | 2 | autour du belvédère | châtaigniers (essence neuve) |
| Myrtilles | 2 | sous les sapins de l'ouest | myrtilliers |
| Fraises des bois | 2 | clairière du Vieux Chêne | |
| Ail des ours, cresson | 2 | source | |
| Champignons | 8 | cèpes sous les chênes et les hêtres (bordures de la clairière, bois de la Cure), girolles sous les bouleaux (coupe), trompettes dans la mousse de la source | |
| Bois mort | 8 | le long des sentiers (branches tombées), un chablis à la coupe (tronc couché à scier) | |

Identifiants proposés: `forage_wood_01` à `_14`, `mushroom_01` à `_08`, `deadwood_01` à `_08`. Ce que chacun donne, quand et combien: game designer (le marché de la 0.12 cherche déjà mûres, noisettes, cèpes, sureau).

### 5.4 Faune

Points proposés (un moment ou une présence chacun, au choix du game designer): `roe_deer_clearing` (clairière, aube), `squirrel_old_oak` (Vieux Chêne), `woodpecker_snag` (arbre mort debout, bord de la coupe), `boar_wallow` (rive ouest de la mare, traces le matin), `salamander_spring` (source, après la pluie), `frogs_pond` (mare, soir de printemps), `fox_den_lookout` (sous les rochers du belvédère), `owl_belfry` (effraie du clocher, à la nuit), `bats_church` (chauves-souris autour du clocher au crépuscule), `hedgehog_priest_garden` (muret du jardin du curé). La chevrette du tour 7 garde sa haie (62, 27).

### 5.5 Secrets

| Secret | Où | Comment on le trouve | Proposition à deux |
|---|---|---|---|
| Le rond des fées | petite clairière de 4 m en (48,5 ; -12), à 8 m du sentier de la Côte | une coulée entre deux houx, sans sol de chemin; au crépuscule, des vers luisants (le rendu sait déjà en dessiner) | rester tous les deux dans le cercle au crépuscule (règle `stayed_at` à deux) |
| La charbonnière oubliée | (-16,5 ; -1), au sud-ouest de la coupe | une coulée depuis le bord de la coupe, barrée par un tronc couché | porter le tronc à deux (geste existant), derrière: la plate-forme noire et la cabane effondrée du charbonnier, et ce que le game designer y cache |

### 5.6 Coopération

La forêt reste jouable seul et ne bloque jamais l'un des deux: tout lieu est atteignable sans l'autre. Les gestes à deux sont des bonus (les deux secrets, la vanne du moulin, porter le chablis de la coupe). Une cueillette à deux mains (l'un baisse la branche, l'autre cueille) pour les châtaignes et les fruits du verger reprend l'échelle du tour 7 (proposition au game designer).

### 5.7 Lisibilité sous la caméra isométrique

1. **Clairières sur la diagonale**: chaque lieu important du bois a deux cônes libres de tout houppier sur 10 m, vers le sud-est (caméra par défaut) et vers le nord-ouest; la maquette sème la forêt hors de ces cônes. Résultat: tous les lieux du bois sont vus depuis la caméra par défaut et une autre orientation.
2. **Sentiers dégagés**: aucun tronc à moins d'une case d'un sentier; sous-bois bas (fougères, 0,6 m) le long du sentier. Ailleurs, les trous de visibilité du rendu (`setSeeThrough`) montrent les joueurs sous les houppiers.
3. **Gradation des hauteurs**: bouleaux (6 m) et noisetiers (3 m) aux bords sud-est des clairières et le long de la lisière; sapins (9 m) et hêtres (9,5 m) au nord et au nord-ouest.
4. **Repères**: le ru (ligne bleue nord-sud), le Vieux Chêne, l'oratoire blanc, le clocher qu'on voit depuis le bois de la Cure, le toit rouge de la maison forestière (couleurs: directeur artistique).
5. **Bord nord**: la forêt du pourtour cache, depuis les orientations du nord, ce qui est à moins de 8 m du bord: aucun lieu important n'en dépend (le belvédère est vu du sud).
6. **Densité**: un arbre pour 15,6 m² de sous-bois (maquette), au plus 12 arbres et 4 500 triangles par morceau de 12 m.
7. **Sol**: un sol de sous-bois (litière de feuilles) distinct de l'herbe, et un sol de sentier de forêt distinct du chemin de terre du bourg (section 9 du format).

## 6. Cultures et récoltes nouvelles

| Parcelle | Où | Cases | Nature | Eau | Pourquoi là |
|---|---|---|---|---|---|
| Friche, parcelles 1 à 4 (`wild_plot_01` à `_04`) | x -8 à -5 et x -3 à 0, y 30 à 32 et y 33 à 35 (4 x 3 chacune; allées x -4, y 29) | 48 | à défricher (ronces, souches, pierres; FE-01: 3 points d'endurance par case) | le bief à 1 m, le tonneau de la maisonnette à 14 m | à côté de la maison, au bout de la réserve du potager: le grand potager du duo pousse vers l'ouest |
| Jardins de la Rive, carrés 1 à 4 (`shared_plot_01` à `_04`) | x 91 à 93 et x 95 à 98, y 24 à 28 et y 30 à 34 | 15, 20, 15, 20 (70) | potager collectif: deux carrés aux habitants (Odette, Solange, par exemple), deux à louer au duo | pompe au croisement des allées | la terre de la rivière; on y croise ceux qui jardinent |
| Champs du Haut 1 et 2 (`field_high_01`, `_02`) | x 109 à 115 et x 117 à 123, y 1 à 9 | 63 et 63 | à louer au fermier; cultures de plein champ (blé, pommes de terre, courges), sans arrosage quotidien (à confirmer) | aucune (pluie) | les champs de la ferme, sur le coteau au midi |
| Verger communal (`orchard_common`) | x 127 à 135, y 0 à 8 | 9 arbres | fruits en saison, partagés | | au bout des champs |
| Vigne du curé (`vineyard`) | x 100 à 107, y 1 à 10 | 8 rangs | vendange d'automne avec le curé | | coteau au midi, à côté du presbytère |
| Prés du Haut (`meadow_high`) | x 127 à 137, y -28 à -1 et x 108 à 126, y -28 à -21 | | réserve: foin pour l'hiver (étape suivante) | | |

Format proposé dans `halte.json` (lot L1, lu par le lot L4): une clé `parcelles`, liste de `{ id, nom, rect, nature: "defricher" | "louer" | "partage", cases }`, les cases ordonnées comme le potager (ligne par ligne, d'ouest en est, du nord au sud). Une clé à part, pas `zones`: `valider_donnees.py` lit toute clé `zones` comme des zones de données (carnet). Les règles (prix de location, défrichage, récoltes, arrosage) sont au game designer.

## 7. Maisons, métiers et intérieurs

### 7.1 Bâtiments neufs (pour l'artiste 3D et le générateur)

Rotation en quarts de tour, 0 pour une porte au sud (convention de la carte). Hauteurs à l'égout et au faîte: le contrôle de la caméra en dépend, tout écart doit revenir au level designer.

| Id (objet) | Type (modèle) proposé | Emprise | Rotation | Porte(s) | Égout, faîte, faîtage | Intérieur |
|---|---|---|---|---|---|---|
| `church` | `church` | x 85 à 105, y -17 à -6 (21 x 12) | 0 | portail sud (95, -6); porte du clocher à l'ouest fermée | nef 7 et 11 m, est-ouest; chevet 9 m; clocher-porche 5 x 7 m, 20 m | oui (nef, section 7.2) |
| `presbytery` | `presbytery_house` | x 76 à 82, y -5 à 1 | 1 | (82, -2) | 4 et 7,5 m, nord-sud | non |
| `sexton_house` | `village_house_a` | x 87 à 92, y 3 à 8 | 1 | (92, 5) | 3 et 5,5 m, nord-sud | non |
| `cafe` | `cafe_house` | x 87 à 93, y 15 à 20 | 0 | (90, 20) | 6 et 8,5 m, est-ouest | oui (salle) |
| `forge` | `forge_shop` | x 98 à 103, y 15 à 20 | 1 | grande porte (103, 17 et 18) | 3 et 5,5 m, est-ouest; cheminée au nord | oui (atelier) |
| `joinery` | `joinery_shop` | x 107 à 113, y 15 à 20 | 1 | (113, 18) | 3,2 et 6 m, est-ouest | oui (atelier) |
| `hamlet_house_a` | `village_house_b` | x 118 à 123, y 15 à 20 | 0 | (120, 20) | 3 et 5,5 m | non |
| `hamlet_house_b` | `village_house_a` (variante) | x 128 à 133, y 15 à 20 | 0 | (130, 20) | 3 et 5,5 m | non |
| `hamlet_house_c` | `village_house_b` (variante) | x 128 à 133, y 25 à 30 | 2 | (130, 25) | 3 et 5 m | non |
| `farmhouse` | `farm_house` | x 114 à 122, y 27 à 32 | 0 | (118, 32) | 5 et 8 m, est-ouest | oui (salle commune) |
| `barn` | `farm_barn` | x 105 à 111, y 29 à 35 | 1 | étable (111, 32) | 4,5 et 8 m, est-ouest | non |
| `washhouse` | `washhouse` | x 99 à 103, y 35 à 37 | 2 | ouvert au nord (101, 35) | 2,4 et 3,6 m, un pan | non (abri ouvert) |
| `mill` | `watermill` | x -17 à -11, y 28 à 34 | 1 | (-11, 31) | 5,5 et 9 m, est-ouest; roue au sud (2,5 m de diamètre, sur le bief) | oui (salle des meules) |
| `rail_cottage_west`, `rail_cottage_east` | `rail_cottage_house` (un modèle, le second retourné) | x -15 à -10 et x -8 à -3, y 16 à 21 | 0 | (-12, 21), (-5, 21) | 3,2 et 6 m, est-ouest | non |
| `forester_house` | `forester_house` | x -10 à -5, y -24 à -19 | 0 | (-7, -19) | 3 et 6 m | non |

Les noms de types contiennent `house` ou `shop` quand c'est possible: avant les modèles, le rendu les dessine avec le substitut maison ou épicerie au lieu d'une caisse rayée (carnet). `church`, `washhouse` (qui contient `house`), `watermill` et `farm_barn` demandent un substitut à ajouter dans `substituts.ts` (lot L3).

Petits objets neufs: croix de Saint-André (`crossing_sign`), murs et grille du cimetière (`cemetery_wall`, `cemetery_gate`), tombes (4 variantes), croix du cimetière, oratoire, bassin de la fontaine, rangs de vigne (tronçons de 3 m), enclume, piles de planches, pompe à bras, tonneau de la pompe, abreuvoir, fumier, charrette, roue de moulin (animée), vanne, piles de grumes, souches, chablis, arbre mort debout, banc du belvédère, tronc couché de la clairière; essences neuves: hêtre, châtaignier, bouleau (existe), fruitiers (pommier existe: poirier, prunier, cerisier, noyer); sous-bois: fougère, houx, myrtillier, framboisier; champignons.

### 7.2 Intérieurs (ADR 0016)

Pièces indicatives, à caler sur le modèle de l'artiste comme pour l'épicerie (le mobilier qu'on doit voir adossé aux murs nord et ouest, que la coupe garde):

| Bâtiment | Pièce | Mobilier fixe et pourquoi |
|---|---|---|
| `church` | la nef, x 90 à 101, y -15 à -8, et le chœur x 102 à 104, y -13 à -10 | bancs en deux blocs, allée centrale dans l'axe du portail (x 95); chaire et statue contre le mur nord (restent debout pour la caméra); autel isolé dans le chœur. Nef de 12 x 8 m: la plus grande pièce du jeu, à vérifier au zoom 2 (lisibilité, ADR 0016 « À vérifier »). |
| `cafe` | la salle, x 88 à 92, y 16 à 19 | comptoir contre le mur nord, tables au milieu, poêle au mur ouest; la salle du bal est l'étage (pas avant un ADR d'étage) |
| `forge` | l'atelier, x 99 à 102, y 16 à 19 | foyer et soufflet contre le mur nord, sous la cheminée; l'enclume du travail courant est dehors, dans la cour |
| `joinery` | l'atelier, x 108 à 112, y 16 à 19 | établi contre le mur nord, râtelier d'outils au mur ouest |
| `farmhouse` | la salle commune, x 115 à 121, y 28 à 31 | cheminée au mur ouest, table et bancs |
| `mill` | la salle des meules, x -16 à -12, y 29 à 33 | les meules contre le mur ouest, la trémie, les sacs; le rouet derrière le mur sud (coupé pour la caméra: on voit l'engrenage tourner) |

Les maisons ne se visitent que sur invitation (règle du tour 10): leurs pièces ne sont pas dans `interieurs` à ce tour.

### 7.3 Qui habite où (à aligner avec `v0-13-habitants.md`)

Proposition de rôles, sans noms; le game designer décide. Chaque maison a un point `<id>_door` devant sa porte.

| Logis | Habitant proposé |
|---|---|
| presbytère | le curé |
| maison 1 (sacristain) | le sacristain sonneur (l'angélus) |
| café | la cafetière (logée à l'étage) |
| forge | le forgeron (logis sous le toit de la forge) |
| menuiserie | le menuisier (logis attenant) |
| maisons 2, 3 et 5 (hameau) | une famille avec enfants (l'école), un couple de retraités, une personne seule |
| logis de la ferme (maison 4) | le couple de fermiers |
| moulin | Berthe, la meunière (étape 3) |
| maisons 6 et 7 (cheminots) | le cantonnier de la voie, le poseur |
| maison forestière | le garde forestier |
| déjà sur la carte | Firmin (sa maison), Odette (épicerie-pension), Basile (scierie), Achille (fournil), Solange (mercerie), Lucie et Jeanne (maison de Lucie), Armand (école-mairie) |

Cela fait 13 logis neufs et 7 existants: une vingtaine d'habitants y tiennent.

## 8. Points et zones

### 8.1 Points neufs (maquette)

| Point | x ; y | Rôle |
|---|---|---|
| `church_porch` | 95,5 ; -4,5 | devant le portail sud |
| `church_square` | 92,5 ; -3,0 | le parvis |
| `presbytery_door` | 83,5 ; -1,5 | devant la porte du presbytère |
| `priest_garden` | 79,5 ; 5,5 | le jardin du curé |
| `cemetery_gate` | 112,5 ; -2,0 | devant la grille du cimetière |
| `cemetery_cross` | 116,5 ; -12,5 | la croix du cimetière |
| `grave_row_east` | 120,5 ; -8,5 | les tombes du rang est (tombes nommées: game designer) |
| `sexton_house_door` | 93,5 ; 5,5 | devant la maison du sacristain |
| `vineyard` | 102,5 ; 5,5 | la vigne |
| `cafe_door`, `cafe_terrace` | 90,5 ; 21,5 et 88,5 ; 21,5 | devant le café, la terrasse |
| `forge_yard` | 105,0 ; 20,0 | la cour de la forge (au bord de la route: la forge ne la cache pas) |
| `joinery_yard` | 115,0 ; 20,0 | la cour de la menuiserie |
| `hamlet_house_a_door`, `_b_door`, `_c_door` | 120,5 ; 21,5, puis 130,5 ; 21,5, puis 130,5 ; 24,5 | portes du hameau |
| `shared_garden_pump`, `shared_garden_plot` | 94,5 ; 29,5 et 93,0 ; 25,5 | la pompe, un carré |
| `washhouse` | 101,5 ; 34,5 | le lavoir |
| `barn_door`, `farm_door`, `farmyard` | 112,5 ; 32,5, puis 118,5 ; 33,5, puis 117,0 ; 35,0 | étable, logis, cour |
| `pasture_gate` | 125,5 ; 33,5 | barrière de la pâture |
| `field_high_01`, `field_high_02`, `orchard` | 111,5 ; 4,5, puis 120,5 ; 4,5, puis 129,0 ; 8,5 | champs du Haut, verger |
| `mill_door`, `mill_sluice` | -9,5 ; 31,5 et -18,5 ; 34,5 | moulin, vanne |
| `rail_cottage_west_door`, `_east_door` | -11,5 ; 22,5 et -4,5 ; 22,5 | maisons de cheminots |
| `wild_plot_01` (à `_04`) | -6,5 ; 31,5 (et -1,5 ; 34,5 pour la 4) | friche |
| `log_yard`, `forest_cut`, `forester_house_door` | -6,5 ; 9,5, puis -12,0 ; -8,5, puis -6,5 ; -17,5 | parc à grumes, coupe, maison forestière |
| `lookout`, `old_oak`, `clearing_center` | 6,5 ; -24,5, puis 31,5 ; -16,0, puis 27,5 ; -12,5 | belvédère, Vieux Chêne, clairière |
| `forest_pond`, `spring`, `spring_oratory` | 44,5 ; -15,5, puis 61,5 ; -19,5, puis 59,5 ; -21,5 | mare, source, oratoire |
| `fairy_ring`, `charcoal_pit` | 48,5 ; -12,0 et -16,5 ; -1,0 | secrets (non marqués « importants ») |

Points qui bougent: `village_exit` (137,5 ; 21,5). Plus les points de cueillette, de faune et de bois mort de la section 5, placés par règles.

### 8.2 Zones neuves (un rectangle chacune, contrat de `GameMap.zones`)

`forest_cote` (x 2, y -28, 61 x 30), `forest_cure` (65, -28, 19 x 28), `forest_west` (-22, -28, 19 x 36), `forest_cut` (-19, -14, 15 x 12), `old_oak_clearing` (17, -22, 19 x 18), `forest_pond` (39, -24, 11 x 9), `spring` (50, -23, 15 x 11), `lookout` (3, -27, 9 x 6), `church_square` (84, -5, 23 x 6), `cemetery` (108, -20, 17 x 17), `priest_garden` (76, 2, 8 x 8), `vineyard` (100, 1, 8 x 10), `church_crossroads` (85, 21, 13 x 3), `shared_gardens` (91, 24, 8 x 11), `wild_plots` (-8, 30, 10 x 6), `field_high_01` (109, 1, 7 x 9), `field_high_02` (117, 1, 7 x 9), `orchard_common` (127, 0, 9 x 9), `meadow_high` (127, -28, 11 x 28), `farmyard` (112, 33, 13 x 4), `pasture` (126, 31, 10 x 7), `mill_race` (-22, 35, 15 x 3), `log_yard` (-10, 1, 7 x 8).

## 9. Distances et trajets

Chemin le plus court sur la grille de la maquette (huit directions, sans couper les angles, 3,5 m/s), prudent comme au tour 10.

| Depuis la porte de la maisonnette vers | Distance | Temps |
|---|---|---|
| parcelle 4 de la friche | 12,9 m | 3,7 s |
| maison de cheminots est | 15,1 m | 4,3 s |
| moulin (porte) | 19,7 m | 5,6 s |
| parc à grumes | 26,6 m | 7,6 s |
| vanne du moulin | 33,4 m | 9,5 s |
| la coupe | 46,6 m | 13,3 s |
| clairière du Vieux Chêne | 50,8 m | 14,5 s |
| maison forestière | 53,6 m | 15,3 s |
| belvédère | 59,3 m | 16,9 s |
| mare | 60,8 m | 17,4 s |
| source | 76,0 m | 21,7 s |
| jardin du curé | 80,1 m | 22,9 s |
| terrasse du café | 82,5 m | 23,6 s |
| porte du café | 84,5 m | 24,1 s |
| carré des jardins de la Rive | 88,3 m | 25,2 s |
| pompe des jardins | 91,0 m | 26,0 s |
| lavoir | 96,7 m | 27,6 s |
| portail de l'église | 100,3 m | 28,6 s |
| cour de la forge | 100,7 m | 28,8 s |
| vigne | 103,1 m | 29,5 s |
| cour de la menuiserie | 110,7 m | 31,6 s |
| champ du Haut 1 | 112,5 m | 32,2 s |
| porte de l'étable | 112,6 m | 32,2 s |
| grille du cimetière | 116,0 m | 33,1 s |
| logis de la ferme | 117,0 m | 33,4 s |
| maisons du hameau | 115 à 125 m | 33 à 36 s |
| verger communal | 128,9 m | 36,8 s |

| Depuis la place vers | Temps | Entre lieux neufs | Temps |
|---|---|---|---|
| moulin | 14,7 s | presbytère, portail de l'église | 3,8 s |
| clairière | 13,6 s | sacristain, portail | 3,1 s |
| café | 15,9 s | café, portail de l'église | 8,7 s |
| jardins (pompe) | 16,6 s | forge, ferme | 6,1 s |
| source | 17,0 s | ferme, champ du Haut 1 | 10,2 s |
| lavoir | 18,5 s | hameau C, lavoir | 10,0 s |
| forge | 20,3 s | clairière, source | 10,5 s |
| portail de l'église | 21,4 s | maison forestière, coupe | 3,2 s |
| ferme | 24,3 s | moulin, café (Berthe au café) | 29,8 s |
| cimetière | 25,9 s | menuiserie, parc à grumes (le bois de Basile) | 36,9 s |
| verger | 29,3 s | cheminots est, église | 31,8 s |

Lecture: le quotidien du duo reste près de la maison (friche 4 s, moulin 6 s, forêt 13 à 22 s). L'est du bourg est une course qu'on décide (24 à 37 s), comme la rue Haute au tour 10, avec la journée doublée (0,7 s par minute de jeu): 35 à 53 minutes de jeu. Le plafond de 25 s du quotidien de la démo n'est dépassé que pour des lieux de la semaine (église, cimetière, champs, ferme). Les champs à louer sont loin: d'où la proposition de cultures de plein champ sans arrosage quotidien (section 6).

A* de `grille.ts` (heuristique octile, plafond `maxNodes` 4 000), sur la grille de la maquette: au plus 1 644 nœuds développés (de la maison forestière au café, 114 m); maisonnette vers la ferme 1 215; maisonnette vers l'église 276. Le plafond actuel suffit, sans changer le code.

## 10. Caméra isométrique

Contrôle de la maquette, comme `valider_carte.py`: rayon du buste (1 m) vers la caméra orthographique à 35,264 degrés, toits à deux pans suivis par pas, tours en volumes pleins, houppiers en disques, forêt du pourtour hors du bord (2 à 9 m de haut, sauf sur la voie, la rivière et l'éclaircie de l'est), bâtiment de la porte exclu (le jeu le coupe).

- Les 41 lieux importants neufs sont **tous vus depuis la caméra par défaut et depuis au moins une autre orientation**.
- Ce qui reste caché est attendu: la cour de la forge et celle de la menuiserie depuis le nord-est (bâtiment voisin), la cour de ferme depuis le nord (logis), la grille du cimetière et le parvis depuis le nord-ouest (église), la terrasse depuis le nord (café), la vanne depuis le nord-ouest (forêt du pourtour, bord ouest).
- Il a fallu, pendant la conception: mettre les cours de la forge et de la menuiserie à l'est des ateliers, et leurs points au bord de la route; déplacer le Vieux Chêne au bord nord-est de la clairière (au nord-ouest, il cachait la clairière dans les deux sens de la diagonale); descendre la source de 4 m et passer le sentier des crêtes au sud de la mare (trop près du bord nord); déplacer trois arbres de l'ancienne rangée du bord nord, hors des emprises mais dans le cône du portail.
- Le bord est (x 138) est à moins de 10 m du hameau C et de la pâture: le rendu doit faire reculer la forêt du pourtour de 6 m à l'est entre y 15 et 45 (`forestClearings`, côté est, comme l'éclaircie actuelle qui suit x 98 et doit suivre le nouveau bord: « les champs et prés des hameaux voisins »).
- Rue de l'Église entre le café et la forge (y 15 à 20): la forge, à l'est de la rue, en cache une partie en orientation 0 sur 2 m; les trous de visibilité du rendu montrent qui y passe. Aucun lieu important n'y est.

## 11. Budgets

### 11.1 Ce qui ne change pas

La caméra montre au plus 36 m: une vue coûte ce qu'elle montre, la taille de la carte ne compte que par ce qui fuit hors du cadre. L'ADR 0016 a déjà fait découper le sol, l'eau et le décor par morceaux de 12 m: les régions neuves n'ont aucun coût hors de leur vue, à condition de suivre la même règle partout (section 11.4). Programmes: 11 au plus, aucun matériau nouveau (tout passe par la palette), aucune `PointLight` de plus (lampe unique de l'ADR 0016 pour les intérieurs neufs).

### 11.2 Estimation par vue

Triangles des objets dans le cadre de 36 m au zoom 2 (bâtiments, arbres, décor comptés deux fois pour la passe d'ombre, sous-bois une fois), plus une base déduite de la mesure de la place (201 830 triangles, ADR 0016, moins les objets de la place: 123 629 pour le sol, l'eau, la voie, le quai, les semis et la forêt du pourtour). Base prudente pour les vues sans rivière ni voie. **Ordre de grandeur, non mesuré en jeu.**

| Vue (zoom 2) | Objets | Estimation |
|---|---|---|
| place, orientation 2 (référence, mesurée) | 78 201 | 201 830 |
| rue Haute actuelle, orientation 0 (pour étalonner: à comparer à sa mesure en jeu, T10-04) | 86 098 | 209 727 |
| clairière du Vieux Chêne, orientations 0 et 2 | 56 066 et 63 182 | 179 695 et 186 811 |
| source et procession | 46 220 | 169 849 |
| mare | 48 140 | 171 769 |
| coupe et maison forestière | 40 865 | 164 494 |
| parvis et église | 64 232 | 187 861 |
| cimetière | 34 480 | 158 109 |
| rue de l'Église au passage à niveau | 82 349 | 205 978 |
| carrefour du café, orientation 2 | 81 788 | 205 417 |
| forge et menuiserie | 82 164 | 205 793 |
| jardins de la Rive | 86 396 | 210 025 |
| ferme | 48 080 | 171 709 |
| moulin | 51 092 | 174 721 |
| cheminots et friche | 59 183 | 182 812 |

Lecture: la forêt et l'ouest ont 15 000 à 40 000 triangles de marge sous la cible de 205 000 (vue sans habitants, ADR 0016). **Les vues de l'est du bourg sont à la limite** avec les plafonds de modèles de 11.3; avec des modèles comme ceux d'aujourd'hui (30 % plus lourds, option `--large` de la maquette), elles montent à 216 000 à 224 000. La vue de la lisière actuelle prend le bois neuf derrière elle (estimation 228 000, surévaluée: l'ancienne forêt du pourtour qui occupait la même place n'est pas retirée du calcul): à mesurer en premier.

Leviers, dans l'ordre: plafonds de modèles tenus (11.3); décor bas sans ombre (tombes, rangs de vigne, fougères, piles de planches: suffixe `:sans-ombre` du décor fusionné); sous-bois à 0,6 m et 80 triangles; regroupement des petits morceaux (réglage de l'ADR 0016). Pas de niveaux de détail (la caméra ne s'éloigne jamais).

Habitants: une vingtaine. Le dimanche (messe, marché) en rassemble jusqu'à vingt dans une même vue: à 2 500 triangles par personnage ombre comprise, 50 000 de plus, au-delà de la marge de 20 000 réservée par l'ADR 0016 pour six habitants et deux joueurs. Question technique pour l'architecte et le game designer: plafonner les rassemblements visibles (dix au plus dans le cadre), ou alléger les personnages.

### 11.3 Plafonds proposés pour les modèles (artiste 3D)

| Modèle | Triangles au plus | Modèle | Triangles au plus |
|---|---|---|---|
| église (clocher compris) | 8 000 | grange-étable | 3 200 |
| café | 5 000 | moulin (sans la roue) | 6 000 |
| logis de la ferme | 4 000 | roue du moulin (animée, à part) | 600 |
| presbytère | 3 500 | maison forestière | 2 500 |
| forge, menuiserie | 3 200 chacune | lavoir | 1 200 |
| maisons (sacristain, hameau, cheminots) | 2 800 chacune | tombe (4 variantes) | 60 |
| hêtre, châtaignier, fruitiers | 400 | mur du cimetière (tronçon de 4 m) | 60 |
| fougère, myrtillier | 80 | rang de vigne (tronçon de 3 m) | 150 |
| houx, framboisier | 120 | champignon, branche morte | 40 |

Repères existants: maison de Lucie 3 480, fournil 4 348, école 5 044, mercerie 6 252, épicerie 11 536, chêne 358, sapin 174.

### 11.4 Ce qu'il faut au rendu (lot L3)

- Lire `taille.origine` partout où la grille est parcourue (sol, eau, voie, semis, champs, brume, pavés, caméra).
- Sol de sous-bois et sol de sentier de forêt (deux codes de terrain neufs, couleurs de la palette); semis de fougères et de feuilles au lieu des fleurs sur le sous-bois.
- Forêt du pourtour sur les nouveaux bords; éclaircie est (y 15 à 45, 6 m); l'éclaircie sud actuelle inchangée.
- Arbres de la forêt posés par la carte (objets, fusionnés par morceaux de 12 m comme le décor), pas semés par le rendu: ils bloquent des cases et le validateur doit les voir.
- Eau du bief et de la mare avec le programme du ru et de la rivière (aucun programme neuf); roue du moulin animée (un appel).
- Substituts pour `church`, `watermill`, `farm_barn`, `washhouse` tant que les modèles manquent.
- Trous de visibilité vérifiés en forêt (un joueur sous trois houppiers).
- Mesures `triangleSplit()` et `programsInUse()` aux vues de 11.2, sur le blockout avec des volumes de remplacement au poids des plafonds de 11.3 (une caisse rayée de 12 triangles ne dit rien du budget).

## 12. Ce qui bouge dans la carte actuelle

Les identifiants restent; seules les positions changent (carnet: un retrait décale toute la numérotation qui suit). Le générateur garde ses boucles d'avant et déplace ces objets après coup, avec une liste explicite.

| Objets | Pourquoi | Où les mettre (proposition) |
|---|---|---|
| `tree_oak_32`, `_33`, `_34`, `tree_fir_21` | emprise du presbytère | lisière du bois de la Cure (x 66 à 75, y -3 à -1) |
| `tree_oak_35`, `tree_fir_22`, `tree_fir_23`, `tree_oak_38`, `_39` | parvis et rue de l'Église | bois de la Cure, même lisière |
| `tree_oak_36`, `_37`, `_40` | cône de caméra du portail | bois de la Cure |
| `tree_oak_26`, `tree_fir_17`, `bush_87` | jardin du curé | pied du coteau, x 66 à 74, y 2 à 9 |
| `tree_fir_18`, `tree_oak_28`, `bush_89` | maison du sacristain, rue de l'Église | pied du coteau, x 84 à 86 |
| `bush_46`, `bush_48` (haie de l'ancien bord est) | emprise de la forge | x 97, y 16 et 19 (entre la rue et la forge) |
| `bush_90`, `bush_91`, `rock_14` | jardins de la Rive | prés au sud du chemin du lavoir (x 102 à 104, y 24 à 30) |
| `bush_31`, `tree_fir_08` | sentier de la Côte | `bush_31` en (41,5 ; 9,5), `tree_fir_08` dans le bois au nord |
| `tree_fir_13` | sentier du ru | une case à l'ouest |
| `bush_08` | chemin du moulin (y 27, x 2) | (1,5 ; 29,5), haie ouest du jardin |

Aussi: `village_exit`, `forestClearings` (est), `ru.de_y`, `ouvrages` (planche de la Source), `sorties` (la route des hameaux sort en x 139), le contrôle `camera.rues_degagees` (ajouter la route des hameaux est, la rue de l'Église et la placette contre le café, la forge, la menuiserie et les maisons du hameau).

## 13. Lots de production

| Lot | Qui | Contenu | Dépend de | Livrables |
|---|---|---|---|---|
| **L0** Origine de la grille | architecte-technique (avenant à l'ADR 0016), dev-gameplay-3d | `taille.origine` lue par `loadMap`; `GameMap.originX`, `originY` et une fonction d'indice; boucles du rendu et de la simulation; bornes de la caméra et des contrôles de positions; test d'invariance par translation | rien | code, test, ADR |
| **L1** Carte | level-designer | générateur (régions, terrain, objets, arbres de la forêt, points, zones, `parcelles`, `interieurs`, `ouvrages`, trajets des habitants), validateur (origine, règles neuves ci-dessous), aperçus; liste des objets déplacés; blockout avec substituts | L0 pour charger en jeu (le générateur et le validateur peuvent avancer en parallèle) | `halte.json`, outils, `carte-halte.md` version 0.4, captures |
| **L2** Modèles | artiste-3d, directeur-artistique | bâtiments de 7.1 aux emprises, rotations, ouvertures, égouts et faîtes indiqués, avec métadonnées d'intérieur (`footprint`, `door_cell`, `cut_walls`, `interior`); petits objets et essences de 7.1; plafonds de 11.3; planche de revue | ce document (emprises figées) | GLB, sources Blender scriptées, planche |
| **L3** Rendu | dev-gameplay-3d (rendu), tech-artist | section 11.4 | L0, L1 | code, mesures |
| **L4** Simulation et données | dev-gameplay-3d (simulation), game designer | habitants (`v0-13-habitants.md`): emplois du temps, trajets, portes et heures des intérieurs neufs; parcelles (location, défrichage, plein champ); cueillette, bois mort, champignons; secrets; cloches (angélus 7 h, 12 h, 19 h) | L1 | données, code, tests |
| **L4 bis** Son | sound-designer | ambiance de forêt (feuillage, pic, geai), pas sur les feuilles (`pas: feuilles`), cloches, forge, menuiserie, moulin et bief, lavoir, café, sifflet du train aux passages à niveau | L1 (lieux) | sons, mixage |
| **L5** Recette | qa-testeur | critères de la section 14, captures, budgets sur le PC (liste « à tester chez le client ») | L1 à L4 | rapport |

Ordre: L0 et L1 (outils) en parallèle, L2 dès maintenant (les emprises de ce document suffisent), puis L1 en jeu, L3 et L4, enfin L5. Les modèles arrivent sur un blockout déjà validé (règle du level design: habiller après validation).

Règles neuves du validateur (lot L1), chacune éprouvée sur une carte cassée exprès: origine et bornes; aire existante inchangée hors liste de la section 12 (comparaison avant et après sur x 0 à 99, y 2 à 45); sentiers sans impasse hors impasses déclarées; cônes de caméra des lieux du bois; au plus 12 arbres et 4 500 triangles par morceau de 12 m; parcelles sur un sol cultivable, sans objet, bord atteignable, eau à moins de 25 m (sauf plein champ); passages à niveau: cases `#` sur toute la voie et panneaux des deux côtés; distances plafonds de la section 14; A* sous 3 000 nœuds pour chaque trajet d'habitant.

## 14. Critères d'acceptation testables

| Id | Critère | Preuve |
|---|---|---|
| CA-C1 | `valider_carte.py` et `valider_donnees.py`: 0 erreur sur la carte de 164 x 78 m | sortie des outils |
| CA-C2 | toutes les cases franchissables atteignables depuis la porte de la maisonnette, pièces bâties comprises; aucune poche | validateur |
| CA-C3 | aire de la carte actuelle inchangée, hors objets et points listés en section 12 | script de comparaison |
| CA-C4 | les lieux importants neufs vus depuis la caméra par défaut et depuis au moins une autre orientation; portes des intérieurs neufs vues dans trois orientations sur quatre (bâtiment de la porte exclu) | validateur, captures `rendu.html` aux quatre orientations |
| CA-C5 | distances depuis la porte de la maisonnette: friche 6 s au plus, moulin 8 s, clairière 16 s, source 24 s, café 26 s, église 30 s, ferme 35 s, verger 38 s | validateur (table des distances) |
| CA-C6 | sentiers: aucune impasse hors belvédère, maison forestière et coulées | validateur |
| CA-C7 | sauvegardes des formats actuels chargées avec les mêmes positions (option A: aucune migration de position) | tests de reprise existants |
| CA-C8 | test d'invariance par translation (option A) | test du lot L0 |
| CA-C9 | vues de 11.2 sans habitants: 205 000 triangles et 135 appels au plus, 11 programmes; vue de la place inchangée à 2 % près | `triangleSplit()`, `programsInUse()` |
| CA-C10 | A*: tous les trajets d'habitants trouvés sous 3 000 nœuds | validateur |
| CA-C11 | revue de près (règle du client): rien qui flotte, dépasse ou se traverse; croix de Saint-André du bon côté de la rue, grille du cimetière qui s'ouvre vers l'allée, roue du moulin dans le bief | captures examinées, quatre orientations, `largeur=` de 8 à 16 m |
| CA-C12 | la forêt reste jouable seul: chaque lieu du bois atteint par un seul joueur, aucun passage qui demande l'autre | robot sur la carte, test |

## 15. Progression

Proposée pour l'ordre d'ouverture (le game designer fixe les déclencheurs; aucune région n'est fermée par un mur, seulement par l'envie et par les histoires).

| Région | Nouveauté introduite | Difficulté (1 à 5) | Durée estimée de la première visite |
|---|---|---|---|
| Friche et chemin du moulin | défricher pour agrandir le potager | 1 | 10 min de jeu |
| Bois de la Côte (clairière, sentier de la Côte, sentier du ru) | s'orienter sous les arbres, cueillir en forêt, champignons | 2 | 20 à 30 min |
| Carrefour de l'Église (café, forge, menuiserie) | nouveaux habitants, commandes au forgeron et au menuisier | 1 | 15 min |
| Église, parvis, cimetière | la cloche qui donne l'heure, les tombes qui racontent | 1 | 10 min |
| Jardins de la Rive, lavoir | un carré à soi parmi les voisins | 1 | 10 min |
| Ferme, champs du Haut, verger | louer un champ, la moisson et la cueillette à deux | 2 | 20 min |
| Moulin de la Vanne (étape 3) | lever la vanne à deux, moudre | 2 | 15 min |
| Secrets du bois | regarder hors des sentiers, gestes à deux | 2 | 10 min chacun |

## 16. Questions et décisions

Pour le client (par le manager):

- **Q1. La taille**: 164 x 78 m, un peu plus que l'enveloppe du cahier pour la Halte (120 x 90 m, en surface 10 800 m² contre 12 800). Recommandation: l'accepter et l'inscrire dans l'historique du cahier; la caméra ne montre que 36 m, le coût suit la vue.
- **Q2. L'église se visite-t-elle dès la 0.13 ?** Recommandation: oui, la nef seule (messe, noce, fête), le clocher plus tard.
- **Q3. Le moulin dès la 0.13 ?** Recommandation: bâtiment, bief et roue posés en 0.13, porte fermée jusqu'à l'histoire de Berthe (comme la remise de la draisine).
- **Q4. Le nom de l'église**: Saint-Aubin (écho de l'Aubrune). Recommandation: le garder; autre proposition, Notre-Dame-de-la-Côte.

Pour l'architecte (technique, pas pour le client): option A ou B de la section 2 (recommandé: A); les rassemblements de vingt habitants dans une vue (11.2); l'arrivée du train sur une voie plus longue.

Pour le game designer: identifiants des lieux (7.3 et 8) à aligner avec `v0-13-habitants.md`; règles des parcelles (6); ce que donnent cueillette, champignons, bois mort, secrets et tombes; les cultures de plein champ sans arrosage.

Hors périmètre de ce document: relief (le coteau se lit par la végétation, les murets et les marches; un vrai relief demanderait un ADR), étages visitables, rive sud, les Vergers.

## 17. Production du lot L1 (2026-11-03)

**Où est la carte.** `python3 games/la-petite-ligne/outils/construire_carte_halte.py --0.13` écrit `donnees/cartes-0-13/halte.json` (le jeu ne charge que `donnees/cartes/`); sans option, le script réécrit la carte du tour 10 à l'octet près. Les régions neuves sont composées dans `outils/carte_halte_0_13.py`. Le jour où L0 est intégré: écrire la carte agrandie dans `donnees/cartes/halte.json` (changer `SORTIE`) et retirer le refus de l'origine dans `src/donnees/carte-niveau.ts` (test `tests/carte-origine.test.ts`).

**Contrôles** (`valider_carte.py donnees/cartes-0-13/halte.json`, 0 erreur): ceux d'avant, en coordonnées de la carte, plus: aire du bourg d'avant inchangée hors des retouches et des 29 objets déplacés déclarés (`agrandissement`, comparée à `donnees/cartes/halte.json`); bouts de sentier de forêt seulement aux impasses déclarées (ligne médiane du réseau, les clairières comptent); 12 arbres et 4 500 triangles au plus par morceau de 12 m; parcelles (sol cultivable, libres, bord atteignable, eau à 25 m sauf plein champ); passages à niveau (planches sur toute la voie, un panneau de chaque côté); distances plafonds de CA-C5; A* du jeu pour chaque trajet de la carte (erreur au-delà de 4 000 nœuds, avertissement au-delà de 3 000) et, avec `--plannings`, pour chaque paire de points de chaque planning; hôtes de cueillette à portée; volumes du clocher et forêt du pourtour dans la caméra. Chaque règle neuve a été éprouvée sur une carte cassée exprès.

**Écarts avec les sections 4 à 8** (tous dans le générateur, avec leur raison):

| Élément | Conception | Produit | Pourquoi |
|---|---|---|---|
| Forge | grande porte à l'est sur la cour | grande porte au sud, sur la route (un vantail ouvrant, l'autre fixe); la cour reste à l'est | depuis la coupe, l'A* du jeu tournait autour de la forge et dépassait 4 000 nœuds; une forge ouvre sur la rue où l'on mène les chevaux |
| Menuiserie | x 107 à 113, cour x 114 à 116 | x 108 à 114, cour x 115 à 117 | depuis la porte de la forge, son toit cachait le point à la caméra par défaut |
| Hameau | chemin de la ferme x 125 et 126, maison B x 128 à 133 | cour de soins de Nour x 124 et 125 (barrière basse), chemin et passage x 127 et 128, maison B x 130 à 135 | la cour de soins demandée par les habitants (1.3) à l'est de la maison A |
| Verger communal | x 127 à 135 | arbres en x 130, 133, 136 | le chemin de la ferme passe en x 127 et 128 |
| Cimetière | grille sud seule | grille sud et petite grille ouest face au chevet, allée de gravier du tour du chevet (x 106 et 107) | sans elle, on fait le tour par l'est et l'A* du jeu s'épuise (6 058 nœuds de la coupe à la tombe Cornu) |
| Bief | passerelle de la vanne seule | plus les planches du halage sur le canal de fuite | la rive sud du bief (où l'on regarde la roue) se rejoint aussi par l'est |
| Friche | x -8 à 1, allée x -4 | x -8 à -1, allée y 32; deux buissons ferment l'angle de la haie du jardin et de sa clôture sud | la haie du jardin du garde-barrière est en x 0 (anciens buissons du bord) |
| Maison du sacristain | porte (92, 5) | porte (92, 6) | même modèle que la maison B du hameau (porte à 2 m du coin) |
| Logement du maître | porte au pignon est | porte sur la route, à côté de celle de la mairie | le café touche le pignon est (mitoyens) |
| `school_yard`, `mairie_desk` | dans la cour murée, dans le bureau | devant le portail, à la porte de la mairie | la cour et l'école sont bloquées: un habitant posté là ne repartait plus |
| Vigne | point entre deux rangs | point au bas des rangs (106,5 ; 10,5) | entre les rangs de 1,5 m, on ne voit plus qu'une tête |
| Tilleul de la place | non prévu | `square_lime_tree` (tree_lime) au coin de la place et de la cour de la halte, sur l'herbe | demandé par les plannings (`square_lime_tree`), pas sur les pavés (règle R22) |
| Cueillette | règles de 5.3 | coins posés par règle; les châtaigniers à 3 m au nord de leur coin, noisetiers et ronces à 1 m | un houppier au-dessus du coin le cachait à la caméra |
| Objets déplacés | 27 | 29 (`bush_88`, jardin de dahlias; `tree_oak_27`, son houppier dans le toit du sacristain) | |
| Zones | noms de 8.2 | suffixe `_area` quand un point porte le même nom | points et zones partagent un espace de noms |

**Budgets mesurés sur le blockout** (jeu actuel, carte translatée de +24, +30 dans une copie temporaire, Chromium et SwiftShader, 1366 x 768, zoom 2, 11 h, sans habitants; `triangleSplit()` et `programsInUse()`). « Estimé »: la mesure plus les modèles qui manquent au poids des plafonds de 11.3, ombre comprise (borne haute: les substituts mesurés restent comptés). Plafonds de la 0.13: 350 000 triangles, 200 appels.

| Vue | Triangles mesurés | Appels | Programmes | Estimé avec les modèles |
|---|---|---|---|---|
| place (orientation 2, référence) | 157 340 | 80 | 6 | 158 540 |
| lisière actuelle | 192 059 | 109 | 6 | 192 791 |
| clairière du Vieux Chêne (0 et 2) | 116 697 | 58 | 6 | 119 829 |
| source | 92 362 | 49 | 6 | 103 090 |
| mare | 109 035 | 51 | 6 | 114 163 |
| coupe | 82 084 | 44 | 6 | 103 312 |
| parvis et église | 72 381 | 44 | 6 | 118 991 |
| cimetière | 56 686 | 38 | 6 | 82 146 |
| rue de l'Église au passage à niveau | 94 661 | 52 | 6 | 152 061 |
| carrefour du café (orientation 2) | 118 031 | 60 | 6 | 158 831 |
| forge et menuiserie | 86 683 | 54 | 6 | 149 893 |
| jardins de la Rive | 101 283 | 59 | 6 | 149 683 |
| ferme | 74 391 | 55 | 6 | 116 231 |
| moulin | 66 534 | 49 | 6 | 91 666 |
| cheminots et friche | 93 795 | 78 | 6 | 119 227 |

La vue la plus chargée reste la lisière actuelle (le bois neuf derrière elle): 192 000 triangles et 109 appels. Le semis de la forêt a été densifié après la mesure (de 65 à 80 arbres semés, 140 à 154 arbres dans le bois); les vues du bois prennent au plus une dizaine d'arbres de plus (moins de 10 000 triangles).

**Ce qui reste hors de la carte, signalé:** l'A* du jeu abandonne encore à 4 000 nœuds sur une paire des plannings (Barnabé, de la coupe à l'atelier de la forge: 4 354; 3 538 avec une heuristique octile); deux trajets de la messe dépassent 3 000 (Berthe 3 321, Ambroise 3 097). La règle des 6 départs par minute n'est pas tenue par les plannings (jusqu'à 14 départs à midi; `docs/jeux/jeu-1/simulations/v0_13_departs.py`): c'est l'étalement prévu au lot H1.

## Annexe A. Grille de la maquette (1 m par caractère)

Générée par `python3 -I docs/jeux/jeu-1/simulations/v0_13_carte_maquette.py --ascii`. Nord en haut; en-tête: x de -24 à 139; à gauche: y de -30 à 47. C'est une maquette de conception: le générateur du lot L1 la refait proprement (buissons, rochers et clôtures existants ne sont pas dessinés ici).

Terrain: `.` herbe, `,` herbe haute, `h` sous-bois, `;` sentier de forêt, `:` chemin de terre, `+` pavés, `c` gravier (cimetière, cour de ferme, allée), `p` terre cultivable (potager, parcelles, jardin du curé, champs), `f` friche, `v` vigne, `~` rivière, `e` eau dormante (mare, bassin de la source, mare de la pâture), `k` bief, `r` ru, `b` berge, `g` gué, `=` voie, `#` planches (passages à niveau), `q` quai, `P`, `Y`, `j` ouvrages du ru, `X` bord. Objets: `T` arbre, `t` fruitier, `@` Vieux Chêne, `D` porte; bâtiments actuels `H` halte, `M` maisonnette, `E` épicerie, `F` Firmin, `S` scierie, `R` remise, `U` poulailler, `B` fournil, `W` mercerie, `L` Lucie, `K` école, `Z` cour de l'école, `O` puits; bâtiments neufs `G` église, `N` presbytère, `V` café, `Q` forge, `J` menuiserie, `I` lavoir, `y` grange-étable, `x` moulin, `z` maison forestière, `1` à `7` maisons (1 sacristain, 2 et 3 hameau A et B, 4 logis de la ferme, 5 hameau C, 6 et 7 cheminots).

```text
          -20       -10       0         10        20        30        40        50        60        70        80        90        100       110       120       130       
      43210987654321098765432101234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789
 -30  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
 -29  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
 -28  XXhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh,,,,,,,,,,,,,,,,,,,,,,,,..............................XX
 -27  XXhhhhThhhhhhhhhThhhhhThhhhh,T,,hhhhhhhhhhhhhhThhhhThhhhThhThhhhhhhhThhhThhhhhhhhhThhhhhhhhhhThhhhhhhhhhhhTh,,,,,,,,,,,,,,,,,,,,,,,,..............................XX
 -26  XXhhhhhhhhhhhhhhhhhhhhhhhhhh,,,,,ThhhThhThhhhhhhhhhhhhhhhhhhhhThhhhhhhhhhhhhhhhhhhhhhThhhhhhhhhhhhhhhThhhhhh,,,,,,,,,,,,,,,,,,,,,,,,..............................XX
 -25  XXhhhhhhhhhhhhhhhhhhhhhhhhhh,,,,,,hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhThhhhhhhhhhhhhhhhh,,,,,,,,,,,,,,,,,,,,,,,,..............................XX
 -24  XXhhhhhhhhhhhhzzzzzzhThhThhh,,,,,,hhhhhhhhhhThhhThhhhhhhhhhhhhhhhbbbbThhhhhhT,,,,,hhhhhhhhhhhThhhhhhhhhhhThh,,,,,,,,,,,,,,,,,,,,,,,,..............................XX
 -23  XXhhhhThhhhhhhzzzzTzhhhhhhhhh,;;,,hhhhhhhhhhhhhhhhhhh;;hhhhhhhhhbeeeebbhhhhh,,,,,,,hhTeeeehhhhhhhThhhhhhhhhh,,,,,,,,,,,,,,,,,,,,,,,,..............................XX
 -22  XXhhhhhhhhhhhhzzzzzzhhhhhhhhh;;;;;;;;;;;;;;;;;;;;;;;;;;;;hhhhhhhbeeeeebbhhh,,,,,,,,,,heeeehhhhhhhhhhhhThhhhh,,,,,,,,,,,,,,,,,,,,,,,,..............................XX
 -21  XXhhhhhhhhThhhzzzzzzhhThhhh;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;hhhhhhbeeeeeebhhh,,,,,,,,,,hhrrhThhhhhhhhhhhhhhThh,,,,,,,,,,,,,,,,,,,,,,,,..............................XX
 -20  XXhhhhhhhhhhhhzzzzzzhhhhhh;;;;;;;hhhhhhhhh,,,,,,,,,hhhh;;;;;hhhhbeeeeeebhhh,,,,,,,,,,,hrrhhhhhhhhhhhhhhhhhhh,,,,,,,,,,,,,,,,,,,,,,,,ccccccccccccccccc::...........XX
 -19  XXhhhhhhhhhhhhzzzDzzhhhh;;;;;hhhhhhhhhhhhh,,,,,,,,,,,hhhh;;;;;hhbbeeeeebhhh,;;;;,,,,,,,rrhhhhhhhhhThhhThhhhh,,,,,,,,,,,,,,,,,,,,,,,,ccccccccccccccccc::...........XX
 -18  XXhhhhhhhhhhhhhhh:hhhh;;;;;hhhhhhhhhhhhhhT,,,,,,,,,,,,h@hh;;;;;;hbbeeeebhh;;;;;;,,,,,,,rrhhThhhhhhhhhhhhhThh,,,,,,,,,,,,,,,,,,,,,,,,ccccccccccccccccc::...........XX
 -17  XXhhhhhhhThhhhhhh:::::;;;;hhhhhhhhhhhhhhhh,,,,,,,,,,,,Thhhhh;;;;;;;bbbb;;;;;;;,,,,,,,,,rr::hhhhThhhhhhhhhhhh,GGGGGGGGGGGGGGGGGGGGG,,ccccccccccccccccc::...........XX
 -16  XXhhhhhhhhhhhhhTh:::::;;hhhhhhhhhhThhhhhhh,,,,,,,,,,,,,,hhhhhh;;;;;;;;;;;;;;h,,,,,,,,,,Y::::hhhhhhhhhhhhhhhh,GGGGGGGGGGGGGGGGGGGGG,,ccccccccccccccccc::...........XX
 -15  XXhThhhhhhhhhhhhhhhhh:::hhhhhThhhhhhhhhhhh,,,,,,,,,,,,,,hhhhhhhhh;;;;;;;hhhhh,,,,,,,,,,Y::::::hhhhhhhhhhhhhh,GGGGGGGGGGGGGGGGGGGGG,,ccccccccccccccccc::...........XX
 -14  XXhhh,,,,,,,,,,,,,,,h:::hhhhhhhhhhhhhhhhhhh,,,,,,,,,,,,,,hhhhhhhhhh;;hh,,,hhhhh,,,,;;,hrrh:::::hhhhhhhhhhhhh,GGGGGGGGGGGGGGGGGGGGG,,ccccccccccccccccc::...........XX
 -13  XXhhh,,,,,,,,,,,,,,,h:::hhThhhhhhhhhhhh;;;h,,,,,,,,,,,,,,hhhhhhhhhhhhhh,,,hhhhhh,,,;;hhrrhhh:::::hhThhhhhhTh,GGGGGGGGGGGGGGGGGGGGG,,ccccccccccccccccc::...........XX
 -12  XXhhh,,,,,,,,,,,,,,,h:::hhhhhhh;;;;;;;;;;;hh,,,,,,,,,,,,,,hhhhhhThhhhh;;,,hhhThhhhh;;;hrrhhhh:::::hhhhhhhhhh,GGGGGGGGGGGGGGGGGGGGG,,ccccccccccccccccc::...........XX
 -11  XXhhh,,,,,,,,,,,,,,,h:;;;;;;;;;;;;;;;;;;;;hh,,,,,,,,,,,,,,hhhhhhhhhhhh;;,,hhhhhhhhh;;;hrrhhhhhh:::::hhThhhhh,GGGGGGGGGGGGGGGGGGGGG,,ccccccccccccccccc::...........XX
 -10  XXhhhT,,,,,,,,,,,,,,h:;;;;;;;;;;;hhhhhhhhhhhh,,,,,,,,,,,,,hhhhhhhhhhh;hhhhhhhhhhhhhh;;hrrhThhhhh:::::hhhhhhh,GGGGGGGGGGGGGGGGGGGGG,,ccccccccccccccccc::...........XX
  -9  XXhhh,,,,,,,,,,,,,,,h:::hhhhhhhhhhhhhhhhhhhhhh,,,,,,,,,,,,hhhhhhhhh;;hhhhhhhhhhhThhh;;;rrhhhhhhhhh:::::hhThh,GGGGGGGGGGGGGGGGGGGGG,,ccccccccccccccccc::...........XX
  -8  XXhhh,,,,,,,,,,,,,,,h:::hhhhhhhhhhhThhhhhhhhhhh,,,,,,,,,,;;hhhhhhhh;;hhhhhhhhhhhhhhh;;;rrhhhhhhhhhh:::::hhhh,GGGGGGGGGGGGGGGGGGGGG,,ccccccccccccccccc::...........XX
  -7  XXhhT,,,,,,,,,,,,,,,h:::hhhhhhhhThhhhhhhhhhhhhhhh,,,,,,,,;;;;hhhhh;;hhhhThhhhhhhhhhhh;;rrhhhhhhThhhhh:::::hh,GGGGGGGGGGGGGGGGGGGGG,,ccccccccccccccccc::...........XX
  -6  XXhhh,,,,,,,,,,,,,,,h:::hhhhhhhhhhhhhhhhhhhThhThhhh,,,,,,;;;;;hhh;;hhhhhhhhhhhhhhhThh;;rrhhhhhhhhhhhhh:::::h,GGGGGGGGGGDGGGGGGGGGG,,ccccccccccccccccc::...........XX
  -5  XXhhh,,,,,,,,,,,,,,,h:::hhhhhThhhhhhhThhhhhhhhhhhhhhhhhhhhh;;;;;h;hhhhhhhhhhhhhhhhhhh;;rrhhhhhhhhhhTNNNNNNN:+++++++++++++++++++++++,ccccccccccccccccc::...........XX
  -4  XXhhh,,,,;;,,,,,,,,,h:::hhhhhhhhhThhhhhhhhhhhhhhhhhhhhhhhhhhh;;;;hhhhhhhhhhhhhhhhhhhh;;rrhhThhhhhhhhNNNNNNN:+++++++++++++++++++++++,ccccccccccccccccc::...........XX
  -3  XXhhh,,,;;,,,,,,,,,,h:::hhThhhhhhhhhhhhhhhhhhThhhhhThhhThhhhhh;;;hhhhhThhhhhhhhThhThh;;rrhhhhhhhhhhhNNNNNNN:+++++++++++++++++++++++ccccccc,,,,,,,,,,,::...........XX
  -2  XXhhhhhhhhhhhhhhhhhhh:::hhhhhhhhhhhhhhhhhThhhhhhhhhhhhhhhhhhhhh;;hhThhhhhhhThhhhhhhhh;;rrhhhhhhhThhhNNNNNNDh+++++++++++++++++++++++ccccccc,,,,,,,,,,,::...........XX
  -1  XXhhhThhhhhhhhhhhhhhh:::hhhhhhhhhhhhhhThhhhhhhhhhhhhhhhhhhhhhhh;;hhhhhhhhhhhhhhhhhhhh;;rrhhhhThhhhhhNTNNNNNh+++++++++++++++++++++++ccccccc,,,,,,,,,,,::...........XX
   0  XXhhhhhhThhhThhhhhhhh:::T.hhThhTThThThhhThhhThTThhhhThTTThThThT;;hThThhhhhhThhhThhhhT;;rr,,,T,T,,,,,NNNNNNN,+++++++++++++++++++++++.:::::::::::::::::::t..t..t....XX
   1  XXhhThhhhhhhhh::::::::::..ThThThhhThhTThhhThhhhhThThThhhhhThhhh;;hhhhhThThThThThThThh;;rr,T,,,,,T,T,NNNNNNN,,,,,,,,,,,+++,..vvvvvvvv.ppppppp:ppppppp:::...........XX
   2  XXhhhhhhhhhThh::::::::::..SSSSSSSSSS.,,,....,,,,..,...,.,...,.,.;FFFFFFF,,.T.,,...,,.,;rr..,.,,..,,.pppppppp,..,,..,.,+++...vvvvvvvv.ppppppp:ppppppp:::...........XX
   3  XXhhhhhhThhhhh::::::::::..SSSSSSSSSS...,.,T....,...,T.,,.,,,.,T.;FFFFFFF,..,..,,,,..T.;rr,.,...,T,,.pppppppp,,,111111.+++...vvvvvvvv.ppppppp:ppppppp:::t..t..t....XX
   4  XXhhhhhhhhhhhh::::::::::T.SSSSSSSSSS,.,,,,,..,..T......,.,T,.,.,;FFFFFFF,.,,.,RRRRRR..;rr,.,.....,..pppppppp,,.111111.+++...vvvvvvvv.ppppppp:ppppppp:::...........XX
   5  XXhhhhhhhhhhhh::::::::::..SSSSSSSSSS...,,..,T,,,......T,.,,,..,.;FFFFFFF..T...RRRRRR,,;rr,,.T,.,.,,.pppppppp.,.11111D.+++...vvvvvvvv.ppppppp:ppppppp:::...........XX
   6  XXhhThhhhhhThh::::::::::..SSSSSSSSSS,,,.T.......,.T.....,...T..,;FFFFFFF..,...RRRRRR.T;rr,,,..,,.,.,pppppppp,,T111111,+++...vvvvvvvv.ppppppp:ppppppp:::t..t..t....XX
   7  XXhhhhhhhhhhhh::::::::::T.SSSSSSSSSS.,....,,..T,.,,...,.T...,,.,;FFFFFFF.,..,,RRRRRR,,;rr,,,.,,..,,,pppppppp..,111111.+++,..vvvvvvvv.ppppppp:ppppppp:::...........XX
   8  XX............::::::::::..SSSSSSSSSS.,...,...,.,.,,,.,.,,.,,.,,.;,..:,.,..,..,RRRRRR,,;rr,.,,,,..,,.pppppppp,,.111111,+++,..vvvvvvvv.ppppppp:ppppppp:::...........XX
   9  XX...................:::..SSSSSSSSSS...,,...,,,,,,,,,,,,.......,;..,:,,......,,.=.,.,.;rr..,..,.,,..pppppppp.,.,.,,.,.+++,..vvvvvvvv.ppppppp:ppppppp:::...........XX
  10  XX...................:::T.::::::::::::::::::::::::::::::::::::::::::::::::::::::=:::::.rr.............................+++...vvvvvvvv::::::::::::::::::::::::::::..XX
  11  XX...................:::..::::::::::::::::::::::::::::::::::::::::::::::::::::::=:::::.rr.............................+++...........::::::::::::::::::::::::::::..XX
  12  =========================================###==============================#===========================================###============================##=============
  13  =========================================###==============================#===========================================###============================##=============
  14  =========================================###==============================#===========================================###============================##=============
  15  XX...................................:::::::.qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqHHHHHHHHHH..rrBBBBBBB..ZZZZZZKKKKKKKVVVVVVV+++.QQQQQQ:::JJJJJJJ:::.222222.::.333333....XX
  16  XX.......666666.777777...............:...:::.qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqHHHHHHHHHH..rrBBBBBBB..ZZZZZZKKKKKKKVVVVVVV+++.QQQQQQ:::JJJJJJJ:::.222222.::.333333....XX
  17  XX.......666666.777777...............:...:::.qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqHHHHHHHHHH..rrBBBBBBB..ZZZZZZKKKKKKKVVVVVVV+++.QQQQQQ:::JJJJJJJ:::.222222.::.333333....XX
  18  XX.......666666.777777...............:...:::.qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqHHHHHHHHHH..rrBBBBBBB..ZZZZZZKKKKKKKVVVVVVV+++.QQQQQD:::JJJJJJD:::.222222.::.333333....XX
  19  XX.......666666.777777...............:...:::..........++...........++......HHHHHHHHHH..rrBBBBBBB..ZZZZZZKKKKKKKVVVVVVV+++.QQQQQQ:::JJJJJJJ:::.222222.::.333333....XX
  20  XX.......666666.777777...............:...:::..........++...........++......HHHHHHHHHH..rrBBBBBBB..ZZZZZZKKKKKKKVVVVDVV+++.QQQQQQ:::JJJJJJJ:::.22D222.::.33D333....XX
  21  XX.......666D66.777D77.......MMMMMMM.:...:::+++++++++++++++++++++++++++++++++++++++++++PP+++++++++++++++++++++++++++++++++::::::::::::::::::::::::::::::::::::::::XX
  22  XX.......:::::::::::::::.....MMMMMMM.:...:::+++++++++++++++++++++++++++++++++++++++++++PP+++++++++++++++++++++++++++++++++::::::::::::::::::::::::::::::::::::::::XX
  23  XX.......:::::::::::::::.....MMMMMMM.:...:::...EEEEEEEE++++++++++++++++++..++++++++++++PP++++++++++++++......+++++++++++++..::............,,,,,,,,,::.............XX
  24  XX....................::.....MMMMMMM.:...:::...EEEEEEEE++++++++++++++++++.,,,....,,.,,.rr++++++++++++++.......,.,,,ppp:pppp.::............,,,,,,,,,::.............XX
  25  XX....................::.....MMMMMMM.:...:::...EEEEEEEE++++++++++++++++++.,,,,,.,.,,..,rr...WWWWWWW++++........,.,.ppp:pppp.::............,,,,,,,,,::...55D555....XX
  26  XX....................::.....MMMMMMM.:...:::...EEEEEEEE++++++++++++++++++....,.,..,,..,rr...WWWWWWW++++LLLLLL.,,..,ppp:pppp.::............,,,,,,,,,::...555555....XX
  27  XX............::::::::::::::::::::::::::::::...EEEEEEEE++++++++OO++++++++.,,,,,,.,..,,,rr...WWWWWWW++++LLLLLL,,t,..ppp:pppp.::............444444444::...555555....XX
  28  XX.....xxxxxxx::::::::::.......pppp...UUU:::...EEEEEEEE++++++++OO++++++++.......,,...,,rr...WWWWWWW++++LLLLLL,.,,.,ppp:pppp.::............444444444::...555555....XX
  29  XX.....xxxxxxx::.,,,,,,,,,.....pppp...UUU:::...EEEEEEEE++++++++++++++++++..,,.,,,,,,,,.rr...WWWWWWW++++LLLLLL.,..t,::::::::.::...yyyyyyy..444444444::...555555....XX
  30  XX.....xxxxxxx::ffffffffff.....pppp...UUU:::...EEEEEEEE++++++++++++++++++..,,,.,.,..,,,jj...WWWWWWW++++LLLLLL..,,..ppp:pppp.::...yyyyyyy..444444444::...555555....XX
  31  XX.....xxxxxxD::ffffffffff...............:::...EEEEEEEE++++++++++++++++++.,,,,,.,,.,.,.rr...WWWWWWW++++LLLLLL.,t...ppp:pppp.::...yyyyyyy..444444444::.,,,,,,,,,,..XX
  32  XX.....xxxxxxx..ffffffffff...............:::...EEEEEEEE++++++++++++++++++.,.,,,,..,,,,,rr..........++++.......,..,.ppp:pppp.::...yyyyyyD..4444D4444::.,,,,,,,,,,..XX
  33  XX.....xxxxxxx..ffffffffff...............:::...........++++++++++++++++++.,,,,.,.,,,,..rr..........++++,,..,.,.,...ppp:pppp.::...yyyyyyyccccccccccccc.,,,,ee,,,,..XX
  34  XX.....xxxxxxx..ffffffffff...............::::::::::::::::::::::::::::::::::::::::::::::YY::::::::::::::,,.,.,,,.,,,ppp:pppp.::...yyyyyyyccccccccccccc.,,,,ee,,,,..XX
  35  XXkkk##kkkkkkkkkffffffffff...............::::::::::::::::::::::::::::::::::::::::::::::YY::::::::::::::.,,.,..,,,.,,..,,,,.IIDII.yyyyyyyccccccccccccc.,,,,,,,,,,..XX
  36  XXkkk##kkkkkkkkkkXXXXXXX........,..,.....:::bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbrrbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbIIIIIbbbbbbbbcccccccccccccb,,,,,,,,,,bbbb
  37  bbbbbbbbbbbbbbbkkbbbbbbbbbbbbbbbbbbbbbbbgggggbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbrrbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbIIIIIbbbbbbbbbbbbbbbbbbbbbb,,,,,,,,,,bbbb
  38  bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb~~~~~~~~ggggg~~~~~~bbbbbbbb~~~~~~~~~~~~~~~~~~~bbbbbbbb~~~~~~~~~~~~~~~~~~~bbbbbbbb~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  39  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ggggg~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  40  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ggggg~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  41  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ggggg~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  42  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ggggg~~bbbbbbbbb~~~~~~~~~~~~~~~~~~~~~~~bbbbbbbbb~~~~~~~~~~~~~~~~~~~~~~~bbbbbbbbb~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  43  bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbgggggbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
  44  XX,,,,,,,,,,,,,,,,,,,,,,,,,.,,,,,...,..,,:::.,,,,,.,,,,,,.,,,,,..,,,,,,,,,.,.,.,,,.,.,.,,.,,,..,,.,,..,,.,,.,,.,.,,...,.,...,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,XX
  45  XX,,,,,,,,,,,,,,,,,,,,,,,,,..,,,.,.,.,,.,:::,..,,,,..,,,,,.,.,.,.,,,,.,...,.,,,,.,..,,,,.,,.,,,,,,.,.,,,.,,,,..,,,,,,,.,.,..,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,XX
  46  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  47  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

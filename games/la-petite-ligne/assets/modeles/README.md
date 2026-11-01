# Modèles 3D de La Petite Ligne (démo)

Produits par script (Blender 5.2 sans interface), aucune ressource externe. Sources, planches de contrôle et outil de vérification: `games/la-petite-ligne/assets-src/modeles/`. Direction artistique: `docs/jeux/jeu-1/bible-artistique-demo.md`.

Tout reconstruire (environ 7 minutes, planches comprises): `bash games/la-petite-ligne/assets-src/modeles/construire.sh` (`--sans-planches` pour les seuls GLB).

## Fichiers

| Fichier | Contenu | Animations |
|---|---|---|
| `personnages.glb` | squelette `rig`, pièces des joueurs, quatre habitants de la démo et Lucie (hors démo) | 27 clips sur le squelette |
| `bourg.glb` | bâtiments, voie, quai, mobilier, sols, clôtures, nature (dont roncier, noisetier, rejet du chêne et jeune sapin du tour 8), rivière | aucune (pièces mobiles en nœuds à part) |
| `ferme.glb` | cases du potager, cultures (4 stades), récoltes, cueillette (pissenlit; tour 8: ail des ours, girolles; tour 9: mûres, noisettes, cèpes, sureau), sachets, outils (tour 9: outils de la Halte, perche d'allumeur), matériaux, poissons, poule, cage, mangeoire, tonneau d'eau | `hen_idle`, `hen_walk`, `hen_peck` |
| `train.glb` | locomotive, voiture, fourgon | `locomotive_roll`, `coach_roll`, `van_roll` |
| `maison.glb` | meubles, plats, objets de l'histoire, kit de modules (P1) | aucune |
| `faune.glb` | bêtes des moments rares (héron, oie, mésange bleue, renard; tour 7: chevrette, faon, martin-pêcheur), échelle, nichoir, chicot du chêne, brin de mousse, ablette, pieu d'amarrage | 41 clips, chacun sur le squelette de sa bête |
| `textures/` | `palette.png` (déjà incluse dans les GLB), `palette-mr.png`, `palette-emission.png`, variantes de saison `palette-ete.png`, `palette-automne.png`, `palette-hiver.png`, `personnages.png` | |

Chaque identifiant `model` des données du jeu (`donnees/*.json`, `donnees/cartes/halte.json`) est le nom exact d'un nœud de l'un de ces fichiers; `index.json` donne, pour chaque nœud racine, son fichier, son emprise et ses triangles.

## Contrôles avant livraison

À lancer sur tous les GLB avant chaque livraison (depuis `games/la-petite-ligne/assets-src/modeles/`), et joindre les planches de 4 vues à la planche avant et après:

- `duo-python verifier/rendre_audit.py <sortie> [bourg ferme ...]`: audit du directeur artistique. Pour chaque nœud racine, quatre vues de près (iso avant, iso arrière, profil rasant, perspective plongeante) en Workbench avec cavités, planche `<fichier>__<nœud>.png`, et rapport `<fichier>.json`: îlots isolés qui ne touchent aucune autre pièce (pièces qui flottent), faces inversées (indicatif: les surfaces ouvertes comme l'eau sortent en faux positifs), arêtes ouvertes.
- `duo-python verifier/controle_geometrie.py [fichier.glb ...]`: pièces qui flottent sans appui, faces inversées des volumes fermés, pièce longue (poutre, poteau) qui traverse une plaque (toit, auvent) de part en part. Rapport indicatif, chaque cas se vérifie à l'œil.
- `duo-python verifier/quatre_angles.py <fichier.glb> <nœud> <image.png>`: rendu Cycles d'un nœud sous quatre azimuts, pour un contrôle de près (`--pose <clip>:<image>` pour la faune, `--azimuts 90,270 --elevation 4` pour un profil strict).
- `node verifier/verifier.cjs` (depuis la racine du dépôt): chargement dans Three.js 0.187 sous Chromium, animations comprises.
- Validateur glTF (`gltf-validator`, `validateBytes` en Node): aucune erreur.

Liste de contrôle de la bible (section 8.10): rien ne flotte, rien ne traverse, chaque pièce s'arrête sur ce qui la porte, un toit repose sur une structure lisible, marches de 15 à 20 cm de haut et 25 à 30 cm de profond sur des limons ou un massif, portes de 2 m à 2,10 m; au bon endroit, dans le bon sens, à la bonne taille.

## Conventions

- 1 unité = 1 m, Y en haut. Façade (porte) et regard vers +Z. Origine au centre de l'emprise, au niveau du sol. Emprises en cases entières (champ `footprint` des extras, `[largeur le long de la façade, profondeur]`).
- Exception: le train est aligné sur le module de voie `rail_straight` (le long de X), l'avant de la locomotive vers +X; ses roues touchent le rail à 0,32 m, origine au sol sur l'axe de la voie.
- Les extras glTF (`userData` dans Three.js) portent les données utiles: `footprint`, `door_cell` (case de la porte comptée depuis la gauche vue de dehors, comme dans la carte), `walk_height`, `seat_height`, `sleep_height`, `sleep_spots`, `light_anchor`, `states`, `alias_of`, notes.
- Un seul matériau par fichier: `lpl_palette` (décor) ou `lpl_characters` (personnages). Filtrage au plus proche, faces à une seule face (pas de double face).
- Émission de nuit: le matériau `lpl_palette` est exporté avec l'émission à 1 (vitres, lanternes, flammes, braises, cadran du poste). Le jeu met `material.emissiveIntensity` à 0 le jour et à 1 la nuit.
- Saisons: remplacer `material.map` par la texture de la saison (même disposition, `flipY = false`, `colorSpace = SRGBColorSpace`, `NearestFilter`).
- Low poly arrondi (décision du client du 2026-10-31, bible artistique section 8): facettes gardées (une normale par face), angles droits cassés par des chanfreins de 2 segments au plus, arêtes au sol vives. Témoins déjà refaits: `firmin_house` (angles des murs, chaînes d'angle enveloppantes, rives de toit épaisses chanfreinées, faîtage fléchi de 8 cm, pans bombés de 6 cm, pierres d'angle aux coins abattus irréguliers), `tree_oak_small`, `tree_oak_large` (tronc à 8 pans évasé, 3 racines, boules facettées de 80 faces), `bush_round` (deux boules aplaties) et toutes les pièces des joueurs (tête en boule facettée de 34 cm, coiffures en lobes, torse octogonal bombé aux épaules arrondies, membres à 6 pans renflés, moufles, chaussures en galets, foulard agrandi d'un tiers avec un pan qui dépasse). Depuis, tout le décor y est passé: habitants (`build_npc_round`), bâtiments (`gable_roof` arrondi, toits relevés de 3 cm pour que les pignons ne les percent plus, chaînes d'angle aux coins abattus), arbres, buissons, mobilier et meubles par l'arrondi automatique de `lpl.Geo.box` (`lpl.AUTO_ROUND`: chanfrein selon la taille, arêtes au sol vives, murs chanfreinés sur leurs seuls angles verticaux, détails de moins de 60 cm et planches de moins de 8 cm laissés vifs dans les bâtiments pour tenir le budget). La voie, les sols, la rivière et les modules de murs restent vifs (raccords bord à bord). Budget (bible 8.8): pas de chanfrein automatique sur les pièces de moins de 2 m (`lpl.AUTO_MIN`), jamais sur les dessous; `gatekeeper_house` environ 3 500 triangles par état, `arbor` et `flower_bed` sous 900. `log_pile` est désormais un modèle à part (rondins croisés), différent de `woodpile`. Planche: `docs/jeux/jeu-1/gauntlet/captures/tour-05/arrondi-planche.png` (`assets-src/modeles/planche_arrondi.py` puis `planche_arrondi.sh`).
- Optimisation: `bourg`, `ferme`, `train`, `maison` passent par gltf-transform (dédoublonnage, soudure, élagage). Ni quantification ni compression: aucune extension requise, aucun décodeur à brancher, et l'on peut poser `position`, `rotation` et `scale` sur un nœud cloné sans risque (la quantification range sa déquantification dans la transformation des nœuds: à éviter, ou alors envelopper chaque nœud dans un groupe). Total des cinq fichiers: environ 6,5 Mo. Si le poids devient un sujet, la compression Meshopt (avec `MeshoptDecoder`, livré avec Three.js) le divise par trois ou quatre.

## Personnages

- Un seul squelette `rig` (18 os: `root`, `hips`, `spine`, `chest`, `neck`, `head`, `upper_arm_l`, `forearm_l`, `hand_l`, idem `_r`, `thigh_l`, `shin_l`, `foot_l`, idem `_r`) et des maillages à peau liés à ce squelette, à la racine du fichier.
- Instancier un personnage: `SkeletonUtils.clone(gltf.scene)`, puis ne garder visibles que ses pièces. Un joueur = `player_base` + une tenue `player_outfit_work | smock | overalls` + une coiffure `player_hair_short | bob | bun` + un foulard `player_scarf_<symbole>` (`orb`, `crescent`, `star`, `sun`, `planet`, `comet`, comme les profils Duo). Les quatre pièces partagent le matériau: on peut les fusionner (même squelette) pour un seul appel de dessin.
- Couleurs d'un joueur: la texture `personnages.png` a une rangée de 16 cases (4 px) par personnage. Les pièces des joueurs lisent la rangée 0. Pour chaque joueur, cloner le matériau, peindre une CanvasTexture de 64 x 64 (copie de `personnages.png`) dont la rangée 0 reçoit ses couleurs, avec `flipY = false`, `NearestFilter`, `SRGBColorSpace`. Ordre des cases: peau, ombre de peau, cheveux, cheveux sombres, yeux, bouche, haut, liseré, bas, chaussures, foulard, symbole du foulard, accessoire A, accessoire B, métal, joues. Choix proposés (tenues, peaux, cheveux, foulards): `PLAYER_PRESETS` dans `assets-src/modeles/palette.py`.
- Habitants: `villager_firmin`, `villager_odette`, `villager_basile`, `villager_jeanne` (et `villager_lucie`, hors démo). Jeanne se pose à l'échelle 0,75 (extra `scale`).
- Expressions: clés de forme sur `player_base` et chaque `villager_*`: `happy` (contente), `delighted` (ravie), `tired` (fatiguée), `hungry` (affamée), `blink` (yeux fermés, pour dormir et cligner); toutes à 0 = neutre. Une seule à 1 à la fois (`morphTargetDictionary`).
- Objets tenus: accrocher le nœud de l'objet sous `socket_hand_r` (ou `socket_hand_l`) sans transformation. Les outils de `ferme.glb` ont leur origine au point de prise et pendent comme dans une main au repos.
- Animations sur place (la racine ne bouge pas, seul `hips` monte et descend):
  - `walk`: deux pas en 0,533 s pour 3,5 m/s; `timeScale = vitesse / 3,5`.
  - `carry_two`: marche à 1,8 m/s bras levés; la poutre (`beam`, extra `carry_height` 1,78) se pose au-dessus des deux porteurs, l'un derrière l'autre, sa longueur selon Z.
  - `sit` et `sit_eat`: bassin abaissé, assise à 0,47 m (chaise `seat_height`); placer le personnage à l'origine de la chaise, même orientation.
  - `sleep`: allongé sur le dos, dos à 0,5 m (lit double); tête vers -Z, pieds vers +Z, comme le lit. Paillasse (`sleep_height` 0,15): abaisser le personnage de 0,35 m. Mettre `blink` à 1.
  - `give` et `high_five` se jouent une fois (`LoopOnce`, `clampWhenFinished`); les autres bouclent.
  - P1 de la démo déjà faits: `pet` (caresser une poule, accroupi), `high_five`, `sit` sur le banc (assise du banc 0,45 m).
  - Pêche, canne `fishing_rod` sous `socket_hand_r`: `fish_cast` (lancer en 1 s, une fois: armé derrière la tête à 0,33 s, canne verticale à 0,47 s, lâcher vers l'avant à 0,6 s, retour à l'attente), `fish_wait` (attente en boucle, canne devant à environ 40 degrés), `fish_strike` (ferrer puis mouliner, 1,6 s, une fois, finit sur la pose d'attente). Les trois commencent et finissent sur la même pose: on enchaîne sans saut.
  - `sit_ground`: assis par terre en boucle, bassin au sol, genoux levés, bras autour des jambes (absence, veillée sur la paillasse: poser le personnage sur le dessus de la paillasse, 0,15 m).
  - Échelle de Basile (tour 6), sur `ladder_wood` de `faune.glb`: `climb_ladder` (boucle de 1,2 s = deux barreaux, 0,6 s par barreau; la racine reste sur la ligne de l'échelle au niveau des pieds, le jeu la monte de 0,28 m par barreau, soit 0,467 m/s; le corps est 0,16 m derrière elle; pieds posés à 0 s et 0,6 s; descendre = le jouer à l'envers), `reach_up` (0,8 s, une fois: la main droite prend le coin bas du nichoir penché à sa droite, contact à 0,3 s, puis le ramène droit), `hammer_tap` (0,6 s, choc à 0,25 s, à répéter trois fois; marteau de `ferme.glb` sous `socket_hand_r`, il tape le haut du nichoir). Les trois partent de la même pose (pied gauche sur un barreau, pied droit un barreau plus haut): monter un nombre impair de barreaux. Joueurs: `hold_ladder` (boucle de 2 s, face au montant à 0,35 m, mains à 0,9 et 1,2 m, pieds écartés).

## Bâtiments et pièces mobiles

- `gatekeeper_house` (maisonnette, 7 x 6): deux états enfants `gatekeeper_house_ruin` et `gatekeeper_house_repaired`, à montrer l'un ou l'autre. Chaque état a ses nœuds `_floor`, `_wall_front`, `_wall_back`, `_wall_left`, `_wall_right`, `_attic` (grenier du fond), et un groupe `_roof`: on cache le toit, le grenier et les deux murs côté caméra quand un joueur entre. Pièce jouable de 5 x 4 cases (extra `interior`), plancher à 0,12 m, porte sur la case 3 (au milieu de la façade).
- Chantier guidé du jour 1 (12 éléments): le toit réparé est découpé en 11 pièces `gatekeeper_house_repaired_roof_part_01` à `_11` (5 bandes par pan et le faîtage, la cheminée dans la pièce 10) plus la porte `gatekeeper_house_repaired_door` (pivot sur le gond gauche: tourner autour de Y pour l'ouvrir). Fantômes: mêmes nœuds en transparence.
- `henhouse` (poulailler, 3 x 3): états `henhouse_ruin` et `henhouse_repaired`, chacun en `_walls`, `_roof`, `_door`, `_ramp`, `_fence` (chantier: 8 planches, 2 clous).
- `station`: horloge `station_clock` avec ses aiguilles `station_clock_hour` et `station_clock_minute` (tourner autour de leur axe Z local selon l'heure du jeu: la pendule de Firmin). Corps et toit séparés (`station_body`, `station_roof`).
- `platform` (quai 30 x 4, marchable à 0,4 m, rampes aux deux bouts): `platform_base` et `platform_canopy` (marquise de 10 m centrée, côté +Z); le bord côté voie (pierres claires) est à -Z.
- `handcar_shed` (remise): portes `handcar_shed_door_l` et `_r`, pivots sur les gonds (tourner de -100 et +100 degrés autour de Y pour ouvrir sur la draisine). `handcar` (draisine): balancier `handcar_lever` (pivot sur son axe X local, plus ou moins 20 degrés).
- `level_crossing_gate`: lisse `level_crossing_gate_arm` (pivot sur Z, 0 baissée, +80 degrés levée).
- `bell_post` (cloche du quai, sous la marquise): cloche de 0,55 m de large depuis le tour 6 (0,40 avant) et 0,31 m de haut, bas toujours à 1,95 m, centre inchangé à x 0,55 (bord est à x 0,825, soit 30,33 posé en x 29,5, hors de la marquise qui commence à 31); bras inchangé (bout à x 0,62). Plus haute ou décalée vers l'est, son ombre toucherait le banc dès 16 h 20: l'énigme de l'ombre (17 h à 17 h 45, `src/rendu/lumiere.test.ts`) ne tiendrait plus.
- `workbench`: l'établi de Basile sous son propre auvent (2 x 2), à côté de `sawmill`.
- Rivière: modules `river_straight` et `river_ford` (4 m le long de X, 8 m de large, axe en z = 0) et `river_curve` (10 x 10, axe de rayon 6 m: entre par le bord -Z en x = -1, sort par le bord +X en z = +1). L'eau est un nœud à part `*_water` à -0,3 m (à animer ou à changer de matériau); les berges descendent sous le sol: le terrain du jeu doit laisser la place à la rivière.
- Voie: `rail_straight` (4 m le long de X, 2 m de large, 5 traverses, raccord sans couture), `rail_curve_90` (quart de cercle de rayon 12 m, emprise 13 x 13: la voie entre par le bord -Z en x = -5,5 et sort par le bord +X en z = +5,5, centre de courbure au coin x = +6,5, z = -6,5), `buffer_stop`. Voie métrique, rails à plus ou moins 0,5 m de l'axe, dessus du rail à 0,32 m.
- Noms génériques de la carte: `tree_oak`, `tree_fir`, `bush`, `rock`, `fence`, `log_pile` sont des nœuds qui partagent le maillage d'une variante (`tree_oak_large`, `tree_fir_large`, `bush_round`, `rock_medium`, `fence_wood`, `woodpile`); les variantes restent disponibles pour varier le décor.

## Train

- Roues de 0,45 m de rayon partout: chaque clip `*_roll` fait un tour de roue en 1 s (2,83 m parcourus): `timeScale = vitesse / 2,83`; vitesse nulle = clip en pause. La locomotive anime aussi ses bielles (`locomotive_rod_l`, `_r`).
- Longueurs hors tampons (extra `length_over_buffers`): locomotive 7,4 m, voiture 9,0 m, fourgon 7,0 m.
- `locomotive_smoke`: nœud vide au sommet de la cheminée, point d'émission du panache (technical artist).

## Pêche (`ferme.glb`)

- `fishing_rod`: origine à la prise; la canne monte à 42 degrés devant la main (bout à x 0, y 1,34, z 1,49 dans le repère de la prise), nœud vide `fishing_rod_tip` au bout pour accrocher la ligne. Ligne et bouchon ne font pas partie du modèle: le jeu dessine la ligne jusqu'au bouchon `fishing_float` (origine au niveau de l'eau).
- Poissons `fish_gudgeon`, `fish_chub`, `fish_trout` pour la prise qui saute au sac.

## Maison

- Meubles muraux (`shelf`, `curtains`, `picture_frame`): dos contre le bord arrière de leur case (-Z).
- `oil_lamp`: nœud vide `oil_lamp_light` à la flamme pour une lumière ponctuelle chaude.
- `double_bed`: deux places (`sleep_spots`), `table` dessus à 0,78 m, `chair` assise à 0,47 m.
- Kit de modules P1: `kit_wall_stone`, `kit_wall_wood`, `kit_door`, `kit_window` (murs de 1 m sur le bord arrière de la case, 2,4 m de haut), `kit_floor_wood`.

## Budgets (PC de référence, `docs/plateforme/architecture.md` section 14)

- Toute la carte de la démo (`donnees/cartes/halte.json`: 196 objets, dont 79 buissons et 51 arbres): environ 43 000 triangles de décor avant le low poly arrondi (les 30 chênes et 79 buissons arrondis en ajoutent environ 13 000, la maison de Firmin 2 300), plus 16 modules de voie (4 700), le potager (environ 4 000 avec ses cultures) et six personnages (environ 14 000): moins de 70 000 triangles, pour un plafond de 250 000.
- Personnages: 2 160 à 2 590 triangles par habitant, 2 006 pour un joueur complet (base, tenue, coiffure, foulard). Accessoires: 40 à 650 triangles.
- Appels de dessin: un matériau par fichier; décor statique à fusionner ou à instancier par le jeu (arbres, buissons, clôtures, cultures et cases du potager se prêtent à `InstancedMesh`).
- Textures: une palette de 64 x 64 (et ses compagnes), une texture de personnages de 64 x 64: moins de 100 Ko de mémoire.

## Faune des moments rares (tour 6, `faune.glb`)

Fiches: `docs/jeux/jeu-1/tour-06-conception.md` section 1.4. Sources: `assets-src/modeles/faune.py` (modèles et clips), `planche_faune.py` (planches des clips, échelle, zoom 1), `scene_echelle.py` (scène de l'échelle avec les vrais GLB), `verifier/quatre_faune.sh` (quatre angles de chaque modèle). Planches: `docs/jeux/jeu-1/gauntlet/captures/tour-06/faune-*.png`.

- Une bête = un nœud racine (son squelette: `heron`, `goose`, `blue_tit`, `fox`) avec son maillage enfant `<bête>_mesh` (peau rigide par pièce), comme la poule. Instancier par `SkeletonUtils.clone`; jouer toujours un clip (la pose de repos du héron et de l'oie a les ailes dépliées). Les clips sont sur place: le jeu déplace et oriente la racine (chorégraphies de la fiche).
- Tailles réelles: héron 0,95 m debout (1,0 m cou tendu, envergure 1,70 m), oie 0,80 m (envergure 1,60 m, tête à 0,40 m au-dessus de l'eau), renard 0,40 m au garrot (corps 0,65 m, queue 0,40 m). Mésange agrandie x 1,5 (0,18 m) et sa mousse avec elle (0,06 m): à taille réelle elle tient en 10 pixels au zoom 1 et sa calotte bleue ne se lit plus (planche `faune-mesange-zoom1.png`). Extra `display_scale`.
- Origines: au sol sous les pattes (héron, renard); ligne de flottaison (oie); pattes sur le perchoir (mésange). La mousse s'accroche sous `socket_blue_tit_beak`, sans transformation.
- `ladder_wood`: 3,0 m, penchée à 75 degrés vers +Z (la poser avec la même rotation que Basile qui y grimpe), origine au milieu du pied, montants de 0,05 x 0,07 coupés à plat au sol et contre le tronc, 10 barreaux à 0,28 m de hauteur l'un de l'autre (le premier à 0,28 m, le dernier à 2,80 m), tête à `top` [0 ; 2,898 ; 0,776].
- `nest_box`: 0,15 x 0,25 m, 0,18 m de profondeur avec la planche de dos qui dépasse au-dessus du toit pour le clou; trou de 28 mm à 0,17 m du bas, toit goudronné débordant de 4 cm. Origine sur le clou (dos contre l'écorce): le centre de la caisse est 0,175 m sous le clou et 0,09 m devant. Penché: rotation de 25 degrés autour de Z glTF, le bas vers +X (vers l'est sur la carte, à l'opposé de l'échelle proposée). Perchoir du toit: extra `roof_perch`.
- `oak_branch_stub`: origine au bout (dessus), là où la mésange se pose; il repart vers le tronc de `tree_oak_01` posé à rotation 0.
- Budgets (bible 8.8, poule 500, accessoire 900): héron 866, oie 406 (neuf instances: 3 654), mésange 304, renard 798, échelle 176, nichoir 156, chicot 60, mousse 96 triangles. Héron et renard dépassent le plafond de la poule (500) mais restent sous celui d'un accessoire (900): une seule bête de chaque à l'écran, pendant un moment rare. Aucun nouveau matériau; 17 cases ajoutées en fin de palette (`palette.py`, de `heron_grey` à `tar`).
- Retouches du tour 6 (revue G8 du directeur artistique, planches `retouche-faune-*.png`):
  - mésange: tête en bandes de facettes (`banded_ball` de `faune.py`: calotte bleue, liseré blanc, bandeau noir du bec à la nuque, joue blanche, collier), plus de barre posée qui dépasse; ailes en coquilles arrondies couchées sur les flancs, modelées repliées (le vol les ouvre par roulis de 90 degrés puis lacet de -80 dans `tit_fly` et `tit_exit`); queue en fuseau aplati.
  - héron: ailes repliées montrées par deux coquilles sur les flancs (os `heron_body`) avec les rémiges sombres croisées sur la queue; au repos, les ailes de vol sont réduites (échelle 0,04) et rentrées dans le corps, et se déploient entre deux clés au décollage, y rentrent à l'atterrissage. `heron_grey` assombri (#7F888E, L* 56 au lieu de 66) contre les galets du gué; sourcil noir peint sur les facettes de la tête.
  - oie: queue courte enfoncée dans le croupion, dessus couleur du dos, pointe à peine relevée, dessous blanc.
  - renard: plastron, museau et bout de queue blancs agrandis d'un tiers. Roux inchangé: éclairci (#E58A4C), il rejoignait en jeu la valeur de l'herbe du soir (L* 27 contre 30, au lieu de 22 contre 30), donc moins lisible en niveaux de gris (essai en bas de `retouche-faune-gris-daltonisme.png`).

## Faune du tour 7 (`faune.glb`: chevrette, faon, martin-pêcheur)

Fiches: `docs/jeux/jeu-1/tour-07-conception.md` sections 1.4.7 et 1.4.8. Mêmes sources et conventions que le tour 6 (nœud racine du nom de la bête, maillage enfant `<bête>_mesh`, peau rigide par pièce, clips sur place). Planches: `docs/jeux/jeu-1/gauntlet/captures/tour-07/faune-*.png` (`verifier/quatre_faune.sh <dossier> tour7`, `planche_faune.py <dossier> clips roe_deer,fawn,kingfisher`, puis `echelle7`, `zoom1kf`, `contraste7`).

- `roe_deer` (chevrette, sans bois): 0,70 m au garrot, tête dressée à 1,05 m (`deer_lookup`, `deer_stamp`), 1,10 m du mufle à la croupe; pelage d'été roux (`chicken_russet`, dos `fox_red_dark`, ventre `burlap`), mufle noir à bande blanche, menton blanc, oreilles en ovale large (0,13 x 0,072 m, bout arrondi), creusées en cornet (creux crème, dos gris-brun `wood_old`), écartées en V à 40° de la verticale, pavillon tourné de 25° vers dehors, os dans l'axe de chaque oreille (correctif G8 du tour 7: les lames étroites se lisaient de profil comme des dagues de brocard; `correctif-oreilles-*.png`), écusson fessier crème et pinceau de poils en petit lobe fondu dessous (vus pendant `deer_bound`). Os préfixés `roe_`, 20 os. Dans `deer_watch_fawn` et `deer_lick`, la tête tourne vers sa gauche: orienter la chevrette le faon à sa gauche. `deer_bound`: bond sur place de 0,8 s, racine à 0,60 m au sommet, à boucler pour deux bonds.
- `fawn` (faon de trois semaines): 0,45 m au garrot, 0,65 m de long, pattes grêles, livrée rousse à taches blanches en deux rangées le long du dos (bandes de facettes, rien de posé). `fawn_rustle` est la pose couchée au lit (pattes repliées, cou bas): posé à -0,3 m comme la fiche, seules les oreilles dépassent, d'environ 2 cm (sommet à 0,32 m, extra `bed_ears_top`); oreilles de même forme que la mère (0,105 x 0,06 m, V à 35°). `fawn_rise` (0,8 s) lève l'arrière-train d'abord (0,17 s), à genoux devant (0,33 s), puis l'avant. `fawn_suckle`: tête relevée sous le flanc, queue qui frétille.
- `kingfisher` (martin-pêcheur) agrandi x 1,5 comme la mésange (0,26 m, envergure 0,38 m; extra `display_scale`): à taille réelle il tient en 3 pixels sur son pieu au zoom de départ (24 m de large, 57 px/m) et son bleu ne se lit plus; à x 1,5, 5 à 6 pixels où le bleu et le roux se distinguent (`faune-martin-pecheur-zoom1.png`). Dos cobalt (`tit_blue`) avec la raie turquoise vive (`kingfisher_teal`, seule case ajoutée à la palette), ventre roux orangé (`goose_bill`), gorge et tache du cou blanches, pattes rouges. Ailes repliées en coquilles; ailes de vol réduites (échelle 0,04) au repos, déployées dans `kf_fly` (4 images, 0,133 s au lieu des 0,12 s de la fiche: l'export échantillonne à 30 images par seconde). `kf_dive` monte et avance la racine de 0,11 et 0,05 m pour que le bec ne traverse pas le pieu. Accroche du poisson: `socket_kingfisher_beak` (sur l'os `kf_head`).
- `small_fish` (ablette): 0,12 m (0,08 m x 1,5, comme l'oiseau), origine au milieu du corps, tête vers +X glTF: sous `socket_kingfisher_beak` sans transformation, il est pris en travers du bec, tête à gauche de l'oiseau. Case `fish_silver` (rugosité 0,3, métal 0,3) pour le reflet.
- `mooring_post` (pieu d'amarrage): chêne de 0,14 m à 6 pans, 1,40 m. Origine au bord du sommet, comme l'accroche `kingfisher_post` de la carte (z 0,95 au-dessus de l'eau); le sommet usé bombe de 2 cm (l'oiseau s'y tient à 0,97 m, comme la fiche), ligne d'eau à -0,95 m (bande de mousse), pied à -1,40 m fiché dans le lit. Anneau de fer à 0,60 m au-dessus de l'eau, à plat contre la face +Z glTF (vers le large), pendu à un crampon.
- Amarre du ponton (`pontoon` de `bourg.glb`, correctif G9 du tour 7): la bitte du coin est retirée (elle doublait le pieu à 10 cm). Une glène de deux tours reste couchée sur le platelage, l'amarre passe le bord et file à l'anneau du pieu, nœud sur l'anneau, bout libre qui pend de 0,30 m vers l'eau. Le pieu étant posé par le jeu depuis la carte, l'amarre est modelée dans le ponton vers la position réelle de l'anneau en jeu (constantes `POST_MAP`, `POST_TOP`, `POST_SCALE`, `PONTOON_MAP` en tête de `_pontoon_rope` dans `bourg.py`): si le pieu ou le ponton bougent sur la carte, les reprendre. Contrôle: `verifier/ponton_pieu.py <bourg.glb> <faune.glb> <image.png>` (coin du ponton et pieu posé comme en jeu, quatre angles et dessus).
- La brume de l'Aubrune n'a pas de modèle (fiche 1.4.9): nappes, volutes et éclats sont des effets du technical artist.
- Budgets (bible 8.8; pas de ligne pour la faune, plafond d'un accessoire 900 comme au tour 6): chevrette 892, faon 896, martin-pêcheur 416, ablette 124, pieu 162 triangles. Au plus chargé du moment, chevrette et faon ensemble: 1 788 triangles. Fichier: 1 046 Ko après dédoublonnage, soudure et élagage (543 Ko avant le tour 7: trois bêtes et 18 clips de plus).

## Cueillette et lisière du tour 8 (`ferme.glb`, `bourg.glb`)

Fiche: `docs/jeux/jeu-1/tour-08-conception.md` sections 5.1 et 5.2. Sources: `assets-src/modeles/cueillette.py` (appelé par `ferme.py` et `bourg.py`), `planche_cueillette.py` (échelle, zoom 1, au sol), `verifier/quatre_cueillette.sh` (quatre angles), `verifier/mesures_cueillette.py` (emprises et point bas mesurés dans les GLB), `verifier/souche_et_plants.py` (jeune sapin à côté de la souche et brins du rejet à toutes les échelles: contacts par arbres BVH), `verifier/nettoyer_bourg.sh` (nettoyage de `bourg.glb` seul, même chaîne que `construire.sh`). Planches: `docs/jeux/jeu-1/gauntlet/captures/tour-08/objets-*.png`, correctifs de la revue du tour 8 dans `correctif-*.png`.

- Objets de cueillette (`kind: "item"`, origine au centre de la base, posés au sol comme le pissenlit), grossis deux à trois fois par rapport au réel pour tenir au moins 14 pixels au zoom de départ (57 px/m, leçon du martin-pêcheur), extra `size_m` = plus grande dimension:
  - `wild_garlic` (ail des ours, printemps): touffe de huit larges feuilles en volume (section en chevron) et deux ombelles blanches à 0,31 m; le blanc fait la lecture sur l'herbe. 0,41 x 0,38 m, 0,35 m de haut.
  - `chanterelle` (girolles, été et automne): bouquet de quatre, pied évasé en entonnoir, chapeau creux au bord ondulé, jaune d'oeuf (`flower_center`, dessous `fabric_yellow`). 0,30 x 0,26 m, 0,15 m de haut.
  - `blackberry` (mûres, été; remplacé au tour 9 par trois grappes, voir plus bas): brin cueilli, cinq fruits noirs (case `blackberry`, luisante) et deux encore rouges sur trois folioles, posé à plat (point bas à 0). Se pose sur le roncier à l'un des points `berry_spots` de `bramble` (repère glTF du nœud `bramble`: x, hauteur, z vers l'avant; déjà enfoncés de 1,5 cm pour que le brin se cale sur le dessus bombé), sinon au sol. 0,30 x 0,16 m.
  - `hazelnut` (noisettes, automne; remplacé au tour 9 par le tas sur jonchée, voir plus bas): tas de sept noisettes (cicatrice pâle à la base) et une huitième debout dans son involucre de trois bractées, sur deux feuilles de noisetier tombées (`leaf_hazel`: jaunes avec la palette d'automne, comme le noisetier). 0,33 x 0,23 m, 0,13 m de haut.
- `bramble` (roncier, posé contre la lisière au nord des coins 03 à 05): 1,18 x 0,64 m, 0,61 m de haut, dans l'emprise de 1,2 x 0,8 m (extra `size_m`), emprise de carte 1 x 1. Repris au tour 8 (le premier se lisait comme une araignée verte: quatre tiges fines terminées par une boule en l'air): un fourré bas en deux bosses (`ivy`) qui couvre l'emprise, un massif plus haut au milieu (`leaf_bush`, `ivy`) et six ronces en arceau de tailles différentes. Chaque ronce sort du massif à mi-hauteur, monte à 0,4 ou 0,45 m (sous le dessus du massif), retombe en pente par-dessus le fourré et plante son bout dans le sol (enfoncé de 2 cm), comme une ronce qui marcotte; sept petites feuilles en losange (8 triangles, 8 à 13 cm) le long de chaque tige, aucune boule au bout. Aucune tige devant la face avant (+Z) ni sur le dessus, où se posent les mûres (extra `berry_spots`, recalculé par lancer de rayons sur le dessus réel). Sans fruits: les mûres sont l'objet `blackberry`, qui disparaît à la cueillette. 860 triangles: au-dessus du plafond d'un buisson (160, pensé pour 79 instances), sous celui d'un accessoire (900); trois instances sur la carte.
- `bush_hazel` (noisetier, variante de `bush` déjà tirée pour un quart des buissons de la carte par `MODEL_VARIANTS`): refait en low poly arrondi, quatre brins en vase depuis une même souche, feuillage de trois boules de 0,55 à 1,97 m; chaque brin finit dans le feuillage. 160 triangles (plafond d'un buisson). Change l'aspect des noisetiers déjà posés sur la carte (même taille qu'avant, environ 2 m).
- `oak_sapling` (rejet du chêne, P1): même souche que `tree_stump` (la souche de l'abattage reste en place, le rejet en sort), et son enfant `oak_sapling_shoots` (nœud vide, origine au centre du dessus de la souche, à 0,42 m), qui porte quatre brins `oak_sapling_shoot_a` à `oak_sapling_shoot_d` (extra `grow_nodes`). Tour 8: un chêne rejette de l'écorce, pas du bois de la coupe; chaque brin naît sur le flanc, 4,5 cm sous la coupe, sort à l'horizontale, s'écarte puis monte jusqu'à 1,68 m, et la coupe reste nue. L'origine de chaque brin est son pied: pour la pousse (0,4 à 1), mettre à l'échelle chaque brin autour de son pied, jamais la souche (extra `grow_node`). Mis à l'échelle d'un bloc depuis le centre de la coupe (rendu du tour 8), le pied glisse vers le milieu de la coupe (0,07 m de l'axe à 0,4): voir « Rendu à adapter » ci-dessous. 440 triangles (plafond d'un chêne: 450).
- `fir_sapling` (jeune sapin planté par Basile, P1): 1,24 m, trois étages à 7 pans comme les grands sapins, tige visible, cuvette de plantation de 0,4 m. Tour 8: on ne dessouche pas pour replanter au même trou; la souche `tree_stump` reste au centre de la case et le plant se pose à côté, 0,6 m au sud (extra `beside_stump`: décalage x, hauteur, z en repère glTF, sans rotation). Étages resserrés (0,31 m de rayon en bas) pour que le plant ne touche pas la souche de l'échelle 0,7 à 1,3 (contrôlé par `verifier/souche_et_plants.py`: aucun triangle en contact). Peut s'agrandir d'un bloc jusqu'à 1,3. 170 triangles (plafond d'un sapin: 300).
- `tree_stump` (déjà livré): racines refaites en cônes à 5 pans qui plongent dans le sol (c'étaient des pavés), 136 triangles; le reste est inchangé.
- Palette: case `blackberry` (#2E2136, rugosité 0,35) en fin de liste (`palette.py` et `src/rendu/palette.ts`); les cueillettes n'apparaissent qu'en leur saison et les feuillages du roncier et du noisetier suivent déjà `leaf_bush` et `leaf_hazel`.
- Vigne de la tonnelle (`arbor`, tour 8): la vigne est caduque, elle ne prend plus les cases `ivy` (lierre, persistant) ni `leaf_oak`. Deux cases ajoutées en fin de liste, avec leurs valeurs de saison: `vine_leaf` (printemps #5E8B45, été #577F3E, automne #B8862F, hiver #6E5A48, feuilles sèches) et `vine_leaf_dark` (#4C7638, #466B33, automne #8E4A2E pour le rouge de la vigne, hiver #5E4B3C). Trois touffes sur douze sont sur `vine_leaf_dark`. Mieux encore l'hiver, si le rendu le veut: masquer les touffes et ne laisser que les sarments (voir « Rendu à adapter »).
- `bush_bramble` (ancienne variante de `bush`, boule à petits cubes blancs) n'est pas touché: il reste distinct du roncier de cueillette.
- Rendu à adapter (dev rendu, `src/rendu/potager.ts`), demandé par la revue du tour 8:
  - rejet du chêne: pour chaque enfant `oak_sapling_shoot_*` de `oak_sapling_shoots`, instancier le brin seul avec la matrice T(arbre, sol + hauteur de `oak_sapling_shoots`) x R(lacet de l'arbre) x T(position de l'enfant) x S(taille), au lieu du nœud entier mis à l'échelle depuis le centre de la coupe; la souche reste `stump`;
  - jeune sapin: dessiner aussi `stump` au centre de la case, et poser `fir_sapling` à (x, sol, y) + `beside_stump` (0, 0, 0,6), soit 0,6 m au sud, avec son lacet et son échelle autour de son propre pied; la cible de clic suit le plant.

## Tour 9: chantiers, outils, maison, cueillette d'automne, moments (`docs/jeux/jeu-1/tour-09-conception.md`)

Sources: `chantiers.py` (appelé par `bourg.py`), `maison_t9.py` (par `maison.py`), `chouette.py` (par `faune.py`), `cueillette.py`, `ferme.py`, `personnages.py`. Planches: `planche_tour9.py` (échelle, maison, posés, zoom 1 mesuré), `rendus_personnages.py <dossier> tour9|equipage`, `verifier/quatre_tour9.sh` et `verifier/quatre_poses.sh` (quatre angles), sorties dans `docs/jeux/jeu-1/gauntlet/captures/tour-09/modeles-*.png`.

Chantiers (`bourg.glb`, extra `improvement` = identifiant du chantier):
- `ford_bench` (2 x 1, `seat_height` 0,45, `seat_spots`): madrier de chêne de 1,8 m sur deux tréteaux posés sur des pierres plates, sans dossier; avant (+Z glTF) vers l'eau.
- `house_bench` (2 x 1): banc à dossier, accoudoirs; le haut du dossier touche un mur à `wall_back` = 0,386 m derrière l'origine. Le nu du soubassement du pignon est de la maisonnette est à x = 11,33 (mur à 11,30): origine du banc à x = 11,72, tourné vers l'est; les sièges débordent alors dans les cases (12, 22) et (12, 23), où l'on se tient pour s'asseoir. Posé dans la case 12 elle-même, il resterait à 0,7 m du mur (à trancher par le level designer, voir le compte rendu).
- `quay_planter` (1 x 1, une par case, trois posées): caisse verte cerclée de fer; enfants `quay_planter_summer` (géraniums rouges, aussi au printemps), `quay_planter_autumn` (asters mauves), `quay_planter_winter` (paillage et branches de sapin), extra `seasons`: n'en montrer qu'un.
- `well` est désormais le puits ouvert (le toit est un chantier): margelle inchangée, enfant `well_gallows` (arceau de fer, poulie, seau sur la margelle) à cacher quand `well_roof` est bâti. `well_roof` (2 x 2, même origine que `well`): quatre poteaux sur dés hors de la margelle, sablières, entraits, arbalétriers, toit de tuiles à deux pans, faîte à 2,4 m, dans l'emprise; treuil sur deux lisses à 1,3 m, manivelle à l'est, seau au-dessus de l'eau. 1 040 triangles (au-delà du plafond d'un accessoire, 900, en deçà d'un petit bâtiment, 3 000: c'est une petite construction).
- `door_canopy` (sans emprise): origine au nu de la façade avant de `gatekeeper_house_repaired`, au droit de la porte, au sol, soit (0, 0, 2,30) dans le repère de la maisonnette. La rive du toit ne couvre que 0,33 m devant le mur (dessous à 2,20 puis 2,12 m): l'auvent se glisse dessous (haut à 2,08 m) et abrite jusqu'à 1,15 m du mur, bord à 1,93 m (on passe dessous à 1,74 m). Deux consoles et deux jambes de force à x = +-0,80, hors du chambranle et de la lampe.
- `path_lamp`: reprend `lamp_post` (rien de neuf).
- `level_crossing_crank`: support vissé, origine au point d'accroche sur la surface du poteau (accroches `level_crossing_crank_n` et `_s` du level designer, à 1,0 m); enfant `level_crossing_crank_wheel` (volant de 0,30 m à cinq rayons, poignée), tourner autour de son axe Z local. Le volant est à 0,14 m du poteau, côté opposé au boîtier de fer de la barrière.
- `henhouse_repaired_walls`: perchoir intérieur de 1,55 m (cinq places de 0,3 m marquées), vu par la porte. Corrigés au passage: la rampe descendait vers la porte (tasseaux en l'air), les poteaux d'angle de la clôture étaient en double, les pieds avaient des faces confondues avec le plancher.

Outils et objets portés (`ferme.glb`, extra `tool_kind`): `watering_can_copper` (20 litres, cuivre cerclé de laiton), `axe_forged` (tête d'acier bleui évasée, tranchant clair, garde de cuir), `fishing_rod_bamboo` (même pente et même longueur que la canne, nœud `fishing_rod_bamboo_tip` au même point que `fishing_rod_tip`, donc `ROD_TIP` reste juste), `lamp_pole` (perche de 2,2 m couchée vers l'avant au repos du bras, nœud `lamp_pole_tip`; `pole_raise` la dresse puis l'incline de 20 degrés, bout à 2,8 m et 0,9 m devant), `hen_crate` (cage de 0,62 x 0,44 x 0,5 m, place intérieure pour une poule, porte coulissante côté +Z). Corrigé: le bec de l'arrosoir de départ (`watering_can`) pendait vers le bas, pomme en l'air; il monte maintenant vers l'avant.

Cueillette (5.1 de la conception: 14 x 14 px au zoom 1, contraste, posée contre son support):
- `blackberry` remplace le brin du tour 8: trois grappes de 0,12 m (neuf baies, trois rouges, un reflet blanc) sur la face sud du roncier, à 0,37 à 0,5 m. Origine au point unique `berry_spots` de `bramble` (la grappe du milieu); poser avec le lacet du roncier, jamais au sol.
- `hazelnut` remplace le tas du tour 8: sept noisettes brun foncé (case `hazel_shell`) et trois dans leur collerette vert pâle (`hazel_husk`), sur une jonchée de feuilles ocre de 0,6 m (`leaf_litter`, fixe en toute saison). Origine au point `nut_spots` de `bush_hazel` (0,48 m au sud du pied, sous la couronne).
- `cep` (nouveau): trois cèpes serrés, chapeau `cep_cap`, pied clair et ventru `cep_stem`, 0,25 m.
- `elderberry` (nouveau): trois ombelles de baies noires sur tiges rouges retombantes (`elder_stem`), face sud du sureau, 0,6 à 1,0 m. Origine au point `berry_spots` de `bush_elder` (nouveau buisson de 2 m, tiges claires, feuillage jusqu'à 0,25 m du sol: le modèle de `bush_41`, à poser par le level designer).
- Les points de pose sont calculés par lancer de rayons sur l'hôte reconstruit à l'identique dans `ferme.py` (fruits) et `bourg.py` (hôtes): ils restent justes tant que les deux sont reconstruits ensemble.

Maison (`maison.glb`; muraux: extra `wall`, dos à y = 0,5 de la case): `straw_hat` (au clou, 1,5 m), `pressed_flowers` (cadre pendu à une ficelle, 1,45 m), `coop_calendar` (enfants `coop_calendar_spring | summer | autumn | winter`, la gravure d'automne montre la Halte), `wall_clock` (enfants `wall_clock_hour`, `wall_clock_minute`: axe Z local; `wall_clock_pendulum`: pivot en haut, +-8 degrés), `autumn_wreath` (couleurs fixes, rousse toute l'année), `jeanne_drawing` (feuille punaisée, train, soleil, quatre lignes); au sol: `wicker_armchair` (1 x 1, `seat_height` 0,42). Objets: `chalk_box`, `coffee_mill` (origine sous la caisse, pour le rebord du comptoir), `elder_jelly`, `leather_apron` (plié, objet seul: le tablier porté par Basile reste P1), `wool_scarf` (roulé).

Personnages (`personnages.glb`): `villager_firmin_scarf` (écharpe rouge à rayures crème, pièce à montrer avec `villager_firmin` en automne et en hiver), `rail_crew_driver` et `rail_crew_stoker` (bustes sans jambes, bas de veste fermé à 0,82 m; rangées `driver` et `stoker` de `personnages.png`, ajoutées en fin). Clips: `sit_edge` (4 s, boucle, même assise que `sit`: racine 0,47 m sous le bord du plancher), `look_up` (1,5 s, une fois), `crank_hold` (boucle), `crank_turn` (1 s par tour), `wave_back` (boucle), `pole_raise` (0,6 s) et `pole_lower` (0,5 s) (une fois, perche dans `socket_hand_r`), `driver_lean` (3 s, boucle) et `driver_wave` (boucle).

Faune (`faune.glb`): `barn_owl` (0,35 m, 0,9 m d'envergure, face en coeur blanche cerclée de chamois, `socket_barn_owl_beak`), clips `owl_glide`, `owl_hover`, `owl_strike`, `owl_mantle`, `owl_flap`, `owl_land`, `owl_look` (tête à 120 degrés vers sa gauche, une fois, garder la dernière image) et `owl_perch`; `vole` (campagnol de 8 cm, `socket_barn_owl_beak`, en travers du bec).

Palette: cases ajoutées en fin de liste (`palette.py` et `src/rendu/palette.ts`): `copper`, `copper_light`, `bamboo`, `bamboo_node`, `steel_forged`, `cep_cap`, `cep_stem`, `elder_stem`, `leaf_litter`, `hazel_husk`, `hazel_shell`, `owl_buff`.

Lisibilité mesurée (`captures/tour-09/modeles-zoom1.json`, rendu Blender, pas le jeu): de jour, mûres, sureau et cèpes dépassent 3 pour 1 vus du sud, noisettes autour de 2,3; au soleil couchant simulé, 1,6 à 2,3. Les grappes et les ombelles sont sur la face sud (consigne de la conception): vues du nord, elles sont cachées par le buisson. Le jugement final se fait sur captures du jeu (directeur artistique).

## Fiche par modèle


### `personnages.glb` (2706 Ko)

| Nœud | Triangles |
|---|---|
| `player_base` | 436 |
| `player_outfit_work` | 1042 |
| `player_outfit_smock` | 1098 |
| `player_outfit_overalls` | 1042 |
| `player_hair_short` | 316 |
| `player_hair_bob` | 352 |
| `player_hair_bun` | 380 |
| `player_scarf_orb` | 212 |
| `player_scarf_crescent` | 256 |
| `player_scarf_star` | 204 |
| `player_scarf_sun` | 276 |
| `player_scarf_planet` | 224 |
| `player_scarf_comet` | 220 |
| `villager_firmin` | 1806 |
| `villager_odette` | 1950 |
| `villager_basile` | 2166 |
| `villager_jeanne` | 2054 |
| `villager_lucie` | 1986 |
| `villager_firmin_scarf` | 232 |
| `rail_crew_driver` | 1470 |
| `rail_crew_stoker` | 1514 |

| Animation | Durée (s) | Boucle |
|---|---|---|
| `idle` | 3.0 | oui |
| `walk` | 0.533 | oui |
| `carry_two` | 0.8 | oui |
| `hoe` | 1.0 | oui |
| `sow` | 1.0 | oui |
| `water` | 1.333 | oui |
| `harvest` | 1.2 | oui |
| `chop` | 1.067 | oui |
| `saw` | 0.6 | oui |
| `hammer` | 0.667 | oui |
| `talk` | 2.0 | oui |
| `give` | 1.067 | non (jouer une fois) |
| `sit` | 2.667 | oui |
| `eat` | 1.133 | oui |
| `sit_eat` | 1.133 | oui |
| `sleep` | 3.333 | oui |
| `wave` | 1.067 | oui |
| `pet` | 0.8 | oui |
| `high_five` | 0.8 | non (jouer une fois) |
| `fish_wait` | 3.0 | oui |
| `fish_cast` | 1.0 | non (jouer une fois) |
| `fish_strike` | 1.6 | non (jouer une fois) |
| `sit_ground` | 3.0 | oui |
| `climb_ladder` | 1.2 | oui |
| `reach_up` | 0.8 | non (jouer une fois) |
| `hammer_tap` | 0.6 | oui |
| `hold_ladder` | 2.0 | oui |
| `sit_edge` | 4.0 | oui |
| `look_up` | 1.5 | non (jouer une fois) |
| `crank_hold` | 2.0 | oui |
| `crank_turn` | 1.0 | oui |
| `wave_back` | 1.2 | oui |
| `pole_raise` | 0.6 | non (jouer une fois) |
| `pole_lower` | 0.5 | non (jouer une fois) |
| `driver_lean` | 3.0 | oui |
| `driver_wave` | 1.067 | oui |

### `ferme.glb` (1066 Ko)

| Nœud | Emprise (cases) | Triangles | Données utiles (extras) |
|---|---|---|---|
| `garden_cell_grass` | 1 x 1 | 134 |  |
| `garden_cell_tilled` | 1 x 1 | 116 |  |
| `garden_cell_tilled_wet` | 1 x 1 | 200 |  |
| `radish_stage_seed` | 1 x 1 | 216 | on: "garden_cell_tilled" |
| `radish_stage_sprout` | 1 x 1 | 144 | on: "garden_cell_tilled" |
| `radish_stage_young` | 1 x 1 | 144 | on: "garden_cell_tilled" |
| `radish_stage_ripe` | 1 x 1 | 408 | on: "garden_cell_tilled" |
| `lettuce_stage_seed` | 1 x 1 | 96 | on: "garden_cell_tilled" |
| `lettuce_stage_sprout` | 1 x 1 | 72 | on: "garden_cell_tilled" |
| `lettuce_stage_young` | 1 x 1 | 96 | on: "garden_cell_tilled" |
| `lettuce_stage_ripe` | 1 x 1 | 270 | on: "garden_cell_tilled" |
| `carrot_stage_seed` | 1 x 1 | 216 | on: "garden_cell_tilled" |
| `carrot_stage_sprout` | 1 x 1 | 180 | on: "garden_cell_tilled" |
| `carrot_stage_young` | 1 x 1 | 180 | on: "garden_cell_tilled" |
| `carrot_stage_ripe` | 1 x 1 | 336 | on: "garden_cell_tilled" |
| `radish` |  | 132 | kind: "item" |
| `carrot` |  | 76 | kind: "item" |
| `lettuce` |  | 174 | kind: "item" |
| `egg` |  | 80 | kind: "item" |
| `dandelion` |  | 200 | kind: "item" |
| `wild_garlic` |  | 220 | kind: "item", size_m: 0.41 |
| `chanterelle` |  | 376 | kind: "item", size_m: 0.3 |
| `blackberry` |  | 744 | kind: "item", size_m: 0.66, posed_on: "bramble", note: "trois grappes: origine au point berry_spots de bramble, même lacet que le roncier (pas de lacet au hasard), jamais au sol" |
| `hazelnut` |  | 948 | kind: "item", size_m: 0.6, posed_on: "bush_hazel", note: "jonchée de feuilles et tas: origine au point nut_spots de bush_hazel, au sol" |
| `cep` |  | 522 | kind: "item", size_m: 0.25, note: "au pied d'un chêne, côté sud" |
| `elderberry` |  | 804 | kind: "item", size_m: 0.7, posed_on: "bush_elder", note: "trois ombelles: origine au point berry_spots de bush_elder, même lacet que le sureau, jamais au sol" |
| `seed_packet_radish` |  | 116 | kind: "item" |
| `seed_packet_lettuce` |  | 116 | kind: "item" |
| `seed_packet_carrot` |  | 116 | kind: "item" |
| `hoe` |  | 96 | kind: "tool", socket: "socket_hand_r" |
| `watering_can` |  | 216 | kind: "tool", socket: "socket_hand_r" |
| `axe` |  | 88 | kind: "tool", socket: "socket_hand_r" |
| `saw` |  | 176 | kind: "tool", socket: "socket_hand_r" |
| `hammer` |  | 92 | kind: "tool", socket: "socket_hand_r" |
| `fishing_rod` |  | 80 | kind: "tool", socket: "socket_hand_r" |
| `watering_can_copper` |  | 292 | kind: "tool", socket: "socket_hand_r", tool_kind: "watering_can" |
| `axe_forged` |  | 200 | kind: "tool", socket: "socket_hand_r", tool_kind: "axe" |
| `fishing_rod_bamboo` |  | 316 | kind: "tool", socket: "socket_hand_r", tool_kind: "fishing_rod" |
| `lamp_pole` |  | 164 | kind: "tool", socket: "socket_hand_r", length_m: 2.2, note: "perche couchée vers l'avant (+Z glTF) au repos; clips pole_raise et pole_lower" |
| `hen_crate` | 1 x 1 | 564 | note: "cage de transport: posée devant le poulailler, poule à l'origine, dedans" |
| `fishing_float` |  | 104 | kind: "item", note: "bouchon: origine au niveau de l'eau" |
| `log` |  | 216 | kind: "item" |
| `plank` |  | 68 | kind: "item" |
| `beam` |  | 104 | kind: "carried", length_axis: "z", carry_height: 1.78 |
| `nail_box` |  | 356 | kind: "item" |
| `fish_gudgeon` |  | 284 | kind: "item" |
| `fish_chub` |  | 140 | kind: "item" |
| `fish_trout` |  | 284 | kind: "item" |
| `hen_feeder` | 1 x 1 | 84 |  |
| `grain_sack` |  | 144 | kind: "item" |
| `water_barrel` | 1 x 1 | 356 |  |
| `hen` |  | 1494 | variants: ["hen_white", "hen_red", "hen_black"], tris_each_variant: 498 |

Animations: `hen_idle`, `hen_walk`, `hen_peck`

### `bourg.glb` (3814 Ko)

| Nœud | Emprise (cases) | Triangles | Données utiles (extras) |
|---|---|---|---|
| `station` | 10 x 6 | 4016 | door_cell: 4 |
| `platform` | 30 x 4 | 3328 | walk_height: 0.4, track_side: "-z", note: "bord côté voie vers -Z (arrière); marquise centrée sur 10 m" |
| `gatekeeper_house` | 7 x 6 | 7108 | door_cell: 3, cut_walls: true, interior: {"x": [-2.5, 2.5], "z": [-2.0, 2.0], "floor_y": 0.12}, states: ["gatekeeper_house_ruin", "gatekeeper_house_repaired"] |
| `ferrand_shop` | 10 x 8 | 4664 | door_cell: 2, counter_cell: 6 |
| `firmin_house` | 7 x 6 | 4524 | door_cell: 3 |
| `sawmill` | 10 x 8 | 1944 | door_cell: 5 |
| `handcar_shed` | 6 x 5 | 1480 | door_cell: 2, note: "portes battantes: tourner handcar_shed_door_l de -100 degrés et _r de +100 autour de Y" |
| `handcar` | 2 x 2 | 476 | on_rails: true, note: "balancier handcar_lever: pivot sur l'axe X, +-20 degrés" |
| `well` | 2 x 2 | 658 | water_point: true, note: "puits ouvert; quand le chantier well_roof est bâti: poser well_roof à la même origine et cacher l'enfant well_gallows" |
| `henhouse` | 3 x 3 | 2468 | door_cell: 1, states: ["henhouse_ruin", "henhouse_repaired"] |
| `workbench` | 2 x 2 | 496 |  |
| `woodpile` | 2 x 1 | 312 |  |
| `plank_stack` | 2 x 1 | 132 |  |
| `rail_straight` | 4 x 2 | 294 | rail_top: 0.32, gauge: 1.0 |
| `rail_curve_90` | 13 x 13 | 2676 | radius: 12.0, rail_top: 0.32 |
| `buffer_stop` | 1 x 2 | 240 |  |
| `level_crossing_gate` | 1 x 1 | 252 | note: "lisse level_crossing_gate_arm: pivot sur l'axe Z glTF, 0 baissée, +80 degrés levée" |
| `bell_post` | 1 x 1 | 202 |  |
| `bench` | 2 x 1 | 316 |  |
| `lamp_post` | 1 x 1 | 248 |  |
| `coop_crate` | 1 x 1 | 168 |  |
| `notice_board` | 1 x 1 | 364 |  |
| `station_sign` | 2 x 1 | 424 |  |
| `arbor` | 3 x 2 | 876 |  |
| `mailbox` | 1 x 1 | 104 |  |
| `barrel` | 1 x 1 | 276 |  |
| `crate` | 1 x 1 | 92 |  |
| `crate_stack` | 2 x 1 | 180 |  |
| `sacks` | 1 x 1 | 228 |  |
| `cart` | 3 x 2 | 428 |  |
| `bicycle` | 2 x 1 | 820 |  |
| `ford_bench` | 2 x 1 | 448 | seat_height: 0.45, seat_spots: [[-0.45, 0.0], [0.45, 0.0]], improvement: "ford_bench" |
| `house_bench` | 2 x 1 | 536 | seat_height: 0.45, seat_spots: [[-0.45, 0.0], [0.45, 0.0]], improvement: "house_bench", wall_back: 0.386, note: "dos au mur: le haut du dossier touche un mur à wall_back m derrière l'origine (-Z glTF)" |
| `quay_planter` | 1 x 1 | 1196 | improvement: "quay_planters", seasons: {"spring": "quay_planter_summer", "summer": "quay_planter_summer", "autumn": "quay_planter_autumn", "winter": "quay_planter_winter"}, note: "une jardinière par case (trois posées); n'afficher que l'enfant de la saison" |
| `well_roof` | 2 x 2 | 1040 | improvement: "well_roof", ridge_height: 2.4, note: "à la même origine que well; cacher well_gallows" |
| `door_canopy` |  | 232 | improvement: "door_canopy", attach: "gatekeeper_house_repaired: façade avant, porte (u = 0)", note: "origine au nu du mur de façade au droit de la porte, au sol: (0, 0, 2,30) dans le repère de gatekeeper_house; abri de 1,15 m devant le mur, dessous à 1,93 m au bord" |
| `level_crossing_crank` |  | 296 | anchor: "level_crossing_crank_n | level_crossing_crank_s (accroches des poteaux, 1,0 m)", note: "origine au point d'accroche sur le poteau; le volant level_crossing_crank_wheel tourne autour de son axe Z local (vers la place)" |
| `ground_grass` | 1 x 1 | 24 |  |
| `ground_dirt` | 1 x 1 | 48 |  |
| `ground_cobble` | 1 x 1 | 716 |  |
| `path_border` | 1 x 1 | 176 | note: "bordure de 1 m le long de X" |
| `fence_wood` | 1 x 1 | 36 | note: "segment de 1 m le long de X, poteau à x=-0,5" |
| `fence_picket` | 1 x 1 | 156 | note: "segment de 1 m le long de X, poteau à x=-0,5" |
| `fence_broken` | 1 x 1 | 36 | note: "segment de 1 m le long de X, poteau à x=-0,5" |
| `fence_gate` | 1 x 1 | 108 | note: "segment de 1 m le long de X, poteau à x=-0,5" |
| `fence_post` | 1 x 1 | 12 | note: "segment de 1 m le long de X, poteau à x=-0,5" |
| `tree_oak_small` | 1 x 1 | 358 | choppable: true |
| `tree_oak_large` | 2 x 2 | 358 | choppable: true |
| `tree_fir_small` | 1 x 1 | 174 | choppable: true |
| `tree_fir_large` | 2 x 2 | 174 | choppable: true |
| `tree_birch_small` | 1 x 1 | 366 | choppable: false |
| `tree_birch_large` | 2 x 2 | 366 | choppable: false |
| `tree_stump` | 1 x 1 | 136 |  |
| `oak_sapling` | 1 x 1 | 440 | grow_node: "oak_sapling_shoots", note: "souche de tree_stump et rejets enfants: mettre à l'échelle les seuls rejets (0,4 à 1), chaque brin oak_sapling_shoot_* autour de son pied (origine du brin, sur le flanc de la souche)" |
| `fir_sapling` | 1 x 1 | 170 | height: 1.24, beside_stump: [0.0, 0.0, 0.6], note: "échelle 1 le premier jour, jusqu'à 1,3 ensuite; la souche tree_stump reste au centre de la case, le plant se pose à beside_stump (sans rotation du décalage)" |
| `bush_round` | 1 x 1 | 100 |  |
| `bush_bramble` | 1 x 1 | 280 |  |
| `bush_hazel` | 1 x 1 | 160 | nut_spots: [[0.0, 0.0, 0.48]] |
| `bush_elder` | 1 x 1 | 210 | berry_spots: [[0.02, 1.0, 0.439]] |
| `bramble` | 1 x 1 | 860 | size_m: [1.2, 0.8, 0.7], berry_spots: [[0.02, 0.5, 0.11]] |
| `rock_small` | 1 x 1 | 20 |  |
| `rock_medium` | 1 x 1 | 40 |  |
| `rock_large` | 2 x 2 | 52 |  |
| `grass_tall` | 1 x 1 | 90 |  |
| `flowers_red` | 1 x 1 | 400 |  |
| `flowers_yellow` | 1 x 1 | 400 |  |
| `flowers_white` | 1 x 1 | 400 |  |
| `flowers_blue` | 1 x 1 | 400 |  |
| `flower_bed` | 2 x 1 | 620 |  |
| `reeds` | 1 x 1 | 224 |  |
| `river_straight` | 4 x 8 | 220 | flow_axis: "x", water_y: -0.3, note: "module de 4 m le long de X; l'eau est le nœud *_water (animable à part)" |
| `river_ford` | 4 x 8 | 340 | flow_axis: "x", water_y: -0.3, note: "module de 4 m le long de X; l'eau est le nœud *_water (animable à part)" |
| `river_curve` | 10 x 10 | 160 | water_y: -0.3, radius: 6.0 |
| `pontoon` | 2 x 3 | 906 | walk_height: 0.5 |
| `tree_oak` |  | 358 | alias_of: "tree_oak_large" |
| `tree_fir` |  | 174 | alias_of: "tree_fir_large" |
| `bush` |  | 100 | alias_of: "bush_round" |
| `rock` |  | 40 | alias_of: "rock_medium" |
| `fence` |  | 36 | alias_of: "fence_wood" |
| `log_pile` | 2 x 1 | 216 |  |

### `train.glb` (335 Ko)

| Nœud | Emprise (cases) | Triangles | Données utiles (extras) |
|---|---|---|---|
| `locomotive` |  | 3392 | length_over_buffers: 7.4, front: "+x", smoke_anchor: "locomotive_smoke" |
| `coach` |  | 2156 | length_over_buffers: 9.0 |
| `van` |  | 2004 | length_over_buffers: 7.0, door: "porte coulissante au milieu, côté -Z et +Z" |

Animations: `locomotive_roll`, `coach_roll`, `van_roll`

### `maison.glb` (890 Ko)

| Nœud | Emprise (cases) | Triangles | Données utiles (extras) |
|---|---|---|---|
| `straw_mattress` | 1 x 2 | 320 | sleep_height: 0.15 |
| `double_bed` | 2 x 2 | 708 | sleep_height: 0.5, sleep_spots: [[-0.36, 0.0], [0.36, 0.0]] |
| `mattress` |  | 324 | kind: "item" |
| `table` | 2 x 1 | 332 | top_height: 0.78 |
| `chair` | 1 x 1 | 404 | seat_height: 0.47 |
| `chest` | 1 x 1 | 176 |  |
| `shelf` | 2 x 1 | 656 | wall: true |
| `stove` | 1 x 1 | 484 | station: "stove" |
| `flower_pot` | 1 x 1 | 352 |  |
| `oil_lamp` | 1 x 1 | 232 | light_anchor: "oil_lamp_light" |
| `rug` | 2 x 2 | 296 | floor: true |
| `curtains` | 1 x 1 | 488 | wall: true |
| `crystal_radio` | 1 x 1 | 368 |  |
| `wood_stove` | 1 x 1 | 380 | tier: "P1" |
| `picture_frame` | 1 x 1 | 116 | wall: true, tier: "P1" |
| `straw_hat` | 1 x 1 | 256 | wall: true |
| `pressed_flowers` | 1 x 1 | 628 | wall: true |
| `autumn_wreath` | 1 x 1 | 752 | wall: true |
| `jeanne_drawing` | 1 x 1 | 264 | wall: true |
| `coop_calendar` | 1 x 1 | 832 | wall: true, seasons: {"spring": "coop_calendar_spring", "summer": "coop_calendar_summer", "autumn": "coop_calendar_autumn", "winter": "coop_calendar_winter"}, note: "n'afficher que la gravure de la saison (enfant coop_calendar_<saison>)" |
| `wall_clock` | 1 x 1 | 608 | wall: true, note: "wall_clock_hour et wall_clock_minute: tourner autour de leur axe Z local (vers la pièce) selon l'heure du jeu, sens horaire vu de face; wall_clock_pendulum: pivot en haut, osciller de +-8 degrés autour de Z, une seconde par battement (tic-tac)" |
| `wicker_armchair` | 1 x 1 | 748 | seat_height: 0.42 |
| `chalk_box` |  | 176 | kind: "item" |
| `coffee_mill` |  | 248 | kind: "item" |
| `elder_jelly` |  | 190 | kind: "item" |
| `leather_apron` |  | 80 | kind: "item" |
| `wool_scarf` |  | 184 | kind: "item" |
| `bread` |  | 136 | kind: "item" |
| `dish_radishes` |  | 464 | kind: "item" |
| `dish_omelette` |  | 276 | kind: "item" |
| `dish_soup` |  | 244 | kind: "item" |
| `parcel` |  | 140 | kind: "item" |
| `iron_box` |  | 136 | kind: "item" |
| `riddle_card` |  | 72 | kind: "item" |
| `shed_key` |  | 112 | kind: "item" |
| `old_photo` |  | 60 | kind: "item" |
| `jay_feather` |  | 176 | kind: "item" |
| `kit_wall_stone` | 1 x 1 | 12 | tier: "P1", note: "mur sur le bord arrière de la case (-Z glTF), 2,4 m" |
| `kit_wall_wood` | 1 x 1 | 108 | tier: "P1", note: "mur sur le bord arrière de la case (-Z glTF), 2,4 m" |
| `kit_door` | 1 x 1 | 148 | tier: "P1", note: "mur sur le bord arrière de la case (-Z glTF), 2,4 m" |
| `kit_window` | 1 x 1 | 72 | tier: "P1", note: "mur sur le bord arrière de la case (-Z glTF), 2,4 m" |
| `kit_floor_wood` | 1 x 1 | 24 | tier: "P1" |

### `faune.glb` (1187 Ko)

| Nœud | Emprise (cases) | Triangles | Données utiles (extras) |
|---|---|---|---|
| `heron` |  | 866 | kind: "animal", origin: "sol sous les pattes", height: 0.95, length: 0.9, wingspan: 1.7, collision_radius: 0.3 |
| `goose` |  | 406 | kind: "animal", origin: "ligne de flottaison", length: 0.8, wingspan: 1.6, note: "neuf instances d'un seul maillage (SkeletonUtils.clone)" |
| `blue_tit` |  | 304 | kind: "animal", origin: "pattes sur le perchoir", display_scale: 1.5, length: 0.18, beak_socket: "socket_blue_tit_beak" |
| `fox` |  | 798 | kind: "animal", origin: "sol entre les pattes", withers: 0.4, length: 0.65, tail: 0.4 |
| `roe_deer` |  | 892 | kind: "animal", origin: "sol entre les pattes", withers: 0.7, head_up: 1.05, length: 1.1, collision_radius: 0.4, note: "tête tournée vers sa gauche dans deer_watch_fawn et deer_lick: le faon à sa gauche" |
| `fawn` |  | 896 | kind: "animal", origin: "sol entre les pattes", withers: 0.45, length: 0.65, collision_radius: 0.4, bed_ears_top: 0.32, note: "fawn_rustle = couché au lit: posé à -0,3 m, seules les oreilles dépassent (2 cm)" |
| `kingfisher` |  | 416 | kind: "animal", origin: "pattes sur le perchoir", display_scale: 1.5, length: 0.255, wingspan: 0.375, beak_socket: "socket_kingfisher_beak" |
| `barn_owl` |  | 658 | kind: "animal", origin: "pattes sur le perchoir (rocher rock_02) ou au sol", height: 0.35, wingspan: 0.9, beak_socket: "socket_barn_owl_beak", note: "vol: owl_glide, owl_flap; surplace: owl_hover; owl_look tourne la tête de 120 degrés vers sa gauche et y reste (LoopOnce, clampWhenFinished)" |
| `vole` |  | 158 | kind: "item", socket: "socket_barn_owl_beak", carried_by: "barn_owl", length: 0.08, note: "en travers du bec, tête vers la gauche de l'oiseau" |
| `ladder_wood` |  | 176 | kind: "prop", lean_deg: 75.0, length: 3.0, rung_step: 0.28, rungs: 10, top: [0.0, 2.898, 0.776], note: "penchée vers +Z: la poser avec la rotation de celui qui grimpe" |
| `nest_box` |  | 156 | kind: "prop", pivot: "clou", tilt_deg: 25, entrance: [0.0, -0.13, 0.181], roof_perch: [0.0, -0.048, 0.12], note: "penché: tourner de 25 degrés autour de Z glTF (le bas vers +X)" |
| `oak_branch_stub` |  | 60 | kind: "prop", pivot: "bout du chicot (perchoir)" |
| `moss_tuft` |  | 96 | kind: "item", socket: "socket_blue_tit_beak" |
| `small_fish` |  | 124 | kind: "item", socket: "socket_kingfisher_beak", display_scale: 1.5, length: 0.12, note: "en travers du bec, tête vers la gauche de l'oiseau" |
| `mooring_post` |  | 162 | kind: "prop", pivot: "bord du sommet (accroche kingfisher_post, z 0,95)", perch: [0.0, 0.02, 0.0], water_line: -0.95, length: 1.4, ring: [0.0, -0.35, 0.075], note: "anneau sur la face +Z (vers le large); aucune emprise" |

| Bête | Animation | Durée (s) | Boucle |
|---|---|---|---|
| `heron` | `heron_idle` | 4.0 | oui |
| `heron` | `heron_strike` | 0.8 | non (jouer une fois) |
| `heron` | `heron_alert` | 1.0 | non (jouer une fois) |
| `heron` | `heron_shy_step` | 0.8 | non (jouer une fois) |
| `heron` | `heron_takeoff` | 1.4 | non (jouer une fois) |
| `heron` | `heron_fly` | 1.0 | oui |
| `heron` | `heron_land` | 0.8 | non (jouer une fois) |
| `heron` | `heron_rest` | 4.0 | oui |
| `goose` | `goose_swim` | 3.0 | oui |
| `goose` | `goose_alert` | 1.0 | non (jouer une fois) |
| `goose` | `goose_run` | 0.4 | oui |
| `goose` | `goose_fly` | 1.0 | oui |
| `blue_tit` | `tit_perch` | 2.0 | oui |
| `blue_tit` | `tit_fly` | 0.2 | oui |
| `blue_tit` | `tit_sing` | 1.5 | non (jouer une fois) |
| `blue_tit` | `tit_enter` | 0.3 | non (jouer une fois) |
| `blue_tit` | `tit_exit` | 0.3 | non (jouer une fois) |
| `fox` | `fox_trot` | 0.6 | oui |
| `fox` | `fox_listen` | 2.5 | non (jouer une fois) |
| `fox` | `fox_pounce` | 1.2 | non (jouer une fois) |
| `fox` | `fox_sniff` | 2.0 | non (jouer une fois) |
| `fox` | `fox_look` | 1.0 | non (jouer une fois) |
| `fox` | `fox_bark` | 1.2 | non (jouer une fois) |
| `roe_deer` | `deer_walk` | 1.2 | oui |
| `roe_deer` | `deer_graze` | 4.0 | oui |
| `roe_deer` | `deer_lookup` | 2.0 | non (jouer une fois) |
| `roe_deer` | `deer_stamp` | 0.5 | non (jouer une fois) |
| `roe_deer` | `deer_call` | 1.6 | non (jouer une fois) |
| `roe_deer` | `deer_watch_fawn` | 2.0 | oui |
| `roe_deer` | `deer_lick` | 2.2 | oui |
| `roe_deer` | `deer_bound` | 0.8 | oui |
| `fawn` | `fawn_rustle` | 1.0 | oui |
| `fawn` | `fawn_rise` | 0.8 | non (jouer une fois) |
| `fawn` | `fawn_trot` | 0.5 | oui |
| `fawn` | `fawn_suckle` | 1.1 | oui |
| `fawn` | `fawn_bound` | 0.8 | oui |
| `kingfisher` | `kf_perch` | 2.0 | oui |
| `kingfisher` | `kf_dive` | 0.3 | non (jouer une fois) |
| `kingfisher` | `kf_fly` | 0.133 | oui |
| `kingfisher` | `kf_beat` | 1.2 | non (jouer une fois) |
| `kingfisher` | `kf_swallow` | 0.5 | non (jouer une fois) |
| `barn_owl` | `owl_glide` | 1.0 | oui |
| `barn_owl` | `owl_hover` | 0.4 | oui |
| `barn_owl` | `owl_strike` | 0.4 | non (jouer une fois) |
| `barn_owl` | `owl_mantle` | 1.6 | oui |
| `barn_owl` | `owl_flap` | 0.5 | oui |
| `barn_owl` | `owl_land` | 0.6 | non (jouer une fois) |
| `barn_owl` | `owl_look` | 2.0 | non (jouer une fois) |
| `barn_owl` | `owl_perch` | 2.0 | oui |

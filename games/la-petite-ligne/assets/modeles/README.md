# Modèles 3D de La Petite Ligne (démo)

Produits par script (Blender 5.2 sans interface), aucune ressource externe. Sources, planches de contrôle et outil de vérification: `games/la-petite-ligne/assets-src/modeles/`. Direction artistique: `docs/jeux/jeu-1/bible-artistique-demo.md`.

Tout reconstruire (environ 7 minutes, planches comprises): `bash games/la-petite-ligne/assets-src/modeles/construire.sh` (`--sans-planches` pour les seuls GLB).

## Fichiers

| Fichier | Contenu | Animations |
|---|---|---|
| `personnages.glb` | squelette `rig`, pièces des joueurs (15 coupes, barbes et moustache), quatre habitants de la démo, Lucie (hors démo), Achille et Solange (tour 10), quatorze habitants de la 0.13, leurs accessoires et trois vélos | clips sur le squelette |
| `bourg.glb` | bâtiments (tour 10: rue Haute, intérieurs de l'épicerie et de la mercerie, cellier et chambre), voie, quai, mobilier, sols, clôtures, nature (dont roncier, noisetier, rejet du chêne et jeune sapin du tour 8), rivière, passages du ru | aucune (pièces mobiles en nœuds à part) |
| `ferme.glb` | cases du potager, cultures (4 stades), récoltes, cueillette (pissenlit; tour 8: ail des ours, girolles; tour 9: mûres, noisettes, cèpes, sureau), sachets, outils (tour 9: outils de la Halte, perche d'allumeur), matériaux, poule, cage, mangeoire, tonneau d'eau | `hen_idle`, `hen_walk`, `hen_peck` |
| `train.glb` | locomotive, voiture, fourgon | `locomotive_roll`, `coach_roll`, `van_roll` |
| `maison.glb` | meubles, plats, objets de l'histoire, kit de modules (P1) | aucune |
| `faune.glb` | bêtes des moments rares (héron, oie, mésange bleue, renard; tour 7: chevrette, faon, martin-pêcheur), chat du bourg (0.13), échelle, nichoir, chicot du chêne, brin de mousse, ablette, pieu d'amarrage | 53 clips, chacun sur le squelette de sa bête |
| `poissons.glb` | les 22 poissons de la pêche (0.12) et la vieille épuisette du ponton | aucune |
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
- Instancier un personnage: `SkeletonUtils.clone(gltf.scene)`, puis ne garder visibles que ses pièces. Un joueur = `player_base` + ses vêtements `wear_<slot>_<style>` + une coiffure (`player_hair_<coupe>`, ou `_hat` sous un chapeau) + l'écusson `player_badge_<symbole>` (`orb`, `crescent`, `star`, `sun`, `planet`, `comet`, comme les profils Duo); voir « Garde-robe de la 0.12 ». Les foulards sont retirés. Les quatre pièces partagent le matériau: on peut les fusionner (même squelette) pour un seul appel de dessin.
- Couleurs d'un joueur: la texture `personnages.png` a une rangée de 16 cases (4 px) par personnage. Les pièces des joueurs lisent la rangée 0. Pour chaque joueur, cloner le matériau, peindre une CanvasTexture de la taille de `personnages.png` (64 x 128 depuis la 0.13, copie de la source) dont la rangée 0 reçoit ses couleurs, avec `flipY = false`, `NearestFilter`, `SRGBColorSpace`. Ordre des cases: peau, ombre de peau, cheveux, cheveux sombres, yeux, bouche, haut, liseré, bas, chaussures, foulard, symbole du foulard, accessoire A, accessoire B, métal, joues. Choix proposés (tenues, peaux, cheveux, foulards): `PLAYER_PRESETS` dans `assets-src/modeles/palette.py`.
- Habitants: `villager_firmin`, `villager_odette`, `villager_basile`, `villager_jeanne` (et `villager_lucie`, hors démo). Jeanne se pose à l'échelle 0,75 (extra `scale`). Habitants de la 0.13: voir la section qui leur est consacrée.
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

## Pêche (`ferme.glb`, `poissons.glb`)

- `fishing_rod`: origine à la prise; la canne monte à 42 degrés devant la main (bout à x 0, y 1,34, z 1,49 dans le repère de la prise), nœud vide `fishing_rod_tip` au bout pour accrocher la ligne. Ligne et bouchon ne font pas partie du modèle: le jeu dessine la ligne jusqu'au bouchon `fishing_float` (origine au niveau de l'eau).
- Poissons (0.12, `poissons.glb`, source `assets-src/modeles/poissons.py`): un nœud `fish_<id>` par espèce de `objets.json` (`fish_gudgeon`, `fish_minnow`, `fish_stone_loach`, `fish_bleak`, `fish_roach`, `fish_chub`, `fish_trout`, `fish_perch`, `fish_dace`, `fish_bullhead`, `fish_tench`, `fish_barbel`, `fish_pike`, `fish_grayling`, `fish_brook_lamprey`, `fish_bitterling`, `fish_shad`, `fish_mirror_carp`, `fish_salmon`, `fish_burbot`, `fish_golden_trout`, `fish_moon_pike`). Les trois poissons de la 0.11 (`fish_gudgeon`, `fish_chub`, `fish_trout`) gardent leur nom mais quittent `ferme.glb`: refaits au même gabarit que les autres.
  - Un seul constructeur paramétrique (corps lofté en super-ellipse, opercule en ressaut, nageoires en plaques au contour arrondi, yeux, barbillons, taches et écailles plaquées sur les facettes par lancer de rayons, rayures portées par des anneaux du corps). Couleurs unies de la palette existante (aucune case ajoutée). 376 à 600 triangles par poisson.
  - Repère: tête vers +Z glTF, dos vers +Y. Longueur du modèle = milieu de la fourchette de la conception (extra `length_m`, fourchette `length_cm`): mettre le nœud à l'échelle `longueur tirée (m) / length_m`, uniformément, autour de l'origine.
  - Origine = prise d'une main (`socket_hand_r` ou `socket_hand_l`), sur l'axe du corps à 38 % de la longueur depuis le museau, juste derrière les pectorales. Enfants vides: `fish_<id>_tail` (deuxième main, au pédoncule de la queue, pour `fish_show` et la prise à deux) et `fish_<id>_mouth` (bout du museau: là où la ligne tient le poisson qui pend). Mêmes points en coordonnées glTF dans les extras `hold_tail` et `mouth`. Ces points suivent la mise à l'échelle puisqu'ils sont des enfants du nœud.
  - Mythiques: `fish_golden_trout` (la Dorée, miel: dos `bread_crust`, flancs `flower_center`, quelques points rouges cerclés de crème et paillettes `brass` métalliques) et `fish_moon_pike` (Brochet de lune, dos bleuté `mattress_stripe`, flancs argent, taches blanches, œil pâle). Leur lueur relève du rendu (tech-artist).
  - Signes de reconnaissance demandés (conception M1): grande dorsale violette de l'ombre, barbillons du barbeau (4) et du goujon (2), rayures de la perche, points de la truite, écailles miroir de la carpe; aussi six barbillons de la loche, tête plate et pectorales en éventail du chabot, ventouse et sept pores de la lamproie, barbillon du menton de la lote, nageoire adipeuse des salmonidés.
- `landing_net` (épuisette du ponton, `poissons.glb`): manche de 1,5 m couché vers l'avant (+Z glTF), cercle de fer de 0,6 m à plat au bout, filet de corde de 0,46 m qui pend dessous. Origine à la main arrière (bout du manche, sous `socket_hand_r`), enfants vides `landing_net_hand_l` (main avant, 0,55 m devant) et `landing_net_hoop` (centre du cercle, là où entre le poisson). 704 triangles.
- Planches: `docs/jeux/jeu-1/gauntlet/captures/v0-12/poissons.webp` (de près, profil et dos) et `poissons-echelle.webp` (taille réelle, mannequin de 1,80 m); `duo-python poissons.py` puis `duo-python verifier/planche_poissons.py`.

## Maison

- Meubles muraux (`shelf`, `curtains`, `picture_frame`): dos contre le bord arrière de leur case (-Z).
- `oil_lamp`: nœud vide `oil_lamp_light` à la flamme pour une lumière ponctuelle chaude.
- `double_bed`: deux places (`sleep_spots`), `table` dessus à 0,78 m, `chair` assise à 0,47 m.
- Kit de modules P1: `kit_wall_stone`, `kit_wall_wood`, `kit_door`, `kit_window` (murs de 1 m sur le bord arrière de la case, 2,4 m de haut), `kit_floor_wood`.

## Budgets (PC de référence, `docs/plateforme/architecture.md` section 14)

- Toute la carte de la démo (`donnees/cartes/halte.json`: 196 objets, dont 79 buissons et 51 arbres): environ 43 000 triangles de décor avant le low poly arrondi (les 30 chênes et 79 buissons arrondis en ajoutent environ 13 000, la maison de Firmin 2 300), plus 16 modules de voie (4 700), le potager (environ 4 000 avec ses cultures) et six personnages (environ 14 000): moins de 70 000 triangles, pour un plafond de 250 000.
- Personnages: 2 160 à 2 590 triangles par habitant, 2 006 pour un joueur complet (base, tenue, coiffure, foulard). Accessoires: 40 à 650 triangles.
- Appels de dessin: un matériau par fichier; décor statique à fusionner ou à instancier par le jeu (arbres, buissons, clôtures, cultures et cases du potager se prêtent à `InstancedMesh`).
- Textures: une palette de 64 x 64 (et ses compagnes), une texture de personnages de 64 x 128 (0.13): moins de 100 Ko de mémoire.

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

## Tour 10: rue Haute, intérieurs, pièces de la maison, rangement, rideaux, coiffures (`docs/jeux/jeu-1/tour-10-conception.md`)

Sources: `interieurs.py` (épicerie et mercerie, appelé par `bourg.py`), `rue_haute.py` (fournil, maison de Lucie, école-mairie, passages du ru), `pieces.py` (cellier, chambre, fenêtres, murs à porte percée), `maison_t10.py` (par `maison.py`), `coiffures.py` (par `personnages.py`), `ferme.py` (panne faîtière). Contrôles: `verifier/vue_interieur.py` (bâtiment vu comme par le joueur qui est dedans: `cut_nodes` retirés, murs côté caméra coupés), `verifier/vue_pieces.py` (maisonnette et pièces: `--etat bati | chantier | site | coupe`), `verifier/quatre_tour10.sh`, `verifier/quatre_maison_t10.sh`, `planche_coiffures.py <dossier> coupes | poses | habitants`, `verifier/coiffures_couche.py` (coupes en pose `sleep`, mesure), `verifier/nettoyer_tour10.sh`. Planches: `docs/jeux/jeu-1/gauntlet/captures/tour-10/modeles/`.

### Bâtiments visitables (ADR 0016)

Règle commune des nœuds (sous la racine du bâtiment, enfants directs): `<id>_floor` (sol, jamais coupé), `<id>_wall_front | back | left | right` (murs du rez-de-chaussée, coupés quand ils regardent la caméra: le jeu calcule le côté par la boîte englobante, comme la maisonnette), les nœuds de l'extra `cut_nodes` (toit, étage ou comble: retirés en entier quand le joueur local est dedans), `<id>_interior` (tout le contenu fixe en un maillage, masqué tant que le joueur local n'est pas dans ce bâtiment), `<id>_door` (vantail, pivot sur le jambage gauche vu de dehors, dans le plan intérieur du mur, tourner autour de Y pour l'ouvrir vers l'intérieur). Les murs sont vraiment percés (fenêtres vitrées vues des deux côtés, portes ouvertes).

Extras: `interior` (pièces en repère glTF du bâtiment: x le long de la façade, z vers la façade), `interior_spots` (points de jeu, repère glTF x, z, à tourner avec l'objet de la carte), `interior_blocked` (cases occupées par le mobilier fixe: coin [x, z] le plus petit de chaque case, repère glTF), `seat_height`, `bench_seat_height`.

- `ferrand_shop` (épicerie-pension d'Odette, 10 x 8, rotation 1 sur la carte): repris avec un intérieur. Pour que la boutique tienne ses 6 x 6 cases, la façade avance de 0,75 m (nu extérieur en x 30,35 sur la carte) et les murs tiennent dans les cases du pourtour; l'aspect extérieur ne change pas (store, étal, enseigne, étage et toit repris). Boutique: glTF x -4 à 2, z -3 à 3, soit **y 26 à 31** sur la carte (la conception dit 27 à 31: décalée d'une rangée pour que la case 6 de la façade, le guichet `grocery_counter` en y 26,5, soit dans la boutique); salle à manger de la pension: y 24 et 25 (glTF x 2 à 4), vue par la porte entrouverte de la cloison, non jouable. Contenu: comptoir en retour perpendiculaire à la façade (Odette entre lui et la cloison, au guichet de la vitrine), présentoir de bocaux sous la vitrine, balance, panière d'Achille au bout du comptoir, rayonnages au fond, au sud et sur la cloison, sacs de graines près de la porte (hors du battant), poêle de fonte et son tuyau, petite table ronde et deux chaises (`grocery_table`), escalier de 15 marches de 18,5 cm sur 23 cm le long de la cloison vers les chambres (placard fermé dessous, main courante), deux tables et quatre chaises sous des draps dans la salle à manger. `cut_nodes`: `ferrand_shop_roof`, `ferrand_shop_upper` (étage, avec le plafond du rez-de-chaussée). Porte de derrière (`ferrand_shop_back_door`) côté salle à manger. Lucarnes refaites: joues et toit prolongés jusqu'au pan (leur toit flottait de 10 à 20 cm au-dessus du pan à l'arrière).
- `haberdashery` (mercerie-coiffure de Solange, 7 x 7, rotation 1, porte en case 3 sur la rue Haute): un niveau, faîtage à 4,7 m, tuiles, crépi rose, menuiseries bleues. Vitrine sur la rue Haute et vitrine au nord sur la rue de la halte, enseigne peinte (MERCERIE, COIFFURE) sur le pignon nord, vue en arrivant de la halte. Intérieur de 5 x 5 m: coin coiffure au sud (grand miroir, tablette avec flacons, ciseaux et la place du peigne `spot_horn_comb`, dans le nœud du mur sud: coupé avec lui, il ne reste pas en l'air), fauteuil de coiffure à pied tourné vers le miroir (`salon_chair`, assise à 0,5 m), banc d'attente à deux places au fond qui voit le fauteuil de biais (`salon_bench`, assise 0,45), comptoir de mercerie au nord (Solange côté fond, `salon_counter`), rayonnage de tissus en rouleaux sur le mur nord, mannequin habillé et rouleaux dans la vitrine nord, chaise de couture de Solange tournée vers cette vitrine (`salon_window`, le lundi), présentoir de chapeaux dans la vitrine de la rue Haute, porte-manteau, plante. Solange loge sous le toit (la conception dit « derrière la boutique »: l'emprise de 7 x 7 n'a pas de place derrière): échelle de meunier de 12 marches contre le mur du fond vers une trappe du comble, lucarne de sa chambre sur le pan arrière. `cut_nodes`: `haberdashery_roof`, `haberdashery_attic`.

### Rue Haute et passages du ru (non visitables à ce tour)

- `bakery` (fournil, 7 x 6, rotation 0): pierre, tuiles, porte en case 5, guichet en case 3 (tablette de chêne dehors, volet rabattu, deux miches en vitrine, `spot_hourglass` pour le sablier), auvent sur consoles au-dessus des deux (dessous à 2,3 m), porte des sacs au pignon ouest (côté halte et quai), enseigne peinte (BOULANGERIE) sur ce pignon (en façade, la rive du toit descend à 2,77 m juste au-dessus de l'auvent), miche de fer forgé au coin. Le four du grand-père dépasse à l'arrière côté voie sous un toit à un pan, avec sa cheminée de 6,4 m et un tas de fagots; logement d'Achille sous le toit (lucarne au sud, volets).
- `lucie_house` (6 x 6, rotation 3, porte en case 2): un niveau, faîtage à 4,0 m, crépi crème, volets verts, boîte aux lettres jaune de la factrice; jardinet clos derrière dans l'emprise (palissade blanche, fleurs, rang de salades), porte de derrière.
- `school` (école-mairie, 11 x 5, rotation 0): cour à l'ouest (5,4 x 5 m, murs de 1,8 m chaperonnés, portail de 2,4 m en case 3, dans l'axe de la rue Haute, vantaux ouverts le jour, tilleul et banc), mairie-école à l'est en retrait de 0,9 m (perron de trois marches de 15 x 28 cm, plaque MAIRIE, porte de la classe sur la cour avec plaque ECOLE, hautes fenêtres, clocheton sur le faîtage côté cour). Un retour de mur ferme la cour jusqu'à l'angle de la mairie.
- Passages (le ru coule le long de Z glTF; extra `flow_axis` "z"): `culvert` (ponceau sous la voie: voûte de 1,5 m, têtes arasées à 4 cm, rien dans le gabarit du train, lit à -0,95 m), `street_bridge` (tablier pavé au niveau de la rue, 2,2 m entre parapets de 0,65 m, arche de 2 m, dés en bout), `footbridge` (passerelle de 1,6 m hors tout, platelage à 0,16 m sur deux poutres et dés de pierre, abouts en pente, garde-corps côté aval au sud, +Z glTF), `ford_stones` (quatre dalles à un pas de saut, dessus à -0,12 m). Les culées et le lit descendent à -0,95 m: le terrain du jeu doit laisser le creux du ru.
- Pas de modèle de pommier (verger derrière la maison de Lucie): non demandé à ce lot, à faire si le level designer le veut.

### Maison qui grandit (`bourg.glb`)

- `gatekeeper_cellar` et `gatekeeper_bedroom`: même origine et même rotation que `gatekeeper_house`. Extras: `elements` (dans l'ordre de la conception 4.3: nœuds, planches, clous, supports `needs`), `site_nodes` (dès le matin du site), `built_nodes` (tuiles et porte, au matin de `room_built`), `cut_nodes`, `interior`, `footprint_world`. Fantôme = nœuds des éléments en transparence (règle de la maisonnette).
  - Cellier: appentis de planches contre le pignon ouest, emprise x 2 à 4 et y 21 à 26, pièce x 3 et 4, y 22 à 25, sol de dalles à 0,12 m (au niveau du plancher). **Toit à deux petits pans, faîtage à 2,6 m perpendiculaire au pignon**, et non à un pan: un pan unique de 2,6 m sur toute la largeur passe par-dessus les coins de la rive ouest du toit de la maison (dessous à 2,1 m aux angles); abaissé dessous, il devient trop plat pour la tuile et trop bas pour la tête (1,71 m libres dans l'allée). Égouts à 1,95 m au nord et au sud, pignon de planches à l'ouest; fenestron au nord (0,4 x 0,3 m). Éléments: 2 poteaux, sablières (nord et sud, un élément), pignon ouest, murs nord et sud (un élément, deux nœuds), charpente du toit (panne, chevrons, voliges); tuiles (`gatekeeper_cellar_roof`) et porte de planches dans l'ancienne fenêtre ouest la nuit suivante. `rack_spots`: deux places d'étagère haute dos au pignon ouest (cases (3, 22-23) et (3, 24-25)).
  - Chambre: aile nord à pans de bois et bardage, emprise x 5 à 11 et y 16 à 21, pièce x 6 à 10 et y 17 à 20, plancher. Toit de lauzes (comme la maison) à deux pans perpendiculaire à celui de la maison, raccordé à son pan nord par deux noues; **égouts à 2,0 m**: les sablières et les murs passent sous le débord nord du toit de la maison (dessous à 2,03 m au bord) sans le toucher, et l'aile se glisse sous l'avant-toit vers l'égout. Fenêtres au nord et à l'est. La ferme est juste au nord du débord (y 2,78 du repère); la panne faîtière va d'elle au poinçon du pignon nord (4,8 m; extra `ridge_purlin`, dessus de la panne posée). Éléments: 4 poteaux, 2 sablières, 4 pans (ouest, est, nord, pignon nord), la ferme et la panne (après le porter), le plancher; solin de pierre au matin du site. `furniture_spots`: lit double (tête au nord), commode, fauteuil.
- `gatekeeper_house_wall_left_door`, `gatekeeper_house_wall_back_door` (enfants de `gatekeeper_house`, hors des états): murs ouest et nord de la maisonnette réparée, fenêtre devenue porte (0,9 x 2,05 m au droit de l'ancienne fenêtre, linteau gardé, jambages de pierre). À montrer à la place de `gatekeeper_house_repaired_wall_left` ou `_back` une fois la pièce bâtie.
- Maisonnette: la fenêtre ouest est déplacée de 20 cm (centrée sur la case y 24 de la future porte du cellier); les cinq fenêtres de la pièce réparée se voient aussi de dedans (embrasure, vitre, dormant, tablette), pour y accrocher les rideaux.
- `window_1` à `window_8` (nœuds vides sous `gatekeeper_house`, centre de la fenêtre au nu intérieur du mur, repère de la maisonnette), et l'extra `windows` de la racine avec, pour chacun: `room`, `side`, `width`, `height`, `sill_y`, `inward`, `curtains`, `becomes_door` (3 devient la porte de la chambre, 4 celle du cellier), `refusal` (fenestron du cellier). 1 et 2 au sud, 3 au nord, 4 à l'ouest, 5 à l'est, 6 fenestron du cellier, 7 et 8 chambre (nord, est).
- `ridge_purlin` (`ferme.glb`): panne faîtière de 4,9 m, portée à deux comme `beam` (extra `carry_height` 1,78).

### Rangement et rideaux (`maison.glb`)

- `oak_chest` (1 x 1, 0,85 m, 32 cases), `cellar_rack` (2 x 1 dos au mur, 1,68 m sous les chevrons du cellier, 12 cases), `tool_rack` (râtelier mural, 12 crochets, extra `hook_spots`).
- `curtains_window`: `curtains_rod` et, pour chaque article de la mercerie (`curtains`, `curtains_blue`, `curtains_red`, `curtains_yellow`, `curtains_green`, `curtains_gingham`), `<article>_open` (pans plissés retenus par une embrasse) et `<article>_closed`. Origine au centre de la fenêtre (`window_<n>`), la pièce vers +Z glTF; faits pour 0,75 x 0,9 m: échelle X = width / 0,75, Y = height / 0,9. Une couleur par paire de nœuds (un seul matériau par fichier). L'ancien `curtains` mural reste tel quel tant que le rendu l'utilise.

### Personnages (`personnages.glb`)

- `villager_achille` (rangée `achille`): boulanger rond et lent, chemise blanche aux manches retroussées, grand tablier fariné à bavette, calot de mitron, moustache, pantalon de toile. `villager_solange` (rangée `solange`): blouse sauge à deux poches sur une jupe prune, chignon roux de théâtre, ciseaux pendus au côté droit, lunettes au cou sur leur cordon. Squelette commun, mêmes expressions et clips.
- Coupes: `player_hair_crop`, `curls`, `ponytail`, `braid`, `pigtails`, `wavy`, `long`, `fringe`, `quiff`, `cloud`, `crown`, `bob_long` (avec les trois existantes, 15). Pilosité, au choix de chacun, couleur des cheveux: `player_beard_short`, `player_beard_full`, `player_mustache` (une pièce de plus à montrer avec la coupe). La tresse et la queue de cheval descendent sur l'os `neck`; la tresse et le pan du long dans le dos passent à droite du pan du foulard.
- Couleurs: `PLAYER_PRESETS["hair_colors"]` de `palette.py` (`hairColor` 0 à 7: noir, brun, châtain, auburn, roux, blond paille, gris, blanc), une paire (`hair`, `hair_dark`) à écrire dans la rangée du joueur, comme les autres couleurs. Valeurs proposées, à arrêter par le directeur artistique; non reportées dans `src/` (hors du lot).
- Couché (`sleep`, mesuré par `verifier/coiffures_couche.py`): la plupart des coupes nouvelles restent à moins de 1,5 cm des coupes existantes sous la tête; `cloud` (-10 cm sous `short`), `long` et `ponytail` (-8 cm) et `braid` (-7 cm) s'enfoncent dans l'oreiller. À traiter au rendu (voir le compte rendu du tour 10) ou par un clip de coucher propre aux coupes longues.

### Budgets du tour 10 (bible 8.8; contenu des intérieurs compté à part, invisible hors de l'intérieur)

| Nœud | Triangles | Plafond | Remarque |
|---|---|---|---|
| `ferrand_shop` (coque) | 4 976 | 5 000 | contenu `ferrand_shop_interior` 6 560 |
| `haberdashery` (coque) | 3 288 | 5 000 (boutique) | contenu 2 964 |
| `bakery` | 4 348 | 5 000 | four et cheminée compris |
| `lucie_house` | 3 480 | 3 000 | jardinet clos compris (520): au-dessus du plafond d'un petit bâtiment, signalé |
| `school` | 5 044 | 5 000 | cour, murs, tilleul et portail compris (912): 44 au-dessus, signalé |
| `culvert`, `street_bridge`, `footbridge`, `ford_stones` | 336, 804, 484, 96 | 900 | |
| `gatekeeper_cellar` | 1 332 | 3 000 | |
| `gatekeeper_bedroom` | 2 264 | 3 000 | |
| `gatekeeper_house` (deux états, murs à porte, fenêtres de dedans) | 8 256 | 3 000 par état | état réparé 4 188 (3 768 avant les fenêtres vues de dedans), murs à porte 728 à part: déjà au-dessus avant ce tour, signalé |
| `oak_chest`, `cellar_rack`, `tool_rack` | 276, 840, 352 | 900 | |
| un état de rideaux (une couleur) | 190 à 430 | 900 | `curtains_window` entier: 5 636 |
| `ridge_purlin` | 140 | 900 | |
| `villager_achille`, `villager_solange` | 1 854, 2 050 | 3 600 | |
| coupes nouvelles | 148 à 432 | celles de la conception 2.1 | joueur complet au plus 2 006 - 316 + 432 + 308 (barbe) = 2 430 < 3 200 |

Poids: `bourg.glb` 6,2 Mo (3,9 avant, environ 32 000 triangles de plus), `personnages.glb` 3,9 Mo (2,8), `maison.glb` 1,4 Mo (0,9). Le total dépasse 13 Mo: la compression Meshopt (README, Conventions) le diviserait par trois ou quatre si le poids devient un sujet.

## Garde-robe de la 0.12 (`personnages.glb`, contrat `docs/jeux/jeu-1/garde-robe-0-12.md`)

Sources: `assets-src/modeles/garde_robe.py` (pièces), `personnages.py` (assemblage), `vetements_donnees.py` (écrit `donnees/vetements.json`, 73 vêtements), planches `planche_beaute.py`. Planches: `docs/jeux/jeu-1/gauntlet/captures/v0-12/beaute/`.

- Foulards des joueurs retirés (plus de nœuds `player_scarf_*`). Le profil Duo se lit sur un écusson brodé de 8 cm au milieu de la poitrine, au-dessus de la bavette de la salopette: `player_badge_<symbole>` (sur le haut ou le tee-shirt de la salopette) ou `player_badge_<symbole>_outer` (quand un vêtement `outer` est porté). Fond `scarf` (couleur du profil), liseré et symbole `scarf_mark`, comme l'ancien foulard.
- `player_base` devient un corps nu-neutre: tête, cou, mains, bras et jambes en peau, torse et bassin en sous-vêtement (`wear_under`). Pas de pieds: les chaussures sont obligatoires. Expressions inchangées.
- Vêtements: un nœud par style, `wear_<slot>_<style>`, maillage à peau sur le squelette commun (mêmes os que le corps: rien qui traverse dans les clips, enveloppes emboîtées). Extras: `slot`, et `covers` sur la salopette (`["top"]`: ne pas dessiner le haut avec elle, elle a son tee-shirt).
  - `top`: `tshirt`, `chemise`, `pull`, `debardeur`, `mariniere`
  - `bottom`: `pantalon`, `short`, `salopette`, `jupe`, `pantacourt`
  - `shoes`: `bottines`, `bottes`, `sabots`, `espadrilles`, `baskets`
  - `outer`: `veste`, `gilet`, `cire`
  - `hat`: `casquette`, `paille`, `bonnet`
- Couleurs: les vêtements lisent la rangée 1 de `personnages.png` (inutilisée jusqu'ici par les maillages), que le rendu écrit dans la texture de chaque joueur, à côté de sa rangée 0. Colonnes (`garde_robe.WEAR_SLOTS`): 0 `top_p`, 1 `top_s`, 2 `top_m`, 3 `bottom_p`, 4 `bottom_s`, 5 `bottom_m`, 6 `shoes_p`, 7 `shoes_s`, 8 `outer_p`, 9 `outer_s`, 10 `outer_m`, 11 `hat_p`, 12 `hat_s`, 13 `hat_m`, 14 `wear_metal` (boutons, boucles: `#C8A150`, fixe), 15 `wear_under` (sous-vêtement du corps: `#E4DCCB`, fixe). `_p` = `principale`, `_s` = `secondaire`, `_m` = `motif` (la secondaire s'il manque). Un seul matériau: les pièces portées se fusionnent avec `player_base` comme les tenues d'avant.
- Coupes sous un chapeau: `player_hair_<coupe>_hat` pour les 15 coupes (ce qui monte au-dessus du bandeau rentre sous la calotte; les mèches du dessous et les tresses restent). Montrer la variante `_hat` dès qu'un `hat` est porté.
- Les anciennes tenues `player_outfit_work`, `smock`, `overalls` restent dans le fichier le temps que le rendu passe aux vêtements (elles s'enfilent sur le nouveau corps): à retirer ensuite.
- Budget (bible 8.8, plafond du joueur habillé de pied en cap 4 500 depuis le 2026-11-03): tenue courante (chemise, pantalon, bottines, coupe courte avec ses mèches, écusson) 3 392 triangles; pire cas sans chapeau (haut et bas les plus lourds, bottines, veste, coupe à mèches la plus lourde, barbe fournie, écusson soleil) 4 642, soit 142 au-dessus du plafond: signalé (dans les +50 % accordés aux personnages avec le plafond de scène à 350 000).

## Passe beauté de la 0.12 (`personnages.glb`)

Sources: `coiffures.py` (mèches), `animations_012.py` (clips), `personnages.py`. Planches: `docs/jeux/jeu-1/gauntlet/captures/v0-12/beaute/beaute-*-avant-apres.webp` (`planche_beaute2.py` puis `planche_beaute2.sh`). Contacts mesurés par `verifier/contacts_gestes.py`.

- Coupes: mèches en lobes allongés couchées sur la calotte, du sommet vers la nuque, les tempes ou le front (une sur trois en `hair_dark`), pour 12 des 15 coupes (ras, boucles et nuage gardent leur forme). Les variantes `_hat` n'ont pas de mèches (cachées par le chapeau). Mêmes mèches sur les chignons d'Odette et de Solange.
- Habitants: yeux un peu plus grands et plus écartés, mains (moufles) plus franches pour tous, chaussures en galet plus rondes avec semelle, col arrondi en deux rabats couchés sur la poitrine. Aucun nœud renommé.
- Clips refaits, mêmes noms et mêmes durées (sauf `idle`, qui passe de 3 à 6 s pour varier l'attente): marche en 8 clés (amorti, passage, poussée, balancier des bras avec l'avant-bras en retard, bassin qui tourne et penche, tête qui compense), `carry_two` sur la même base, attente qui respire (toutes les 2 s) avec appui sur une jambe, regard à gauche puis à droite et une main qui se lève, houe et hache avec anticipation, suspension, recul et retour, semis, arrosage qui balaie la rangée, récolte en deux temps, scie et marteau qui poussent avec le buste, parler avec les deux mains, donner, manger, assis, saluer, caresser.
- Contacts conservés (`gestureImpact` de `src/rendu/reglages.ts`, main droite au plus bas): houe 0,533 s (0,533 avant), récolte 0,30 s (0,30), marteau 0,267 s (0,30 avant, 0,27 attendu), semis inchangé (jet à 0,4 s); hache: la pose de frappe tient de 0,567 à 0,767 s comme avant.
- Clips nouveaux (pour le branchement action vers clip):

| Clip | Durée | Boucle | Contact | Usage |
|---|---|---|---|---|
| `sit_down` | 0,6 s | non | | s'asseoir: de debout à la pose de `sit` (enchaîner sur `sit`) |
| `stand_up` | 0,6 s | non | | se lever: de `sit` à debout (enchaîner sur `idle`) |
| `pickup` | 1,0 s | non | 0,43 s | ramasser au sol, remonter l'objet à la poitrine |
| `feed` | 1,2 s | oui | 0,4 s | nourrir les poules (grain jeté bas depuis un sac à la hanche) |
| `cook` | 1,6 s | oui | 0,4 s | cuisiner: la droite remue, la gauche tient la casserole |
| `drink` | 1,6 s | oui | 0,8 s | boire (tasse sous `socket_hand_r`) |
| `carry_one` | 0,533 s | oui | | marcher en portant seul devant la poitrine (mêmes pas que `walk`) |
| `carry_one_idle` | 3,0 s | oui | | à l'arrêt avec l'objet porté seul |

## Habitants de la 0.13 (lot H6 de `docs/jeux/jeu-1/v0-13-habitants.md`)

Sources: `assets-src/modeles/habitants_013.py` (habitants, loupe, accessoires, vélos, clips `push_bike`), `chat.py` (appelé par `faune.py`). Planches: `planche_habitants_013.py <dossier> [habitants|rangee|accessoires|tout]` puis `planche_habitants_013.sh <dossier> <sortie>`, `verifier/planche_chat.py <dossier>`; livrées dans `docs/jeux/jeu-1/gauntlet/captures/v0-13/habitants/`.

- Quatorze habitants sur le squelette commun `rig`, mêmes clips et mêmes clés de forme (`happy`, `delighted`, `tired`, `hungry`, `blink`) que les habitants de la démo. L'échelle de pose (extra `scale` du nœud) est à reporter dans `habitants.json` (champ `scale`, comme Jeanne à 0,75): os communs, les gabarits passent par l'échelle (Armand 1,035 pour ses 1,80 m, Inès 1,03).

| Nœud | Échelle | Triangles | Ce qui le fait reconnaître |
|---|---|---|---|
| `villager_armand` | 1,035 | 2646 | veste de velours noisette ouverte sur une chemise blanche, noeud papillon bleu nuit, lunettes rondes, raie sur le côté, craie dans la poche |
| `villager_berthe` | 1,0 | 2186 | gilet vert bouteille sur blouse écrue, avant-bras et mains farinés, jupe brune tachée de farine, sabots, cheveux gris frisés |
| `villager_martial` | 1,0 | 2230 | soutane noire retroussée à mi-mollet, col romain, pinces à vélo de laiton aux chevilles, chapeau rond à larges bords relevé devant |
| `villager_marthe` | 0,92 | 2586 | robe gris perle, tablier bleu ardoise à bavette et poches, gants de toile, trousseau de clés à droite, chapeau de paille noir à ruban, petit chignon |
| `villager_honorine` | 0,86 | 2828 | pèlerine crème au dos rond (voûtée, tête en avant), robe bleu passé à fleurettes, chignon blanc minuscule, lunettes, canne de buis à la main droite |
| `villager_ines` | 1,03 | 2338 | veste vert sapin à écusson et poches, velours brun, guêtres de cuir, chapeau de garde à bord rabattu, natte noire, marteau forestier à la ceinture |
| `villager_barnabe` | 1,10 | 2378 | chemise à carreaux sous un gilet de cuir, barbe noire piquée de gris, bonnet brun à revers, joues de charbon |
| `villager_mado` | 1,0 | 2570 | bras nus musclés, chemise écrue, tablier de cuir noirci court, cheveux châtain-roux frisés, lunettes de forge relevées sur le front, marteau à la ceinture |
| `villager_paulin` | 0,97 | 2750 | chemise grise rayée, velours brun à bretelles, bottes, moustache épaisse, chapeau de paille cabossé |
| `villager_margot` | 0,97 | 3262 | robe vert pomme à petits carreaux, tablier bleu-gris, sabots, joues rouges, chignon haut piqué d'un crayon |
| `villager_leon` | 0,78 | 2386 | chemise blanche sortie, culottes de velours, bretelles, casquette de cheminot trop grande et de travers, épi, pansement au genou gauche, sifflet au cou sur un lacet |
| `villager_ambroise` | 0,94 | 2274 | blouse grise d'atelier, gilet noir et chaîne de montre de laiton, manchettes de lustrine, crâne chauve, couronne blanche et favoris, gros sourcils |
| `villager_nour` | 1,0 | 2574 | veste de toile kaki à quatre poches, pantalon fuselé, bottes de caoutchouc vertes, stéthoscope, grosse sacoche de cuir à la hanche gauche, boucles en queue |
| `villager_colette` | 1,0 | 2598 | robe brique, manches retroussées, tablier noir court, carré noir à frange, torchon rayé sur l'épaule gauche (les boucles d'oreilles de la fiche restent cachées sous le carré) |

- Texture `personnages.png`: 64 x 128 depuis la 0.13 (32 rangées de 16 cases, `palette.CHAR_GRID_H`). Rangées 0 à 10 inchangées (joueurs, démo, équipage, Achille, Solange), puis les quatorze habitants, puis `bicycles` et `props`. La copie peinte par joueur reprend la taille de la source (`PlayerTexture`), rien à changer côté rendu. Chez les habitants, les cases `scarf` et `scarf_mark` portent deux couleurs de plus (aucun ne porte de foulard).
- Pièces portées d'Ambroise (à fusionner avec `villager_ambroise` comme l'écharpe de Firmin, `VILLAGER_WORN`): `villager_ambroise_loupe` (loupe vissée à l'oeil gauche, au travail, à sa fenêtre) et `villager_ambroise_loupe_up` (relevée sur le front, en marchant); une seule des deux à la fois. Le sifflet de Léon est dans son maillage.
- Accessoires (objets fixes du même matériau, sans squelette): `school_satchel` (cartable d'Armand, 248 triangles), `milk_can` (pot à lait de Margot, 330), `felling_axe` (hache de Barnabé, 112), `accordion` (accordéon de Colette, P1, 240). Origine à la prise, ils pendent sous `socket_hand_r` comme les outils de `ferme.glb` (la hache se porte à l'épaule comme les autres outils hors geste); l'accordéon a son origine au centre, à tenir devant la poitrine avec `carry_one_idle`.
- Vélos poussés à la main: `bicycle_lucie` (noir, porte-bagages, deux sacoches, plaque de la poste, 1184), `bicycle_martial` (vélo de course vert loco, cintre, pompe, 880), `bicycle_nour` (noir, panier d'osier, 1026). Origine sous celui qui pousse: poser le vélo avec la même position et la même orientation que lui; le vélo est à sa gauche (axe à x 0,56 m), la poignée gauche sous sa main gauche (extra `hand_l`, repère glTF). Roues: nœuds enfants `<vélo>_wheel_front` et `_wheel_rear`, origine à l'axe, tourner autour de leur X local de `distance / wheel_radius` (0,335 m). Ces trois vélos dépassent le plafond d'un accessoire (900): ce sont des véhicules vus de près dans le bourg, signalé.
- Clips nouveaux sur le squelette commun: `push_bike` (0,533 s, boucle: mêmes pas que `walk`, main gauche posée sur la poignée, écart mesuré 6 mm) et `push_bike_idle` (3 s, boucle: arrêté à côté du vélo).
- Chat du bourg (`faune.glb`, nœud `cat`, maillage `cat_mesh`, 1156 triangles): tigré gris à plastron, museau et chaussettes blancs, yeux vert-jaune; 0,46 m de corps, 0,25 m au garrot. Clips: `cat_idle` (assis, la queue qui bat, regards, oreille qui frémit; 7,3 s), `cat_walk` (pas en quatre temps, queue dressée en crosse, 0,8 s pour 0,35 m/s: `timeScale = vitesse / 0,35`), `cat_sleep` (couché en rond, pattes repliées, queue autour de lui, il respire; 3 s), `cat_roll` (il se roule sur le dos, pattes en l'air, et revient; 2,7 s). Les poses assises et couchées sont posées au sol par calcul (point le plus bas du maillage déformé). Noms préfixés comme les autres bêtes de `faune.glb` (`cat_idle` pour `idle`).
- Poids: `personnages.glb` passe de 6,4 à 10,8 Mo (environ 330 Ko par habitant: ombrage en aplats, sommets non partagés). La compression Meshopt (Conventions) le diviserait par trois ou quatre si le poids devient un sujet.

## Fiche par modèle

### `personnages.glb` (10849 Ko)

| Nœud | Triangles |
|---|---|
| `player_base` | 1094 |
| `player_outfit_work` | 1186 |
| `player_outfit_smock` | 1242 |
| `player_outfit_overalls` | 1186 |
| `player_hair_short` | 676 |
| `player_hair_bob` | 676 |
| `player_hair_bun` | 632 |
| `player_hair_crop` | 148 |
| `player_hair_curls` | 388 |
| `player_hair_ponytail` | 580 |
| `player_hair_braid` | 648 |
| `player_hair_pigtails` | 720 |
| `player_hair_wavy` | 676 |
| `player_hair_long` | 688 |
| `player_hair_fringe` | 604 |
| `player_hair_quiff` | 416 |
| `player_hair_cloud` | 432 |
| `player_hair_crown` | 648 |
| `player_hair_bob_long` | 704 |
| `player_beard_short` | 224 |
| `player_beard_full` | 308 |
| `player_mustache` | 72 |
| `wear_top_tshirt` | 346 |
| `wear_top_chemise` | 670 |
| `wear_top_pull` | 514 |
| `wear_top_debardeur` | 180 |
| `wear_top_mariniere` | 506 |
| `wear_bottom_pantalon` | 476 |
| `wear_bottom_short` | 332 |
| `wear_bottom_salopette` | 826 |
| `wear_bottom_jupe` | 168 |
| `wear_bottom_pantacourt` | 364 |
| `wear_shoes_bottines` | 368 |
| `wear_shoes_bottes` | 320 |
| `wear_shoes_sabots` | 184 |
| `wear_shoes_espadrilles` | 200 |
| `wear_shoes_baskets` | 344 |
| `wear_outer_veste` | 834 |
| `wear_outer_gilet` | 666 |
| `wear_outer_cire` | 774 |
| `wear_hat_casquette` | 192 |
| `wear_hat_paille` | 212 |
| `wear_hat_bonnet` | 196 |
| `player_badge_orb` | 108 |
| `player_badge_orb_outer` | 108 |
| `player_badge_crescent` | 152 |
| `player_badge_crescent_outer` | 152 |
| `player_badge_star` | 108 |
| `player_badge_star_outer` | 108 |
| `player_badge_sun` | 172 |
| `player_badge_sun_outer` | 172 |
| `player_badge_planet` | 120 |
| `player_badge_planet_outer` | 120 |
| `player_badge_comet` | 116 |
| `player_badge_comet_outer` | 116 |
| `player_hair_short_hat` | 316 |
| `player_hair_bob_hat` | 352 |
| `player_hair_bun_hat` | 380 |
| `player_hair_crop_hat` | 148 |
| `player_hair_curls_hat` | 388 |
| `player_hair_ponytail_hat` | 328 |
| `player_hair_braid_hat` | 396 |
| `player_hair_pigtails_hat` | 432 |
| `player_hair_wavy_hat` | 352 |
| `player_hair_long_hat` | 400 |
| `player_hair_fringe_hat` | 280 |
| `player_hair_quiff_hat` | 236 |
| `player_hair_cloud_hat` | 432 |
| `player_hair_crown_hat` | 432 |
| `player_hair_bob_long_hat` | 380 |
| `villager_firmin` | 2038 |
| `villager_odette` | 2434 |
| `villager_basile` | 2398 |
| `villager_jeanne` | 2286 |
| `villager_lucie` | 2218 |
| `villager_achille` | 2086 |
| `villager_solange` | 2534 |
| `villager_armand` | 2646 |
| `villager_berthe` | 2186 |
| `villager_martial` | 2230 |
| `villager_marthe` | 2586 |
| `villager_honorine` | 2828 |
| `villager_ines` | 2338 |
| `villager_barnabe` | 2378 |
| `villager_mado` | 2570 |
| `villager_paulin` | 2750 |
| `villager_margot` | 3262 |
| `villager_leon` | 2386 |
| `villager_ambroise` | 2274 |
| `villager_nour` | 2574 |
| `villager_colette` | 2598 |
| `villager_ambroise_loupe` | 92 |
| `villager_ambroise_loupe_up` | 92 |
| `school_satchel` | 248 |
| `milk_can` | 330 |
| `felling_axe` | 112 |
| `accordion` | 240 |
| `bicycle_lucie` | 1184 |
| `bicycle_martial` | 880 |
| `bicycle_nour` | 1026 |
| `villager_firmin_scarf` | 232 |
| `rail_crew_driver` | 1630 |
| `rail_crew_stoker` | 1674 |

| Animation | Durée (s) | Boucle |
|---|---|---|
| `idle` | 6.0 | oui |
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
| `sit_down` | 0.6 | non (jouer une fois) |
| `stand_up` | 0.6 | non (jouer une fois) |
| `drink` | 1.6 | oui |
| `carry_one` | 0.533 | oui |
| `carry_one_idle` | 3.0 | oui |
| `cook` | 1.6 | oui |
| `pickup` | 1.0 | non (jouer une fois) |
| `feed` | 1.2 | oui |
| `push_bike` | 0.533 | oui |
| `push_bike_idle` | 3.0 | oui |

### `ferme.glb` (1023 Ko)

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
| `ridge_purlin` |  | 140 | kind: "carried", length_axis: "z", carry_height: 1.78, length_m: 4.9 |
| `nail_box` |  | 356 | kind: "item" |
| `hen_feeder` | 1 x 1 | 84 |  |
| `grain_sack` |  | 144 | kind: "item" |
| `water_barrel` | 1 x 1 | 356 |  |
| `hen` |  | 1494 | variants: ["hen_white", "hen_red", "hen_black"], tris_each_variant: 498 |

Animations: `hen_idle`, `hen_walk`, `hen_peck`

### `bourg.glb` (6029 Ko)

| Nœud | Emprise (cases) | Triangles | Données utiles (extras) |
|---|---|---|---|
| `station` | 10 x 6 | 4016 | door_cell: 4 |
| `platform` | 30 x 4 | 3328 | walk_height: 0.4, track_side: "-z", note: "bord côté voie vers -Z (arrière); marquise centrée sur 10 m" |
| `gatekeeper_house` | 7 x 6 | 8256 | door_cell: 3, cut_walls: true, interior: {"x": [-2.5, 2.5], "z": [-2.0, 2.0], "floor_y": 0.12}, states: ["gatekeeper_house_ruin", "gatekeeper_house_repaired"] |
| `gatekeeper_cellar` |  | 1332 | room: "room_cellar", attach: "gatekeeper_house (même origine, même rotation)", footprint_world: {"x": [2, 5], "y": [21, 27]}, interior: {"x": [-5.5, -2.8], "z": [-2.0, 2.0], "floor_y": 0.12}, elements: [{"id_hint": "post_1", "nodes": ["gatekeeper_cellar_post_1"], "planks": 2, "nails": 1}, {"id_hint": "post_2", "nodes": ["gatekeeper_cellar_post_2"], "planks": 2, "nails": 1}, {"id_hint": "plate", "nodes": ["gatekeeper_cellar_plate"], "planks": 3, "nails": 2, "needs": ["post_1", "post_2"]}, {"id_hint": "wall_1", "nodes": ["gatekeeper_cellar_wall_left"], "planks": 3, "nails": 1, "needs": ["plate"]}, {"id_hint": "wall_2", "nodes": ["gatekeeper_cellar_wall_back", "gatekeeper_cellar_wall_front"], "planks": 3, "nails": 1, "needs": ["plate"]}, {"id_hint": "roof", "nodes": ["gatekeeper_cellar_roof_frame"], "planks": 3, "nails": 2, "needs": ["wall_1", "wall_2"]}], built_nodes: ["gatekeeper_cellar_roof", "gatekeeper_cellar_door"], site_nodes: ["gatekeeper_cellar_floor"], cut_nodes: ["gatekeeper_cellar_roof", "gatekeeper_cellar_roof_frame"], rack_spots: [{"x": -5.0, "z": -1.0, "facing": "+x", "cells": [[3, 22], [3, 23]]}, {"x": -5.0, "z": 1.0, "facing": "+x", "cells": [[3, 24], [3, 25]]}], note: "repère de gatekeeper_house. site_nodes dès le matin du site; éléments en fantôme puis bâtis; built_nodes au matin de room_built, avec gatekeeper_house_wall_left_door à la place de gatekeeper_house_repaired_wall_left. rack_spots: les deux places d'étagère haute, dos au pignon ouest (cases de la carte pour la maisonnette en (8,5 ; 24), rotation 0)" |
| `gatekeeper_bedroom` |  | 2264 | room: "room_bedroom", attach: "gatekeeper_house (même origine, même rotation)", footprint_world: {"x": [5, 12], "y": [16, 22]}, interior: {"x": [-2.5, 2.5], "z": [-7.0, -2.3], "floor_y": 0.12}, elements: [{"id_hint": "post_1", "nodes": ["gatekeeper_bedroom_post_1"], "planks": 2, "nails": 1}, {"id_hint": "post_2", "nodes": ["gatekeeper_bedroom_post_2"], "planks": 2, "nails": 1}, {"id_hint": "post_3", "nodes": ["gatekeeper_bedroom_post_3"], "planks": 2, "nails": 1}, {"id_hint": "post_4", "nodes": ["gatekeeper_bedroom_post_4"], "planks": 2, "nails": 1}, {"id_hint": "plate_1", "nodes": ["gatekeeper_bedroom_plate_1"], "planks": 3, "nails": 1, "needs": ["post_1", "post_2", "post_3", "post_4"]}, {"id_hint": "plate_2", "nodes": ["gatekeeper_bedroom_plate_2"], "planks": 3, "nails": 1, "needs": ["post_1", "post_2", "post_3", "post_4"]}, {"id_hint": "wall_1", "nodes": ["gatekeeper_bedroom_wall_left"], "planks": 3, "nails": 1, "needs": ["plate_1", "plate_2"]}, {"id_hint": "wall_2", "nodes": ["gatekeeper_bedroom_wall_right"], "planks": 3, "nails": 1, "needs": ["plate_1", "plate_2"]}, {"id_hint": "wall_3", "nodes": ["gatekeeper_bedroom_wall_back"], "planks": 3, "nails": 1, "needs": ["plate_1", "plate_2"]}, {"id_hint": "wall_4", "nodes": ["gatekeeper_bedroom_wall_back_gable"], "planks": 3, "nails": 1, "needs": ["plate_1", "plate_2"]}, {"id_hint": "truss_ridge", "nodes": ["gatekeeper_bedroom_truss"], "planks": 4, "nails": 2, "needs": ["wall_1", "wall_2", "wall_3", "wall_4"], "after_carry": "ridge_purlin"}, {"id_hint": "floor", "nodes": ["gatekeeper_bedroom_floor"], "planks": 6, "nails": 2}], built_nodes: ["gatekeeper_bedroom_roof", "gatekeeper_bedroom_door"], site_nodes: ["gatekeeper_bedroom_sill"], cut_nodes: ["gatekeeper_bedroom_roof", "gatekeeper_bedroom_truss", "gatekeeper_bedroom_wall_back_gable"], ridge_purlin: {"from": [0.0, 3.52, -2.78], "to": [0.0, 3.52, -7.6], "length": 4.82, "note": "dessus de la panne posée (repère de la maisonnette): là où le porter à deux l'amène"}, furniture_spots: {"double_bed": [-1.25, -5.9], "dresser": [1.75, -6.65], "armchair": [1.9, -3.4]}, note: "repère de gatekeeper_house. site_nodes dès le matin du site; éléments en fantôme puis bâtis; built_nodes au matin de room_built, avec gatekeeper_house_wall_back_door à la place de gatekeeper_house_repaired_wall_back" |
| `ferrand_shop` | 10 x 8 | 11536 | door_cell: 2, counter_cell: 6, cut_walls: true, cut_nodes: ["ferrand_shop_roof", "ferrand_shop_upper"], interior: {"floor_y": 0.12, "rooms": [{"id": "shop", "x": [-4.0, 2.0], "z": [-3.0, 3.0]}, {"id": "dining", "x": [2.0, 4.0], "z": [-3.0, 3.0], "walkable": false, "note": "vue par la porte entrouverte de la cloison; pas de case jouable"}]}, note: "façade à l'est sur la carte (rotation 1); murs du rez-de-chaussée coupés selon la caméra, ferrand_shop_upper et ferrand_shop_roof retirés en entier, ferrand_shop_floor jamais coupé" |
| `haberdashery` | 7 x 7 | 6252 | door_cell: 3, cut_walls: true, cut_nodes: ["haberdashery_roof", "haberdashery_attic"], interior: {"x": [-2.5, 2.5], "z": [-2.5, 2.5], "floor_y": 0.12}, note: "façade à l'est sur la carte (rotation 1): +X glTF = nord. Murs coupés selon la caméra, haberdashery_roof et haberdashery_attic retirés en entier, haberdashery_floor jamais coupé" |
| `bakery` | 7 x 6 | 4348 | door_cell: 5, window_cell: 3, spots: {"bakery_window": [0.0, 3.0], "bakery_door": [1.9, 3.0], "sacks_door": [-3.6, 0.6], "spot_hourglass": [0.45, 2.7]}, note: "porte en case 5, guichet en case 3 (le point bakery_window se tient dehors, devant le guichet, sous l'auvent); porte des sacs au pignon ouest; four et cheminée côté voie (nord). spots: repère glTF x, z du bâtiment; spot_hourglass: rebord du guichet, où poser le sablier offert" |
| `lucie_house` | 6 x 6 | 3480 | door_cell: 2, spots: {"lucie_house_door": [-0.5, 3.2]}, note: "façade à l'ouest sur la carte (rotation 3); jardinet clos à l'arrière (est), dans l'emprise" |
| `school` | 11 x 5 | 5044 | door_cell: 3, spots: {"school_gate": [-2.0, 3.0], "town_hall_door": [2.7, 2.9]}, note: "portail de la cour en case 3 (dans l'axe de la rue Haute), porte de la mairie en case 8; la classe s'ouvre sur la cour" |
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
| `culvert` | 4 x 3 | 336 | flow_axis: "z", note: "ponceau sous la voie: têtes de pont arasées à 4 cm, voûte de 1,5 m, lit à -0,95 m; à poser sous rail_straight, centré sur le ru" |
| `street_bridge` | 4 x 3 | 804 | flow_axis: "z", walk_height: 0.02, deck_width: 2.2, note: "pont de la rue: tablier pavé au niveau de la rue (2,2 m entre parapets), parapets de 0,35 m hors des deux rangées de pavés" |
| `footbridge` | 4 x 2 | 484 | flow_axis: "z", walk_height: 0.16, deck_width: 1.5, note: "passerelle: platelage à 0,16 m, garde-corps au sud (+Z glTF, côté aval)" |
| `ford_stones` | 2 x 1 | 96 | flow_axis: "z", walk_height: -0.12, note: "gué de pierres plates: quatre dalles, dessus à -0,12 m" |
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

### `maison.glb` (1329 Ko)

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
| `oak_chest` | 1 x 1 | 276 | storage_cells: 32 |
| `cellar_rack` | 2 x 1 | 840 | wall: true, storage_cells: 12, note: "seulement aux deux places du cellier (rack_spots de gatekeeper_cellar), dos au pignon ouest" |
| `tool_rack` | 2 x 1 | 352 | wall: true, hook_spots: [[-0.715, 1.5, -0.37], [-0.585, 1.5, -0.37], [-0.455, 1.5, -0.37], [-0.325, 1.5, -0.37], [-0.195, 1.5, -0.37], [-0.065, 1.5, -0.37], [0.065, 1.5, -0.37], [0.195, 1.5, -0.37], [0.325, 1.5, -0.37], [0.455, 1.5, -0.37], [0.585, 1.5, -0.37], [0.715, 1.5, -0.37]], note: "outils pendus à hook_spots (12 crochets), près de la porte" |
| `curtains_window` |  | 5636 | rod: "curtains_rod", states: {"curtains": {"open": "curtains_open", "closed": "curtains_closed"}, "curtains_blue": {"open": "curtains_blue_open", "closed": "curtains_blue_closed"}, "curtains_red": {"open": "curtains_red_open", "closed": "curtains_red_closed"}, "curtains_yellow": {"open": "curtains_yellow_open", "closed": "curtains_yellow_closed"}, "curtains_green": {"open": "curtains_green_open", "closed": "curtains_green_closed"}, "curtains_gingham": {"open": "curtains_gingham_open", "closed": "curtains_gingham_closed"}}, window_size: [0.75, 0.9], note: "origine au centre de la fenêtre (window_<n>), au nu intérieur du mur; la pièce vers +Z glTF. Montrer curtains_rod et l'état de l'article posé; échelle X = width / 0,75, Y = height / 0,9" |
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

### `faune.glb` (1403 Ko)

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
| `cat` |  | 1156 | kind: "animal", origin: "sol entre les pattes", withers: 0.25, length: 0.46, tail: 0.3, collision_radius: 0.25, note: "cat_idle assis, cat_walk 0,35 m/s (timeScale = vitesse / 0,35), cat_sleep couché en rond, cat_roll sur le dos (caresse à deux); la racine ne bouge pas" |
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
| `cat` | `cat_walk` | 0.8 | oui |
| `cat` | `cat_idle` | 7.333 | oui |
| `cat` | `cat_sleep` | 3.0 | oui |
| `cat` | `cat_roll` | 2.667 | oui |

### `poissons.glb` (808 Ko)

| Nœud | Emprise (cases) | Triangles | Données utiles (extras) |
|---|---|---|---|
| `fish_gudgeon` |  | 496 | kind: "fish", rarity: "common", length_m: 0.115, length_cm: [8, 15], hold_tail: [0.0, 0.0, -0.0448], mouth: [0.0, 0.0, 0.0451] |
| `fish_minnow` |  | 436 | kind: "fish", rarity: "common", length_m: 0.075, length_cm: [5, 10], hold_tail: [0.0, 0.0, -0.0292], mouth: [0.0, 0.0, 0.0294] |
| `fish_stone_loach` |  | 528 | kind: "fish", rarity: "common", length_m: 0.09, length_cm: [6, 12], hold_tail: [0.0, 0.0, -0.0396], mouth: [0.0, 0.0, 0.0353] |
| `fish_bleak` |  | 376 | kind: "fish", rarity: "common", length_m: 0.14, length_cm: [10, 18], hold_tail: [0.0, 0.0, -0.0546], mouth: [0.0, 0.0049, 0.0549] |
| `fish_roach` |  | 376 | kind: "fish", rarity: "common", length_m: 0.21, length_cm: [12, 30], hold_tail: [0.0, 0.0, -0.0819], mouth: [0.0, 0.0, 0.0823] |
| `fish_chub` |  | 380 | kind: "fish", rarity: "common", length_m: 0.35, length_cm: [20, 50], hold_tail: [0.0, 0.0, -0.1365], mouth: [0.0, 0.0, 0.1372] |
| `fish_trout` |  | 600 | kind: "fish", rarity: "rare", length_m: 0.325, length_cm: [20, 45], hold_tail: [0.0, 0.0, -0.1332], mouth: [0.0, 0.0, 0.1274] |
| `fish_perch` |  | 564 | kind: "fish", rarity: "rare", length_m: 0.25, length_cm: [15, 35], hold_tail: [0.0, 0.0, -0.0975], mouth: [0.0, 0.0, 0.098] |
| `fish_dace` |  | 424 | kind: "fish", rarity: "rare", length_m: 0.215, length_cm: [15, 28], hold_tail: [0.0, 0.0, -0.0838], mouth: [0.0, 0.0, 0.0843] |
| `fish_bullhead` |  | 532 | kind: "fish", rarity: "rare", length_m: 0.115, length_cm: [8, 15], hold_tail: [0.0, 0.0, -0.0518], mouth: [0.0, 0.0, 0.0451] |
| `fish_tench` |  | 444 | kind: "fish", rarity: "rare", length_m: 0.325, length_cm: [20, 45], hold_tail: [0.0, 0.0, -0.1268], mouth: [0.0, 0.0, 0.1274] |
| `fish_barbel` |  | 476 | kind: "fish", rarity: "epic", length_m: 0.525, length_cm: [35, 70], hold_tail: [0.0, -0.0, -0.2048], mouth: [0.0, -0.0052, 0.2058] |
| `fish_pike` |  | 520 | kind: "fish", rarity: "epic", length_m: 0.725, length_cm: [50, 95], hold_tail: [0.0, 0.0, -0.319], mouth: [0.0, 0.0, 0.2842] |
| `fish_grayling` |  | 516 | kind: "fish", rarity: "epic", length_m: 0.35, length_cm: [25, 45], hold_tail: [0.0, 0.0, -0.1365], mouth: [0.0, 0.0, 0.1372] |
| `fish_brook_lamprey` |  | 384 | kind: "fish", rarity: "epic", length_m: 0.13, length_cm: [10, 16], hold_tail: [0.0, 0.0, -0.0624], mouth: [0.0, 0.0, 0.0494] |
| `fish_bitterling` |  | 408 | kind: "fish", rarity: "epic", length_m: 0.065, length_cm: [5, 8], hold_tail: [0.0, 0.0, -0.0254], mouth: [0.0, 0.0, 0.0255] |
| `fish_shad` |  | 496 | kind: "fish", rarity: "legendary", length_m: 0.45, length_cm: [35, 55], hold_tail: [0.0, 0.0, -0.1755], mouth: [0.0, 0.0, 0.1764] |
| `fish_mirror_carp` |  | 584 | kind: "fish", rarity: "legendary", length_m: 0.7, length_cm: [55, 85], hold_tail: [0.0, 0.0, -0.273], mouth: [0.0, 0.0, 0.2744] |
| `fish_salmon` |  | 560 | kind: "fish", rarity: "legendary", length_m: 0.85, length_cm: [70, 100], hold_tail: [0.0, -0.0, -0.3315], mouth: [0.0, -0.0102, 0.3332] |
| `fish_burbot` |  | 544 | kind: "fish", rarity: "legendary", length_m: 0.475, length_cm: [35, 60], hold_tail: [0.0, 0.0, -0.228], mouth: [0.0, 0.0, 0.1862] |
| `fish_golden_trout` |  | 596 | kind: "fish", rarity: "mythic", length_m: 0.45, length_cm: [42, 48], hold_tail: [0.0, 0.0, -0.1845], mouth: [0.0, 0.0, 0.1764] |
| `fish_moon_pike` |  | 588 | kind: "fish", rarity: "mythic", length_m: 1.175, length_cm: [110, 125], hold_tail: [0.0, 0.0, -0.517], mouth: [0.0, 0.0, 0.4606] |
| `landing_net` |  | 704 | kind: "tool", socket: "socket_hand_r", length_m: 1.75, hoop_diameter_m: 0.6, note: "manche couché vers l'avant (+Z glTF), cercle à plat, filet qui pend; origine à la main arrière, landing_net_hand_l = main avant, landing_net_hoop = centre du cercle" |

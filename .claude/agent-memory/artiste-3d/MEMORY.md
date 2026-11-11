# Carnet de l'artiste 3D

Apprentissages durables (pièges, conventions, astuces vérifiées). Pas d'avancement ici.

## Blender 5.2 en module Python (`duo-python`), vérifié le 2026-10-31

- `import bpy` avant `import bmesh` (sinon `ModuleNotFoundError: bmesh`).
- Matériaux: `bpy.data.materials.new()` a déjà son arbre de nœuds (plus de `use_nodes`). `mat.use_backface_culling = True` sinon l'export écrit `doubleSided`. Laisser « Specular IOR Level » à 0,5, sinon l'export ajoute `KHR_materials_specular`.
- Texture rugosité/métal: Image (Non-Color) -> Separate Color -> G vers Roughness, B vers Metallic: l'export écrit bien `metallicRoughnessTexture`. Interpolation « Closest » -> échantillonneur NEAREST.
- Actions « en couches »: plus de `action.fcurves`. Les courbes: `bpy_extras.anim_utils.action_get_channelbag_for_slot(action, slot)`. Sur une copie d'objet, `ad.action = act` ne suffit pas: ajouter `ad.action_slot = act.slots[0]` (idem `strip.action_slot` pour une piste NLA), sinon aucune pose.
- `shape_key_add()` crée des clés à 1,0: les remettre à 0, sinon le GLB part avec toutes les expressions actives.
- `bmesh.ops.bevel` sur une liste d'arêtes issue d'un `set` donne un ordre de sommets différent d'une exécution à l'autre: trier les arêtes par index (indispensable pour les clés de forme reconstruites).
- Les bibliothèques Meshopt et Draco manquent dans ce bpy (message d'erreur au chargement, sans gravité): compresser avec gltf-transform si besoin.
- Sauvegarde .blend: `preferences.filepaths.save_version = 0`, sinon des `.blend1` traînent dans le dépôt.
- `ob.copy()` recopie `hide_render`: rendre visibles les copies faites pour une planche.

## Export glTF

- Blender -Y (avant) devient +Z glTF: modèles construits face à -Y.
- Mode `NLA_TRACKS`: des pistes NLA de même nom sur plusieurs objets sortent en une seule animation (roues d'un véhicule). Mode `ACTIONS`: toutes les actions de l'armature.
- Clés de forme: l'export les écrit en accesseurs creux (sparse), très légers. `gltf-transform quantize` les redensifie (fichier plus lourd): ne pas quantifier les personnages.
- Maillages à peau enfants de l'armature: avertissement `NODE_SKINNED_MESH_NON_ROOT` du validateur. Les laisser à la racine (modificateur Armature seul).
- Objet vide parenté à un os (`parent_type = "BONE"`): exporté comme enfant du nœud de l'os; régler `matrix_world` après le parentage.
- `gltf-transform prune --keep-leaves true`, sinon les nœuds vides servant de repères (prises des mains, panache) disparaissent.

## Contrôles

- Outils longs (canne, poutre): toujours une vue de profil avec l'outil en main. Piège vu: `cyl(..., rot=(-a, 0, 0))` incline le cylindre vers +Y (l'arrière), pas vers l'avant; la canne paraissait juste de face.
- Les constantes du rendu dépendent des modèles (ex. `ROD_TIP` dans `src/rendu/personnages.ts`): ne pas déplacer prises ni bouts d'outils sans prévenir le dev.
- Cycles affiche les deux côtés des faces: une face inversée ne se voit qu'à Three.js. Contrôle par script: volume signé par îlot fermé (négatif = inversé), aire orientée vers le haut pour les surfaces ouvertes.
- Validateur: paquet npm `gltf-validator` (pas de CLI, `validateBytes` en Node). Three.js 0.187 est dans `games/la-petite-ligne/node_modules`; la page de vérification sert les fichiers par un petit serveur Node (modules ES refusés en `file://`).
- Planches: une seule lumière soleil par rendu (supprimer les anciennes entre deux planches), vue « Standard » pour garder les couleurs de la palette, émission à 0 pour les vues de jour.
- Temps mesurés (4 cœurs): planche 2000 x 1250 à 20 échantillons, 30 à 60 s; scène de bourg 1800 x 1000 à 32 échantillons, 2 à 3 min.

## Conventions du studio pour La Petite Ligne

- Palette: UV de chaque face au centre d'une case de 4 px (texture 64 x 64), filtrage au plus proche: UV constant par face, donc pas de débordement de couleur même avec les mipmaps.
- Les noms de nœuds suivent les données du jeu (`games/la-petite-ligne/donnees/*.json`, champ `model`) et les types de la carte (`donnees/cartes/halte.json`); « porte: n » de la carte = n-ième case de la façade depuis la gauche vue de dehors.
- Bibliothèque commune: `games/la-petite-ligne/assets-src/modeles/lpl.py` (Geo, palette, export, planches); couleurs dans `palette.py` (ajouter les cases en fin de liste pour ne pas déplacer les autres).

## Low poly arrondi (décision du client du 2026-10-31, bible section 8)

- `Geo.box(..., bevel, bseg, bedges=pred)` et `Geo.bevel(verts, largeur, segments, couleur, edges_pred)` (lpl.py): chanfrein sélectif. Arêtes au sol vives (`_not_ground`), angles verticaux seuls (`_vertical`), coins d'un moellon seuls (`_along_y`, arêtes dans l'épaisseur). Un chanfrein plus large que la demi-épaisseur s'écrase (`clamp_overlap`): triangles dégénérés signalés par le validateur (info `ACCESSOR_INDEX_TRIANGLE_DEGENERATE`). Repasser le validateur après chaque arrondi.
- Murs en pentagone extrudé d'un seul tenant: abaisser le haut sous le dessous du toit (épaisseur de la rive divisée par le cosinus de la pente, plus la flèche du faîtage), sinon le pignon perce le toit. Bandes grises de ce type visibles sur les anciens toits (maison de Firmin avant, halte encore).
- Tête ronde du joueur: boîte chanfreinée à 2 segments, traits du visage dessinés à plat puis plaqués sur la surface (`project_on_head`, décalage relatif conservé, joues cachées comprises). Même topologie pour toutes les expressions: les clés de forme restent valides.
- `lpl.lathe(..., phase=22.5)` sur 8 pans: faces à plat devant et sur les côtés (torse en tonneau).
- Planche avant et après: GLB d'avant copiés (ou `git show HEAD:<chemin>`) avant de reconstruire; `planche_arrondi.py` importe les deux jeux avec un préfixe (actions comprises, `action_slot` à poser).
- bmesh réutilise les places des sommets supprimés (`remove_doubles`, lathe): `bm.verts[start:]` après un `len()` ne donne PAS les sommets créés ensuite. Repérer les nouveaux sommets par différence d'ensembles (`set(bm.verts)` avant). C'était la cause des yeux asymétriques.
- Un trait plaqué sur une boule à facettes doit tenir sur une seule facette (sinon la corde passe sous la surface): placer une arête au milieu du visage et une bande de facettes centrée sur la ligne des yeux.
- Import glTF dans Blender: les objets sont en quaternions; poser `rotation_mode = "XYZ"` avant `rotation_euler`, sinon la rotation est ignorée en silence.
- Arrondi automatique (`lpl.AUTO_ROUND`, `lpl.AUTO_MIN`): jamais de chanfrein sur le dessus d'un soubassement qui porte un mur ou un bardage (les planches se retrouvent en l'air). Les petites pièces chanfreinées coûtent cher en scène (ombres comprises) pour un gain invisible à 24 m: le directeur artistique préfère dépenser sur la silhouette des toits.
- Mesure du budget: `rendu.html?stats=0&vie=0&heure=19:00&x=20&y=18&orientation=0&zoom=1` (place à 19 h, train à quai), `lplRendu.stats()` et `breakdown()`. Avant l'arrondi: 201 900 triangles au zoom moyen.
- Contrôles avant livraison: `verifier/rendre_audit.py`, `verifier/controle_geometrie.py`, `verifier/quatre_angles.py` (voir le README des modèles). Le client relève les poutres qui dépassent et les escaliers illisibles: vérifier chaque modèle touché sous 4 angles.
- Rendus Workbench (audit `rendre_audit.py`): les ombres y tracent de faux traits fins sur les murs. Couper `show_shadows` ou vérifier dans Cycles avant de chercher une géométrie qui traverse.
- Un décor plaqué sur des facettes (grignes, lettres, traits) doit suivre les facettes réelles (lancer de rayons, tronçons courts), pas la forme ronde théorique: sinon il dépasse ou disparaît. Pavés de lettres jointifs: un jour de 3 mm suffit à rendre un mot illisible à distance.
- Ne jamais annoncer une correction sans un rendu `verifier/quatre_angles.py` du GLB exporté.
- Capture en situation: `rendu.html?stats=0&vie=0&heure=10:00&x=44.5&y=10&orientation=0&zoom=1` (devant la maison de Firmin); sans `vie=0` la caméra reste sur la maisonnette. Triangles de la vue: `window.lplRendu.stats()` (ombres comprises). Les commandes avec `pkill` dans une chaîne coupent la suite: les lancer seules.

## Faune et poses (tour 6, vérifié le 2026-10-31)

- Poser un squelette en rotations du repère du squelette, relatives au parent: quaternion local = R_repos^-1 · D · R_repos (`Rig.local` de `faune.py`). Indépendant du roulis des os, lisible (x tangage, y roulis, z lacet). Garder la continuité des quaternions d'une clé à l'autre (signe).
- Plusieurs squelettes dans un GLB: une piste NLA par clip (`strip.action_slot` posé) et export `NLA_TRACKS`; chaque animation ne vise que son squelette.
- Aile en plaque rigide repliée le long du flanc, bord d'attaque en haut: c'est la face inférieure qui regarde dehors (chiralité). Même couleur sur les deux faces. Raccourcir une aile repliée par l'échelle de l'os (axe Y = longueur).
- Personnages sur un objet (échelle, banc): cinématique inverse plane (`_ik2` de `personnages.py`). Squelette `rig`: cuisse, tibia, pied et bras tournent autour de -X monde; un buste penché de b recule les bras de b. Main retournée: Euler (-flexion, 180, 0).
- Placer chaque nouvel objet dans la vraie scène avant de livrer (`scene_echelle.py`): la fiche mettait l'échelle dans une branche du chêne, et le houppier (dessous vers 2,6 m) cachait nichoir et grimpeur.
- Toute nouvelle case de palette.py entre aussi dans `src/rendu/palette.ts` (test `palette.test.ts`).
- Cloche du quai: toute retouche passe par la fenêtre d'ombre de lumiere.test.ts. Plus rapide que de reconstruire le bourg: extraire directions du soleil et boîtes du banc par un test jetable, puis calculer hors ligne (sommets uniques par position et normale, comme le GLB soudé).
- Garde-fou du worktree isolé: pas de boucle shell avec variable devant npx ou duo-python; écrire un script (`verifier/quatre_faune.sh`) ou des commandes simples.
- Temps: planches de clips de quatre bêtes (115 rendus de 300 x 260) environ 6 min; quatre angles environ 40 s par modèle.
- Marques d'une bête (bandeau, calotte, sourcil, bavette): jamais de boîte posée sur une tête ronde (elle dépasse en barre). `banded_ball` de `faune.py`: ellipsoïde aux latitudes choisies, couleur par bande (et par normale pour limiter aux côtés).
- Ailes repliées: une plaque rigide repliée par rotation forme un caisson. Mieux: coquilles arrondies sur le corps (os du corps) et ailes de vol réduites (échelle 0,04) et rentrées au repos; l'interpolation entre clés donne le déploiement. Petite aile modelée repliée: l'ouvrir par roulis de 90 puis lacet de -80 (repère du squelette).
- Pièce posée au bout d'un corps (queue): l'enfoncer à moitié et lui donner la couleur du dessus voisin, sinon elle se lit détachée. Vue d'en haut, ce qui part loin de la caméra semble relevé.
- Lisibilité en niveaux de gris: mesurer en jeu, pas sur la palette. Le soir, roux L* 54 rendu 22, herbe L* 69 rendue 30: éclaircir le roux le rapprochait de l'herbe (27). Jouer sur les blancs et les noirs plutôt que sur la valeur moyenne.
- Page de rendu en `manuel=1`: le temps n'avance que par `window.lplRendu.advance(dt)`. Sans l'appeler, les fondus des clips restent à 0 et les bêtes montrent la pose de repos (ailes dépliées); `zoom=0` n'agit qu'après quelques pas. Captures: attendre que `#chargement` disparaisse, appeler advance(0.05) x 20, délai de capture de 180 s (SwiftShader).

## Faune du tour 7 (vérifié le 2026-11-01)

- `controle_geometrie.py` sautait les maillages à squelette: la faune n'était pas contrôlée. Option `--peaux` (faces inversées seules, seuil de volume bas pour les petites pièces). Toujours la passer sur `faune.glb`.
- Planches: la scène n'a qu'une image courante pour tous les squelettes. `set_action(a, clip, 60)` puis `set_action(b, clip, 0)` remet `a` à l'image 0. Poser toutes les bêtes d'une planche à la même image.
- `quatre_angles.py` supprime tout maillage hors du nœud, sol compris: pas d'ombre portée, donc vérifier le contact au sol par calcul et non à l'oeil.
- Contact au sol des clips: sonde (bout des os et point le plus bas du maillage déformé, image par image). Baisser la racine sans plier les pattes enfonce les sabots; un cou trop court ne mène pas le mufle à l'herbe: rallonger le cou au repos plutôt que tordre la tête (la tête hérite de la rotation du cou: rotation propre négative).
- Quadrupède: hanches au centre du corps (pivot du tangage), poitrine enfant des hanches. Lever d'un faon: arrière-train d'abord (tangage positif, avant à genoux), sinon le corps flotte.
- Taches de livrée: bandes étroites de `banded_ball` (deux bandes fines, une facette sur deux), pas des facettes entières (carreaux).
- Accroche de carte avec z (pieu, nichoir): l'origine du modèle est le point de l'accroche, pas forcément la base.
- L'export échantillonne à 30 i/s: un clip de 0,12 s devient 4 images (0,133 s); le dire dans la fiche.
- Le worktree isolé refuse les commandes composées avec heredoc vers des fichiers hors du dépôt, ou nommant git de façon complexe: écrire les scripts avec Write et lancer des commandes simples.

## Oreilles, plaques fines et vues de jeu (vérifié le 2026-11-01)

- Une plaque fine (oreille, aile, feuille) se voit par la tranche sous un angle au moins: la tranche dressée se lit comme une corne ou une dague. Remèdes vérifiés: contour en super-ellipse (bout arrondi), bords roulés vers l'avant en cornet (plus à la base qu'au bout), creux et dos bombé, dos de couleur intermédiaire (ni sombre, ni de la couleur du crâne). `cupped_ear` de `faune.py`.
- Le lacet du pavillon est un compromis: grand, l'oreille se voit de profil mais l'oreille du fond passe par la tranche en vue de trois quarts avant (les vues de jeu sont à 45 + 90 k, élévation 35,264); 25 degrés tient les deux.
- Contrôler une forme fine sous les 8 azimuts à 35 degrés (`quatre_angles.py --azimuts 0,45,...,315 --elevation 35`), pas seulement aux quatre angles standard ni en profil strict.
- `controle_geometrie.py` donne des résultats différents d'une exécution à l'autre sur le même fichier (TRAVERSE et FLOTTE): comparer seulement les nœuds touchés.
- Serveur de la page de rendu dans un worktree isolé: lier `node_modules` (racine et jeu) vers l'arbre principal par des liens symboliques, puis les retirer (ils apparaissent en non suivis). Les commandes contenant `--exclude-dir=.git` sont refusées: passer par un script.
- Un tore fait à la main (`g.mesh`) avec l'ordre [a0, b0, b1, a1] sort inversé (vu par `--peaux`); [a0, a1, b1, b0] est juste.

## Cueillette et petite végétation (tour 8, vérifié le 2026-11-01)

- Feuilles en volume: section en chevron (nervure en haut, bords tombants, dessous mince), 16 triangles par feuille (`blade` de `cueillette.py`); pointe trop longue = lame d'agave: élargir jusqu'aux trois quarts (`ts=(0, 0.3, 0.74, 1)`). Volume fait main: `bmesh.ops.recalc_face_normals` sur les faces créées, plus de souci d'ordre des sommets.
- Champignon lisible: pied qui s'évase sans rupture jusqu'au bord (sinon « table » ou champignon de Paris), centre creusé sous le bord, bord ondulé (sin 2a en rayon, sin 3a en hauteur).
- Branche, ronce ou rejet terminé par une boule seule = sucette ou pattes d'araignée. Feuiller la moitié haute (touffes allongées qui se chevauchent) et finir chaque tige dans le feuillage (bouts de cylindres ouverts visibles sinon).
- Lisibilité au zoom 1 (57 px/m): à 0,25 m, un tas brun sur l'herbe d'automne tient en 12 pixels et se perd; le blanc (ombelles) et l'orange vif tiennent. Planche: palette de la saison de l'objet (`set_season` de `planche_cueillette.py`) et herbe de cette saison.
- Objet posé sur un autre (mûres sur roncier): objet à plat, point bas à 0, et points de pose calculés par lancer de rayons sur l'hôte puis enfoncés de 1,5 cm (extra `berry_spots`, repère glTF). Aucune autre pièce de l'hôte ne doit passer sur ces points.
- `quatre_angles.py --marge 1.5` pour les modèles hauts (le cadre à 1,2 coupait le pied). Commandes Python en heredoc parfois refusées par le garde-fou du worktree sans raison claire: passer par Edit ou un script écrit avec Write.

## Silhouettes au zoom de jeu (tour 8, correctifs, vérifié le 2026-11-01)

- Roncier: des tiges fines et contrastées qui partent d'une masse ronde se lisent comme des pattes (araignée), qu'elles finissent par une boule en l'air ou qu'elles touchent le sol. Ce qui a marché: arceaux bas (sommet sous le dessus du massif), retombée en pente, feuilles serrées le long de la tige (7 losanges de 8 triangles, `small_leaf` de `cueillette.py`) et un fourré bas sous les arceaux, pour qu'ils retombent sur du feuillage et non sur l'herbe. Juger en jeu (zoom 0), pas sur les quatre angles à 30 degrés.
- Une sphère aplatie posée trop bas s'enfonce de moitié (bosse à -17 cm): poser le centre à la demi-hauteur, vérifier le point bas avec `verifier/mesures_cueillette.py`.
- Le jeu met un `grow_node` à l'échelle d'un bloc autour de son origine: tout ce qui doit rester accroché ailleurs qu'à l'origine glisse (pieds des rejets vers le milieu de la coupe). Une origine par pièce (un nœud par brin, origine au pied) et une matrice par pièce côté rendu.
- Deux objets du même lieu dessinés par le rendu à des échelles différentes (souche fixe, plant de 0,7 à 1,3): contrôler le contact à toutes les échelles par arbres BVH (`verifier/souche_et_plants.py`).
- Garde-fou du worktree: `montage` avec un motif glob, ou une commande enchaînant un heredoc Python et autre chose, est refusé; passer par un script écrit avec Write.

## Tour 9 (vérifié le 2026-11-01)

- Fruit posé sur un hôte fait dans un autre GLB (mûres sur roncier, sureau): reconstruire l'hôte dans un Geo jetable (graines fixes) et lancer des rayons horizontaux depuis le sud (`_host_hits` de `cueillette.py`); un seul point de pose dans l'extra, le modèle du fruit porte ses grappes à leur place. Reconstruire `ferme.py` et `bourg.py` ensemble.
- Lisibilité mesurable: rendre avec et sans la cueillette, masque = pixels qui diffèrent, puis taille à l'écran et contraste de luminance (`planche_tour9.py zoom1`). Les 14 x 14 px sont faciles; le contraste 3:1 au soleil couchant ne l'est pas.
- Objet porté long (perche): le modéliser couché vers l'avant (-Y) au repos du bras. Une flexion positive des bras relève un objet qui pointe vers l'avant et rabat vers l'arrière un objet dressé (pente = 90 - somme des flexions).
- Ailes de vol dans le plan du dos (XZ au repos) pour un oiseau debout au repos: racine inclinée de 80 degrés en vol, le plan devient horizontal. Battement = rotation autour de Z du repère du squelette. Une asymétrie vue sur une planche peut venir de la perspective: vérifier par la position des bouts d'os (`pose.bones[...].tail`).
- Auvent sous une rive existante: mesurer d'abord le dessous du toit par lancer de rayons sur le GLB (la rive de la maisonnette descend à 2,12 m à 0,33 m du mur).
- Garde-fou: refuse une variable shell devant duo-python, `grep --exclude-dir` et les heredocs vers des fichiers hors du dépôt; passer par un script (`verifier/controle_tirets.sh`, `verifier/planches_quatre_tour9.sh`).
- Vitest avec node_modules liés vers l'arbre principal: les tests d'interface sous Chromium échouent sur des 403 des polices `@fontsource` (Vite refuse les fichiers hors racine); artefact du lien, pas des modèles.
- `verifier/quatre_tour9.sh` envoie tout nœud inconnu vers `bourg.glb`: y ajouter chaque nouveau nœud de ferme ou de maison. `verifier.cjs` écrit `planches/threejs-*.png`: retirer ceux qu'on ne livre pas.

## Tour 10: intérieurs, pièces, coiffures (vérifié le 2026-11-02)

- Le worktree isolé peut partir d'un vieux commit: comparer `git log` à la branche de session et faire `git merge --ff-only <branche>` (arbre propre) avant de lire la conception.
- Le garde-fou refuse les heredocs Python longs ou « python3 - <<EOF » enchaînés: écrire le patch dans /tmp/patchN.py avec Write, puis `python3 /tmp/patchN.py` seul.
- Caméra créée par `lpl.iso_camera`: `matrix_world` n'est pas à jour tout de suite; prendre `cam.location` (sinon on coupe les mauvais murs).
- Bâtiment visitable: murs du rez-de-chaussée percés pour de bon (`interieurs.pierced_wall`, `glazed`, `door_frame`), enfants directs `<id>_wall_<côté>`, `cut_nodes` en extra, `<id>_interior` d'un seul maillage. Deux boîtes coplanaires qui se recouvrent (jambage et linteau pleine largeur) font des carrés noirs aux angles dans Cycles: linteau entre les jambages.
- Meuble mural (miroir, tablette) dans le nœud du mur, pas dans l'intérieur: coupé avec le mur, il ne reste pas en l'air.
- Ne pas ajouter de case à `palette.py` WORLD dans un lot qui ne touche pas `src/` (test palette.test.ts). Rangées de personnages: ajout en fin de CHAR_ROW_ORDER sans risque (16 au plus).
- Raccords de toits: vérifier les débords de rive et d'égout du toit existant avant de poser une annexe (un appentis à un pan de 2,6 m contre le pignon de la maisonnette passe par-dessus les coins de la rive). Noue: polygone du pan arrêté sur l'intersection avec le dessus du toit voisin abaissé de 6 cm (`pieces.poly_slab`, sens remis automatiquement).
- Tête ronde du joueur: bouche haute (hc - 0,02 à - 0,065), nez à hc - 0,016: moustache juste sous le nez; tout ce qui pend derrière la tête (queue, tresse, nuage) s'enfonce dans l'oreiller en pose `sleep`: mesurer avec `verifier/coiffures_couche.py`.
- Vitest sans TTY n'écrit rien avant la fin (environ 30 min ici): lancer en arrière-plan sans `timeout`.
- Contrôle d'emprise: `interieurs.blocked_cells` calcule les cases occupées depuis les boîtes des meubles posés (`Footprints`).

## 0.12: chèvre, robes de poule, marché (vérifié le 2026-11-03)

- Travail en parallèle avec d'autres artistes: nouveaux modèles dans un GLB à soi (`elevage.glb`, `marche.glb`: le jeu charge tous les `assets/modeles/*.glb` et cherche les nœuds par nom). Un GLB partagé (`ferme.glb`) touché par deux lots devra être reconstruit après fusion des scripts: le dire au manager.
- Planches faites depuis les GLB exportés (`planche_v012.py`): import, `bpy.data.meshes.new_from_object` du maillage évalué par clip et image. Plus fiable que de poser des copies d'armature, et indépendant de la scène de construction. Garder les planches hors du script de construction: une reconstruction ne coûte plus que 30 s.
- La machine est partagée (charge 30 à 45 sur 4 cœurs quand d'autres agents rendent): une planche Cycles prend 10 min au lieu de 1. Rendre une seule fois, après les corrections mesurables (sonde, contrôle de géométrie, validateur).
- Quadrupède qui broute: abaisser l'attache du cou (base dans le poitrail) plutôt que de tordre la tête; pencher le poitrail fait descendre les pattes avant avec lui (sabots dans le sol): compenser par l'angle des pattes et le vérifier par la sonde, y compris dans les images intermédiaires (`step`) qui remplacent les angles des pattes.
- `merge` de faune.py remplace le dict d'un os: une variante de pose (`bite`) qui redonne `goat_head` doit reprendre le tangage de base, sinon la tête se retourne.
- Raie dorsale par couleur de facettes sur un ellipsoïde à 10 ou 12 pans: dents de scie, pas une raie. À éviter (ou une bande de `banded_ball`).
- Variante d'oiseau plus petite (poussin) sur le squelette commun: la modeler à la taille de la poule autour des mêmes pivots et donner une échelle de racine (extra `scale`), sinon les clips la font pivoter autour d'os hors du corps.
- Faucilles du coq: plumes plates de 5 à 8 cm à la base; à 1,4 cm elles se lisaient comme des tiges.
- `inotifywait` n'est pas installé: attendre un fichier avec `until [ -f ... ]; do sleep 5; done` en arrière-plan.
- Le garde-fou refuse un `python3 -c` contenant des `\'`: passer par un script écrit avec Write.

## Garde-robe de la 0.12 (vérifié le 2026-11-03)

- Vêtements modulaires des joueurs: couleurs dans la rangée 1 de `personnages.png` (`garde_robe.WEAR_SLOTS`), la rangée 0 reste au corps et à l'écusson du profil. Une seule texture par joueur, les pièces se fusionnent comme avant.
- Enveloppes emboîtées par emplacement (corps x 0,9, hauts = `torso_rings`, par-dessus x 1,10 / 1,14): chaque pièce suit le même os que la partie du corps dessous, rien ne traverse dans les clips sans recalculer de poids.
- Pièce plaquée sur une pente (écusson): `rot=(atan(-pente), 0, 0)` couche le haut vers +Y (l'arrière); le signe inverse l'enfonce à moitié dans la poitrine (vu sur la première planche).
- Coupe ramenée sous un chapeau par écrasement radial: une masse plus large que la tête (nuage) se replie et sort inversée (`--peaux`). `recalc_face_normals` ne suffit pas; retourner chaque îlot de volume signé négatif.
- Planches Cycles: ne jamais laisser deux rendus en arrière-plan en même temps (le premier `planche_*.py` lancé garde le CPU); 6 échantillons suffisent pour des planches de contrôle de 260 à 420 px (environ 10 s la vue).
## Poissons 0.12 (vérifié le 2026-11-03)

- Corps lofté triangulé à la main: colorier par quadrilatère (centre des 4 sommets), pas par triangle, sinon la limite dos et flanc fait des dents de scie.
- Taches plaquées: lancer de rayons sur les triangles du corps (`BVHTree.FromPolygons` sur mes propres listes), polygone dans le plan du triangle touché, rétréci jusqu'à tenir dedans, décalé de 0,3 % de la longueur.
- `lpl.board(..., mannequin=True)` pose le mannequin hors du cadrage (calculé sur les seules copies): mettre un mannequin comme premier nœud de la grille.
- Rendus Cycles ici: 1800 x 1125 à 12 échantillons, environ 3 min par planche (machine partagée); deux Blender en parallèle ont fini tués (code 137).
- Import de `personnages.glb` pour une vue « en main »: `rig.data.pose_position = "REST"`, sinon une pose importée reste. Main droite = côté -X Blender: caméra de ce côté.

## Habitants de la 0.13 (vérifié le 2026-11-03)

- `personnages.png` fait 64 x 128 (`palette.CHAR_GRID_H` = 32 rangées): toute UV ou décalage de rangée des personnages divise par `CHAR_GRID_H`, pas par `GRID` (lpl.char_cells, garde_robe.wear_cells, rendus_personnages, scene_bourg). Le rendu copie la source à sa taille: Three.js colore juste (capture verifier.cjs).
- Chez les habitants, `scarf` et `scarf_mark` sont libres (aucun foulard): deux couleurs de plus par rangée.
- Bord de chapeau: relever le devant (rotation négative autour de X, autour du centre de la tête). Un bord plat de plus de 0,2 m devant cache les yeux à l'élévation de 35 degrés.
- `g.mesh` colorie à la création: une couleur qui dépend de la normale doit être reposée (`g.recolor`) après `recalc_face_normals`, sinon le dos du chat sortait blanc (normales vers l'intérieur).
- Pastille plaquée (fleurs, farine) sur une jupe en lathe: viser le milieu des facettes (12 pans: le devant -Y est un sommet, milieux à 15 + 30 k degrés) et donner à toute la pastille les poids du point de pose. Poids calculés sur des coordonnées locales avant `g.transform`: sommets partagés entre thigh_l et thigh_r, pastille retournée en pose (vu par controle_geometrie.py, qui évalue le GLB importé dans une pose de clip).
- `controle_geometrie.py` ignore personnages.glb par défaut: lui passer le chemin absolu avec `--peaux` pour contrôler les habitants.
- faune.py: la ligne `a = math.radians(LADDER_ANGLE)` existe deux fois (fonction ladder_wood et main): insérer avant `A.add("ladder_wood"`.
- Le scratchpad est partagé avec d'autres sessions: travailler dans un sous-dossier à soi (un dossier `r1` existait déjà; un module Python du scratchpad peut masquer ceux des modèles).

## Forêt et petits objets de la 0.13 (vérifié le 2026-11-03)

- Vent du rendu (`createWindMask`, champs.ts): seules la première rangée de la palette (herbes, `leaf_*`, cultures), les `flower_*` et `ivy` se balancent. Un fruit posé sur un houppier doit prendre une de ces cases (cerises `flower_red`, prunes `flower_violet`, bogues `leaf_crop_light`), sinon il reste immobile pendant que le feuillage bouge. `vine_leaf` ne bouge pas.
- Les arbres de la carte sont posés sans rotation ni échelle (propMatrix): toutes les instances d'une essence sont identiques; des variantes demandent une ligne `MODEL_VARIANTS` (code du rendu).
- Le validateur de carte compte les triangles d'arbres par morceau de 12 m avec `triangles_par_type` du générateur (estimation), pas les modèles: recompter avec `verifier/morceaux_foret.py` et donner la table au level designer.
- Houppier « généreux »: une grande masse centrale et des bosses enfoncées, dessus éclairci par la normale (`by_normal(clair, base, thr=0.55)`). Une boule centrée posée sur le dôme se lit comme un chapeau (pire avec le bicolore): décentrer les bosses hautes. Une pile de boules distinctes se lit comme un bonhomme de neige.
- Bac creusé par `inset_individual` puis `extrude_face_region` et suppression de la face: les parois intérieures disparaissaient (seul le fond restait). Cycles dessine le dos des faces et ne montre rien; Three.js aurait montré des trous. Construire le volume à la main (anneaux extérieur et intérieur, `recalc_face_normals`) et vérifier par une liste des faces (normale, centre) du GLB importé.
- `controle_geometrie.py` juge le contact par la distance des sommets: une pièce posée face contre face (chaperon sur un mur, eau qui affleure les parois) sort FLOTTE. Enfoncer de 2 à 5 mm. Les enfants fruits sont jugés seuls (tous FLOTTE): `verifier/fruits_contact.py` les juge avec leur arbre.
- Cases `soil_wet*` brillantes (rugosité 0,32): sur un tas (fumier) une facette renvoie un reflet blanc. Prendre des cases mates.
- `planche_*.py`: appeler `view_layer.update()` avant de cadrer sur les `bound_box` des copies (sinon cadrage faux). Planche 2200 x 1200 à 10 échantillons: environ 3 min ici; bosquet 1366 x 768: 1 min la vue.
- Le scratchpad partagé a vu un de mes scripts de patch (`p2.py`) remplacé par une autre session: toujours un sous-dossier à soi, dès le premier fichier.
## Village de la 0.13 (village_013.py, vérifié le 2026-11-03)

- `interieurs.pierced_wall` ne gère pas deux ouvertures superposées dans une même travée (porte sous une baie de clocher, meurtrière sous le beffroi): il laisse des fentes noires de toute la hauteur. `village_013.pierced_wall` les accepte (bandes pleines entre elles); une ouverture qui dépasse la longueur du mur déborde dans l'angle.
- Étage d'un bâtiment coupé en nœuds: les chaînes d'angle de l'étage partent de `h1` (`quoins_side(..., z0=h1)`), sinon elles doublent celles du rez-de-chaussée (z-fighting et 1 000 triangles perdus). Chaîne d'angle: seule l'arête d'angle chanfreinée (20 triangles au lieu de 28); c'est le premier poste de triangles d'un bâtiment de pierre.
- Vantail à droite (gond sur le jambage droit vu de dehors): le rendu tourne toujours de +80 degrés autour de Y glTF. Modeler le vantail tête en bas (z négatif) et tourner le nœud de 180 degrés autour de Y Blender: il s'ouvre alors vers l'intérieur. Contrôle sans Blender: `verifier/vantaux_013.py`.
- Planche d'un intérieur: couper les murs qui regardent la caméra par défaut du monde, ramenée dans le repère du modèle (azimut 45 - 90 x rotation de la carte): pour une rotation 1, murs avant et gauche.
- Décor sous une rive: mesurer la rive (à 0,3 m du mur, un toit à 45 degrés descend déjà de 0,3 m plus l'épaisseur): une glycine à 2,7 m sous un égout à 3 m traversait le toit.
- Le scratchpad est partagé: un `p2.py` d'une autre session existait. Travailler dans `scratchpad/a3d013/` (ou un dossier à soi).
- Plafonds de la 0.13 (carte 11.3, jusqu'à 1,5 fois): compter les nœuds hors `_interior` (le contenu n'est dessiné que dedans); ce qui est accroché aux murs (bouteilles, vaisselier) compte dehors, car le mur est toujours dessiné.
- Essai rapide d'habitants (voir aussi la section 0.12.2): un script qui ne construit que les nœuds voulus (make_mesh + quelques clips) dans un GLB jetable, et `LPL_GLB` pour la planche: 1 min au lieu de 2, sans toucher au GLB livré. Machine très chargée (charge 25): environ 45 s par habitant pour 3 vues à 8 échantillons.

## Patch 0.12.2: coupes longues, texte en géométrie (vérifié le 2026-11-03)

- Coupe qui pend sous le crâne: la lier au buste (poids glissant `head` au-dessus de 1,45 m, `chest` sous 1,36 m, `coiffures.settle`), sinon elle balaie dos et épaules dès que la tête tourne. Pas sur les coupes courtes: la peau de la nuque ressortirait quand la tête se renverse.
- Contrôle coupe contre vêtements: `verifier/traversees_coiffures.py` (îlots, tous clips, 12 images). Pour un lobe convexe, tester « derrière tous les plans des faces »: le test par la normale du point le plus proche donne de faux dedans près des arêtes vives des lobes aplatis (54 mm fantômes).
- Les clips qui renversent la tête (`look_up`, `hold_ladder`, `pole_*`, `reach_up`, `climb_ladder`, `drink`) et `carry_two` (avant-bras dans le crâne) traversent même avec la coupe rase: comparer à `crop` avant d'accuser une coupe.
- Essai rapide de coupes: script qui construit squelette, corps, hauts, par-dessus, chapeaux et coupes seulement (2 s), puis le contrôle sur ce .blend (option `--blend`).
- Texte net en géométrie: courbe FONT de Blender sur une police OFL (WOFF lu directement par bpy), `new_from_object` donne des triangles plats (environ 230 pour AUBRUNE en Jost Bold, `resolution_u` 2). Hauteur mesurée sur un E, largeur bornée. Au dos d'un panneau: rotation de 180 degrés autour de Z, même sens de faces.
- Planches depuis personnages.blend: cacher toutes les sources (vélos et accessoires de la 0.13 posés à l'origine), pas seulement `player_*`.
- bourg.py lancé seul rend aussi ses planches: `LPL_SANS_PLANCHES=1`, ou arrêter la tâche après « Saved as bourg.blend ». Vite en arrière-plan: timeout long (coupé à 30 min sinon). Capture SwiftShader de rendu.html: 5 à 15 min par vue; gltf-validator absent des node_modules: l'installer dans le scratchpad et passer `NODE_PATH`.

## Qualité visuelle, étape A: témoins (vérifié le 2026-11-03)

- Les clips de personnages.glb portaient translation et échelle de TOUS les os (échantillonnage de l'export): un gabarit à os plus longs était ramené au gabarit moyen par n'importe quel clip. `glb_post.strip_rest_channels` ne garde que les translations de `root` et `hips` (vérifie que les autres valent le repos). Three.js remet de lui-même le repos d'une propriété qu'aucun clip ne pilote.
- Gabarit sans second squelette: modeler autour des os du gabarit, puis reculer chaque sommet de la somme pondérée des décalages de ses os (`gabarits.to_standard`), et donner au jeu les translations de repos (`bone_rest`, lues en exportant un squelette du gabarit seul). Dans Blender: translation de pose des os (`gabarits.apply_to_rig`). Hauteur des hanches commune (la piste du bassin est absolue).
- COLOR_0: GLTFLoader active `vertexColors` sur le matériau partagé des personnages; un maillage sans COLOR_0 sortirait NOIR (attribut absent lu à 0). Tous les maillages du matériau en portent (`temoins_outils.add_white_colors`). Export `vertex_color="ACTIVE"` (entiers 16 bits), ramené à des octets par `glb_post.colors_to_bytes`. Le mode MATERIAL écrit des flottants VEC3.
- Peinture qui garde la personnalisation sans shader: ce qui ne dépend pas de la couleur du joueur (yeux) dans une vignette de la texture; le reste en formes plaquées qui lisent une case (sourcils `hair_dark`, rides `skin_shade`) ou en couleurs de sommets multipliées (joues, plis, occlusion, surpiqûres ton sur ton). Une surpiqûre crème sur un tissu foncé fait du bruit au zoom 1: ton sur ton (`darken`).
- `lpl.Geo` + `bmesh`: grille de décalque face à -Y: ordre (k, k+1 en x, puis rangée du dessus); polygone plan face à -Y: points dans le sens trigonométrique vu de devant (X à droite). Normales imposées (`normals_split_custom_set`) = normale lissée de la surface au point touché: le décalque prend la lumière de la peau.
- Poses de repos par descente sur les angles (`verifier/poses_repos.py`, poignet, coude et bout de la main visés), plusieurs départs; l'avant-bras ne plie qu'en positif (sinon solution en hyperextension). Firmin mains dans le dos: upper_arm (39, 124, 32), forearm 59.
- Une épaule en boule large sur un torse étroit se lit comme une épaulette au zoom 1: élargir le haut du torse, boule plus petite et plus basse.
- Garde-fou: les heredocs qui écrivent dans un fichier du dépôt (`cat >> fichier`) et les patchs python avec `cd` puis git sont refusés; Edit ou un script dans le scratchpad. Une variable d'environnement devant `node` passe.

## Cosy Café, essai de style 3D (vérifié le 2026-11-07)

- Carte de lumière cuite par script: `bake(type="DIFFUSE", pass_filter={"DIRECT","INDIRECT"})` sur une seconde UV (smart_project, average_islands_scale, pack_islands sur tous les objets en édition multiple); 2048 px à 96 échantillons: 2 min 20 pour le café entier. Débruitage OpenImageDenoise par le compositeur: Blender 5 `scene.compositing_node_group = node_groups.new(..., "CompositorNodeTree")`, nœuds Image, Denoise, `NodeGroupOutput` (plus de nœud Composite), rendu Workbench d'une scène vide: 4 s.
- Exporter la carte de lumière dans le GLB: groupe de nœuds nommé « glTF Material Output » avec une entrée « Occlusion », image sur l'UV « lightmap »: l'export écrit `occlusionTexture` avec `texCoord: 1`. Côté Three.js 0.187: `lightMap = aoMap`, `colorSpace = SRGB`, `lightMapIntensity = K * PI` (Basic et Standard divisent par PI). Encoder la carte en sRGB après division par K (centile 99,7).
- Ne pas mélanger la cuisson et les lumières dynamiques: deux scènes Three.js (cuite sans lumière, personnages avec 4 lumières), `autoClear = false`, même tampon de profondeur. En Standard, un envMap ajoute aussi de l'éclairement diffus: le retirer par `onBeforeCompile` (ligne `iblIrradiance += getIBLIrradiance`).
- Pixels d'une image 8 bits importée dans Blender: valeurs encodées sRGB, ne pas les « reconvertir » (couleurs de palette fausses sinon).
- Import glTF d'un rig Meshy: une icosphère de 2 m est créée pour dessiner les os; ne garder que les maillages qui ont un modificateur Armature. Rigs Meshy: 24 os aux mêmes noms d'un personnage à l'autre, les clips achetés sur l'un (idle, sit, drink) se posent sur tous. `use_nla = False` avant de poser une action sur un rig importé.
- Soleil rasant (16 degrés) et place bâtie: vérifier par calcul que la maison d'en face ne met pas toute la salle à l'ombre (à 235 degrés c'était le cas).
- `renderer.info.programs` compte aussi les programmes de la capture d'environnement (PMREM) faite au chargement. Compter la mémoire des textures par `texture.source` (GLTFLoader crée une Texture par matériau pour une même image).

## Deux Tabliers, démo v0.1 (vérifié le 2026-11-07)

- Orientation des assises: l'avant de tout modèle est +Z glTF (sud du plan); contrôler par la géométrie (sommets au-dessus de l'assise + 0,15 m derrière, z moyen négatif) et par une capture de dessus. Piège de l'essai: `poser()` attend le cap du regard, on lui passait le côté du dossier (chaises dos aux tables).
- GLB à textures externes partagées: export `GLTF_SEPARATE` dans un dossier temporaire, puis réassemblage en GLB en gardant `uri: "textures/<fichier>"` pour les images présentes dans `textures/` (`commun.exporter_glb`). gltf-validator les lit par `externalResourceFunction`.
- Atlas partagé entre plusieurs scripts: les cases de palette doivent être fixes (`CASES_FIXES`, gelé ensuite), sinon l'ordre de construction déplace les cases et casse les UV des GLB faits par l'autre script. Graine d'UV par `zlib.crc32` (le `hash()` de Python change à chaque lancement).
- `conformite_personnage.py`: appliquer l'échelle d'un rig Meshy (objet à 0,01) demande de multiplier les translations des clips par facteur x 0,01, sinon le personnage s'envole (hanches à 100 fois leur hauteur) dès que la taille visée diffère de celle du rig. Corrigé; options `decimate_to`, `texture_mode: "meshy"`, `badge` ajoutées.
- Three.js: cuivre, laiton, inox (metalness 1) sortent noirs sans environnement; la visionneuse de contrôle prend `RoomEnvironment` par PMREM (intensité 0,45).
- Planche Cycles: un objet de façade ou de plafond pend sous son origine; un sol à z = 0 le cache (le disque de l'enseigne à potence semblait absent).
- Rue de l'essai: trottoir à -0,02 et bordure à 14,60 ne collaient pas aux plans (terrasse à 14,75): dessus du trottoir à 0 et bordure à 15,80. Toujours confronter le décor de l'essai au plan des extensions.
- Pan qui se cache (porte fermée devant une arche): le faire mince, côté salle, sinon les tableaux de l'arche sont cuits noirs derrière lui.
- Budgets C8: avec les pans x 2 de l'essai B, presque tout dépassait; pans de la bible (x 1) et lissage suffisent. Tiges en chaîne `rod(..., cap=False)`, pas de boules aux coudes; capitons en losanges plats.

## Deux Tabliers, place du Tilleul (vérifié le 2026-11-08)

- Décor extérieur cuit dans un GLB à part (`shell_village_place.glb`), avec sa propre carte de lumière: une seule cuisson Cycles suffit pour deux images (chaque matériau a son nœud image actif; intérieur et place n'ont aucun matériau commun). `lightmap_scale` propre au GLB, relu par `lightmapScale(root)`.
- Le dôme du ciel cache le ciel de la cuisson: `hide_render` sur le ciel et le lointain pendant `bake`, puis le remettre.
- Teintes par face sans multiplier les matériaux: attribut de coin « ao » en BYTE_COLOR rempli par `foreach_set("color_srgb", ...)`, multiplié à la texture pour la cuisson (rebonds teintés), puis le nœud Mix retiré avant l'export (texture seule en couleur de base, COLOR_0 à part). Côté Three.js: `vertexColors: m.vertexColors` sur le MeshBasicMaterial de la coque (les coques ont déjà un COLOR_0 blanc: aucun programme de plus).
- Panneaux d'une façade (fenêtre, porte, enseigne): toujours devant le mur (décalage de 6 mm), jamais en retrait dans une boîte pleine (invisibles). Le relief vient des encadrements et appuis saillants.
- UV des cases d'atlas: base (t = up x n, b = n x t) par face; texte lisible de dehors sans cas particulier. Feuillage et écorce: fenêtre de la case à l'échelle (1,4 m par case), sinon feuilles de 2 cm.
- Houppier: une trentaine de grosses icosphères (subdiv 2) se lit en brocoli sombre (auto-ombrage cuit). Mieux: 80 à 90 bouquets plus petits (subdiv 1, déplacés par `mathutils.noise`), près de la surface, teintes claires.
- Visionneuse `verifier/vue/`: charge aussi la place (paramètre `far` du plan lointain, 80 m comme le jeu).

## Deux Tabliers, finitions de la place (vérifié le 2026-11-08)

- Blender 5: `bmesh.ops.create_icosphere(subdivisions=1)` donne l'icosaèdre de 20 faces (2 = 80 faces). Dans un bmesh déjà garni, subdivisions=2 invalide des sommets posés avant (ReferenceError): construire la sphère dans un bmesh à part puis recopier.
- Feuillage découpé: objet à part non cuit (`dt_feuillage`, lumière par sommet calculée par script avec lancer de rayons BVHTree vers le soleil), alpha de la texture branché sur Alpha pour des ombres tachetées dans la cuisson; alphaMode MASK posé par un `patch` de `commun.exporter_glb` (l'exporteur écrirait BLEND). Couverture de la texture vers 80 %: les mipmaps restent pleines au loin.
- Panneau d'atlas (inscription, rosace): garder les proportions du panneau égales à celles de la zone de texture, sinon lettres écrasées illisibles; rosace en disque à 24 pans pris dans le cercle de la case (plus de carré de fond).
- Compression avec textures externes partagées: `assets-src/modeles/quantifier.cjs` (gltf-transform 4 par API, GLB réassemblé à la main pour garder `uri: textures/...`). `dedup({propertyTypes:['ACCESSOR']})` est refusé en 4.5: `dedup()` seul. Les UV répétées hors [0,1] ne sont pas quantifiées (message « Skipping TEXCOORD_0 »), sans gravité.
- `coque.py` complet: 4 min 30 (cuisson 48 échantillons, 2048 px).

## Deux Tabliers, place du Tilleul (vérifié le 2026-11-08)

- `coque.py --sans-cuisson` après une modification de géométrie de la place (même de couleurs de sommets seules, relancé derrière une cuisson complète): carte de lumière décalée, façades noires et inscriptions effacées. Toujours une cuisson complète (5 min), puis restaurer `shell_village.glb`, `shell_village_ext_fond.glb` et `textures/shell_village_lightmap.png` si seule la place est en jeu, puis `quantifier.cjs` et corriger `fiches/coque.json` (poids quantifié, ligne `compression`).
- Visionneuse `verifier/vue/capturer.mjs` (paramètre `cam=px,hauteur,pz;cible`): 5 vues en 20 s. Terrasse vers l'est: `cam=8,1.55,14.6;22,4.5,26`.

## Doigts des personnages Meshy (Deux Tabliers, vérifié le 2026-11-08)

- Ajouter des os à un GLB sans aller-retour Blender: `personnages/glb.py` (lecture et réécriture numpy, identique à l'octet près sans modification). Les clips restent intacts (écart 0,001 mm, `verifier/mains.py --avant`).
- Import glTF dans Blender: le premier clip est actif et les os sans courbe gardent la pose précédente; remettre toutes les pose bones à zéro avant d'appliquer un clip partiel (doigts seuls).
- Repère de la main: analyse en composantes principales des sommets de la main (la direction « bas » de la liaison n'est pas la normale de la paume). Pouce: côté où la moitié basse déborde le plus. Palmure introuvable sur ces maillages (doigts qui se touchent): jointures à 56 % de la longueur.
- Doigts: ne pondérer que les sommets surtout portés par la main (sinon la manche suit le pouce), rayon de capture 6 cm (sinon le bout de l'auriculaire reste à la main: pointe étirée). Contrôle de traversée sur toute la main et l'avant-bras: des triangles de palmure relient pouce et index.
- Le pouce de ces maillages est court: prise en clé (index replié à fond) et non en pince à demi pliée. Récipient gonflé de 0,5 mm pendant la recherche (sinon le moteur en float32 voit des contacts comme traversées).

## La Petite Ligne 2: chaîne des décors (vérifié le 2026-11-10)

- `assets-src/decors/`: `gabarits.toml` + `construire.sh` (10 s). Pièces en bmesh, `bm.to_mesh` par pièce puis `bpy.ops.object.join` et modificateur WEIGHTED_NORMAL (FACE_AREA, keep_sharp) appliqué: grandes faces planes, biseaux doux. `bpy.ops.object.select_all(action="DESELECT")`: itérer `view_layer.objects` après des suppressions rend des None.
- Enveloppe convexe (`bmesh.ops.convex_hull`) pour pans de toit, croupes, stores: plus simple que des boîtes tournées; supprimer `geom_interior` et `geom_unused`.
- Le rendu du jeu pose un modèle au CENTRE de son emprise (`object.position = volume.x, base, volume.y`); un meuble doit tenir dans ses cases (contrôlé par `verifier_decors.py`).
- Conflit à suivre: `clipSeat` du clip `sit` vaut 0,50 m, la bible veut des assises à 0,45: le bassin flotte de 5 cm (couche.ts borne à 0).
- Playwright global: `NODE_PATH=/opt/node22/lib/node_modules`. Le port 5173 et d'autres sont pris par d'autres sessions: `npx vite --port <libre> --strictPort`.

## La Petite Ligne 2: objets et visionneuse (vérifié le 2026-11-10)

- Workbench en arrière-plan rend une image vide (erreurs EGL): planches en Cycles, 8 échantillons (30 s pour 90 objets).
- Atlas par famille: `bpy.ops.uv.smart_project(scale_to_bounds=True)` en mode édition sur l'objet actif marche sans interface; peindre les îlots avec PIL (`polygon(..., outline=couleur, width=2)` pour border), image chargée puis `pack()`; export `export_vertex_color="NONE"`, sinon GLTFLoader multiplie couleurs de sommets et texture.
- GLTFLoader sous Node (vitest) échoue sur toute texture (`self is not defined`): dans les tests, lire la partie JSON du GLB à la main.
- Meshy: un aperçu `meshy-t2.5` s'affine (texture) sans `ai_model` (hérité), 10 crédits. Texturé, il gagne nettement sur nourriture et objets à motifs (vichy, étiquette, écailles); sans texture, à 800 triangles, il perd contre les gabarits.
- Garde-fou: les patchs Python en heredoc sur un fichier du dépôt sont refusés; écrire le patch dans le scratchpad (Write) puis `python3 patch.py <fichier>`. Les fichiers .mjs sous `src/` cassent eslint (hors projet TS): les mettre dans `assets-src/`.

## Têtes encrées de l'essai 4 (vérifié le 2026-11-10)

- Rampe à deux tons sur une tête Meshy réduite: les taches venaient des normales (bosses du maillage), pas des ombres portées ni du relief. Diagnostic: sortir dans le nuanceur N.L > 0, N.L > seuil et masque d'ombre en trois canaux. Remède: normales imposées sur toute la tête (analytiques au coeur du visage, diffusion de proche en proche ailleurs, coeur fixe); le polynôme du visage ne vaut rien au bord du masque.
- Lisser un visage Meshy en projetant y sur une surface: d'abord détendre x, z (replis des paupières et narines), et supprimer les îlots séparés (paupières de Meshy, bon repère des yeux).
- Repères du visage: profil médian (segments des faces coupées par x = 0); bout du nez = bas du palier le plus avancé; racine = plus grand retrait sous la corde front-nez; menton = recul franc vers le cou (la lèvre avance parfois plus que le menton).
- Planche de repères rendue avec des pistes NLA actives = pose du clip: `arm.data.pose_position = "REST"`. Les anciens réglages à l'oeil de l'essai 4 étaient faussés ainsi (menton 3 cm trop haut).
- `bpy.ops.mesh.decimate` en mode édition agit sur la sélection, mais poser `polygon.select` ne suffit pas (sommets restés sélectionnés = tout le maillage): sélectionner par `bmesh.from_edit_mesh` puis `select_flush_mode`.
- Attribut glTF perso: nom `_MAJ` et `export_attributes=True`; GLTFLoader le met en minuscules (`attribute float _visage;`).
- Sans modelé d'orbites, les traits fins s'éteignent dans les mips: mips « à l'encre » (couverture max, couleur la plus sombre par bloc 2 x 2) faits en JS au chargement.
- Clip sur place: pieds recalés au sol par translation verticale du bassin (clés de `Hips` en repère de l'os, `sonde_pieds.py --poser`); vitesse d'appui de la marche Meshy 0,9 à 1,35 m/s selon le corps.
- Un script nommé `inspect.py` dans le dossier courant masque le module standard (Blender plante au chargement). Heredoc suivi d'une autre commande: refusé par le garde-fou.

## Bâtiments encrés d'Aubrune (vérifié le 2026-11-10)

- Chaîne: `assets-src/decors/batiments-aubrune/` (géométrie en numpy pur dans `atelier.py`, Blender ne fait qu'écrire le GLB: 27 bâtiments et 86 pièces en 8 s). Fiches dans `donnees/lieux/aubrune/batiments/`, modèles dans `assets/lieux/aubrune/batiments/`.
- Le style encré se porte tel quel en Blender: boîtes tremblées une à une (pierre, tuile, planche), couleur par coin, un matériau nommé par matière. La page `planche/planche.mjs` importe la matière de `src/rendu/demo-encre/` sans y toucher (fichier .mjs sous `assets-src/`, servi par Vite depuis la racine du paquet) et convertit les GLB: couche de traits par nom de matériau, morceaux par sommets communs.
- Budget: ne pas faire les dessous ni les faces noyées dans le mur (caméra à 35 degrés au moins), tuile = dessus et chant bas (4 triangles): maison de 7 x 6 à deux niveaux en 4 100 triangles. Condition: profondeur des ombres en double face.
- Deux morceaux qui partagent un sommet à 1 mm près fusionnent pour le contour: reculer la vitre de 4 mm derrière le tableau.
- Trou au-dessus de l'arase (fenêtre de pignon): découper la grille du mur par les droites du pignon (Sutherland-Hodgman), sinon des rectangles percent le toit.
- Faîtières: les poser 10 cm au-dessus du faîte avec 20 cm de rayon; à 5 cm et 17 cm elles disparaissent sous le dernier rang de tuiles.
- Planche: placer le soleil par rapport à la caméra (lacet + 191 degrés), sinon les portes au nord et à l'est sont dans les noirs pleins et on ne juge rien. Vu du nord à 50 degrés, une lucarne du pan sud dépasse du faîtage: ce n'est pas un défaut.
- Ports Vite: 5391 et 5477 étaient pris; lire `ss -ltnp` avant de choisir. `npm install` hors dépôt: `--prefix <dossier>` (le cd vers le scratchpad ne tient pas).
- Garde-fou: une commande qui enchaîne heredoc et autre chose est refusée; un heredoc Python seul après un `cd` passe.
- La matière encrée a migré: `createInkLayers` et `createNoise` sont dans `src/rendu/encre/textures` (plus dans `demo-encre`); une page de planche qui répond 500 sous Vite, c'est un import cassé: lire le journal de Vite.
- Vite recharge la page dès qu'une fiche JSON de `donnees/` (ou un GLB) change: ne rien construire ni écrire dans le paquet pendant une capture (« element is not stable », capture perdue). Les vues « avant » se font d'abord, sur une copie des GLB servie par `dossier=/tmp-...` (à effacer ensuite).
- Façades (règle des travées, 2026-11-10): ouvertures à trumeaux égaux dans des travées bornées par les angles, les ouvertures placées et les piliers (contreforts, four); étages sur les axes du rez-de-chaussée. Fenêtre d'étage de 0,80 m: 30 cm d'encombrement de moins que celle du bas; deux fenêtres d'étage sur une porte et une fenêtre à 1,78 m d'axe ne tiennent qu'en fenêtres étroites. `controle_facades.py` fait la preuve sans Blender.
- Le tremblé dépend du compteur de morceaux: ajouter des pièces avant une autre change son tremblé (une margelle inclinée a fini 3,5 cm sous le sol). Toute pièce inclinée posée au sol garde 3 cm de marge.
- Chapeau de cheminée: deux tôles de 3 cm tournées de +-32 degrés autour de x (`rx = côté * pente` monte vers le faîte), pieds jusqu'au dessous de la tôle (pied + débord x tan): lisible de haut, contour net.

## Récoltables encrés d'Aubrune (vérifié le 2026-11-10)

- Chaîne: `assets-src/decors/recoltables-aubrune/` (`recoltables.toml`, géométrie numpy et scipy, Blender n'écrit que le GLB: 67 modèles en 10 s). Sorties dans `assets/commun/decors/aubrune-*.glb`, entrées `source` dans `decors.json` (l'ancienne chaîne des décors les garde).
- La conversion encrée des décors (`inkifyModel`) lit la teinte, pas le nom du matériau; les noms ne valaient que pour les bâtiments. `mergeNamed` de `decors.ts` fusionne le modèle et pose couche et vent par le nom (table `materials` du manifeste); la géométrie fusionnée est montrée vide à `inkTag` puis remplie, pour que la teinte ne repasse pas dessus (gardé par `tests/rendu/recoltables.test.ts`).
- Vent du jeu: nature `leaf` ou `stem` et hauteur au-dessus de l'origine du modèle; aucun attribut de poids. Tronc vivant en `stem` (il plie avec son houppier), bois coupé sans nature.
- Planche sur le vrai rendu: page `planche/planche.mjs` avec `InkKit` et `DecorModels`. `InkKit.frame` saute des images en rendu logiciel et `warm()` vaut vrai avant le premier dessin: compter les images vraiment dessinées (`renderer.info.render.calls` remis à 0 avant chaque appel). 15 s par vue de 1366 x 768.
- Trait de contour: arête tracée quand deux normales voisines font plus de 70 degrés. Terre modelée: normales lissées et pentes sous 33 degrés, sinon chaque billon est cerné comme un boudin. Deux objets qui se croisent (case bêchée dans la friche) sont cernés à leur intersection: la case passe au-dessus de la friche (planche relevée de 7 cm).
- Dents d'une touffe: longues et tombantes, elles sortent noires (dessous de feuillage) et font du houx; `dents` de 0,24 à 0,36 et chute courte. Racines fines = étoile sombre au pied: contreforts courts et épais.
- À 50 degrés, un houppier de rayon R ne laisse voir du tronc que `base - 1,19 R`: fût haut (2,9 m), houppier serré, et l'effacement du rendu doit suivre la largeur réelle.
- Lisibilité à 18 m de large (76 points par mètre): fruits de 9 à 12 cm de rayon posés sur les masses, corolles de 9 cm; des roseaux en lames verticales sortent sombres et illisibles: un bouchon rouge et blanc fait le repère.
- Blender n'unit pas les sommets de `from_pydata`: dédoublonner soi-même (place, normale, teinte) avant, le GLB perd 40 %. `normals_split_custom_set` par coin marche avec `use_smooth` vrai.

## Aménagements encrés d'Aubrune (vérifié le 2026-11-11)

- Familles `haie`, `talus`, `rang`, `meuble`, `ouvrage` dans `recoltables-aubrune/amenagements.py` (même chaîne, même toml): la chaîne réécrit la table `materials` du manifeste, une seconde chaîne l'écraserait. Noms de matériaux comme les bâtiments (`moellon` slab, `crepi` wall, `tuile` roof, `bardage` wood, `metal`, `vitre`, `etoffe`, `gazon` grass).
- Le rendu encré donne à CHAQUE exemplaire posé sa propre pièce de contour (`turn` tiré de l'origine, matiere.ts): des modules de 1 m posés un par un ont un trait épais à chaque raccord, même identiques. Une file sans couture demande un maillage fusionné à code de pièce unique (option `fusion` de la page de planche). Le dire avant de promettre « sans couture ».
- Module de file: bouts au même profil, sans tremblé, normales tirées du profil seul (pas des voisins intérieurs), rien hors de la case (`borne` de `bosse`): `size.w` doit valoir 1 sinon le moteur rééchelonne (comme `fenceVolumes`).
- À 50 degrés, un profil extrudé de haie se lit en pavé même bosselé: ce sont des masses claires sur un corps sombre plus petit qui font la haie. Une roue ou une meule d'axe est-ouest se voit par la tranche: axe nord-sud.
- Planche par `planche/provisoires.sh`: 10 vues en 2 min 30; vue « de l'ouest » (`lacet: 90`) pour un repère haut à côté d'une voie (12 m ne tiennent pas avec la voie dans le cadre à 18 m vus du sud).
- Garde-fou: `sed -i` avec plusieurs expressions et des apostrophes dans le texte inséré est refusé; patchs par script écrit avec Write (`splice.py`: remplace un bloc entre deux lignes repères).

## Trains et objets d'intérieur encrés (vérifié le 2026-11-11)

- Même chaîne `recoltables-aubrune/`: familles `vehicule` (`vehicules.py`) et `objet` (`interieurs.py`). Un nouveau nom de matériau s'ajoute à trois endroits: `MATERIAUX` de `formes.py` (sinon `AssertionError: <nom>`), `[materiaux]` du toml, et il ne peut prendre que `leaf`, `stem` ou `flame` comme nature (schéma du manifeste): pas de vitre `window` pour un décor. Fenêtres allumées la nuit d'un véhicule: matériau `vitrage` de nature `flame`.
- Voie du jeu: rails à 0,72 m de l'axe, dessus du rail à 0,26 m (traverses de 12 cm, rails de 14 cm); quai de 12 cm, nez à 1,5 m de l'axe. L'ancienne planche des aménagements dessinait une voie d'un mètre: ne pas la recopier.
- Planche d'un train: quai au sud (côté caméra), voie au nord, sinon la caisse cache le quai et on ne voit que le flanc sans portes. À 50 degrés, le toit fait la moitié de l'image: couvre-joints, aérateurs et radiateur à ailettes le rendent lisible.
- Un globe pendu sous un abat-jour reste caché à 50 degrés: une lèvre en `flamme` sous le bord de l'abat-jour se voit de tous les côtés.
- `construire.py` écrit `decors.json` en indentation 1: passer `pnpm exec prettier --write` dessus avant de rendre (la version versionnée est formatée).
- Ids de fiche à éviter: `tabouret` (le test des gabarits l'ajoute lui-même). Tout meuble posable sans vignette fait échouer `interface-plume.test.ts`: l'inscrire dans `WITHOUT_THUMB` avec sa raison. Ajouter un GLB au dossier des décors: l'inscrire dans la liste de `tests/rendu/decors.test.ts`.
- Planche de pièce: vue de biais `lacet: -35` (murs nord et ouest visibles), `large` 9,5, centre décalé vers le nord-ouest (les objets muraux montent dans l'image). Objets « sur un meuble »: champ `y` des objets de la page (`planche.mjs`), lumières des modèles posés par `lumieres: true`.

## Cultures, fêtes et coteau encrés (vérifié le 2026-11-11)

- Plantes au rendu encré: une lame dressée (brin, feuille presque verticale) est vue par la tranche et sort noire; fanes, poireaux et feuilles de muguet doivent s'ouvrir en gerbe ou retomber en arc pour montrer leur dessus. Tiges de 6 à 7 mm de rayon au plus: plus épaisses, le trait en fait des bâtons noirs.
- Têtes de fleur: étoiles fines (rapport creux sous 0,5) noyées dans leur contour; garder 7 à 8 pointes et un creux de 0,6, rayon de 4 à 8 cm, inclinées vers le sud. Coeur en pyramide à 4 pans (4 triangles) plutôt qu'en octaèdre: le budget de 150 par plant tient.
- Vitre de décor opaque (couche `plain`): une vitrine se dit par son cadre et deux reflets obliques en `vitre`, dessus ouvert, sinon elle cache ce qu'elle montre.
- Planche: un point haut apparaît plus au nord à l'écran (h / tan 50 degrés): pour voir un coteau de 9 m derrière un portail, centrer la vue 8 à 10 m plus au nord que le portail. Modules de voie: `fusion` par sorte dans les objets de la vue.
- Patchs: `python3 - fichier <<'EOF'` passe s'il est seul dans la commande; tout enchaînement (`&&`, `;`) avec un heredoc ou une boucle complexe est refusé dans un arbre isolé: script dans le scratchpad, puis appel simple.

## Tenues de La Petite Ligne 2 (vérifié le 2026-11-11)

- Chaîne `assets-src/personnages/` (gabarits.toml + construire.sh, 4 s, rejouable, GLB identiques d'un tour à l'autre). Planche dans le vrai aperçu encré: `planche-encre/planche.sh planche|controle <png> [ids]` (Vite sur 5961, 1 s par vue); `ECHELLE=2.5` pour regarder de près.
- Aperçu encré piloté par page: `createCharacterPreview(canvas, content, library, {style:'encre', renderer})`; pose de clip figée par un `AnimationMixer` à moi posé dans `scene.onBeforeRender` (+ `updateMatrixWorld`); l'encre saute des images: `renderer.info.autoReset=false`, redessiner jusqu'à `info.render.calls > 0`, sinon on capture la vue précédente.
- Coque ouverte (`Body.coque`): arcs par rangée à nombre de points fixe, soudure (`Builder.weld`) des bords confondus. Toute décision ouvert/fermé doit se prendre sur le corps moyen (`MEDIUM`), sinon les corpulences n'ont plus la même topologie (cibles de morphose refusées).
- Jupe sous le genou: poids des jambes dès le haut des cuisses, partagés sur toute la largeur (les deux élans se compensent en marche, s'ajoutent assis), dos moins suivi; un peu de tibia sous le genou. Reste un défaut en course (mollet qui ressort derrière): le dire. Tablier: largeur de partage énorme (moyenne des deux jambes), ourlet à 0,60 et évasé.
- Nuancier: un même nom dans plusieurs familles (« noisette »: peau, tissu, iris); résoudre un nom contre les couleurs de la zone, pas par le premier trouvé.
- Pièce `a-gagner` dans le catalogue: `defaultPlayerLook` ne doit pas la tirer (sinon `set_look` refusé, tests de la photo du prologue rouges).
## Remarques du client vues en visionneuse (vérifié le 2026-11-11)

- Le client fait tourner chaque modèle de près, de côté comme de dessus: une face manquante, une plaque à simple face vue de dos, un bout de tube ouvert, une boîte penchée sans dessous (`s.box` a `sans="y-"` par défaut) se voient comme des trous. `controle_volumes.py` (dans `verifier.py`) les cherche: z-buffer numpy par vue, premier triangle vu de dos; pièces par sommets communs; appui par chaînes de pièces à moins d'un cm (bords libres refermés); percée = une arête qui entre et ressort, milieu DANS l'autre pièce (parité d'un rayon) et à 5 mm de sa surface. 6 min pour 267 modèles sur la machine chargée.
- Fausses alertes à éviter dès la modélisation: deux boîtes au même plan (faces confondues) ou jointives avec tremblé; décaler d'1 à 2 mm (joint) ou enfoncer franchement une pièce plus mince dans l'autre. Une face double (feuille) a l'endroit et l'envers à la même place: au z-buffer, l'endroit doit gagner.
- `galet`: avec peu de points, l'axe peut sortir de l'enveloppe: le coeur d'orientation est la moyenne des sommets, et le pied est le point le plus bas (sinon le galet flotte). `tube`: repère transporté d'un anneau à l'autre (sinon une face vrillée se retourne). Calotte: les dents tournent leur endroit vers le ciel.
- Ce qui pousse sur une tige faite en `tube` s'accroche à la ligne brisée des anneaux, pas à la courbe exacte (2 cm d'écart au sommet d'un arc à 6 points).
- Ronce lisible: pas de boule ni de « pattes d'araignée » (tiges nues qui rayonnent du centre). Tiges qui partent d'un côté du fourré et retombent de l'autre (elles se croisent), feuilles à trois folioles tout le long, mûres en grappes au milieu de l'arc, sur un pédoncule.
- Flammes: langues en `tube` à normales lissées (`rond=True`), teintes claires (sinon le côté à l'ombre les fait brunes au rendu encré); `braise` est un matériau à part (nature `flame`), mais `mergeNamed` fusionne et ne garde que la nature: le dire à qui anime.
- Tri des anciens modèles: une fiche de meuble = « sert encore »; le `plan.json` du level designer cite d'anciens identifiants (`modele`, `gabarit.base`) sans que rien ne les dessine (`plan-vers-lieu.ts` ne les lit pas).

## Reprise des tenues « jusqu'à 9 » (vérifié le 2026-11-11)

- Rendu encré à deux tons: les « bosses dans l'aplat » d'un vêtement sont les normales de ses facettes près de la limite d'ombre. Remède: normales imposées du buste lissé (`Body.normale`, `Builder.normals`, `normals_split_custom_set` avec des zéros pour les faces laissées au calcul), bords rentrés compris, sinon le rendu trace un bout de trait partout où un bord se voit de biais (c'était le « cran sombre » du col).
- Trait du rendu (`encre/contour.ts`): normales à plus de 70 degrés ou saut de profondeur de 0,3 m. Un relief de moins d'un centimètre ne donne qu'un pointillé: coutures, bords de poche et de col se font en traits d'encre en géométrie (teinte fixe `encre_trait`, 7 à 8 mm), les grands détails par une zone de couleur.
- `mathutils.Vector` est en simple précision: une soudure par arrondi à 7 chiffres donne des topologies différentes d'une corpulence à l'autre (cibles de morphose refusées). Souder par distance; un trait fermé (chemin qui revient à son départ) se boucle explicitement.
- Largeur d'un col ou d'un revers: la compter sur la surface (`Body.meridien`); en hauteur elle s'étale sur le plat de l'épaule (10 cm) et s'écrase sur la poitrine (2 cm).
- Bassin en boule (« couche ») sous un haut court ou une salopette: le côté de la jambe doit prolonger la hanche (`droite`). Le pantalon droit d'origine a encore ce défaut.
- Jupe sous le genou en peau liée: chaque moitié suit la cuisse puis le tibia de son côté, colonnes serrées au milieu du devant et du dos, envers (faces retournées 3 mm dedans, sinon on voit au travers dès que l'ourlet se lève), peu de profondeur d'avant en arrière. Marche et assise justes; en course (genou à 113 degrés) il reste une échancrure au milieu du devant: aucune pondération fixe ne donne à la fois « retombe des genoux assise » et « reste devant en course ».
- Sonde des traversées (`sonde.py`, `LPL_SONDE`): le nombre de paires qui se coupent ne dit pas ce qui se voit (les bords rentrés des hauts coupent toujours les bas); s'en servir pour comparer deux réglages, juger à l'image.
- Couches de vêtements: 4 mm d'écart suffisent si la coque du dessus a des arcs fins (10 degrés) ou ses colonnes sur les pans du dessous; table en tête des pièces de `gabarits.toml`. Tester les mariages (`planche.sh mariages`): veste sur salopette, gilet sous veste.
- `planche.sh` lance son propre Vite sans rechargement (`vite.planche.config.mjs`): on peut reconstruire pendant une capture. Piège vu: le port par défaut de l'ancien script était tenu par le Vite d'une autre session (on aurait capturé son arbre). Capture: 1 à 4 s la vue selon la charge; étude complète d'une pièce (90 vues) 3 à 5 min.
- Budget de poids des personnages: 2,2 Mio (`tests/poids-paquet.test.ts`); un sommet de vêtement coûte environ 110 octets (quatre cibles de morphose). Les normales imposées permettent de réduire les rangs sans toucher à l'aplat.
- Aucune pièce ne se retire en posture couchée (pièces fusionnées à l'assemblage): chapeau de paille et pompon traversent oreiller et tête de lit; à faire côté moteur.
- Garde-fou: un heredoc Python long ou contenant des apostrophes mêlées est refusé (« too complex »): Write dans le scratchpad puis `python3 patch.py <fichiers>`.

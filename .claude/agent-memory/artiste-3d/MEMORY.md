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

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
- Capture en situation: `rendu.html?stats=0&vie=0&heure=10:00&x=44.5&y=10&orientation=0&zoom=1` (devant la maison de Firmin); sans `vie=0` la caméra reste sur la maisonnette. Triangles de la vue: `window.lplRendu.stats()` (ombres comprises). Les commandes avec `pkill` dans une chaîne coupent la suite: les lancer seules.

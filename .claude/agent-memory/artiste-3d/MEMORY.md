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

- Cycles affiche les deux côtés des faces: une face inversée ne se voit qu'à Three.js. Contrôle par script: volume signé par îlot fermé (négatif = inversé), aire orientée vers le haut pour les surfaces ouvertes.
- Validateur: paquet npm `gltf-validator` (pas de CLI, `validateBytes` en Node). Three.js 0.187 est dans `games/la-petite-ligne/node_modules`; la page de vérification sert les fichiers par un petit serveur Node (modules ES refusés en `file://`).
- Planches: une seule lumière soleil par rendu (supprimer les anciennes entre deux planches), vue « Standard » pour garder les couleurs de la palette, émission à 0 pour les vues de jour.
- Temps mesurés (4 cœurs): planche 2000 x 1250 à 20 échantillons, 30 à 60 s; scène de bourg 1800 x 1000 à 32 échantillons, 2 à 3 min.

## Conventions du studio pour La Petite Ligne

- Palette: UV de chaque face au centre d'une case de 4 px (texture 64 x 64), filtrage au plus proche: UV constant par face, donc pas de débordement de couleur même avec les mipmaps.
- Les noms de nœuds suivent les données du jeu (`games/la-petite-ligne/donnees/*.json`, champ `model`) et les types de la carte (`donnees/cartes/halte.json`); « porte: n » de la carte = n-ième case de la façade depuis la gauche vue de dehors.
- Bibliothèque commune: `games/la-petite-ligne/assets-src/modeles/lpl.py` (Geo, palette, export, planches); couleurs dans `palette.py` (ajouter les cases en fin de liste pour ne pas déplacer les autres).

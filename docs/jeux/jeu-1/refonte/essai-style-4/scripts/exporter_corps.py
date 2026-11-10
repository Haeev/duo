"""Export du corps conformé en GLB (peau, squelette duo-24, clips `marche` et `repos`, UV de l'atlas et des traits).
Essai 4: sans image embarquée (la scène pose l'atlas du personnage et ses niveaux de loin).

Usage: duo-python exporter_corps.py <corps.blend> <atlas.png> <sortie.glb>
L'atlas embarqué n'est qu'un défaut: en jeu, la tenue est une texture échangée sur le matériau.
"""
import sys

import bpy

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
blend, atlas_png, out = args[:3]
bpy.ops.wm.open_mainfile(filepath=blend)
img = bpy.data.images.load(atlas_png)
for m in bpy.data.materials:
    if not m.node_tree:
        continue
    for n in m.node_tree.nodes:
        if n.type == "TEX_IMAGE":
            n.image = img
            n.interpolation = "Linear"
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Metallic"].default_value = 0.0
        bsdf.inputs["Roughness"].default_value = 1.0
arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
arm.animation_data.action = None
for o in bpy.context.scene.objects:
    o.select_set(o.type in ("ARMATURE", "MESH"))
bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_format="GLB", export_animations=True,
                          export_animation_mode="NLA_TRACKS", export_skins=True, export_texcoords=True,
                          export_normals=True, export_attributes=True, export_vertex_color="NONE", export_image_format="NONE")
print("EXPORT", out)

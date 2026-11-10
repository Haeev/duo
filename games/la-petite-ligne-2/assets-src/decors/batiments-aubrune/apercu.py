"""Aperçu rapide d'un bâtiment en Cycles (contrôle de géométrie, pas le rendu du jeu).

    duo-python apercu.py <fichier.glb> <sortie.png> [lacet en degrés] [plongée] [largeur de vue en m]

Vue orthographique comme en jeu (plongée de 50 degrés par défaut), soleil du sud-ouest, mannequin
de 1,70 m devant la façade sud. Le rendu encré se juge sur la planche (`planche/`).
"""

import math
import sys

import bpy
from mathutils import Vector


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    glb, sortie = args[0], args[1]
    lacet = math.radians(float(args[2])) if len(args) > 2 else math.radians(25)
    plongee = math.radians(float(args[3])) if len(args) > 3 else math.radians(50)
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=glb)
    objets = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    coins = [o.matrix_world @ Vector(c) for o in objets for c in o.bound_box]
    bas = Vector((min(c.x for c in coins), min(c.y for c in coins), min(c.z for c in coins)))
    haut = Vector((max(c.x for c in coins), max(c.y for c in coins), max(c.z for c in coins)))
    centre = (bas + haut) / 2
    taille = (haut - bas).length
    largeur = float(args[4]) if len(args) > 4 else taille * 1.25
    bpy.ops.mesh.primitive_plane_add(size=80, location=(centre.x, centre.y, 0))
    sol = bpy.context.object
    mat = bpy.data.materials.new("sol")
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.32, 0.42, 0.16, 1)
    sol.data.materials.append(mat)
    # Mannequin de 1,70 m, à 1,5 m devant la façade sud.
    bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=1.45, location=(centre.x + 1.2, bas.y - 1.5, 0.725))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.14, location=(centre.x + 1.2, bas.y - 1.5, 1.56))
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = largeur
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    direction = Vector((math.sin(lacet) * math.cos(plongee), -math.cos(lacet) * math.cos(plongee), math.sin(plongee)))
    cam.location = centre + direction * 60
    cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    soleil = bpy.data.lights.new("soleil", "SUN")
    soleil.energy = 3.5
    soleil.angle = 0.02
    ob = bpy.data.objects.new("soleil", soleil)
    ob.rotation_euler = (math.radians(50), 0, math.radians(-50))
    bpy.context.scene.collection.objects.link(ob)
    monde = bpy.data.worlds.new("monde")
    monde.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    bpy.context.scene.world = monde
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 6
    sc.cycles.use_denoising = False
    sc.view_settings.view_transform = "Standard"
    sc.render.resolution_x, sc.render.resolution_y = 1000, 750
    sc.render.filepath = sortie
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()

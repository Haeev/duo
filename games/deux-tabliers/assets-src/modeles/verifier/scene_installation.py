"""Rendus de contrôle des assets du départ en cellule vide (v0.3), posés dans la coque d'Ormeval (Cycles).

Usage: duo-python scene_installation.py -- <dossier de sortie> [vue ...]

Chaque asset est posé à ses coordonnées de jeu (fiche `fiches/installation.json`, champ `pose`), dans
`shell_village.glb` et `shell_village_place.glb`. Vues de près (détails, traversées) et à hauteur d'yeux (1,65 m).
"""
import math
import os
import sys

import bpy
from mathutils import Vector

ICI = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(ICI, "..", "..", "..", "assets", "modeles"))

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
VUES = argv[1:]
os.makedirs(OUT, exist_ok=True)

# poses du jeu: (glb, position glTF, rotation autour de +Y en degrés)
# positions conseillées dans le compte rendu (le plan les a à y 12,20 et x 4,35, contre la façade et le mur ouest)
TABLES = [(4.8, 12.15), (6.4, 12.15), (8.0, 12.15)]
CARREE = (4.45, 10.1)


def pose_list(etat):
    L = [("shell_village", (0, 0, 0), 0), ("shell_village_place", (0, 0, 0), 0)]
    if etat in ("ferme", "arrivee", "decouvert"):
        L += [("shutter_bay_west", (5.4, 0.45, 13.0), 0), ("shutter_bay_east", (7.5, 0.45, 13.0), 0),
              ("shutter_bay_door", (9.4, 0.0, 13.0), 0), ("shutter_bay_small", (10.5, 0.9, 13.0), 0)]
    if etat in ("arrivee", "ouvert_arrivee"):
        L += [("sheet_counter", (9.45, 0, 9.16), 0)]
        for (x, z) in TABLES:
            L += [("gueridon_marbre", (x, 0, z), 0), ("chairs_upturned", (x, 0, z), 0), ("sheet_table", (x, 0, z), 0)]
        L += [("table_bistrot_quatre", (CARREE[0], 0, CARREE[1]), 0), ("chairs_upturned_square", (CARREE[0], 0, CARREE[1]), 0),
              ("sheet_table_square", (CARREE[0], 0, CARREE[1]), 0)]
        L += [("mail_bundle", (9.4, 0, 12.2), 0), ("bucket_sponge", (8.9, 0, 11.8), 0), ("event_balai", (5.9, 0, 9.3), 90)]
    if etat == "decouvert":
        L += [("station_espresso_2g", (9.15, 0.95, 9.005), 180)]
        for (x, z) in TABLES:
            L += [("gueridon_marbre", (x, 0, z), 0), ("chairs_upturned", (x, 0, z), 0)]
        L += [("table_bistrot_quatre", (CARREE[0], 0, CARREE[1]), 0), ("chairs_upturned_square", (CARREE[0], 0, CARREE[1]), 0)]
        L += [("sheet_pile", (5.6, 0, 11.4), 30), ("price_tag", (9.5, 1.30, 8.76), 180)]
    if etat == "revisee":
        L += [("espresso_revised", (9.15, 0.95, 9.005), 180)]
    return L


VUES_DEF = {
    # nom: (état, caméra (plan x, y, hauteur), cible, focale en degrés)
    "facade": ("ferme", (7.6, 18.5, 1.65), (7.6, 13.0, 1.4), 60),
    "porte_pres": ("ferme", (9.15, 13.75, 1.5), (9.28, 13.0, 1.4), 50),
    "porte_bas": ("ferme", (9.75, 13.55, 0.45), (9.4, 13.0, 0.05), 50),
    "salle_entree": ("arrivee", (9.6, 11.9, 1.65), (6.5, 9.4, 0.7), 70),
    "salle_ouest": ("arrivee", (8.6, 11.0, 1.65), (5.0, 11.8, 0.6), 70),
    "comptoir_pres": ("arrivee", (8.4, 10.6, 1.65), (9.6, 9.1, 1.0), 60),
    "decouvert_tables": ("decouvert", (6.0, 10.6, 1.4), (6.4, 12.2, 0.8), 60),
    "chaises_pres": ("decouvert", (6.95, 11.55, 1.05), (6.4, 12.2, 0.85), 55),
    "chaises_dessus": ("decouvert", (6.4, 12.21, 2.6), (6.4, 12.2, 0.0), 45),
    "carree_pres": ("decouvert", (5.3, 10.5, 1.3), (4.35, 10.1, 0.8), 60),
    "sol_porte": ("arrivee", (9.0, 11.2, 1.65), (9.0, 12.2, 0.0), 60),
    "machines": ("revisee", (9.2, 7.9, 1.65), (9.15, 9.0, 1.1), 55),
    "verso_rideau": ("ferme", (7.4, 11.0, 1.65), (7.5, 12.9, 1.4), 65),
}


def importer(nom, pos, rot):
    avant = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, nom + ".glb"))
    new = [o for o in bpy.data.objects if o not in avant]
    for o in new:
        if o.parent is None:
            o.location = Vector((pos[0], -pos[2], pos[1])) + o.location
            o.rotation_mode = "XYZ"
            o.rotation_euler.z += math.radians(rot)
    return new


def scene(etat):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 16
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 960, 540
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("w")
    sc.world = w
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.75, 0.8, 0.88, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
    sun = bpy.data.lights.new("s", "SUN")
    sun.energy = 3.0
    so = bpy.data.objects.new("s", sun)
    so.rotation_euler = (math.radians(55), 0, math.radians(200))
    sc.collection.objects.link(so)
    # lumière de la salle (la coque cuite n'éclaire pas Cycles): deux plafonniers doux
    for (x, y) in ((6.0, 10.5), (9.0, 10.0)):
        L = bpy.data.lights.new("p", "AREA")
        L.energy = 110
        L.size = 2.0
        lo = bpy.data.objects.new("p", L)
        lo.location = (x, -y, 2.6)
        sc.collection.objects.link(lo)
    for nom, pos, rot in pose_list(etat):
        importer(nom, pos, rot)
    # le ciel de la place cacherait le soleil
    for o in bpy.data.objects:
        if o.name.startswith("shell_village_sky"):
            o.hide_render = True
    return sc


etat_courant = None
for v in VUES or list(VUES_DEF):
    etat, cam, cible, fov = VUES_DEF[v]
    if etat != etat_courant:
        sc = scene(etat)
        etat_courant = etat
    cd = bpy.data.cameras.new("c")
    cd.lens_unit = "FOV"
    cd.angle = math.radians(fov)
    cd.clip_start = 0.02
    c = bpy.data.objects.new("c", cd)
    sc.collection.objects.link(c)
    c.location = (cam[0], -cam[1], cam[2])
    c.rotation_euler = (Vector((cible[0], -cible[1], cible[2])) - c.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = c
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = 87
    sc.render.filepath = os.path.join(OUT, v + ".jpg")
    bpy.ops.render.render(write_still=True)
    print("vue:", sc.render.filepath)

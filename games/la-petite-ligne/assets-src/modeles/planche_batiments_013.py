"""Planches des bâtiments neufs de la 0.13 (village013.glb): pour chaque modèle, vue de jeu de trois quarts avec un
habitant (1,74 m) à côté de la porte, vue opposée, gros plan de la porte, gros plan du toit et, pour les bâtiments
visitables, l'intérieur coupé comme en jeu (toit, étage et murs tournés vers la caméra retirés). Plus deux scènes
posées comme sur la carte: le moulin avec sa roue et ses passerelles, l'église avec le presbytère.

Lancer: duo-python planche_batiments_013.py <dossier des rendus> [tout | <nœud> ...]
Variables: LPL_SAMPLES (6), LPL_ECHELLE (1). Assemblage: planche_batiments_013.sh.
"""
import math
import os
import sys

import bpy  # noqa: I001
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
ARGS = [a for a in ARGS if not a.endswith(".py")]
SORTIE = ARGS[0]
ONLY = ARGS[1:] if len(ARGS) > 1 and ARGS[1] != "tout" else []
SAMPLES = int(os.environ.get("LPL_SAMPLES", "6"))
SCALE = float(os.environ.get("LPL_ECHELLE", "1"))
GLB = os.environ.get("LPL_GLB", os.path.join(lpl.OUT, "village013.glb"))

# porte (x, y de la façade, Blender) et place de l'habitant à côté de la porte
DOORS = {
    "church": (0.0, -5.6, 1.45), "presbytery_house": (0.0, -3.15, 1.0), "village_house_a": (-0.5, -2.75, 0.85),
    "village_house_a_shuttered": (-0.5, -2.75, 0.85), "village_house_b": (-0.5, -2.75, 0.85),
    "lineman_house": (0.5, -2.75, 0.85), "lineman_house_shuttered": (0.5, -2.75, 0.85),
    "forester_house": (0.5, -2.75, 0.95), "cafe_house": (0.0, -2.4, -0.9), "forge_shop": (0.0, -2.45, -1.3),
    "joinery_shop": (-0.5, -2.95, -1.3), "farm_house": (0.0, -2.45, 0.9), "farm_barn": (0.0, -3.2, 1.2),
    "washhouse": (0.0, -1.45, 0.9), "watermill": (0.0, -3.0, 0.95), "sluice_footbridge": (0.0, 0.0, 0.0),
    "tailrace_planks": (0.0, 0.0, 0.0), "mill_wheel": (0.0, 0.0, 0.0),
}
INTERIOR = {"church", "cafe_house", "forge_shop", "joinery_shop", "farm_house", "watermill"}
ROT = {"joinery_shop": 1, "watermill": 1}  # rotation sur la carte des bâtiments visitables (0 sinon)
# repère de la carte: (x, y, rotation) des objets posés ensemble dans les scènes
SCENES = {
    "scene_moulin": [("watermill", -13.5, 31.5, 1), ("mill_wheel", -13.5, 36.0, 1),
                     ("sluice_footbridge", -18.0, 36.0, 0), ("tailrace_planks", -8.0, 37.5, 0)],
    "scene_eglise": [("church", 95.5, -11.0, 0), ("presbytery_house", 79.5, -1.5, 1), ("village_house_a", 90.0, 6.0, 1)],
    "scene_carrefour": [("cafe_house", 90.5, 18.0, 0), ("forge_shop", 101.0, 18.0, 0), ("joinery_shop", 111.5, 18.0, 1)],
    "scene_ferme": [("farm_house", 118.5, 30.0, 0), ("farm_barn", 108.5, 32.5, 1), ("washhouse", 101.5, 36.5, 2)],
}


def shot(name, target, ortho, res, az=45.0, el=35.264):
    for o in list(bpy.data.objects):
        if o.type == "CAMERA":
            bpy.data.objects.remove(o, do_unlink=True)
    lpl.iso_camera(target=target, ortho=ortho, azimuth=az, elevation=el, dist=120)
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = int(res[0] * SCALE), int(res[1] * SCALE)
    sc.render.filepath = os.path.join(SORTIE, name + ".png")
    bpy.ops.render.render(write_still=True)


def fit(objs, az=45.0, el=35.264, res=(640, 520), margin=1.08):
    """Centre et largeur ortho qui cadrent les nœuds visibles depuis la caméra (azimut, élévation)."""
    a, e = math.radians(az), math.radians(el)
    d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    fwd = -d
    right = fwd.cross(Vector((0, 0, 1))).normalized()
    up = right.cross(fwd).normalized()
    pts = []
    for r in objs:
        if r.location.z < -1.0:
            continue
        for o in tree(r):
            if o.type == "MESH" and not o.hide_render:
                pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    xs = [p.dot(right) for p in pts]
    ys = [p.dot(up) for p in pts]
    zs = [p.dot(fwd) for p in pts]
    c = right * (max(xs) + min(xs)) / 2 + up * (max(ys) + min(ys)) / 2 + fwd * (max(zs) + min(zs)) / 2
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    return tuple(c), max(w, h * res[0] / res[1]) * margin


def tree(o):
    return [o] + list(o.children_recursive)


def show(root, on, cut=()):
    for o in tree(root):
        o.hide_render = not on
    if on:
        for o in tree(root):
            if any(o.name.endswith(c) for c in cut):
                for c in tree(o):
                    c.hide_render = True
            if o.name.endswith("_interior"):
                for c in tree(o):
                    c.hide_render = "interior" not in cut


def bounds(objs):
    pts = []
    for r in objs:
        for o in tree(r):
            if o.type == "MESH" and not o.hide_render:
                pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def load_char():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, "personnages.glb"))
    new = [o for o in bpy.data.objects if o not in before]
    rig = [o for o in new if o.type == "ARMATURE"][0]
    rig.data.pose_position = "REST"
    keep = {rig}
    for o in new:
        if o.name == "villager_firmin":
            keep.add(o)
    for o in new:
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    rig.rotation_mode = "XYZ"
    return rig


def main():
    os.makedirs(SORTIE, exist_ok=True)
    lpl.reset()
    lpl.setup_render((640, 520), SAMPLES)
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.ground_plane(600, lpl.hex_lin("#A7B98A"), z=-0.002)
    rig = load_char()
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=GLB)
    new = [o for o in bpy.data.objects if o not in before]
    roots = {o.name: o for o in new if o.parent is None}
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)
    for r in roots.values():
        r.rotation_mode = "XYZ"
        show(r, False)
    names = ONLY or [n for n in DOORS if n in roots] + [n for n in SCENES]
    for n in names:
        if n in SCENES:
            placed = []
            for (node, X, Y, q) in SCENES[n]:
                r = roots[node]
                r.location = (X, -Y, 0)
                r.rotation_euler = (0, 0, q * math.pi / 2)
                show(r, True)
                placed.append(r)
            bpy.context.view_layer.update()
            rig.location = (0, 0, -50)
            for tag, az in (("jeu", 45), ("nord", 225)):
                c, o = fit(placed, az, res=(960, 640))
                shot(f"{n}_{tag}", c, o, (960, 640), az=az)
            for r in placed:
                show(r, False)
                r.location = (0, 0, 0)
                r.rotation_euler = (0, 0, 0)
            continue
        r = roots[n]
        show(r, True)
        bpy.context.view_layer.update()
        dx, dy, side = DOORS[n]
        rig.location = (dx + side, dy - 0.55, 0.0)
        rig.rotation_euler = (0, 0, 0)
        if n in ("sluice_footbridge", "tailrace_planks"):
            rig.location = (0.0, -0.3, 0.16 if n == "sluice_footbridge" else 0.08)
        if n == "mill_wheel":
            rig.location = (0, 0, -50)
        bpy.context.view_layer.update()
        lo, hi = bounds([r])
        c = (lo + hi) / 2
        size = max(hi.x - lo.x, hi.y - lo.y)
        for tag, az in (("jeu", 45), ("dos", 225)):
            cc, o = fit([r, rig], az)
            shot(f"{n}_{tag}", cc, o, (640, 520), az=az)
        door = Vector((dx, dy, 1.3))
        shot(f"{n}_porte", tuple(door), 4.2, (480, 400), az=25, el=14)
        shot(f"{n}_toit", (c.x, c.y, hi.z * 0.72), max(4.5, size * 0.6), (480, 400), az=135, el=28)
        if n in INTERIOR:
            # caméra par défaut du jeu (azimut 45 dans le monde), ramenée dans le repère du modèle tourné sur la
            # carte: on coupe les deux murs qui la regardent, comme le rendu
            q = ROT.get(n, 0)
            az = (45 - 90 * q) % 360
            walls = {45: ("_wall_front", "_wall_right"), 315: ("_wall_front", "_wall_left")}[az]
            show(r, True, cut=("_roof", "_upper", "_attic") + walls + ("interior",))
            rig.location = (dx + 0.3, dy + 1.3, 0.12)
            rig.rotation_euler = (0, 0, math.pi)
            bpy.context.view_layer.update()
            cc, o = fit([r], az)
            shot(f"{n}_interieur", cc, o * 0.95, (640, 520), az=az)
            if n == "watermill":
                wh = roots["mill_wheel"]
                wh.location = (-4.5, 0.0, 0.0)
                show(wh, True)
                bpy.context.view_layer.update()
                cc, o = fit([r, wh], az)
                shot("watermill_rouet", cc, o * 0.7, (640, 520), az=az)
                show(wh, False)
                wh.location = (0, 0, 0)
            show(r, True)
        if n == "church":
            # beffroi de près, depuis la caméra du jeu: les cloches dans les baies sud et est
            shot("church_beffroi", (-7.95, 0.0, 12.2), 5.5, (480, 400), az=45)
        show(r, False)


main()

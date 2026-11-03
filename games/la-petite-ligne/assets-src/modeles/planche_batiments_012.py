"""Planche avant et après des détails de façade de la 0.12 (maisonnette, halte, épicerie, mercerie, fournil) et du
petit vase de fleurs.

Lancer: duo-python planche_batiments_012.py <dossier des GLB d'avant> <dossier de sortie des images>
Variables: LPL_ECHELLE (taille des images), LPL_SAMPLES. Assemblage: planche_batiments_012.sh.
Pour chaque bâtiment: vue de jeu (azimut 45), vue opposée (225) et gros plan d'un coin (descente d'eau).
"""
import math
import os
import sys

import bpy  # noqa: I001
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402
from planche_arrondi import AVANT, APRES, SORTIE, load  # noqa: E402

SCALE = float(os.environ.get("LPL_ECHELLE", "1"))
BUILDINGS = ["gatekeeper_house", "station", "ferrand_shop", "haberdashery", "bakery"]
HIDE_SUFFIX = ("_ruin", "_interior", "_ghost")


def shot(name, target, ortho, res, az=45.0, el=35.264):
    for o in list(bpy.data.objects):
        if o.type == "CAMERA":
            bpy.data.objects.remove(o, do_unlink=True)
    lpl.iso_camera(target=target, ortho=ortho, azimuth=az, elevation=el)
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = int(res[0] * SCALE), int(res[1] * SCALE)
    sc.render.filepath = os.path.join(SORTIE, name + ".png")
    bpy.ops.render.render(write_still=True)


def show(root, on):
    for o in [root] + list(root.children_recursive):
        o.hide_render = not on
    if on:
        for o in root.children_recursive:
            if any(o.name.endswith(s) or (s + "_") in o.name for s in HIDE_SUFFIX):
                o.hide_render = True
                for c in o.children_recursive:
                    c.hide_render = True


def bounds(root):
    pts = []
    for o in [root] + list(root.children_recursive):
        if o.type == "MESH" and not o.hide_render:
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def main():
    os.makedirs(SORTIE, exist_ok=True)
    lpl.reset()
    lpl.setup_render((600, 480), int(os.environ.get("LPL_SAMPLES", "6")))
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.ground_plane(400, lpl.hex_lin("#A7B98A"), z=-0.002)
    sets = {"a": load(os.path.join(AVANT, "bourg.glb"), "A_", BUILDINGS),
            "b": load(os.path.join(APRES, "bourg.glb"), "B_", BUILDINGS)}
    vases = load(os.path.join(APRES, "maison.glb"), "V_", ["table", "small_vase", "small_vase_blue",
                                                             "small_vase_terracotta"])
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)
    for r in list(sets["a"].values()) + list(sets["b"].values()) + list(vases.values()):
        show(r, False)
        r.location = (0, 0, 0)
    for n in BUILDINGS:
        for k in ("a", "b"):
            root = sets[k][n]
            show(root, True)
            lo, hi = bounds(root)
            c = (lo + hi) / 2
            size = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
            shot(f"bat_{n}_jeu_{k}", tuple(c), size * 1.35, (600, 480), az=45)
            shot(f"bat_{n}_dos_{k}", tuple(c), size * 1.35, (600, 480), az=225)
            # gros plan: coin avant droit (descente d'eau, gouttière, pot)
            corner = Vector((hi.x - 0.5, lo.y + 0.6, 1.6))
            shot(f"bat_{n}_coin_{k}", tuple(corner), 3.4, (420, 420), az=30, el=20)
            show(root, False)
    # vases sur la table
    tb = vases["table"]
    show(tb, True)
    for i, n in enumerate(("small_vase", "small_vase_blue", "small_vase_terracotta")):
        v = vases[n]
        show(v, True)
        v.location = (-0.45 + 0.45 * i, 0, 0.78)
    shot("vases_table", (0, 0, 0.95), 1.3, (600, 420), az=45)
    shot("vases_proche", (0, 0, 0.9), 0.75, (600, 420), az=20, el=12)
    _ = math


main()

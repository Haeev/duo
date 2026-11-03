"""Gros plans des descentes d'eau et des gouttières de la 0.12 (coin avant droit et coin arrière gauche de chaque
bâtiment), pour vérifier que rien ne flotte ni ne traverse (col de cygne contre le mur, dauphin au sol).

Lancer: duo-python verifier/gros_plan_descentes.py <dossier de sortie>
"""
import os
import sys

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lpl  # noqa: E402

OUT = sys.argv[-1]
# bâtiment: (coin avant droit, coin arrière gauche) en coordonnées Blender (x, y, z visé)
SPOTS = {"gatekeeper_house": ((2.7, -2.5, 1.5), (-2.7, 2.5, 1.5)), "station": ((4.3, -2.5, 1.8), (-4.3, 2.5, 1.8)),
         "ferrand_shop": ((4.9, -4.0, 2.8), (-4.9, 4.0, 2.8)), "haberdashery": ((3.2, -3.4, 1.8), (-3.2, 3.4, 1.8)),
         "bakery": ((3.1, 1.6, 1.8), (-3.1, 1.6, 1.8))}


def main():
    os.makedirs(OUT, exist_ok=True)
    lpl.reset()
    lpl.setup_render((420, 420), int(os.environ.get("LPL_SAMPLES", "6")))
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.ground_plane(400, lpl.hex_lin("#A7B98A"), z=-0.002)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, "bourg.glb"))
    new = [o for o in bpy.data.objects if o not in before]
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)
    roots = {o.name: o for o in new if o.parent is None}
    for o in new:
        o.hide_render = True
    for name, (a, b) in SPOTS.items():
        r = roots[name]
        for o in [r] + list(r.children_recursive):
            o.hide_render = any(s in q.name for q in [o] + _parents(o) for s in ("_ruin", "_interior", "_ghost"))
        r.location = (0, 0, 0)
        views = (("arriere_droit", a, 155), ("arriere_gauche", b, 205)) if name == "bakery" else \
            (("avant_droit", a, 25), ("arriere_gauche", b, 205))
        for tag, p, az in views:
            for c in list(bpy.data.objects):
                if c.type == "CAMERA":
                    bpy.data.objects.remove(c, do_unlink=True)
            lpl.iso_camera(target=p, ortho=3.2, azimuth=az, elevation=14)
            bpy.context.scene.render.filepath = os.path.join(OUT, f"descente_{name}_{tag}.png")
            bpy.ops.render.render(write_still=True)
        for o in [r] + list(r.children_recursive):
            o.hide_render = True


def _parents(o):
    out = []
    while o.parent is not None:
        o = o.parent
        out.append(o)
    return out


main()

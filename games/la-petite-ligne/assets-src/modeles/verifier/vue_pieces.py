"""La maisonnette réparée avec ses pièces du tour 10, comme le jeu les montrera.

Lancer: duo-python verifier/vue_pieces.py <bourg.glb> <image.png> [--etat bati|chantier|coupe|site]
        [--azimuts 45,135,225,315] [--elevation 32] [--res 900x700] [--cible x,y,z --taille m]
- bati: maisonnette avec murs à porte percée, cellier et chambre finis (tuiles, portes);
- chantier: éléments bâtis sans les tuiles ni les portes (avant la nuit de room_built), fenêtres d'origine;
- site: le matin du site: sols et solins seuls, éléments en fantôme (transparents);
- coupe: comme bati, toits retirés et murs côté caméra coupés (le joueur est dedans); repères des fenêtres.
"""
import math
import os
import sys

import bpy  # noqa: I001
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lpl  # noqa: E402


def _args():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    args = [a for a in args if not a.endswith("vue_pieces.py")]
    opts, pos, i = {}, [], 0
    while i < len(args):
        if args[i].startswith("--"):
            opts[args[i][2:]] = args[i + 1]
            i += 2
        else:
            pos.append(args[i])
            i += 1
    return pos[-2:], opts


(FICHIER, IMAGE), OPTS = _args()
ETAT = OPTS.get("etat", "bati")


def ghost_material():
    m = bpy.data.materials.new("fantome")
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.75, 0.85, 1.0, 1)
    bsdf.inputs["Alpha"].default_value = 0.25
    m.blend_method = "BLEND" if hasattr(m, "blend_method") else m.blend_method
    return m


def main():
    lpl.reset()
    w, h = (int(v) for v in OPTS.get("res", "900x700").split("x"))
    lpl.setup_render((w, h), int(OPTS.get("samples", 16)))
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.ground_plane(200, lpl.hex_lin("#A7B98A"), z=-0.002)
    bpy.ops.import_scene.gltf(filepath=FICHIER if os.path.isabs(FICHIER) else os.path.join(lpl.OUT, FICHIER))
    O = bpy.data.objects
    keep = set()
    for n in ("gatekeeper_house", "gatekeeper_cellar", "gatekeeper_bedroom"):
        keep |= {O[n], *O[n].children_recursive}
    keep -= {O["gatekeeper_house_ruin"], *O["gatekeeper_house_ruin"].children_recursive}
    keep -= {o for o in keep if o.name.startswith("gatekeeper_house_repaired_debris")}
    for o in list(O):
        if o.type in ("MESH", "EMPTY") and o not in keep:
            O.remove(o, do_unlink=True)
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)
    built = ETAT in ("bati", "coupe")
    hide = set()
    if built:
        hide |= {"gatekeeper_house_repaired_wall_left", "gatekeeper_house_repaired_wall_back"}
    else:
        hide |= {"gatekeeper_house_wall_left_door", "gatekeeper_house_wall_back_door", "gatekeeper_cellar_roof",
                 "gatekeeper_bedroom_roof", "gatekeeper_cellar_door", "gatekeeper_bedroom_door"}
    ghosts = set()
    if ETAT == "site":
        for r in ("gatekeeper_cellar", "gatekeeper_bedroom"):
            for el in O[r]["elements"]:
                ghosts |= set(el["nodes"])
    gm = ghost_material() if ghosts else None
    for o in keep:
        if o.type != "MESH":
            continue
        o.hide_render = o.name in hide
        if o.name in ghosts:
            o.data.materials[0] = gm
    marks = []
    if ETAT == "coupe":
        for o in keep:
            if o.type == "EMPTY" and o.name.startswith("window_"):
                bpy.ops.mesh.primitive_uv_sphere_add(radius=0.08, location=o.matrix_world.translation)
                s = bpy.context.object
                mm = bpy.data.materials.new("repere")
                mm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (1, 0.1, 0.6, 1)
                s.data.materials.append(mm)
                marks.append(s)
    c = Vector((-1.4, 2.3, 1.5))
    size = float(OPTS.get("taille", 14.0))
    if "cible" in OPTS:
        c = Vector(tuple(float(v) for v in OPTS["cible"].split(",")))
    cut = ["gatekeeper_house_repaired_roof", "gatekeeper_house_repaired_attic", "gatekeeper_cellar_roof",
           "gatekeeper_cellar_roof_frame", "gatekeeper_bedroom_roof", "gatekeeper_bedroom_truss",
           "gatekeeper_bedroom_wall_back_gable"]
    shots = []
    for i, az in enumerate(float(a) for a in OPTS.get("azimuts", "45,135,225,315").split(",")):
        for o in list(O):
            if o.type == "CAMERA":
                O.remove(o, do_unlink=True)
        cam = lpl.iso_camera(target=tuple(c), ortho=size, azimuth=az, elevation=float(OPTS.get("elevation", 32)))
        to_cam = cam.location - c
        to_cam.z = 0
        to_cam.normalize()
        if ETAT == "coupe":
            for o in keep:
                if o.type != "MESH" or o.name in hide:
                    continue
                vis = True
                if any(o.name == n or (o.parent and o.parent.name == n) for n in cut):
                    vis = False
                elif "_wall_" in o.name:
                    bb = [o.matrix_world @ Vector(v) for v in o.bound_box]
                    bc = sum(bb, Vector()) / 8
                    # repère de chaque volume: centre de la maison, du cellier ou de la chambre
                    if o.name.startswith("gatekeeper_cellar"):
                        ref = Vector((-4.3, 0, 0))
                    elif o.name.startswith("gatekeeper_bedroom"):
                        ref = Vector((0, 4.8, 0))
                    else:
                        ref = Vector((0, 0, 0))
                    d = bc - ref
                    d.z = 0
                    face = Vector((math.copysign(1, d.x), 0, 0)) if abs(d.x) > abs(d.y) else Vector((0, math.copysign(1, d.y), 0))
                    vis = face.dot(to_cam) <= 0.25
                o.hide_render = not vis
        f = f"{IMAGE[:-4]}-{i}.png"
        bpy.context.scene.render.filepath = f
        bpy.ops.render.render(write_still=True)
        shots.append(f)
    print("VUES", " ".join(shots))


main()

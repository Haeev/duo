"""Planches de contrôle du lot L-rendu-modèles de la 0.12, faites depuis les GLB livrés (pas depuis la scène de
construction): poses de la chèvre (deux robes), robes des poules, coq et poussin, objets de l'élevage et du
marché, étal garni sous la halle. Mannequin de 1,80 m pour l'échelle.

Lancer: duo-python planche_v012.py <dossier de sortie> [chevre poules objets marche]
Écrit des PNG; verifier/webp_v012.py les passe en WebP.
"""
import os
import sys

import bpy  # noqa: I001
from mathutils import Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else sys.argv[1]
WHAT = (sys.argv[sys.argv.index("--") + 2:] if "--" in sys.argv else sys.argv[2:]) or ["chevre", "poules", "objets",
                                                                                         "marche"]


def load(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, name + ".glb"))
    for o in set(bpy.data.objects) - before:
        o.rotation_mode = "XYZ" if o.type != "ARMATURE" else o.rotation_mode
        o.hide_render = True
    return {o.name: o for o in set(bpy.data.objects) - before}


def bake(arm, mesh, clip, frame, name, scale=1.0):
    ad = arm.animation_data or arm.animation_data_create()
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    act = bpy.data.actions[clip]
    ad.action = act
    ad.action_slot = act.slots[0]
    bpy.context.scene.frame_set(int(frame))
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.matrix_world = Matrix.Scale(scale, 4) @ mesh.matrix_world
    ob.hide_render = False
    return ob


def static(objs, root, name=None):
    """Copie visible d'un nœud importé et de ses enfants, avec le nom voulu (étiquette de la planche)."""
    d = lpl.duplicate_tree(objs[root])
    d.name = name or root
    for o in [d] + list(d.children_recursive):
        o.hide_render = False
    return d


def group(name, parts):
    e = lpl.empty(name)
    for p, loc in parts:
        p.parent = e
        p.location = loc
    return e


def mannequin():
    """Mannequin de 1,80 m gradué tous les 10 cm, posé comme un modèle de la planche (celui de lpl.board tombe
    sous les grands modèles)."""
    g = lpl.Geo(lpl.world_cells())
    g.box((0.3, 0.05, 1.8), color="paper_dark", base=True)
    for h in range(1, 18):
        g.box((0.34 if h % 5 == 0 else 0.32, 0.055, 0.008), loc=(0, 0, h * 0.1), color="shadow")
    mat = [m for m in bpy.data.materials if m.name.startswith("lpl_palette")][0]
    ob = g.to_object("mannequin 1,80 m", mat)
    return ob


def main():
    lpl.reset()
    os.makedirs(OUT, exist_ok=True)
    el = load("elevage")
    fe = load("ferme")
    ma = load("marche")
    if "chevre" in WHAT:
        arm = el["goat"]
        roots = []
        for robe in ("goat_chamois", "goat_white"):
            for clip, f in (("goat_idle", 0), ("goat_walk", 6), ("goat_trot", 3), ("goat_graze", 14),
                            ("goat_milk_stand", 0), ("goat_lie", 0), ("goat_bell", 12)):
                roots.append(bake(arm, el[robe], clip, f, f"{robe.split('_')[1]} {clip[5:]}"))
        roots.append(static(el, "goat_stake"))
        roots.append(static(el, "goat_bell"))
        roots.insert(0, mannequin())
        lpl.board(roots, os.path.join(OUT, "chevre-poses.png"), cols=8, spacing=lambda r: 1.4, label_size=0.08,
                  mannequin=False, res=(2000, 900), samples=12)
        for r in roots:
            bpy.data.objects.remove(r, do_unlink=True)
    if "poules" in WHAT:
        arm = fe["hen"]
        roots = []
        for v in ("hen_white", "hen_red", "hen_black", "hen_golden", "hen_ash", "hen_cuckoo", "hen_rooster",
                  "hen_chick"):
            roots.append(bake(arm, fe[v], "hen_idle", 0, v.replace("hen_", ""), 0.4 if v == "hen_chick" else 1.0))
        for v, clip, f in (("hen_rooster", "hen_peck", 11), ("hen_rooster", "hen_walk", 4),
                           ("hen_cuckoo", "hen_peck", 11), ("hen_chick", "hen_peck", 11)):
            roots.append(bake(arm, fe[v], clip, f, f"{v[4:]} {clip[4:]}", 0.4 if v == "hen_chick" else 1.0))
        lpl.board(roots, os.path.join(OUT, "poules-robes.png"), cols=6, spacing=lambda r: 0.62, label_size=0.045,
                  res=(2000, 1000), samples=12)
    if "objets" in WHAT:
        roots = [static(el, n) for n in ("goat_shed", "henhouse_extended", "hen_feeder_hopper", "goat_stake",
                                         "milk_can", "fresh_cheese", "egg_basket")]
        roots += [static(ma, n) for n in ("market_stall_stored", "market_crate", "market_scale", "blackberry_jam",
                                          "jar", "mail_bag")]
        roots.insert(0, mannequin())
        sp = {"mannequin 1,80 m": 0.8, "goat_shed": 3.0, "henhouse_extended": 3.6, "market_stall_stored": 2.4, "hen_feeder_hopper": 0.9}
        # les copies prennent un suffixe (.001): le nom du nœud est avant le point
        lpl.board(roots, os.path.join(OUT, "objets.png"), cols=7, spacing=lambda r: sp.get(r.name.split(".")[0], 0.6),
                  label_size=0.08, mannequin=False, res=(2000, 1000), samples=12,
                  names={r.name: r.name.split(".")[0] for r in roots})
    if "marche" in WHAT:
        # étal garni (six cagettes, balance, pots, fromages, panier) sous la halle, et l'étal seul
        def dressed(name, hall):
            parts = [(static(ma, "market_stall"), (0, 0, 0))]
            spots = [(-0.69, 0.17), (-0.23, 0.17), (0.23, 0.17), (0.69, 0.17), (-0.46, -0.17), (0.46, -0.17)]
            for k, (x, z) in enumerate(spots):
                # repère glTF (x, hauteur, z vers les clients) -> Blender (x, -z, hauteur)
                parts.append((static(ma, "market_crate", f"{name}_crate{k}"), (x, -z, 0.85)))
            parts.append((static(ma, "market_scale", f"{name}_scale"), (0.0, 0.2, 0.85)))
            for k in range(3):
                parts.append((static(ma, "blackberry_jam", f"{name}_jam{k}"), (-0.75 + k * 0.09, -0.17, 0.862)))
            parts.append((static(el, "fresh_cheese", f"{name}_cheese"), (0.2, -0.17, 0.862)))
            parts.append((static(el, "egg_basket", f"{name}_eggs"), (0.69, -0.17, 0.862)))
            if hall:
                parts.append((static(ma, "market_hall", f"{name}_hall"), (0, 0, 0)))
            return group(name, parts)
        roots = [dressed("market_stall garni", False), dressed("market_hall", True)]
        lpl.board(roots, os.path.join(OUT, "marche-etal-halle.png"), cols=2, spacing=lambda r: 5.0, label_size=0.14,
                  mannequin=True, res=(2000, 1100), samples=12)
        # même scène vue de l'autre côté (marchand) et de profil
        for az in (225, 315):
            lpl.board(roots, os.path.join(OUT, f"marche-etal-halle-{az}.png"), cols=2, spacing=lambda r: 5.0,
                      label_size=0.14, mannequin=True, res=(1600, 900), samples=12, azimuth=az)


if __name__ == "__main__":
    main()
    print("PLANCHES", OUT)

"""Contrôle des clips sur les témoins, chacun dans son gabarit (qualité visuelle, étape A).

Lancer: duo-python verifier/temoins_clips.py <personnages.glb> [--clips idle,walk] [--images 8] [--avant]
(--avant: GLB d'avant les témoins, sans gabarit, pour comparer; écrit stats/temoins_clips_avant.json)
Pour chaque témoin, chaque clip et n images (gabarit posé comme le jeu le fera avec `bone_rest`), mesure:
- sol: point le plus bas des chaussures (enfoncé sous -1,5 cm, ou personnage debout qui flotte à plus de 2 cm);
- mains et avant-bras dans le buste (sommets liés aux os des bras, sous la surface du buste: point le plus proche et
  sa normale), jambes qui sortent de la jupe (Colette), cheveux dans les épaules et le dos.
Profondeurs en mm; le seuil de signalement est 12 mm (le test par la normale donne de faux dedans près des bords
ouverts des coques: chaque cas signalé se regarde sur une vue de près).
"""
import json
import os
import sys

import bpy  # noqa: I001
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import gabarits as G  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
GLB = ARGS[0]
CLIPS = ARGS[ARGS.index("--clips") + 1].split(",") if "--clips" in ARGS else None
N = int(ARGS[ARGS.index("--images") + 1]) if "--images" in ARGS else 8
WIT = {"villager_colette": ("rond", "idle_colette"), "villager_firmin": ("trapu", "idle_firmin"),
       "player_base": ("moyen", "idle_player")}
PLAYER = ["player_base", "wear_top_chemise", "wear_bottom_pantalon", "wear_shoes_bottines", "player_hair_short"]
DEFAULT = ["idle", "walk", "carry_two", "hoe", "water", "sit", "talk", "harvest", "give", "eat", "sow", "wave"]
STANDING = {"idle", "walk", "carry_two", "hoe", "water", "talk", "give", "eat", "sow", "wave", "idle_colette",
            "idle_firmin", "idle_player"}
TORSO = {"hips", "spine", "chest"}
ARM = {"forearm_l", "forearm_r", "hand_l", "hand_r"}
LEG = {"thigh_l", "thigh_r", "shin_l", "shin_r"}
HAIR_U = (2 / 16, 4 / 16)


def main_group(ob, v, names):
    best = max(v.groups, key=lambda e: e.weight, default=None)
    return names[best.group] if best else None


def classify(ob):
    names = {g.index: g.name for g in ob.vertex_groups}
    me = ob.data
    uv = me.uv_layers.active.data
    vu = {}
    for lp, d in zip(me.loops, uv):
        vu[lp.vertex_index] = d.uv[0]
    cls = {}
    for v in me.vertices:
        g = main_group(ob, v, names)
        u = vu.get(v.index, 0)
        hair = HAIR_U[0] <= u < HAIR_U[1] and g in ("head", "chest", "neck")
        cls[v.index] = "hair" if hair else g
    return cls


def evaluated(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    out = {}
    for o in objs:
        me = o.evaluated_get(dg).to_mesh()
        out[o.name] = ([o.matrix_world @ v.co for v in me.vertices], [tuple(p.vertices) for p in me.polygons])
        o.evaluated_get(dg).to_mesh_clear()
    return out


def depth_inside(tree, p):
    loc, nrm, _, d = tree.find_nearest(p, 0.08)
    if loc is None:
        return 0.0
    s = (p - loc).dot(nrm)
    return -s if s < 0 else 0.0


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    acts = {a.name: a for a in bpy.data.actions}
    report = {}
    for main_name, (gab, idle) in WIT.items():
        parts = PLAYER if main_name == "player_base" else [main_name]
        objs = [bpy.data.objects[p] for p in parts if p in bpy.data.objects]
        cls = {o.name: classify(o) for o in objs}
        G.clear_rig(rig)
        if "--avant" not in ARGS:
            G.apply_to_rig(rig, gab)
        res = {}
        for clip in (CLIPS or DEFAULT) + [idle]:
            act = acts.get(clip)
            if act is None:
                continue
            rig.animation_data.action = act
            rig.animation_data.action_slot = act.slots[0]
            f0, f1 = act.frame_range
            worst = {"sol_min_mm": 1e9, "sol_max_mm": -1e9, "bras_buste_mm": 0.0, "jambes_jupe_mm": 0.0, "cheveux_mm": 0.0}
            for k in range(N):
                fr = f0 + (f1 - f0) * k / N
                bpy.context.scene.frame_set(int(round(fr)))
                ev = evaluated(objs)
                torso_co, torso_po = [], []
                feet = []
                for o in objs:
                    co, po = ev[o.name]
                    c = cls[o.name]
                    base = len(torso_co)
                    keep = [p for p in po if all(c[i] in TORSO for i in p)]
                    torso_co += co
                    torso_po += [tuple(i + base for i in p) for p in keep]
                    feet += [co[i].z for i in c if c[i] in ("foot_l", "foot_r")]
                tree = BVHTree.FromPolygons(torso_co, torso_po) if torso_po else None
                if feet:
                    worst["sol_min_mm"] = min(worst["sol_min_mm"], min(feet) * 1000)
                    worst["sol_max_mm"] = max(worst["sol_max_mm"], min(feet) * 1000)
                if tree is None:
                    continue
                for o in objs:
                    co, _ = ev[o.name]
                    c = cls[o.name]
                    for i, g in c.items():
                        if g in ARM:
                            worst["bras_buste_mm"] = max(worst["bras_buste_mm"], depth_inside(tree, co[i]) * 1000)
                        elif g == "hair":
                            worst["cheveux_mm"] = max(worst["cheveux_mm"], depth_inside(tree, co[i]) * 1000)
                if main_name == "villager_colette":
                    # jambe qui sort de la jupe: plus loin de l'axe que la jupe dans la même direction
                    co, po = ev[main_name]
                    c = cls[main_name]
                    sk = [p for p in po if all(c[i] in TORSO for i in p) and all(co[i].z < 0.98 for i in p)]
                    if sk:
                        st = BVHTree.FromPolygons(co, sk)
                        for i, g in c.items():
                            if g in LEG and 0.47 < co[i].z < 0.9:
                                p = co[i]
                                d = p.copy()
                                d.z = 0.0
                                if d.length < 0.02:
                                    continue
                                o = d.normalized() * 0.6
                                o.z = p.z
                                hit = st.ray_cast(o, -d.normalized(), 0.6)
                                if hit[0] is not None:
                                    rs = hit[0].copy()
                                    rs.z = 0.0
                                    worst["jambes_jupe_mm"] = max(worst["jambes_jupe_mm"], (d.length - rs.length) * 1000)
            flags = []
            if worst["sol_min_mm"] < -15:
                flags.append("ENFONCE")
            if clip in STANDING and worst["sol_max_mm"] > 25:
                flags.append("FLOTTE")
            for key in ("bras_buste_mm", "jambes_jupe_mm", "cheveux_mm"):
                if worst[key] > 12:
                    flags.append(key.split("_")[0].upper())
            res[clip] = {k: round(v, 1) for k, v in worst.items()}
            res[clip]["alertes"] = flags
            print(main_name, gab, clip, res[clip])
        report[main_name] = res
    nom = "temoins_clips_avant.json" if "--avant" in ARGS else "temoins_clips.json"
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "stats", nom)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=1)


main()

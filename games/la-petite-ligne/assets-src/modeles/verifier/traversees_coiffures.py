"""Coupes qui traversent le corps ou les vêtements (retour R01 du 2026-11-03): pour chaque coupe (et sa variante
sous chapeau), chaque clip du squelette et 12 images par clip, profondeur de pénétration entre la coupe et le
corps (sans la tête), chaque haut, chaque par-dessus, la salopette et chaque chapeau.

Mesure dans les deux sens, pièce par pièce (îlots de sommets reliés): sommet de la coupe sous la surface d'une
pièce de vêtement (point le plus proche, normale), et sommet d'un vêtement à l'intérieur d'un lobe de la coupe.
Les lobes de la coupe sont convexes: un sommet de vêtement y est dedans s'il est derrière tous les plans de leurs
faces. Les pièces des vêtements le sont presque: la mesure par la normale du point le plus proche y suffit.

Lancer après personnages.py:
    duo-python verifier/traversees_coiffures.py [--coupes braid,pigtails] [--clips idle,walk] [--seuil 0.003]
Écrit le détail dans stats/traversees_coiffures.json et imprime le pire cas de chaque coupe.
"""
import json
import os
import sys

import bpy  # noqa: I001
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lpl  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]


def arg(name, default=None):
    if name in ARGS:
        return ARGS[ARGS.index(name) + 1]
    return default


CUTS = ["short", "bob", "bun", "crop", "curls", "ponytail", "braid", "pigtails", "wavy", "long", "fringe", "quiff",
        "cloud", "crown", "bob_long"]
cuts = arg("--coupes", ",".join(CUTS)).split(",")
SEUIL = float(arg("--seuil", "0.003"))
N_FRAMES = int(arg("--images", "12"))

bpy.ops.wm.open_mainfile(filepath=arg("--blend", os.path.join(lpl.HERE, "blend", "personnages.blend")))
rig = bpy.data.objects["rig"]
rig.data.pose_position = "POSE"
clips = arg("--clips")
clips = clips.split(",") if clips else ["repos"] + [a.name for a in bpy.data.actions]
# l'équipage du train n'a que des bustes: ses clips ne concernent pas les joueurs
clips = [c for c in clips if not c.startswith("driver_")]

HAIRS = []
for c in cuts:
    HAIRS.append(("player_hair_" + c, None))
    for h in ([] if "--sans-chapeau" in ARGS else ("casquette", "paille", "bonnet")):
        HAIRS.append(("player_hair_" + c + "_hat", "wear_hat_" + h))
ARM_BONES = ("upper_arm_", "forearm_", "hand_")
CLOTHES = ["player_base"] + sorted(o.name for o in bpy.data.objects
                                   if o.name.startswith(("wear_top_", "wear_outer_", "wear_bottom_salopette")))


def islands(ob):
    """Îlots de sommets reliés (union-find sur les arêtes) et leurs polygones."""
    me = ob.data
    parent = list(range(len(me.vertices)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for e in me.edges:
        a, b = find(e.vertices[0]), find(e.vertices[1])
        if a != b:
            parent[a] = b
    groups = {}
    for i in range(len(me.vertices)):
        groups.setdefault(find(i), []).append(i)
    polys = {}
    for p in me.polygons:
        polys.setdefault(find(p.vertices[0]), []).append(list(p.vertices))
    # os dominant de chaque îlot (pour écarter la tête et ses traits)
    names = [g.name for g in ob.vertex_groups]
    out = []
    for r, vs in groups.items():
        tally = {}
        for i in vs:
            for ge in me.vertices[i].groups:
                tally[names[ge.group]] = tally.get(names[ge.group], 0.0) + ge.weight
        bone = max(tally, key=tally.get) if tally else ""
        out.append((vs, polys.get(r, []), bone))
    return out


ISL = {}
for name in set(CLOTHES) | {h for h, _ in HAIRS} | {hat for _, hat in HAIRS if hat}:
    ob = bpy.data.objects.get(name)
    if ob is None:
        continue
    isl = islands(ob)
    if name == "player_base":
        isl = [i for i in isl if i[2] not in ("head",)]
    ISL[name] = [i for i in isl if i[1]]


def coords(ob, dg):
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    M = ev.matrix_world
    co = [M @ v.co for v in me.vertices]
    ev.to_mesh_clear()
    return co


def bbox(pts, m=0.0):
    xs, ys, zs = zip(*pts)
    return (min(xs) - m, min(ys) - m, min(zs) - m, max(xs) + m, max(ys) + m, max(zs) + m)


def inside(b, p):
    return b[0] <= p.x <= b[3] and b[1] <= p.y <= b[4] and b[2] <= p.z <= b[5]


def in_head(p, Minv):
    """Point caché dans la tête (ellipsoïde de la tête ronde, repère de l'os `head`)."""
    q = Minv @ p
    return (q.x / 0.18) ** 2 + (q.y / 0.165) ** 2 + ((q.z - 1.545) / 0.17) ** 2 < 1.0


def depth_into(co_a, isl_a, co_b, isl_b, Minv, convex=False):
    """Plus grande profondeur d'un sommet de A sous la surface d'un îlot de B (hors de la tête, où rien ne se
    voit)."""
    best, where = 0.0, None
    pa = [co_a[i] for vs, _, _ in isl_a for i in vs]
    pa = [p for p in pa if not in_head(p, Minv)]
    if not pa:
        return best, where
    ba = bbox(pa, 0.0)
    for vs, polys, bone in isl_b:
        pts = [co_b[i] for i in vs]
        bb = bbox(pts, 0.002)
        if bb[3] < ba[0] or ba[3] < bb[0] or bb[4] < ba[1] or ba[4] < bb[1] or bb[5] < ba[2] or ba[5] < bb[2]:
            continue
        cand = [p for p in pa if inside(bb, p)]
        if not cand:
            continue
        if convex:
            # lobe de la coupe (convexe): dedans si derrière tous les plans des faces; profondeur = plan le plus proche
            planes = []
            for poly in polys:
                vs = [co_b[i] for i in poly]
                n = (vs[1] - vs[0]).cross(vs[2] - vs[0])
                if n.length > 1e-12:
                    planes.append((vs[0], n.normalized()))
            for p in cand:
                d = min(-(p - c).dot(n) for c, n in planes)
                if d > best:
                    best, where = d, (tuple(round(c, 3) for c in p), bone)
            continue
        tree = BVHTree.FromPolygons(co_b, polys)
        for p in cand:
            loc, nor, _, dist = tree.find_nearest(p)
            if loc is None:
                continue
            if (p - loc).dot(nor) < 0 and dist > best:
                best, where = dist, (tuple(round(c, 3) for c in p), bone)
    return best, where


worst = {}
detail = []
sc = bpy.context.scene
for clip in clips:
    if clip == "repos":
        # pose de repos (sans clip): ce qui traverse ici traverse dans toutes les poses
        rig.data.pose_position = "REST"
        frames = [0.0]
    else:
        rig.data.pose_position = "POSE"
        act = bpy.data.actions[clip]
        ad = rig.animation_data_create()
        ad.action = act
        ad.action_slot = act.slots[0]
        f0, f1 = act.frame_range
        frames = [f0 + (f1 - f0) * k / max(1, N_FRAMES - 1) for k in range(N_FRAMES)]
    for f in frames:
        sc.frame_set(int(f), subframe=f - int(f))
        dg = bpy.context.evaluated_depsgraph_get()
        CO = {n: coords(bpy.data.objects[n], dg) for n in ISL}
        pb = rig.pose.bones["head"]
        Minv = (rig.matrix_world @ pb.matrix @ pb.bone.matrix_local.inverted()).inverted()
        for hair, hat in HAIRS:
            if hair not in CO:
                continue
            for cl in CLOTHES + ([hat] if hat else []):
                for part in ("buste", "bras"):
                    isl = [i for i in ISL[cl] if i[2].startswith(ARM_BONES) == (part == "bras")]
                    if not isl:
                        continue
                    # sous un chapeau, la coupe est dans la calotte (ouverte en bas): seul compte ce qui perce le
                    # chapeau, c'est-à-dire un sommet du chapeau à l'intérieur d'un lobe
                    d1, w1 = (0.0, None) if cl == hat else depth_into(CO[hair], ISL[hair], CO[cl], isl, Minv)
                    d2, w2 = depth_into(CO[cl], isl, CO[hair], ISL[hair], Minv, convex=True)
                    d, w = (d1, ("coupe dans", w1)) if d1 >= d2 else (d2, ("vêtement dans", w2))
                    if d > SEUIL:
                        detail.append({"hair": hair, "hat": hat, "with": cl, "part": part, "clip": clip,
                                       "frame": round(f, 1), "depth": round(d, 4), "where": w})
                    key = (hair, hat, part)
                    if d > worst.get(key, (0.0,))[0]:
                        worst[key] = (d, cl, clip, round(f, 1), w)

os.makedirs(os.path.join(lpl.HERE, "stats"), exist_ok=True)
summary = {}
for hair, hat in HAIRS:
    lab = hair + (" + " + hat if hat else "")
    for part in ("buste", "bras"):
        d, cl, clip, f, w = worst.get((hair, hat, part), (0.0, "", "", 0, None))
        summary[f"{lab} / {part}"] = {"mm": round(d * 1000, 1), "with": cl, "clip": clip, "frame": f}
        if d > SEUIL:
            print(f"TRAVERSEE {lab} / {part}: {d * 1000:.1f} mm avec {cl} ({clip}, image {f}) {w}")
        else:
            print(f"TRAVERSEE {lab} / {part}: aucune au-delà de {SEUIL * 1000:.0f} mm")
with open(os.path.join(lpl.HERE, "stats", arg("--sortie", "traversees_coiffures.json")), "w", encoding="utf-8") as fh:
    json.dump({"seuil_m": SEUIL, "images_par_clip": N_FRAMES, "clips": clips, "pire_cas": summary,
               "depassements": detail}, fh, ensure_ascii=False, indent=1)
    fh.write("\n")

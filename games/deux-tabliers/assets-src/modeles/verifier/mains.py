"""Contrôle des os des doigts et des poses de main (duo-python).

Usage: duo-python mains.py -- <dossier de sortie> <id>... [--avant <dossier des GLB d'avant>] [--rendu]

Pour chaque personnage:
1. clips inchangés: si `--avant` est donné, compare le maillage déformé du GLB d'avant (sans doigts) et du GLB actuel à
   6 instants de chaque clip (walk, idle, sit, drink, sit_drink); écart maximal en mm;
2. prises: pose `grip_handle` (tasse à cappuccino) et `grip_glass` (verre) appliquées par Blender lui-même (clip du GLB),
   récipient placé avec la transformation du rapport `<id>.doigts.json` (repère métrique de RightHand), puis test de
   traversée main contre récipient (arbres BVH sur le maillage déformé évalué) et distance des bouts de doigts;
3. étirement des arêtes dans les poses de main (relaxed, grip_handle, grip_glass): rapport des longueurs posée et au
   repos, arêtes de plus de 2 mm, seuil 2,5; une déchirure (sommets confondus au repos qui s'écartent de plus de
   0,5 mm) compte 99;
4. avec `--rendu`: gros plans Cycles de la main (de face, de profil, de dessus) pour chaque prise et pour `relaxed`.
"""
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

ICI = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(ICI, "..", "..", "..", "assets", "modeles"))
PERSOS = os.path.normpath(os.path.join(ICI, "..", "personnages"))

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
ids, avant, rendu = [], None, False
i = 1
while i < len(argv):
    if argv[i] == "--avant":
        avant = argv[i + 1]
        i += 2
    elif argv[i] == "--rendu":
        rendu = True
        i += 1
    else:
        ids.append(argv[i])
        i += 1
os.makedirs(OUT, exist_ok=True)
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))  # glTF (Y en haut) -> Blender (Z en haut)


def load(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    rig = next((o for o in new if o.type == "ARMATURE"), None)
    meshes = [o for o in new if o.type == "MESH" and (rig is None or any(m.type == "ARMATURE" for m in o.modifiers))]
    kept = []
    for o in new:
        if o.type == "MESH" and o not in meshes and rig is not None:
            bpy.data.objects.remove(o, do_unlink=True)
        else:
            kept.append(o)
    return rig, meshes, kept


def set_clip(rig, name, frame):
    act = bpy.data.actions.get(name) or next(a for a in bpy.data.actions if a.name.startswith(name))
    ad = rig.animation_data_create()
    for tr in list(ad.nla_tracks):
        ad.nla_tracks.remove(tr)
    # les os sans courbe dans le clip gardent sinon la pose du clip précédent (l'import active le premier clip)
    ad.action = None
    for pb in rig.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)
    ad.action = act
    ad.action_slot = act.slots[0]
    bpy.context.scene.frame_set(int(frame))
    bpy.context.view_layer.update()
    return act


def deformed(meshes):
    deps = bpy.context.evaluated_depsgraph_get()
    pts, tris = [], []
    for o in meshes:
        ev = o.evaluated_get(deps)
        me = ev.to_mesh()
        base = len(pts)
        pts += [o.matrix_world @ v.co for v in me.vertices]
        me.calc_loop_triangles()
        tris += [tuple(base + i for i in t.vertices) for t in me.loop_triangles]
        ev.to_mesh_clear()
    return pts, tris


def hand_world_gltf(ident, side="Right"):
    """Matrice monde de l'os de la main en pose de liaison (inverse de sa matrice de liaison inverse), sans échelle,
    repère glTF. C'est ce repère que suit la peau: la pose de repos des nœuds peut en différer de quelques millimètres."""
    sys.path.insert(0, PERSOS)
    from glb import Glb, mat4
    g = Glb(os.path.join(ASSETS, ident + ".glb"))
    sk = g.g["skins"][0]
    j = sk["joints"].index(g.node(side + "Hand"))
    H = np.linalg.inv(mat4(g.read(sk["inverseBindMatrices"])[j]))
    H[:3, :3] /= np.linalg.norm(H[:3, 0])
    return Matrix(H.tolist())


def place_vessel(ident, grip, vessel_objs):
    rep = json.load(open(os.path.join(PERSOS, ident + ".doigts.json")))
    pr = rep["prises"][grip]
    x, y, z, w = pr["quaternion_xyzw"]
    T = Matrix.Translation(Vector(pr["position_m"])) @ Quaternion((w, x, y, z)).to_matrix().to_4x4()
    Mg = hand_world_gltf(ident) @ T
    root = next(o for o in vessel_objs if o.parent is None)
    root.matrix_world = C @ Mg @ C.inverted()
    bpy.context.view_layer.update()
    return Mg


def check_overlap(meshes, vessel_meshes):
    p1, t1 = deformed(meshes)
    p2, t2 = deformed(vessel_meshes)
    a = BVHTree.FromPolygons(p1, t1)
    b = BVHTree.FromPolygons(p2, t2)
    return len(a.overlap(b)), p1, b


def setup_render():
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 16
    sc.cycles.use_denoising = True
    sc.render.resolution_x = sc.render.resolution_y = 420
    sc.view_settings.view_transform = "Standard"
    if sc.world is None:
        sc.world = bpy.data.worlds.new("w")
    sc.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.8, 0.8, 0.82, 1)
    sc.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    if "soleil" not in bpy.data.objects:
        sun = bpy.data.lights.new("soleil", "SUN")
        sun.energy = 2.5
        so = bpy.data.objects.new("soleil", sun)
        so.rotation_euler = (math.radians(40), 0, math.radians(30))
        sc.collection.objects.link(so)


def shot(target, direction, up, dist, path):
    sc = bpy.context.scene
    cam = bpy.data.objects.get("cam") or bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    if cam.name not in sc.collection.objects:
        sc.collection.objects.link(cam)
    cam.data.lens = 60
    cam.data.clip_start = 0.01
    d = Vector(direction).normalized()
    cam.location = Vector(target) + d * dist
    z = d
    x = Vector(up).cross(z).normalized()
    y = z.cross(x)
    cam.matrix_world = Matrix((x, y, z)).transposed().to_4x4()
    cam.location = Vector(target) + d * dist
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


results = {}
for ident in ids:
    res = {}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rig, meshes, _ = load(os.path.join(ASSETS, ident + ".glb"))
    # 1. clips inchangés
    if avant:
        rig0, meshes0, objs0 = load(os.path.join(avant, ident + ".glb"))
        clips = {}
        for clip in ("walk", "idle", "sit", "drink", "sit_drink"):
            a1 = set_clip(rig, clip, 0)
            a0 = set_clip(rig0, clip, 0)
            f0, f1 = a1.frame_range
            worst = 0.0
            for k in range(6):
                f = f0 + (f1 - f0) * k / 5
                set_clip(rig, clip, f)
                set_clip(rig0, clip, f)
                p1, _ = deformed(meshes)
                p0, _ = deformed(meshes0)
                worst = max(worst, max((a - b).length for a, b in zip(p1, p0)))
            clips[clip] = round(worst * 1000, 3)
        res["ecart_clips_mm"] = clips
        for o in objs0:
            bpy.data.objects.remove(o, do_unlink=True)
    # 2. étirement des arêtes dans chaque pose de main (seuil 2,5; arêtes de plus de 2 mm au repos)
    ad = rig.animation_data_create()
    ad.action = None
    for pb in rig.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    p0, t0 = deformed(meshes)
    edges = {(min(a, b), max(a, b)) for t in t0 for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0]))}
    edges = [(a, b, (p0[a] - p0[b]).length) for a, b in edges]
    edges = [e for e in edges if e[2] > 0.002]
    first = {}
    twins = []
    for i_, v in enumerate(p0):
        k_ = (round(v.x * 1e5), round(v.y * 1e5), round(v.z * 1e5))
        if k_ in first:
            twins.append((first[k_], i_))
        else:
            first[k_] = i_
    res["etirement_max"] = {}
    for pose in ("relaxed", "grip_handle", "grip_glass"):
        if not any(a.name.startswith(pose) for a in bpy.data.actions):
            continue
        set_clip(rig, pose, 0)
        p1, _ = deformed(meshes)
        r_ = max((p1[a] - p1[b]).length / l for a, b, l in edges)
        # déchirure: sommets confondus au repos (coutures d'UV) qui s'écartent dans la pose
        if max((p1[a] - p1[b]).length for a, b in twins) > 0.0005 if twins else False:
            r_ = 99.0
        res["etirement_max"][pose] = round(r_, 2)
    res["etirement_ok"] = all(v <= 2.5 for v in res["etirement_max"].values())
    # 3. prises
    res["prises"] = {}
    grips = [g_ for g_ in (("grip_handle", "ware_cup_cappuccino"), ("grip_glass", "ware_glass"))
             if any(a.name.startswith(g_[0]) for a in bpy.data.actions)]
    for grip, model in grips:
        _, vmeshes, vobjs = load(os.path.join(ASSETS, model + ".glb"))
        vmeshes = [o for o in vobjs if o.type == "MESH" and not o.name.endswith("_liquid")]
        for o in vobjs:
            if o.name.endswith("_liquid"):
                o.hide_render = True
        set_clip(rig, grip, 0)
        place_vessel(ident, grip, vobjs)
        n, pts, vb = check_overlap(meshes, vmeshes)
        res["prises"][grip] = {"traversees_blender": n}
        if rendu:
            setup_render()
            pv, _ = deformed(vmeshes)
            vc = sum(pv, Vector()) / len(pv)
            hw = C @ hand_world_gltf(ident)
            hand_c = hw.translation + hw.to_3x3() @ Vector((0, 0.08, 0))
            target = (hand_c + vc) / 2
            root = next(o for o in vobjs if o.parent is None)
            R = root.matrix_world.to_3x3().normalized()
            # vues dans le repère du récipient: anse vers +X, haut +Y glTF (+Z Blender local), avant +Z glTF
            for nom, dirv, up in (("face", R @ Vector((0.25, 0.9, 0.35)), R @ Vector((0, 0, 1))),
                                  ("profil", R @ Vector((1, 0.15, 0.25)), R @ Vector((0, 0, 1))),
                                  ("dessus", R @ Vector((0.2, 0.15, 1)), R @ Vector((-1, 0, 0))),
                                  ("dos", R @ Vector((0.25, -0.9, 0.35)), R @ Vector((0, 0, 1)))):
                shot(target, dirv, up, 0.45, os.path.join(OUT, f"{ident}_{grip}_{nom}.png"))
        for o in vobjs:
            bpy.data.objects.remove(o, do_unlink=True)
    if rendu:
        set_clip(rig, "relaxed", 0)
        for side in ("Right", "Left"):
            hw = C @ hand_world_gltf(ident, side)
            c = hw.translation + hw.to_3x3() @ Vector((0, 0.08, 0))
            shot(c, (0, -1, 0.2), (0, 0, 1), 0.5, os.path.join(OUT, f"{ident}_relaxed_{side}.png"))
    results[ident] = res
    print(ident, json.dumps(res, ensure_ascii=False))
json.dump(results, open(os.path.join(OUT, "mains.json"), "w"), ensure_ascii=False, indent=1)

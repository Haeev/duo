"""Sonde des traversées: pose le squelette aux images des clips et compte les triangles d'une pièce qui coupent
le corps ou une autre pièce (un mollet qui sort d'une jupe, une cuisse qui perce un tablier).

Lancée par construire_catalogue.py quand LPL_SONDE est posé (rien n'est exporté de plus):
  LPL_SONDE="bottom-long-skirt:body-base/shin+thigh-b,shoes-pebble;dress-sunday:body-base" bash construire.sh
Après `/`, les sections du corps à sonder (jambes seules, mains seules); sans rien, tout ce que la pièce ne
masque pas.
Chaque ligne: pièce, autre pièce, corpulence, clip, nombre de paires de triangles qui se coupent à la pire
image, cette image, et où (hauteur moyenne et côté). 0 partout = rien ne traverse dans ces clips.
Du corps on ne garde que les sections que la pièce ne masque pas (`covers`).
"""
import bpy
from mathutils.bvhtree import BVHTree

BUILDS = {"mince": ("slim", "f"), "moyenne": ("m",), "forte": ("round", "f")}
CLIPS = ("idle", "walk", "run", "sit")
SAMPLES = 12
QUIET = True  # ne dire que ce qui traverse


def _mesh(ob, depsgraph, keep=None):
    """Sommets (repère du monde) et triangles de l'objet déformé; keep(polygone du maillage source) filtre."""
    ev = ob.evaluated_get(depsgraph)
    me = ev.to_mesh()
    verts = [ob.matrix_world @ v.co for v in me.vertices]
    tris = []
    for p in me.polygons:
        if keep is None or keep(ob.data.polygons[p.index]):
            vs = list(p.vertices)
            tris += [(vs[0], vs[i], vs[i + 1]) for i in range(1, len(vs) - 1)]
    ev.to_mesh_clear()
    return verts, tris


def _set_build(ob, morphs):
    keys = ob.data.shape_keys
    if keys:
        for kb in keys.key_blocks[1:]:
            kb.value = 1.0 if kb.name in morphs else 0.0


def run(rig, objects, clips, request, regions, covers_of):
    scene = bpy.context.scene
    ad = rig.animation_data_create()
    for pair in request.split(";"):
        a_id, others = pair.split(":")
        a_ob, a_spec, _ = objects[a_id]
        hidden = {regions.index(r) for r in covers_of(a_spec) if r in regions}
        for b_id in others.split(","):
            b_id, _, only = b_id.partition("/")
            wanted = {regions.index(r) for r in only.split("+")} if only else None
            b_ob = objects[b_id][0]
            keep = None
            if b_id == "body-base":
                uv = b_ob.data.uv_layers[0].data

                def keep(poly, uv=uv, wanted=wanted):
                    region = int((1.0 - uv[poly.loop_indices[0]].uv.y) * 16)
                    return region not in hidden and (wanted is None or region in wanted)
            for build, morphs in BUILDS.items():
                _set_build(a_ob, morphs)
                _set_build(b_ob, morphs)
                for name in CLIPS:
                    act = clips[name]
                    ad.action = act
                    ad.action_slot = act.slots[0]
                    f0, f1 = act.frame_range
                    worst = (0, 0, "")
                    for i in range(SAMPLES):
                        frame = f0 + (f1 - f0) * i / SAMPLES
                        scene.frame_set(int(frame), subframe=frame - int(frame))
                        dg = bpy.context.evaluated_depsgraph_get()
                        va, ta = _mesh(a_ob, dg)
                        vb, tb = _mesh(b_ob, dg, keep)
                        if not ta or not tb:
                            continue
                        hits = BVHTree.FromPolygons(va, ta).overlap(BVHTree.FromPolygons(vb, tb))
                        if len(hits) > worst[0]:
                            pts = [va[i] for h, _ in hits for i in ta[h]]
                            z = sum(p.z for p in pts) / len(pts)
                            y = sum(p.y for p in pts) / len(pts)
                            x = sum(abs(p.x) for p in pts) / len(pts)
                            worst = (len(hits), i, f"hauteur {z:.2f}, {'dos' if y > 0 else 'devant'} {abs(y):.2f}, côté {x:.2f}")
                    if worst[0] or not QUIET:
                        print(f"SONDE {a_id} x {b_id}{'/' + only if only else ''} {build} {name}: {worst[0]} (image {worst[1]}/{SAMPLES}) {worst[2]}")
                _set_build(a_ob, ())
                _set_build(b_ob, ())
    print("SONDE finie")
    ad.action = None
    for pb in rig.pose.bones:
        pb.matrix_basis.identity()
    scene.frame_set(0)

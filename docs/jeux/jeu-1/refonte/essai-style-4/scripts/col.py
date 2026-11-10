"""Col en volume: une pièce de géométrie commune à toutes les tenues à col (chemise, blouse), posée sur
chaque corps par rayons. Le col tient debout contre le cou, se rabat et retombe en deux pointes devant.

Usage: duo-python col.py <corps.blend> <sortie.glb>
56 triangles, UV dans la cellule « col » de l'atlas (bande D, à gauche); suit l'os de la poitrine (`Spine`).
"""
import math
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
blend, out_glb = args[:2]
CELL = (0.0, 0.0, 0.25, 0.1875)
bpy.ops.wm.open_mainfile(filepath=blend)
body = next(o for o in bpy.context.scene.objects if o.type == "MESH")
arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
mw = body.matrix_world
bvh = BVHTree.FromPolygons([mw @ v.co for v in body.data.vertices], [list(p.vertices) for p in body.data.polygons])
neck = arm.matrix_world @ arm.data.bones["neck"].head_local
N, GAP = 14, math.radians(16)
vs, fs, uv = [], [], []
for k in range(N + 1):
    a = GAP + (2 * math.pi - 2 * GAP) * k / N           # 0 = devant; le col est ouvert devant
    d = Vector((math.sin(a), -math.cos(a), 0.0))
    devant = max(0.0, 1 - min(a, 2 * math.pi - a) / math.radians(62))   # 1 aux pointes, 0 sur les côtés
    z_top = neck.z + 0.034 - 0.012 * devant
    o = Vector((neck.x, neck.y, z_top))
    hit = bvh.ray_cast(o + d * 0.5, -d)[0]
    r_in = ((hit - o).length if hit is not None else 0.055) + 0.005
    r_out = r_in + 0.03 + 0.03 * devant
    q = Vector((neck.x, neck.y, 0)) + d * r_out
    down = bvh.ray_cast(Vector((q.x, q.y, z_top + 0.12)), Vector((0, 0, -1)))[0]
    z_low = max(down.z if down is not None else neck.z - 0.02, z_top - 0.05 - 0.035 * devant) + 0.007
    z_low = min(z_low, z_top - 0.012)
    vs += [o + d * r_in, o + d * (r_in + 0.013) + Vector((0, 0, 0.005)), Vector((q.x, q.y, z_low))]
    u = CELL[0] + (CELL[2] - CELL[0]) * (0.03 + 0.94 * k / N)
    uv += [(u, CELL[1] + (CELL[3] - CELL[1]) * t) for t in (0.92, 0.6, 0.08)]
for k in range(N):
    a, b = 3 * k, 3 * k + 3
    fs += [(a, b, b + 1), (a, b + 1, a + 1), (a + 1, b + 1, b + 2), (a + 1, b + 2, a + 2)]
me = bpy.data.meshes.new("col")
me.from_pydata([tuple(v) for v in vs], [], fs)
uvl = me.uv_layers.new(name="UVMap").data
for p in me.polygons:
    for li, vi in zip(p.loop_indices, p.vertices):
        uvl[li].uv = uv[vi]
    p.use_smooth = True
import bmesh  # noqa: E402

bm = bmesh.new()
bm.from_mesh(me)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
if sum(f.normal.z for f in bm.faces) < 0:
    for f in bm.faces:
        f.normal_flip()
bm.to_mesh(me)
bm.free()
obj = bpy.data.objects.new("col", me)
bpy.context.scene.collection.objects.link(obj)
me.materials.append(bpy.data.materials.new("col"))
for o2 in bpy.context.scene.objects:
    o2.select_set(o2 == obj)
bpy.context.view_layer.objects.active = obj
bpy.ops.export_scene.gltf(filepath=out_glb, use_selection=True, export_format="GLB", export_animations=False,
                          export_skins=False, export_materials="PLACEHOLDER", export_vertex_color="NONE")
print("COL", out_glb, "triangles", len(fs))

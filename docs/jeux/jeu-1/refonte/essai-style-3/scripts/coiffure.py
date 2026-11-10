"""Coiffure encrée: coque anguleuse générée sur le crâne d'un corps conformé, d'après une fiche TOML.

Usage: duo-python coiffure.py <corps.blend> <fiche.toml> <sortie.glb> <donnees.npz>

La coque est une grille autour du crâne (colonnes autour de la tête, rangées du sommet vers l'ourlet).
Chaque point est posé par un rayon lancé sur la tête réelle, plus un volume: la coiffure va donc à toutes
les têtes. Les rangées du bas tombent à la verticale (rideau du carré) en restant hors des oreilles et de
la mâchoire. Les mèches sont des arêtes (section en étoile) et un ourlet en pointes: formes anguleuses de
bande dessinée, 300 à 500 triangles (bible 2.6). UV dans la cellule des cheveux de la bande A.
"""
import math
import sys
import tomllib

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
blend, fiche_path, out_glb, out_npz = args[:4]
f = tomllib.load(open(fiche_path, "rb"))
CELL = (0.75, 0.75, 1.0, 1.0)  # cellule des cheveux dans l'atlas (u0, v0, u1, v1), bande A à droite

bpy.ops.wm.open_mainfile(filepath=blend)
body = next(o for o in bpy.context.scene.objects if o.type == "MESH")
mw = body.matrix_world
mesh = body.data
head_tris = [[mw @ mesh.vertices[i].co for i in p.vertices] for p in mesh.polygons if p.material_index == 1]
verts, polys = [], []
for t in head_tris:
    polys.append([len(verts), len(verts) + 1, len(verts) + 2])
    verts.extend(t)
bvh = BVHTree.FromPolygons(verts, polys)
# Tout le corps aussi (épaules, cou) pour que le rideau ne rentre pas dans les épaules.
all_v = [mw @ v.co for v in mesh.vertices]
bvh_all = BVHTree.FromPolygons(all_v, [list(p.vertices) for p in mesh.polygons])

hv = np.array([[v.x, v.y, v.z] for v in verts])
top = hv[:, 2].max()
centre = Vector((0.0, float(np.median(hv[:, 1])), top - 0.11))
cols = f["colonnes"]
rows = f["rangees"]


def skull(theta, phi):
    """Point du crâne dans la direction (theta autour de Z, 0 = avant -Y; phi depuis le sommet)."""
    d = Vector((math.sin(theta) * math.sin(phi), -math.cos(theta) * math.sin(phi), math.cos(phi)))
    hit = bvh.ray_cast(centre + d * 0.5, -d)
    r = (hit[0] - centre).length if hit[0] is not None else 0.09
    return d, r


def extent(theta, z):
    """Distance horizontale de l'axe à la surface du corps (tête, cou, épaules) à la hauteur z."""
    d = Vector((math.sin(theta), -math.cos(theta), 0.0))
    o = Vector((0.0, centre.y, z))
    hit = bvh_all.ray_cast(o + d * 0.6, -d)
    return (hit[0] - o).length if hit[0] is not None else 0.0


def bottom_of(theta):
    """Ourlet de la colonne: angle depuis le sommet (front, côtés, dos) ou hauteur du rideau."""
    a = abs(math.atan2(math.sin(theta), math.cos(theta)))  # 0 devant, pi derrière
    if a < math.radians(f["largeur_frange_deg"]):
        return ("arc", math.radians(f["frange_deg"]))
    if f.get("rideau_z") is not None:
        return ("rideau", top - f["rideau_z"])
    k = (a - math.radians(f["largeur_frange_deg"])) / (math.pi - math.radians(f["largeur_frange_deg"]))
    return ("arc", math.radians(f["cotes_deg"] + (f["dos_deg"] - f["cotes_deg"]) * k))


grid = []
for j in range(cols + 1):
    theta = 2 * math.pi * (j % cols) / cols
    kind, lim = bottom_of(theta)
    ridge = 1.0 + f["aretes"] * (1 if j % 2 == 0 else -1)
    phi_end = lim if kind == "arc" else math.radians(100)
    # Profil: arc du crâne jusqu'à phi_end, puis chute verticale (rideau) jusqu'à lim.
    arc_pts = []
    for i in range(24):
        phi = phi_end * i / 23
        d, r = skull(theta, phi)
        vol = f["volume_haut"] + (f["volume_cotes"] - f["volume_haut"]) * min(phi / math.radians(90), 1.0)
        arc_pts.append(centre + d * (r + vol * (ridge if phi > 0.15 else 1.0)))
    pts = arc_pts
    if kind == "rideau":
        last = arc_pts[-1]
        horiz = Vector((last.x - 0, last.y - centre.y, 0.0))
        dirh = horiz.normalized()
        rad = horiz.length
        for i in range(1, 12):
            z = last.z + (lim - last.z) * i / 11
            need = extent(theta, z) + f["volume_cotes"] * 0.8
            rad = max(rad, need) + f["evase"] * (1 / 11)
            pts.append(Vector((dirh.x * rad, centre.y + dirh.y * rad, z)))
    # Rangées réparties à l'abscisse curviligne.
    seg = [0.0]
    for a, b in zip(pts, pts[1:]):
        seg.append(seg[-1] + (b - a).length)
    col = []
    for i in range(rows + 1):
        s = seg[-1] * i / rows
        k = max(n for n in range(len(seg)) if seg[n] <= s + 1e-9)
        k = min(k, len(pts) - 2)
        t = (s - seg[k]) / max(seg[k + 1] - seg[k], 1e-9)
        col.append(pts[k].lerp(pts[k + 1], t))
    # Ourlet en pointes: une colonne sur deux descend d'une longueur de mèche.
    if j % 2 == 0:
        tip = col[-1] - col[-2]
        col[-1] = col[-1] + tip.normalized() * f["pointes"]
    grid.append(col)

me = bpy.data.meshes.new("cheveux")
vs, fs, uvs = [], [], []
for j in range(cols + 1):
    for i in range(rows + 1):
        vs.append(grid[j][i])
idx = lambda j, i: j * (rows + 1) + i  # noqa: E731
for j in range(cols):
    for i in range(rows):
        if i == 0:
            fs.append((idx(j, 0), idx(j, 1), idx(j + 1, 1)))
        else:
            fs.append((idx(j, i), idx(j, i + 1), idx(j + 1, i + 1)))
            fs.append((idx(j, i), idx(j + 1, i + 1), idx(j + 1, i)))
me.from_pydata([tuple(v) for v in vs], [], fs)
uvl = me.uv_layers.new(name="UVMap").data
for p in me.polygons:
    for li, vi in zip(p.loop_indices, p.vertices):
        j, i = divmod(vi, rows + 1)
        uvl[li].uv = (CELL[0] + (CELL[2] - CELL[0]) * (0.01 + 0.98 * j / cols),
                      CELL[3] - (CELL[3] - CELL[1]) * (0.01 + 0.98 * i / rows))
me.update()
# Normales vers l'extérieur.
import bmesh  # noqa: E402

bm = bmesh.new()
bm.from_mesh(me)
for face in bm.faces:
    c = face.calc_center_median()
    if face.normal.dot(c - centre) < 0:
        face.normal_flip()
bm.to_mesh(me)
bm.free()
for p in me.polygons:
    p.use_smooth = True
obj = bpy.data.objects.new("cheveux", me)
bpy.context.scene.collection.objects.link(obj)
mat = bpy.data.materials.new("cheveux")
me.materials.append(mat)
for o in bpy.context.scene.objects:
    o.select_set(o == obj)
bpy.context.view_layer.objects.active = obj
bpy.ops.export_scene.gltf(filepath=out_glb, use_selection=True, export_format="GLB", export_animations=False,
                          export_skins=False, export_materials="PLACEHOLDER", export_vertex_color="NONE")
rows_data = []
uvl = me.uv_layers["UVMap"].data
nmat = me.corner_normals
for p in me.polygons:
    for li, vi in zip(p.loop_indices, p.vertices):
        j, i = divmod(vi, rows + 1)
        co = me.vertices[vi].co
        n = nmat[li].vector
        rows_data.append((*uvl[li].uv, co.x, co.y, co.z, n.x, n.y, n.z, j / cols, i / rows))
np.savez(out_npz, corners=np.array(rows_data, dtype=np.float32), centre=np.array(centre), top=top)
print("COIFFURE", f["id"], "triangles", len(fs), "sommets", len(vs))

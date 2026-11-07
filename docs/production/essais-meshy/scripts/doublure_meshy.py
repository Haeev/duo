"""Doublure d'une sortie brute de Meshy, pour éprouver la mise en conformité sans crédits.

Les fichiers de Meshy sont servis par assets.meshy.ai, refusé par le proxy de l'environnement
cloud le 2026-11-07: les scripts de conformité et de capture sont donc éprouvés sur cette doublure,
fabriquée avec les défauts attendus d'une sortie de génération: un seul maillage fait de pièces
séparées, une seule texture de couleur peinte (avec un éclairage et du grain dedans), une échelle
arbitraire, un pivot au centre et un avant qui ne regarde pas +Z.

Ce n'est pas une sortie de Meshy: la structure réelle de leurs fichiers reste à vérifier.

Usage: duo-python doublure_meshy.py <sortie.glb> [taille de la texture, 1024 par défaut]
"""

import math
import random
import sys

import bpy
import bmesh
from mathutils import Vector
from PIL import Image, ImageDraw

OUT = sys.argv[1]
TEX = int(sys.argv[2]) if len(sys.argv) > 2 else 1024
random.seed(7)

# Couleurs « peintes » par la génération: proches de la palette, sans y être exactement.
PAINT = {
    "body": (170, 98, 58),
    "tray": (172, 176, 180),
    "group": (160, 165, 170),
    "porta": (52, 54, 58),
    "drip": (80, 84, 90),
    "wand": (175, 178, 182),
    "gauge_ring": (196, 160, 92),
    "gauge_face": (240, 236, 226),
    "feet": (60, 62, 66),
}

bpy.ops.wm.read_factory_settings(use_empty=True)
bm = bmesh.new()
part_of_face = []


def add_box(name, x0, y0, z0, x1, y1, z1, bevel=0.0):
    """Boîte en coordonnées Blender (Z vers le haut), avant de la machine vers -Y."""
    before = set(bm.faces)
    res = bmesh.ops.create_cube(bm, size=1.0)
    verts = res["verts"]
    for v in verts:
        v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0), (y0 + y1) / 2 + v.co.y * (y1 - y0), (z0 + z1) / 2 + v.co.z * (z1 - z0)))
    if bevel > 0:
        edges = sorted({e for v in verts for e in v.link_edges}, key=lambda e: e.index)
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=3, affect="EDGES", profile=0.5)
    for f in set(bm.faces) - before:
        part_of_face.append((f, name))


def add_cyl(name, x, y, z, r, depth, axis="Z", segs=16):
    before = set(bm.faces)
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=depth)
    for v in res["verts"]:
        co = v.co.copy()
        if axis == "Y":
            co = Vector((co.x, co.z, co.y))
        v.co = co + Vector((x, y, z))
    for f in set(bm.faces) - before:
        part_of_face.append((f, name))


add_box("body", -0.38, -0.21, 0.04, 0.38, 0.21, 0.44, bevel=0.035)
add_box("tray", -0.36, -0.20, 0.44, 0.36, 0.20, 0.48, bevel=0.008)
for gx in (-0.18, 0.18):
    add_cyl("group", gx, -0.25, 0.30, 0.045, 0.08, axis="Y")
    add_cyl("porta", gx, -0.27, 0.25, 0.035, 0.04)
    add_box("porta", gx - 0.012, -0.44, 0.235, gx + 0.012, -0.27, 0.26, bevel=0.006)
add_box("drip", -0.34, -0.33, 0.04, 0.34, -0.21, 0.07, bevel=0.005)
add_cyl("wand", 0.33, -0.26, 0.23, 0.007, 0.22)
add_cyl("gauge_ring", 0.0, -0.215, 0.37, 0.04, 0.012, axis="Y")
add_cyl("gauge_face", 0.0, -0.223, 0.37, 0.032, 0.006, axis="Y")
for fx in (-0.33, 0.33):
    for fy in (-0.17, 0.17):
        add_cyl("feet", fx, fy, 0.02, 0.02, 0.04, segs=10)

bmesh.ops.triangulate(bm, faces=list(bm.faces))
mesh = bpy.data.meshes.new("Mesh_0")
names = {}
for f, name in part_of_face:
    if f.is_valid:
        names[f.index] = name
bm.to_mesh(mesh)
bm.free()
ob = bpy.data.objects.new("Mesh_0", mesh)
bpy.context.scene.collection.objects.link(ob)
bpy.context.view_layer.objects.active = ob
ob.select_set(True)

# Pièces par composante connexe (la triangulation garde la correspondance par îlot).
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.01)
bpy.ops.object.mode_set(mode="OBJECT")

# Couleur de chaque face: celle de la pièce dont elle vient (repérée par sa position).
def part_name(poly):
    c = poly.center
    best = None
    for name, test in (
        ("gauge_face", lambda: abs(c.x) < 0.033 and c.y < -0.218 and abs(c.z - 0.37) < 0.033),
        ("gauge_ring", lambda: abs(c.x) < 0.045 and c.y < -0.209 and abs(c.z - 0.37) < 0.045),
        ("wand", lambda: abs(c.x - 0.33) < 0.012 and c.y < -0.24),
        ("porta", lambda: c.y < -0.265 and 0.22 < c.z < 0.275 and abs(abs(c.x) - 0.18) < 0.04),
        ("group", lambda: c.y < -0.209 and 0.25 < c.z < 0.35 and abs(abs(c.x) - 0.18) < 0.05),
        ("drip", lambda: c.y < -0.205 and c.z < 0.075),
        ("feet", lambda: c.z < 0.041 and abs(c.x) > 0.3),
        ("tray", lambda: c.z > 0.437),
    ):
        if test():
            best = name
            break
    return best or "body"


img = Image.new("RGB", (TEX, TEX), (128, 128, 128))
draw = ImageDraw.Draw(img)
light = Vector((0.4, -0.6, 0.7)).normalized()
uv = mesh.uv_layers.active.data
for poly in mesh.polygons:
    base = PAINT[part_name(poly)]
    shade = 0.72 + 0.38 * max(0.0, poly.normal.dot(light))
    pts = [(uv[li].uv.x * TEX, (1.0 - uv[li].uv.y) * TEX) for li in poly.loop_indices]
    jitter = random.uniform(-10, 10)
    col = tuple(max(0, min(255, int(ch * shade + jitter))) for ch in base)
    draw.polygon(pts, fill=col)
# Grain fin, comme une texture générée.
px = img.load()
for _ in range(TEX * TEX // 6):
    x, y = random.randrange(TEX), random.randrange(TEX)
    r, g, b = px[x, y]
    d = random.randint(-14, 14)
    px[x, y] = (max(0, min(255, r + d)), max(0, min(255, g + d)), max(0, min(255, b + d)))
tex_path = OUT.replace(".glb", "_basecolor.png")
img.save(tex_path)

mat = bpy.data.materials.new("Material_0")
nodes = mat.node_tree.nodes
bsdf = nodes.get("Principled BSDF")
tex = nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(tex_path)
mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.6
mesh.materials.append(mat)

# Défauts d'une sortie brute: largeur ramenée à 1 unité, pivot au centre, avant vers +X glTF.
ob.scale = (1 / 0.76, 1 / 0.76, 1 / 0.76)
ob.location = (0.0, 0.0, -0.24 / 0.76)
ob.rotation_euler = (0.0, 0.0, math.radians(90))
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True, export_apply=True)
print(f"doublure: {len(mesh.polygons)} triangles, texture {TEX} px -> {OUT}")

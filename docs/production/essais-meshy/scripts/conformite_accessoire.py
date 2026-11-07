"""Mise en conformité d'un accessoire généré par Meshy (Blender 5.2 sans interface, duo-python).

Entrées: la fiche de génération de l'asset (section « conformity »), la sortie brute de Meshy (GLB),
la palette (JSON de cases de 4 px). Sortie: un GLB aux conventions du studio et un rapport JSON.

Ce que fait le script, dans l'ordre:
1. importe le GLB brut, fusionne ses maillages, applique les transformations, soude les sommets,
   retire faces dégénérées et sommets isolés, réoriente les faces retournées;
2. découpe le maillage en pièces (îlots de faces reliées par une arête: la topologie intelligente
   de Meshy rend des pièces séparées);
3. lit la texture de couleur de Meshy sous chaque face, donne à chaque face la case de palette la
   plus proche parmi celles que la fiche autorise (écart de clarté compté pour moitié: la texture
   contient un éclairage peint), puis donne à chaque pièce la case qui couvre le plus de son aire;
   la fiche peut forcer la case d'une pièce, ou garder la case de chaque face pour une pièce
   vraiment multicolore (`per_face_parts`);
4. pose les coordonnées de texture de chaque face au centre de sa case (une seule texture palette
   pour tous les modèles, filtrage au plus proche), remplace les matériaux par le matériau commun;
5. tourne l'avant vers +Z glTF (-Y dans Blender), met à l'échelle réelle d'après une cote de la
   fiche, pose le pivot au centre de la base;
6. lisse les normales sous un angle, cuit l'occlusion ambiante dans les couleurs de sommets
   (COLOR_0, multipliée à la palette par Three.js), exporte le GLB et écrit le rapport.

Usage:
  duo-python conformite_accessoire.py <fiche.json> <brut.glb> <palette.json> <sortie.glb> <rapport.json>
"""

import json
import math
import os
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from meshy_commun import Palette, apply_palette_uv, assign_cells, base_color_images, palette_material, split_parts  # noqa: E402

FICHE, RAW, PALETTE, OUT, REPORT = sys.argv[1:6]
with open(FICHE, encoding="utf-8") as fh:
    conf = json.load(fh)["conformity"]
palette = Palette(PALETTE, conf.get("palette_allowed"))

# --- Import et nettoyage ----------------------------------------------------------------------

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=RAW)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not meshes:
    raise SystemExit("aucun maillage dans le GLB brut")
raw_triangles = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
images = base_color_images(meshes)

for o in list(bpy.context.scene.objects):
    if o.type != "MESH":
        bpy.data.objects.remove(o, do_unlink=True)
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data

co = np.array([v.co[:] for v in me.vertices])
weld = 1e-5 * float(np.linalg.norm(co.max(axis=0) - co.min(axis=0)))
bm = bmesh.new()
bm.from_mesh(me)
count = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=weld)
merged = count - len(bm.verts)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_area() < 1e-12], context="FACES")
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
# Faces retournées: invisibles de face avec un matériau à une face, elles laissent voir l'intérieur
# de la pièce. Chaque îlot est réorienté vers l'extérieur.
bm.normal_update()
normals_before = {f: f.normal.copy() for f in bm.faces}
bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
bm.normal_update()
flipped = sum(1 for f in bm.faces if f.normal.dot(normals_before[f]) < 0)
# Les index ne suivent pas les suppressions ni les faces créées: les recompter avant de s'en servir.
bm.faces.index_update()
bm.faces.ensure_lookup_table()

# --- Pièces, couleurs et palette ------------------------------------------------------------------

parts, part_of = split_parts(bm)
mat_names = [m.name if m else "" for m in me.materials]
final, details = assign_cells(bm, parts, part_of, images, mat_names, palette, conf)
apply_palette_uv(bm, final, palette)
bm.to_mesh(me)
bm.free()
me.materials.clear()
mat, tex, bsdf = palette_material(palette)
me.materials.append(mat)
nt = mat.node_tree

# --- Orientation, échelle, pivot ---------------------------------------------------------------

me.transform(Matrix.Rotation(math.radians(conf.get("front_yaw_deg", 0.0)), 4, "Z"))
co = np.array([v.co[:] for v in me.vertices])
lo, hi = co.min(axis=0), co.max(axis=0)
extent = {"width": hi[0] - lo[0], "depth": hi[1] - lo[1], "height": hi[2] - lo[2]}
target = conf["target_size_m"]
scale = target["value"] / extent[target["axis"]]
me.transform(Matrix.Translation(Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))))
me.transform(Matrix.Scale(scale, 4))
me.update()

# Lissage sous un angle: courbes douces, arêtes franches.
me.set_sharp_from_angle(angle=math.radians(conf.get("smooth_angle_deg", 35)))
me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))

# --- Occlusion cuite dans les couleurs de sommets ------------------------------------------------

ao_note = "non cuite"
if conf.get("bake_ao", True):
    attr = me.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
    me.color_attributes.active_color = attr
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 64
    scene.world = bpy.data.worlds.new("monde")
    for o in bpy.context.scene.objects:
        o.select_set(o == ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    floor = conf.get("ao_floor", 0.55)
    data = np.empty(len(attr.data) * 4, dtype=np.float32)
    attr.data.foreach_get("color", data)
    data = data.reshape(-1, 4)
    data[:, :3] = floor + (1.0 - floor) * data[:, :3]
    attr.data.foreach_set("color", data.ravel())
    ca = nt.nodes.new("ShaderNodeVertexColor")
    ca.layer_name = attr.name
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    nt.links.new(tex.outputs["Color"], mix.inputs[6])
    nt.links.new(ca.outputs["Color"], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    ao_note = f"cuite (Cycles, 64 échantillons), ramenée à [{floor}, 1]"
else:
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

# --- Export et rapport ------------------------------------------------------------------------

name = conf["node_name"]
ob.name = name
me.name = name
triangles = sum(len(p.vertices) - 2 for p in me.polygons)
budget = conf.get("max_triangles")
for o in bpy.context.scene.objects:
    o.select_set(o == ob)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_animations=False,
    export_vertex_color="ACTIVE",
    export_image_format="AUTO",
    export_materials="EXPORT",
)
co = np.array([v.co[:] for v in me.vertices])
lo, hi = co.min(axis=0), co.max(axis=0)
report = {
    "asset": name,
    "raw": os.path.basename(RAW),
    "raw_triangles": raw_triangles,
    "triangles": triangles,
    "triangle_budget": budget,
    "within_budget": budget is None or triangles <= budget,
    "welded_vertices": merged,
    "flipped_faces_fixed": flipped,
    "parts": len(parts),
    "dimensions_m": {"width_x": round(float(hi[0] - lo[0]), 3), "depth_y_blender": round(float(hi[1] - lo[1]), 3), "height": round(float(hi[2] - lo[2]), 3)},
    "scale_applied": round(scale, 5),
    "front_yaw_deg": conf.get("front_yaw_deg", 0.0),
    "source_textures": [{"material": k, "image": v[3], "size": [v[1], v[2]]} for k, v in images.items()],
    "palette_cells_used": sorted(set(final.values())),
    "mixed_parts": [p["part"] for p in details if p.get("mixed")],
    "ambient_occlusion": ao_note,
    "file_bytes": os.path.getsize(OUT),
    "part_details": details,
}
with open(REPORT, "w", encoding="utf-8") as fh:
    json.dump(report, fh, ensure_ascii=False, indent=2)
    fh.write("\n")
print(f"{name}: {triangles} triangles ({'dans le' if report['within_budget'] else 'HORS'} budget de {budget}), {len(parts)} pièces, {report['file_bytes']} octets")

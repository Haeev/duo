"""Mise en conformité d'un accessoire généré par Meshy (Blender 5.2 sans interface, duo-python).

Entrées: la fiche de l'asset (section « conformity »), la sortie brute de Meshy (GLB), la palette
(JSON de cases de 4 px). Sortie: un GLB aux conventions du studio et un rapport JSON. Les étapes
suivent les règles imposées aux sorties de Meshy par la bible de Cosy Café (section 13.3):

1. import, fusion des maillages, transformations appliquées, soudure, faces dégénérées et sommets
   isolés retirés, faces retournées réorientées vers l'extérieur;
2. budget (règle 1): décimation si le maillage dépasse le plafond de la fiche;
3. couleurs (règle 2): la texture de Meshy est lue sous chaque face puis jetée; chaque face prend
   la case de palette la plus proche (CIEDE2000, poids de clarté `lightness_weight`) parmi les cases
   permises; par défaut la case gagnante à l'aire de chaque pièce (îlot de faces) l'emporte pour
   toute la pièce, sinon case par face (`per_face_parts`, `per_face_all`, lissage `face_smoothing`);
   une seule couleur par face, coordonnées de texture au centre de la case;
4. échelle et repère (règle 3): avant tourné vers +Z glTF (-Y dans Blender), cote réelle de la
   fiche, origine au centre de l'emprise au sol;
5. formes (règle 4): symétrie rétablie sur demande, faces du dessous posé retirées, chanfrein
   optionnel, pièces de moins de 1 cm et pièces qui flottent signalées dans le rapport;
6. normales lissées sous un angle, occlusion cuite dans les couleurs de sommets (COLOR_0),
   export GLB et rapport.

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
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from meshy_commun import Palette, apply_palette_uv, assign_cells, base_color_images, palette_material, split_parts  # noqa: E402

FICHE, RAW, PALETTE, OUT, REPORT = sys.argv[1:6]
with open(FICHE, encoding="utf-8") as fh:
    conf = json.load(fh)["conformity"]
palette = Palette(PALETTE, conf.get("palette_allowed"), kl=conf.get("lightness_weight", 2.0))
budget = conf.get("max_triangles")


def tri_count(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


# --- 1. Import et nettoyage ------------------------------------------------------------------

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=RAW)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not meshes:
    raise SystemExit("aucun maillage dans le GLB brut")
raw_triangles = sum(tri_count(o.data) for o in meshes)
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
bm.to_mesh(me)
bm.free()

# --- 2. Budget --------------------------------------------------------------------------------

decimated_from = None
if budget and tri_count(me) > budget:
    decimated_from = tri_count(me)
    mod = ob.modifiers.new("decimation", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = 0.98 * budget / decimated_from
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)

# --- 3. Couleurs de palette -------------------------------------------------------------------

bm = bmesh.new()
bm.from_mesh(me)
bm.faces.index_update()
bm.faces.ensure_lookup_table()
parts, part_of = split_parts(bm)
final, details, color_stats = assign_cells(bm, parts, part_of, images, [m.name if m else "" for m in me.materials], palette, conf)
apply_palette_uv(bm, final, palette)
bm.to_mesh(me)
bm.free()
me.materials.clear()
mat, tex, bsdf = palette_material(palette)
me.materials.append(mat)
nt = mat.node_tree

# --- 4. Orientation, échelle, pivot --------------------------------------------------------------

me.transform(Matrix.Rotation(math.radians(conf.get("front_yaw_deg", 0.0)), 4, "Z"))
co = np.array([v.co[:] for v in me.vertices])
lo, hi = co.min(axis=0), co.max(axis=0)
extent = {"width": hi[0] - lo[0], "depth": hi[1] - lo[1], "height": hi[2] - lo[2]}
target = conf["target_size_m"]
scale = target["value"] / extent[target["axis"]]
me.transform(Matrix.Translation(Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))))
me.transform(Matrix.Scale(scale, 4))
me.update()

# --- 5. Formes ----------------------------------------------------------------------------------

bm = bmesh.new()
bm.from_mesh(me)
symmetry = conf.get("symmetrize")
if symmetry:
    # « x+ »: le côté +X (droite vue de face) est recopié à gauche; « x- »: l'inverse.
    direction = "POSITIVE_X" if symmetry == "x+" else "NEGATIVE_X"
    bmesh.ops.symmetrize(bm, input=bm.verts[:] + bm.edges[:] + bm.faces[:], direction=direction, dist=1e-4)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
removed_bottom = 0
if conf.get("remove_bottom_faces", True):
    # Dessous posé: faces tournées vers le bas, au ras de la base (invisibles une fois posé).
    bm.normal_update()
    bottom = [f for f in bm.faces if f.normal.z < -0.95 and all(v.co.z < 0.003 for v in f.verts)]
    removed_bottom = len(bottom)
    bmesh.ops.delete(bm, geom=bottom, context="FACES_ONLY")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
bm.to_mesh(me)
bm.free()
if conf.get("bevel_m"):
    mod = ob.modifiers.new("chanfrein", "BEVEL")
    mod.width = conf["bevel_m"]
    mod.segments = conf.get("bevel_segments", 1)
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(conf.get("bevel_angle_deg", 40))
    mod.harden_normals = False
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    bm.to_mesh(me)
    bm.free()

# Contrôles de forme sur les pièces finales: épaisseur sous 1 cm, pièce qui ne touche rien.
bm = bmesh.new()
bm.from_mesh(me)
bm.faces.index_update()
bm.faces.ensure_lookup_table()
final_parts, _ = split_parts(bm)
thin, floating = [], []
trees = []
for members in final_parts:
    verts = sorted({v for f in members for v in f.verts}, key=lambda v: v.index)
    idx = {v.index: i for i, v in enumerate(verts)}
    trees.append((BVHTree.FromPolygons([v.co.copy() for v in verts], [[idx[v.index] for v in f.verts] for f in members]), verts))
for i, members in enumerate(final_parts):
    pts = np.array([v.co[:] for v in trees[i][1]])
    size = pts.max(axis=0) - pts.min(axis=0)
    center = [round(float(x), 3) for x in (pts.max(axis=0) + pts.min(axis=0)) / 2]
    if size.min() < 0.01:
        thin.append({"center_m": center, "smallest_size_m": round(float(size.min()), 4), "triangles": len(members)})
    if pts[:, 2].min() < 0.003 or len(final_parts) == 1:
        continue
    touching = False
    gap = float("inf")
    for j, (tree, _) in enumerate(trees):
        if j == i:
            continue
        if trees[i][0].overlap(tree):
            touching = True
            break
        for p in pts:
            hit = tree.find_nearest(Vector(p))
            if hit[0] is not None:
                gap = min(gap, hit[3])
        if gap <= 0.002:
            touching = True
            break
    if not touching:
        floating.append({"center_m": center, "gap_m": round(gap, 4), "triangles": len(members)})
bm.free()

# Lissage sous un angle: courbes douces, arêtes franches.
me.set_sharp_from_angle(angle=math.radians(conf.get("smooth_angle_deg", 35)))
me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))

# --- 6. Occlusion cuite, export et rapport ---------------------------------------------------------

ao_note = "non cuite"
# Couleurs de sommets d'origine (une sortie déjà conformée en porte): remplacées par l'occlusion.
for old_attr in list(me.color_attributes):
    me.color_attributes.remove(old_attr)
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

name = conf["node_name"]
ob.name = name
me.name = name
triangles = tri_count(me)
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
    export_all_vertex_colors=False,
    export_image_format="AUTO",
    export_materials="EXPORT",
)
co = np.array([v.co[:] for v in me.vertices])
lo, hi = co.min(axis=0), co.max(axis=0)
report = {
    "asset": name,
    "raw": os.path.basename(RAW),
    "raw_triangles": raw_triangles,
    "decimated_from": decimated_from,
    "triangles": triangles,
    "triangle_budget": budget,
    "within_budget": budget is None or triangles <= budget,
    "welded_vertices": merged,
    "flipped_faces_fixed": flipped,
    "bottom_faces_removed": removed_bottom,
    "symmetrized": symmetry,
    "bevel_m": conf.get("bevel_m"),
    "parts": len(parts),
    "dimensions_m": {"width_x": round(float(hi[0] - lo[0]), 3), "depth_y_blender": round(float(hi[1] - lo[1]), 3), "height": round(float(hi[2] - lo[2]), 3)},
    "scale_applied": round(scale, 5),
    "front_yaw_deg": conf.get("front_yaw_deg", 0.0),
    "source_textures": [{"material": k, "image": v[3], "size": [v[1], v[2]]} for k, v in images.items()],
    "palette_rule": f"CIEDE2000, poids de clarté {palette.kl}, cases permises {palette.allowed}",
    "palette_cells_used": sorted(set(final.values())),
    "mixed_parts": [p["part"] for p in details if p.get("mixed")],
    "color_stats": color_stats,
    "parts_under_1cm": thin,
    "floating_parts": floating,
    "ambient_occlusion": ao_note,
    "file_bytes": os.path.getsize(OUT),
    "part_details": details,
}
with open(REPORT, "w", encoding="utf-8") as fh:
    json.dump(report, fh, ensure_ascii=False, indent=2)
    fh.write("\n")
print(f"{name}: {triangles} triangles ({'dans le' if report['within_budget'] else 'HORS'} budget de {budget}), {len(parts)} pièces, "
      f"{len(thin)} sous 1 cm, {len(floating)} qui flottent, {report['file_bytes']} octets")

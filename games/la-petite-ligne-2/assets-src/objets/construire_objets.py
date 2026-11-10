"""Fabrique les objets de La Petite Ligne depuis `gabarits.toml` (Blender par `duo-python`).

Usage: duo-python construire_objets.py <dossier des GLB> [--blend fichier.blend]
Sorties: un GLB par famille (`<famille>.glb`, un nœud par objet et son enfant `<id>--grip`) et
`index.json` (fichier, nœud, taille, prise, triangles de chaque objet), lu par la visionneuse.
"""
import json
import math
import os
import sys
import tempfile
import tomllib

import bpy  # noqa: E402  (bpy avant bmesh)
import bmesh  # noqa: E402

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
from familles import BUILDERS  # noqa: E402

OUT = os.path.abspath(sys.argv[1])
BLEND = sys.argv[sys.argv.index("--blend") + 1] if "--blend" in sys.argv else None
os.makedirs(OUT, exist_ok=True)
TMP = tempfile.mkdtemp(prefix="objets-atlas-")  # PNG intermédiaires, emballés dans les GLB

with open(os.path.join(ICI, "gabarits.toml"), "rb") as fh:
    G = tomllib.load(fh)
with open(os.path.join(ICI, "..", "personnages", "nuancier.json"), encoding="utf-8") as fh:
    NUANCIER = json.load(fh)


def palette():
    """Nom -> couleur hexadécimale. Ordre: tissus, fixes, cheveux, couleurs d'Aubrune, peaux
    (le premier nom l'emporte; `peaux.noisette` reste joignable par son nom qualifié)."""
    out = {}
    for fam in ("tissus", "fixes", "cheveux", "cheveux_joueurs"):
        for name, hexa in NUANCIER.get(fam, []):
            out.setdefault(name, hexa)
            out[f"{fam}.{name}"] = hexa
    for name, hexa in G["couleurs_lieu"].items():
        out.setdefault(name, hexa)
    for name, hexa in NUANCIER.get("peaux", []):
        out.setdefault(name, hexa)
        out[f"peaux.{name}"] = hexa
    return out


PAL = palette()


def srgb(hexa):
    return tuple(int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5)) + (1.0,)


def material():
    mat = bpy.data.materials.get("objet")
    if mat:
        return mat
    mat = bpy.data.materials.new("objet")
    mat.use_backface_culling = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = 0.75
    attr = mat.node_tree.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Color"
    mat.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def build(spec):
    fam = G["familles"][spec["famille"]]
    colors = dict(fam.get("defaut", {}))
    colors.update(spec.get("couleurs", {}))
    for key, name in colors.items():
        if name not in PAL:
            raise SystemExit(f"{spec['id']}: couleur « {name} » ({key}) hors du nuancier")
    parts, grip = BUILDERS[spec["famille"]](spec, colors)
    verts = [v for p in parts for v in p.verts]
    lo = [min(v[k] for v in verts) for k in range(3)]
    hi = [max(v[k] for v in verts) for k in range(3)]
    s = spec["taille"] / max(hi[k] - lo[k] for k in range(3))
    cx, cy = (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2
    for p in parts:
        p.map(lambda v: ((v[0] - cx) * s, (v[1] - cy) * s, (v[2] - lo[2]) * s))
    if grip is None:
        grip = ((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2)
    grip = ((grip[0] - cx) * s, (grip[1] - cy) * s, (grip[2] - lo[2]) * s)
    return parts, grip, colors


def to_object(oid, parts):
    me = bpy.data.meshes.new(oid)
    verts, faces, cols = [], [], []
    for p in parts:
        base = len(verts)
        verts += p.verts
        faces += [tuple(i + base for i in f) for f in p.faces]
        cols += p.colors
    me.from_pydata(verts, [], faces)
    me.validate()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    me.set_sharp_from_angle(angle=math.radians(70))
    o = bpy.data.objects.new(oid, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(material())
    return o


def paint(o, parts):
    """Couleur de coin par face, retrouvée par la pièce d'origine (centre le plus proche)."""
    from mathutils.kdtree import KDTree
    centers = []
    for p in parts:
        for f, c in zip(p.faces, p.colors):
            pts = [p.verts[i] for i in f]
            # triangulation en éventail: un centre par triangle, mêmes couleurs
            for k in range(1, len(pts) - 1):
                tri = (pts[0], pts[k], pts[k + 1])
                centers.append((tuple(sum(q[j] for q in tri) / 3 for j in range(3)), c))
    kd = KDTree(len(centers))
    for i, (ctr, _) in enumerate(centers):
        kd.insert(ctr, i)
    kd.balance()
    me = o.data
    attr = me.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
    me.color_attributes.active_color = attr
    data = []
    for poly in me.polygons:
        _, idx, _ = kd.find(poly.center)
        col = srgb(PAL[centers[idx][1]])
        data += list(col) * poly.loop_total
    attr.data.foreach_set("color_srgb", data)


CELL = 256  # pixels par objet dans l'atlas de sa famille (plafond du brief)
MARGIN = 6  # marge intérieure d'une case, en pixels (mipmaps sans débordement)


def unwrap(o):
    """UV propres par projection intelligente (îlots à plat, marge), dans [0, 1]."""
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    o.data.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.03, area_weight=0.0, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode="OBJECT")


def atlas(fam, objs):
    """Range chaque objet dans sa case de l'atlas de la famille et peint la texture provisoire:
    les couleurs unies des pièces, posées dans les îlots UV (bordées de 2 px contre les fuites).
    L'atlas remplace les couleurs de sommets: une texture peinte la remplacera objet par objet."""
    from PIL import Image, ImageDraw
    n = math.ceil(math.sqrt(len(objs)))
    size = n * CELL
    img = Image.new("RGB", (size, size), (128, 128, 128))
    draw = ImageDraw.Draw(img)
    for k, (o, _) in enumerate(objs):
        col, row = k % n, k // n
        me = o.data
        uv = me.uv_layers["UVMap"].data
        cols = me.color_attributes["Color"].data
        x0, y0 = col * CELL + MARGIN, row * CELL + MARGIN
        span = CELL - 2 * MARGIN
        first = tuple(int(round(c * 255)) for c in cols[0].color_srgb[:3])
        draw.rectangle([col * CELL, row * CELL, col * CELL + CELL - 1, row * CELL + CELL - 1], fill=first)
        for poly in me.polygons:
            pts = []
            for li in poly.loop_indices:
                u, v = uv[li].uv
                px, py = x0 + u * span, y0 + (1 - v) * span
                uv[li].uv = (px / size, 1 - py / size)
                pts.append((px, py))
            rgb = tuple(int(round(c * 255)) for c in cols[poly.loop_indices[0]].color_srgb[:3])
            draw.polygon(pts, fill=rgb, outline=rgb, width=2)
        me.color_attributes.remove(me.color_attributes["Color"])
    path = os.path.join(TMP, f"{fam}.png")
    img.save(path)
    image = bpy.data.images.load(path)
    image.pack()
    mat = bpy.data.materials.new(f"objet-{fam}")
    mat.use_backface_culling = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = 0.75
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = image
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    for o, _ in objs:
        o.data.materials.clear()
        o.data.materials.append(mat)
    return size


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    seen = set()
    by_family, index = {}, {}
    for spec in G["objets"]:
        oid = spec["id"]
        if oid in seen:
            raise SystemExit(f"identifiant en double: {oid}")
        seen.add(oid)
        if spec["famille"] not in BUILDERS:
            raise SystemExit(f"{oid}: famille inconnue {spec['famille']}")
        parts, grip, colors = build(spec)
        o = to_object(oid, parts)
        paint(o, parts)
        unwrap(o)
        e = bpy.data.objects.new(f"{oid}--grip", None)
        e.empty_display_size = 0.02
        bpy.context.scene.collection.objects.link(e)
        e.parent = o
        e.location = grip
        by_family.setdefault(spec["famille"], []).append((o, e))
        bb = [o.matrix_world @ v.co for v in o.data.vertices]
        size = [max(v[k] for v in bb) - min(v[k] for v in bb) for k in range(3)]
        index[oid] = {
            "file": f"{spec['famille']}.glb",
            "node": oid,
            "family": spec["famille"],
            # glTF: (x, z, -y) de Blender
            "size": [round(size[0], 4), round(size[2], 4), round(size[1], 4)],
            "grip": [round(grip[0], 4), round(grip[2], 4), round(-grip[1], 4)],
            "triangles": len(o.data.polygons),
            "colors": sorted({colors[k] for k in colors}),
        }
    files = {}
    atlases = {}
    for fam, objs in by_family.items():
        atlases[fam] = atlas(fam, objs)
        bpy.ops.object.select_all(action="DESELECT")
        for o, e in objs:
            o.select_set(True)
            e.select_set(True)
        path = os.path.join(OUT, f"{fam}.glb")
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
                                  export_vertex_color="NONE", export_materials="EXPORT", export_image_format="AUTO",
                                  export_texcoords=True, export_normals=True, export_animations=False)
        files[fam] = os.path.getsize(path)
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as fh:
        for entry in index.values():
            entry["atlas"] = atlases[entry["family"]]
        json.dump({"schema": 1, "objects": index}, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    if BLEND:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BLEND))
    print("OBJETS", json.dumps({"objets": len(index), "fichiers": files}, ensure_ascii=False))


main()

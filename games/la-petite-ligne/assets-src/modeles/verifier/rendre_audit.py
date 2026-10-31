"""Audit visuel des GLB (repris du script du directeur artistique): quatre vues de près de chaque nœud
racine (iso avant, iso arrière, profil rasant, perspective plongeante) en rendu Workbench avec cavités,
et un rapport des contrôles simples: faces inversées, arêtes ouvertes, îlots isolés qui ne touchent
aucune autre pièce (pièces qui flottent).

Lancer: duo-python verifier/rendre_audit.py <sortie> [fichier ...]   (fichier sans .glb: bourg, ferme, ...)
Défaut: tous les GLB du dossier des modèles. Produit <sortie>/<fichier>__<nœud>__<vue>.png, une planche
<sortie>/<fichier>__<nœud>.png (les 4 vues côte à côte) et <sortie>/<fichier>.json (rapport).
"""
import json
import math
import os
import sys

import bpy  # noqa: I001
import bmesh
from mathutils import Vector

ICI = os.path.dirname(os.path.abspath(__file__))
MODELES = os.path.normpath(os.path.join(ICI, "..", "..", "..", "assets", "modeles"))
VUES = [("a", 45, 35, "ORTHO", 1.0), ("b", 225, 35, "ORTHO", 1.0), ("c", 110, 8, "ORTHO", 1.0), ("d", 315, 45, "PERSP", 0.55)]


def tree(o):
    r = [o]
    for c in o.children:
        r += tree(c)
    return r


def bbox(objs):
    mn, mx = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in objs:
        if o.type != "MESH":
            continue
        for v in o.bound_box:
            w = o.matrix_world @ Vector(v)
            mn, mx = Vector(map(min, mn, w)), Vector(map(max, mx, w))
    return mn, mx


def controles(meshes):
    flips = bords = 0
    iles = []
    for o in meshes:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.transform(o.matrix_world)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=2e-4)
        bords += sum(1 for e in bm.edges if e.is_boundary)
        n0 = [f.normal.copy() for f in bm.faces]
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        flips += sum(1 for f, n in zip(bm.faces, n0) if f.normal.dot(n) < -0.5)
        bm.verts.ensure_lookup_table()
        seen = set()
        for v in bm.verts:
            if v.index in seen:
                continue
            pile, pts = [v], []
            while pile:
                x = pile.pop()
                if x.index in seen:
                    continue
                seen.add(x.index)
                pts.append(x.co.copy())
                for e in x.link_edges:
                    pile.append(e.other_vert(x))
            a = Vector(map(min, *pts)) if len(pts) > 1 else pts[0].copy()
            b = Vector(map(max, *pts)) if len(pts) > 1 else pts[0].copy()
            iles.append((a, b, o.name))
        bm.free()
    flott, tol = [], 0.012
    for i, (a, b, n) in enumerate(iles):
        if a.z <= tol:
            continue
        if not any(i != j and all(a[k] <= b2[k] + tol and a2[k] <= b[k] + tol for k in range(3))
                   for j, (a2, b2, _) in enumerate(iles)):
            flott.append((n, round(a.z, 3)))
    return {"faces_inversees": flips, "aretes_ouvertes": bords, "iles": len(iles), "iles_isolees": flott[:8],
            "nb_isolees": len(flott)}


def auditer(fichier, sortie):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELES, fichier + ".glb"))
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light, sh.color_type, sh.show_shadows, sh.show_cavity, sh.cavity_type = "STUDIO", "TEXTURE", True, True, "WORLD"
    sh.show_backface_culling = True
    sh.background_type, sh.background_color = "VIEWPORT", (0.82, 0.84, 0.78)
    sc.render.resolution_x = sc.render.resolution_y = 360
    for mat in bpy.data.materials:
        nt = mat.node_tree
        if nt is None:
            continue
        bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf and bsdf.inputs["Base Color"].is_linked:
            src = bsdf.inputs["Base Color"].links[0].from_node
            while src.type != "TEX_IMAGE" and src.inputs and any(i.is_linked for i in src.inputs):
                src = next(i for i in src.inputs if i.is_linked).links[0].from_node
            if src.type == "TEX_IMAGE":
                nt.nodes.active = src
    roots = [o for o in sc.objects if o.parent is None]
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0))
    sol = bpy.context.object
    m = bpy.data.materials.new("sol")
    m.diffuse_color = (0.62, 0.7, 0.5, 1)
    sol.data.materials.append(m)
    cam_d = bpy.data.cameras.new("c")
    cam = bpy.data.objects.new("c", cam_d)
    sc.collection.objects.link(cam)
    sc.camera = cam
    rapport = {}
    for r in roots:
        objs = tree(r)
        meshes = [o for o in objs if o.type == "MESH"]
        if not meshes:
            continue
        for o in sc.objects:
            o.hide_render = not (o in objs or o == sol or o == cam)
        mn, mx = bbox(objs)
        c, size = (mn + mx) / 2, max((mx - mn).length, 0.3)
        info = {"min_z": round(mn.z, 3), "taille": [round(x, 2) for x in (mx - mn)]}
        info.update(controles(meshes))
        rapport[r.name] = info
        images = []
        for nom, yaw, el, typ, z in VUES:
            cam_d.type = typ
            d = Vector((math.cos(math.radians(el)) * math.sin(math.radians(yaw)),
                        -math.cos(math.radians(el)) * math.cos(math.radians(yaw)), math.sin(math.radians(el))))
            if typ == "ORTHO":
                cam_d.ortho_scale = size * 1.05
                cam.location = c + d * size * 3
            else:
                cam_d.lens = 35
                cam.location = c + d * size * z * 1.6
            cam_d.clip_end, cam_d.clip_start = size * 20, 0.01
            cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
            f = os.path.join(sortie, f"{fichier}__{r.name}__{nom}.png")
            sc.render.filepath = f
            bpy.ops.render.render(write_still=True)
            images.append(f)
        try:
            from PIL import Image
            ims = [Image.open(f) for f in images]
            planche = Image.new("RGB", (sum(i.width for i in ims), max(i.height for i in ims)), (244, 239, 230))
            x = 0
            for im in ims:
                planche.paste(im, (x, 0))
                x += im.width
            planche.save(os.path.join(sortie, f"{fichier}__{r.name}.png"))
        except ImportError:
            pass
    with open(os.path.join(sortie, f"{fichier}.json"), "w", encoding="utf-8") as fh:
        json.dump(rapport, fh, indent=1, ensure_ascii=False)
    return rapport


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    args = [a for a in args if not a.endswith(".py")]
    sortie = os.path.abspath(args[0])
    os.makedirs(sortie, exist_ok=True)
    fichiers = args[1:] or sorted(f[:-4] for f in os.listdir(MODELES) if f.endswith(".glb"))
    for f in fichiers:
        rap = auditer(f, sortie)
        isoles = {k: v["nb_isolees"] for k, v in rap.items() if v["nb_isolees"]}
        inv = {k: v["faces_inversees"] for k, v in rap.items() if v["faces_inversees"]}
        print(f"AUDIT {f}: {len(rap)} nœuds, îlots isolés {isoles}, faces inversées {inv}")


main()

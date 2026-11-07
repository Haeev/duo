"""Production d'un lot de modèles du catalogue: construction, occlusion cuite, export GLB, fiche JSON."""

import json
import math
import os
import time
import zlib

import bpy
from mathutils import Vector

import commun as K
from geo import Geo

SPACING = 4.0


def _socket(name, loc_plan, extras):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.05
    e.location = K.P(*loc_plan)
    bpy.context.scene.collection.objects.link(e)
    for k, v in extras.items():
        e[k] = v
    return e


def to_gltf(x, y, z):
    """Point du plan (repère du modèle) -> repère glTF du modèle."""
    return [round(x, 4), round(z, 4), round(y, 4)]


def dir_gltf(dx, dy):
    return [round(dx, 4), 0.0, round(dy, 4)]


def produire(catalogue, ids, fiche_path, ao=True):
    t0 = time.time()
    K.vider_scene()
    built = []
    for i, ident in enumerate(ids):
        spec = catalogue[ident]
        g = Geo(ident)
        info = spec["fn"](g) or {}
        ob = K.finir(g, seed=zlib.crc32(ident.encode()))
        parts = K.separer_par_materiau(ob)
        main = next(o for o in parts if o.name == ident)
        built.append((ident, spec, info, parts, main))
    # pose en grille pour l'occlusion (sol sous les meubles posés)
    planes = []
    for i, (ident, spec, info, parts, main) in enumerate(built):
        off = Vector(((i % 10) * SPACING, -(i // 10) * SPACING, 0))
        for o in parts:
            o.location = off
        if spec["accroche"] == "sol":
            bpy.ops.mesh.primitive_plane_add(size=2.5, location=off)
            planes.append(bpy.context.active_object)
        elif spec["accroche"] == "mur":
            bpy.ops.mesh.primitive_plane_add(size=2.5, location=off + Vector((0, 0.0, 0.6)), rotation=(math.pi / 2, 0, 0))
            planes.append(bpy.context.active_object)
        elif spec["accroche"] == "plafond":
            bpy.ops.mesh.primitive_plane_add(size=2.5, location=off, rotation=(math.pi, 0, 0))
            planes.append(bpy.context.active_object)
    bpy.context.view_layer.update()
    meshes = [o for (_, _, _, parts, _) in built for o in parts]
    if ao:
        bake = [o for o in meshes if o.data.materials and o.data.materials[0].name == "dt_meubles"]
        K.cuire_ao(bake)
        K.ao_blanc([o for o in meshes if o not in bake])
    else:
        K.ao_blanc(meshes)
    for p in planes:
        bpy.data.objects.remove(p, do_unlink=True)
    fiches = {}
    for i, (ident, spec, info, parts, main) in enumerate(built):
        off = parts[0].location.copy()
        for o in parts:
            o.location = (0, 0, 0)
        bpy.context.view_layer.update()
        sockets = []
        extras = {"id": ident, "style": spec["style"], "category": spec["categorie"], "mount": spec["accroche"], "front": [0, 0, 1]}
        for j, s in enumerate(info.get("seats", [])):
            sockets.append(_socket(f"socket_seat_{j}", (s["x"], s["y"], s["z"]), {"front": dir_gltf(*s["avant"])}))
        if "top" in info:
            extras["top_height"] = info["top"]["z"]
        for j, s in enumerate(info.get("sockets", [])):
            sockets.append(_socket(f"socket_{s['name']}", (s["x"], s["y"], s["z"]), {}))
        objs = parts + sockets
        for sk in sockets:
            sk.parent = main
        path = os.path.join(K.ASSETS, f"{ident}.glb")
        size = K.exporter_glb(objs, path, extras=extras)
        dims = K.gltf_dims(parts)
        tri = sum(K.tris(o) for o in parts)
        f = {
            "id": ident,
            "nom": spec.get("nom", ""),
            "fichier": f"{ident}.glb",
            "famille": "meuble" if ident.startswith("furn_") else ident.split("_")[0],
            "style": spec["style"],
            "categorie": spec["categorie"],
            "accroche": spec["accroche"],
            "dimensions_m": {"x": dims[0], "y": dims[1], "z": dims[2]},
            "triangles": tri,
            "budget_triangles": spec["budget"],
            "dans_budget": tri <= spec["budget"],
            "materiaux": sorted({o.data.materials[0].name for o in parts}),
            "noeuds": sorted(o.name for o in parts),
            "poids_octets": size,
            "avant": [0, 0, 1],
        }
        if info.get("seats"):
            f["assises"] = [{"position": to_gltf(s["x"], s["y"], s["z"]), "avant": dir_gltf(*s["avant"])} for s in info["seats"]]
        if "top" in info:
            t = info["top"]
            f["pose_dessus"] = {"hauteur": t["z"], "forme": t["forme"], "largeur_x": t["w"], "profondeur_z": t["d"]}
            f["places"] = info.get("places")
        if "surfaces" in info:
            f["pose_dessus"] = [{"hauteur": s["z"], "largeur_x": s["w"], "profondeur_z": s["d"], "centre_z": s["y"]} for s in info["surfaces"]]
        if "lumiere" in info:
            f["lumiere"] = to_gltf(0, 0, info["lumiere"]["z"])
        for k in ("note", "meshy", "points", "vide", "contenu", "usage"):
            if k in info:
                f[k] = info[k]
        if info.get("sockets"):
            f["douilles"] = {f"socket_{s['name']}": to_gltf(s["x"], s["y"], s["z"]) for s in info["sockets"]}
        fiches[ident] = f
        for o in parts:
            o.location = off
        for sk in sockets:
            bpy.data.objects.remove(sk, do_unlink=True)
    old = {}
    if os.path.exists(fiche_path):
        old = json.load(open(fiche_path))
    old.update(fiches)
    os.makedirs(os.path.dirname(fiche_path), exist_ok=True)
    with open(fiche_path, "w") as fh:
        json.dump(old, fh, ensure_ascii=False, indent=1)
    blend = os.path.splitext(fiche_path)[0] + ".blend"
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    print(f"{len(ids)} modèles en {time.time() - t0:.0f} s")
    for ident, f in fiches.items():
        print(f"{ident}: {f['triangles']} tri (budget {f['budget_triangles']}), {f['dimensions_m']}, {f['poids_octets']} o")
    return fiches

"""Fabrique tous les décors depuis gabarits.toml: GLB par fichier, manifeste des accroches.

Usage: duo-python construire_decors.py <dossier des GLB> [identifiant ...]
Chaque entrée `[[modeles]]` devient un nœud racine nommé par son `id` (origine au centre de
l'emprise, au sol). Une maison a deux enfants, `<id>_walls` et `<id>_roof`, pour le fondu du toit.
Le manifeste `decors.json` (même dossier) donne pour chaque modèle: fichier, emprise, hauteur,
triangles, accroches (assise, plateau, couchage, portes) et collision simple. Repère du manifeste:
celui du jeu (x est, y sud, en mètres depuis l'origine du modèle), comme les cartes.
"""
import json
import math
import os
import sys
import tomllib

import bpy

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)

from formes import Modele, bornes, triangles  # noqa: E402
from familles import FAMILLES  # noqa: E402
from maison import maison  # noqa: E402


def lire_gabarits():
    with open(os.path.join(ICI, "gabarits.toml"), "rb") as f:
        g = tomllib.load(f)
    couleurs = dict(g["couleurs"])
    with open(os.path.join(ICI, "..", "personnages", "nuancier.json"), encoding="utf-8") as f:
        nuancier = json.load(f)
    # Les tissus des personnages servent aussi aux décors (rideaux, coussins, stores).
    for nom, code in nuancier["tissus"]:
        couleurs.setdefault(nom, code)
    return g, couleurs


def vider_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for me in list(bpy.data.meshes):
        bpy.data.meshes.remove(me)


def materiau():
    mat = bpy.data.materials.get("decor") or bpy.data.materials.new("decor")
    mat.use_backface_culling = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.8
    return mat


def construire(entree, defauts, couleurs, coll, mat):
    ident = entree["id"]
    fam = entree["famille"]
    p = {**defauts.get(fam, {}), **entree}
    slots = {**defauts.get("couleurs", {}), **defauts.get(fam, {}).get("couleurs", {}), **entree.get("couleurs", {})}

    def c(slot):
        nom = slots.get(slot, slot)
        zone = slot if slot in ("bois", "peinture", "tissu", "metal") else "fixe"
        return nom, zone

    racine = bpy.data.objects.new(ident, None)
    coll.objects.link(racine)
    enfants = []
    if fam == "maison":
        mm, mt = Modele(f"{ident}_walls", couleurs, coll), Modele(f"{ident}_roof", couleurs, coll)
        acc = maison(mm, mt, p, c)
        enfants = [mm.fusionner(), mt.fusionner()]
    else:
        if fam not in FAMILLES:
            raise SystemExit(f"famille inconnue: {fam} ({ident})")
        m = Modele(f"{ident}_mesh", couleurs, coll)
        acc = FAMILLES[fam](m, p, c)
        enfants = [m.fusionner()]
    tris = 0
    lo = [1e9] * 3
    hi = [-1e9] * 3
    for e in enfants:
        e.data.materials.clear()
        e.data.materials.append(mat)
        e.parent = racine
        tris += triangles(e)
        a, b = bornes(e)
        lo = [min(lo[i], a[i]) for i in range(3)]
        hi = [max(hi[i], b[i]) for i in range(3)]
    # Repère du jeu: x est, y sud (= -Y Blender), z haut.
    fiche = {
        "file": f"{p['fichier']}.glb",
        "family": fam,
        "triangles": tris,
        "budget": p.get("budget"),
        "size": {"w": round(hi[0] - lo[0], 3), "d": round(hi[1] - lo[1], 3), "h": round(hi[2], 3)},
        "bottom": round(lo[2], 4),
        "nodes": [e.name for e in enfants],
    }
    if "assise" in acc:
        fiche["seat"] = {"height": round(acc["assise"]["hauteur"], 3), "front": round(acc["assise"]["avant"], 3)}
    if "plateau" in acc:
        fiche["top"] = round(acc["plateau"]["hauteur"], 3)
    if "couchage" in acc:
        fiche["bed"] = {"height": acc["couchage"]["hauteur"], "places": acc["couchage"]["places"]}
    if "portes" in acc:
        fiche["doors"] = [{"side": d["facade"], "x": d["x"], "y": round(-d["y"], 3), "width": d["largeur"],
                           "height": d["hauteur"]} for d in acc["portes"]]
        fiche["eaves"] = acc["egout"]
    col = acc.get("collision")
    if col and "rayon" in col:
        fiche["collision"] = {"shape": "cylinder", "radius": round(col["rayon"], 3), "h": round(hi[2], 3)}
    elif col and "boite" in col:
        fiche["collision"] = {"shape": "box", "w": col["boite"][0], "d": col["boite"][1], "h": col["boite"][2]}
    else:
        fiche["collision"] = {"shape": "box", "w": round(hi[0] - lo[0], 3), "d": round(hi[1] - lo[1], 3), "h": round(hi[2], 3)}
    for k, v in fiche.items():
        if k in ("seat", "top", "bed", "doors", "collision"):
            racine[k] = json.dumps(v)
    return racine, fiche


def exporter(chemin, racines):
    bpy.ops.object.select_all(action="DESELECT")
    for r in racines:
        r.select_set(True)
        for e in r.children:
            e.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=chemin, export_format="GLB", use_selection=True, export_extras=True, export_yup=True,
        export_apply=True, export_vertex_color="MATERIAL", export_normals=True, export_texcoords=True,
        export_animations=False, export_skins=False, export_morph=False,
    )


def main():
    sortie = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else sys.argv[1]
    os.makedirs(sortie, exist_ok=True)
    g, couleurs = lire_gabarits()
    defauts = g.get("defauts", {})
    budgets = g.get("budgets", {})
    vider_scene()
    coll = bpy.context.scene.collection
    mat = materiau()
    par_fichier = {}
    manifeste = {"format": "duo-decors/1", "models": {}}
    ids = set()
    for entree in g["modeles"]:
        if entree["id"] in ids:
            raise SystemExit(f"identifiant en double: {entree['id']}")
        ids.add(entree["id"])
        entree = {**entree, "budget": entree.get("budget", budgets.get(entree["famille"]))}
        if "fichier" not in entree:
            entree["fichier"] = g["fichiers"][entree["famille"]]
        racine, fiche = construire(entree, defauts, couleurs, coll, mat)
        par_fichier.setdefault(entree["fichier"], []).append(racine)
        manifeste["models"][entree["id"]] = fiche
        print(f"DECOR {entree['id']:<24} {fiche['triangles']:>6} tri  {fiche['size']}")
    for nom, racines in par_fichier.items():
        exporter(os.path.join(sortie, f"{nom}.glb"), racines)
    with open(os.path.join(sortie, "decors.json"), "w", encoding="utf-8") as f:
        json.dump(manifeste, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")
    blend = os.environ.get("DECORS_BLEND")
    if blend:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=blend)
    print(f"DECORS {len(manifeste['models'])} modèles, {len(par_fichier)} fichiers")
    _ = math


main()

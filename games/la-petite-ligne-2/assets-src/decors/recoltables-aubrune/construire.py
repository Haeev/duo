"""Construit les récoltables d'Aubrune depuis `recoltables.toml` (Blender 5.2).

    duo-python construire.py --sortie <dossier des GLB> --cultures <donnees/commun/cultures>
        [--gabarits <fichier.toml>] [--blend <fichier.blend>]

Un GLB par fichier de `[fichiers]`: un nœud racine par modèle, nommé par son identifiant, une
primitive par matériau (noms stables), teinte dans `COLOR_0`, normales imposées (à plat, ou
rayonnantes pour le feuillage). Le manifeste commun `decors.json` du dossier de sortie reçoit les
entrées de cette chaîne (`source: "recoltables-aubrune"`), la table `materials` et les cultures
(`crops`); les entrées des autres chaînes sont gardées telles quelles.

La géométrie vient de `familles.py` (numpy seul): Blender ne fait que l'écrire en glTF.
"""

from __future__ import annotations

import json
import os
import sys
import tomllib

import bpy
import numpy as np

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)

from familles import FAMILLES, Contexte  # noqa: E402
from formes import MATERIAUX, Atelier  # noqa: E402

SOURCE = "recoltables-aubrune"


def vider():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for bloc in (bpy.data.meshes, bpy.data.materials):
        for item in list(bloc):
            bloc.remove(item)


def materiau(nom: str):
    mat = bpy.data.materials.get(nom)
    if mat is not None:
        return mat
    mat = bpy.data.materials.new(nom)
    mat.use_backface_culling = True
    arbre = mat.node_tree
    bsdf = arbre.nodes.get("Principled BSDF")
    couleur = arbre.nodes.new("ShaderNodeVertexColor")
    couleur.layer_name = "Col"
    arbre.links.new(couleur.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.9
    return mat


def _lineaire(c: np.ndarray) -> np.ndarray:
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def objet(s: Atelier, nom: str):
    """Un objet Blender depuis un atelier. Repère: Blender (x, y, z) = jeu (x, -z, y)."""
    employes = [m for m in MATERIAUX if any(t[0] == m for t in s.tris)]
    rang = {m: i for i, m in enumerate(employes)}
    n = len(s.tris)
    pos = np.concatenate([t[1] for t in s.tris])
    nor = np.concatenate([t[2] for t in s.tris])
    col = np.concatenate([t[3] for t in s.tris])
    sommets = np.stack([pos[:, 0], -pos[:, 2], pos[:, 1]], axis=1)
    normales = np.stack([nor[:, 0], -nor[:, 2], nor[:, 1]], axis=1)
    # Coins identiques (même place, même normale, même teinte): un seul sommet. Le GLB s'allège
    # d'autant (une touffe aux normales rayonnantes partage presque tous ses sommets).
    cle = np.concatenate([np.round(sommets, 5), np.round(normales, 3), np.round(col, 4)], axis=1)
    _, premiers, indices = np.unique(cle, axis=0, return_index=True, return_inverse=True)
    indices = np.asarray(indices).reshape(-1)
    me = bpy.data.meshes.new(nom)
    me.from_pydata(sommets[premiers].tolist(), [], indices.reshape(n, 3).tolist())
    me.polygons.foreach_set("material_index", [rang[t[0]] for t in s.tris])
    me.polygons.foreach_set("use_smooth", [True] * n)
    attribut = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    rgba = np.ones((3 * n, 4), dtype=np.float32)
    rgba[:, :3] = _lineaire(col.astype(np.float64))
    attribut.data.foreach_set("color", rgba.ravel())
    for m in employes:
        me.materials.append(materiau(m))
    me.update()
    # from_pydata garde l'ordre des coins: une normale par coin, telle que l'atelier l'a voulue.
    me.normals_split_custom_set(normales.tolist())
    ob = bpy.data.objects.new(nom, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def exporter(objets, chemin: str):
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objets:
        ob.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=chemin, export_format="GLB", use_selection=True, export_extras=False, export_yup=True,
        export_apply=True, export_vertex_color="MATERIAL", export_normals=True, export_texcoords=False,
        export_animations=False, export_skins=False, export_morph=False,
    )


def lire_cultures(dossier: str) -> dict[str, dict]:
    out = {}
    for nom in sorted(os.listdir(dossier)):
        if nom.endswith(".json"):
            with open(os.path.join(dossier, nom), encoding="utf8") as f:
                fiche = json.load(f)
            out[fiche["id"]] = fiche
    return out


def batir(gabarits: dict, cultures: dict[str, dict]):
    """Tous les modèles: (liste de fiches de modèle, cultures du manifeste)."""
    ctx = Contexte(gabarits, cultures)
    modeles, recoltes, vus = [], {}, set()
    for entree in gabarits["modeles"]:
        famille = entree["famille"]
        if famille not in FAMILLES:
            raise SystemExit(f"{entree['id']}: famille inconnue « {famille} »")
        for m in FAMILLES[famille](entree, ctx):
            if "culture" in m:
                recoltes[m["culture"]] = {"crop": m["fiche"], "stages": m["stages"], "thirsty": m["thirsty"]}
                continue
            if m["id"] in vus:
                raise SystemExit(f"identifiant en double: {m['id']}")
            vus.add(m["id"])
            # `pose` d'une entrée: écarts de pose propres (taille lue à la caméra de jeu), à la
            # place de ceux de la famille, pour le modèle et ses variantes (pas ses états).
            if "pose" in entree and "etat" not in m:
                m["jitter"] = {"yaw": bool(entree["pose"].get("cap", True)), "scale": list(entree["pose"]["echelle"])}
            m["famille"] = famille
            m["budget"] = entree.get("budget", gabarits["budgets"][m.pop("famille_budget", famille)])
            m["fichier"] = gabarits["fichiers"][famille]
            modeles.append(m)
    return modeles, recoltes


def fiche_de(m: dict) -> dict:
    s: Atelier = m["atelier"]
    bas, haut = s.boite()
    fiche = {
        "file": f"{m['fichier']}.glb",
        "family": m["famille"],
        "source": SOURCE,
        "triangles": s.triangles,
        "trianglesParMateriau": s.triangles_par_materiau(),
        "budget": m["budget"],
        "size": {"w": round(float(haut[0] - bas[0]), 3), "d": round(float(haut[2] - bas[2]), 3), "h": round(float(haut[1]), 3)},
        "bottom": round(float(bas[1]), 4),
    }
    for cle in ("states", "variants", "jitter", "collision", "plants", "pourquoi"):
        if m.get(cle):
            fiche[cle] = m[cle]
    if "etat" in m:
        fiche["stateOf"] = {"model": m["de"], "state": m["etat"]}
    if m.get("case"):
        fiche["cell"] = True
    return fiche


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    opt = {args[i][2:]: args[i + 1] for i in range(0, len(args) - 1, 2) if args[i].startswith("--")}
    with open(opt.get("gabarits", os.path.join(ICI, "recoltables.toml")), "rb") as f:
        gabarits = tomllib.load(f)
    sortie = opt["sortie"]
    os.makedirs(sortie, exist_ok=True)
    modeles, recoltes = batir(gabarits, lire_cultures(opt["cultures"]))
    bpy.context.preferences.filepaths.save_version = 0
    vider()
    par_fichier: dict[str, list] = {}
    fiches = {}
    erreurs = 0
    for m in modeles:
        fiche = fiche_de(m)
        par_plant = fiche["triangles"] / m.get("plants", 1)
        etat = "ok" if par_plant <= fiche["budget"] else "HORS BUDGET"
        erreurs += etat != "ok"
        print(f"RECOLTABLE {m['id']:<28} {fiche['triangles']:>5} tri (budget {fiche['budget']}{' par plant' if 'plants' in m else ''})  {fiche['size']}  {etat}")
        par_fichier.setdefault(m["fichier"], []).append(objet(m["atelier"], m["id"]))
        fiches[m["id"]] = fiche
    for nom, objets in par_fichier.items():
        exporter(objets, os.path.join(sortie, f"{nom}.glb"))
        print(f"FICHIER {nom}.glb: {len(objets)} modèles, {os.path.getsize(os.path.join(sortie, nom + '.glb')) // 1024} Ko")
    if "blend" in opt:
        bpy.ops.wm.save_as_mainfile(filepath=opt["blend"])
    # Manifeste commun: on y remplace les entrées de cette chaîne, les autres restent.
    chemin = os.path.join(sortie, "decors.json")
    manifeste = {"format": "duo-decors/1", "models": {}}
    if os.path.exists(chemin):
        with open(chemin, encoding="utf8") as f:
            manifeste = json.load(f)
    for ident in [i for i, e in manifeste["models"].items() if e.get("source") == SOURCE]:
        del manifeste["models"][ident]
    for ident, fiche in fiches.items():
        if ident in manifeste["models"]:
            print(f"RECOLTABLE {ident}: identifiant déjà pris par une autre chaîne du manifeste")
            erreurs += 1
            continue
        manifeste["models"][ident] = fiche
    manifeste["materials"] = {nom: {"layer": regle["couche"], **({"kind": regle["nature"]} if "nature" in regle else {})} for nom, regle in gabarits["materiaux"].items()}
    manifeste["crops"] = recoltes
    with open(chemin, "w", encoding="utf8") as f:
        json.dump(manifeste, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")
    total = sum(f["triangles"] for f in fiches.values())
    print(f"CONSTRUCTION recoltables: {len(fiches)} modèles, {len(recoltes)} cultures, {total} triangles, {erreurs} erreur(s)")
    if erreurs:
        sys.exit(1)


if __name__ == "__main__":
    main()

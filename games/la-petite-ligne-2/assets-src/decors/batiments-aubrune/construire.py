"""Construit les bâtiments d'un lieu depuis leurs fiches, et le jeu de pièces (Blender 5.2).

    duo-python construire.py --fiches <dossier des fiches> --sortie <dossier des GLB>
        [--seulement id,id] [--pieces <fichier.glb>] [--blend <fichier.blend>]

Par fiche: un GLB `<id>.glb` (un nœud `<id>`, origine au centre de l'emprise, au sol, façades
dans le repère du monde) et une entrée dans le manifeste `batiments.json`. Sans Blender, rien
d'autre ne change: la géométrie vient de `assembleur.py`, Blender ne fait que l'écrire en glTF.
"""

from __future__ import annotations

import json
import os
import sys

import bpy
import numpy as np

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)

import assembleur  # noqa: E402
from atelier import MATERIAUX, Atelier  # noqa: E402

BUDGET_DEFAUT = 6000
RUGOSITE = {"vitre": 0.25, "metal": 0.5}


def lire_fiche(chemin: str) -> dict:
    """Une fiche JSON; les lignes de commentaire (`//`) d'un gabarit sont ignorées."""
    with open(chemin, encoding="utf8") as f:
        lignes = [ligne for ligne in f.read().split("\n") if not ligne.strip().startswith("//")]
    import re

    return json.loads(re.sub(r",(\s*[}\]])", r"\1", "\n".join(lignes)))


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
    bsdf.inputs["Roughness"].default_value = RUGOSITE.get(nom, 0.85)
    return mat


def _lineaire(c: np.ndarray) -> np.ndarray:
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def objet(s: Atelier, nom: str):
    """Un objet Blender depuis un atelier: un maillage, un emplacement par matériau employé,
    couleur par coin (linéaire), UV en mètres / 4. Repère: Blender (x, y, z) = jeu (x, -z, y)."""
    employes = [m for m in MATERIAUX if any(f[0] == m for f in s.faces)]
    rang = {m: i for i, m in enumerate(employes)}
    sommets, faces, couleurs, uvs, mats = [], [], [], [], []
    for mat, couleur, pts, uv, _morceau in s.faces:
        debut = len(sommets)
        for p in pts:
            sommets.append((p[0], -p[2], p[1]))
        faces.append(tuple(range(debut, debut + len(pts))))
        couleurs.extend([couleur] * len(pts))
        uvs.extend(uv.tolist())
        mats.append(rang[mat])
    me = bpy.data.meshes.new(nom)
    me.from_pydata(sommets, [], faces)
    me.polygons.foreach_set("material_index", mats)
    me.polygons.foreach_set("use_smooth", [False] * len(faces))
    col = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    rgba = np.ones((len(couleurs), 4), dtype=np.float32)
    rgba[:, :3] = _lineaire(np.array(couleurs, dtype=np.float64))
    col.data.foreach_set("color", rgba.ravel())
    carte = me.uv_layers.new(name="UVMap")
    carte.data.foreach_set("uv", np.array(uvs, dtype=np.float32).ravel())
    for m in employes:
        me.materials.append(materiau(m))
    me.update()
    ob = bpy.data.objects.new(nom, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def exporter(objets, chemin: str):
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objets:
        ob.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=chemin, export_format="GLB", use_selection=True, export_extras=True, export_yup=True,
        export_apply=True, export_vertex_color="MATERIAL", export_normals=True, export_texcoords=True,
        export_animations=False, export_skins=False, export_morph=False,
    )


def batir(fiche: dict, nuancier: dict):
    """Assemble une fiche; si le budget de triangles est dépassé, recommence en plus économe
    (tuiles plus larges, moins de pierres semées) plutôt que d'échouer."""
    budget = fiche.get("budget", BUDGET_DEFAUT)
    for economie in range(4):
        s, notice = assembleur.assembler(fiche, nuancier, economie)
        if s.triangles <= budget:
            break
    notice["economie"] = economie
    notice["budget"] = budget
    return s, notice


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    opt = {args[i][2:]: args[i + 1] for i in range(0, len(args) - 1, 2) if args[i].startswith("--")}
    with open(os.path.join(ICI, "teintes.json"), encoding="utf8") as f:
        nuancier = json.load(f)
    bpy.context.preferences.filepaths.save_version = 0
    vider()
    if "pieces" in opt:
        import jeu_de_pieces

        objets, fiches_pieces = jeu_de_pieces.construire(nuancier, objet)
        exporter(objets, opt["pieces"])
        with open(os.path.splitext(opt["pieces"])[0] + ".json", "w", encoding="utf8") as f:
            json.dump({"format": "duo-pieces-batiment/1", "lieu": nuancier["lieu"], "materiaux": list(MATERIAUX), "pieces": fiches_pieces}, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write("\n")
        print(f"PIECES {len(objets)} pièces, {os.path.getsize(opt['pieces']) // 1024} Ko")
        if "blend" in opt:
            bpy.ops.wm.save_as_mainfile(filepath=opt["blend"])
        vider()
    if "fiches" not in opt:
        return
    sortie = opt["sortie"]
    os.makedirs(sortie, exist_ok=True)
    seulement = set(opt["seulement"].split(",")) if "seulement" in opt else None
    chemin_manifeste = os.path.join(sortie, "batiments.json")
    manifeste = {"format": "duo-batiments/1", "lieu": nuancier["lieu"], "materiaux": list(MATERIAUX), "batiments": {}}
    if seulement and os.path.exists(chemin_manifeste):
        with open(chemin_manifeste, encoding="utf8") as f:
            manifeste = json.load(f)
    erreurs = 0
    # `--fiches` accepte aussi une seule fiche (le gabarit commenté, pour le test factice).
    seule = os.path.isfile(opt["fiches"])
    for nom in [os.path.basename(opt["fiches"])] if seule else sorted(os.listdir(opt["fiches"])):
        if not nom.endswith((".json", ".jsonc")):
            continue
        fiche = lire_fiche(opt["fiches"] if seule else os.path.join(opt["fiches"], nom))
        ident = fiche["id"]
        if seulement and ident not in seulement:
            continue
        try:
            s, notice = batir(fiche, nuancier)
        except assembleur.FicheInvalide as erreur:
            print(f"BATIMENT {ident}: FICHE INVALIDE: {erreur}")
            erreurs += 1
            continue
        vider()
        ob = objet(s, ident)
        chemin = os.path.join(sortie, f"{ident}.glb")
        exporter([ob], chemin)
        manifeste["batiments"][ident] = {
            "fichier": f"{ident}.glb",
            "noeud": ident,
            "nom": fiche.get("nom", ident),
            "emprise": fiche["emprise"],
            "triangles": s.triangles,
            "trianglesParMateriau": s.triangles_par_materiau(),
            "morceaux": s.morceaux,
            "octets": os.path.getsize(chemin),
            **notice,
        }
        etat = "ok" if s.triangles <= notice["budget"] else "HORS BUDGET"
        for signal in s.signalements:
            print(f"BATIMENT {ident}: SIGNAL {signal}")
        print(f"BATIMENT {ident}: {s.triangles} triangles (budget {notice['budget']}, économie {notice['economie']}), {os.path.getsize(chemin) // 1024} Ko, {etat}")
        if s.triangles > notice["budget"]:
            erreurs += 1
    with open(chemin_manifeste, "w", encoding="utf8") as f:
        json.dump(manifeste, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")
    print(f"CONSTRUCTION batiments: {len(manifeste['batiments'])} au manifeste, {erreurs} erreur(s)")
    if erreurs:
        sys.exit(1)


if __name__ == "__main__":
    main()

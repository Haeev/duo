"""Contrôle des bâtiments livrés, sans Blender.

    python3 verifier.py <dossier des GLB> <dossier des fiches> [plan.json]

Par fiche: entrée au manifeste, GLB lisible, un nœud du nom de la fiche, matériaux aux noms
stables, triangles comptés dans le fichier égaux au manifeste et sous le budget, rien sous le
sol (sauf une roue déclarée), murs sur l'emprise, débords déclarés. Avec le plan: emprise et
porte (façade, point du seuil) identiques à celles du plan. Total des GLB sous 25 Mo.
"""

import json
import os
import struct
import sys

MATERIAUX = {"pierre", "moellon", "crepi", "tuile", "bois", "bardage", "volet", "vitre", "metal"}
POIDS_MAX = 25_000_000
DEBORD_MAX = 1.3
"""Débord de toit, marche de seuil, descente d'eau: ce qui dépasse de l'emprise sans le dire."""


def lire_glb(chemin):
    with open(chemin, "rb") as f:
        donnees = f.read()
    magie, _version, _taille = struct.unpack_from("<4sII", donnees, 0)
    if magie != b"glTF":
        raise ValueError("pas un GLB")
    longueur, genre = struct.unpack_from("<I4s", donnees, 12)
    if genre != b"JSON":
        raise ValueError("premier bloc inattendu")
    return json.loads(donnees[20:20 + longueur])


def controler(ident, fiche, entree, dossier, plan):
    erreurs, notes = [], []
    chemin = os.path.join(dossier, entree["fichier"])
    if not os.path.exists(chemin):
        return [f"{entree['fichier']} manque"], notes
    g = lire_glb(chemin)
    racines = [g["nodes"][i]["name"] for i in g["scenes"][0]["nodes"]]
    if racines != [ident]:
        erreurs.append(f"nœuds racines {racines}, attendu [{ident}]")
    noms = {m["name"] for m in g.get("materials", [])}
    if not noms <= MATERIAUX:
        erreurs.append(f"matériaux inconnus: {sorted(noms - MATERIAUX)}")
    triangles = 0
    bas, haut = [1e9] * 3, [-1e9] * 3
    for maillage in g["meshes"]:
        for prim in maillage["primitives"]:
            for cle in ("POSITION", "NORMAL", "TEXCOORD_0", "COLOR_0"):
                if cle not in prim["attributes"]:
                    erreurs.append(f"attribut {cle} absent")
            triangles += g["accessors"][prim["indices"]]["count"] // 3
            acc = g["accessors"][prim["attributes"]["POSITION"]]
            bas = [min(a, b) for a, b in zip(bas, acc["min"])]
            haut = [max(a, b) for a, b in zip(haut, acc["max"])]
    if triangles != entree["triangles"]:
        erreurs.append(f"{triangles} triangles dans le fichier, {entree['triangles']} au manifeste")
    budget = fiche.get("budget", 6000)
    if triangles > budget:
        erreurs.append(f"{triangles} triangles pour un budget de {budget}")
    options = [o for c in [fiche, *fiche.get("annexes", [])] for o in c.get("options", [])]
    enfonce = max((o.get("enfonce", 0.6) for o in options if o["piece"] == "roue"), default=0.0)
    if bas[1] < -0.03 - (enfonce + 0.3 if enfonce else 0.0):
        erreurs.append(f"géométrie sous le sol: {bas[1]:.3f} m")
    w, d = fiche["emprise"]["largeur"], fiche["emprise"]["profondeur"]
    depasse = max(-w / 2 - bas[0], haut[0] - w / 2, -d / 2 - bas[2], haut[2] - d / 2)
    declare = any(o["piece"] in ("auvent", "roue", "escalier", "cheminee") and (o["piece"] != "cheminee" or o.get("forme") == "four") for o in options)
    if depasse > DEBORD_MAX and not declare:
        erreurs.append(f"dépasse l'emprise de {depasse:.2f} m sans option qui l'explique")
    elif depasse > DEBORD_MAX:
        notes.append(f"dépasse l'emprise de {depasse:.2f} m (auvent, roue, cheminée adossée ou escalier)")
    if fiche.get("murs", "pleins") == "pleins" and not fiche.get("place") and (haut[0] - bas[0] < w or haut[2] - bas[2] < d):
        erreurs.append("le modèle ne couvre pas son emprise")
    if plan is not None:
        b = next((p for p in plan["batiments"] if p["id"].replace("_", "-") == ident), None)
        if b is None:
            notes.append("absent du plan")
        else:
            if (b["rect"][2], b["rect"][3]) != (w, d):
                erreurs.append(f"emprise {w} x {d}, plan {b['rect'][2]} x {b['rect'][3]}")
            if b["porte"] is not None:
                if entree.get("porte") is None:
                    erreurs.append("le plan donne une porte, la fiche non")
                else:
                    px = b["porte"][0] - (b["rect"][0] + w / 2)
                    pz = b["porte"][1] - (b["rect"][1] + d / 2)
                    if abs(px - entree["porte"]["x"]) > 0.05 or abs(pz - entree["porte"]["z"]) > 0.05:
                        erreurs.append(f"porte en ({entree['porte']['x']}, {entree['porte']['z']}), plan ({px}, {pz})")
                    if b["gabarit"].get("facade_porte") != entree["porte"]["facade"]:
                        erreurs.append(f"porte façade {entree['porte']['facade']}, plan {b['gabarit'].get('facade_porte')}")
    return erreurs, notes


def main():
    dossier, fiches = sys.argv[1], sys.argv[2]
    plan = None
    if len(sys.argv) > 3:
        with open(sys.argv[3], encoding="utf8") as f:
            plan = json.load(f)
    with open(os.path.join(dossier, "batiments.json"), encoding="utf8") as f:
        manifeste = json.load(f)
    total_erreurs, poids, triangles = 0, 0, 0
    ids = []
    for nom in sorted(os.listdir(fiches)):
        if not nom.endswith(".json"):
            continue
        with open(os.path.join(fiches, nom), encoding="utf8") as f:
            fiche = json.load(f)
        ident = fiche["id"]
        ids.append(ident)
        if nom != f"{ident}.json":
            print(f"ERREUR {nom}: l'identifiant « {ident} » n'est pas le nom du fichier")
            total_erreurs += 1
        entree = manifeste["batiments"].get(ident)
        if entree is None:
            print(f"ERREUR {ident}: absent du manifeste (relancer construire.sh)")
            total_erreurs += 1
            continue
        erreurs, notes = controler(ident, fiche, entree, dossier, plan)
        poids += entree["octets"]
        triangles += entree["triangles"]
        for e in erreurs:
            print(f"ERREUR {ident}: {e}")
        for n in notes:
            print(f"note {ident}: {n}")
        total_erreurs += len(erreurs)
    for ident in manifeste["batiments"]:
        if ident not in ids:
            print(f"ERREUR {ident}: au manifeste sans fiche")
            total_erreurs += 1
    if plan is not None:
        for b in plan["batiments"]:
            if b["porte"] is not None and b["id"].replace("_", "-") not in ids:
                print(f"note: le bâtiment « {b['id']} » du plan n'a pas de fiche")
    pieces = os.path.join(dossier, "pieces", "pieces-aubrune.glb")
    if os.path.exists(pieces):
        poids += os.path.getsize(pieces)
    if poids > POIDS_MAX:
        print(f"ERREUR: {poids / 1e6:.1f} Mo de GLB pour un budget de {POIDS_MAX / 1e6:.0f} Mo")
        total_erreurs += 1
    print(f"VERIFICATION batiments: {len(ids)} fiches, {triangles} triangles, {poids / 1e6:.1f} Mo, {total_erreurs} erreur(s)")
    sys.exit(1 if total_erreurs else 0)


if __name__ == "__main__":
    main()

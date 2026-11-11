"""Contrôle des récoltables d'Aubrune, sans Blender: GLB, manifeste et fiches du jeu.

    python3 verifier.py <dossier des GLB (decors.json)> <donnees/commun>

Vérifie, pour chaque modèle de la chaîne (`source: "recoltables-aubrune"`): nœud racine à son
nom dans son fichier; primitives aux matériaux nommés dans la table `materials`, avec normales
et `COLOR_0`, sans UV; triangles comptés dans le GLB, égaux au manifeste et sous le budget de la
famille (par plant pour une culture); rien sous le sol; une case de potager tient dans sa case;
variantes et états qui pointent vers des modèles livrés. Puis les fiches: tout meuble à brique
`harvest` ou `field` a son modèle et l'état que sa ressource laisse (`stump`, `bare`), toute
culture a un modèle par stade. Enfin les volumes (`controle_volumes.py`), ce que le client voit
en tournant autour d'un modèle dans sa visionneuse: aucun trou vu de côté ni de dessus, aucune
pièce qui flotte à plus d'un centimètre de ce qui la porte, aucune pièce qui en traverse une
autre de part en part. Sortie: `VERIFICATION recoltables: N erreur(s)`.

    python3 verifier.py <dossier> <donnees/commun> [--sans-volumes] [--seuls id,id]
"""

import json
import os
import struct
import sys
import tomllib
from concurrent.futures import ProcessPoolExecutor

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)

SOURCE = "recoltables-aubrune"
POIDS_MAX = 2_500_000
# Une case de potager fait 1 m; le feuillage d'un plant mûr peut déborder un peu sur l'allée.
CASE_MAX = {"parcelle": 1.0, "culture": 1.12}
# Modules posés case par case sur une file (aménagements).
MODULES = ("haie", "talus", "rang", "voie")


def lire_glb(chemin):
    with open(chemin, "rb") as f:
        data = f.read()
    magic, _, _ = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, f"{chemin}: pas un GLB"
    n, _ = struct.unpack_from("<II", data, 12)
    return json.loads(data[20:20 + n]), len(data)


def lire_json(chemin):
    with open(chemin, encoding="utf8") as f:
        return json.load(f)


# Une culture pose sur le billon de la case bêchée (un autre modèle): ses pièces les plus basses
# sont à 15 cm. Un module de file est ouvert à ses deux bouts (son voisin le ferme).
# Un véhicule pose ses roues sur le rail (dessus à 0,26 m au-dessus de son origine).
SOLS = {"culture": 0.16, "vehicule": 0.27}

BOUTS = {"haie": 0, "talus": 0, "rang": 2, "voie": 2}


def _volumes(travail):
    """Défauts de volume d'un lot de modèles d'un même GLB (un processus par lot)."""
    from controle_volumes import controler, lire_glb, maillage

    chemin, modeles = travail
    gltf, binaire = lire_glb(chemin)
    racines = {gltf["nodes"][i]["name"]: gltf["nodes"][i] for i in gltf["scenes"][0]["nodes"]}
    out = []
    for ident, famille, mural in modeles:
        if ident not in racines:
            continue
        V, T, M = maillage(gltf, binaire, racines[ident])
        sol = SOLS.get(famille, 0.01)
        for d in controler(V, T, M, appui_mur=mural, sol=sol, bouts=BOUTS.get(famille)):
            out.append(f"{ident}: {d}")
    return out


def main():
    dossier, donnees = sys.argv[1], sys.argv[2]
    erreurs = []
    manifeste = lire_json(os.path.join(dossier, "decors.json"))
    modeles = manifeste["models"]
    miens = {i: m for i, m in modeles.items() if m.get("source") == SOURCE}
    materiaux = manifeste.get("materials", {})
    glbs = {}
    for fichier in sorted({m["file"] for m in miens.values()}):
        chemin = os.path.join(dossier, fichier)
        if not os.path.exists(chemin):
            erreurs.append(f"{fichier}: fichier absent")
            continue
        glbs[fichier], poids = lire_glb(chemin)
        if poids > POIDS_MAX:
            erreurs.append(f"{fichier}: {poids} octets (plafond {POIDS_MAX})")
        for mat in glbs[fichier].get("materials", []):
            if mat["name"] not in materiaux:
                erreurs.append(f"{fichier}: matériau « {mat['name']} » absent de la table materials")
    total = 0
    bornes = {}
    for ident, m in sorted(miens.items()):
        g = glbs.get(m["file"])
        if g is None:
            continue
        racines = [g["nodes"][i] for i in g["scenes"][0]["nodes"]]
        noeud = next((n for n in racines if n["name"] == ident), None)
        if noeud is None or "mesh" not in noeud:
            erreurs.append(f"{ident}: nœud racine absent de {m['file']}")
            continue
        if any(k in noeud for k in ("translation", "rotation", "scale")):
            erreurs.append(f"{ident}: transformation sur le nœud (tout doit être appliqué)")
        # Parties mobiles (`nodes` du manifeste): enfants directs, nommés, posés à leur pivot, sans
        # rotation ni échelle au repos. Tout autre enfant est une erreur.
        enfants = [(g["nodes"][i], g["nodes"][i].get("translation", [0.0, 0.0, 0.0])) for i in noeud.get("children", [])]
        attendus = m.get("nodes", {})
        if sorted(e["name"] for e, _ in enfants) != sorted(attendus):
            erreurs.append(f"{ident}: enfants {[e['name'] for e, _ in enfants]} au lieu des parties mobiles {sorted(attendus)}")
        for e, tr in enfants:
            if any(k in e for k in ("rotation", "scale", "children")) or "mesh" not in e:
                erreurs.append(f"{ident}: partie mobile « {e['name']} » tournée, à l'échelle, sans maillage ou avec des enfants")
            elif e["name"] in attendus and max(abs(a - b) for a, b in zip(tr, attendus[e["name"]]["pivot"])) > 0.001:
                erreurs.append(f"{ident}: partie mobile « {e['name']} » posée en {tr}, pivot {attendus[e['name']]['pivot']} au manifeste")
        tris, bas = 0, 1e9
        mini, maxi = [1e9] * 3, [-1e9] * 3
        prims = [(p, [0.0, 0.0, 0.0]) for p in g["meshes"][noeud["mesh"]]["primitives"]]
        prims += [(p, tr) for e, tr in enfants if "mesh" in e for p in g["meshes"][e["mesh"]]["primitives"]]
        for prim, tr in prims:
            acc = g["accessors"][prim["attributes"]["POSITION"]]
            mini = [min(a, b + d) for a, b, d in zip(mini, acc["min"], tr)]
            maxi = [max(a, b + d) for a, b, d in zip(maxi, acc["max"], tr)]
            attributs = prim["attributes"]
            for voulu in ("POSITION", "NORMAL", "COLOR_0"):
                if voulu not in attributs:
                    erreurs.append(f"{ident}: attribut {voulu} absent")
            if "TEXCOORD_0" in attributs:
                erreurs.append(f"{ident}: UV inutiles (la matière encrée n'en lit pas)")
            tris += g["accessors"][prim["indices"]]["count"] // 3
            bas = min(bas, g["accessors"][attributs["POSITION"]]["min"][1] + tr[1])
        total += tris
        if tris != m["triangles"]:
            erreurs.append(f"{ident}: {tris} triangles dans le GLB, {m['triangles']} au manifeste")
        if tris / m.get("plants", 1) > m["budget"]:
            erreurs.append(f"{ident}: {tris} triangles pour un budget de {m['budget']}" + (" par plant" if "plants" in m else ""))
        if bas < -0.002:
            erreurs.append(f"{ident}: descend sous le sol ({bas:.3f} m)")
        bornes[ident] = (mini, maxi)
        # Module de file (haie, talus, rang): il court sur exactement 1 m et ne déborde pas de
        # sa case, sinon deux modules voisins se chevauchent ou laissent un jour.
        if m["family"] in MODULES:
            long_axe = 2 if m["family"] in ("rang", "voie") else 0
            travers = 0 if long_axe == 2 else 2
            # Un module de voie est large (ballast, fossés, talus): seule sa longueur est d'un mètre.
            large = m["family"] == "voie"
            if abs(mini[long_axe] + 0.5) > 0.002:
                erreurs.append(f"{ident}: le module commence à {mini[long_axe]:.3f} m (attendu -0,5)")
            if maxi[long_axe] > 0.502 or mini[long_axe] < -0.502 or (not large and (maxi[travers] > 0.502 or mini[travers] < -0.502)):
                erreurs.append(f"{ident}: déborde de sa case de 1 m ({mini} .. {maxi})")
        if m.get("cell") and max(m["size"]["w"], m["size"]["d"]) > CASE_MAX[m["family"]] + 0.001:
            erreurs.append(f"{ident}: {m['size']['w']} x {m['size']['d']} m déborde de sa case")
        for autre in m.get("variants", []) + list(m.get("states", {}).values()):
            if autre not in miens:
                erreurs.append(f"{ident}: variante ou état « {autre} » sans modèle")
    # Cultures: un modèle par stade (le dernier est mûr), et les mêmes à arroser.
    cultures = {}
    for nom in sorted(os.listdir(os.path.join(donnees, "cultures"))):
        if nom.endswith(".json"):
            fiche = lire_json(os.path.join(donnees, "cultures", nom))
            cultures[fiche["id"]] = fiche
    for ident, fiche in cultures.items():
        entree = manifeste.get("crops", {}).get(fiche.get("model", ""))
        if entree is None:
            erreurs.append(f"culture {ident}: pas de modèle (champ « model » de la fiche, entrée de recoltables.toml)")
            continue
        stades = len(fiche["stages"])
        if len(entree["stages"]) != stades + 1 or len(entree["thirsty"]) != stades:
            erreurs.append(f"culture {ident}: {len(entree['stages'])} modèles pour {stades} stades et la maturité (relancer construire.sh)")
        for modele in entree["stages"] + entree["thirsty"]:
            if modele not in miens:
                erreurs.append(f"culture {ident}: modèle « {modele} » absent")
    # Meubles récoltables: le modèle, et ce que la ressource laisse une fois récoltée.
    ressources = {}
    for nom in sorted(os.listdir(os.path.join(donnees, "ressources"))):
        if nom.endswith(".json"):
            fiche = lire_json(os.path.join(donnees, "ressources", nom))
            ressources[fiche["id"]] = fiche
    recoltables = 0
    for nom in sorted(os.listdir(os.path.join(donnees, "meubles"))):
        if not nom.endswith(".json"):
            continue
        fiche = lire_json(os.path.join(donnees, "meubles", nom))
        # Meuble de cette chaîne: posé au centre de son emprise, il doit tenir dans ses cases.
        if fiche["model"] in bornes and miens[fiche["model"]]["family"] in ("meuble", "objet", "fete", "mobilier"):

            mini, maxi = bornes[fiche["model"]]
            demi_w, demi_d = fiche["size"]["w"] / 2 + 0.005, fiche["size"]["h"] / 2 + 0.005
            if mini[0] < -demi_w or maxi[0] > demi_w or mini[2] < -demi_d or maxi[2] > demi_d:
                erreurs.append(f"meuble {fiche['id']}: le modèle « {fiche['model']} » sort de ses {fiche['size']['w']} x {fiche['size']['h']} cases ({mini} .. {maxi})")
        briques = {b["brick"]: b for b in fiche["bricks"]}
        if "harvest" not in briques and "field" not in briques:
            continue
        recoltables += 1
        m = modeles.get(fiche["model"])
        if m is None:
            erreurs.append(f"meuble {fiche['id']}: modèle « {fiche['model']} » absent des décors")
            continue
        if "harvest" in briques:
            apres = ressources.get(briques["harvest"]["resource"], {}).get("after", "gone")
            if apres != "gone" and apres not in m.get("states", {}):
                erreurs.append(f"meuble {fiche['id']}: le modèle « {fiche['model']} » n'a pas l'état « {apres} » que laisse sa ressource")
        if "field" in briques:
            for etat in ("tilled", "watered"):
                if etat not in m.get("states", {}):
                    erreurs.append(f"meuble {fiche['id']}: le modèle « {fiche['model']} » n'a pas l'état « {etat} »")
            if m["size"]["w"] > fiche["size"]["w"] + 0.01 or m["size"]["d"] > fiche["size"]["h"] + 0.01:
                erreurs.append(f"meuble {fiche['id']}: {m['size']['w']} x {m['size']['d']} m déborde de {fiche['size']['w']} x {fiche['size']['h']} cases")
    a_reprendre = []
    if "--sans-volumes" not in sys.argv:
        with open(os.path.join(ICI, "recoltables.toml"), "rb") as f:
            connus = set(tomllib.load(f).get("volumes", {}).get("a_reprendre", []))
        for d in volumes(dossier, donnees, miens):
            ident = d.split(":")[0].split()[-1]
            (a_reprendre if ident in connus else erreurs).append(d)
        propres = sorted(i for i in connus if i in miens and not any(d.split(":")[0].split()[-1] == i for d in a_reprendre))
        for i in propres:
            print(f"NET {i}: plus aucun défaut de volume, à retirer de [volumes] a_reprendre")
    for d in a_reprendre:
        print("A REPRENDRE", d)
    for e in erreurs:
        print("ERREUR", e)
    if a_reprendre:
        print(f"VOLUMES: {len(a_reprendre)} défaut(s) connus dans {len({d.split(':')[0] for d in a_reprendre})} modèle(s) à reprendre ([volumes] de recoltables.toml)")

    print(f"VERIFICATION recoltables: {len(miens)} modèles, {total} triangles, {len(cultures)} cultures, {recoltables} meubles récoltables, {len(erreurs)} erreur(s)")
    sys.exit(1 if erreurs else 0)


def volumes(dossier, donnees, miens):
    """Contrôle des volumes, deux processus (la machine est partagée)."""
    seuls = None
    if "--seuls" in sys.argv:
        seuls = set(sys.argv[sys.argv.index("--seuls") + 1].split(","))
    with open(os.path.join(ICI, "recoltables.toml"), "rb") as f:
        gabarits = tomllib.load(f)
    muraux = {e["id"] for e in gabarits["modeles"] if e.get("appui") == "mur"}
    for nom in sorted(os.listdir(os.path.join(donnees, "meubles"))):
        if nom.endswith(".json"):
            fiche = lire_json(os.path.join(donnees, "meubles", nom))
            if fiche.get("deco", {}).get("layer") == "wall":
                muraux.add(fiche["model"])
    lots: dict[str, list] = {}
    for ident, m in sorted(miens.items()):
        if seuls is not None and ident not in seuls:
            continue
        lots.setdefault(m["file"], []).append((ident, m["family"], ident in muraux or m.get("stateOf", {}).get("model") in muraux))
    # Lots d'au plus 12 modèles: les deux processus restent occupés jusqu'au bout.
    travaux = [(os.path.join(dossier, f), ms[i:i + 12]) for f, ms in lots.items() for i in range(0, len(ms), 12)]
    with ProcessPoolExecutor(max_workers=2) as pool:
        resultats = list(pool.map(_volumes, travaux))
    return [f"volume {d}" for r in resultats for d in r]


if __name__ == "__main__":
    main()

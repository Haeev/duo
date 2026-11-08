"""Assemble assets/modeles/modeles.json: fiche de chaque modèle pour les devs (Python seul).

Usage: python3 modeles_json.py
Lit fiches/meubles.json, fiches/objets.json, fiches/coque.json, personnages/*.rapport.json et le catalogue de la démo
(docs/jeux/cosy-cafe/demo/donnees/), compare les dimensions aux champs `size` du catalogue et liste ce qui manque.
"""
import glob
import json
import os

ICI = os.path.dirname(os.path.abspath(__file__))
DEPOT = os.path.normpath(os.path.join(ICI, "..", "..", "..", ".."))
ASSETS = os.path.join(DEPOT, "games", "deux-tabliers", "assets", "modeles")
DONNEES = os.path.join(DEPOT, "docs", "jeux", "cosy-cafe", "demo", "donnees")

fiches = {}
for f in ("meubles.json", "objets.json"):
    fiches.update(json.load(open(os.path.join(ICI, "fiches", f))))
coque = json.load(open(os.path.join(ICI, "fiches", "coque.json")))
cat = json.load(open(os.path.join(DONNEES, "catalogue.json")))
eq = json.load(open(os.path.join(DONNEES, "postes-equipements.json")))
taille_cat = {i["id"]: i.get("size") for i in cat["items"]}
for p in eq["purchases"]:
    if p.get("size"):
        taille_cat[p["id"]] = {"w": p["size"][0], "d": p["size"][1], "h": p["size"][2]}

objets = []
for ident, f in sorted(fiches.items()):
    if not os.path.exists(os.path.join(ASSETS, f["fichier"])):
        continue
    f = dict(f)
    f["poids_octets"] = os.path.getsize(os.path.join(ASSETS, f["fichier"]))
    s = taille_cat.get(ident)
    if s:
        d = f["dimensions_m"]
        f["catalogue_size"] = s
        f["ecart_catalogue_m"] = {"w": round(d["x"] - s["w"], 3), "d": round(d["z"] - s["d"], 3), "h": round(d["y"] - s["h"], 3)}
    f["source"] = "Meshy (essai de style) puis conformité" if f.get("meshy") else "Blender scripté (meubles.py ou objets.py)"
    objets.append(f)

persos = []
for rp in sorted(glob.glob(os.path.join(ICI, "personnages", "*.rapport.json"))):
    r = json.load(open(rp))
    ident = r["asset"]
    fiche = json.load(open(rp.replace(".rapport.json", ".meshy.json")))
    persos.append({
        "id": ident, "fichier": ident + ".glb", "role": fiche["purpose"], "taille_m": fiche["conformity"]["target_height_m"],
        "triangles": r["triangles"], "os": r["bones"], "noms_os": r["bone_names"], "clips": {k: v["seconds"] for k, v in r["clips"].items()},
        "clips_sur_place": True, "materiaux": [ident + "_mat"] + (["dt_badge_joueur"] if r.get("badge") else []),
        "badge_joueur": r.get("badge"), "texture": "texture de Meshy réduite à 512 px, intégrée",
        "poids_octets": os.path.getsize(os.path.join(ASSETS, ident + ".glb")), "fiche_meshy": f"assets-src/modeles/personnages/{ident}.meshy.json",
        "avant": [0, 0, 1],
    })
    dp = rp.replace(".rapport.json", ".doigts.json")
    if os.path.exists(dp):
        # os des doigts et poses de main (personnages/doigts.py); sans ce fichier, le personnage n'a pas de doigts
        dg = json.load(open(dp))
        persos[-1]["os"] = dg["os_total"]
        persos[-1]["noms_os"] = r["bone_names"] + list(dg["os"])
        persos[-1]["clips"].update({k: 0.1 for k in dg["poses"]})
        persos[-1]["doigts"] = {
            "os": dg["os"],
            "repere_des_os": "Y le long du segment, Z vers la paume, X = Y x Z; flexion = rotation autour de X local, positive vers la paume",
            "poses": {k: {os_: v["quaternion_local_xyzw"] for os_, v in pose.items()} for k, pose in dg["poses"].items()},
            "angles_deg": {k: {os_: [v["flexion_x_deg"], v["rotation_z_deg"]] for os_, v in pose.items()} for k, pose in dg["poses"].items()},
            "prises": {k: {kk: vv for kk, vv in v.items()} for k, v in dg["prises"].items()},
            "repere_des_prises": "repère métrique de l'os RightHand (origine de l'os, axes de l'os, sans l'échelle 0,01 du squelette): récipient = main · (position_m, quaternion_xyzw)",
        }
    else:
        persos[-1]["doigts"] = None

covers = [i["id"] for i in cat["items"] if i["category"] in ("paint", "wallpaper", "floor")]
ids_modeles = {o["id"] for o in objets}
attendus = [i["id"] for i in cat["items"]] + [p["id"] for p in eq["purchases"] if p.get("size")]
manquants = [i for i in attendus if i not in ids_modeles and i not in covers]

out = {
    "format": "deux-tabliers.modeles",
    "version": "demo-0.1",
    "repere": {
        "unite": "mètre", "haut": "+Y", "avant": "+Z (glTF): l'avant d'un meuble est le côté où l'on s'assoit, où l'on travaille, ou la face vue",
        "coques": "coordonnées du plan (plans.json, village): x = x du plan, z = y du plan; se posent sans transformation",
        "pivots": {"sol": "centre de l'emprise au sol, y = 0", "surface": "centre du dessous de l'objet", "mur": "au dos de l'objet, au milieu du bas (le mur est derrière, côté -Z)",
                   "plafond": "point d'accroche au plafond, l'objet pend vers -Y", "store": "au milieu du câble ou de l'attache, l'objet pend vers -Y",
                   "facade": "comme mur, sur la façade (côté rue)", "vitrine": "au dos, sur la vitre", "appui": "centre du dessous, sur l'appui d'une fenêtre"},
        "rotation_dispositions": "rotation_deg autour de +Y: l'avant (+Z) devient (sin r, 0, cos r); 0 = sud, 90 = est, 180 = nord, -90 = ouest",
    },
    "materiaux": {
        "dt_meubles": "matériau partagé de tous les meubles et objets (atlas couleur textures/meubles_atlas.jpg, rugosité et métal textures/meubles_orm.png, même UV); occlusion cuite dans COLOR_0 à multiplier. Un seul programme pour un BatchedMesh",
        "dt_verre": "transparent (vitrines, verres, cloches): programme verre et liquides",
        "dt_lampe": "abat-jour et ampoules allumés (émissif lamp_shade): à éteindre ou rallumer par le jeu",
        "dt_badge_joueur": "badge de 3 cm des avatars: matériau blanc à teinter à la couleur du joueur (Duo)",
        "shell_*": "coque: texture de matière répétée (1 m par tuile) + carte de lumière cuite (textures/shell_village_lightmap.png) en occlusion sur TEXCOORD_1, à rebrancher en lightMap avec lightMapIntensity = lightmap_scale x PI (extra du nœud)",
        "street_*": "la cour (carte de la coque) et la place du Tilleul (street_place_*, sa propre carte textures/shell_village_place_lightmap.png et son lightmap_scale): intensité x 0,42 (dehors en plein soleil, sinon la place sort blanche). Les street_place_* portent leurs teintes en COLOR_0 (pierre, enduits, volets): vertexColors",
        "dt_ciel": "ciel (dôme de 70 m, image textures/place_ciel.jpg) et lointain (toits au-delà de la place, collines; couleurs de sommets sur le bandeau blanc de la même image): sans lumière (MeshBasicMaterial, vertexColors), un seul appel",
        "metaux": "cuivre, laiton, inox ont metalness 1: il leur faut un environnement (capture de la salle au chargement, comme l'essai), sinon ils sortent noirs",
    },
    "variantes_coque": {
        "materiau_murs": "shell_wall_paint (murs de la salle et de la pièce du fond; le plafond est shell_ceiling, la façade côté rue est en pierre)",
        "materiau_sol": "shell_floor (salle); shell_floor_fond (pièce du fond, tomettes)",
        "regle": "peinture: garder textures/mur_enduit.jpg et mettre la teinte en couleur du matériau (sRGB, divisée par 0,70 en linéaire comme à l'export); papier peint: remplacer la texture et mettre la couleur en blanc; sol: remplacer la texture du sol (même UV, 1 m par tuile)",
        **coque["variantes"],
    },
    "coques": [
        {"id": "shell_village", "fichier": "shell_village.glb", "noeuds": {
            "shell_village": "salle, comptoir fixe et arrière-comptoir, poutres, menuiseries, cabinet de toilette, ardoise murale, deux suspensions fixes",
            "shell_village_glass": "vitrages", "shell_village_glow": "abat-jour allumés des suspensions fixes",
            "shell_village_fond_ferme": "pan qui ferme l'arche avec la porte de la pièce du fond: le cacher quand village_fond est acheté"},
         "triangles": coque["shell_village"]["triangles"], "materiaux": coque["shell_village"]["materiaux"], "poids_octets": os.path.getsize(os.path.join(ASSETS, "shell_village.glb"))},
        {"id": "shell_village_place", "fichier": "shell_village_place.glb", "noeuds": {
            "shell_village_place": "la place du Tilleul cuite: étages et toit du café, banc de la patronne, boulangerie, ruelle du Lavoir, maisons, mairie-école, église, fontaine, tilleul, arrêt du car, bancs, réverbères, vélos, sols",
            "shell_village_sky": "ciel de fin d'après-midi et lointain (toits du village, coteau, collines), sans lumière"},
         "triangles": coque["shell_village_place"]["triangles"], "materiaux": coque["shell_village_place"]["materiaux"],
         "poids_octets": os.path.getsize(os.path.join(ASSETS, "shell_village_place.glb"))},
        {"id": "shell_village_ext_fond", "fichier": "shell_village_ext_fond.glb", "extension": "village_fond",
         "noeuds": {"shell_village_ext_fond": "pièce du fond (arche, cheminée, fenêtre sur la cour) et la cour vue par la fenêtre"},
         "triangles": coque["shell_village_ext_fond"]["triangles"], "materiaux": coque["shell_village_ext_fond"]["materiaux"],
         "poids_octets": os.path.getsize(os.path.join(ASSETS, "shell_village_ext_fond.glb"))},
        {"id": "shell_village_ext_terrasse", "fichier": "shell_village_ext_terrasse.glb", "extension": "village_terrasse",
         "noeuds": {"shell_village_ext_terrasse": "store banne rayé (matériau dt_meubles, lumière dynamique)"},
         "triangles": fiches.get("shell_village_ext_terrasse", {}).get("triangles"), "poids_octets": os.path.getsize(os.path.join(ASSETS, "shell_village_ext_terrasse.glb"))},
    ],
    "cuisson": coque["cuisson"],
    "postes_dans_la_coque": {
        "machine": {"modele": "station_espresso_2g", "position": [9.15, 0.95, 9.005], "rotation_deg": 180},
        "moulin": {"modele": "station_grinder", "position": [9.78, 0.95, 9.04], "rotation_deg": 180},
        "caisse": {"modele": "station_caisse", "position": [10.6, 0.95, 9.01], "rotation_deg": 180},
        "plonge": {"modele": "station_sink", "position": [7.55, 0.9, 7.4], "rotation_deg": 0},
        "lave_verres": {"modele": "station_dishwasher", "position": [7.555, 0.0, 7.7], "rotation_deg": 0},
        "frigo": "dans la coque (façade inox sous l'arrière-comptoir, x 8,00 à 8,75)",
        "ardoise_murale": "dans la coque: x 8,83 à 9,85, y 1,27 à 2,17 m, plan z = 7,145 (zone d'écriture, Caveat)",
    },
    "dispositions": ["dispositions/village_arrivee.json", "dispositions/village_terrasse.json", "dispositions/village_fond.json"],
    "objets": objets,
    "personnages": persos,
    "non_modelises": {"revetements": {c: "texture (variantes_coque)" for c in covers}, "a_remplacer_par_un_substitut": manquants},
}
json.dump(out, open(os.path.join(ASSETS, "modeles.json"), "w"), ensure_ascii=False, indent=1)
tot = sum(os.path.getsize(p) for p in glob.glob(os.path.join(ASSETS, "**", "*"), recursive=True) if os.path.isfile(p))
print(f"{len(objets)} objets, {len(persos)} personnages, manquants: {manquants}; dossier: {tot / 1e6:.1f} Mo")
hors = [(o["id"], o["triangles"], o["budget_triangles"]) for o in objets if not o["dans_budget"]]
print("hors budget:", hors)
ecarts = [(o["id"], o["ecart_catalogue_m"]) for o in objets if "ecart_catalogue_m" in o and max(abs(v) for v in o["ecart_catalogue_m"].values()) > 0.08]
print("écarts au catalogue > 8 cm:", ecarts)

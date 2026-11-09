"""Mises en place par défaut d'Ormeval et contrôle des assises (Python seul, sans Blender).

Usage: python3 dispositions.py   (écrit assets/modeles/dispositions/*.json, sort 1 si une assise ne regarde pas sa table)

Repère: x = x du plan, z = y du plan (sud), y = hauteur; rotation_deg autour de +Y: l'avant du modèle (+Z) devient
(sin r, cos r): 0 = sud, 90 = est, 180 = nord, -90 = ouest. Règles de la demande du client (2026-11-07):
- chaque assise posée près d'une table a son avant tourné vers la table, à moins de 30 degrés;
- le point d'assise est à 0,25 m environ du bord de la table (tolérance 0,15 à 0,40 m).
Pourquoi ces places: celles des plans `village-arrivee` (salle) et `village-maximum` (terrasse, pièce du fond).
"""

import json
import math
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(ICI, "..", "..", "assets", "modeles"))
FICHES = {}
for f in ("meubles.json", "objets.json"):
    p = os.path.join(ICI, "fiches", f)
    if os.path.exists(p):
        FICHES.update(json.load(open(p)))

W, Ea, N, S_ = -90, 90, 180, 0  # rotation qui tourne l'avant vers l'ouest, l'est, le nord, le sud


def o(ident, x, z, rot=0, y=0.0, note=None):
    d = {"id": ident, "x": round(x, 3), "y": round(y, 3), "z": round(z, 3), "rotation_deg": rot}
    if note:
        d["pourquoi"] = note
    return d


def chaises_autour(table_id, tx, tz, places, rot_table=0, chaise="chaise_paillee", gap=0.25):
    """Chaises face à la table: places = côtés ('w', 'e', 'n', 's'). Le point d'assise est à `gap` du bord."""
    f = FICHES[table_id]["pose_dessus"]
    hw, hd = f["largeur_x"] / 2, f["profondeur_z"] / 2
    if rot_table in (90, -90, 270):
        hw, hd = hd, hw
    seat_off = FICHES[chaise]["assises"][0]["position"][2]  # avance du point d'assise sur l'origine (vers l'avant)
    out = []
    for side in places:
        if side == "w":
            out.append(o(chaise, tx - hw - gap - seat_off, tz, Ea))
        elif side == "e":
            out.append(o(chaise, tx + hw + gap + seat_off, tz, W))
        elif side == "n":
            out.append(o(chaise, tx, tz - hd - gap - seat_off, S_))
        elif side == "s":
            out.append(o(chaise, tx, tz + hd + gap + seat_off, N))
    return out


def arrivee():
    L = []
    # trois guéridons le long de la vitrine (plan: table-1 à 3), décollés de 5 cm du mur
    for x in (4.8, 6.4, 8.0):
        L.append(o("gueridon_marbre", x, 12.15, 0, note="table de la vitrine (plan village-arrivee)"))
        L += chaises_autour("gueridon_marbre", x, 12.15, ["w", "e"])
    # table de ferme contre le mur ouest (plan: table-4), longue dans le sens nord-sud, chaises aux deux bouts
    L.append(o("table_ferme", 4.36, 10.35, 90, note="contre le mur ouest, au sud des toilettes (cloison à 9,20)"))
    L += chaises_autour("table_ferme", 4.36, 10.35, ["n", "s"], rot_table=90)
    L.append(o("applique_laiton", 4.0, 10.35, Ea, y=1.75, note="au-dessus de la table de ferme, platine sur le mur ouest"))
    L.append(o("horloge_ecole", 6.4, 7.1, S_, y=2.24, note="sur le refend au-dessus de la porte du fond: lisible du comptoir et de la salle"))
    L.append(o("bocal_biscuits", 8.4, 9.37, S_, y=1.10, note="sur la tablette des clients, près de la passe"))
    L.append(o("station_espresso_2g", 9.15, 9.005, 180, y=0.95, note="poste machine du plan (eau et prise de 32 A)"))
    L.append(o("station_grinder", 9.78, 9.04, 180, y=0.95, note="poste moulin du plan, à droite de la machine pour le barista"))
    L.append(o("station_caisse", 10.6, 9.01, 180, y=0.95, note="poste caisse du plan, au bout du comptoir côté porte"))
    L.append(o("station_ticket_rail", 8.35, 9.31, 180, y=2.65, note="sous la solive à 9,31, au-dessus de la passe; tickets vers le barista"))
    L.append(o("station_sink", 7.55, 7.4, S_, y=0.90, note="plonge du plan (arrivée d'eau du refend)"))
    L.append(o("station_dishwasher", 7.555, 7.70, S_, note="lave-verres sous l'évier, devant le placard"))
    L.append(o("station_vitrine", 9.35, 7.38, S_, y=0.90, note="sur l'arrière-comptoir, sous l'ardoise murale, vue des clients par-dessus le comptoir"))
    L.append(o("station_cup_shelf", 8.38, 7.36, S_, y=0.90, note="sur l'arrière-comptoir, entre la plonge et la vitrine"))
    L.append(o("station_bouilloire", 8.22, 9.0, 180, y=0.95, note="bout ouest du plan de travail, près de la passe"))
    L.append(o("ardoise_trottoir", 8.5, 13.3, S_, note="sur le trottoir, à côté de la porte, tournée vers la place"))
    return L


def terrasse():
    L = []
    for x in (5.5, 7.4):
        L.append(o("gueridon_marbre", x, 14.75, 0, note="sous le store (plan village-maximum, table-6 et 7)"))
        L += chaises_autour("gueridon_marbre", x, 14.75, ["w", "e"], chaise="chaise_fer_peint")
    L.append(o("jardinieres_terrasse", 4.35, 15.25, S_, note="jardinière du plan (furniture-6), bord ouest de la terrasse"))
    return L


def fond():
    L = []
    L.append(o("table_basse_malle", 5.25, 4.7, 0, note="entre les deux fauteuils, devant la cheminée"))
    L.append(o("fauteuil_crapaud", 4.475, 4.7, Ea, note="plan village-maximum, seat-1: tourné vers la table basse et le feu"))
    L.append(o("fauteuil_crapaud", 6.025, 4.7, W, note="plan village-maximum, seat-2"))
    L.append(o("gueridon_marbre", 7.62, 4.95, 0, note="table pour deux (plan: table-1 de la pièce du fond)"))
    L += chaises_autour("gueridon_marbre", 7.62, 4.95, ["n", "s"])
    return L


def controle(L, nom):
    """Chaque assise près d'une table: avant vers la table (moins de 30 degrés), assise à 0,15 à 0,40 m du bord."""
    tables = [it for it in L if FICHES.get(it["id"], {}).get("categorie") == "table"]
    erreurs, lignes = [], []
    for it in L:
        f = FICHES.get(it["id"], {})
        if not f.get("assises") or f.get("categorie") not in ("chaise", "fauteuil", "tabouret", "banc", "banquette"):
            continue
        r = math.radians(it["rotation_deg"])
        fx, fz = math.sin(r), math.cos(r)
        sp = f["assises"][0]["position"]
        sx = it["x"] + sp[0] * math.cos(r) + sp[2] * math.sin(r)
        sz = it["z"] - sp[0] * math.sin(r) + sp[2] * math.cos(r)
        best = None
        for t in tables:
            d = math.hypot(t["x"] - sx, t["z"] - sz)
            if best is None or d < best[0]:
                best = (d, t)
        if best is None or best[0] > 1.2:
            lignes.append(f"{it['id']} ({it['x']}, {it['z']}): pas de table à moins de 1,20 m")
            continue
        t = best[1]
        dx, dz = t["x"] - sx, t["z"] - sz
        ang = math.degrees(math.acos(max(-1, min(1, (fx * dx + fz * dz) / math.hypot(dx, dz)))))
        ft = FICHES[t["id"]]["pose_dessus"]
        tr = math.radians(t["rotation_deg"])
        # distance du point d'assise au bord de la table (rectangle ou disque)
        lx = dx * math.cos(tr) - dz * math.sin(tr)
        lz = dx * math.sin(tr) + dz * math.cos(tr)
        if ft["forme"] == "rond":
            bord = math.hypot(dx, dz) - ft["largeur_x"] / 2
        else:
            ex = max(abs(lx) - ft["largeur_x"] / 2, 0)
            ez = max(abs(lz) - ft["profondeur_z"] / 2, 0)
            bord = math.hypot(ex, ez)
        ok = ang < 30 and 0.15 <= bord <= 0.40
        lignes.append(f"{'OK ' if ok else 'ERR'} {it['id']} ({it['x']}, {it['z']}) rot {it['rotation_deg']}: angle vers {t['id']} {ang:.1f} deg, assise à {bord:.2f} m du bord")
        if not ok:
            erreurs.append(lignes[-1])
    print(f"== {nom}")
    print("\n".join(lignes))
    return erreurs


def dossiers():
    """Contrôle géométrique de l'avant déclaré: sur chaque assise à dossier, les sommets au-dessus de l'assise + 0,15 m
    doivent être derrière (z glTF négatif); le dossier est la seule chose haute d'une chaise."""
    sys.path.insert(0, os.path.join(ICI, "verifier"))
    import importlib.util
    spec = importlib.util.spec_from_file_location("ig", os.path.join(ICI, "verifier", "inspecter_glb.py"))
    erreurs = []
    for ident, f in sorted(FICHES.items()):
        if f.get("categorie") not in ("chaise", "fauteuil", "banquette") or not f.get("assises"):
            continue
        sys_argv = sys.argv
        sys.argv = [sys.argv[0]]
        ig = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(ig)
        sys.argv = sys_argv
        g, b = ig.lire(os.path.join(ASSETS, f["fichier"]))
        zs = []
        for m in g["meshes"]:
            for pr in m["primitives"]:
                pos = ig.accessor(g, b, pr["attributes"]["POSITION"])
                zs += [p[2] for p in pos if p[1] > f["assises"][0]["position"][1] + 0.15]
        moy = sum(zs) / max(1, len(zs))
        ok = moy < -0.02
        print(f"{'OK ' if ok else 'ERR'} {ident}: dossier à z moyen {moy:+.3f} m (avant déclaré +Z)")
        if not ok:
            erreurs.append(ident)
    return erreurs


def main():
    out = os.path.join(ASSETS, "dispositions")
    os.makedirs(out, exist_ok=True)
    err = dossiers()
    for nom, fn, ext in (("village_arrivee", arrivee, []), ("village_terrasse", terrasse, ["terrasse"]), ("village_fond", fond, ["fond"])):
        L = fn()
        err += controle(L, nom)
        manquants = sorted({it["id"] for it in L if not os.path.exists(os.path.join(ASSETS, it["id"] + ".glb"))})
        json.dump({"format": "deux-tabliers.disposition", "version": "demo-0.1", "nom": nom, "extensions": ext,
                   "repere": "x = x du plan, z = y du plan (sud), y = hauteur; rotation_deg autour de +Y, 0 = avant au sud",
                   "objets": L, "modeles_manquants": manquants}, open(os.path.join(out, nom + ".json"), "w"), ensure_ascii=False, indent=1)
    if err:
        print("ERREURS:\n" + "\n".join(err))
        sys.exit(1)
    print("toutes les assises regardent leur table")


main()

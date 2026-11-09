"""Modèles Meshy mis en conformité pour l'essai (voir conformer_meshy.py).

Un modèle conforme est un JSON léger (`<asset>_<variante>.json` dans essai-style/meshy/): sommets en mètres dans
le repère du plan (origine au centre de l'emprise au sol, avant vers le sud), faces triangulées et clé de matière
par face. Le script de construction le pose autant de fois qu'il faut dans un Geo.
"""

import json
import os

from geo import Geo, P


def disponible(dossier, asset, variante):
    chemin = os.path.join(dossier, f"{asset}_{variante}.json")
    if not os.path.exists(chemin):
        return None
    with open(chemin) as fh:
        return json.load(fh)


def poser(modele, g, x, y, cap, z=0.0, echelle=1.0):
    """Pose le modèle en (x, y, z) du plan, tourné vers `cap` (0 nord, 90 est, 180 sud, 270 ouest; le modèle
    regarde le sud au repos)."""
    bm = g.bm
    vs = [bm.verts.new(P(px * echelle, py * echelle, pz * echelle)) for px, py, pz in modele["verts"]]
    faces = []
    for (a, b, c), k in zip(modele["faces"], modele["keys"]):
        try:
            f = bm.faces.new((vs[a], vs[b], vs[c]))
        except ValueError:
            continue
        f.material_index = g.mi(k)
        f.smooth = modele.get("smooth", True)
        faces.append(f)
    Geo.rotate_z(vs, 0, 0, cap - 180)
    Geo.move(vs, x, y, z)
    return vs

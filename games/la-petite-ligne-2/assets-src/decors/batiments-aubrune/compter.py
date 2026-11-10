"""Compte les triangles de chaque fiche sans Blender (réglage rapide d'une fiche).

    python3 compter.py <dossier des fiches> [id]
"""

import json
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)

import assembleur  # noqa: E402


def main():
    with open(os.path.join(ICI, "teintes.json"), encoding="utf8") as f:
        nuancier = json.load(f)
    dossier = sys.argv[1]
    for nom in sorted(os.listdir(dossier)):
        if not nom.endswith(".json"):
            continue
        with open(os.path.join(dossier, nom), encoding="utf8") as f:
            fiche = json.load(f)
        if len(sys.argv) > 2 and fiche["id"] != sys.argv[2]:
            continue
        try:
            s, notice = assembleur.assembler(fiche, nuancier)
        except assembleur.FicheInvalide as erreur:
            print(f"{fiche['id']}: FICHE INVALIDE: {erreur}")
            continue
        print(f"{fiche['id']}: {s.triangles} triangles, {s.morceaux} morceaux, hauteur {notice['hauteur']} m, {s.triangles_par_materiau()}")


if __name__ == "__main__":
    main()

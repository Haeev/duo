"""Contrôle de la règle des travées, sans Blender (lancé par `tests/batiments.test.ts`).

    python3 controle_facades.py <dossier des fiches>

1. Chaque fiche s'assemble, sans ouverture décentrée ni étage signalé (ni aligné ni symétrique).
2. Des fiches factices montrent la règle: une fenêtre placée hors du milieu de sa travée est
   refusée, acceptée avec sa raison; des vitraux entre contreforts tombent au milieu de leur
   travée; un étage moins garni se pose sur les axes du rez-de-chaussée; une porte d'étage sans
   escalier est refusée. Écrit `ok` à la fin, ou la liste des fautes.
"""

from __future__ import annotations

import copy
import json
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)

import assembleur as A  # noqa: E402
import pieces as P  # noqa: E402

FAUTES: list[str] = []


def faute(message: str) -> None:
    FAUTES.append(message)


def releve(fiche: dict, nuancier: dict) -> list[tuple[str, str, float, float]]:
    """Assemble une fiche et rend ses ouvertures: (façade, sorte, x, bas du tableau)."""
    poses: list[tuple[str, str, float, float]] = []
    courant = [""]
    facade, fenetre, porte = A._facade, P.trou_fenetre, P.trou_porte

    def _facade(s, c, cote, *a, **k):
        courant[0] = cote if c.principal else f"{c.d.get('nom', '')} {cote}"
        return facade(s, c, cote, *a, **k)

    def _fenetre(T, x, y, largeur=0.95, hauteur=1.25):
        poses.append((courant[0], "fenetre", round(x, 3), round(y, 3)))
        return fenetre(T, x, y, largeur, hauteur)

    def _porte(T, x, modele="pleine", niveau=0.0):
        poses.append((courant[0], "porte", round(x, 3), niveau))
        return porte(T, x, modele, niveau)

    A._facade, P.trou_fenetre, P.trou_porte = _facade, _fenetre, _porte
    try:
        s, _notice = A.assembler(fiche, nuancier)
    finally:
        A._facade, P.trou_fenetre, P.trou_porte = facade, fenetre, porte
    for signal in s.signalements:
        faute(f"{fiche['id']}: {signal}")
    return poses


def refusee(fiche: dict, nuancier: dict, morceau: str) -> bool:
    try:
        A.assembler(fiche, nuancier)
    except A.FicheInvalide as erreur:
        return morceau in str(erreur)
    return False


def main() -> None:
    with open(os.path.join(ICI, "teintes.json"), encoding="utf8") as f:
        nuancier = json.load(f)
    dossier = sys.argv[1]
    for nom in sorted(os.listdir(dossier)):
        if nom.endswith(".json"):
            with open(os.path.join(dossier, nom), encoding="utf8") as f:
                fiche = json.load(f)
            try:
                releve(fiche, nuancier)
            except A.FicheInvalide as erreur:
                faute(f"{fiche['id']}: {erreur}")

    base = {
        "id": "factice",
        "emprise": {"largeur": 8, "profondeur": 6},
        "niveaux": 2,
        "finition": "pierre",
        "toit": {"forme": "deux-pans"},
        "porte": {"facade": "sud", "position": 0.5, "modele": "pleine"},
        "facades": {"sud": {"rdc": ["fenetre", "porte", "fenetre"], "etage": ["fenetre", "fenetre"]}},
    }
    # Un étage de deux fenêtres sur un rez-de-chaussée de trois: au-dessus des fenêtres.
    poses = releve(copy.deepcopy(base), nuancier)
    rdc = sorted(x for c, t, x, y in poses if c == "sud" and t == "fenetre" and y < 2)
    haut = sorted(x for c, t, x, y in poses if c == "sud" and t == "fenetre" and y > 2)
    if rdc != haut or abs(rdc[0] + rdc[1]) > 0.02:
        faute(f"étage non aligné: rez-de-chaussée {rdc}, étage {haut}")
    # Une fenêtre placée hors du milieu de sa travée: refusée sans raison, acceptée avec.
    decalee = copy.deepcopy(base)
    decalee["facades"]["est"] = {"rdc": [{"type": "fenetre", "position": 0.3}]}
    if not refusee(decalee, nuancier, "décentrée"):
        faute("une fenêtre décentrée sans raison n'est pas refusée")
    decalee["facades"]["est"]["rdc"][0]["raison"] = "la pendule occupe l'autre moitié du mur"
    if refusee(decalee, nuancier, "décentrée"):
        faute("une fenêtre décentrée avec sa raison est refusée")
    # Des vitraux entre des contreforts: chacun au milieu de sa travée.
    nef = copy.deepcopy(base)
    nef.update(emprise={"largeur": 15, "profondeur": 8}, niveaux=1, hauteurMurs=5.6, porte={"facade": "ouest", "position": 0.5, "modele": "pleine"})
    nef["facades"] = {"nord": {"rdc": ["vitrail"] * 5}}
    nef["options"] = [{"piece": "contrefort", "facade": "nord", "position": p} for p in (0.2, 0.4, 0.6, 0.8)]
    poses = releve(nef, nuancier)
    xs = sorted(x for c, t, x, y in poses if c == "nord")
    contreforts = [-4.5, -1.5, 1.5, 4.5]
    demi = A.PILIERS["contrefort"] / 2 + A.JEU_PILIER
    gauches = [-7.5 + A.MARGE] + [c + demi for c in contreforts]
    droites = [c - demi for c in contreforts] + [7.5 - A.MARGE]
    if len(xs) != 5:
        faute(f"{len(xs)} vitraux posés sur 5")
    for x, a, b in zip(xs, gauches, droites):
        if abs(x - (a + b) / 2) > 0.1:
            faute(f"vitrail à {x:.2f} m hors du milieu de sa travée ({a:.2f} à {b:.2f} m)")
    # Une porte d'étage sans escalier ne mène nulle part.
    perchee = copy.deepcopy(base)
    perchee["facades"]["est"] = {"etage": [{"type": "porte-service", "position": 0.5}]}
    if not refusee(perchee, nuancier, "escalier"):
        faute("une porte d'étage sans escalier n'est pas refusée")
    perchee["options"] = [{"piece": "escalier", "facade": "est", "position": 0.5}]
    if refusee(perchee, nuancier, ""):
        faute("une porte d'étage avec son escalier est refusée")
    print("\n".join(FAUTES) if FAUTES else "ok")


if __name__ == "__main__":
    main()

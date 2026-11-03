#!/usr/bin/env python3
"""Aperçus d'une carte de La Petite Ligne: vue de dessus légendée et vue isométrique.

Sorties, à côté de la carte:
- halte-apercu.png: vue de dessus (couleur par code de terrain, bâtiments en blocs légendés,
  points numérotés, trajets des habitants, zones en pointillés);
- halte-apercu-iso.png: blockout vu par la caméra par défaut (sud-est, 35,264 degrés), pour
  voir ce que les volumes cachent (un repère caché disparaît derrière ce qui le masque).

Usage: python3 games/la-petite-ligne/outils/apercu_carte.py [carte.json]
Écrit un SVG en Python (bibliothèque standard), puis le convertit avec rsvg-convert
(boîte à outils du studio: bash outils/installer-outils.sh).
"""

from __future__ import annotations

import json
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from xml.sax.saxutils import escape

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
from valider_carte import (  # noqa: E402
    CARTE_PAR_DEFAUT, boites_occultantes, emprise_monde, est_porte, hauteur_toit, origine, ouvertures,
)

COULEURS = {
    ".": "#a7c97a", ",": "#8bb563", ":": "#d9bf8c", "+": "#c4bcae", "p": "#9a6a45",
    "~": "#4f8fc0", "g": "#8fc0dc", "b": "#e6d7aa", "=": "#9a9186", "#": "#b08657",
    "q": "#d3c9b8", "s": "#a8806a", "X": "#5d7650",
    "r": "#3f86c4", "P": "#b3a998", "Y": "#a77b4f", "j": "#b9c6cc",
    # 0.13
    "h": "#6f9a58", ";": "#c8ad7a", "c": "#d6d0c2", "l": "#86603d", "f": "#9aa35e", "v": "#a98a5a",
    "e": "#5a9ab0", "k": "#3f7fb8",
}
# 0.13: les arbres du bois et des vergers (couleur, rayon du houppier dessiné en m).
ARBRES = {"tree_oak": ("#3f7a34", 1.5), "tree_fir": ("#2c5a3a", 1.1), "tree_apple": ("#6f9a3a", 1.3),
          "tree_beech": ("#4f8a3c", 1.7), "tree_chestnut": ("#5c7f2e", 1.6), "tree_birch": ("#8fb05a", 1.1),
          "tree_old_oak": ("#2f6a2a", 2.6), "tree_pear": ("#7aa045", 1.3), "tree_plum": ("#7d6aa0", 1.2),
          "tree_cherry": ("#a85a6a", 1.3), "tree_walnut": ("#4f7a3a", 1.6), "tree_lime": ("#6a9a4a", 1.5),
          "snag_tree": ("#7a6a5a", 0.4)}
BATIMENTS = {
    "station": ("#c9824f", "La halte"),
    "gatekeeper_house": ("#e0a35c", "Maisonnette"),
    "ferrand_shop": ("#d26b5c", "Épicerie-pension Ferrand"),
    "firmin_house": ("#b9895e", "Maison de Firmin"),
    "sawmill": ("#9c6b45", "Scierie de Basile"),
    "handcar_shed": ("#7f6a58", "Remise"),
    "henhouse": ("#c7a774", "Poulailler"),
    "bakehouse": ("#c99a5b", "Fournil"),
    "salon_shop": ("#b07aa1", "Mercerie-coiffure"),
    "lucie_house": ("#d8b26e", "Maison de Lucie"),
    "school_house": ("#9fa7b5", "École-mairie"),
    "school_yard": ("#c9c2b0", "Cour de l'école"),
    # 0.13
    "church": ("#d9cfb8", "Église Saint-Aubin"),
    "presbytery_house": ("#c8b48c", "Presbytère"),
    "village_house_a": ("#d6b98a", "Maison"),
    "village_house_b": ("#d2a878", "Maison"),
    "cafe_house": ("#c98a6a", "Café de la Côte"),
    "forge_shop": ("#8a7a6a", "Forge"),
    "joinery_shop": ("#a8865a", "Menuiserie"),
    "farm_house": ("#d8b88a", "Logis de la ferme"),
    "farm_barn": ("#a8784a", "Grange-étable"),
    "washhouse": ("#b8b0a0", "Lavoir"),
    "watermill": ("#c0a080", "Moulin de la Vanne"),
    "lineman_house": ("#c89a6a", "Cheminots"),
    "forester_house": ("#b8644a", "Maison forestière"),
}
HABITANTS = {"firmin": "#2f5fa8", "odette": "#b33a3a", "basile": "#7a4a1f", "jeanne": "#7b3fa0",
             "achille": "#c27c0e", "solange": "#1f8a70"}
ZONES_TRACEES = {
    "garden": ("#fff2c4", "potager (12 cases)"),
    "forest_edge": ("#ffd166", "lisière: 12 arbres à couper"),
    "train_at_platform": ("#ffffff", "train à quai (samedi)"),
    "house_plan_reserved": ("#ffe0b0", "réserve maison 14x12 (jeu complet)"),
    "garden_extension_reserved": ("#f7d9a6", "réserve potager 96 cases (jeu complet)"),
    "hen_pen": ("#fbe7c6", "poules"),
}
POLICE = "DejaVu Sans, Inter, sans-serif"


def svg_vers_png(svg: str, sortie: Path, largeur: int) -> None:
    outil = shutil.which("rsvg-convert")
    if outil is None:
        raise SystemExit("rsvg-convert introuvable: lancer bash outils/installer-outils.sh")
    with tempfile.TemporaryDirectory() as tmp:
        chemin = Path(tmp) / "apercu.svg"
        chemin.write_text(svg, encoding="utf-8")
        subprocess.run([outil, "-w", str(largeur), "-o", str(sortie), str(chemin)], check=True)


# ---------------------------------------------------------------------------
# Vue de dessus


def vue_de_dessus(carte: dict, region: tuple[int, int, int, int] | None = None, c: int = 16,
                  titre: str = "") -> tuple[str, int]:
    """Vue de dessus; `region` (x0, y0, x1, y1, bornes exclues à droite) pour une vue rapprochée."""
    larg, haut = carte["taille"]["largeur"], carte["taille"]["hauteur"]
    ox, oy = origine(carte)
    rx0, ry0, rx1, ry1 = region or (ox, oy, ox + larg, oy + haut)
    marge_g, marge_h = 34, 92
    panneau = 430
    complete = region is None
    W = marge_g + (rx1 - rx0) * c + 20 + (panneau if complete else 0)
    hauteur_panneau = marge_h + 17 * (len(carte["terrain"]["legende"]) + 2) + 15 * ((len(carte["points"]) + 1) // 2) \
        + 16 * (len(HABITANTS) + len(ZONES_TRACEES)) + 160
    H = max(marge_h + (ry1 - ry0) * c + 44, hauteur_panneau if complete else 0)
    types = carte["types"]
    interieurs = {b["objet"]: b for b in carte.get("interieurs", [])}
    out: list[str] = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
                      f'viewBox="0 0 {W} {H}" font-family="{POLICE}">',
                      f'<rect width="{W}" height="{H}" fill="#f6f1e6"/>']

    def X(x: float) -> float:
        return marge_g + (x - rx0) * c

    def Y(y: float) -> float:
        return marge_h + (y - ry0) * c

    out.append(f'<text x="{marge_g}" y="30" font-size="22" font-weight="bold" fill="#2b2b2b">'
               f'{escape(carte["nom"])}{escape(titre)}</text>')
    out.append(f'<text x="{marge_g}" y="52" font-size="13" fill="#555">Vue de dessus, 1 case = 1 m, nord en haut. '
               f'Blockout: formes simples, couleurs par code de terrain.</text>')
    out.append(f'<clipPath id="cadre"><rect x="{X(rx0)}" y="{Y(ry0)}" width="{(rx1 - rx0) * c}" '
               f'height="{(ry1 - ry0) * c}"/></clipPath><g clip-path="url(#cadre)">')

    lignes = carte["terrain"]["lignes"]
    for j, ligne in enumerate(lignes):
        y = j + oy
        if not ry0 - 1 <= y <= ry1:
            continue
        for i, code in enumerate(ligne):
            x = i + ox
            if not rx0 - 1 <= x <= rx1:
                continue
            out.append(f'<rect x="{X(x)}" y="{Y(y)}" width="{c}" height="{c}" fill="{COULEURS.get(code, "#f0f")}"/>')
            if code == "j":
                for k in range(3):
                    out.append(f'<ellipse cx="{X(x) + c * (0.25 + 0.25 * k)}" cy="{Y(y) + c * 0.5}" rx="{c * 0.12}" '
                               f'ry="{c * 0.18}" fill="#8d8a84" stroke="#555"/>')
            if code == "Y":
                for k in range(1, 4):
                    out.append(f'<line x1="{X(x) + k * c / 4}" y1="{Y(y)}" x2="{X(x) + k * c / 4}" y2="{Y(y) + c}" '
                               f'stroke="#6b4a2b" stroke-width="0.8"/>')
            if code == "=":
                for f in (0.31, 0.69):
                    out.append(f'<line x1="{X(x)}" y1="{Y(y) + c * f}" x2="{X(x) + c}" y2="{Y(y) + c * f}" '
                               f'stroke="#5b544b" stroke-width="1"/>')
            if code == "X":
                out.append(f'<line x1="{X(x)}" y1="{Y(y) + c}" x2="{X(x) + c}" y2="{Y(y)}" stroke="#4a6040" stroke-width="1"/>')
    # Bord jouable
    b = carte["taille"]["bord"]
    out.append(f'<rect x="{X(ox + b)}" y="{Y(oy + b)}" width="{(larg - 2 * b) * c}" height="{(haut - 2 * b) * c}" '
               f'fill="none" stroke="#2b2b2b" stroke-width="1.5" stroke-dasharray="6 4"/>')
    # Grille légère
    for x in range(rx0, rx1 + 1):
        out.append(f'<line x1="{X(x)}" y1="{Y(ry0)}" x2="{X(x)}" y2="{Y(ry1)}" stroke="#000" stroke-opacity="0.06"/>')
    for y in range(ry0, ry1 + 1):
        out.append(f'<line x1="{X(rx0)}" y1="{Y(y)}" x2="{X(rx1)}" y2="{Y(y)}" stroke="#000" stroke-opacity="0.06"/>')
    pas = 4 if complete else 2
    graduations = []
    for x in range(rx0 - rx0 % pas, rx1 + 1, pas):
        if x >= rx0:
            graduations.append(f'<text x="{X(x) + (c / 2 if not complete else 0)}" y="{Y(ry0) - 4}" font-size="9" '
                               f'fill="#666" text-anchor="middle">{x}</text>')
    for y in range(ry0 - ry0 % pas, ry1 + 1, pas):
        if y >= ry0:
            graduations.append(f'<text x="{X(rx0) - 4}" y="{Y(y) + 3 + (c / 2 if not complete else 0)}" '
                               f'font-size="9" fill="#666" text-anchor="end">{y}</text>')

    # Zones
    for z in carte["zones"]:
        if z["id"] not in ZONES_TRACEES:
            continue
        coul, _ = ZONES_TRACEES[z["id"]]
        r = z["rect"]
        out.append(f'<rect x="{X(r["x"]) + 1}" y="{Y(r["y"]) + 1}" width="{r["w"] * c - 2}" height="{r["h"] * c - 2}" '
                   f'fill="none" stroke="{coul}" stroke-width="2" stroke-dasharray="5 3"/>')

    # Objets
    for o in carte["objets"]:
        t = types[o["type"]]
        x0, y0, w, h = emprise_monde(o, types)
        cx, cy = X(o["x"]), Y(o["y"])
        if o["type"] in BATIMENTS:
            coul, nom = BATIMENTS[o["type"]]
            out.append(f'<rect x="{X(x0)}" y="{Y(y0)}" width="{w * c}" height="{h * c}" fill="{coul}" '
                       f'stroke="#3a2a1e" stroke-width="2"/>')
            if t.get("interieur"):
                decrit = interieurs.get(o["id"])
                pieces = [pc["rect"] for pc in decrit["pieces"] if not pc.get("a_batir")] if decrit else \
                    [{"x": x0 + 1, "y": y0 + 1, "w": w - 2, "h": h - 2}]
                for r in pieces:
                    out.append(f'<rect x="{X(r["x"])}" y="{Y(r["y"])}" width="{r["w"] * c}" height="{r["h"] * c}" '
                               f'fill="#ead8bf" stroke="#3a2a1e" stroke-width="1"/>')
                for m in (decrit or {}).get("mobilier", []):
                    for mx, my in m["cases"]:
                        out.append(f'<rect x="{X(mx) + 2}" y="{Y(my) + 2}" width="{c - 4}" height="{c - 4}" '
                                   f'fill="#7a5a3c" fill-opacity="0.75" rx="2"/>')
            d = c * 0.2
            for nom_o, ((dx, dy), _) in ouvertures(o, types).items():
                coul_p = "#3a2a1e" if est_porte(nom_o) else "#f4e3a1"
                out.append(f'<rect x="{X(dx) + d}" y="{Y(dy) + d}" width="{c - 2 * d}" height="{c - 2 * d}" '
                           f'fill="{coul_p}"/>')
            taille = 11 if w * h > 20 else 9
            if not complete:
                taille += 3
            ty = Y(y0) + 14 if t.get("interieur") else cy + 4
            out.append(f'<text x="{cx}" y="{ty}" font-size="{taille}" font-weight="bold" fill="#1d1208" '
                       f'text-anchor="middle">{escape(nom)}</text>')
        elif o["type"] == "platform":
            out.append(f'<rect x="{X(x0)}" y="{Y(y0)}" width="{w * c}" height="{h * c}" fill="none" '
                       f'stroke="#6b6152" stroke-width="2"/>')
            out.append(f'<text x="{X(x0) + 6}" y="{Y(y0) + 12}" font-size="10" fill="#3a3329">Quai</text>')
        elif o["type"] == "pontoon":
            out.append(f'<rect x="{X(x0)}" y="{Y(y0)}" width="{w * c}" height="{h * c}" fill="#a77b4f" stroke="#5a3e22"/>')
        elif o["type"] in ARBRES:
            coul, rayon = ARBRES[o["type"]]
            rayon *= c
            out.append(f'<circle cx="{cx}" cy="{cy}" r="{rayon}" fill="{coul}" fill-opacity="0.85"/>')
            out.append(f'<circle cx="{cx}" cy="{cy}" r="3" fill="#5b3a1e"/>')
            if o.get("coupable"):
                out.append(f'<circle cx="{cx}" cy="{cy}" r="{rayon}" fill="none" stroke="#ffd166" stroke-width="2"/>')
        elif o["type"] == "bush":
            out.append(f'<circle cx="{cx}" cy="{cy}" r="{0.45 * c}" fill="#5d8f45"/>')
        elif o["type"] == "rock":
            out.append(f'<circle cx="{cx}" cy="{cy}" r="{0.38 * c}" fill="#9a968d" stroke="#6d6a63"/>')
        elif o["type"] == "fence":
            if o["rotation"] % 2 == 0:
                out.append(f'<line x1="{X(x0)}" y1="{cy}" x2="{X(x0 + 1)}" y2="{cy}" stroke="#6b4a2b" stroke-width="3"/>')
            else:
                out.append(f'<line x1="{cx}" y1="{Y(y0)}" x2="{cx}" y2="{Y(y0 + 1)}" stroke="#6b4a2b" stroke-width="3"/>')
        elif o["type"] == "lamp_post":
            out.append(f'<circle cx="{cx}" cy="{cy}" r="3.5" fill="#f2c94c" stroke="#333"/>')
        else:
            couleurs = {"well": "#6d8fa8", "bench": "#8a5a32", "coop_crate": "#c48a3a", "notice_board": "#3e6b8a",
                        "bell_post": "#d4a017", "water_barrel": "#4f7fa0", "arbor": "#8fb36a",
                        "workbench": "#b5793f", "log_pile": "#9a6a3a", "barrel": "#8b5e3c",
                        "mailbox": "#c0392b", "station_sign": "#2f4f6f", "level_crossing_gate": "#d64545"}
            coul = couleurs.get(o["type"], "#777")
            out.append(f'<rect x="{X(x0) + 1.5}" y="{Y(y0) + 1.5}" width="{w * c - 3}" height="{h * c - 3}" '
                       f'fill="{coul}" stroke="#222" stroke-width="0.8" rx="2"/>')

    # Tour 10: pièces à bâtir (emprise en tirets, pièce, porte percée dans le mur commun) et ouvrages du ru.
    for b in carte.get("interieurs", []):
        for pc in b["pieces"]:
            if not pc.get("a_batir"):
                continue
            e, r = pc["emprise"], pc["rect"]
            out.append(f'<rect x="{X(e["x"])}" y="{Y(e["y"])}" width="{e["w"] * c}" height="{e["h"] * c}" '
                       f'fill="#e0a35c" fill-opacity="0.18" stroke="#8a5a2a" stroke-width="1.5" '
                       f'stroke-dasharray="6 3"/>')
            out.append(f'<rect x="{X(r["x"])}" y="{Y(r["y"])}" width="{r["w"] * c}" height="{r["h"] * c}" '
                       f'fill="none" stroke="#8a5a2a" stroke-width="1" stroke-dasharray="2 2"/>')
            for et in pc.get("etageres", []):
                out.append(f'<rect x="{X(et["x"]) + 3}" y="{Y(et["y"]) + 3}" width="{et["w"] * c - 6}" '
                           f'height="{et["h"] * c - 6}" fill="none" stroke="#5a3e22" stroke-dasharray="2 2"/>')
            px, py = pc["porte"]["cx"], pc["porte"]["cy"]
            out.append(f'<rect x="{X(px) + c * 0.2}" y="{Y(py) + c * 0.2}" width="{c * 0.6}" height="{c * 0.6}" '
                       f'fill="none" stroke="#3a2a1e" stroke-width="1.5" stroke-dasharray="2 1"/>')
            if not complete:
                out.append(f'<text x="{X(r["x"] + r["w"] / 2)}" y="{Y(r["y"] + r["h"] / 2) + 4}" font-size="12" '
                           f'font-style="italic" fill="#5a3e22" text-anchor="middle">{escape(pc["nom"])} '
                           f'(à bâtir)</text>')
    for ov in carte.get("ouvrages", []):
        r = ov["rect"]
        out.append(f'<rect x="{X(r["x"]) - 1}" y="{Y(r["y"]) - 1}" width="{r["w"] * c + 2}" height="{r["h"] * c + 2}" '
                   f'fill="none" stroke="#1d3557" stroke-width="2"/>')

    # Trajets des habitants
    for tr in carte.get("trajets", []):
        coul = HABITANTS.get(tr.get("habitant", ""), "#444")
        pts = " ".join(f"{X(x):.1f},{Y(y):.1f}" for x, y in tr["par"])
        out.append(f'<polyline points="{pts}" fill="none" stroke="{coul}" stroke-width="1.6" '
                   f'stroke-opacity="0.75" stroke-dasharray="4 2"/>')

    # Points numérotés
    liste = []
    for n, p in enumerate(carte["points"], start=1):
        px, py = X(p["x"]), Y(p["y"])
        coul = "#1f6feb" if p.get("peche") else "#2e8b57" if p.get("cueillette") else "#d1495b"
        if p.get("interieur"):
            coul = "#8e7cc3"
        out.append(f'<circle cx="{px}" cy="{py}" r="6.5" fill="{coul}" stroke="#fff" stroke-width="1.5"/>')
        out.append(f'<text x="{px}" y="{py + 3.2}" font-size="8" font-weight="bold" fill="#fff" '
                   f'text-anchor="middle">{n}</text>')
        if not complete and rx0 <= p["x"] < rx1 and ry0 <= p["y"] < ry1:
            out.append(f'<text x="{px + 8}" y="{py - 5}" font-size="9" fill="#111" stroke="#fff" stroke-width="2.5" '
                       f'paint-order="stroke">{escape(p["id"])}</text>')
        liste.append((n, p["id"], coul))
    out.append("</g>")
    out.extend(graduations)

    # Rose des vents, échelle, caméra
    rx = X(rx1) - 30
    out.append(f'<text x="{X(rx0)}" y="{Y(ry1) + 22}" font-size="11" fill="#333">10 m</text>')
    out.append(f'<line x1="{X(rx0) + 34}" y1="{Y(ry1) + 18}" x2="{X(rx0 + 10) + 34}" y2="{Y(ry1) + 18}" stroke="#333" '
               f'stroke-width="3"/>')
    out.append(f'<text x="{X(rx0 + 14) + 34}" y="{Y(ry1) + 22}" font-size="11" fill="#333">Caméra par défaut au '
               f'sud-est (regard vers le nord-ouest).</text>')
    out.append(f'<text x="{rx}" y="{Y(ry0) - 14}" font-size="12" font-weight="bold" fill="#333" '
               f'text-anchor="middle">N</text>')
    out.append(f'<line x1="{rx}" y1="{Y(ry0) - 26}" x2="{rx}" y2="{Y(ry0) - 40}" stroke="#333" stroke-width="2"/>')
    if not complete:
        out.append("</svg>")
        return "\n".join(out), W

    # Panneau de légende
    px0 = marge_g + (rx1 - rx0) * c + 22
    yy = marge_h
    out.append(f'<text x="{px0}" y="{yy}" font-size="14" font-weight="bold" fill="#2b2b2b">Terrain</text>')
    yy += 8
    for code, d in carte["terrain"]["legende"].items():
        yy += 17
        out.append(f'<rect x="{px0}" y="{yy - 11}" width="14" height="14" fill="{COULEURS.get(code, "#f0f")}" stroke="#555"/>')
        nom = d["nom"] if len(d["nom"]) < 46 else d["nom"][:44] + "..."
        bloque = "" if d["franchissable"] else " (bloque)"
        out.append(f'<text x="{px0 + 20}" y="{yy}" font-size="11" fill="#222">{escape(code)}  {escape(nom)}{bloque}</text>')
    yy += 26
    out.append(f'<text x="{px0}" y="{yy}" font-size="14" font-weight="bold" fill="#2b2b2b">Points</text>')
    colonne = 0
    y_debut = yy + 6
    for i, (n, ident, coul) in enumerate(liste):
        colonne = 0 if i < (len(liste) + 1) // 2 else 1
        rang = i if colonne == 0 else i - (len(liste) + 1) // 2
        ty = y_debut + 15 * (rang + 1)
        tx = px0 + colonne * 210
        out.append(f'<circle cx="{tx + 6}" cy="{ty - 4}" r="6" fill="{coul}"/>')
        out.append(f'<text x="{tx + 6}" y="{ty - 1}" font-size="7.5" font-weight="bold" fill="#fff" text-anchor="middle">{n}</text>')
        out.append(f'<text x="{tx + 16}" y="{ty}" font-size="10.5" fill="#222">{escape(ident)}</text>')
    yy = y_debut + 15 * ((len(liste) + 1) // 2 + 1) + 16
    out.append(f'<text x="{px0}" y="{yy}" font-size="14" font-weight="bold" fill="#2b2b2b">Trajets des habitants</text>')
    for nom, coul in HABITANTS.items():
        yy += 16
        out.append(f'<line x1="{px0}" y1="{yy - 4}" x2="{px0 + 22}" y2="{yy - 4}" stroke="{coul}" stroke-width="2" stroke-dasharray="4 2"/>')
        out.append(f'<text x="{px0 + 28}" y="{yy}" font-size="11" fill="#222">{nom.capitalize()}</text>')
    yy += 24
    out.append(f'<text x="{px0}" y="{yy}" font-size="14" font-weight="bold" fill="#2b2b2b">Zones (pointillés)</text>')
    for _, (coul, nom) in ZONES_TRACEES.items():
        yy += 16
        out.append(f'<rect x="{px0}" y="{yy - 10}" width="22" height="11" fill="#7a8f6a" stroke="{coul}" stroke-width="2" stroke-dasharray="5 3"/>')
        out.append(f'<text x="{px0 + 28}" y="{yy}" font-size="11" fill="#222">{escape(nom)}</text>')
    yy += 22
    out.append(f'<text x="{px0}" y="{yy}" font-size="11" fill="#222">Cercle doré: arbre à couper. Carré foncé sur une façade: porte;</text>')
    out.append(f'<text x="{px0}" y="{yy + 14}" font-size="11" fill="#222">carré clair: comptoir d\'Odette.</text>')
    out.append("</svg>")
    return "\n".join(out), W


# ---------------------------------------------------------------------------
# Vue isométrique (caméra au sud-est)

SIN_E = math.sin(math.radians(35.264))
COS_E = math.cos(math.radians(35.264))


def vue_iso(carte: dict) -> tuple[str, int]:
    larg, haut = carte["taille"]["largeur"], carte["taille"]["hauteur"]
    ox, oy = origine(carte)
    k = 15.0
    r2 = math.sqrt(0.5)
    dx = haut * r2 * k + 30

    def P(x: float, y: float, z: float) -> tuple[float, float]:
        x, y = x - ox, y - oy
        return (dx + (x - y) * r2 * k, 90 + 12 * k * COS_E + (x + y) * r2 * SIN_E * k - z * COS_E * k)

    W = int(dx + larg * r2 * k + 30)
    H = int(P(ox + larg, oy + haut, 0)[1] + 50)
    types = carte["types"]
    lignes = carte["terrain"]["lignes"]
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
           f'font-family="{POLICE}">', f'<rect width="{W}" height="{H}" fill="#dfe9f2"/>',
           f'<text x="20" y="30" font-size="20" font-weight="bold" fill="#2b2b2b">{escape(carte["nom"])}: '
           f'blockout vu par la caméra par défaut</text>',
           '<text x="20" y="52" font-size="12" fill="#444">Caméra orthographique au sud-est, élévation 35,264 degrés; '
           'bâtiments en volumes pleins au faîte (le vrai toit est plus bas aux égouts).</text>',
           '<text x="20" y="68" font-size="12" fill="#444">Repères rouges: lieux importants (un repère caché '
           'disparaît derrière le volume qui le masque).</text>']

    def poly(pts: list[tuple[float, float]], fill: str, stroke: str = "none", sw: float = 0.6) -> str:
        s = " ".join(f"{a:.1f},{b:.1f}" for a, b in pts)
        return f'<polygon points="{s}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'

    def teinte(hexa: str, f: float) -> str:
        r, g, b = int(hexa[1:3], 16), int(hexa[3:5], 16), int(hexa[5:7], 16)
        return "#%02x%02x%02x" % (min(255, int(r * f)), min(255, int(g * f)), min(255, int(b * f)))

    for j in range(haut):
        for i in range(larg):
            x, y = i + ox, j + oy
            out.append(poly([P(x, y, 0), P(x + 1, y, 0), P(x + 1, y + 1, 0), P(x, y + 1, 0)],
                            COULEURS.get(lignes[j][i], "#f0f"), "#000000", 0.15))

    # Colonnes à dessiner: (profondeur, ordre, svg)
    elements: list[tuple[float, int, list[str]]] = []

    def colonne(x0: float, y0: float, x1: float, y1: float, z0: float, z1: float, coul: str, toit: str | None = None) -> list[str]:
        haut_ = toit or teinte(coul, 1.1)
        return [
            poly([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], teinte(coul, 0.85), "#222", 0.3),
            poly([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], teinte(coul, 0.68), "#222", 0.3),
            poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], haut_, "#222", 0.3),
        ]

    volumes = {b[0]: b for b in boites_occultantes(carte, False)}
    for o in carte["objets"]:
        t = types[o["type"]]
        x0, y0, w, h = emprise_monde(o, types)
        if t["categorie"] == "sol":
            continue
        if o["type"] in BATIMENTS:
            coul = BATIMENTS[o["type"]][0]
            for yy in range(y0, y0 + h):
                for xx in range(x0, x0 + w):
                    # Toit à deux pans (types à `toit`): chaque colonne monte à la hauteur du toit en son milieu.
                    z1 = hauteur_toit(volumes[o["id"]], xx + 0.5, yy + 0.5) if o["id"] in volumes else t["hauteur"]
                    elements.append((xx + yy, 0, colonne(xx, yy, xx + 1, yy + 1, 0, z1, coul, "#8c4b3a")))
        elif o["type"] in ARBRES and "houppier" in t["occultation_arbre"]:
            cx, cy = o["x"], o["y"]
            occ = t["occultation_arbre"]
            tronc, houp = occ["tronc"], occ["houppier"]
            svg = colonne(cx - 0.2, cy - 0.2, cx + 0.2, cy + 0.2, 0, houp[1], "#6b4423")
            demi = houp[0] / 2 * 0.8
            coul = ARBRES[o["type"]][0]
            if o.get("coupable"):
                coul = "#5a9a3c" if o["type"] == "tree_oak" else "#3c7a4a"
            svg += colonne(cx - demi, cy - demi, cx + demi, cy + demi, houp[1], houp[2], coul)
            elements.append((math.floor(cx) + math.floor(cy) + 0.5, 1, svg))
        elif t["hauteur"] >= 0.5:
            coul = {"well": "#6d8fa8", "bench": "#8a5a32", "coop_crate": "#c48a3a", "notice_board": "#3e6b8a",
                    "bell_post": "#d4a017", "water_barrel": "#4f7fa0", "arbor": "#8fb36a", "workbench": "#b5793f",
                    "log_pile": "#9a6a3a", "barrel": "#8b5e3c", "mailbox": "#c0392b", "station_sign": "#2f4f6f",
                    "level_crossing_gate": "#d64545", "bush": "#5d8f45", "rock": "#9a968d", "fence": "#7a5534",
                    "lamp_post": "#444444"}.get(o["type"], "#777777")
            hz = t["hauteur"]
            if "occultation" in t and t["occultation"][0] < 0.6:
                demi = 0.15
                svg = colonne(o["x"] - demi, o["y"] - demi, o["x"] + demi, o["y"] + demi, 0, hz, coul)
            else:
                svg = colonne(x0 + 0.1, y0 + 0.1, x0 + w - 0.1, y0 + h - 0.1, 0, hz, coul)
            elements.append((x0 + w - 1 + y0 + h - 1, 0, svg))

    for n, p in enumerate(carte["points"], start=1):
        if not p.get("important") or p.get("interieur"):
            continue
        x, y = p["x"], p["y"]
        bas, haut_p = P(x, y, 0), P(x, y, 1.7)
        svg = [f'<line x1="{bas[0]:.1f}" y1="{bas[1]:.1f}" x2="{haut_p[0]:.1f}" y2="{haut_p[1]:.1f}" stroke="#b0182b" stroke-width="2"/>',
               f'<circle cx="{haut_p[0]:.1f}" cy="{haut_p[1]:.1f}" r="6" fill="#d1495b" stroke="#fff" stroke-width="1.2"/>',
               f'<text x="{haut_p[0]:.1f}" y="{haut_p[1] + 3:.1f}" font-size="7.5" font-weight="bold" fill="#fff" text-anchor="middle">{n}</text>']
        elements.append((math.floor(x) + math.floor(y) + 0.6, 2, svg))

    elements.sort(key=lambda e: (e[0], e[1]))
    for _, _, svg in elements:
        out.extend(svg)

    # Étiquettes des bâtiments, au-dessus de tout
    for o in carte["objets"]:
        if o["type"] in BATIMENTS:
            t = types[o["type"]]
            a, b = P(o["x"], o["y"], t["hauteur"] + 1.2)
            nom = BATIMENTS[o["type"]][1]
            out.append(f'<text x="{a:.1f}" y="{b:.1f}" font-size="12" font-weight="bold" fill="#111" '
                       f'stroke="#fff" stroke-width="3" paint-order="stroke" text-anchor="middle">{escape(nom)}</text>')
    for etiquette, (x, y) in {"Quai": (34, 16.5), "Place": (40, 31), "Lisière": (27, 3), "L'Aubrune": (52, 40),
                              "Gué": (18.5, 41), "Potager": (9, 30), "Rue Haute": (77, 33), "Ru de la Côte": (62, 9),
                              "Route des hameaux": (92, 22)}.items():
        a, b = P(x, y, 0.2)
        out.append(f'<text x="{a:.1f}" y="{b:.1f}" font-size="12" font-style="italic" fill="#111" stroke="#fff" '
                   f'stroke-width="3" paint-order="stroke" text-anchor="middle">{escape(etiquette)}</text>')
    out.append("</svg>")
    return "\n".join(out), W


def main(argv: list[str]) -> int:
    chemin = Path(argv[1]) if len(argv) > 1 else CARTE_PAR_DEFAUT
    carte = json.loads(chemin.read_text(encoding="utf-8"))
    base = chemin.with_suffix("")
    if "origine" in carte["taille"]:
        # 0.13: la carte agrandie attend le lot L0 hors de `donnees/cartes/`; ses aperçus vont avec les captures.
        base = ICI.parents[2] / "docs" / "jeux" / "jeu-1" / "captures" / "apercu" / "v0-13-carte"
    svg, w = vue_de_dessus(carte)
    sortie = base.parent / f"{base.name}-apercu.png"
    svg_vers_png(svg, sortie, w)
    print(f"aperçu écrit: {sortie}")
    svg, w = vue_iso(carte)
    sortie = base.parent / f"{base.name}-apercu-iso.png"
    svg_vers_png(svg, sortie, w)
    print(f"aperçu écrit: {sortie}")
    # Tour 10: vues rapprochées, pour regarder de près la rue Haute et les intérieurs; 0.13: les régions neuves.
    vues = [("est", (58, 10, 100, 40), ": la rue Haute (vue rapprochée)"),
            ("interieurs", (0, 14, 34, 34), ": maisonnette et épicerie (vue rapprochée)")]
    if "origine" in carte["taille"]:
        vues += [("eglise", (72, -22, 128, 12), ": l'église, le cimetière, la vigne, les champs (vue rapprochée)"),
                 ("carrefour", (84, 12, 140, 40), ": le carrefour, la ferme, le hameau (vue rapprochée)"),
                 ("ouest", (-24, 12, 20, 40), ": les cheminots, la friche, le moulin (vue rapprochée)"),
                 ("bois-ouest", (-24, -30, 22, 12), ": la coupe, la maison forestière, le belvédère (vue rapprochée)"),
                 ("bois", (14, -30, 86, 2), ": la clairière, la mare, la source (vue rapprochée)")]
    ox, oy = origine(carte)
    for nom, region, titre in vues:
        if region[2] > ox + carte["taille"]["largeur"] or region[0] < ox:
            continue
        svg, w = vue_de_dessus(carte, region=region, c=28, titre=titre)
        sortie = base.parent / f"{base.name}-apercu-{nom}.png"
        svg_vers_png(svg, sortie, w)
        print(f"aperçu écrit: {sortie}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

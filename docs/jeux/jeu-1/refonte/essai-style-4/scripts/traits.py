"""Atlas des traits du visage dessinés à la plume (bible 0.2, 2.4 et 2.5).

Usage: python3 traits.py            (lancé par construire.py; 20 s)

Sources: `gabarits/visages/traits.svg` (pièces dessinées), `gabarits/visages/expressions.toml` (une cellule
par expression, marques de l'âge) et le bloc `[visage]` de chaque fiche de personnage.
1. Chaque pièce est encrée une fois par côté par le moteur « à la plume » de l'interface (`encrer-lot.mjs`):
   plein et délié, tremblé, traits effilés. L'oeil droit est l'oeil gauche en miroir, encré à part.
2. Par personnage, les pièces sont posées sur les repères de son corps: yeux et bouche aux places fixes de
   la cellule (le conformateur y cale le visage), nez à la hauteur du nez mesuré, et une compensation de
   l'étirement de la cellule (largeur et hauteur réelles diffèrent selon le corps: un rond reste rond).
3. Sorties: `atlas/traits-<personnage>.png` (4 cellules de 128 px par rangée, une par expression),
   `atlas/traits.png` (le même pour un visage sans fiche), `atlas/traits.json` (ordre des expressions), et
   `.travail/visages/<personnage>-etendu.png` (front, menton, barbe: peints dans l'atlas du corps par
   `peindre.py`, hors de la cellule).
Les couleurs de remplacement de `traits.svg` prennent celles du personnage (iris, sourcils, peau, joues).
"""
import json
import os
import pathlib
import re
import subprocess
import tomllib

import numpy as np
from PIL import Image

ICI = pathlib.Path(__file__).resolve().parent
ESSAI = ICI.parent
GAB = ESSAI / "gabarits"
TRAVAIL = ESSAI / ".travail" / "visages"
CELL = 256        # unités d'une cellule dans les sources
PX = 128          # pixels d'une cellule dans l'atlas
COLS = 4
# Repères fixes de la cellule (ceux du conformateur: yeux à v 0,80, bouche à v 0,20, demi-écart 0,235).
OEIL_G = (CELL * (0.5 - 0.235), CELL * 0.2)
OEIL_D = (CELL * (0.5 + 0.235), CELL * 0.2)
BOUCHE = (CELL * 0.5, CELL * 0.8)
CADRES = {"oeil": "-64 -64 128 128", "bouche": "-64 -64 128 128", "nez": "-48 -64 96 96",
          "cellule": f"0 0 {CELL} {CELL}", "etendu": "-128 -128 512 640"}
TRAIT = {"oeil": 5, "bouche": 5, "nez": 5, "cellule": 5, "etendu": 9}
MIROIR_BOUCHE = {"sillons", "fossettes"}   # pièces du repère de la bouche dessinées pour le côté gauche
# Ordre des calques: peau, nez, yeux, sourcils, bouche, poils, lunettes.
ORDRE = ["pommettes", "taches", "rougeur", "poches", "pattes-oie", "sillons", "fossettes", "menton", "nez",
         "oeil", "sourcil", "bouche", "barbe", "moustache", "lunettes"]

NUANCIER = json.loads((GAB / "nuancier-v02.json").read_text())
COUL = {}
for famille, items in NUANCIER.items():
    if isinstance(items, list):
        for nom, hexa in items:
            COUL[f"{famille}.{nom}"] = hexa
            COUL.setdefault(nom, hexa)


def hexa(c):
    return "#" + "".join(f"{int(round(max(0, min(1, x)) * 255)):02X}" for x in c)


def rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)]) / 255


def ombre(c):
    """Même ton d'ombre que la peinture du corps (peindre.py)."""
    return np.clip(c * np.array([0.56, 0.47, 0.62]) + np.array([0.02, 0.0, 0.05]), 0, 1)


def symboles():
    texte = (GAB / "visages" / "traits.svg").read_text()
    out = {}
    for m in re.finditer(r'<symbol id="([a-z-]+)" data-cadre="([a-z]+)">(.*?)</symbol>', texte, re.S):
        out[m.group(1)] = (m.group(2), m.group(3))
    return out


def encrer_pieces(sym, besoins):
    """Encre chaque (pièce, côté) demandé; renvoie {(pièce, côté): contenu SVG encré sans l'enveloppe}."""
    TRAVAIL.mkdir(parents=True, exist_ok=True)
    (TRAVAIL / "sources").mkdir(exist_ok=True)
    (TRAVAIL / "encre").mkdir(exist_ok=True)
    lot = []
    for nom, cote in sorted(besoins):
        cadre, corps = sym[nom]
        if cote == "d":
            corps = f'<g transform="scale(-1 1)">{corps}</g>'
        ident = f"t-{nom}-{cote}"
        src = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{CADRES[cadre]}" data-trait="{TRAIT[cadre]}" '
               f'data-pas="0.6" data-tremble="0.3" data-halo="0">{corps}</svg>')
        e = TRAVAIL / "sources" / f"{ident}.svg"
        e.write_text(src)
        lot.append({"id": ident, "entree": str(e), "sortie": str(TRAVAIL / "encre" / f"{ident}.svg")})
    (TRAVAIL / "lot.json").write_text(json.dumps(lot))
    r = subprocess.run(["node", str(ICI / "encrer-lot.mjs"), str(TRAVAIL / "lot.json")], capture_output=True, text=True,
                       env={**os.environ, "NODE_PATH": os.environ.get("NODE_PATH", "/opt/node-tools/node_modules")})
    if r.returncode:
        raise SystemExit(r.stdout + r.stderr)
    out = {}
    for t in lot:
        s = pathlib.Path(t["sortie"]).read_text()
        inner = re.sub(r"^<svg[^>]*>", "", s.strip())[: -len("</svg>")]
        nom, cote = t["id"][2:-2], t["id"][-1]
        out[(nom, cote)] = inner
    return out


def place(inner, cadre, ax, ay, sy):
    vb = CADRES[cadre]
    x, y, w, h = vb.split()
    return (f'<g transform="translate({ax:.2f} {ay:.2f}) scale(1 {sy:.3f})"><svg x="{x}" y="{y}" width="{w}" '
            f'height="{h}" viewBox="{vb}" overflow="visible">{inner}</svg></g>')


def reperes(fiche):
    """Nez et étirement de la cellule, d'après les données du corps (mêmes formules que le conformateur)."""
    if fiche is None:
        return {"nez": 150.0, "sy": 1.0}
    d = np.load(ESSAI / fiche["corps"]["donnees"])
    f = d["face"]
    yeux, bouche, ecart = float(f[3]), float(f[4]), float(f[12])
    ch = (yeux - bouche) / 0.6
    cw = ecart / 0.235
    # Base du nez: fraction du chemin des yeux à la bouche, relevée sur le modelé (`[visage] nez` de la fiche
    # du corps). Le point « nez » mesuré par le conformateur est le plus avancé du profil, souvent la lèvre.
    corps = tomllib.load(open(GAB / "corps" / f"{fiche['corps']['gabarit']}.toml", "rb"))
    k = float(corps.get("visage", {}).get("nez", 0.62))
    y_nez = OEIL_G[1] + k * (BOUCHE[1] - OEIL_G[1])
    return {"nez": y_nez, "sy": float(cw / ch)}


def couleurs(fiche):
    v = (fiche or {}).get("visage", {})
    peau = rgb(COUL[fiche["peau"]]) if fiche else rgb(COUL["peaux.miel"])
    cheveux = COUL[v.get("sourcils", fiche["cheveux"])] if fiche else COUL["cheveux.brun"]
    if fiche and fiche["cheveux"] == "cheveux.blanc" and "sourcils" not in v:
        cheveux = COUL["cheveux.gris"]
    sombre = float(peau @ np.array([0.3, 0.59, 0.11])) < 0.5
    return {
        "#FF00A1": COUL[v.get("iris", "iris.brun")],
        "#FF00A2": cheveux,
        "#FF00A3": hexa(ombre(peau) * 0.35 + peau * 0.65),
        "#FF00A4": COUL["joue"] if not sombre else hexa(rgb(COUL["joue"]) * 0.7 + peau * 0.3),
        "#FF00A5": hexa(rgb(COUL["bouche"]) * 0.42),
        "#FF00A6": COUL["joue"],
        "#FF00A7": hexa(ombre(peau) * 0.6 + peau * 0.4),
        "#FF00A8": "#F7F3EA",
    }


def calques_cellule(expr, fiche, ages, sym):
    """Liste ordonnée (pièce, côté, cadre) d'une cellule."""
    v = (fiche or {}).get("visage", {})
    marques = list(ages.get(v.get("age", "adulte"), {}).get("marques", [])) + list(v.get("marques", []))
    items = []
    for m in marques + list(expr.get("extras", [])):
        if m not in sym:
            raise SystemExit(f"traits: pièce « {m} » absente de traits.svg")
        cadre = sym[m][0]
        if cadre == "etendu":
            continue
        cotes = ("g", "d") if cadre == "oeil" or m in MIROIR_BOUCHE else ("c",)
        items += [(m, c, cadre) for c in cotes]
    items.append((f"nez-{v.get('nez', 'droit')}", "c", "nez"))
    for c in ("g", "d"):
        items.append((f"oeil-{expr.get('yeux_' + c, expr.get('yeux'))}", c, "oeil"))
        items.append((f"sourcil-{expr.get('sourcils_' + c, expr.get('sourcils'))}", c, "oeil"))
    items.append((f"bouche-{expr['bouche']}", "c", "bouche"))
    rang = {k: i for i, k in enumerate(ORDRE)}
    return sorted(items, key=lambda t: rang.get(t[0].split("-")[0] if t[0].split("-")[0] in rang else t[0], 0))


def rendre(svg_txt, chemin_svg, largeur, hauteur):
    chemin_svg.write_text(svg_txt)
    png = chemin_svg.with_suffix(".png")
    subprocess.run(["rsvg-convert", "-w", str(largeur), "-h", str(hauteur), str(chemin_svg), "-o", str(png)], check=True)
    return np.asarray(Image.open(png).convert("RGBA"), dtype=np.float32) / 255


def reduire(rgba, taille):
    """Réduction en alpha prémultiplié, puis couleurs étendues sous les texels transparents (pas de frange)."""
    pm = rgba.copy()
    pm[..., :3] *= pm[..., 3:4]
    img = Image.fromarray((pm * 255).round().astype(np.uint8), "RGBA").resize(taille, Image.LANCZOS)
    a = np.asarray(img, dtype=np.float32) / 255
    al = a[..., 3:4]
    col = np.where(al > 1e-3, a[..., :3] / np.maximum(al, 1e-3), 0)
    from scipy import ndimage
    vide = al[..., 0] < 0.02
    _, (iy, ix) = ndimage.distance_transform_edt(vide, return_indices=True)
    col = col[iy, ix]
    return np.dstack([np.clip(col, 0, 1), al[..., 0]])


def main():
    sym = symboles()
    cfg = tomllib.load(open(GAB / "visages" / "expressions.toml", "rb"))
    exprs, ages = cfg["expression"], cfg["ages"]
    persos = {p.stem: tomllib.load(open(p, "rb")) for p in sorted((GAB / "personnages").glob("*.toml"))}
    cibles = {nom: f for nom, f in persos.items()}
    cibles["_commun"] = None
    # Toutes les pièces à encrer.
    besoins = set()
    plans = {}
    for nom, f in cibles.items():
        cellules = [calques_cellule(e, f, ages, sym) for e in exprs]
        v = (f or {}).get("visage", {})
        marques = list(ages.get(v.get("age", "adulte"), {}).get("marques", [])) + list(v.get("marques", []))
        etendu = [m for m in marques if sym[m][0] == "etendu"]
        plans[nom] = (cellules, etendu)
        for cel in cellules:
            besoins |= {(p, c) for p, c, _ in cel}
        besoins |= {(m, "c") for m in etendu}
    encre = encrer_pieces(sym, besoins)
    rows = -(-len(exprs) // COLS)
    W, H = COLS * CELL, rows * CELL
    for nom, f in cibles.items():
        rp = reperes(f)
        sy_oeil = min(rp["sy"], 1.18)       # les sourcils levés restent dans la cellule
        sy_bouche = min(rp["sy"], 1.3)
        cols = couleurs(f)
        cellules, etendu = plans[nom]
        parts = []
        for k, cel in enumerate(cellules):
            ox, oy = (k % COLS) * CELL, (k // COLS) * CELL
            g = []
            for piece, cote, cadre in cel:
                inner = encre[(piece, cote)]
                if cadre == "oeil":
                    ax, ay = OEIL_G if cote == "g" else OEIL_D
                    g.append(place(inner, cadre, ax, ay, sy_oeil))
                elif cadre == "bouche":
                    g.append(place(inner, cadre, BOUCHE[0], BOUCHE[1], sy_bouche))
                elif cadre == "nez":
                    g.append(place(inner, cadre, CELL / 2, rp["nez"], min(rp["sy"], 1.3)))
                else:
                    g.append(place(inner, cadre, 0, 0, 1))
            parts.append(f'<g transform="translate({ox} {oy})"><svg width="{CELL}" height="{CELL}" '
                         f'viewBox="0 0 {CELL} {CELL}">{"".join(g)}</svg></g>')
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{"".join(parts)}</svg>'
        for a, b in cols.items():
            svg = svg.replace(a, b)
        rgba = rendre(svg, TRAVAIL / f"{nom}.svg", W * 2, H * 2)
        atlas = reduire(rgba, (COLS * PX, rows * PX))
        sortie = ESSAI / "atlas" / ("traits.png" if nom == "_commun" else f"traits-{nom}.png")
        Image.fromarray((atlas * 255).round().astype(np.uint8), "RGBA").save(sortie, optimize=True)
        # Front, menton, barbe: un calque dans le repère étendu, lu par peindre.py.
        if etendu:
            g = "".join(place(encre[(m, "c")], "etendu", 0, 0, 1) for m in etendu)
            svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-128 -128 512 640" width="512" height="640">'
                   f'{g}</svg>')
            for a, b in cols.items():
                svg = svg.replace(a, b)
            ext = rendre(svg, TRAVAIL / f"{nom}-etendu.svg", 512, 640)
            Image.fromarray((reduire(ext, (512, 640)) * 255).round().astype(np.uint8), "RGBA").save(
                TRAVAIL / f"{nom}-etendu.png")
        elif (TRAVAIL / f"{nom}-etendu.png").exists():
            (TRAVAIL / f"{nom}-etendu.png").unlink()
        print("TRAITS", sortie.name, f"nez {rp['nez']:.0f}", f"etirement {rp['sy']:.2f}")
    (ESSAI / "atlas" / "traits.json").write_text(json.dumps(
        {"colonnes": COLS, "rangees": rows, "expressions": [e["nom"] for e in exprs]}, ensure_ascii=False, indent=1) + "\n")


if __name__ == "__main__":
    main()

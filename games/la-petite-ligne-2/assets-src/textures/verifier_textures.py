"""Contrôle la bibliothèque de textures produite (relit les WebP, ne fait confiance à rien d'autre).

Usage: duo-python verifier_textures.py <gabarits.toml> <dossier des textures>

Contrôles: nombre par famille, taille des couches et des atlas, poids total, raccord aux bords
(écart au bord comparé à l'écart entre colonnes voisines, et dérive de clarté de part et d'autre),
contraste (écart-type de L*) et clarté moyenne, échelle réelle des lames, carreaux, briques...,
normales valides. Termine par « VERIFICATION ... N erreur(s) », code de sortie 1 s'il y en a.
"""
from __future__ import annotations

import json
import os
import sys
import tomllib

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from construire_textures import declinaisons  # noqa: E402


def clarte(rgb8: np.ndarray) -> np.ndarray:
    c = rgb8.astype(np.float64) / 255
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    y = lin @ np.array([0.2126, 0.7152, 0.0722])
    return np.where(y > 0.008856, 116 * np.cbrt(y) - 16, 903.3 * y)


def couture(profil: np.ndarray, marge: float) -> float:
    """Écart entre le dernier et le premier élément d'un profil cyclique, rapporté au plus grand
    écart entre voisins à l'intérieur (plus une marge en L*). Un joint ou un bord de carreau qui
    tombe sur le bord se retrouve ailleurs dans la texture et reste sous 1; une couture dépasse
    tout ce que l'intérieur contient."""
    interieur = np.abs(np.diff(profil, axis=-1))
    bord = np.abs(profil[..., 0] - profil[..., -1])
    if profil.ndim == 2:  # colonnes: écart moyen sur les lignes
        interieur, bord = interieur.mean(0), bord.mean()
    return float(bord / (interieur.max() + marge))


def raccord(l: np.ndarray, axe: int, ppm: float) -> tuple[float, float]:
    """Raccord le long d'un axe: (couture pixel à pixel, couture des bandes de 5 cm).

    La seconde mesure trahit une texture plus claire d'un côté que de l'autre (dérive lente que
    l'écart entre pixels ne voit pas).
    """
    a = np.moveaxis(l, axe, 1)
    pixel = couture(a, 0.3)
    # bandes glissantes: toutes les positions intérieures comptent, y compris celles qui tombent
    # pile sur un joint comme le bord de la texture
    b = max(2, int(round(0.05 * ppm)))
    p = a.mean(0)
    c = np.concatenate([[0.0], np.cumsum(p)])
    m = (c[b:] - c[:-b]) / b  # m[x] = moyenne de p[x:x+b]
    interieur = np.abs(m[b:] - m[:-b]).max()
    bord = abs(p[:b].mean() - p[-b:].mean())
    return pixel, float(bord / (interieur + 0.5))


def contrastes(l: np.ndarray, ppm: float) -> tuple[float, float]:
    """(écart-type global de L*, écart-type du détail à moins de 25 cm)."""
    detail = l - gaussian_filter(l, 0.25 * ppm, mode="wrap")
    return float(l.std()), float(detail.std())


def plage_echelle(nom: str, famille: str, fiche: dict) -> str | None:
    cle = nom[4:] if nom.startswith("bas_") else nom
    if cle == "carreau" and famille == "murs_interieurs":
        return "carreau_faience"
    if cle == "lame" and fiche.get("large", False):
        return "lame_large"
    return cle


def verifier(gab: dict, dossier: str) -> int:
    ctl = gab["controles"]
    erreurs: list[str] = []
    with open(os.path.join(dossier, "textures.json"), encoding="utf-8") as fh:
        desc = json.load(fh)
    fiches = {t["id"]: t for t in declinaisons(gab)}
    ids_json = [t["id"] for t in desc["textures"]]
    if sorted(ids_json) != sorted(fiches):
        erreurs.append("textures.json ne correspond pas aux gabarits (relancer construire.sh)")
    defaut = gab["reglages"]["palette"]
    for m in ctl["matieres"]:
        k = sum(1 for t in desc["textures"] if t["matiere"] == m and t["palette"] == defaut)
        if k < ctl["variantes_min"]:
            erreurs.append(f"matière {m}: {k} variante(s) à {defaut}, {ctl['variantes_min']} attendues")
    poids = 0
    for fid, fam in desc["familles"].items():
        w, h = fam["pixels"]
        n = fam["couches"]
        for nom in (fam["fichier"], fam["relief"]):
            if not nom:
                continue
            chemin = os.path.join(dossier, nom)
            poids += os.path.getsize(chemin)
            im = Image.open(chemin)
            if im.size != (w, h * n):
                erreurs.append(f"{nom}: {im.size}, attendu {(w, h * n)}")
        bande = np.asarray(Image.open(os.path.join(dossier, fam["fichier"])).convert("RGB"))
        if fam["relief"]:
            rel = np.asarray(Image.open(os.path.join(dossier, fam["relief"])).convert("RGB")).astype(float) / 127.5 - 1
            if rel[..., 2].min() <= 0.2:
                erreurs.append(f"{fam['relief']}: normale trop couchée ou mal codée")
        # le détecteur doit voir une couture fabriquée exprès: un dégradé de clarté de 25 % sur la
        # couche la plus unie de la famille (c'est là qu'une dérive se voit le plus). Limite connue:
        # une couture fine dans un grain fin ou dans un motif très dessiné ne se mesure pas ainsi;
        # c'est la fabrication sur un tore (motifs.py) qui la rend impossible.
        couches = [clarte(bande[i * h:(i + 1) * h]) for i in range(n)]
        unie = int(np.argmin([c.std() for c in couches]))
        ppm0 = w / [t for t in desc["textures"] if t["famille"] == fid][unie]["taille_m"][0]
        r2, d2 = raccord(couches[unie] * np.linspace(0.75, 1.0, w)[None, :], 1, ppm0)
        if r2 <= ctl["raccord_max"] and d2 <= ctl["derive_max"]:
            erreurs.append(f"{fid}: le contrôle de raccord ne voit pas un dégradé fabriqué ({r2:.2f}/{d2:.2f})")
        for t in [t for t in desc["textures"] if t["famille"] == fid]:
            img = bande[t["couche"] * h:(t["couche"] + 1) * h]
            l = clarte(img)
            fiche = fiches.get(t["id"], {})
            axes = [1, 0] if fam["repetition"] == "xy" else [1]
            ppm = w / t["taille_m"][0]
            for axe in axes:
                r, d = raccord(l, axe, ppm)
                if r > ctl["raccord_max"] or d > ctl["derive_max"]:
                    erreurs.append(f"{t['id']}: raccord en {'x' if axe == 1 else 'y'} {r:.2f} (dérive {d:.1f})")
            et, detail = contrastes(l, ppm)
            moy = float(l.mean())
            if et > ctl["ecart_type_l_max"] or detail > fiche.get("detail_l_max", ctl["detail_l_max"]):
                erreurs.append(f"{t['id']}: contraste trop fort (écart-type L* {et:.1f}, détail {detail:.1f})")
            plage = ctl["l_moyenne_lieu"].get(t["palette"], ctl["l_moyenne"])
            if not plage[0] <= moy <= plage[1]:
                erreurs.append(f"{t['id']}: clarté moyenne {moy:.0f} hors de {plage} ({t['palette']})")
            for nom, v in t["mesures_m"].items():
                cle = plage_echelle(nom, fid, fiche)
                if cle in ctl["echelles"]:
                    lo, hi = ctl["echelles"][cle]
                    if not lo - 1e-6 <= v <= hi + 1e-6:
                        erreurs.append(f"{t['id']}: {nom} = {v * 100:.1f} cm, hors de [{lo * 100:g}, {hi * 100:g}] cm")
            if any(chr(c) in t["nom"] for c in (0x2013, 0x2014)):
                erreurs.append(f"{t['id']}: tiret interdit dans le nom")
            t["_l"] = (round(moy, 1), round(et, 1), round(detail, 1), round(r, 2), round(d, 1))
    mo = poids / 1024 / 1024
    if mo > ctl["poids_max_mo"]:
        erreurs.append(f"poids total {mo:.2f} Mo, plafond {ctl['poids_max_mo']} Mo")
    if os.environ.get("DETAIL"):
        for t in desc["textures"]:
            print(f"  {t['id']:40s} L*, écart, détail, raccord, dérive {t['_l']}")
    for e in erreurs:
        print("ERREUR", e)
    print(f"VERIFICATION {len(desc['textures'])} textures, {len(desc['familles'])} atlas, {mo:.2f} Mo: {len(erreurs)} erreur(s)")
    return len(erreurs)


if __name__ == "__main__":
    with open(sys.argv[1], "rb") as fh:
        g = tomllib.load(fh)
    sys.exit(1 if verifier(g, sys.argv[2]) else 0)

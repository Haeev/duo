"""Fabrique toute la bibliothèque de textures depuis gabarits.toml.

Usage: duo-python construire_textures.py <gabarits.toml> <dossier de sortie> [identifiant ...]

Pour chaque famille: un atlas en bande verticale (une couche par texture, toutes de la même taille,
lisible comme un tableau de textures ou découpable), son atlas de relief (normales, convention
OpenGL comme Three.js) et l'entrée de chaque texture dans `textures.json`. Avec des identifiants en
argument, seules ces textures sont calculées et écrites en PNG dans <sortie>/essai/ (pour régler
une entrée sans tout refaire).
"""
from __future__ import annotations

import json
import os
import sys
import time
import tomllib
import zlib

import numpy as np
from PIL import Image
from scipy.cluster.vq import kmeans2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from encre import MOTIFS  # noqa: E402
from motifs import Contexte  # noqa: E402

LUMIERE = np.array([-1.0, 1.0, 1.4]) / np.linalg.norm([-1.0, 1.0, 1.4])  # en haut à gauche (u, v, n)


def gradient(h: np.ndarray):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) / 2
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) / 2
    return gx, gy


def normales(h: np.ndarray, force: float) -> np.ndarray:
    """Normales en espace tangent; v monte quand la ligne descend, d'où le signe de gy."""
    gx, gy = gradient(h * force)
    n = np.stack([-gx, gy, np.ones_like(h)], -1)
    return n / np.linalg.norm(n, axis=-1, keepdims=True)


def finir(ctx: Contexte, col: np.ndarray, h: np.ndarray, f: dict, regl: dict) -> tuple[np.ndarray, np.ndarray]:
    """Relief cuit, couleurs passées, grain peint; rend (couleur 0..1, normales)."""
    relief = f.get("relief", regl["relief"])
    n = normales(h, relief * ctx.ppm / 100)
    ombre = n @ LUMIERE - LUMIERE[2]
    col = col * (1 + ombre * regl["ombre_cuite"])[..., None]
    passe = f.get("passe", regl["passe"])
    lum = col @ np.array([0.3, 0.55, 0.15])
    gris_chaud = lum[..., None] * np.array([1.04, 1.0, 0.92])
    col = col * (1 - passe) + gris_chaud * passe
    pinceau = ctx.bruit(0.012, 1, (2.5, 0.6)) * 0.5 + ctx.bruit(0.012, 1, (0.6, 2.5)) * 0.5
    col = col * (1 + pinceau * regl["grain_peint"])[..., None]
    return np.clip(col, 0, 1), n


def couleurs_dominantes(rgb8: np.ndarray, k: int = 3) -> list[dict]:
    px = rgb8[::4, ::4].reshape(-1, 3).astype(np.float64)
    rng = np.random.default_rng(1)
    centres, lab = kmeans2(px, k, minit="++", seed=rng)
    parts = np.bincount(lab, minlength=k) / len(lab)
    ordre = np.argsort(-parts)
    return [{"couleur": "#%02X%02X%02X" % tuple(int(round(v)) for v in np.clip(centres[i], 0, 255)),
             "part": round(float(parts[i]), 2)} for i in ordre if parts[i] > 0.02]


def teinter(col: np.ndarray, pal: dict) -> np.ndarray:
    """Palette d'un lieu: désaturation vers une teinte, puis clarté (après le motif, si bien que
    le dessin est le même dans les trois lieux et que seule l'ambiance change)."""
    lum = col @ np.array([0.3, 0.55, 0.15])
    teinte = np.array([int(pal.get("teinte", "#FFFFFF")[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    d = pal.get("desature", 0.0)
    col = col * (1 - d) + lum[..., None] * teinte * d
    return np.clip(col * pal.get("clarte", 1.0), 0, 1)


def declinaisons(gab: dict) -> list[dict]:
    """Une fiche par texture et par palette de lieu (`palettes` de la fiche, la première sans
    suffixe d'identifiant)."""
    sortie = []
    for t in gab["textures"]:
        lieux = t.get("palettes", [gab["reglages"]["palette"]])
        for i, lieu in enumerate(lieux):
            g = dict(t)
            g["palette"] = lieu
            g["graine"] = t["id"]
            if i > 0:
                g["id"] = f"{t['id']}-{gab['palettes'][lieu]['suffixe']}"
                g["nom"] = f"{t['nom']} ({gab['palettes'][lieu]['nom']})"
            sortie.append(g)
    return sortie


def construire(gab: dict, sortie: str, seulement: list[str]) -> None:
    regl = gab["reglages"]
    familles = gab["familles"]
    textures = declinaisons(gab)
    ids = [t["id"] for t in textures]
    doubles = {i for i in ids if ids.count(i) > 1}
    if doubles:
        raise SystemExit(f"TEXTURES identifiants en double: {sorted(doubles)}")
    os.makedirs(sortie, exist_ok=True)
    description = {"version": 1, "source": "games/la-petite-ligne-2/assets-src/textures/gabarits.toml",
                   "style": "bande dessinée encrée, lumière en haut à gauche", "familles": {}, "textures": []}
    t0 = time.time()
    for fid, fam in familles.items():
        membres = [t for t in textures if t["famille"] == fid and (not seulement or t["id"] in seulement)]
        if not membres:
            continue
        w, h = fam["pixels"]
        couches, reliefs = [], []
        for couche, f in enumerate(membres):
            if f["motif"] not in MOTIFS:
                raise SystemExit(f"TEXTURES {f['id']}: motif inconnu {f['motif']}")
            taille = tuple(f.get("taille", fam["taille"]))
            if abs(taille[0] / taille[1] - w / h) > 1e-6:
                raise SystemExit(f"TEXTURES {f['id']}: la taille {taille} ne garde pas les pixels carrés ({w}x{h})")
            rng = np.random.default_rng(zlib.crc32(f["graine"].encode()))
            pal = gab["palettes"][f["palette"]]
            ctx = Contexte(h, w, taille, rng, {**gab["couleurs"], "encre": pal["encre"]})
            col, hauteur = MOTIFS[f["motif"]](ctx, f)
            col, n = finir(ctx, col, hauteur, f, regl)
            col = teinter(col, pal)
            rgb8 = (col * 255 + 0.5).astype(np.uint8)
            couches.append(rgb8)
            reliefs.append(((n * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8))
            description["textures"].append({
                "id": f["id"], "nom": f["nom"], "famille": fid, "couche": couche,
                "taille_m": [round(taille[0], 3), round(taille[1], 3)],
                "repetition": fam.get("repetition", "xy"),
                "matiere": f["matiere"],
                "palette": f["palette"],
                "couleurs_dominantes": couleurs_dominantes(rgb8),
                "mesures_m": {k: round(float(v), 4) for k, v in ctx.mesures.items()},
            })
        if seulement:
            os.makedirs(os.path.join(sortie, "essai"), exist_ok=True)
            for f, c in zip(membres, couches):
                Image.fromarray(np.tile(c, (2, 2, 1))).save(os.path.join(sortie, "essai", f"{f['id']}.png"))
            continue
        bande = Image.fromarray(np.concatenate(couches, 0))
        bande.save(os.path.join(sortie, f"{fid}.webp"), "WEBP", quality=regl["qualite"], method=6)
        nom_relief = None
        if fam.get("relief", True):
            nom_relief = f"{fid}-relief.webp"
            Image.fromarray(np.concatenate(reliefs, 0)).save(
                os.path.join(sortie, nom_relief), "WEBP", quality=regl["qualite_relief"], method=6)
        description["familles"][fid] = {
            "nom": fam["nom"], "fichier": f"{fid}.webp", "relief": nom_relief,
            "pixels": [w, h], "couches": len(couches), "repetition": fam.get("repetition", "xy"),
        }
        print(f"TEXTURES {fid}: {len(couches)} couches de {w}x{h}")
    if not seulement:
        with open(os.path.join(sortie, "textures.json"), "w", encoding="utf-8") as fh:
            json.dump(description, fh, ensure_ascii=False, indent=1)
            fh.write("\n")
    print(f"TEXTURES {len(description['textures'])} textures en {time.time() - t0:.1f} s")


if __name__ == "__main__":
    with open(sys.argv[1], "rb") as fh:
        gabarits = tomllib.load(fh)
    construire(gabarits, sys.argv[2], sys.argv[3:])

"""Planche de contrôle des textures: chaque texture répétée 4 x 4 en vue de jeu, et trois mises en
situation.

Usage: duo-python planche.py <dossier des textures> <sortie.png> [vignette en px, défaut 250]

Rendu en perspective par lancer de rayons sur des plans (aucun moteur 3D): chaque face reçoit sa
texture répétée selon sa taille réelle. Les vignettes montrent un sol de 4 x 4 répétitions vu par
une caméra haute inclinée de 35 degrés depuis la verticale, pour voir si la grille se devine. Les
mises en situation ont des figurines de 1,70 m pour juger l'échelle et la lisibilité.
"""
from __future__ import annotations

import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

POLICE = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FOND = (214, 210, 202)


def charger(dossier: str):
    with open(os.path.join(dossier, "textures.json"), encoding="utf-8") as fh:
        desc = json.load(fh)
    bandes = {}
    for fid, fam in desc["familles"].items():
        bandes[fid] = np.asarray(Image.open(os.path.join(dossier, fam["fichier"])).convert("RGB"))
    tex = {}
    for t in desc["textures"]:
        w, h = desc["familles"][t["famille"]]["pixels"]
        tex[t["id"]] = (bandes[t["famille"]][t["couche"] * h:(t["couche"] + 1) * h], t)
    return desc, tex


# ------------------------------------------------------------------ rendu en perspective


class Camera:
    def __init__(self, pos, cible, focale, w, h):
        self.p = np.array(pos, float)
        f = np.array(cible, float) - self.p
        self.f = f / np.linalg.norm(f)
        self.r = np.cross(self.f, [0, 1, 0])
        self.r /= np.linalg.norm(self.r)
        self.u = np.cross(self.r, self.f)
        self.focale, self.w, self.h = focale, w, h

    def projeter(self, pt):
        d = np.asarray(pt, float) - self.p
        z = d @ self.f
        return np.array([self.w / 2 + self.focale * (d @ self.r) / z, self.h / 2 - self.focale * (d @ self.u) / z]), z


def face(img, zbuf, cam, origine, axe_u, axe_v, lu, lv, texture, taille_m, lum=1.0):
    """Quadrilatère origine + s*axe_u + t*axe_v (s dans [0, lu], t dans [0, lv], en mètres), texturé
    par répétition: u = s / largeur couverte, v = t / hauteur couverte (t monte depuis le bas)."""
    o, au, av = (np.asarray(a, float) for a in (origine, axe_u, axe_v))
    hh, ww = img.shape[:2]
    ys, xs = np.mgrid[0:hh, 0:ww].astype(float) + 0.5
    dirs = (cam.f[None, None] * cam.focale + cam.r[None, None] * (xs - cam.w / 2)[..., None]
            - cam.u[None, None] * (ys - cam.h / 2)[..., None])
    n = np.cross(au, av)
    denom = dirs @ n
    with np.errstate(divide="ignore", invalid="ignore"):
        t = ((o - cam.p) @ n) / denom
    p = cam.p + dirs * t[..., None]
    rel = p - o
    s = rel @ au
    tt = rel @ av
    dist = t * np.linalg.norm(dirs, axis=-1)
    m = (t > 0) & (s >= 0) & (s <= lu) & (tt >= 0) & (tt <= lv) & (dist < zbuf)
    th, tw = texture.shape[:2]
    px = np.mod(s / taille_m[0], 1) * tw
    py = (1 - np.mod(tt / taille_m[1], 1)) * th
    xi = np.clip(px.astype(int), 0, tw - 1)
    yi = np.clip(py.astype(int), 0, th - 1)
    img[m] = texture[yi[m], xi[m]] * lum
    zbuf[m] = dist[m]


def figurine(img, zbuf, cam, pied, couleurs, taille=1.7):
    """Figurine schématique (capsule et tête) d'une hauteur réelle donnée, pour juger l'échelle."""
    hh, ww = img.shape[:2]
    ys, xs = np.mgrid[0:hh, 0:ww].astype(float) + 0.5
    base, z = cam.projeter(pied)
    tete, _ = cam.projeter(np.array(pied) + [0, taille, 0])
    haut = base[1] - tete[1]
    r_tete = haut * 0.1
    cx = base[0]
    corps = (np.abs(xs - cx) < haut * 0.13) & (ys > tete[1] + r_tete * 1.6) & (ys < base[1] - haut * 0.42)
    jambes = (np.abs(np.abs(xs - cx) - haut * 0.06) < haut * 0.045) & (ys >= base[1] - haut * 0.44) & (ys < base[1])
    t = (xs - cx) ** 2 + (ys - tete[1] - r_tete) ** 2 < r_tete ** 2
    ombre = ((xs - cx) / (haut * 0.18)) ** 2 + ((ys - base[1]) / (haut * 0.04)) ** 2 < 1
    img[ombre & (zbuf > z)] *= 0.7
    for masque, c in ((jambes, couleurs[1]), (corps, couleurs[0]), (t, (239, 199, 166))):
        mm = masque & (zbuf > z)
        img[mm] = np.array(c, float)


def scene(w, h, fond=(200, 214, 222)):
    return np.zeros((h, w, 3)) + np.array(fond, float), np.full((h, w), np.inf)


def sol_4x4(texture, t, w, h, inclinaison=35.0):
    """La texture répétée 4 x 4 sur un sol, caméra haute inclinée de `inclinaison` degrés depuis
    la verticale (vue de jeu), cadrée sur le carré entier."""
    img, z = scene(w, h, FOND)
    lx, ly = 4 * t["taille_m"][0], 4 * t["taille_m"][1]
    a = math.radians(inclinaison)
    dist = max(lx, ly) * 1.25
    cam = Camera([0, dist * math.cos(a), dist * math.sin(a)], [0, 0, 0], w * 1.05, w, h)
    face(img, z, cam, [-lx / 2, 0, -ly / 2], [1, 0, 0], [0, 0, 1], lx, ly, texture, t["taille_m"])
    return img


def bourg(tex, w, h):
    """Façade crépie sur soubassement de moellons, toit de tuiles, place pavée, herbe, rivière."""
    img, z = scene(w, h)
    cam = Camera([7.5, 8.0, 12.0], [2.5, 0.8, 0.0], w * 0.8, w, h)
    herbe, ih = tex["grass-meadow"]
    paves, ip = tex["cobbles-square"]
    eau, ie = tex["water-river"]
    face(img, z, cam, [-20, -0.02, -20], [1, 0, 0], [0, 0, 1], 40, 40, herbe, ih["taille_m"])
    face(img, z, cam, [-2, 0, 0], [1, 0, 0], [0, 0, 1], 11, 5, paves, ip["taille_m"])
    face(img, z, cam, [-20, -0.01, 7], [1, 0, 0], [0, 0, 1], 40, 3, eau, ie["taille_m"])
    crepi, ic = tex["render-cream"]
    pierre, ipi = tex["rubble-stone"]
    toit, it = tex["roof-tiles"]
    for o, au, lu, lum in (([0, 0, 0], [1, 0, 0], 6, 1.0), ([6, 0, 0], [0, 0, -1], 5, 0.8)):
        face(img, z, cam, o, au, [0, 1, 0], lu, 0.7, pierre, ipi["taille_m"], 0.95 * lum)
        face(img, z, cam, [o[0], 0.7, o[2]], au, [0, 1, 0], lu, 2.4, crepi, ic["taille_m"], lum)
    pente = math.radians(38)
    face(img, z, cam, [-0.3, 3.1, 0.45], [1, 0, 0], [0, math.sin(pente), -math.cos(pente)], 6.6,
         2.5 / math.cos(pente) + 0.5, toit, it["taille_m"])
    porte = np.zeros_like(img)
    zp = z.copy()
    face(porte, zp, cam, [1.0, 0, 0.01], [1, 0, 0], [0, 1, 0], 0.95, 2.05, np.full((4, 4, 3), [94, 70, 52], float), [1, 1])
    face(porte, zp, cam, [3.2, 1.0, 0.01], [1, 0, 0], [0, 1, 0], 0.9, 1.1, np.full((4, 4, 3), [123, 152, 160], float), [1, 1])
    m = zp < z
    img[m] = porte[m]
    z[m] = zp[m]
    figurine(img, z, cam, [2.0, 0, 2.2], [(197, 68, 61), (68, 97, 138)])
    figurine(img, z, cam, [4.0, 0, 3.0], [(141, 108, 255), (74, 77, 82)])
    return img


def quai(tex, w, h):
    """Quai dallé surélevé de 30 cm, chemin de terre battue au pied, herbe rase."""
    img, z = scene(w, h)
    cam = Camera([0.0, 9.0, 8.0], [0.0, 0.0, -1.0], w * 0.8, w, h)
    terre, it = tex["earth-packed"]
    dalles, idl = tex["platform-slabs"]
    herbe, ih = tex["grass-short"]
    face(img, z, cam, [-20, -0.02, -20], [1, 0, 0], [0, 0, 1], 40, 40, herbe, ih["taille_m"])
    face(img, z, cam, [-20, -0.01, -1.5], [1, 0, 0], [0, 0, 1], 40, 3, terre, it["taille_m"])
    face(img, z, cam, [-20, 0.3, -6], [1, 0, 0], [0, 0, 1], 40, 3.5, dalles, idl["taille_m"])
    figurine(img, z, cam, [-1.0, 0.3, -4.5], [(197, 68, 61), (68, 97, 138)])
    figurine(img, z, cam, [1.5, 0, 0.0], [(141, 108, 255), (74, 77, 82)])
    return img


def interieur(tex, w, h):
    img, z = scene(w, h, (60, 52, 46))
    cam = Camera([4.2, 4.5, 4.2], [0.6, 0.4, 0.6], w * 0.8, w, h)
    plancher, ip = tex["floorboards-honey"]
    crepi, ic = tex["render-pink-flaking"]
    face(img, z, cam, [0, 0, 0], [1, 0, 0], [0, 0, 1], 5, 5, plancher, ip["taille_m"])
    face(img, z, cam, [0, 0, 0], [1, 0, 0], [0, 1, 0], 5, 2.6, crepi, ic["taille_m"], 0.95)
    face(img, z, cam, [0, 0, 0], [0, 0, 1], [0, 1, 0], 5, 2.6, crepi, ic["taille_m"], 0.8)
    figurine(img, z, cam, [1.6, 0, 2.0], [(197, 68, 61), (68, 97, 138)])
    return img


def rendre(fonction, tex, w, h):
    """Rendu suréchantillonné deux fois, pour adoucir les lointains sans filtrage de texture."""
    grand = fonction(tex, w * 2, h * 2)
    return Image.fromarray(np.clip(grand, 0, 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)


def planche(dossier: str, sortie: str, v: int = 250) -> None:
    desc, tex = charger(dossier)
    police = ImageFont.truetype(POLICE, 12)
    titre = ImageFont.truetype(POLICE, 17)
    colonnes = 6
    vh = int(v * 0.72)
    textures = desc["textures"]
    lignes = math.ceil(len(textures) / colonnes)
    sw, sh = 500, 340
    out = Image.new("RGB", (colonnes * (v + 10) + 10, 40 + lignes * (vh + 40) + sh + 50), FOND)
    d = ImageDraw.Draw(out)
    d.text((10, 10), "Textures encrées: chaque matière répétée 4 x 4, caméra inclinée de 35 degrés depuis la verticale",
           fill=(40, 38, 36), font=titre)
    for i, t in enumerate(textures):
        img = sol_4x4(tex[t["id"]][0], t, v * 2, vh * 2)
        im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((v, vh), Image.LANCZOS)
        x = 10 + (i % colonnes) * (v + 10)
        y = 40 + (i // colonnes) * (vh + 40)
        out.paste(im, (x, y))
        d.text((x, y + vh + 3), t["nom"][:38], fill=(40, 38, 36), font=police)
        d.text((x, y + vh + 18), f"{t['id'][:30]}  {t['taille_m'][0]:g} m", fill=(95, 90, 84), font=police)
    y = 40 + lignes * (vh + 40)
    situations = [rendre(f, tex, sw, sh) for f in (bourg, quai, interieur)]
    noms = ["Bourg: crépi, moellons, tuiles, pavés, herbe, rivière", "Quai dallé, terre battue, herbe rase",
            "Intérieur: plancher miel, crépi rose écaillé"]
    for i, (s, n) in enumerate(zip(situations, noms)):
        x = 10 + i * (sw + 16)
        out.paste(s, (x, y + 6))
        d.text((x, y + sh + 10), n + " (figurines de 1,70 m)", fill=(40, 38, 36), font=police)
        s.save(sortie.replace(".png", f"-situation-{i + 1}.png"))
    out.save(sortie)
    print(f"PLANCHE {sortie} ({out.width} x {out.height})")


if __name__ == "__main__":
    planche(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 250)

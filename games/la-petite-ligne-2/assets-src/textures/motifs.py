"""Outils communs des motifs de textures (tore, grilles, Voronoï); les motifs sont dans encre.py.

Chaque motif reçoit une fiche (dictionnaire lu dans gabarits.toml), la taille en pixels et la taille
réelle couverte en mètres, et rend (couleur RVB 0..1, hauteur 0..1, mesures). Tout est calculé sur
un tore: bruits par filtrage avec `mode="wrap"`, grilles à nombre entier de cellules, Voronoï à boîte
périodique. La texture se raccorde donc par construction; `verifier_textures.py` le mesure.

Les mesures (lame, carreau, brique...) sont les tailles réellement obtenues après arrondi au nombre
entier de cellules: le contrôle d'échelle porte sur elles, pas sur la consigne.
"""
from __future__ import annotations

import math

import numpy as np
from scipy.ndimage import gaussian_filter
from scipy.spatial import cKDTree

# ------------------------------------------------------------------ outils communs


class Contexte:
    """Taille de la texture, échelle, générateur aléatoire et nuancier."""

    def __init__(self, h: int, w: int, taille: tuple[float, float], rng: np.random.Generator,
                 couleurs: dict[str, str]):
        self.h, self.w = h, w
        self.sx, self.sy = taille
        self.ppm = w / self.sx  # pixels par mètre (identique en y: le gabarit garde des pixels carrés)
        self.rng = rng
        self.couleurs = couleurs
        y, x = np.mgrid[0:h, 0:w].astype(np.float64) + 0.5
        self.xm = x / self.ppm  # coordonnées en mètres, y vers le bas
        self.ym = y / self.ppm
        self.mesures: dict[str, float] = {}

    def c(self, nom) -> np.ndarray:
        """Couleur par nom du nuancier ou en #RRGGBB."""
        if isinstance(nom, (list, tuple)):
            return np.array(nom, dtype=np.float64)
        v = self.couleurs.get(nom, nom)
        if not (isinstance(v, str) and v.startswith("#") and len(v) == 7):
            raise ValueError(f"couleur inconnue: {nom}")
        return np.array([int(v[i:i + 2], 16) / 255 for i in (1, 3, 5)])

    def bruit(self, echelle_m: float, octaves: int = 3, aniso: tuple[float, float] = (1.0, 1.0)) -> np.ndarray:
        """Bruit périodique centré réduit; `echelle_m` est la taille des taches en mètres."""
        total = np.zeros((self.h, self.w))
        poids = 1.0
        for o in range(octaves):
            s = max(echelle_m * self.ppm / (2 ** o), 0.35)
            n = self.rng.standard_normal((self.h, self.w))
            n = gaussian_filter(n, (s * aniso[1], s * aniso[0]), mode="wrap")
            n /= n.std() + 1e-9
            total += n * poids
            poids *= 0.5
        return total / (total.std() + 1e-9)

    def entier(self, longueur: float, module: float) -> int:
        return max(1, int(round(longueur / module)))


def lisse(a, b, x):
    t = np.clip((x - a) / (b - a + 1e-9), 0, 1)
    return t * t * (3 - 2 * t)


def melange(fond: np.ndarray, dessus, alpha: np.ndarray) -> np.ndarray:
    return fond * (1 - alpha[..., None]) + np.asarray(dessus) * alpha[..., None]


def rangees(ctx: Contexte, bords_y: np.ndarray, coupes: list[np.ndarray], axe: str = "x"):
    """Rangées d'éléments (briques, lames, pierres, ardoises) sur un tore.

    bords_y: limites des rangées en mètres (de 0 à la taille, croissantes), le long de l'axe
    transversal. coupes[i]: positions des joints de la rangée i le long de l'axe principal, en mètres.
    Rend (identifiant unique, distance au joint le plus proche en mètres, position relative
    dans l'élément le long (0..1) et en travers (0..1)).
    """
    u = np.mod(ctx.xm if axe == "x" else ctx.ym, ctx.sx if axe == "x" else ctx.sy)
    v = np.mod(ctx.ym if axe == "x" else ctx.xm, ctx.sy if axe == "x" else ctx.sx)
    lu = ctx.sx if axe == "x" else ctx.sy
    rang = np.clip(np.searchsorted(bords_y, v, side="right") - 1, 0, len(bords_y) - 2)
    bas = bords_y[rang]
    haut = bords_y[rang + 1]
    tv = (v - bas) / (haut - bas)
    dv = np.minimum(v - bas, haut - v)
    ids = np.zeros(u.shape, dtype=np.int64)
    du = np.zeros(u.shape)
    tu = np.zeros(u.shape)
    base = 0
    for i, cps in enumerate(coupes):
        m = rang == i
        cps = np.sort(np.mod(cps, lu))
        uu = u[m]
        k = np.searchsorted(cps, uu, side="right") - 1  # -1: avant la première coupe = dernier élément
        gauche = np.where(k >= 0, cps[k % len(cps)], cps[-1] - lu)
        droite = np.where(k + 1 < len(cps), cps[(k + 1) % len(cps)], cps[0] + lu)
        ids[m] = base + (k % len(cps))
        du[m] = np.minimum(uu - gauche, droite - uu)
        tu[m] = (uu - gauche) / (droite - gauche)
        base += len(cps)
    return ids, np.minimum(du, dv), du, dv, tu, tv


def coupes_regulieres(n: int, longueur: float, decalage: float) -> np.ndarray:
    return (np.arange(n) + decalage) * longueur / n


def coupes_aleatoires(ctx: Contexte, longueur: float, module: float, ecart: float) -> np.ndarray:
    """Joints espacés d'environ `module`, au nombre entier près, avec un départ au hasard."""
    n = ctx.entier(longueur, module)
    l = np.clip(ctx.rng.normal(1, ecart, n), 0.45, 1.8)
    l = l / l.sum() * longueur
    return np.mod(np.concatenate([[0], np.cumsum(l)[:-1]]) + ctx.rng.uniform(0, longueur), longueur)


def bords_reguliers(n: int, longueur: float) -> np.ndarray:
    return np.linspace(0, longueur, n + 1)


def voronoi(ctx: Contexte, points_m: np.ndarray):
    """Cellules de Voronoï périodiques: identifiant, distance au bord (m), distance au centre (m)."""
    arbre = cKDTree(np.mod(points_m, [ctx.sx, ctx.sy]), boxsize=[ctx.sx, ctx.sy])
    q = np.stack([np.mod(ctx.xm, ctx.sx).ravel(), np.mod(ctx.ym, ctx.sy).ravel()], 1)
    d, i = arbre.query(q, k=2)
    forme = (ctx.h, ctx.w)
    return i[:, 0].reshape(forme), ((d[:, 1] - d[:, 0]) / 2).reshape(forme), d[:, 0].reshape(forme)



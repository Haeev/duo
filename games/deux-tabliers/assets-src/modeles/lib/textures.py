"""Textures de matière de la variante B, générées par script (numpy), en tuiles qui se répètent.

Neutres (gris autour de 0,85, teintées dans le matériau par la couleur de la palette): bois, chaux, peinture,
paille, pierre, pavés. En vraies couleurs de la palette: tomettes (et leurs joints), faïence vert sombre.
Aucune photographie: bruits périodiques, formes simples, une graine fixe par texture.
"""

import math
import os

import numpy as np
from scipy import ndimage

import bpy


def _noise(shape, sigma, rng):
    """Bruit lisse périodique, centré réduit."""
    a = rng.normal(0, 1, shape)
    a = ndimage.gaussian_filter(a, sigma, mode="wrap")
    a -= a.mean()
    s = a.std()
    return a / s if s > 0 else a


def _srgb_to_lin(a):
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def _rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def bois(n=512, seed=3):
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    warp = _noise((n, n), (n / 24, n / 6), rng) * 0.035
    fine = _noise((n, n), (0.6, n / 10), rng)
    rings = np.sin((y + warp) * 2 * math.pi * 7 + _noise((n, n), (n / 6, n / 3), rng) * 1.2)
    v = 0.86 + 0.06 * rings + 0.035 * fine + 0.02 * _noise((n, n), n / 40, rng)
    # quelques lames: joints fins tous les quarts dans le sens travers
    lame = (np.abs(((y * 4) % 1.0) - 0.5) > 0.492)
    v = np.where(lame, v * 0.72, v)
    return np.stack([v * 1.0, v * 0.97, v * 0.93], -1)


def chaux(n=256, seed=5):
    rng = np.random.default_rng(seed)
    v = 0.88 + 0.025 * _noise((n, n), n / 10, rng) + 0.015 * _noise((n, n), 1.2, rng)
    return np.stack([v, v, v], -1)


def peinture(n=256, seed=7):
    rng = np.random.default_rng(seed)
    v = 0.88 + 0.02 * _noise((n, n), (n / 2, 1.0), rng) + 0.012 * _noise((n, n), n / 8, rng)
    return np.stack([v, v, v], -1)


def paille(n=256, seed=9):
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    k = 16
    band = ((x + y) * k) % 1.0
    weave = 0.5 + 0.5 * np.cos(band * 2 * math.pi)
    cross = (((x - y) * k / 2) % 1.0) < 0.5
    v = 0.78 + 0.14 * np.where(cross, weave, 1 - weave) + 0.03 * _noise((n, n), 1.0, rng)
    return np.stack([v, v * 0.98, v * 0.92], -1)


def pierre(n=512, seed=11):
    """Moellons équarris: 4 assises de 25 cm sur une tuile de 2 m (UV x 0,5)."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    rows = 8
    r = np.floor(y * rows).astype(int)
    off = (r % 2) * 0.5 / 3
    cols = 3
    cx = np.floor((x + off) * cols) % cols
    ids = r * 10 + cx.astype(int)
    tint = rng.normal(0, 1, 100)
    v = 0.84 + 0.05 * tint[ids % 100] + 0.03 * _noise((n, n), 2, rng)
    jy = np.abs(((y * rows) % 1.0) - 0.5) > 0.47
    jx = np.abs((((x + off) * cols) % 1.0) - 0.5) > 0.485
    v = np.where(jy | jx, v * 0.8, v)
    return np.stack([v, v, v * 0.98], -1)


def paves(n=512, seed=13):
    """Pavés de 12 cm environ (tuile de 2 m)."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    k = 16
    r = np.floor(y * k)
    off = (r % 2) * 0.5
    fx = ((x * k + off) % 1.0) - 0.5
    fy = ((y * k) % 1.0) - 0.5
    d = np.maximum(np.abs(fx), np.abs(fy))
    ids = (r * 37 + np.floor(x * k + off)).astype(int) % 97
    tint = rng.normal(0, 1, 97)
    v = 0.84 + 0.06 * tint[ids] - 0.25 * np.clip((d - 0.38) / 0.12, 0, 1) + 0.02 * _noise((n, n), 1.5, rng)
    return np.stack([v, v, v], -1)


def tomettes(n=512, seed=17, terre="#A65A3E", joint="#C8B393"):
    """Tomettes hexagonales de 16 cm environ. Tuile carrée de 1 m: réseau hexagonal ajusté pour boucler."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    nx = 6  # colonnes de 1/6 m (pas horizontal)
    ny = 7  # rangées
    # réseau triangulaire déformé pour boucler sur 1 m
    sx, sy = 1.0 / nx, 1.0 / ny
    best = np.full((n, n), 9.0)
    second = np.full((n, n), 9.0)
    idx = np.zeros((n, n), int)
    for j in range(-1, ny + 1):
        for i in range(-1, nx + 1):
            cx = (i + 0.5 * (j % 2)) * sx
            cy = j * sy
            dx = x - cx
            dy = (y - cy) * (sx / sy) * (math.sqrt(3) / 2) / 0.5 * 0.5
            # distance hexagonale (norme du « nid d'abeilles »)
            ax, ay = np.abs(dx), np.abs(dy)
            dh = np.maximum(ax * 0.866 + ay * 0.5, ay)
            k = ((j % ny) * nx + (i % nx))
            closer = dh < best
            second = np.where(closer, best, np.minimum(second, dh))
            idx = np.where(closer, k, idx)
            best = np.where(closer, dh, best)
    edge = second - best
    t = _rgb(terre)
    jc = _rgb(joint)
    var = rng.normal(0, 1, (nx * ny, 3)) * np.array([0.05, 0.035, 0.03])
    bright = rng.normal(0, 1, nx * ny) * 0.06
    col = t[None, None, :] * (1 + bright[idx][..., None]) + var[idx] * 0.6
    col += 0.015 * _noise((n, n), 1.2, rng)[..., None]
    col *= (1 - 0.05 * np.clip(1 - edge / 0.02, 0, 1))[..., None]
    jm = (edge < 0.006)[..., None]
    col = np.where(jm, jc[None, None, :] * 0.9, col)
    return np.clip(col, 0, 1)


def faience(n=256, seed=19, base="#4A5249"):
    """Carreaux de 10 cm (tuile de 1 m), émail vert sombre un peu irrégulier, joints gris clair."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    k = 10
    ids = (np.floor(y * k) * k + np.floor(x * k)).astype(int)
    b = _rgb(base)
    tint = rng.normal(0, 1, (k * k, 3)) * 0.035
    fx = np.abs(((x * k) % 1.0) - 0.5)
    fy = np.abs(((y * k) % 1.0) - 0.5)
    pillow = 1 + 0.06 * (0.5 - np.maximum(fx, fy))
    col = b[None, None, :] * pillow[..., None] * (1 + tint[ids]) + 0.01 * _noise((n, n), 3, rng)[..., None]
    joint = (np.maximum(fx, fy) > 0.465)[..., None]
    col = np.where(joint, np.array([0.62, 0.6, 0.55])[None, None, :], col)
    return np.clip(col, 0, 1)


GENERATEURS = {
    "bois": bois,
    "chaux": chaux,
    "peinture": peinture,
    "paille": paille,
    "pierre": pierre,
    "paves": paves,
    "tomettes": tomettes,
    "faience": faience,
}


def construire(dossier, palette):
    """Écrit les PNG dans `dossier` et rend {nom: (image Blender, moyenne linéaire)}."""
    from PIL import Image

    os.makedirs(dossier, exist_ok=True)
    out = {}
    for nom, gen in GENERATEURS.items():
        if nom == "tomettes":
            a = gen(terre=palette["village_tomette"], joint=palette["village_tomette_joint"])
        elif nom == "faience":
            a = gen(base=palette["village_backbar"])
        else:
            a = gen()
        a = np.clip(a, 0, 1)
        chemin = os.path.join(dossier, f"{nom}.png")
        Image.fromarray((a * 255 + 0.5).astype(np.uint8)).save(chemin, optimize=True)
        img = bpy.data.images.load(chemin, check_existing=True)
        mean_lin = float(_srgb_to_lin(a).mean())
        out[nom] = (img, mean_lin)
    return out

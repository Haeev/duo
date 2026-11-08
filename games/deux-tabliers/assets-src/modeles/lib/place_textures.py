"""Textures de la place du Tilleul (Ormeval), générées par script (numpy, Pillow), sans photographie.

Matières répétées (tuile de 2 m, claires: la couleur vient des couleurs de sommets): pierre de moellons, enduit, tuiles,
pavés, dalles du trottoir. Atlas `place_atlas.jpg` (4 x 4 cases de 512 px): fenêtres, portes, devanture et enseigne de la
boulangerie, inscriptions de la mairie-école, cadran, feuillage, écorce, affiches, arrêt du car, persiennes, fleurs, rosace.
Ciel `place_ciel.jpg` (fin d'après-midi de la bible, quelques nuages; bandeau blanc en bas pour le lointain).
Les inscriptions sont dessinées avec DejaVu Serif (police libre, rendue en pixels: aucune police n'est livrée).
"""

import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage

N = 512
ATLAS_TILES = ["blanc", "fenetre", "fenetre_rideau", "porte", "vitrine_boul", "enseigne_boul", "mairie", "ecole",
               "horloge", "feuillage", "ecorce", "affiches", "arret_car", "persiennes", "fleurs", "rosace"]
POLICE = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
POLICE_SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def _noise(shape, sigma, rng):
    a = rng.normal(0, 1, shape)
    a = ndimage.gaussian_filter(a, sigma, mode="wrap")
    a -= a.mean()
    s = a.std()
    return a / s if s > 0 else a


def rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float64)


def _save(a, path, quality=88):
    a = np.clip(a, 0, 1)
    Image.fromarray((a * 255 + 0.5).astype(np.uint8)).save(path, quality=quality)


def _gray(v):
    return np.stack([v, v, v], -1)


# ------------------------------------------------------------------------------------------------
# Matières répétées (tuiles de 2 m)

def pierre(seed=101):
    """Moellons équarris de pierre blonde, assises irrégulières, joints à la chaux un peu creusés."""
    rng = np.random.default_rng(seed)
    n = N
    y, x = np.mgrid[0:n, 0:n] / n
    heights = []
    t = 0.0
    while t < 1.0:
        h = rng.choice([0.09, 0.11, 0.125, 0.14])
        heights.append(h)
        t += h
    heights = np.array(heights) / t
    edges = np.concatenate([[0], np.cumsum(heights)])
    row = np.clip(np.searchsorted(edges, y, side="right") - 1, 0, len(heights) - 1)
    ry = (y - edges[row]) / heights[row]
    col_w = np.where(row % 3 == 0, 1 / 5, np.where(row % 3 == 1, 1 / 4, 1 / 6))
    off = (row * 0.37) % 1.0
    cx = (x + off) / col_w
    cid = np.floor(cx).astype(int)
    rx = cx - cid
    ids = (row * 31 + cid * 7) % 211
    tint = rng.normal(0, 1, 211)
    warm = rng.normal(0, 1, 211)
    v = 0.93 + 0.045 * tint[ids] + 0.03 * _noise((n, n), 2.5, rng) + 0.02 * _noise((n, n), 0.8, rng)
    # bords des moellons arrondis, joints creux
    d = np.minimum(np.minimum(rx, 1 - rx) * col_w / 0.03, np.minimum(ry, 1 - ry) * heights[row] / 0.03)
    edge = np.clip(d, 0, 1)
    v = v * (0.82 + 0.18 * edge)
    joint = d < 0.28
    col = _gray(v)
    col[..., 0] *= 1 + 0.025 * warm[ids]
    col[..., 2] *= 1 - 0.03 * warm[ids]
    col = np.where(joint[..., None], np.array([0.86, 0.84, 0.80]) * (0.95 + 0.04 * _noise((n, n), 1.0, rng))[..., None], col)
    return col


def enduit(seed=103):
    """Enduit à la chaux taloché: nuances lentes, grain fin, quelques coulures sous les appuis (verticales)."""
    rng = np.random.default_rng(seed)
    n = N
    v = 0.95 + 0.03 * _noise((n, n), n / 8, rng) + 0.015 * _noise((n, n), 1.2, rng) + 0.012 * _noise((n, n), (n / 3, 2), rng)
    return _gray(v)


def tuiles(seed=105):
    """Tuiles canal en rangs de 25 cm (8 rangs sur 2 m), 12 couvrants par mètre; teintes nuancées, quelques lichens."""
    rng = np.random.default_rng(seed)
    n = N
    y, x = np.mgrid[0:n, 0:n] / n
    rows, cols = 8, 12
    r = np.floor(y * rows).astype(int)
    fy = (y * rows) % 1.0
    off = (r % 2) * 0.5
    fx = (x * cols + off) % 1.0
    cid = np.floor(x * cols + off).astype(int)
    bump = np.cos((fx - 0.5) * math.pi) ** 0.7
    ids = (r * 13 + cid) % 97
    tint = rng.normal(0, 1, 97)
    v = 0.72 + 0.26 * bump + 0.05 * tint[ids] + 0.02 * _noise((n, n), 1.5, rng)
    # ombre du rang du dessus (le bas du rang, fy proche de 1 en image = bas)
    v = v * (1 - 0.35 * np.clip((fy - 0.82) / 0.18, 0, 1) ** 1.5)
    col = _gray(v)
    hue = rng.normal(0, 1, 97)[ids]
    col[..., 1] *= 1 + 0.03 * hue
    col[..., 2] *= 1 + 0.04 * hue
    lichen = (_noise((n, n), 6, rng) > 1.6) & (bump > 0.5)
    col = np.where(lichen[..., None], col * np.array([0.95, 1.02, 0.85]), col)
    return col / max(1e-3, col.mean()) * 0.9


def paves(seed=107):
    """Pavés de grès de 10 x 14 cm en rangs décalés, têtes bombées, joints sablés."""
    rng = np.random.default_rng(seed)
    n = N
    y, x = np.mgrid[0:n, 0:n] / n
    k_y, k_x = 20, 14
    r = np.floor(y * k_y)
    off = (r % 2) * 0.5 + (r % 3) * 0.13
    fx = ((x * k_x + off) % 1.0) - 0.5
    fy = ((y * k_y) % 1.0) - 0.5
    ids = (r * 37 + np.floor(x * k_x + off)).astype(int) % 199
    tint = rng.normal(0, 1, 199)
    warm = rng.normal(0, 1, 199)
    jx = np.abs(fx) * 2
    jy = np.abs(fy) * 2
    dome = 1 - 0.5 * (jx ** 4 + jy ** 4)
    v = 0.88 + 0.06 * tint[ids] + 0.08 * (dome - 0.75) + 0.025 * _noise((n, n), 1.2, rng)
    joint = (jx > 0.86) | (jy > 0.80)
    v = np.where(joint, 0.55 + 0.05 * _noise((n, n), 1.0, rng), v)
    col = _gray(v)
    col[..., 0] *= 1 + 0.03 * warm[ids]
    col[..., 2] *= 1 - 0.04 * warm[ids]
    return col / max(1e-3, col.mean()) * 0.88


def dalles(seed=109):
    """Dalles de calcaire du trottoir (50 x 33 cm), joints fins, usure claire au milieu."""
    rng = np.random.default_rng(seed)
    n = N
    y, x = np.mgrid[0:n, 0:n] / n
    r = np.floor(y * 6)
    off = (r % 2) * 0.5
    fx = (x * 4 + off) % 1.0
    fy = (y * 6) % 1.0
    ids = (r * 11 + np.floor(x * 4 + off)).astype(int) % 61
    tint = rng.normal(0, 1, 61)
    v = 0.93 + 0.03 * tint[ids] + 0.02 * _noise((n, n), 3, rng) + 0.012 * _noise((n, n), 0.7, rng)
    joint = (np.minimum(fx, 1 - fx) < 0.008) | (np.minimum(fy, 1 - fy) < 0.012)
    v = np.where(joint, v * 0.72, v)
    return _gray(v)


# ------------------------------------------------------------------------------------------------
# Atlas des détails

def _canvas(color):
    im = Image.new("RGB", (N, N), tuple(int(c * 255) for c in rgb(color)))
    return im, ImageDraw.Draw(im)


def _font(size, sans=False):
    try:
        return ImageFont.truetype(POLICE_SANS if sans else POLICE, size)
    except OSError:
        return ImageFont.load_default()


def _text_center(d, cx, cy, txt, font, fill):
    b = d.textbbox((0, 0), txt, font=font)
    d.text((cx - (b[2] - b[0]) / 2 - b[0], cy - (b[3] - b[1]) / 2 - b[1]), txt, font=font, fill=fill)


def _vitrage(d, x0, y0, x1, y1, rng, rideau=False):
    """Carreau de vitre: reflet du ciel en haut, intérieur sombre en bas, voilage éventuel."""
    for yy in range(y0, y1):
        t = (yy - y0) / max(1, y1 - y0)
        c = (0.42 * (1 - t) + 0.16 * t, 0.46 * (1 - t) + 0.17 * t, 0.52 * (1 - t) + 0.19 * t)
        d.line([(x0, yy), (x1, yy)], fill=tuple(int(255 * v) for v in c))
    # reflet oblique
    w = x1 - x0
    d.polygon([(x0 + w * 0.15, y0), (x0 + w * 0.45, y0), (x0 + w * 0.05, y1), (x0, y1), (x0, y0 + (y1 - y0) * 0.6)], fill=(112, 124, 136))
    if rideau:
        h = int((y1 - y0) * 0.55)
        for xx in range(x0, x1):
            s = 0.85 + 0.1 * math.sin((xx - x0) * 0.6)
            d.line([(xx, y1 - h), (xx, y1)], fill=(int(226 * s), int(220 * s), int(205 * s)))


def fenetre(rideau=False, seed=111):
    """Croisée à deux vantaux de trois carreaux, bois peint crème (fond = tableau ombré)."""
    rng = np.random.default_rng(seed)
    im, d = _canvas("#3A3530")
    m, bar = 34, 16
    d.rectangle([m, m, N - m, N - m], fill=(232, 226, 210))
    mid = N // 2
    for (x0, x1) in ((m + bar, mid - bar // 2), (mid + bar // 2, N - m - bar)):
        hh = (N - 2 * m - 4 * bar) / 3
        for k in range(3):
            y0 = int(m + bar + k * (hh + bar))
            _vitrage(d, x0, y0, x1, int(y0 + hh), rng, rideau=rideau)
    d.line([(mid, m), (mid, N - m)], fill=(200, 192, 176), width=3)
    return im


def porte(seed=113):
    """Porte d'entrée à panneaux moulurés et imposte vitrée (bois clair: la teinte vient des sommets)."""
    im, d = _canvas("#E9E4DA")
    rng = np.random.default_rng(seed)
    d.rectangle([0, 0, N, 120], fill=(70, 72, 78))
    _vitrage(d, 24, 18, N - 24, 104, rng)
    d.rectangle([0, 120, N, 134], fill=(200, 196, 188))
    for (x0, x1) in ((40, 236), (276, 472)):
        for (y0, y1) in ((170, 300), (330, 480)):
            d.rectangle([x0, y0, x1, y1], fill=(214, 208, 198))
            d.rectangle([x0 + 10, y0 + 10, x1 - 10, y1 - 10], fill=(236, 232, 224))
    d.line([(N // 2, 134), (N // 2, N)], fill=(170, 166, 158), width=4)
    d.ellipse([N // 2 + 26, 318, N // 2 + 44, 336], fill=(180, 150, 80))
    return im


def vitrine_boulangerie(seed=115):
    """Vitrine garnie: étagères de pains, corbeilles de baguettes, gâteaux sous la lumière chaude du fournil."""
    rng = np.random.default_rng(seed)
    im, d = _canvas("#5A4030")
    for yy in range(N):
        t = yy / N
        c = (int(150 - 60 * t), int(108 - 50 * t), int(70 - 35 * t))
        d.line([(0, yy), (N, yy)], fill=c)
    shelves = [150, 290, 420]
    for sy in shelves:
        d.rectangle([0, sy, N, sy + 10], fill=(110, 76, 48))
    breads = [(196, 140, 74), (176, 118, 60), (214, 166, 98), (160, 104, 54)]
    for si, sy in enumerate(shelves):
        x = 8 + rng.integers(0, 20)
        while x < N - 40:
            w = int(rng.integers(40, 80))
            h = int(rng.integers(26, 44))
            c = breads[int(rng.integers(0, 4))]
            if si == 2 and rng.random() < 0.5:
                # tartes et gâteaux en bas
                d.ellipse([x, sy - 22, x + w, sy + 4], fill=(222, 170, 80))
                d.ellipse([x + 6, sy - 20, x + w - 6, sy - 6], fill=(170, 60, 60) if rng.random() < 0.5 else (230, 190, 90))
            else:
                d.ellipse([x, sy - h, x + w, sy + 2], fill=c)
                for k in range(3):
                    xx = x + w * (0.25 + 0.25 * k)
                    d.line([(xx - 6, sy - h * 0.7), (xx + 6, sy - h * 0.35)], fill=tuple(min(255, v + 30) for v in c), width=3)
            x += w + int(rng.integers(4, 16))
    # corbeille de baguettes debout à gauche
    for k in range(9):
        x = 30 + k * 12
        d.rounded_rectangle([x, 20, x + 10, 150], radius=5, fill=(206, 150, 80))
    d.rectangle([20, 110, 150, 150], fill=(150, 110, 60))
    # reflet de la place sur la vitre
    arr = np.asarray(im).astype(np.float64) / 255
    y, x = np.mgrid[0:N, 0:N] / N
    refl = np.clip(0.55 - y * 0.9 + 0.25 * np.sin((x + y) * 6), 0, 1) * 0.35
    arr = arr * (1 - refl[..., None]) + np.array([0.80, 0.82, 0.85]) * refl[..., None]
    return Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))


def enseigne_boulangerie():
    """Bandeau peint vert bouteille, lettres crème filetées d'or (texte sur la moitié haute, la basse sert au soubassement)."""
    im, d = _canvas("#2F4A3C")
    d.rectangle([10, 14, N - 10, 240], outline=(201, 162, 78), width=5)
    _text_center(d, N / 2, 92, "BOULANGERIE", _font(58), (236, 226, 196))
    _text_center(d, N / 2, 182, "PÂTISSERIE", _font(34), (201, 162, 78))
    # moitié basse: panneaux du soubassement de la devanture
    d.rectangle([0, 256, N, N], fill=(47, 74, 60))
    for (x0, x1) in ((20, 240), (272, 492)):
        d.rectangle([x0, 290, x1, 480], outline=(30, 50, 40), width=8)
        d.rectangle([x0 + 14, 304, x1 - 14, 466], outline=(70, 100, 82), width=4)
    return im


def mairie():
    """Inscription gravée MAIRIE (haut) et ÉCOLE PUBLIQUE (bas) sur pierre claire."""
    im, d = _canvas("#E6DCC6")
    d.rectangle([8, 8, N - 8, 248], outline=(196, 182, 156), width=6)
    _text_center(d, N / 2 + 2, 130, "MAIRIE", _font(96), (250, 244, 230))
    _text_center(d, N / 2, 128, "MAIRIE", _font(96), (90, 78, 62))
    d.rectangle([8, 264, N - 8, N - 8], outline=(196, 182, 156), width=6)
    _text_center(d, N / 2, 352, "ÉCOLE", _font(84), (90, 78, 62))
    _text_center(d, N / 2, 448, "PUBLIQUE", _font(50), (90, 78, 62))
    return im


def ecole():
    """Haut: drapeau tricolore (bleu, blanc, rouge); bas: plaque de rue émaillée bleue « Place du Tilleul »."""
    im, d = _canvas("#FFFFFF")
    d.rectangle([0, 0, N // 3, 255], fill=(42, 64, 140))
    d.rectangle([N // 3, 0, 2 * N // 3, 255], fill=(240, 240, 236))
    d.rectangle([2 * N // 3, 0, N, 255], fill=(200, 46, 50))
    d.rectangle([0, 256, N, N], fill=(36, 70, 140))
    d.rounded_rectangle([12, 270, N - 12, N - 14], radius=20, outline=(236, 236, 230), width=8)
    _text_center(d, N / 2, 340, "PLACE", _font(54, sans=True), (240, 240, 236))
    _text_center(d, N / 2, 420, "DU TILLEUL", _font(66, sans=True), (240, 240, 236))
    return im


def horloge():
    """Cadran émaillé blanc, chiffres romains, aiguilles à 16 h 50 (fin d'après-midi)."""
    im, d = _canvas("#3C3A36")
    c = N / 2
    d.ellipse([10, 10, N - 10, N - 10], fill=(40, 38, 34))
    d.ellipse([28, 28, N - 28, N - 28], fill=(240, 236, 224))
    f = _font(44)
    rom = ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI"]
    for i, t in enumerate(rom):
        a = math.radians(i * 30 - 90)
        _text_center(d, c + math.cos(a) * 180, c + math.sin(a) * 180, t, f, (40, 36, 30))
    for i in range(60):
        a = math.radians(i * 6 - 90)
        r0 = 222 if i % 5 else 212
        d.line([(c + math.cos(a) * r0, c + math.sin(a) * r0), (c + math.cos(a) * 226, c + math.sin(a) * 226)], fill=(40, 36, 30), width=3)
    for (ang, ln, w) in ((16 * 30 + 50 * 0.5 - 90 - 360, 120, 12), (50 * 6 - 90, 175, 7)):
        a = math.radians(ang)
        d.line([(c, c), (c + math.cos(a) * ln, c + math.sin(a) * ln)], fill=(20, 20, 20), width=w)
    d.ellipse([c - 12, c - 12, c + 12, c + 12], fill=(20, 20, 20))
    return im


def feuillage(seed=117):
    """Feuilles de tilleul en cœur, serrées, lumière du dessus; teinte claire (la couleur vient des sommets)."""
    rng = np.random.default_rng(seed)
    im = Image.new("RGB", (N, N), (70, 84, 62))
    d = ImageDraw.Draw(im)
    for i in range(900):
        x, y = rng.uniform(-20, N + 20), rng.uniform(-20, N + 20)
        s = rng.uniform(14, 26)
        a = rng.uniform(0, 2 * math.pi)
        lum = rng.uniform(0.62, 1.0)
        c = (int(196 * lum), int(222 * lum), int(160 * lum))
        pts = []
        for k in range(14):
            t = k / 14 * 2 * math.pi
            r = s * (0.55 + 0.45 * abs(math.sin(t / 2)) ** 0.5) * (1 - 0.25 * max(0, math.cos(t)))
            pts.append((x + r * math.cos(t + a), y + r * math.sin(t + a) * 0.8))
        d.polygon(pts, fill=c)
        d.line([(x, y), (x + s * 0.8 * math.cos(a + math.pi), y + s * 0.8 * math.sin(a + math.pi) * 0.8)], fill=(int(150 * lum), int(176 * lum), int(120 * lum)), width=2)
    return im.filter(ImageFilter.GaussianBlur(0.6))


def ecorce(seed=119):
    """Écorce de vieux tilleul: sillons verticaux qui se rejoignent."""
    rng = np.random.default_rng(seed)
    n = N
    y, x = np.mgrid[0:n, 0:n] / n
    warp = _noise((n, n), (n / 6, n / 30), rng) * 0.05
    ridges = np.abs(np.sin((x + warp) * math.pi * 14))
    v = 0.62 + 0.3 * ridges ** 0.6 + 0.05 * _noise((n, n), 1.5, rng)
    return Image.fromarray((np.clip(_gray(v) * np.array([1.0, 0.97, 0.93]), 0, 1) * 255).astype(np.uint8))


def affiches(seed=121):
    """Panneau d'affichage municipal: liège, avis, affiche de la fête du village, horaires (texte inventé)."""
    rng = np.random.default_rng(seed)
    im, d = _canvas("#9C7A58")
    for i in range(400):
        x, y = rng.integers(0, N), rng.integers(0, N)
        d.point((int(x), int(y)), fill=(120, 94, 66))
    d.rectangle([24, 30, 236, 300], fill=(232, 200, 90))
    _text_center(d, 130, 70, "FÊTE", _font(46), (160, 50, 40))
    _text_center(d, 130, 118, "DU TILLEUL", _font(26), (160, 50, 40))
    d.ellipse([70, 150, 190, 250], fill=(110, 140, 76))
    d.rectangle([124, 230, 136, 290], fill=(100, 72, 50))
    for (x0, y0, x1, y1) in ((262, 40, 490, 230), (262, 260, 490, 480), (30, 330, 236, 480)):
        d.rectangle([x0, y0, x1, y1], fill=(240, 236, 226))
        d.rectangle([x0 + 14, y0 + 16, x1 - 14, y0 + 34], fill=(60, 60, 70))
        for k in range(int((y1 - y0 - 60) / 18)):
            w = int(rng.integers(int((x1 - x0) * 0.5), x1 - x0 - 28))
            d.rectangle([x0 + 14, y0 + 50 + k * 18, x0 + 14 + w, y0 + 56 + k * 18], fill=(130, 130, 136))
    return im


def arret_car():
    """Plaque de l'arrêt du car (haut) et fiche horaire (bas). Ligne et lieux inventés."""
    im, d = _canvas("#F2EFE6")
    d.rectangle([0, 0, N, 250], fill=(46, 96, 150))
    d.rounded_rectangle([20, 20, 120, 120], radius=14, fill=(240, 196, 60))
    _text_center(d, 70, 70, "12", _font(54, sans=True), (30, 40, 60))
    _text_center(d, 320, 60, "ORMEVAL", _font(50, sans=True), (245, 245, 240))
    _text_center(d, 320, 120, "Place du Tilleul", _font(34, sans=True), (245, 245, 240))
    _text_center(d, N / 2, 200, "vers Mérelles", _font(36, sans=True), (240, 196, 60))
    _text_center(d, N / 2, 296, "HORAIRES", _font(34, sans=True), (40, 50, 70))
    hh = ["7:30", "9:10", "12:15", "14:05", "16:45", "18:20"]
    for i, h in enumerate(hh):
        _text_center(d, 140 + (i % 2) * 230, 360 + (i // 2) * 52, h, _font(36, sans=True), (60, 64, 74))
    return im


def persiennes(seed=123):
    """Volet à persiennes (lames inclinées), clair: la teinte (gris-bleu, vert, rouge) vient des sommets."""
    im, d = _canvas("#E6E6E2")
    d.rectangle([0, 0, N, N], outline=(180, 180, 176), width=26)
    for y in range(40, N - 40, 18):
        d.rectangle([28, y, N - 28, y + 10], fill=(250, 250, 246))
        d.rectangle([28, y + 10, N - 28, y + 16], fill=(150, 152, 150))
    d.rectangle([28, N // 2 - 10, N - 28, N // 2 + 10], fill=(214, 214, 210))
    return im


def fleurs(seed=125):
    """Géraniums de jardinière: feuilles rondes et boules de fleurs rouges et roses."""
    rng = np.random.default_rng(seed)
    im = Image.new("RGB", (N, N), (58, 84, 46))
    d = ImageDraw.Draw(im)
    for i in range(260):
        x, y, r = rng.uniform(0, N), rng.uniform(0, N), rng.uniform(14, 30)
        g = rng.uniform(0.75, 1.1)
        d.ellipse([x - r, y - r * 0.8, x + r, y + r * 0.8], fill=(int(74 * g), int(116 * g), int(58 * g)))
    cols = [(196, 50, 52), (220, 90, 110), (232, 120, 140), (180, 40, 60), (240, 236, 226)]
    for i in range(70):
        x, y = rng.uniform(10, N - 10), rng.uniform(0, N * 0.75)
        c = cols[int(rng.integers(0, len(cols)))]
        for k in range(12):
            dx, dy = rng.normal(0, 9, 2)
            d.ellipse([x + dx - 6, y + dy - 6, x + dx + 6, y + dy + 6], fill=c)
    return im.filter(ImageFilter.GaussianBlur(0.5))


def rosace():
    """Rosace de l'église (haut) et porte de chêne cloutée du portail (bas)."""
    im, d = _canvas("#CDBB98")
    c, r = N / 2, 120
    cy = 128
    d.ellipse([c - r - 8, cy - r - 8, c + r + 8, cy + r + 8], fill=(170, 152, 120))
    cols = [(60, 70, 120), (150, 50, 50), (70, 110, 80), (190, 150, 60)]
    for k in range(12):
        a0 = k * 30
        d.pieslice([c - r, cy - r, c + r, cy + r], a0, a0 + 30, fill=cols[k % 4], outline=(60, 54, 44), width=4)
    d.ellipse([c - 40, cy - 40, c + 40, cy + 40], fill=(200, 170, 70), outline=(60, 54, 44), width=4)
    d.rectangle([0, 256, N, N], fill=(96, 66, 44))
    for x in range(0, N, 32):
        d.line([(x, 256), (x, N)], fill=(76, 52, 34), width=3)
    for y in range(290, N, 60):
        for x in range(16, N, 64):
            d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(40, 36, 32))
    d.line([(N // 2, 256), (N // 2, N)], fill=(50, 36, 26), width=6)
    return im


def construire_atlas(path):
    gens = {"blanc": lambda: _canvas("#FFFFFF")[0], "fenetre": fenetre, "fenetre_rideau": lambda: fenetre(rideau=True),
            "porte": porte, "vitrine_boul": vitrine_boulangerie, "enseigne_boul": enseigne_boulangerie, "mairie": mairie,
            "ecole": ecole, "horloge": horloge, "feuillage": feuillage, "ecorce": ecorce, "affiches": affiches,
            "arret_car": arret_car, "persiennes": persiennes, "fleurs": fleurs, "rosace": rosace}
    atlas = Image.new("RGB", (4 * N, 4 * N))
    for i, name in enumerate(ATLAS_TILES):
        im = gens[name]()
        atlas.paste(im.convert("RGB"), ((i % 4) * N, (i // 4) * N))
    atlas.save(path, quality=88)


def tile_rect(name):
    """Rectangle UV (Blender: v vers le haut) d'une case de l'atlas, avec une marge de 4 px contre le débord des mipmaps."""
    i = ATLAS_TILES.index(name)
    col, row = i % 4, i // 4
    m = 4 / (4 * N)
    u0, u1 = col / 4 + m, (col + 1) / 4 - m
    v1 = 1 - row / 4 - m
    v0 = 1 - (row + 1) / 4 + m
    return u0, v0, u1, v1


# ------------------------------------------------------------------------------------------------
# Ciel de fin d'après-midi (bible 2.4: haut #C9C9D6, horizon #F5D3A8), projection en longitude et hauteur

SKY_W, SKY_H = 1024, 512
SKY_WHITE_ROWS = 16  # bandeau blanc en bas: le lointain (collines, toits) y prend ses UV, couleurs de sommets


def ciel(sun_az_deg, sun_el_deg, seed=127):
    """Image du dôme: u = azimut (0 = nord du plan, sens horaire vu du dessus), v = hauteur de 0 (horizon) à 90 degrés."""
    rng = np.random.default_rng(seed)
    w, h = SKY_W, SKY_H - SKY_WHITE_ROWS
    yy, xx = np.mgrid[0:h, 0:w]
    el = (1 - yy / (h - 1)) * 90.0
    az = xx / w * 360.0
    top, hor = rgb("#B4C0D8"), rgb("#F5D3A8")
    t = np.clip(el / 55.0, 0, 1) ** 0.55
    col = hor[None, None, :] * (1 - t[..., None]) + top[None, None, :] * t[..., None]
    # lueur du soleil
    sa, se = math.radians(sun_az_deg), math.radians(sun_el_deg)
    a, e = np.radians(az), np.radians(el)
    cosang = np.sin(e) * math.sin(se) + np.cos(e) * math.cos(se) * np.cos(a - sa)
    ang = np.degrees(np.arccos(np.clip(cosang, -1, 1)))
    glow = np.exp(-ang / 18.0) * 0.45 + np.exp(-ang / 3.0) * 0.5
    col = col + glow[..., None] * rgb("#FFE2B0")[None, None, :] * 0.8
    disc = ang < 1.6
    col = np.where(disc[..., None], np.array([1.0, 0.97, 0.88]), col)
    # nuages: cumulus aplatis près de l'horizon, quelques traînées plus haut; bord éclairé côté soleil
    base = _noise((h, w), (6, 26), rng) * 0.6 + _noise((h, w), (2.5, 9), rng) * 0.4
    band = np.exp(-((el - 14) / 9) ** 2) * 1.0 + np.exp(-((el - 34) / 6) ** 2) * 0.55
    dens = np.clip((base * band - 0.55) * 1.6, 0, 1)
    lit = np.clip(0.5 + 0.5 * np.cos(a - sa), 0, 1)
    cloud_col = rgb("#F7E6D2")[None, None, :] * (0.82 + 0.18 * lit[..., None]) - 0.10 * np.clip((base[..., None] - 1.0), 0, 1)
    col = col * (1 - dens[..., None] * 0.85) + cloud_col * dens[..., None] * 0.85
    out = np.ones((SKY_H, w, 3))
    out[:h] = col
    return np.clip(out, 0, 1)


def construire(dossier, sun_az_deg, sun_el_deg):
    os.makedirs(dossier, exist_ok=True)
    out = {}
    for name, fn in (("place_pierre", pierre), ("place_enduit", enduit), ("place_tuiles", tuiles), ("place_paves", paves),
                     ("place_dalles", dalles)):
        p = os.path.join(dossier, name + ".jpg")
        _save(fn(), p)
        out[name] = p
    p = os.path.join(dossier, "place_atlas.jpg")
    construire_atlas(p)
    out["place_atlas"] = p
    p = os.path.join(dossier, "place_ciel.jpg")
    _save(ciel(sun_az_deg, sun_el_deg), p, quality=90)
    out["place_ciel"] = p
    return out

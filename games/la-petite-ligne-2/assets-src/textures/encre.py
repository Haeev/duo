"""Motifs en style « bande dessinée encrée » (direction du client, 2026-11-10, version définitive).

Règles du style, tenues par chaque motif:
- aplats peints à 2 ou 3 tons par matière (`tons`: clair, moyen, sombre), aucun bruit fin, aucun
  relief cuit, aucune brillance;
- contours et joints à l'encre, épais et irréguliers: largeur modulée par un bruit lent, tracé
  déformé (coordonnées gauchies) pour que dalles, planches et pierres soient un peu de travers;
- ombres en taches plates et en hachures, du côté opposé à la lumière (en haut à gauche);
- herbe en touffes de traits sombres sur aplat.

Tout se calcule sur un tore (outils de motifs.py, traits dessinés modulo la taille): la texture se
raccorde par construction. Un motif rend (couleur 0..1, hauteur); la hauteur ne sert plus qu'aux
normales facultatives, que le style n'emploie pas.
"""
from __future__ import annotations

import math

import numpy as np
from scipy.ndimage import gaussian_filter

from motifs import (Contexte, bords_reguliers, coupes_aleatoires, coupes_regulieres, lisse, melange,
                    rangees, voronoi)

# ------------------------------------------------------------------ outils d'encre


def tons(ctx: Contexte, f: dict) -> np.ndarray:
    """Les 2 ou 3 tons de la matière (clair, moyen, sombre), tableau (n, 3)."""
    return np.array([ctx.c(c) for c in f["tons"]])


def encre(ctx: Contexte, f: dict) -> np.ndarray:
    return ctx.c(f.get("encre", "encre"))


def largeur_variable(ctx: Contexte, largeur_m: float, irregulier: float = 0.45) -> np.ndarray:
    """Largeur de trait qui enfle et s'amincit le long du tracé, comme un pinceau."""
    return largeur_m * np.clip(1 + ctx.bruit(0.15, 2) * irregulier, 0.35, 1.9)


def gauchir(ctx: Contexte, amplitude_m: float, echelle_m: float = 0.4):
    """Coordonnées déformées (périodiques): les grilles tracées dessus sont de travers."""
    dx = ctx.bruit(echelle_m, 2) * amplitude_m
    dy = ctx.bruit(echelle_m, 2) * amplitude_m
    return ctx.xm + dx, ctx.ym + dy


class Gauchi:
    """Remplace un moment les coordonnées du contexte par des coordonnées gauchies."""

    def __init__(self, ctx: Contexte, amplitude_m: float, echelle_m: float = 0.4):
        self.ctx = ctx
        self.xy = gauchir(ctx, amplitude_m, echelle_m)

    def __enter__(self):
        self.sauve = (self.ctx.xm, self.ctx.ym)
        self.ctx.xm, self.ctx.ym = self.xy
        return self

    def __exit__(self, *exc):
        self.ctx.xm, self.ctx.ym = self.sauve


def trait_net(dist: np.ndarray, demi_largeur: np.ndarray, ctx: Contexte) -> np.ndarray:
    """Masque d'un trait d'encre: bord franc, adouci sur un seul pixel."""
    f = 0.6 / ctx.ppm
    return 1 - lisse(demi_largeur - f, demi_largeur + f, dist)


def traits(ctx: Contexte, segments: list[tuple[float, float, float, float, float]]) -> np.ndarray:
    """Dessine des segments effilés (x0, y0, x1, y1 en mètres, largeur en mètres au départ) sur le
    tore; la largeur décroît jusqu'au tiers vers l'extrémité. Rend un masque 0..1."""
    m = np.zeros((ctx.h, ctx.w))
    p = ctx.ppm
    for x0, y0, x1, y1, lw in segments:
        x0, y0, x1, y1 = x0 * p, y0 * p, x1 * p, y1 * p
        r = lw * p / 2 + 1.5
        xa, xb = int(math.floor(min(x0, x1) - r)), int(math.ceil(max(x0, x1) + r))
        ya, yb = int(math.floor(min(y0, y1) - r)), int(math.ceil(max(y0, y1) + r))
        ys, xs = np.mgrid[ya:yb + 1, xa:xb + 1].astype(float) + 0.5
        vx, vy = x1 - x0, y1 - y0
        l2 = vx * vx + vy * vy + 1e-9
        t = np.clip(((xs - x0) * vx + (ys - y0) * vy) / l2, 0, 1)
        d = np.hypot(xs - (x0 + t * vx), ys - (y0 + t * vy))
        demi = lw * p / 2 * (1 - 0.65 * t)
        a = 1 - lisse(demi - 0.6, demi + 0.6, d)
        iy = np.mod(np.arange(ya, yb + 1), ctx.h)
        ix = np.mod(np.arange(xa, xb + 1), ctx.w)
        m[np.ix_(iy, ix)] = np.maximum(m[np.ix_(iy, ix)], a)
    return m


def hachures(ctx: Contexte, zone: np.ndarray, pas_m: float, largeur_m: float) -> np.ndarray:
    """Hachures diagonales (lumière en haut à gauche: elles descendent vers la droite), coupées en
    tirets irréguliers et limitées à une zone 0..1."""
    t = np.mod((ctx.xm - ctx.ym) / pas_m, 1)
    ligne = 1 - lisse(largeur_m / pas_m * 0.5, largeur_m / pas_m * 0.5 + 0.6 / (pas_m * ctx.ppm), np.abs(t - 0.5))
    tirets = ctx.bruit(0.06, 1, (0.5, 0.5)) > -0.2
    return ligne * tirets * zone


def aplats(ctx: Contexte, palette: np.ndarray, echelle_m: float, seuils=(-0.35, 0.55)) -> tuple[np.ndarray, np.ndarray]:
    """Grandes taches plates: le bruit lent est posterisé en tons (indice 0..len-1)."""
    n = ctx.bruit(echelle_m, 2)
    idx = np.zeros(n.shape, dtype=int)
    idx[n < seuils[0]] = 1
    if len(palette) > 2:
        idx[n > seuils[1]] = 0
        idx[(n >= seuils[0]) & (n <= seuils[1])] = 1
        idx[n < seuils[0]] = 2
    return palette[idx], idx


def cerne_de(masque: np.ndarray, ctx: Contexte, largeur_m: float) -> np.ndarray:
    """Contour à l'encre d'une zone (bord du masque), sur le tore."""
    flou = gaussian_filter(masque.astype(float), largeur_m * ctx.ppm * 0.5, mode="wrap")
    return lisse(0.08, 0.2, flou) * (1 - lisse(0.8, 0.92, flou))


def touffes(ctx: Contexte, densite: float, hauteur_m: float, largeur_m: float, brins=(3, 6)):
    """Touffes d'herbe: faisceaux de traits qui partent d'un pied et s'ouvrent en éventail."""
    rng = ctx.rng
    n = max(1, int(densite * ctx.sx * ctx.sy))
    segs = []
    for _ in range(n):
        x, y = rng.uniform(0, ctx.sx), rng.uniform(0, ctx.sy)
        k = rng.integers(brins[0], brins[1] + 1)
        h = hauteur_m * rng.uniform(0.6, 1.3)
        penche = rng.normal(0, 0.25)
        for j in range(k):
            a = -math.pi / 2 + penche + (j - (k - 1) / 2) * rng.uniform(0.18, 0.32)
            l = h * rng.uniform(0.6, 1.0)
            segs.append((x + (j - k / 2) * largeur_m * 0.6, y, x + math.cos(a) * l, y + math.sin(a) * l,
                         largeur_m * rng.uniform(0.8, 1.2)))
    return traits(ctx, segs)


def ombre_interne(tu, tv, du, dv, part: float, ctx: Contexte) -> np.ndarray:
    """Tache d'ombre plate dans le bas et à droite de chaque élément (lumière en haut à gauche)."""
    seuil = 1 - part
    bord = np.maximum(tu, tv) + ctx.bruit(0.05, 1) * 0.06
    return (bord > seuil).astype(float)


# ------------------------------------------------------------------ éléments posés (pavés, dalles, pierres, planches)


def elements(ctx: Contexte, f: dict, bords, coupes, axe="x", gauchi=0.012):
    """Base commune des matières faites d'éléments cernés: tons par élément, tache d'ombre,
    joint d'encre épais et irrégulier."""
    with Gauchi(ctx, gauchi, f.get("gauchi_echelle", 0.35)):
        ids, d, du, dv, tu, tv = rangees(ctx, bords, coupes, axe)
    pal = tons(ctx, f)
    n = int(ids.max()) + 1
    poids = np.array(f.get("poids_tons", [0.45, 0.4, 0.15][:len(pal)]))
    choix = ctx.rng.choice(len(pal), n, p=poids / poids.sum())
    col = pal[choix][ids]
    # tache d'ombre: le ton sombre de la matière, ou le moyen sur un élément déjà sombre
    sombre = pal[np.minimum(choix + 1, len(pal) - 1)][ids]
    if axe == "x":
        om = ombre_interne(tu, tv, du, dv, f.get("ombre", 0.22), ctx)
    else:
        om = ombre_interne(tv, tu, dv, du, f.get("ombre", 0.22), ctx)
    om *= (ctx.rng.random(n) < f.get("part_ombre", 0.7))[ids]
    col = melange(col, sombre, om)
    if f.get("hachures", 0):
        h = hachures(ctx, om * (ctx.rng.random(n) < f["hachures"])[ids], f.get("pas_hachure", 0.03), f.get("trait", 0.012) * 0.45)
        col = melange(col, encre(ctx, f), h)
    jl = largeur_variable(ctx, f.get("trait", 0.012), f.get("irregulier", 0.45))
    if f.get("mortier"):
        col = melange(col, ctx.c(f["mortier"]), trait_net(d, f["joint_l"] / 2, ctx))
        col = melange(col, encre(ctx, f), trait_net(np.abs(d - f["joint_l"] / 2), jl / 2, ctx))
    else:
        col = melange(col, encre(ctx, f), trait_net(d, jl / 2, ctx))
    return col, ids, d, tu, tv, choix


def fissures(ctx: Contexte, f: dict, n: int, longueur_m: float) -> np.ndarray:
    segs = []
    for _ in range(n):
        x, y = ctx.rng.uniform(0, ctx.sx), ctx.rng.uniform(0, ctx.sy)
        a = ctx.rng.uniform(0, 2 * math.pi)
        for _ in range(3):
            l = longueur_m * ctx.rng.uniform(0.3, 0.6)
            x2, y2 = x + math.cos(a) * l, y + math.sin(a) * l
            segs.append((x, y, x2, y2, f.get("trait", 0.012) * 0.7))
            x, y, a = x2, y2, a + ctx.rng.normal(0, 0.6)
    return traits(ctx, segs)


# ------------------------------------------------------------------ motifs


def e_herbe(ctx, f):
    pal = tons(ctx, f)
    col, _ = aplats(ctx, pal[:2], f.get("taches", 0.2), (f.get("part_sombre", -0.4), 9))
    if len(pal) > 2:
        creux = ctx.bruit(0.12, 2) < -1.3
        col = melange(col, pal[2], creux.astype(float))
    t = touffes(ctx, f.get("densite", 8), f.get("brin", 0.16), f.get("trait", 0.016))
    col = melange(col, ctx.c(f.get("trait_herbe", f.get("encre", "encre"))), t)
    if "fleurs" in f:
        n = int(f.get("densite_fleurs", 3) * ctx.sx * ctx.sy)
        p = ctx.rng.uniform([0, 0], [ctx.sx, ctx.sy], (n, 2))
        ids, _, dc = voronoi(ctx, p)
        a = trait_net(dc, 0.018, ctx)
        ring = trait_net(np.abs(dc - 0.018), 0.005, ctx)
        tab = np.array([ctx.c(c) for c in f["fleurs"]])
        col = melange(col, tab[ids % len(tab)], a)
        col = melange(col, encre(ctx, f), ring)
    return col, np.zeros((ctx.h, ctx.w))


def cailloux_cernes(ctx, f, col, densite, taille):
    n = max(1, int(densite * ctx.sx * ctx.sy))
    p = ctx.rng.uniform([0, 0], [ctx.sx, ctx.sy], (n, 2))
    with Gauchi(ctx, taille * 0.25, taille * 2):
        ids, _, dc = voronoi(ctx, p)
    r = taille * (0.6 + 0.8 * ((ids * 2654435761) % 1000) / 1000)
    dedans = dc < r
    garde = ((ids * 40503) % 1000 / 1000 < f.get("part_cailloux", 0.6))
    tab = np.array([ctx.c(c) for c in f.get("tons_cailloux", f["tons"][:1])])
    cc = tab[ids % len(tab)]
    om = (dc < r) & ((ctx.xm - p[ids % n, 0] + ctx.ym - p[ids % n, 1]) > r * 0.5)
    cc = np.where(om[..., None], cc * 0.82, cc)
    col = melange(col, cc, (dedans & garde).astype(float))
    ring = trait_net(np.abs(dc - r), taille * 0.18 + 0.4 / ctx.ppm, ctx) * garde
    return melange(col, encre(ctx, f), ring)


def e_terre(ctx, f):
    pal = tons(ctx, f)
    col, _ = aplats(ctx, pal, f.get("taches", 0.16), f.get("seuils", (-0.8, 0.9)))
    if f.get("cailloux", 0):
        col = cailloux_cernes(ctx, f, col, f["cailloux"], f.get("taille_cailloux", 0.03))
    if f.get("tirets", 0):
        segs = []
        for _ in range(int(f["tirets"] * ctx.sx * ctx.sy)):
            x, y = ctx.rng.uniform(0, ctx.sx), ctx.rng.uniform(0, ctx.sy)
            a = ctx.rng.normal(0, 0.35)
            l = ctx.rng.uniform(0.03, 0.09)
            segs.append((x, y, x + math.cos(a) * l, y + math.sin(a) * l, f.get("trait", 0.012) * 0.7))
        col = melange(col, encre(ctx, f), traits(ctx, segs))
    if f.get("touffes", 0):
        t = touffes(ctx, f["touffes"], f.get("brin", 0.07), f.get("trait", 0.012), (3, 5))
        col = melange(col, ctx.c(f.get("trait_herbe", "encre")), t)
    if f.get("ornieres", 0):
        # deux ornières parallèles à x, en taches sombres bordées d'un trait
        y = np.mod(ctx.ym + ctx.bruit(0.5, 1) * 0.04, ctx.sy)
        m = np.zeros_like(y)
        for y0 in f["ornieres"]:
            m = np.maximum(m, (np.abs(y - y0 * ctx.sy) < 0.06).astype(float))
        col = melange(col, pal[-1], m)
    return col, np.zeros((ctx.h, ctx.w))


def e_paves(ctx, f):
    t = f["pave"]
    ny = ctx.entier(ctx.sy, t)
    nx = ctx.entier(ctx.sx, t * f.get("allonge", 1.0))
    ctx.mesures["pave"] = ctx.sy / ny
    coupes = [coupes_regulieres(nx, ctx.sx, ctx.rng.uniform(0, 1)) + ctx.rng.normal(0, t * 0.06, nx) for _ in range(ny)]
    col, *_ = elements(ctx, f, bords_reguliers(ny, ctx.sy), coupes, gauchi=t * 0.12)
    return col, np.zeros((ctx.h, ctx.w))


def e_dalles(ctx, f):
    lx, ly = f["dalle"], f.get("dalle_h", f["dalle"])
    nx, ny = ctx.entier(ctx.sx, lx), ctx.entier(ctx.sy, ly)
    if f.get("quinconce"):
        ny += ny % 2
    ctx.mesures["dalle"] = ctx.sx / nx
    coupes = [coupes_regulieres(nx, ctx.sx, 0.5 * (i % 2) if f.get("quinconce") else 0) for i in range(ny)]
    col, *_ = elements(ctx, f, bords_reguliers(ny, ctx.sy), coupes, gauchi=lx * 0.04)
    if f.get("fissures", 0):
        col = melange(col, encre(ctx, f), fissures(ctx, f, int(f["fissures"] * ctx.sx * ctx.sy), lx * 0.6))
    if "bordure" in f:
        # bord de quai: une bande claire le long de y = 0 (bord du quai, côté voie)
        b = f["bordure"]
        y = np.mod(ctx.ym, ctx.sy)
        m = (y < b).astype(float)
        col = melange(col, ctx.c(f["ton_bordure"]), m)
        col = melange(col, encre(ctx, f), trait_net(np.abs(y - b), largeur_variable(ctx, f.get("trait", 0.012)) / 2, ctx))
    return col, np.zeros((ctx.h, ctx.w))


def e_planches(ctx, f):
    vertical = f.get("sens", "horizontal") == "vertical"
    axe = "y" if vertical else "x"
    travers = ctx.sx if vertical else ctx.sy
    long_ = ctx.sy if vertical else ctx.sx
    n = ctx.entier(travers, f["lame"])
    ctx.mesures["lame"] = travers / n
    if f.get("longueur", 0) > 0:
        coupes = [coupes_aleatoires(ctx, long_, f["longueur"], 0.25) for _ in range(n)]
        ctx.mesures["longueur_lame"] = long_ / ctx.entier(long_, f["longueur"])
    else:
        coupes = [np.array([ctx.rng.uniform(0, long_)]) for _ in range(n)]
    col, ids, d, tu, tv, choix = elements(ctx, f, bords_reguliers(n, travers), coupes, axe, gauchi=f.get("gauchi", 0.006))
    # veinures: quelques longs traits fins d'encre dans le sens des lames
    segs = []
    for _ in range(int(f.get("veines", 6) * ctx.sx * ctx.sy)):
        u, v = ctx.rng.uniform(0, long_), ctx.rng.uniform(0, travers)
        l = ctx.rng.uniform(0.1, 0.3)
        c = ctx.rng.normal(0, 0.004)
        p = (u, v, u + l, v + c) if not vertical else (v, u, v + c, u + l)
        segs.append((*p, f.get("trait", 0.012) * 0.35))
    col = melange(col, encre(ctx, f), traits(ctx, segs) * 0.85)
    if f.get("noeuds", 0):
        k = int(f["noeuds"] * ctx.sx * ctx.sy)
        p = ctx.rng.uniform([0, 0], [ctx.sx, ctx.sy], (max(k, 1), 2))
        _, _, dc = voronoi(ctx, p)
        col = melange(col, encre(ctx, f), trait_net(np.abs(dc - 0.012), 0.003, ctx))
    if f.get("clous", False):
        with Gauchi(ctx, f.get("gauchi", 0.006)):
            ids2, d2, du, dv, tu2, tv2 = rangees(ctx, bords_reguliers(n, travers), coupes, axe)
        # deux clous à 2,5 cm du bout de chaque lame, au milieu de sa largeur
        clou = trait_net(np.hypot(du - 0.025, np.abs(dv - travers / n * 0.5)), 0.006, ctx)
        col = melange(col, encre(ctx, f), clou)
    return col, np.zeros((ctx.h, ctx.w))


def e_bardage(ctx, f):
    """Clins horizontaux: trait épais sous chaque lame et bande d'ombre plate dessous."""
    n = ctx.entier(ctx.sy, f["lame"])
    ctx.mesures["lame"] = ctx.sy / n
    coupes = [coupes_aleatoires(ctx, ctx.sx, f.get("longueur", 2.0), 0.2) for _ in range(n)]
    g = dict(f)
    g["ombre"] = 0
    col, ids, d, tu, tv, choix = elements(ctx, g, bords_reguliers(n, ctx.sy), coupes, gauchi=0.004)
    pal = tons(ctx, f)
    with Gauchi(ctx, 0.004):
        _, _, du, dv, tu2, tv2 = rangees(ctx, bords_reguliers(n, ctx.sy), coupes)
    col = melange(col, pal[-1], (tv2 < f.get("ombre_lame", 0.22)).astype(float))
    if f.get("hachures", 0):
        col = melange(col, encre(ctx, f), hachures(ctx, (tv2 < f.get("ombre_lame", 0.22)).astype(float), 0.025, 0.005))
    if f.get("ecaille", 0):
        m = ctx.bruit(0.06, 2) > 2.0 - f["ecaille"]
        col = melange(col, ctx.c(f["dessous"]), m.astype(float))
        col = melange(col, encre(ctx, f), cerne_de(m, ctx, 0.008))
    return col, np.zeros((ctx.h, ctx.w))


def e_crepi(ctx, f):
    pal = tons(ctx, f)
    col, idx = aplats(ctx, pal, f.get("taches", 0.1), f.get("seuils", (-0.9, 1.0)))
    # écailles: zones plus sombres cernées d'un trait fin, comme un enduit qui s'en va
    if f.get("ecaille", 0):
        m = ctx.bruit(0.08, 2) > 2.0 - f["ecaille"]
        col = melange(col, ctx.c(f.get("dessous", f["tons"][-1])), m.astype(float))
        col = melange(col, encre(ctx, f), cerne_de(m, ctx, 0.01))
    if f.get("taches_encre", 0):
        segs = []
        for _ in range(int(f["taches_encre"] * ctx.sx * ctx.sy)):
            x, y = ctx.rng.uniform(0, ctx.sx), ctx.rng.uniform(0, ctx.sy)
            a = ctx.rng.uniform(0, math.pi)
            l = ctx.rng.uniform(0.01, 0.04)
            segs.append((x, y, x + math.cos(a) * l, y + math.sin(a) * l, f.get("trait", 0.012) * 0.6))
        col = melange(col, encre(ctx, f), traits(ctx, segs))
    if f.get("fissures", 0):
        col = melange(col, encre(ctx, f), fissures(ctx, f, int(f["fissures"] * ctx.sx * ctx.sy), 0.25))
    return col, np.zeros((ctx.h, ctx.w))


def e_pierre(ctx, f):
    hm = f["assise"]
    ny = ctx.entier(ctx.sy, hm)
    hh = np.clip(ctx.rng.normal(1, 0.2, ny), 0.6, 1.5)
    bords = np.concatenate([[0], np.cumsum(hh / hh.sum() * ctx.sy)])
    ctx.mesures["pierre"] = float(np.mean(np.diff(bords)))
    coupes = [coupes_aleatoires(ctx, ctx.sx, f["longueur"], f.get("ecart", 0.35)) for _ in range(ny)]
    col, *_ = elements(ctx, f, bords, coupes, gauchi=hm * 0.12)
    if f.get("mousse", 0):
        m = ctx.bruit(0.08, 2) > 1.9 - f["mousse"]
        col = melange(col, ctx.c(f["ton_mousse"]), m.astype(float))
    return col, np.zeros((ctx.h, ctx.w))


def e_tuiles(ctx, f):
    """Rangs de tuiles: chaque tuile cernée, bas arrondi, ombre plate sous le rang du dessus."""
    lt, ht = f["tuile"], f.get("pureau", 0.14)
    nx, ny = ctx.entier(ctx.sx, lt), ctx.entier(ctx.sy, ht)
    ny += ny % 2
    ctx.mesures["tuile"] = ctx.sx / nx
    coupes = [coupes_regulieres(nx, ctx.sx, 0.5 * (i % 2)) for i in range(ny)]
    pal = tons(ctx, f)
    with Gauchi(ctx, lt * 0.05):
        ids, d, du, dv, tu, tv = rangees(ctx, bords_reguliers(ny, ctx.sy), coupes)
    n = int(ids.max()) + 1
    choix = ctx.rng.choice(len(pal) - 1, n)
    col = pal[choix][ids]
    # bas arrondi: la tuile s'arrête sur un arc; dessous, le rang inférieur (plus sombre)
    arc = 0.62 + 0.38 * np.sqrt(np.clip(1 - ((tu - 0.5) * 2) ** 2, 0, 1))
    sous = tv > arc
    col = np.where(sous[..., None], pal[-1], col)
    om = (tv < f.get("ombre", 0.22)) & ~sous
    col = melange(col, pal[-1], om.astype(float) * 0.85)
    if f.get("hachures", 0):
        col = melange(col, encre(ctx, f), hachures(ctx, om.astype(float), 0.022, 0.0045))
    th = ctx.sy / ny
    lw = largeur_variable(ctx, f.get("trait", 0.012))
    dist_arc = np.abs(tv - arc) * th
    trace = np.minimum(dist_arc, np.where(tv < arc, du, 1.0))
    col = melange(col, encre(ctx, f), trait_net(trace, lw / 2, ctx))
    if f.get("mousse", 0):
        m = (ctx.bruit(0.07, 2) > 2.0 - f["mousse"]) & ~sous
        col = melange(col, ctx.c(f["ton_mousse"]), m.astype(float))
    return col, np.zeros((ctx.h, ctx.w))


def e_eau(ctx, f):
    """Eau: deux ou trois aplats en longues nappes, rides en traits sombres, éclats clairs."""
    pal = tons(ctx, f)
    with Gauchi(ctx, 0.08, 0.6):
        n = ctx.bruit(0.12, 2, (2.5, 1))
    idx = np.where(n > 0.5, 0, np.where(n < -0.6, 2 if len(pal) > 2 else 1, 1))
    col = pal[idx]
    segs, clairs = [], []
    for _ in range(int(f.get("rides", 10) * ctx.sx * ctx.sy)):
        x, y = ctx.rng.uniform(0, ctx.sx), ctx.rng.uniform(0, ctx.sy)
        l = ctx.rng.uniform(0.08, 0.25)
        b = ctx.rng.normal(0, 0.01)
        segs.append((x, y, x + l / 2, y - 0.01 + b, f.get("trait", 0.012) * 0.6))
        segs.append((x + l / 2, y - 0.01 + b, x + l, y, f.get("trait", 0.012) * 0.45))
        if ctx.rng.random() < 0.5:
            clairs.append((x + 0.02, y - 0.03, x + l * 0.6, y - 0.035, f.get("trait", 0.012) * 0.5))
    col = melange(col, ctx.c(f.get("trait_eau", "encre")), traits(ctx, segs))
    col = melange(col, ctx.c(f.get("eclat", "#E8F1EC")), traits(ctx, clairs))
    return col, np.zeros((ctx.h, ctx.w))


def e_brique(ctx, f):
    lb, hb = f["brique"], f.get("hauteur", 0.065)
    jl = f.get("joint_l", 0.012)
    ny = ctx.entier(ctx.sy, hb + jl)
    ny += ny % 2
    nx = ctx.entier(ctx.sx, lb + jl)
    ctx.mesures["brique"] = ctx.sx / nx - jl
    coupes = [coupes_regulieres(nx, ctx.sx, 0.5 * (i % 2)) for i in range(ny)]
    g = dict(f, joint_l=jl)
    col, *_ = elements(ctx, g, bords_reguliers(ny, ctx.sy), coupes, gauchi=0.006)
    return col, np.zeros((ctx.h, ctx.w))


MOTIFS = {
    "herbe": e_herbe, "terre": e_terre, "paves": e_paves, "dalles": e_dalles, "planches": e_planches,
    "bardage": e_bardage, "crepi": e_crepi, "pierre": e_pierre, "tuiles": e_tuiles, "eau": e_eau,
    "brique": e_brique,
}

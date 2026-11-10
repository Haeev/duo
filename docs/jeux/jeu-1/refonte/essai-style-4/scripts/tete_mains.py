"""Refonte des têtes et des mains des corps communs (essai 4, planche `comparaison-tetes.png`).

Appelé par `conformer_corps.py`, sur le maillage Meshy soudé, avant la réduction. Tout se fait dans le repère
du monde (mètres, Z en haut, avant -Y) puis revient dans celui de l'objet.

Pourquoi: les traits du visage sont dessinés (atlas des traits). Le modelé de Meshy (narines, lèvres, orbites
creuses, facettes) découpait l'ombre à deux tons en taches qui coupaient les yeux, et la coque d'encre
cernait les orbites. On garde le crâne, la mâchoire et les oreilles, on lisse le masque du visage.

1. `mesurer`: repères du visage relevés sur le profil médian (plan x = 0) et sur les orbites: sommet, menton,
   racine du nez, bout du nez, yeux, bouche, demi-écart des yeux. Plus aucun réglage à l'oeil.
2. `lisser_visage`: le masque du visage (ellipse front-menton, poids doux) est remplacé par une surface lisse
   ajustée sur le front, les joues et le menton (polynôme pair en x), plus un nez simple (arête et bout, sans
   narines), des orbites à peine creusées et aucune lèvre. Le maillage du masque est d'abord subdivisé deux
   fois pour que la réduction retrouve des grands plans propres.
3. `normales_visage`: normales imposées dans le masque, celles de la surface lisse: l'ombre à deux tons y
   trace une seule courbe nette. Attribut `_VISAGE` (0 à 1) exporté dans le GLB: le nuanceur y coupe la coque
   d'encre (aucun cerne intérieur) et le troisième ton.
4. `mitaines`: la main de Meshy (doigts écartés, raides) est remplacée par une moufle à la taille de la fiche
   (`[mains]`): paume, bloc des quatre doigts plié en deux temps aux jointures, pouce séparé; le poignet entre
   dans l'avant-bras, dont le bout est bouché.
"""
import math

import bmesh
import numpy as np
from mathutils import Vector

TETE = ("Head", "head_end", "headfront")


def _smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def _dom(bm, deform, names):
    out = {}
    for v in bm.verts:
        dv = v[deform]
        out[v] = names[max(dv.items(), key=lambda kv: kv[1])[0]] if len(dv) else ""
    return out


def _ilots(bm):
    """Îlots de faces reliées (listes de faces)."""
    seen, out = set(), []
    for f in bm.faces:
        if f in seen:
            continue
        pile, comp = [f], []
        seen.add(f)
        while pile:
            g = pile.pop()
            comp.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h not in seen:
                        seen.add(h)
                        pile.append(h)
        out.append(comp)
    return out


# ---------------------------------------------------------------- 1. repères mesurés
def mesurer(bm, mw, deform, names, head_z):
    """Repères du visage (mètres, monde) relevés sur la tête soudée et mise à l'échelle."""
    dom = _dom(bm, deform, names)
    head = [v for v in bm.verts if dom[v] in TETE]
    P = {v: np.array(mw @ v.co) for v in bm.verts}
    hp = np.array([P[v] for v in head])
    top = float(hp[:, 2].max())
    cy = float(hp[:, 1].mean())
    H0 = top - head_z
    # Profil médian: segments des faces coupées par le plan x = 0.
    segs = []
    for f in bm.faces:
        cut = []
        for e in f.edges:
            a, b = P[e.verts[0]], P[e.verts[1]]
            if (a[0] > 0) != (b[0] > 0):
                cut.append(a + (b - a) * (a[0] / (a[0] - b[0])))
        if len(cut) == 2 and min(cut[0][2], cut[1][2]) > top - 1.5 * H0:
            segs.append(cut)

    def avant(z):
        ys = []
        for a, b in segs:
            if (a[2] - z) * (b[2] - z) <= 0 and a[2] != b[2]:
                ys.append(a[1] + (b[1] - a[1]) * (z - a[2]) / (b[2] - a[2]))
        ys = [y for y in ys if y < cy]
        return min(ys) if ys else cy

    zs = np.arange(top - 0.002, top - 1.4 * H0, -0.002)
    ys = np.array([avant(z) for z in zs])
    d = top - zs

    def arg(lo, hi, fn):
        m = (d >= lo) & (d <= hi)
        i = np.flatnonzero(m)
        return int(i[fn(ys[m])])

    # Bout du nez: le plus avancé; sur un nez à face plate (palier), le bas du palier.
    m_tip = (d >= 0.45 * H0) & (d <= 0.85 * H0)
    y_min = ys[m_tip].min()
    i_tip = int(np.flatnonzero(m_tip & (ys <= y_min + 0.002)).max())
    # Racine du nez: le point le plus en retrait sous la corde qui va du front (à 0,3 de la hauteur du
    # crâne) au bout du nez. Le front fuit vers le haut et l'arête avance: ni minimum ni maximum simples.
    i_fr = int(np.argmin(np.abs(d - 0.30 * H0)))
    seg = np.arange(i_fr, i_tip + 1)
    corde = ys[i_fr] + (ys[i_tip] - ys[i_fr]) * (seg - i_fr) / max(i_tip - i_fr, 1)
    i_nas = int(seg[np.argmax(ys[seg] - corde)])
    # Menton: sous la bouche, le premier point où le profil recule franchement vers le cou (dessous du menton).
    # La lèvre inférieure avance parfois plus que le menton: pas de « point le plus avancé ».
    seuil = cy - 0.45 * (cy - ys[i_tip])
    i_pog = arg(d[i_tip] + 0.12 * H0, 1.15 * H0, np.argmin)
    i_chin = next((i for i in range(i_tip + int(0.12 * H0 / 0.002), len(zs)) if ys[i] > seuil), len(zs) - 1)
    chin = float(zs[i_chin])
    hh = top - chin
    z_tip, z_nas = float(zs[i_tip]), float(zs[i_nas])
    z_base = z_tip - 0.035 * hh
    bouche = z_base - 0.33 * (z_base - chin)     # bible 2.4: base du nez 0,70, bouche 0,80, menton 1
    # Largeur du visage vers les yeux (moitié avant de la tête, oreilles exclues).
    y_cut = ys[i_tip] + 0.55 * (cy - ys[i_tip])
    band = hp[(np.abs(hp[:, 2] - z_nas) < 0.04) & (hp[:, 1] < cy - 0.25 * (cy - ys[i_tip]))]
    demi = float(np.abs(band[:, 0]).max())
    # Yeux: pièces séparées de Meshy (paupières) s'il y en a, sinon le creux des orbites par rapport à une
    # surface lisse ajustée sur l'avant du visage (moindres carrés), au-dessus de la racine du nez.
    isl = _ilots(bm)
    grand = max(len(c) for c in isl)
    pieces = [c for c in isl if len(c) < 0.08 * grand
              and sum(dom[v] in TETE for f in c for v in f.verts) > 0.5 * 3 * len(c)]
    pts_y = [np.mean([P[v] for f in c for v in f.verts], 0) for c in pieces]
    pts_y = [p for p in pts_y if p[1] < cy and abs(p[2] - z_nas) < 0.5 * hh]
    if len(pts_y) >= 2:
        yeux = float(np.mean([p[2] for p in pts_y]))
        ecart = float(np.mean([abs(p[0]) for p in pts_y]))
        source = "pièces des yeux"
    else:
        fr = hp[(hp[:, 1] < y_cut) & (np.abs(hp[:, 2] - z_nas) < 0.5 * hh)]
        xn, zn = fr[:, 0] / demi, (fr[:, 2] - z_nas) / hh
        A = np.stack([np.ones_like(xn), zn, zn ** 2, zn ** 3, xn ** 2, xn ** 2 * zn, xn ** 4], 1)
        coef, *_ = np.linalg.lstsq(A, fr[:, 1], rcond=None)
        res = fr[:, 1] - A @ coef
        zone = (fr[:, 2] > z_nas - 0.06 * hh) & (fr[:, 2] < z_nas + 0.2 * hh) & (np.abs(fr[:, 0]) > 0.07 * hh) \
            & (np.abs(fr[:, 0]) < 0.8 * demi)
        r = np.where(zone, res, -1)
        k = np.argsort(-r)[:max(4, int(zone.sum() * 0.25))]
        wk = np.maximum(r[k], 1e-4)
        yeux = float(np.average(fr[k, 2], weights=wk))
        ecart = float(np.average(np.abs(fr[k, 0]), weights=wk))
        source = "creux des orbites"
    ecart = float(np.clip(ecart, 0.13 * hh, 0.19 * hh))
    return {"top": top, "chin": chin, "hh": hh, "nasion": z_nas, "tip": z_tip, "tip_y": float(ys[i_tip]),
            "base": z_base, "yeux": yeux, "bouche": bouche, "ecart": ecart, "demi": demi, "cy": cy,
            "pog_y": float(ys[i_pog]), "source_yeux": source, "pieces_yeux": pieces}


# ---------------------------------------------------------------- 2. masque lissé, nez simple
class Visage:
    """Masque du visage et surface lisse qui le remplace (fonctions du point monde)."""

    def __init__(self, R):
        self.R = R
        hh = R["hh"]
        self.z_hi = R["yeux"] + 0.24 * hh        # mi-front: le haut du front garde la forme du crâne
        self.z_lo = R["chin"] + 0.01 * hh
        self.zc = (self.z_hi + self.z_lo) / 2
        self.az = (self.z_hi - self.z_lo) / 2
        self.ax = 0.86 * R["demi"]
        self.coef = None

    def poids(self, p):
        """1 au coeur du visage, 0 hors du masque (crâne, oreilles, mâchoire, cou)."""
        x, y, z = p[..., 0], p[..., 1], p[..., 2]
        r = np.sqrt((x / self.ax) ** 2 + ((z - self.zc) / self.az) ** 2)
        devant = _smooth(0.25, 0.55, (self.R["cy"] - y) / max(self.R["cy"] - self.R["tip_y"], 1e-3))
        return (1 - _smooth(0.72, 1.02, r)) * devant

    def _base(self, x, z):
        xn, zn = x / self.ax, (z - self.zc) / self.az
        return np.stack([np.ones_like(xn), zn, zn ** 2, zn ** 3, zn ** 4, xn ** 2, xn ** 2 * zn, xn ** 2 * zn ** 2,
                         xn ** 4, xn ** 4 * zn], -1)

    def ajuster(self, pts):
        """Surface lisse y = F(x, z) ajustée hors du nez, des lèvres et des orbites."""
        R, hh = self.R, self.R["hh"]
        x, y, z = pts[:, 0], pts[:, 1], pts[:, 2]
        w = self.poids(pts)
        nez = (np.abs(x) < 0.16 * hh) & (z < R["nasion"] + 0.02 * hh) & (z > R["base"] - 0.04 * hh)
        levres = (np.abs(x) < 0.24 * hh) & (z < R["base"]) & (z > R["bouche"] - 0.12 * hh)
        orb = ((np.abs(x) - R["ecart"]) / (0.13 * hh)) ** 2 + ((z - R["yeux"]) / (0.08 * hh)) ** 2 < 1
        keep = (w > 0.05) & ~nez & ~levres & ~orb
        A = self._base(x[keep], z[keep])
        sw = np.sqrt(w[keep] + 0.1)
        # Régularisation légère: pas d'oscillation entre les points d'appui.
        lam = 1e-4 * np.eye(A.shape[1])
        self.coef = np.linalg.solve((A * sw[:, None] ** 2).T @ A + lam, (A * sw[:, None] ** 2).T @ y[keep])
        # Saillie du nez mesurée, au-dessus de la surface lisse; le volume simple en garde un peu plus de la moitié.
        sail = float(self.F(np.array([0.0]), np.array([R["tip"]]))[0] - R["tip_y"])
        self.nez_h = float(np.clip(0.45 * sail, 0.045 * hh, 0.09 * hh))
        return int(keep.sum())

    def F(self, x, z):
        return self._base(x, z) @ self.coef

    def relief(self, x, z):
        """Nez (vers l'avant, négatif) et orbites (vers l'arrière, positif), en mètres."""
        R, hh = self.R, self.R["hh"]
        ax = np.abs(x)
        z0 = R["yeux"] + 0.02 * hh              # haut de l'arête, entre les sourcils
        zt, zb = R["tip"], R["base"]
        s = np.clip((z0 - z) / (z0 - zt), 0, 1)
        haut = np.where(z >= zt, self.nez_h * (0.12 + 0.88 * s ** 1.7), 0.0)
        s2 = np.clip((zt - z) / (zt - zb + 0.02 * hh), 0, 1)
        bas = np.where(z < zt, self.nez_h * (1 - s2 ** 2), 0.0)
        h = np.where(z > z0, 0.0, haut + bas)
        bw = np.where(z >= zt, hh * (0.05 + 0.045 * s), hh * 0.095 * (1 - 0.25 * s2))
        coupe = np.clip(1 - ax / bw, 0, 1) ** 1.25
        bout = self.nez_h * 0.2 * np.exp(-(ax ** 2 + (z - zt + 0.005 * hh) ** 2) / (0.05 * hh) ** 2)
        nez = -(h * coupe + np.where(z < z0, bout, 0.0))
        orb = 0.012 * hh * np.exp(-(((ax - R["ecart"]) / (0.11 * hh)) ** 2 + ((z - R["yeux"]) / (0.07 * hh)) ** 2))
        return nez + orb

    def Y(self, x, z):
        return self.F(x, z) + self.relief(x, z)

    def normale(self, x, z):
        e = 1e-4
        yx = (self.Y(x + e, z) - self.Y(x - e, z)) / (2 * e)
        yz = (self.Y(x, z + e) - self.Y(x, z - e)) / (2 * e)
        n = np.stack([yx, -np.ones_like(yx), yz], -1)
        return n / np.linalg.norm(n, axis=-1, keepdims=True)


def lisser_visage(bm, mw, R):
    """Subdivise le masque, puis remplace la surface du visage par la surface lisse et le nez simple."""
    inv = mw.inverted()
    if R["pieces_yeux"]:
        bmesh.ops.delete(bm, geom=list({f for c in R["pieces_yeux"] for f in c}), context="FACES")
    V = Visage(R)

    def wv(v):
        return float(V.poids(np.array(mw @ v.co)))

    for _ in range(2):
        faces = [f for f in bm.faces if max(wv(v) for v in f.verts) > 0.02]
        edges = sorted({e for f in faces for e in f.edges}, key=lambda e: e.index)
        bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, use_grid_fill=True)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
        bm.verts.index_update()
        bm.edges.index_update()
    pts = np.array([tuple(mw @ v.co) for v in bm.verts])
    n_fit = V.ajuster(pts)
    w = V.poids(pts)
    # Les paupières et les narines de Meshy sont des replis: projetés tels quels sur la surface lisse, ils
    # se chevauchent (triangles retournés). On détend d'abord le maillage dans le plan de face (x, z).
    bm.verts.index_update()
    voisins = [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]
    actifs = np.flatnonzero(w > 0.01)
    for _ in range(60):
        moy = np.array([pts[voisins[i]].mean(0) if voisins[i] else pts[i] for i in actifs])
        k = (0.6 * w[actifs])[:, None]
        pts[actifs, 0::2] += k * (moy[:, 0::2] - pts[actifs, 0::2])
    w = V.poids(pts)
    cible = V.Y(pts[:, 0], pts[:, 2])
    for v, p, wi, yt in zip(bm.verts, pts, w, cible):
        if wi > 0:
            q = p.copy()
            q[1] = p[1] + wi * (yt - p[1])
            v.co = inv @ Vector(q)
    return V, n_fit


def poser_attribut_et_normales(me, V, lissage=14):
    """Après la réduction: attribut `_VISAGE` et normales imposées sur toute la tête.

    Dans le masque: normales de la surface lisse (analytiques). Sur le reste de la tête (crâne, joues, mâchoire):
    normales lissées de proche en proche (`lissage` passes), sinon la rampe à deux tons découpe chaque bosse du
    maillage réduit en tache. La silhouette garde ses plans francs: seule la lumière est adoucie.
    """
    mesh = me.data
    mw = me.matrix_world
    pts = np.array([tuple(mw @ v.co) for v in mesh.vertices])
    w = V.poids(pts)
    att = mesh.attributes.get("_VISAGE") or mesh.attributes.new("_VISAGE", "FLOAT", "POINT")
    att.data.foreach_set("value", w.astype(np.float32))
    na = V.normale(pts[:, 0], pts[:, 2])
    to_local = mw.to_3x3().transposed()
    na_l = np.array([tuple((to_local @ Vector(n)).normalized()) for n in na])
    vn = np.array([tuple(v.normal) for v in mesh.vertices])
    names = [g.name for g in me.vertex_groups]
    wt = np.array([min(1.0, sum(g.weight for g in v.groups if names[g.group] in TETE)) for v in mesh.vertices])
    voisins = [[] for _ in mesh.vertices]
    for e in mesh.edges:
        i, j = e.vertices
        voisins[i].append(j)
        voisins[j].append(i)
    # Départ: normales analytiques au coeur du visage (là seulement: le polynôme ne vaut plus rien au bord du
    # masque), normales du maillage ailleurs; puis diffusion sur toute la tête, le coeur du visage restant fixe.
    coeur = _smooth(0.55, 0.95, w)[:, None]
    ns = vn * (1 - coeur) + na_l * coeur
    ns /= np.linalg.norm(ns, axis=1, keepdims=True)
    fixe = coeur[:, 0] > 0.98
    libre = (wt > 0) & ~fixe
    for _ in range(lissage):
        moy = np.array([ns[i] + ns[voisins[i]].sum(0) for i in range(len(ns))])
        moy /= np.maximum(np.linalg.norm(moy, axis=1, keepdims=True), 1e-9)
        ns = np.where(libre[:, None], moy, ns)
    k = np.maximum(0.85 * _smooth(0.2, 0.8, wt), coeur[:, 0])[:, None]
    n = vn * (1 - k) + ns * k
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
    mesh.normals_split_custom_set_from_vertices([Vector(x) for x in n])
    return w


# ---------------------------------------------------------------- 4. mitaines
def _anneau(c, t, f, n, hw, ht, k, e=0.6):
    pts = []
    for i in range(k):
        a = math.radians(360 / k * i + 180 / k)
        ca, sa = math.cos(a), math.sin(a)
        pts.append(c + f * (hw * math.copysign(abs(ca) ** e, ca)) + n * (ht * math.copysign(abs(sa) ** e, sa)))
    return pts


def _tube(bm, rings, couture_k, lay_seam, cap_pt=None):
    """Relie des anneaux successifs (quads), ferme le dernier par un éventail; couture le long d'un côté."""
    verts = [[bm.verts.new(p) for p in r] for r in rings]
    k = len(rings[0])
    faces = []
    for a, b in zip(verts, verts[1:]):
        for i in range(k):
            j = (i + 1) % k
            faces.append(bm.faces.new((a[i], a[j], b[j], b[i])))
    if cap_pt is not None:
        c = bm.verts.new(cap_pt)
        last = verts[-1]
        for i in range(k):
            faces.append(bm.faces.new((last[i], last[(i + 1) % k], c)))
        verts.append([c])
    bm.edges.ensure_lookup_table()
    for a, b in zip(verts, verts[1:]):
        if len(b) == 1:
            e = bm.edges.get((a[couture_k], b[0]))
        else:
            e = bm.edges.get((a[couture_k], b[couture_k]))
        if e:
            e[lay_seam] = 1
    return [v for r in verts for v in r], faces


def mitaines(bm, mw, deform, names, arm_bones, fiche_mains, hauteur):
    """Remplace chaque main par une moufle. Rend le nombre de triangles et les longueurs posées."""
    inv = mw.inverted()
    gi = {n: i for i, n in enumerate(names)}
    lay_m = bm.verts.layers.int.get("mitaine") or bm.verts.layers.int.new("mitaine")
    lay_s = bm.edges.layers.int.get("couture") or bm.edges.layers.int.new("couture")
    dom = _dom(bm, deform, names)
    L = float(fiche_mains.get("longueur", 0.105 * hauteur))
    larg = float(fiche_mains.get("largeur", 0.47))
    ep = float(fiche_mains.get("epaisseur", 0.24))
    jointures = fiche_mains.get("jointures", [16, 22])
    tris = 0
    for side, sx in (("Left", 1.0), ("Right", -1.0)):
        hand = [v for v in bm.verts if dom.get(v) == side + "Hand"]
        hand_set = set(hand)
        P = {v: Vector(mw @ v.co) for v in hand}
        boundary = sorted({e for v in hand for e in v.link_edges if e.other_vert(v) not in hand_set},
                          key=lambda e: e.index)
        ring_v = sorted({e.other_vert(v) for v in hand for e in v.link_edges if e.other_vert(v) not in hand_set},
                        key=lambda v: v.index)
        elbow, wrist = arm_bones[side + "ForeArm"], arm_bones[side + "Hand"]
        fdir = (wrist - elbow).normalized()
        far = max(hand, key=lambda v: (P[v] - wrist).length)
        a = (fdir * 0.7 + (P[far] - wrist).normalized() * 0.3).normalized()
        n = Vector((-sx, 0, 0))
        n = (n - a * n.dot(a)).normalized()           # paume vers la cuisse
        f = a.cross(n).normalized()
        if f.y > 0:
            f = -f                                     # pouce vers l'avant
        RW = [Vector(mw @ v.co) for v in ring_v]
        cw = sum(RW, Vector()) / len(RW)
        hw0 = max(abs((p - cw).dot(f)) for p in RW) * 0.92
        ht0 = max(abs((p - cw).dot(n)) for p in RW) * 0.92
        weights_ring = {}
        for v in ring_v:
            weights_ring[v] = dict(v[deform].items())
        bmesh.ops.delete(bm, geom=hand, context="VERTS")
        bm.edges.ensure_lookup_table()
        # Bout de l'avant-bras bouché (caché par la moufle).
        bord = [e for e in bm.edges if e.is_boundary and all(v in ring_v for v in e.verts)]
        if bord:
            bmesh.ops.holes_fill(bm, edges=bord, sides=0)
        # Colonne de la moufle: stations (u en fraction de L, demi-largeur, demi-épaisseur, pli après la station).
        HW, HT = larg * L / 2, ep * L / 2
        stations = [(-0.05, hw0 * 1.04, ht0 * 1.04, 0), (0.30, HW, HT, 0), (0.50, HW * 1.02, HT * 0.92, jointures[0]),
                    (0.70, HW * 0.96, HT * 0.80, jointures[1]), (0.88, HW * 0.86, HT * 0.68, 0),
                    (0.97, HW * 0.62, HT * 0.50, 0)]
        c = cw + a * (stations[0][0] * L)
        t, nn = a.copy(), n.copy()
        rings, prev_u = [], stations[0][0]
        thumb_c = None
        for u, hw, ht, pli in stations:
            c = c + t * ((u - prev_u) * L)
            prev_u = u
            if pli:
                ang = math.radians(pli) / 2
                tm = (t * math.cos(ang) + nn * math.sin(ang)).normalized()
                nm = (nn * math.cos(ang) - t * math.sin(ang)).normalized()
                rings.append(_anneau(c, tm, f, nm, hw, ht, 8))
                ang *= 2
                t, nn = (t * math.cos(ang) + nn * math.sin(ang)).normalized(), (nn * math.cos(ang) - t * math.sin(ang)).normalized()
            else:
                rings.append(_anneau(c, t, f, nn, hw, ht, 8))
            if abs(u - 0.30) < 1e-6:
                thumb_c = c + f * (HW * 0.55) + n * (HT * 0.3) - a * (0.10 * L)
        cap = c + t * (0.06 * L) + nn * (0.01 * L)
        mv, mf = _tube(bm, rings, 2, lay_s, cap_pt=cap)
        # Pouce: part du bord avant de la paume, vers l'avant et le bas, recourbé vers la paume.
        d = (a * 0.85 + f * 0.32 + n * 0.38).normalized()
        e1 = f.cross(d).normalized()
        e2 = d.cross(e1).normalized()
        r0, r1, r2 = 0.105 * L, 0.092 * L, 0.07 * L
        tr = [_anneau(thumb_c, d, e1, e2, r0, r0 * 0.85, 6, 0.8),
              _anneau(thumb_c + d * (0.22 * L), d, e1, e2, r1, r1 * 0.85, 6, 0.8),
              _anneau(thumb_c + d * (0.36 * L) + n * (0.02 * L), d, e1, e2, r2, r2 * 0.85, 6, 0.8)]
        tv, tf = _tube(bm, tr, 3, lay_s, cap_pt=thumb_c + d * (0.42 * L) + n * (0.03 * L))
        ring0 = set(mv[:8])
        for v in mv + tv:
            v.co = inv @ v.co
            v[lay_m] = 1
            dv = v[deform]
            if v in ring0:
                near = min(ring_v, key=lambda r: ((mw @ r.co) - (mw @ v.co)).length) if ring_v and ring_v[0].is_valid else None
                src = weights_ring.get(near, {}) if near else {}
                for g, wt in src.items():
                    dv[g] = wt
                if not src:
                    dv[gi[side + "Hand"]] = 1.0
            else:
                dv[gi[side + "Hand"]] = 1.0
        bmesh.ops.recalc_face_normals(bm, faces=mf + tf)
        tris += sum(len(fc.verts) - 2 for fc in mf + tf)
    return tris, L


# ---------------------------------------------------------------- 5. clip de repos animé
def respiration(frame, n_frames):
    """Décalages (degrés) du clip de repos à une image: (os, axe monde, angle). Boucle exacte sur n_frames."""
    p = 2 * math.pi * frame / n_frames
    s, s2, s3 = math.sin(p), math.sin(p + 0.9), math.sin(2 * p + 0.4)
    return [
        ("Spine02", "Y", 1.1 * s2),                # balancement du buste, d'une hanche à l'autre
        ("Spine01", "X", -1.2 * s),                # respiration: la poitrine se soulève
        ("Spine", "X", -0.9 * s),
        ("LeftShoulder", "Y", -1.3 * s),           # épaules qui montent avec l'inspiration
        ("RightShoulder", "Y", 1.3 * s),
        ("neck", "X", 1.6 * s),                    # le cou compense: le regard reste posé
        ("Head", "Y", -0.9 * s2),
        ("Head", "Z", 2.2 * s3),                   # petit coup d'oeil de côté, deux fois par boucle
        ("LeftForeArm", "X", -2.0 * s2),
        ("RightForeArm", "X", 2.0 * s2),
    ]

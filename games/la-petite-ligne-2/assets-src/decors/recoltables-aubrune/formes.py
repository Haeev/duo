"""Atelier des formes des récoltables encrés (numpy et scipy, sans Blender).

Même langage que la végétation de la scène d'essai validée (`src/rendu/demo-encre/vegetation.ts`)
et que les bâtiments d'Aubrune (`../batiments-aubrune/atelier.py`): des volumes simples, un peu
tordus, un ton en aplat par morceau. Chaque morceau est d'un seul tenant (le rendu encré compte
les morceaux par leurs sommets communs et trace un trait fin entre deux morceaux).

Repère: celui du jeu et du glTF. x vers l'est, y vers le haut, z vers le sud, en mètres; origine
au pied du modèle. Rien ne descend sous le sol (y >= 0): les dessous ne sont pas faits, la caméra
plonge de 35 à 50 degrés.

Normales: à plat par face (pierre, bois, terre), ou rayonnant du coeur d'une masse (`rond`):
l'ombre dessine alors une masse ronde et non des facettes (feuillages).
"""

from __future__ import annotations

import math
from contextlib import contextmanager

import numpy as np
from scipy.spatial import ConvexHull

# Noms de matériaux stables: le rendu en tire la couche de traits et la prise au vent
# (table `materiaux` de recoltables.toml, recopiée dans le manifeste).
MATERIAUX = (
    "feuillage", "ecorce", "bois", "pierre", "mousse", "terre", "tige", "fruit", "fleur",
    # Aménagements (haies, berges, meubles, ouvrages): mêmes noms que les bâtiments d'Aubrune.
    "gazon", "moellon", "crepi", "tuile", "bardage", "metal", "vitre", "etoffe", "flamme",
)


def hexa(couleur: str) -> tuple[float, float, float]:
    """Couleur d'écran (sRGB, 0 à 1) depuis `#RRGGBB`."""
    v = int(couleur[1:], 16)
    return ((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255


def ton(couleur, facteur: float, vers=None, part: float = 0.0):
    """Assombrit ou éclaircit une couleur, et la tire vers une autre (`part` de 0 à 1)."""
    c = np.array(couleur, dtype=float) * facteur
    if vers is not None:
        c = c * (1 - part) + np.array(vers, dtype=float) * part
    return tuple(np.clip(c, 0, 1))


def _frac(v: float) -> float:
    return v - math.floor(v)


def hasard(a: float, b: float, c: float, graine: float) -> float:
    return _frac(math.sin(a * 127.1 + b * 311.7 + c * 74.7 + graine * 53.3) * 43758.5453)


def tirage(graine: float) -> float:
    """Tirage reproductible entre 0 et 1."""
    return _frac(math.sin(graine * 78.233 + 12.9898) * 43758.5453)


def entre(a: float, b: float, graine: float) -> float:
    return a + (b - a) * tirage(graine)


def penche(graine: float, ampleur: float) -> float:
    return (tirage(graine + 0.617) - 0.5) * 2 * ampleur


def choix(liste, graine: float):
    return liste[int(tirage(graine) * len(liste)) % len(liste)]


def at(x=0.0, y=0.0, z=0.0, ry=0.0, rx=0.0, rz=0.0, echelle=1.0) -> np.ndarray:
    """Matrice: échelle, rotations d'Euler en radians (ordre YXZ, comme Three.js), position."""
    cy, sy = math.cos(ry), math.sin(ry)
    cx, sx = math.cos(rx), math.sin(rx)
    cz, sz = math.cos(rz), math.sin(rz)
    my = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    mx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    mz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    m = np.eye(4)
    e = np.array(echelle if isinstance(echelle, (tuple, list)) else (echelle,) * 3, dtype=float)
    m[:3, :3] = (my @ mx @ mz) * e
    m[:3, 3] = (x, y, z)
    return m


def _icosaedre():
    t = (1 + 5**0.5) / 2
    v = np.array(
        [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)],
        dtype=float,
    )
    v /= np.linalg.norm(v[0])
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    return v, f


ICO_V, ICO_F = _icosaedre()
OCTA_V = np.array([(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)], dtype=float)
OCTA_F = [(2, 4, 0), (2, 0, 5), (2, 5, 1), (2, 1, 4), (3, 0, 4), (3, 5, 0), (3, 1, 5), (3, 4, 1)]


class Atelier:
    """Accumule des triangles: matériau, positions, normales et couleur par coin."""

    def __init__(self, graine: float = 0.0):
        self.base = np.eye(4)
        self.graine = graine
        self.morceaux = 0
        # (matériau, positions 3x3, normales 3x3, couleurs 3x3)
        self.tris: list[tuple[str, np.ndarray, np.ndarray, np.ndarray]] = []

    @contextmanager
    def groupe(self, matrice: np.ndarray):
        precedent = self.base
        self.base = precedent @ matrice
        try:
            yield
        finally:
            self.base = precedent

    @property
    def triangles(self) -> int:
        return len(self.tris)

    def triangles_par_materiau(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for mat, *_ in self.tris:
            out[mat] = out.get(mat, 0) + 1
        return out

    def boite(self) -> tuple[np.ndarray, np.ndarray]:
        pts = np.concatenate([t[1] for t in self.tris])
        return pts.min(0), pts.max(0)

    # ------------------------------------------------------------------ morceau générique
    def morceau(
        self,
        sommets,
        faces,
        mat: str,
        couleur,
        matrice: np.ndarray | None = None,
        tremble: float = 0.0,
        rond=None,
        coeur=None,
        garde: bool = False,
        dessus=None,
        dessous=None,
        double: bool = False,
        envers=None,
        sol: bool = True,
        lisse: bool = False,
    ) -> None:
        """Un morceau d'un seul tenant. `faces`: listes d'indices (triangles ou polygones convexes).

        Les faces sont tournées vers le dehors du `coeur` (point local; à défaut le centre des
        sommets), sauf `garde` (sens donné gardé). `rond` (point local): normales rayonnant de ce
        point. `dessus`, `dessous`: couleur des faces tournées vers le haut ou le bas. `double`:
        chaque face est faite des deux côtés (feuille), l'envers en couleur `envers`. `sol`:
        ramène au sol ce qui passerait dessous. `couleur` peut être une liste: une par face.
        `lisse`: normales moyennées par sommet (terre modelée: le relief se lit par l'ombre, sans
        arête tracée entre deux pans).
        """
        assert mat in MATERIAUX, mat
        self.morceaux += 1
        graine = self.morceaux + self.graine * 0.37
        v = np.array(sommets, dtype=float)
        if tremble:
            for p in v:
                qx, qy, qz = round(p[0] * 1000), round(p[1] * 1000), round(p[2] * 1000)
                p[0] += (hasard(qx, qy, qz, graine) - 0.5) * 2 * tremble
                p[1] += (hasard(qy, qz, qx, graine + 0.5) - 0.5) * 2 * tremble
                p[2] += (hasard(qz, qx, qy, graine + 0.25) - 0.5) * 2 * tremble
        monde = self.base @ (matrice if matrice is not None else np.eye(4))
        w = v @ monde[:3, :3].T + monde[:3, 3]
        if sol:
            w[:, 1] = np.maximum(w[:, 1], 0.0)
        centre = np.array(coeur, dtype=float) if coeur is not None else v.mean(0)
        centre_monde = centre @ monde[:3, :3].T + monde[:3, 3]
        rond_monde = None if rond is None else np.array(rond, dtype=float) @ monde[:3, :3].T + monde[:3, 3]
        c0 = np.array(couleur, dtype=float)
        par_face = c0 if c0.ndim == 2 else None
        debut = len(self.tris)
        coins: list[list[int]] = []
        for fi, f in enumerate(faces):
            if par_face is not None:
                c0 = par_face[fi]
            idx = list(f)
            for k in range(1, len(idx) - 1):
                tri = [idx[0], idx[k], idx[k + 1]]
                p = w[tri]
                n = np.cross(p[1] - p[0], p[2] - p[0])
                aire = np.linalg.norm(n)
                if aire < 1e-10:
                    continue
                n = n / aire
                if not garde and np.dot(n, p.mean(0) - centre_monde) < 0:
                    p = p[[0, 2, 1]]
                    n = -n
                c = c0
                if dessus is not None and n[1] > 0.55:
                    c = np.array(dessus, dtype=float)
                elif dessous is not None and n[1] < -0.3:
                    c = np.array(dessous, dtype=float)
                if rond_monde is not None:
                    nn = p - rond_monde
                    nn = nn / (np.linalg.norm(nn, axis=1, keepdims=True) + 1e-12)
                else:
                    nn = np.repeat(n[None, :], 3, axis=0)
                self.tris.append((mat, p.copy(), nn, np.repeat(c[None, :], 3, axis=0)))
                coins.append(tri if np.array_equal(p[1], w[tri[1]]) else [tri[0], tri[2], tri[1]])
                if double:
                    ce = np.array(envers if envers is not None else c * 0.72, dtype=float)
                    self.tris.append((mat, p[[0, 2, 1]].copy(), -nn[[0, 2, 1]], np.repeat(ce[None, :], 3, axis=0)))

        if lisse and not double:
            somme = np.zeros_like(w)
            for k, tri in enumerate(coins):
                _, p, nn, _ = self.tris[debut + k]
                somme[tri] += np.cross(p[1] - p[0], p[2] - p[0])
            somme /= np.linalg.norm(somme, axis=1, keepdims=True) + 1e-12
            for k, tri in enumerate(coins):
                mat_k, p, _, c = self.tris[debut + k]
                self.tris[debut + k] = (mat_k, p, somme[tri].copy(), c)

    # ------------------------------------------------------------------ solides
    def box(self, w, h, d, matrice, mat, couleur, tremble=0.01, sans="y-", dessus=None):
        """Boîte centrée. `sans`: faces à ne pas faire, parmi x+ x- y+ y- z+ z- (le dessous par défaut)."""
        x, y, z = w / 2, h / 2, d / 2
        s = [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z), (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]
        toutes = {"x+": (1, 2, 6, 5), "x-": (0, 4, 7, 3), "y+": (3, 7, 6, 2), "y-": (0, 1, 5, 4), "z+": (4, 5, 6, 7), "z-": (0, 3, 2, 1)}
        faces = [f for nom, f in toutes.items() if nom not in sans]
        self.morceau(s, faces, mat, couleur, matrice, tremble, dessus=dessus)

    def octa(self, rx, ry, rz, matrice, mat, couleur, tremble=0.0, dessus=None):
        """Petit volume à huit faces: fruit, baie, bouton."""
        self.morceau(OCTA_V * (rx, ry, rz), OCTA_F, mat, couleur, matrice, tremble, dessus=dessus)

    def galet(self, rx, ry, rz, matrice, mat, couleur, graine, points=14, tremble=0.0, dessus=None, coupe=None, frais=None, pose=0.25):
        """Pierre à facettes irrégulières: enveloppe convexe de points tirés dans un ellipsoïde.

        `pose`: part de la hauteur enfoncée dans le sol (le dessous n'est pas fait). `coupe`
        (point, normale, en parts des rayons): la pierre est entamée par ce plan; la cassure
        prend la couleur `frais`.
        """
        pts = []
        for i in range(points):
            u = tirage(graine * 3.1 + i * 7.7)
            a = tirage(graine * 5.3 + i * 3.9) * math.tau
            y = 2 * u - 1
            r = math.sqrt(max(0.0, 1 - y * y)) * (0.78 + 0.22 * tirage(graine + i * 1.3))
            pts.append((math.cos(a) * r, y * (0.8 + 0.2 * tirage(graine * 2.1 + i)), math.sin(a) * r))
        pts = np.array(pts)
        plan = None
        if coupe is not None:
            p0, n0 = np.array(coupe[0], float), np.array(coupe[1], float)
            n0 /= np.linalg.norm(n0)
            d = (pts - p0) @ n0
            pts = pts - np.outer(np.maximum(d, 0), n0)
            plan = (p0, n0)
        pts[:, 1] = np.maximum(pts[:, 1], -1 + 2 * pose)
        hull = ConvexHull(pts)
        bas = -1 + 2 * pose
        faces, cassure = [], []
        for simplex in hull.simplices:
            tri = pts[simplex]
            if np.all(tri[:, 1] <= bas + 1e-6):
                continue
            if plan is not None and np.all(np.abs((tri - plan[0]) @ plan[1]) < 1e-6):
                cassure.append(tuple(simplex))
            else:
                faces.append(tuple(simplex))
        decale = np.array((0, -bas, 0))
        echelle = np.array((rx, ry, rz))
        v = (pts + decale) * echelle
        coeur = np.array((0, 1 - pose, 0)) * echelle
        n_avant = len(self.tris)
        self.morceau(v, faces, mat, couleur, matrice, tremble, coeur=coeur, dessus=dessus)
        if cassure:
            # Même morceau (sommets communs): la cassure n'est qu'une autre teinte.
            self.morceaux -= 1
            self.morceau(v, cassure, mat, frais if frais is not None else couleur, matrice, tremble, coeur=coeur)
        return len(self.tris) - n_avant

    def tube(self, points, pans, mat, couleur, matrice=None, tremble=0.0, bouts=(False, False), dessus=None, tors=0.0, rond=False, coupe=None):
        """Fût à pans qui suit une ligne brisée: `points` = (x, y, z, rayon). Un seul morceau.

        `bouts`: ferme le début et la fin (`coupe`: leur couleur, bois frais d'une bûche). `tors`: décalage angulaire par tronçon (un tronc noueux
        ne monte pas droit). `rond`: normales lissées autour de l'axe (tiges fines).
        """
        pts = np.array([p[:3] for p in points], dtype=float)
        rayons = [p[3] for p in points]
        n = len(pts)
        anneaux = []
        for i in range(n):
            if i == 0:
                t = pts[1] - pts[0]
            elif i == n - 1:
                t = pts[-1] - pts[-2]
            else:
                t = (pts[i + 1] - pts[i]) / (np.linalg.norm(pts[i + 1] - pts[i]) + 1e-9) + (pts[i] - pts[i - 1]) / (np.linalg.norm(pts[i] - pts[i - 1]) + 1e-9)
            t = t / (np.linalg.norm(t) + 1e-9)
            ref = np.array((1.0, 0, 0)) if abs(t[0]) < 0.9 else np.array((0, 0, 1.0))
            a = np.cross(t, ref)
            a /= np.linalg.norm(a)
            b = np.cross(t, a)
            anneau = []
            for k in range(pans):
                ang = math.tau * k / pans + tors * i
                anneau.append(pts[i] + (math.cos(ang) * a + math.sin(ang) * b) * rayons[i])
            anneaux.append(anneau)
        sommets = [p for anneau in anneaux for p in anneau]
        faces = []
        for i in range(n - 1):
            for k in range(pans):
                j = (k + 1) % pans
                faces.append((i * pans + k, i * pans + j, (i + 1) * pans + j, (i + 1) * pans + k))
        if bouts[0]:
            faces.append(tuple(range(pans)))
        if bouts[1]:
            faces.append(tuple(range((n - 1) * pans, n * pans)))
        # Sens des faces: lu depuis l'axe, tronçon par tronçon (le fût n'est pas convexe).
        v = np.array(sommets)
        orientees = []
        cotes = (n - 1) * pans
        for fi, f in enumerate(faces):
            loc = v[list(f)]
            nrm = np.cross(loc[1] - loc[0], loc[2] - loc[0])
            if fi < cotes:
                i = fi // pans
                axe = (pts[i] + pts[i + 1]) / 2
                vers = loc.mean(0) - axe
            elif f[0] == 0:
                vers = pts[0] - pts[1]
            else:
                vers = pts[-1] - pts[-2]
            orientees.append(tuple(f) if np.dot(nrm, vers) >= 0 else tuple(reversed(f)))
        if not rond:
            teintes = couleur
            if coupe is not None:
                teintes = [couleur] * cotes + [coupe] * (len(orientees) - cotes)
            self.morceau(v, orientees, mat, teintes, matrice, tremble, garde=True, dessus=dessus)
            return
        # Normales lissées: chaque sommet regarde loin de l'axe.
        assert tremble == 0.0
        self.morceaux += 1
        monde = self.base @ (matrice if matrice is not None else np.eye(4))
        w = v @ monde[:3, :3].T + monde[:3, 3]
        w[:, 1] = np.maximum(w[:, 1], 0.0)
        axes = pts @ monde[:3, :3].T + monde[:3, 3]
        c = np.array(couleur, dtype=float)
        for f in orientees:
            idx = list(f)
            for k in range(1, len(idx) - 1):
                tri = [idx[0], idx[k], idx[k + 1]]
                p = w[tri]
                if np.linalg.norm(np.cross(p[1] - p[0], p[2] - p[0])) < 1e-10:
                    continue
                nn = np.array([w[q] - axes[min(q // pans, n - 1)] for q in tri])
                nn = nn / (np.linalg.norm(nn, axis=1, keepdims=True) + 1e-12)
                self.tris.append((mat, p.copy(), nn, np.repeat(c[None, :], 3, axis=0)))

    # ------------------------------------------------------------------ feuillage
    def calotte(self, x, y, z, r, graine, couleur, mat="feuillage", segments=9, dome=0.72, dents=0.34, laches=2, rangs=3):
        """Une touffe: calotte bombée à rangs cabossés, bord découpé en dents de feuilles inégales,
        quelques feuilles détachées. Port de `cap` de la scène d'essai. Normales rayonnant du coeur."""
        n = segments
        profil = [(0.5, 0.86), (0.88, 0.42), (1.0, -0.04)] if rangs == 3 else [(0.62, 0.74), (1.0, -0.04)]
        v: list[tuple[float, float, float]] = []
        anneaux = []
        for ri, (pr, py) in enumerate(profil):
            anneau = []
            for i in range(n):
                ang = (i + ri * 0.5) / n * math.tau
                k = 0.86 + tirage(graine * 7.1 + ri * 31 + i * 3.7) * 0.3
                anneau.append(len(v))
                v.append((math.cos(ang) * pr * k, py * dome + (tirage(graine + ri * 17 + i * 5.3) - 0.5) * 0.12, math.sin(ang) * pr * k))
            anneaux.append(anneau)
        sommet = len(v)
        v.append(((tirage(graine) - 0.5) * 0.2, dome, (tirage(graine + 1) - 0.5) * 0.2))
        faces = []
        for i in range(n):
            faces.append((sommet, anneaux[0][(i + 1) % n], anneaux[0][i]))
        for ri in range(len(anneaux) - 1):
            haut, bas = anneaux[ri], anneaux[ri + 1]
            for i in range(n):
                faces.append((haut[i], bas[i], bas[(i - 1) % n]))
                faces.append((haut[i], haut[(i + 1) % n], bas[i]))
        bord = anneaux[-1]
        for i in range(n):
            a, b = np.array(v[bord[i]]), np.array(v[bord[(i + 1) % n]])
            if tirage(graine * 4.7 + i * 3.3) < 0.22:
                continue
            longue = 1.8 if tirage(graine * 3.3 + i * 9.1) > 0.68 else 1.0
            portee = 1 + dents * longue * (0.6 + tirage(graine * 5.7 + i * 2.3) * 0.7)
            mi = a + (b - a) * (0.3 + tirage(graine + i * 4.1) * 0.4)
            pointe = (mi[0] * portee, mi[1] - dents * (0.18 + tirage(graine + i) * 0.34), mi[2] * portee)
            v.append(pointe)
            faces.append((bord[i], len(v) - 1, bord[(i + 1) % n]))
        m = at(x, y, z, tirage(graine * 13.1) * 6.3, penche(graine, 0.12), penche(graine + 3, 0.12))
        ecrase = 0.8 + tirage(graine * 9.7) * 0.3
        m[:3, :3] = m[:3, :3] * np.array((r, r * ecrase, r * (0.9 + tirage(graine) * 0.2)))
        self.morceau(v, faces, mat, couleur, m, coeur=(0, 0.1, 0), rond=(0, 0.12, 0), sol=True)
        # Feuilles détachées: de petits losanges qui flottent devant le bord, visibles des deux côtés.
        for k in range(laches):
            ang = tirage(graine * 11.3 + k * 4.9) * math.tau
            portee = 1.2 + tirage(graine + k * 8.3) * 0.3
            c = np.array((math.cos(ang) * portee, -0.1 + tirage(graine * 1.7 + k) * 0.5, math.sin(ang) * portee))
            t = 0.1 + tirage(graine + k * 2.1) * 0.07
            le = np.array((-math.sin(ang), 0.5, math.cos(ang)))
            le /= np.linalg.norm(le)
            tr = np.array((math.cos(ang), 0.3, math.sin(ang)))
            tr /= np.linalg.norm(tr)
            q = [c + le * t * 1.5, c + tr * t * 0.62, c - le * t * 1.5, c - tr * t * 0.62]
            self.morceau(q, [(0, 1, 3), (1, 2, 3)], mat, couleur, m, garde=True, double=True, envers=couleur, rond=(0, 0.12, 0), sol=True)

    def touffe(self, x, y, z, r, graine, tons, festons=3, segments=9, dome=0.72, dents=0.34, laches=1, fond=0.78, rangs=3, pans_festons=None):
        """Une masse de feuillage: une grande calotte au ton sourd et, posées sur son pourtour et
        son sommet, de plus petites, plus claires, qui la découpent en festons. Chacune est un
        morceau: l'ombre et le trait fin dessinent des paquets de feuilles, pas une boule."""
        base = tons[0]
        sourd = (base[0] * (fond - 0.04), base[1] * (fond + 0.02), base[2] * fond)
        self.calotte(x, y, z, r, graine, sourd, segments=segments, dome=dome, dents=dents, laches=laches, rangs=rangs)
        for k in range(festons):
            haut = k == festons - 1 and festons > 3
            ang = (k / (1 if haut else festons - (1 if festons > 3 else 0))) * math.tau + tirage(graine * 3.9 + k) * 0.9
            portee = 0.25 if haut else 0.62 + tirage(graine * 6.1 + k * 2.7) * 0.2
            taille = r * (0.6 if haut else 0.46 + tirage(graine * 4.3 + k * 1.9) * 0.16)
            self.calotte(
                x + math.cos(ang) * portee * r,
                y + r * (0.42 if haut else 0.02 + tirage(graine * 8.7 + k * 3.1) * 0.26),
                z + math.sin(ang) * portee * r,
                taille,
                graine * 17 + k * 5 + 1,
                tons[(k + 1) % len(tons)],
                segments=pans_festons or max(5, segments - 3),
                dome=dome,
                dents=dents * 0.8,
                laches=k % 2 if laches else 0,
                rangs=2,
            )

    # ------------------------------------------------------------------ feuilles et brins
    def feuille(self, pied, direction, longueur, largeur, mat, couleur, envers=None, cambre=0.25, pli=0.0):
        """Feuille en losange à deux pans, pliée le long de sa nervure, visible des deux côtés.
        `direction`: vecteur du pied vers la pointe (la feuille se cambre vers le bas de `cambre`)."""
        p0 = np.array(pied, dtype=float)
        d = np.array(direction, dtype=float)
        d /= np.linalg.norm(d) + 1e-12
        cote = np.cross(d, (0, 1, 0))
        if np.linalg.norm(cote) < 1e-6:
            cote = np.array((1.0, 0, 0))
        cote /= np.linalg.norm(cote)
        haut = np.cross(cote, d)
        mi = p0 + d * longueur * 0.5 + haut * longueur * cambre * 0.5
        pointe = p0 + d * longueur - haut * longueur * cambre * 0.3
        g = mi + cote * largeur / 2 - haut * pli
        dr = mi - cote * largeur / 2 - haut * pli
        # Le coeur est sous la feuille: le dessus reçoit `couleur`, l'envers `envers`.
        self.morceau([p0, g, pointe, dr, mi], [(0, 4, 1), (1, 4, 2), (2, 4, 3), (3, 4, 0)], mat, couleur, coeur=mi - haut - np.array((0, 0.5, 0)), double=True, envers=envers)

    def brin(self, pied, pointe, largeur, mat, couleur, envers=None):
        """Brin d'herbe ou feuille étroite: un triangle effilé, visible des deux côtés."""
        p0, p1 = np.array(pied, float), np.array(pointe, float)
        d = p1 - p0
        cote = np.cross(d, (0, 1, 0))
        if np.linalg.norm(cote) < 1e-6:
            cote = np.array((1.0, 0, 0))
        cote = cote / np.linalg.norm(cote) * largeur / 2
        self.morceau([p0 - cote, p0 + cote, p1], [(0, 1, 2)], mat, couleur, garde=True, double=True, envers=envers if envers is not None else couleur)

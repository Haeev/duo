"""Atelier des formes des bâtiments encrés (sans Blender: numpy seul).

Même principe que `Sculpt` de la scène d'essai (`src/rendu/demo-encre/formes.ts`): des solides
simples, un peu tordus (le style veut des pièces trapues et de travers), un ton en aplat par
morceau, des faces à plat. Chaque morceau est d'un seul tenant: le rendu encré compte les
morceaux par leurs sommets communs et trace un trait fin entre deux morceaux.

Repère: celui du jeu et du glTF. x vers l'est, y vers le haut, z vers le sud, en mètres.
Un mur se décrit dans son propre repère: x le long du mur vers la droite vu de dehors, y en
haut, +z vers le dehors.

UV: mètres divisés par 4 (un carreau de la texture de traits fait 4 m), projetés sur la face,
u le long du fil (`grain`) quand il est donné.
"""

from __future__ import annotations

import math
from contextlib import contextmanager

import numpy as np

# Noms de matériaux stables: le rendu encré en tire la couche de traits (voir README).
MATERIAUX = ("pierre", "moellon", "crepi", "tuile", "bois", "bardage", "volet", "vitre", "metal")

CARREAU = 4.0


def hexa(couleur: str) -> tuple[float, float, float]:
    """Couleur d'écran (sRGB, 0 à 1) depuis `#RRGGBB`."""
    v = int(couleur[1:], 16)
    return ((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255


def _frac(v: float) -> float:
    return v - math.floor(v)


def hasard(a: float, b: float, c: float, graine: float) -> float:
    return _frac(math.sin(a * 127.1 + b * 311.7 + c * 74.7 + graine * 53.3) * 43758.5453)


def tirage(graine: float) -> float:
    """Tirage reproductible entre 0 et 1."""
    return _frac(math.sin(graine * 91.7 + 13.1) * 43758.5453)


def penche(graine: float, ampleur: float) -> float:
    """Petit écart reproductible entre -ampleur et +ampleur (pièce un peu de guingois)."""
    return (tirage(graine) - 0.5) * 2 * ampleur


def choix(liste, graine: float):
    return liste[int(tirage(graine) * len(liste)) % len(liste)]


def at(x: float, y: float, z: float, ry: float = 0, rx: float = 0, rz: float = 0) -> np.ndarray:
    """Matrice rigide: position, puis rotations d'Euler en radians, ordre YXZ (comme Three.js)."""
    cy, sy = math.cos(ry), math.sin(ry)
    cx, sx = math.cos(rx), math.sin(rx)
    cz, sz = math.cos(rz), math.sin(rz)
    my = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    mx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    mz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    m = np.eye(4)
    m[:3, :3] = my @ mx @ mz
    m[:3, 3] = (x, y, z)
    return m


IDENTITE = np.eye(4)


def _normale(pts: np.ndarray) -> np.ndarray:
    """Normale de Newell d'un polygone (non normalisée)."""
    n = np.zeros(3)
    k = len(pts)
    for i in range(k):
        a, b = pts[i], pts[(i + 1) % k]
        n[0] += (a[1] - b[1]) * (a[2] + b[2])
        n[1] += (a[2] - b[2]) * (a[0] + b[0])
        n[2] += (a[0] - b[0]) * (a[1] + b[1])
    return n


class Atelier:
    """Accumule des faces (polygones convexes) avec matériau, couleur et UV."""

    def __init__(self, graine: float = 0.0):
        self.base = np.eye(4)
        self.faces: list[tuple[str, tuple[float, float, float], np.ndarray, np.ndarray, int]] = []
        self.morceaux = 0
        self.graine = graine

    # ------------------------------------------------------------------ repères
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
        return sum(len(f[2]) - 2 for f in self.faces)

    def triangles_par_materiau(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for mat, _c, pts, _uv, _m in self.faces:
            out[mat] = out.get(mat, 0) + len(pts) - 2
        return out

    def boite(self) -> tuple[np.ndarray, np.ndarray]:
        pts = np.concatenate([f[2] for f in self.faces])
        return pts.min(0), pts.max(0)

    # ------------------------------------------------------------------ morceau générique
    def maillage(
        self,
        sommets,
        faces,
        matrice: np.ndarray,
        mat: str,
        couleur,
        grain: str | None = None,
        tremble: float = 0.012,
        convexe: bool = True,
        dessus=None,
        dehors=None,
    ) -> None:
        """Un morceau d'un seul tenant. `faces`: listes d'indices. `convexe`: les faces sont
        tournées vers le dehors du morceau; sinon `dehors` (vecteur local) donne le sens."""
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
        monde = self.base @ matrice
        w = v @ monde[:3, :3].T + monde[:3, 3]
        centre = v.mean(0)
        du, dv = hasard(graine, 1, 2, 3), hasard(graine, 4, 5, 6)
        for f in faces:
            idx = list(f)
            loc = v[idx]
            n = _normale(loc)
            if np.dot(n, n) < 1e-16:
                continue
            if convexe:
                if np.dot(n, loc.mean(0) - centre) < 0:
                    idx.reverse()
                    loc = v[idx]
                    n = -n
            elif dehors is not None and np.dot(n, dehors) < 0:
                idx.reverse()
                loc = v[idx]
                n = -n
            an = np.abs(n)
            dominant = 1 if an[1] >= an[0] and an[1] >= an[2] else (0 if an[0] >= an[2] else 2)
            plan = [a for a in (0, 1, 2) if a != dominant]
            ua, va = plan[0], plan[1]
            if grain is not None and "xyz".index(grain) == va:
                ua, va = va, ua
            uv = np.stack([loc[:, ua] / CARREAU + du, loc[:, va] / CARREAU + dv], axis=1)
            pts = w[idx]
            c = couleur
            if dessus is not None:
                nm = _normale(pts)
                if nm[1] / (np.linalg.norm(nm) + 1e-12) > 0.9:
                    c = dessus
            self.faces.append((mat, tuple(c), pts, uv, self.morceaux))

    # ------------------------------------------------------------------ solides
    def box(self, w, h, d, matrice, mat, couleur, grain=None, tremble=0.012, sans="", dessus=None):
        """Boîte centrée. `sans`: faces à ne pas faire, parmi x+ x- y+ y- z+ z- (faces cachées)."""
        x, y, z = w / 2, h / 2, d / 2
        s = [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z), (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]
        toutes = {
            "x+": (1, 2, 6, 5),
            "x-": (0, 4, 7, 3),
            "y+": (3, 7, 6, 2),
            "y-": (0, 1, 5, 4),
            "z+": (4, 5, 6, 7),
            "z-": (0, 3, 2, 1),
        }
        faces = [f for nom, f in toutes.items() if nom not in sans]
        self.maillage(s, faces, matrice, mat, couleur, grain, tremble, dessus=dessus)

    def prisme(self, points, epaisseur, matrice, mat, couleur, grain=None, tremble=0.012, sans="", flancs=None):
        """Polygone convexe du plan xy, épais de `epaisseur` le long de z, centré.
        `sans`: z+ ou z- pour ôter un bout; `flancs`: indices des côtés à garder (tous par défaut)."""
        k = len(points)
        z = epaisseur / 2
        s = [(px, py, -z) for px, py in points] + [(px, py, z) for px, py in points]
        faces = []
        if "z-" not in sans:
            faces.append(tuple(range(k)))
        if "z+" not in sans:
            faces.append(tuple(range(k, 2 * k)))
        for i in range(k):
            if flancs is not None and i not in flancs:
                continue
            j = (i + 1) % k
            faces.append((i, j, k + j, k + i))
        self.maillage(s, faces, matrice, mat, couleur, grain, tremble)

    def cyl(self, haut, bas, h, pans, matrice, mat, couleur, grain="y", tremble=0.01, arc=None, bouts=True):
        """Fût à pans d'axe y, centré; `haut` et `bas` sont les rayons. `arc` (début, fin en
        radians, 0 = +x, sens de x vers z) ne fait qu'une partie du tour (tuile faîtière, gouttière)."""
        a0, a1 = arc if arc is not None else (0.0, 2 * math.pi)
        n = pans + (1 if arc is not None else 0)
        angles = [a0 + (a1 - a0) * i / pans for i in range(n)]
        s = [(math.cos(a) * bas, -h / 2, math.sin(a) * bas) for a in angles]
        s += [(math.cos(a) * haut, h / 2, math.sin(a) * haut) for a in angles]
        faces = []
        cotes = pans if arc is None else pans
        for i in range(cotes):
            j = (i + 1) % n
            faces.append((i, j, n + j, n + i))
        if bouts:
            faces.append(tuple(range(n)))
            faces.append(tuple(range(n, 2 * n)))
        # Un arc n'est pas un volume fermé: le sens des faces se lit depuis l'axe.
        if arc is None:
            self.maillage(s, faces, matrice, mat, couleur, grain, tremble)
        else:
            self._arc(s, faces, n, matrice, mat, couleur, grain, tremble)

    def _arc(self, s, faces, n, matrice, mat, couleur, grain, tremble):
        v = np.array(s, dtype=float)
        orientees = []
        for f in faces:
            loc = v[list(f)]
            nrm = _normale(loc)
            c = loc.mean(0)
            if len(f) == 4 and abs(nrm[1]) < abs(nrm[0]) + abs(nrm[2]):
                vers = np.array([c[0], 0, c[2]])
            else:
                vers = np.array([0, c[1], 0])
            orientees.append(tuple(f) if np.dot(nrm, vers) >= 0 else tuple(reversed(f)))
        self.maillage(v, orientees, matrice, mat, couleur, grain, tremble, convexe=False)

    def face(self, points, matrice, mat, couleur, dehors, grain=None):
        """Un polygone plan seul (peau d'un mur), tourné vers `dehors` (vecteur local)."""
        self.maillage(points, [tuple(range(len(points)))], matrice, mat, couleur, grain, 0.0, convexe=False, dehors=np.array(dehors, float))

    def peau(self, polygones, matrice, mat, couleur, grain=None):
        """Plusieurs polygones plans d'un même morceau (un mur percé et ses tableaux).
        `polygones`: liste de (points, dehors): chaque face est tournée vers son vecteur `dehors`."""
        sommets, faces = [], []
        for poly, dehors in polygones:
            idx = list(range(len(sommets), len(sommets) + len(poly)))
            nrm = _normale(np.array(poly, dtype=float))
            if np.dot(nrm, np.array(dehors, float)) < 0:
                idx.reverse()
            faces.append(tuple(idx))
            sommets.extend(poly)
        if faces:
            self.maillage(sommets, faces, matrice, mat, couleur, grain, 0.0, convexe=False)

"""Contrôle des volumes d'un modèle livré (numpy seul): ce que le client voit en tournant autour.

Le client regarde chaque modèle dans une visionneuse, de tous les côtés et de près. Trois défauts
s'y voient et se cherchent ici dans le GLB lui-même (pas dans les sources):

- **trou**: d'un point de vue au-dessus de l'horizon (de côté jusqu'à l'aplomb), le premier
  triangle touché est vu de dos. Le rendu ne dessine pas l'envers des faces: on voit à travers
  (face manquante, plaque à simple face vue de derrière, intérieur d'un volume ouvert). Les
  dessous ne sont pas cherchés: aucune vue ne passe sous le sol.
- **flotte**: une pièce (un morceau d'un seul tenant, sommets communs) qui n'est reliée au sol
  (ou au mur pour un objet mural, `appui = "mur"`) par aucune chaîne de pièces distantes de moins
  d'un centimètre.
- **traverse**: une arête d'une pièce entre dans une autre et en ressort, en dépassant de 3 cm au
  moins de chaque côté (un piquet qui passe à travers une planche, un tuyau à travers un toit).
  Une pièce enfoncée dans ce qui la porte (pied sous un plateau, fruit dans une touffe) n'en est
  pas une.

Appel: `controler(positions, triangles, appui_mur)` rend une liste de défauts (texte).
"""

from __future__ import annotations

import json
import struct

import numpy as np

TOL = 0.01
DEPASSE = 0.03
# Points de vue: hauteur au-dessus de l'horizon (degrés) et cap. De côté, de biais, de haut.
HAUTEURS = (8.0, 30.0, 55.0, 90.0)
CAPS = 8
PIXELS = 72
# Aire vue de dos au-delà de laquelle un trou se voit (m²): 2 cm de côté.
AIRE_TROU = 0.02 * 0.02


# ---------------------------------------------------------------------- lecture du GLB
def lire_glb(chemin):
    with open(chemin, "rb") as f:
        data = f.read()
    n, _ = struct.unpack_from("<II", data, 12)
    gltf = json.loads(data[20:20 + n])
    debut = 20 + n
    m, _ = struct.unpack_from("<II", data, debut)
    return gltf, data[debut + 8:debut + 8 + m]


def _accesseur(gltf, binaire, i):
    acc = gltf["accessors"][i]
    vue = gltf["bufferViews"][acc["bufferView"]]
    composantes = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
    dtype = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}[acc["componentType"]]
    debut = vue.get("byteOffset", 0) + acc.get("byteOffset", 0)
    taille = np.dtype(dtype).itemsize * composantes
    pas = vue.get("byteStride", taille)
    brut = np.frombuffer(binaire, dtype=np.uint8, count=pas * (acc["count"] - 1) + taille, offset=debut)
    lignes = np.lib.stride_tricks.as_strided(brut, shape=(acc["count"], taille), strides=(pas, 1))
    return np.ascontiguousarray(lignes).view(dtype).reshape(acc["count"], composantes)


def maillage(gltf, binaire, noeud) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Positions, triangles (indices) et matériau de chaque triangle, toutes primitives à la suite,
    parties mobiles comprises (enfants du nœud, au repos: posées à leur translation)."""
    positions, triangles, matieres, base = [], [], [], 0
    prims = [(p, np.zeros(3)) for p in gltf["meshes"][noeud["mesh"]]["primitives"]]
    for i in noeud.get("children", []):
        enfant = gltf["nodes"][i]
        if "mesh" in enfant:
            tr = np.array(enfant.get("translation", [0.0, 0.0, 0.0]), dtype=np.float64)
            prims += [(p, tr) for p in gltf["meshes"][enfant["mesh"]]["primitives"]]
    for prim, tr in prims:
        p = _accesseur(gltf, binaire, prim["attributes"]["POSITION"]).astype(np.float64) + tr
        t = _accesseur(gltf, binaire, prim["indices"]).reshape(-1, 3).astype(np.int64)
        positions.append(p)
        triangles.append(t + base)
        nom = gltf["materials"][prim["material"]]["name"] if "material" in prim else "?"
        matieres += [nom] * len(t)
        base += len(p)
    return np.concatenate(positions), np.concatenate(triangles), matieres


# ---------------------------------------------------------------------- pièces
def pieces(V: np.ndarray, T: np.ndarray) -> np.ndarray:
    """Numéro de pièce de chaque triangle: morceaux reliés par des sommets à la même place."""
    _, lieu = np.unique(np.round(V, 4), axis=0, return_inverse=True)
    lieu = lieu.reshape(-1)
    t = lieu[T]
    etiquette = np.arange(lieu.max() + 1)
    while True:
        m = etiquette[t].min(axis=1)
        avant = etiquette.copy()
        for k in range(3):
            np.minimum.at(etiquette, t[:, k], m)
        etiquette = etiquette[etiquette]
        if np.array_equal(avant, etiquette):
            break
    _, num = np.unique(etiquette[t[:, 0]], return_inverse=True)
    return num.reshape(-1)


# ---------------------------------------------------------------------- géométrie vectorisée
def _point_triangle(P, A, B, C):
    """Distance de chaque point P[i] au triangle (A[i], B[i], C[i]) (Ericson, 5.1.5)."""
    ab, ac, ap = B - A, C - A, P - A
    d1, d2 = (ab * ap).sum(1), (ac * ap).sum(1)
    bp = P - B
    d3, d4 = (ab * bp).sum(1), (ac * bp).sum(1)
    cp = P - C
    d5, d6 = (ab * cp).sum(1), (ac * cp).sum(1)
    va = d3 * d6 - d5 * d4
    vb = d5 * d2 - d1 * d6
    vc = d1 * d4 - d3 * d2
    den = va + vb + vc
    den = np.where(np.abs(den) < 1e-18, 1e-18, den)
    v = vb / den
    w = vc / den
    Q = A + ab * v[:, None] + ac * w[:, None]
    # Régions des sommets et des arêtes.
    with np.errstate(divide="ignore", invalid="ignore"):
        cas = [
            ((d1 <= 0) & (d2 <= 0), A),
            ((d3 >= 0) & (d4 <= d3), B),
            ((d6 >= 0) & (d5 <= d6), C),
            ((vc <= 0) & (d1 >= 0) & (d3 <= 0), A + ab * np.nan_to_num(d1 / (d1 - d3))[:, None]),
            ((vb <= 0) & (d2 >= 0) & (d6 <= 0), A + ac * np.nan_to_num(d2 / (d2 - d6))[:, None]),
            ((va <= 0) & ((d4 - d3) >= 0) & ((d5 - d6) >= 0), B + (C - B) * np.nan_to_num((d4 - d3) / ((d4 - d3) + (d5 - d6)))[:, None]),
        ]
    fait = np.zeros(len(P), bool)
    for masque, R in cas:
        m = masque & ~fait
        Q[m] = R[m]
        fait |= m
    return np.linalg.norm(P - Q, axis=1)


def _segment_segment(P1, Q1, P2, Q2):
    """Distance entre segments [P1, Q1] et [P2, Q2], ligne à ligne (Ericson, 5.1.9)."""
    d1, d2, r = Q1 - P1, Q2 - P2, P1 - P2
    a, e, f = (d1 * d1).sum(1), (d2 * d2).sum(1), (d2 * r).sum(1)
    c, b = (d1 * r).sum(1), (d1 * d2).sum(1)
    den = a * e - b * b
    with np.errstate(divide="ignore", invalid="ignore"):
        s = np.where(den > 1e-14, np.clip((b * f - c * e) / den, 0, 1), 0.0)
        t = (b * s + f) / np.where(e > 1e-14, e, 1.0)
        t_bas, t_haut = t < 0, t > 1
        s = np.where(t_bas, np.clip(-c / np.where(a > 1e-14, a, 1.0), 0, 1), s)
        s = np.where(t_haut, np.clip((b - c) / np.where(a > 1e-14, a, 1.0), 0, 1), s)
        t = np.clip(t, 0, 1)
    return np.linalg.norm((P1 + d1 * s[:, None]) - (P2 + d2 * t[:, None]), axis=1)


def _coupe(P, Q, A, B, C):
    """Paramètre t (0 à 1) où le segment [P, Q] coupe le triangle (A, B, C), NaN sinon."""
    d = Q - P
    e1, e2 = B - A, C - A
    h = np.cross(d, e2)
    a = (e1 * h).sum(1)
    ok = np.abs(a) > 1e-14
    f = np.where(ok, 1.0 / np.where(ok, a, 1.0), 0.0)
    s = P - A
    u = f * (s * h).sum(1)
    q = np.cross(s, e1)
    v = f * (d * q).sum(1)
    t = f * (e2 * q).sum(1)
    bon = ok & (u >= 0) & (u <= 1) & (v >= 0) & (u + v <= 1) & (t >= 0) & (t <= 1)
    return np.where(bon, t, np.nan)


def _paires(na, nb, taille=60000):
    """Indices de toutes les paires (i < na, j < nb), par paquets."""
    pas = max(1, taille // max(nb, 1))
    for i0 in range(0, na, pas):
        ii = np.arange(i0, min(na, i0 + pas))
        yield np.repeat(ii, nb), np.tile(np.arange(nb), len(ii))


def _dans(boites, bas, haut, marge):
    return np.all(boites[:, 1] >= bas - marge, axis=1) & np.all(boites[:, 0] <= haut + marge, axis=1)


def _proches(TA, TB, tol) -> bool:
    """Les deux lots de triangles (n, 3, 3) passent-ils à moins de `tol` l'un de l'autre ?"""
    for X, Y in ((TA, TB), (TB, TA)):
        P = np.unique(X.reshape(-1, 3), axis=0)
        for i, j in _paires(len(P), len(Y)):
            if (_point_triangle(P[i], Y[j, 0], Y[j, 1], Y[j, 2]) <= tol).any():
                return True
    EA = np.concatenate([TA[:, [0, 1]], TA[:, [1, 2]], TA[:, [2, 0]]])
    EB = np.concatenate([TB[:, [0, 1]], TB[:, [1, 2]], TB[:, [2, 0]]])
    for i, j in _paires(len(EA), len(EB)):
        if (_segment_segment(EA[i, 0], EA[i, 1], EB[j, 0], EB[j, 1]) <= tol).any():
            return True
    for E, Y in ((EA, TB), (EB, TA)):
        for i, j in _paires(len(E), len(Y)):
            if np.isfinite(_coupe(E[i, 0], E[i, 1], Y[j, 0], Y[j, 1], Y[j, 2])).any():
                return True
    return False


def _boucles(TA, TB):
    """Boucles de la courbe où les surfaces de A et B se coupent (points de chaque boucle).

    Un point de la courbe: une arête de l'une qui perce un triangle de l'autre. Deux points se
    suivent sur la courbe s'ils sont sur une même face de A et une même face de B (les faces
    voisines d'une arête se trouvent par la place de ses bouts). Un objet posé, enfoncé ou
    inséré coupe l'autre en UNE boucle; un objet qui le traverse de part en part, en deux."""
    points, faces, aretes = [], [], []
    for X, Y, cote in ((TA, TB, 0), (TB, TA, 1)):
        E = np.concatenate([X[:, [0, 1]], X[:, [1, 2]], X[:, [2, 0]]])
        proprio = np.tile(np.arange(len(X)), 3)
        index: dict[tuple, int] = {}
        arete = np.array([index.setdefault(tuple(sorted((tuple(a), tuple(b)))), len(index)) for a, b in np.round(E, 4).tolist()])
        voisines: dict[int, set[int]] = {}
        for a, f in zip(arete.tolist(), proprio.tolist()):
            voisines.setdefault(a, set()).add(f)
        for i, j in _paires(len(E), len(Y)):
            tt = _coupe(E[i, 0], E[i, 1], Y[j, 0], Y[j, 1], Y[j, 2])
            for k in np.nonzero(np.isfinite(tt))[0]:
                e = int(i[k])
                points.append(E[e, 0] + (E[e, 1] - E[e, 0]) * tt[k])
                aretes.append((cote, int(arete[e])))
                fx, fy = voisines[int(arete[e])], {int(j[k])}
                faces.append((fx, fy) if cote == 0 else (fy, fx))
    if not points:
        return [], False
    parent = list(range(len(points)))

    def racine(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    seau: dict[tuple[int, int], int] = {}
    for n, (fa, fb) in enumerate(faces):
        for a in fa:
            for b in fb:
                if (a, b) in seau:
                    parent[racine(n)] = racine(seau[(a, b)])
                else:
                    seau[(a, b)] = n
    groupes: dict[int, list] = {}
    for n, p in enumerate(points):
        groupes.setdefault(racine(n), []).append(p)
    # Percée: une même arête coupe l'autre pièce dans deux boucles (elle entre et ressort), et
    # le bout d'arête entre les deux est à 5 mm au moins de la surface de l'autre (pas un frôlement
    # de deux planches jointives que le tremblé fait se chevaucher). Une anse, une écharpe,
    # accrochées par leurs deux bouts, font deux boucles sans percée.
    par_arete: dict[tuple, list] = {}
    for n, a in enumerate(aretes):
        par_arete.setdefault(a, []).append(n)
    perce = False
    for a, ns in par_arete.items():
        if len({racine(n) for n in ns}) < 2:
            continue
        ns = sorted(ns, key=lambda n: tuple(points[n]))
        Y = TB if a[0] == 0 else TA
        for n1, n2 in zip(ns, ns[1:]):
            if racine(n1) == racine(n2):
                continue
            m = (points[n1] + points[n2]) / 2
            mm = np.repeat(m[None, :], len(Y), 0)
            if _point_triangle(mm, Y[:, 0], Y[:, 1], Y[:, 2]).min() < 0.005:
                continue
            # Le bout d'arête entre les deux coupes est-il DANS l'autre pièce (parité d'un rayon)?
            # Sinon l'arête passe d'une pièce à une autre par le vide (traverse de porte entre
            # deux montants d'un même cadre).
            loin = mm + np.array((0.31, 0.89, 0.33)) * 100.0
            if np.isfinite(_coupe(mm, loin, Y[:, 0], Y[:, 1], Y[:, 2])).sum() % 2 == 1:
                perce = True
                break

        if perce:
            break
    return [np.array(g) for g in groupes.values()], perce


def _bouchons(X):
    """Triangles qui ferment les bords libres d'une pièce (fond ouvert d'une boîte posée, haut
    d'un pied): pour dire qu'un plateau sans dessous repose bien sur ses pieds."""
    E = np.concatenate([X[:, [0, 1]], X[:, [1, 2]], X[:, [2, 0]]])
    cles = [tuple(sorted((tuple(a), tuple(b)))) for a, b in np.round(E, 4).tolist()]
    compte: dict[tuple, int] = {}
    for c in cles:
        compte[c] = compte.get(c, 0) + 1
    suivant: dict[tuple, list] = {}
    for (a, b), n in compte.items():
        if n == 1:
            suivant.setdefault(a, []).append(b)
            suivant.setdefault(b, []).append(a)
    out = []
    vus = set()
    for depart in list(suivant):
        if depart in vus or len(suivant[depart]) != 2:
            continue
        boucle, prec, p = [depart], None, depart
        vus.add(depart)
        while True:
            options = [q for q in suivant.get(p, []) if q != prec]
            if not options:
                break
            q = options[0]
            if q == depart or q in vus or len(suivant.get(q, [])) != 2:
                break
            boucle.append(q)
            vus.add(q)
            prec, p = p, q
        if len(boucle) >= 3:
            pts = np.array(boucle)
            c = pts.mean(0)
            for i in range(len(pts)):
                out.append(np.array([c, pts[i], pts[(i + 1) % len(pts)]]))
    return np.array(out).reshape(-1, 3, 3)


# ---------------------------------------------------------------------- trous vus de dos
def _vues():
    out = []
    for h in HAUTEURS:
        caps = 1 if h >= 89 else CAPS
        for k in range(caps):
            a, e = k / caps * 2 * np.pi + 0.2, np.radians(h)
            vers_camera = np.array((np.sin(a) * np.cos(e), np.sin(e), np.cos(a) * np.cos(e)))
            out.append((h, round(np.degrees(a)), -vers_camera))
    return out


def trous(V, T, bouts=None, mur=False, caches=None):
    """Pour chaque point de vue: aire vue de dos (m²) et point moyen (repère du modèle).

    Un point vu de dos à moins de 2 cm du sol est un raccord au sol (le sol le cache); `bouts`
    (0: x, 2: z): les deux bouts d'un module de file sont ouverts, son voisin les ferme."""
    lo_m, hi_m = V.min(0), V.max(0)
    A, B, C = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    N = np.cross(B - A, C - A)
    garde = np.linalg.norm(N, axis=1) > 1e-12
    numero = np.nonzero(garde)[0]
    A, B, C, N = A[garde], B[garde], C[garde], N[garde]
    neutre = np.zeros(len(A), bool)
    if caches is not None and len(caches):
        # Bouchons d'un module de file (son voisin le ferme): ils cachent sans être un trou.
        A, B, C = np.concatenate([A, caches[:, 0]]), np.concatenate([B, caches[:, 1]]), np.concatenate([C, caches[:, 2]])
        N = np.concatenate([N, np.cross(caches[:, 1] - caches[:, 0], caches[:, 2] - caches[:, 0])])
        numero = np.concatenate([numero, np.zeros(len(caches), np.int64)])
        neutre = np.concatenate([neutre, np.ones(len(caches), bool)])
    out = []
    for hauteur, cap, d in _vues():
        u = np.cross(d, (0.0, 1.0, 0.0) if abs(d[1]) < 0.99 else (1.0, 0.0, 0.0))
        u /= np.linalg.norm(u)
        v = np.cross(u, d)
        P = np.stack([np.stack([X @ u, X @ v, X @ d], 1) for X in (A, B, C)], 1)
        lo, hi = P[:, :, :2].min((0, 1)), P[:, :, :2].max((0, 1))
        pas = max(float((hi - lo).max()) / PIXELS, 0.004)
        nu, nv = int((hi[0] - lo[0]) / pas) + 1, int((hi[1] - lo[1]) / pas) + 1
        gu, gv = np.meshgrid(lo[0] + (np.arange(nu) + 0.5) * pas, lo[1] + (np.arange(nv) + 0.5) * pas, indexing="ij")
        px, py = gu.ravel(), gv.ravel()
        prof = np.full(len(px), np.inf)
        dos = np.zeros(len(px), bool)
        qui = np.zeros(len(px), np.int64)
        envers = ((N @ d) > 0) & ~neutre
        x0, y0 = P[:, 0, 0], P[:, 0, 1]
        e1, e2 = P[:, 1, :2] - P[:, 0, :2], P[:, 2, :2] - P[:, 0, :2]
        det = e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0]
        utile = np.abs(det) > 1e-14
        for t0 in range(0, len(P), 192):
            sel = np.arange(t0, min(len(P), t0 + 192))
            sel = sel[utile[sel]]
            if len(sel) == 0:
                continue
            dx = px[None, :] - x0[sel, None]
            dy = py[None, :] - y0[sel, None]
            inv = 1.0 / det[sel, None]
            b1 = (dx * e2[sel, 1, None] - dy * e2[sel, 0, None]) * inv
            b2 = (e1[sel, 0, None] * dy - e1[sel, 1, None] * dx) * inv
            dedans = (b1 >= -1e-9) & (b2 >= -1e-9) & (b1 + b2 <= 1 + 1e-9)
            z = P[sel, 0, 2, None] * (1 - b1 - b2) + P[sel, 1, 2, None] * b1 + P[sel, 2, 2, None] * b2
            # Face double (feuille, brin): l'endroit et l'envers sont à la même place, l'endroit gagne.
            z = np.where(dedans, z + envers[sel, None] * 2e-4, np.inf)
            k = z.argmin(0)
            zmin = z[k, np.arange(len(px))]
            mieux = zmin < prof - 1e-7
            prof = np.where(mieux, zmin, prof)
            dos = np.where(mieux, envers[sel][k], dos)
            qui = np.where(mieux, numero[sel][k], qui)
        pts = px[dos, None] * u + py[dos, None] * v + prof[dos, None] * d
        garde = pts[:, 1] >= 0.02
        if bouts is not None:
            garde &= (pts[:, bouts] > lo_m[bouts] + 0.03) & (pts[:, bouts] < hi_m[bouts] - 0.03)
        if mur:
            # Objet mural: ce qui touche le mur (z le plus bas) est caché par lui.
            garde &= pts[:, 2] > lo_m[2] + 0.03
        pts = pts[garde]
        aire = len(pts) * pas * pas
        if aire >= AIRE_TROU and len(pts) >= 2:
            out.append((hauteur, cap, aire, pts.mean(0), np.bincount(qui[dos][garde]).argmax()))
    return out


# ---------------------------------------------------------------------- contrôle d'un modèle
def controler(V: np.ndarray, T: np.ndarray, matieres=None, appui_mur: bool = False, sol: float = TOL, bouts=None) -> list[str]:
    """Défauts d'un modèle. `appui_mur`: objet pendu au mur (le plan z le plus bas le porte);
    `sol`: hauteur sous laquelle une pièce est posée (une culture pose sur le billon d'une autre
    pièce); `bouts`: axe d'un module de file, ouvert à ses deux bouts."""
    defauts = []
    matieres = matieres or ["?"] * len(T)
    num = pieces(V, T)
    n = int(num.max()) + 1
    tris = V[T]
    lots = [np.nonzero(num == k)[0] for k in range(n)]
    # Chaque pièce et ses bouchons (bords libres refermés), pour juger de l'appui.
    pleines = [np.concatenate([tris[l], _bouchons(tris[l])]) for l in lots]
    boites = np.array([[p.reshape(-1, 3).min(0), p.reshape(-1, 3).max(0)] for p in pleines])
    zmin = V[:, 2].min()
    porte = [bool(boites[k, 0, 1] <= sol or (appui_mur and boites[k, 0, 2] <= zmin + TOL)) for k in range(n)]
    voisins: list[set[int]] = [set() for _ in range(n)]
    traverse = []
    for a in range(n):
        for b in range(a + 1, n):
            if not (np.all(boites[a, 1] >= boites[b, 0] - TOL) and np.all(boites[b, 1] >= boites[a, 0] - TOL)):
                continue
            pa, pb = pleines[a], pleines[b]
            pa = pa[_dans(np.stack([pa.min(1), pa.max(1)], 1), boites[b, 0], boites[b, 1], TOL)]
            pb = pb[_dans(np.stack([pb.min(1), pb.max(1)], 1), boites[a, 0], boites[a, 1], TOL)]
            if len(pa) == 0 or len(pb) == 0:
                continue
            if _proches(pa, pb, TOL):
                voisins[a].add(b)
                voisins[b].add(a)
                ta = lots[a][_dans(np.stack([tris[lots[a]].min(1), tris[lots[a]].max(1)], 1), boites[b, 0], boites[b, 1], TOL)]
                tb = lots[b][_dans(np.stack([tris[lots[b]].min(1), tris[lots[b]].max(1)], 1), boites[a, 0], boites[a, 1], TOL)]
                if len(ta) == 0 or len(tb) == 0:
                    continue
                boucles, perce = _boucles(tris[ta], tris[tb])

                if len(boucles) >= 2 and perce:

                    centres = sorted((g.mean(0) for g in boucles), key=lambda c: c[1])
                    ecart = float(np.linalg.norm(centres[-1] - centres[0]))
                    if ecart >= DEPASSE:
                        traverse.append((a, b, (centres[0] + centres[-1]) / 2))
    # Pièces reliées au sol (ou au mur) de proche en proche.
    vu = set(k for k in range(n) if porte[k])
    pile = list(vu)
    while pile:
        k = pile.pop()
        for j in voisins[k] - vu:
            vu.add(j)
            pile.append(j)
    def quoi(k):
        return matieres[int(lots[k][0])]

    def ou(c):
        return f"({c[0]:.2f}; {c[1]:.2f}; {c[2]:.2f})"

    for k in range(n):
        if k not in vu:
            defauts.append(f"flotte: {quoi(k)} ({len(lots[k])} triangles) en {ou((boites[k, 0] + boites[k, 1]) / 2)}")
    for a, b, p in traverse:
        defauts.append(f"traverse: {quoi(a)} et {quoi(b)} en {ou(p)}")
    # Un trou se voit sous plusieurs angles: un seul message par endroit (le plus grand).
    vus = []
    caches = None
    if bouts is not None:
        caches = np.concatenate([_bouchons(tris[l]) for l in lots]) if lots else None
    for hauteur, cap, aire, p, tri in sorted(trous(V, T, bouts, appui_mur, caches), key=lambda x: -x[2]):


        if all(np.linalg.norm(p - q) > 0.15 for q in vus):
            vus.append(p)
            defauts.append(f"trou: {matieres[tri]} vu de dos sur {aire * 1e4:.0f} cm² (vue à {hauteur:.0f} degrés, cap {cap}) en {ou(p)}")
    return defauts

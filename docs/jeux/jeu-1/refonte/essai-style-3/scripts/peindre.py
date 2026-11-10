"""Peinture encrée des tenues, de la peau, des cheveux et de l'atlas des traits (bible 0.2, 2.4 à 2.8).

Usage:
  duo-python peindre.py atlas <personnage.toml> <sortie.png>     atlas 512 px d'un personnage (tenue + peau + cheveux)
  duo-python peindre.py traits <sortie.png>                      atlas commun des expressions (4 cellules de 128 px)

Principe: chaque texel connaît sa position et sa normale de repos sur le corps (données du conformateur).
Un vêtement est une fiche (gabarit TOML) décrite en repères du corps (taille, poignets, chevilles...), donc
la même fiche habille tous les corps. Trois tons et l'encre: base, ombre peinte (occlusion cuite),
clair sur le dessus (ce que voit la caméra haute), noirs pleins dans les creux, traits épais irréguliers.
L'atlas se calcule à 1 024 px puis se réduit à 512 (traits lissés).
"""
import json
import math
import pathlib
import sys
import tomllib

import numpy as np
from PIL import Image
from scipy import ndimage

ICI = pathlib.Path(__file__).resolve().parent
ESSAI = ICI.parent
R = 1024  # résolution de calcul (sortie: 512)
NUANCIER = json.loads((ESSAI / "gabarits" / "nuancier-v02.json").read_text())
COUL = {}
for famille, items in NUANCIER.items():
    if isinstance(items, list):
        for nom, hexa in items:
            COUL.setdefault(nom, hexa)
            COUL[f"{famille}.{nom}"] = hexa
ENCRE = np.array([0x23, 0x1A, 0x17], dtype=np.float32) / 255


def rgb(nom):
    h = COUL[nom] if not nom.startswith("#") else nom
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32) / 255


def ombre(c):
    """Ton d'ombre: plus sombre et tiré vers un violet chaud (pas de gris sale)."""
    return np.clip(c * np.array([0.62, 0.56, 0.66]) + np.array([0.03, 0.0, 0.04]), 0, 1)


def clair(c):
    return np.clip(c + (1 - c) * 0.28, 0, 1)


def bruit(p, f=9.0):
    """Bruit lisse en 3D (somme de sinus), pour l'irrégularité des traits."""
    x, y, z = p[..., 0] * f, p[..., 1] * f, p[..., 2] * f
    return (np.sin(x * 1.7 + z * 2.3) * np.sin(y * 2.9 - z * 1.1 + 1.3) + np.sin(z * 3.7 + x * 0.7)) * 0.25 + 0.5


# ---------------------------------------------------------------- rastérisation des données du corps
def rasteriser(corners, nattr, nint=2):
    """Rend, pour chaque texel couvert, les attributs interpolés (barycentriques) et le coin dominant."""
    out = np.zeros((R, R, nattr), dtype=np.float32)
    mask = np.zeros((R, R), dtype=bool)
    tri = corners.reshape(-1, 3, corners.shape[1])
    for t in tri:
        uv = t[:, :2] * R
        uv[:, 1] = R - uv[:, 1]  # v vers le haut (Blender) -> rangées de l'image
        x0, y0 = np.floor(uv.min(0)).astype(int)
        x1, y1 = np.ceil(uv.max(0)).astype(int)
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, R - 1), min(y1, R - 1)
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        a, b, c = uv
        den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(den) < 1e-12:
            continue
        w0 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / den
        w1 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / den
        w2 = 1 - w0 - w1
        ins = (w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02)
        if not ins.any():
            continue
        vals = (w0[..., None] * t[0, 2:2 + nattr] + w1[..., None] * t[1, 2:2 + nattr] + w2[..., None] * t[2, 2:2 + nattr])
        # Attributs entiers (région, os): ceux du coin le plus proche.
        k = np.argmax(np.stack([w0, w1, w2]), axis=0)
        sl = (slice(y0, y1 + 1), slice(x0, x1 + 1))
        o = out[sl]
        m = ins
        o[m] = vals[m]
        if nint:
            o[m, nattr - nint:] = t[k[m], 2 + nattr - nint:2 + nattr]
        mask[sl] |= m
    return out, mask


def etendre(img, mask):
    """Remplit les texels hors îlots par le plus proche (marges: pas de liseré au filtrage)."""
    _, (iy, ix) = ndimage.distance_transform_edt(~mask, return_indices=True)
    return img[iy, ix]


# ---------------------------------------------------------------- repères du corps
class Corps:
    def __init__(self, npz_path):
        d = np.load(npz_path)
        self.bones = {str(n): np.array(h) for n, h in zip(d["bone_names"], d["bone_heads"])}
        self.tails = {str(n): np.array(t) for n, t in zip(d["bone_names"], d["bone_tails"])}
        self.vg = [str(n) for n in d["vgroups"]]
        f = d["face"]
        self.face = dict(top=f[0], chin=f[1], hh=f[2], yeux=f[3], bouche=f[4], nez=f[5:8], cy=f[8], cell=f[9], cz=f[10])
        att, mask = rasteriser(d["corners"], 8)
        self.mask = mask
        self.P = att[..., 0:3]
        n = att[..., 3:6]
        self.N = n / np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-6)
        self.region = att[..., 6].round().astype(int)
        self.bone = np.array(self.vg)[att[..., 7].round().astype(int).clip(0, len(self.vg) - 1)]
        ao = Image.open(str(npz_path).replace(".npz", "-ao.png")).convert("L").resize((R, R), Image.BILINEAR)
        # Occlusion lissée (le bruit du rendu Cycles ferait des bords « en fourrure » aux noirs pleins).
        self.ao = ndimage.gaussian_filter(np.asarray(ao, dtype=np.float32) / 255, 2.5)
        self._membres()

    def _membres(self):
        """Paramètres de membre: t le long du bras (0 épaule, 1 poignet) et de la jambe (0 hanche, 1 cheville)."""
        P, b = self.P, self.bones
        self.ta = np.full(P.shape[:2], -1.0, dtype=np.float32)
        self.tl = np.full(P.shape[:2], -1.0, dtype=np.float32)
        self.ang = np.zeros(P.shape[:2], dtype=np.float32)  # angle autour du membre
        self.cote = np.sign(P[..., 0])
        for side, sx in (("Left", 1), ("Right", -1)):
            arm = np.isin(self.bone, [side + "Arm", side + "ForeArm", side + "Hand"])
            s, e, w = b[side + "Arm"], b[side + "ForeArm"], b[side + "Hand"]
            self.ta[arm] = self._polyline(P[arm], [s, e, w])
            ax = w - s
            self._angles(arm, s, ax, np.array([0, 0, -1.0]))
            leg = np.isin(self.bone, [side + "UpLeg", side + "Leg", side + "Foot", side + "ToeBase"])
            s, k, a = b[side + "UpLeg"], b[side + "Leg"], b[side + "Foot"]
            self.tl[leg] = self._polyline(P[leg], [s, k, a])
            self._angles(leg, s, a - s, np.array([-sx, 0, 0.0]))
        self.len_bras = np.linalg.norm(b["LeftForeArm"] - b["LeftArm"]) + np.linalg.norm(b["LeftHand"] - b["LeftForeArm"])
        self.len_jambe = np.linalg.norm(b["LeftLeg"] - b["LeftUpLeg"]) + np.linalg.norm(b["LeftFoot"] - b["LeftLeg"])

    @staticmethod
    def _polyline(p, pts):
        lens = [np.linalg.norm(pts[i + 1] - pts[i]) for i in range(len(pts) - 1)]
        total = sum(lens)
        best = np.full(len(p), 1e9)
        tt = np.zeros(len(p))
        acc = 0.0
        for i, L in enumerate(lens):
            a, d = pts[i], (pts[i + 1] - pts[i]) / L
            s = ((p - a) @ d)
            last = i == len(lens) - 1
            sc = np.clip(s, -1e9 if i == 0 else 0, 1e9 if last else L)
            dist = np.linalg.norm(p - (a + sc[:, None] * d), axis=1)
            better = dist < best
            best[better] = dist[better]
            tt[better] = (acc + sc[better]) / total
            acc += L
        return tt

    def _angles(self, m, a, ax, ref):
        """Angle autour du membre, 0 du côté `ref` (dessous du bras, intérieur de la jambe)."""
        ax = ax / np.linalg.norm(ax)
        r0 = ref - ax * (ref @ ax)
        r0 /= np.linalg.norm(r0)
        r1 = np.cross(ax, r0)
        v = self.P[m] - a
        v = v - np.outer(v @ ax, ax)
        self.ang[m] = np.arctan2(v @ r1, v @ r0)


# ---------------------------------------------------------------- vêtements
def couche_haut(c, h):
    """Masque, distance au bord (m, positive dedans) et coordonnées de motif d'un haut."""
    P, b = c.P, c.bones
    z = P[..., 2]
    torse = (c.ta < 0) & (c.tl < 0)
    z_ourlet = b["Hips"][2] - h.get("ourlet", 0.02)
    z_cou = b["neck"][2] + h.get("col_haut", 0.0)
    x = np.abs(P[..., 0])
    devant = P[..., 1] < c.bones["Spine01"][1]
    # Encolure: ronde, ou en V devant (profondeur en m), ou montante (col roulé, chemise).
    # Encolure: un anneau autour de l'axe du cou (le dessus des épaules reste couvert), plus bas devant
    # pour un V (profondeur en m).
    prof = h.get("encolure_v", 0.0)
    neck = c.bones["neck"]
    r = np.hypot(P[..., 0] - neck[0], P[..., 1] - neck[1])
    r_col = 0.068 - h.get("col_haut", 0.0) * 0.6
    z_v = z_cou - 0.02 - np.where(devant, np.maximum(prof - 1.4 * x, 0), 0.0)
    enc = np.maximum(r - r_col, z_v - z)
    d_torse = np.minimum(np.minimum(z - z_ourlet, enc), z_cou + 0.03 - z)
    d_bras = (h.get("manches", 1.0) - c.ta) * c.len_bras
    d = np.where(torse, d_torse, np.where(c.ta >= 0, np.minimum(d_bras, 0.5), -1))
    d = np.where(c.tl >= 0, -1, d)
    return d


def couche_bas(c, h):
    P, b = c.P, c.bones
    z = P[..., 2]
    z_taille = b["Hips"][2] + h.get("taille", 0.07)
    torse = (c.ta < 0) & (c.tl < 0)
    d_torse = z_taille - z
    d_jambe = (h.get("longueur", 1.0) - c.tl) * c.len_jambe
    d = np.where(torse, d_torse, np.where(c.tl >= 0, np.minimum(d_jambe, z_taille - z), -1))
    return d


def couche_chaussures(c, h):
    z = c.P[..., 2]
    pied = np.isin(c.bone, ["LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase"])
    z_tige = c.bones["LeftFoot"][2] + h.get("tige", 0.03)
    d = np.where(c.tl >= 0, z_tige - z, -1)
    return np.where(pied, np.maximum(d, 0.02), d)


def couche_chaussettes(c, h):
    z = c.P[..., 2]
    return np.where(c.tl >= 0, c.bones["LeftFoot"][2] + h.get("hauteur", 0.16) - z, -1)


def motif(c, kind, cols, d, zone):
    """Couleur de base d'un vêtement selon son motif, en coordonnées du corps (continues entre îlots)."""
    P = c.P
    base = np.broadcast_to(rgb(cols[0]), P.shape).copy()
    u = np.where(c.ta >= 0, c.ang * 0.05, np.where(c.tl >= 0, c.ang * 0.08, P[..., 0]))
    v = np.where(c.ta >= 0, c.ta * c.len_bras, np.where(c.tl >= 0, c.tl * c.len_jambe, P[..., 2]))
    if kind == "carreaux":
        # Tartan simple: bandes sombres croisées (40 %), croisement plus sombre, filet clair continu.
        s = 0.085
        a = (np.mod(u / s, 1) < 0.42)
        bnd = (np.mod(v / s, 1) < 0.42)
        fin = (np.abs(np.mod(u / s, 1) - 0.71) < 0.045) | (np.abs(np.mod(v / s, 1) - 0.71) < 0.045)
        c2, c3 = rgb(cols[1]), rgb(cols[2]) if len(cols) > 2 else clair(rgb(cols[0]))
        base[a ^ bnd] = (base[a ^ bnd] * 0.4 + c2 * 0.6)
        base[a & bnd] = c2 * 0.72
        base[fin] = base[fin] * 0.35 + c3 * 0.65
    elif kind == "rayures":
        s = 0.045
        band = np.mod(P[..., 2] / s, 1) < 0.42
        base[band] = rgb(cols[1])
    elif kind == "cotes":  # tricot: côtes verticales en ton d'ombre légère, deux bandes sur la poitrine
        rib = np.mod(u / 0.022, 1) < 0.28
        base[rib] = base[rib] * 0.86
        z = P[..., 2]
        z0 = c.bones["Spine"][2] - 0.02
        for k in (0, 1):
            m = (np.abs(z - (z0 - k * 0.055)) < 0.016) & (c.ta < 0) & (c.tl < 0)
            base[m] = rgb(cols[1])
        if len(cols) > 2:
            m = (np.abs(z - (z0 - 0.0275)) < 0.008) & (np.mod(u / 0.04 + (z - z0) * 0, 1) < 0.5) & (c.ta < 0) & (c.tl < 0)
            base[m] = rgb(cols[2])
    elif kind == "jean":
        tw = np.mod((u * 0.8 + v) / 0.012, 1) < 0.35
        base[tw] = base[tw] * 0.9
        clairs = (c.tl > 0.35) & (c.tl < 0.62) & (c.ang > -0.6) & (c.ang < 2.4) & (P[..., 1] < 0.0)
        base[clairs] = clair(base[clairs] * 0.95)
    return base


def peindre_atlas(fiche_path, sortie):
    fiche = tomllib.load(open(fiche_path, "rb"))
    racine = pathlib.Path(fiche_path).resolve().parent.parent
    c = Corps(ESSAI / fiche["corps"]["donnees"] if not pathlib.Path(fiche["corps"]["donnees"]).is_absolute() else fiche["corps"]["donnees"])
    tenue = tomllib.load(open(racine / "tenues" / (fiche["tenue"] + ".toml"), "rb"))
    # Coloris: une donnée du personnage (bible 2.7), jamais une nouvelle fiche de tenue.
    for piece, couleurs in fiche.get("coloris", {}).items():
        tenue[piece]["couleurs"] = couleurs
    P, N, z = c.P, c.N, c.P[..., 2]
    peau = rgb(fiche["peau"])
    img = np.broadcast_to(peau, P.shape).copy()
    shade_col = np.broadcast_to(ombre(peau), P.shape).copy()
    ink = np.zeros(P.shape[:2], dtype=np.float32)        # encre (0 à 1)
    noise = bruit(P, 11.0)
    largeur = 0.0085 * (0.6 + 0.9 * noise)              # trait épais irrégulier: 0,5 à 1,3 cm

    def trait(dist, w=None):
        w = largeur if w is None else w
        return np.clip(1.5 - np.abs(dist) / w * 1.5, 0, 1)

    # --- peau: mains (doigts en traits), visage (nez), cou
    main = np.isin(c.bone, ["LeftHand", "RightHand"])
    doigts = main & (c.ta > 1.08) & (np.abs(np.mod((c.ang + 0.4) / 0.55, 1) - 0.5) < 0.09) & (np.abs(c.ang) < 1.3)
    ink = np.maximum(ink, doigts * 0.9)
    f = c.face
    nx, ny, nz = f["nez"]
    tete = c.region == 0
    devant = P[..., 1] < f["cy"]
    # Nez: un aplat d'ombre sur le côté et un trait sous le bout (bible 2.4).
    cote_nez = tete & devant & (P[..., 0] > 0.004) & (P[..., 0] < 0.02) & (z > nz - 0.004) & (z < nz + 0.035) & (P[..., 1] < ny + 0.022)
    img[cote_nez] = ombre(peau)
    sous_nez = tete & devant & (np.abs(z - (nz - 0.006)) < 0.0035) & (np.abs(P[..., 0]) < 0.011)
    ink = np.maximum(ink, sous_nez * 1.0)
    # Oreilles et mâchoire: ombre de la mâchoire sur le cou.
    cou = c.bone == "neck"
    img[cou & (z > f["chin"] - 0.03)] = ombre(peau)
    # Cuir chevelu sous la coiffure: couleur des cheveux.
    chev = rgb(fiche["cheveux"])
    racine_z = f["top"] - 0.27 * f["hh"] + np.clip((P[..., 1] - ny) * 0.9, 0, 0.12) * -1.0
    scalp = tete & (z > racine_z) & ~(devant & (z < f["yeux"] + 0.035))
    img[scalp] = chev
    shade_col[scalp] = ombre(chev)

    # --- vêtements, de dessous à dessus
    couches = []
    if "chaussettes" in tenue:
        couches.append(("chaussettes", couche_chaussettes(c, tenue["chaussettes"]), tenue["chaussettes"]))
    haut_d = couche_haut(c, tenue["haut"])
    bas_d = couche_bas(c, tenue["bas"])
    if tenue["haut"].get("rentre", False):
        couches += [("haut", haut_d, tenue["haut"]), ("bas", bas_d, tenue["bas"])]
    else:
        couches += [("bas", bas_d, tenue["bas"]), ("haut", haut_d, tenue["haut"])]
    couches.append(("chaussures", couche_chaussures(c, tenue["chaussures"]), tenue["chaussures"]))
    top_layer = np.full(P.shape[:2], "", dtype=object)
    top_d = np.full(P.shape[:2], 1.0, dtype=np.float32)
    for nom, d, h in couches:
        m = d > 0
        cols = h["couleurs"]
        base = motif(c, h.get("motif", "uni"), cols, d, nom)
        img[m] = base[m]
        shade_col[m] = ombre(base[m])
        top_layer[m] = nom
        top_d[m] = d[m]

    # --- détails des vêtements (dessinés dans leur couche visible)
    haut, bas = tenue["haut"], tenue["bas"]
    vis_h, vis_b = top_layer == "haut", top_layer == "bas"
    xs = P[..., 0]
    devant_t = P[..., 1] < c.bones["Spine01"][1] - 0.01
    if haut.get("boutons"):
        patte = vis_h & devant_t & (np.abs(xs) < 0.016) & (c.ta < 0)
        img[patte] = clair(img[patte])
        ink = np.maximum(ink, (vis_h & devant_t & (c.ta < 0)) * trait(np.abs(xs) - 0.016, 0.0035) * 0.8)
        zb = np.mod((z - c.bones["Hips"][2]) / 0.085, 1)
        bouton = patte & (np.hypot(xs, (zb - 0.5) * 0.085) < 0.0085)
        ink = np.maximum(ink, bouton * 1.0)
    if haut.get("col") == "chemise":
        zc = c.bones["neck"][2]
        col = vis_h & devant_t & (z > zc - 0.075 + 1.1 * np.abs(xs)) & (np.abs(xs) < 0.075)
        img[col] = clair(img[col])
        bord = col & ~ndimage.binary_erosion(col, iterations=4)
        ink = np.maximum(ink, bord * 1.0)
    if haut.get("poche"):
        pz = c.bones["Spine"][2] - 0.035
        px = 0.07
        poche = vis_h & devant_t & (np.abs(xs - px) < 0.035) & (z < pz + 0.03) & (z > pz - 0.045)
        bord = poche & ~ndimage.binary_erosion(poche, iterations=4)
        ink = np.maximum(ink, bord * 1.0)
        ink = np.maximum(ink, poche & (np.abs(z - (pz + 0.012)) < 0.004))
    if haut.get("bord_cotes"):
        # Bords côtelés (pull): poignets, ourlet, encolure, traits verticaux courts.
        prox = vis_h & (haut_d < 0.035)
        rib = np.mod(np.where(c.ta >= 0, c.ang * 0.05, xs) / 0.016, 1) < 0.3
        img[prox] = ombre(img[prox]) * 0.4 + img[prox] * 0.6
        ink = np.maximum(ink, (prox & rib) * 0.7)
    if bas.get("motif") == "jean" or bas.get("coutures"):
        coul = rgb(bas.get("surpiqure", "ocre"))
        jambe = vis_b & (c.tl >= 0)
        cote_ext = jambe & (np.abs(np.abs(c.ang) - math.pi) < 0.09)
        pointille = np.mod(c.tl * c.len_jambe / 0.02, 1) < 0.6
        img[cote_ext & pointille] = coul
        ink = np.maximum(ink, jambe & (np.abs(np.abs(c.ang) - math.pi) - 0.11 < 0.0) & (np.abs(np.abs(c.ang) - math.pi) > 0.08))
        zt = c.bones["Hips"][2] + bas.get("taille", 0.07)
        ceinture = vis_b & (z > zt - 0.035)
        img[ceinture] = ombre(img[ceinture]) * 0.3 + img[ceinture] * 0.7
        ink = np.maximum(ink, vis_b * trait(z - (zt - 0.035), 0.004))
        # Poches de devant: un arc de la taille vers le côté.
        arc = vis_b & devant_t & (np.abs(np.hypot(np.abs(xs) - 0.16, z - zt) - 0.085) < 0.0045) & (np.abs(xs) > 0.07)
        ink = np.maximum(ink, arc * 1.0)
    if bas.get("pli"):
        jambe = vis_b & (c.tl >= 0) & (c.tl < bas.get("longueur", 1) - 0.03)
        ink = np.maximum(ink, (jambe & (np.abs(c.ang - 1.57 * np.sign(xs) * -1) < 0.05)) * 0.9)
    if "revers" in bas:
        rev = vis_b & (bas_d < bas["revers"])
        img[rev] = clair(img[rev])
        ink = np.maximum(ink, vis_b * trait(bas_d - bas["revers"], 0.004))
    ch = tenue["chaussures"]
    vis_c = top_layer == "chaussures"
    semelle = vis_c & (z < c.bones["LeftToeBase"][2] - 0.012)
    img[semelle] = rgb(ch["couleurs"][1])
    ink = np.maximum(ink, vis_c * trait(z - (c.bones["LeftToeBase"][2] - 0.012), 0.004))
    if ch.get("lacets"):
        lac = vis_c & (P[..., 1] < c.bones["LeftFoot"][1] - 0.02) & (np.abs(c.ang) > 2.0) & (np.mod(z / 0.018, 1) < 0.35) & (z > c.bones["LeftToeBase"][2] + 0.01)
        ink = np.maximum(ink, lac * 0.9)

    # --- plis aux articulations: 3 traits effilés côté intérieur (coudes, genoux), un aplat d'ombre dessous
    for t0, tm, L, ang0 in ((0.48, c.ta, c.len_bras, 0.0), (0.5, c.tl, c.len_jambe, math.pi)):
        on = (tm >= 0) & (top_layer != "") & (top_layer != "chaussures")
        a = np.angle(np.exp(1j * (c.ang - ang0)))
        for k, off in enumerate((-0.05, 0.0, 0.055)):
            courbe = t0 + off + 0.025 * np.cos(a * 1.3)
            larg = 0.006 * np.clip(1 - np.abs(a) / (1.2 - 0.25 * k), 0, 1)
            ink = np.maximum(ink, on & (np.abs(tm - courbe) * L < larg))
        pli = on & (np.abs(tm - t0) * L < 0.03) & (np.abs(a) < 0.9)
        shade_mask = pli
        img[shade_mask] = shade_col[shade_mask]
    # Taille: deux plis à la ceinture si le haut est rentré, ou un aplat d'ombre sous l'ourlet sinon.
    zo = c.bones["Hips"][2] - haut.get("ourlet", 0.02)
    sous = (top_layer == "bas") & (z < zo) & (z > zo - 0.03) & (not haut.get("rentre", False))
    img[sous] = shade_col[sous]

    # --- ombres peintes et noirs pleins (occlusion cuite), clair sur le dessus, hachures
    ao = c.ao
    aoj = ao + (noise - 0.5) * 0.12   # bord d'ombre irrégulier, comme tracé au pinceau
    ombre_m = (aoj < 0.80) & ~tete | (aoj < 0.62) & tete
    img[ombre_m] = shade_col[ombre_m]
    noir = (ao + (noise - 0.5) * 0.05 < 0.55) & ~tete
    ink = np.maximum(ink, noir * 1.0)
    dessus = (N[..., 2] > 0.55) & (ao > 0.85) & ~tete
    img[dessus] = clair(img[dessus])
    # Hachures: traits parallèles à 45 degrés (même sens partout), effilés, à la lisière des noirs.
    hach = (aoj < 0.74) & (aoj >= 0.55) & ~tete
    diag = np.mod((P[..., 2] + P[..., 0] * np.sign(P[..., 0] + 1e-6) + P[..., 1] * 0.5) / 0.024, 1)
    long_ok = bruit(P, 23.0) > 0.35
    ink = np.maximum(ink, hach & long_ok & (diag < 0.38 * np.clip((0.76 - aoj) / 0.2, 0, 1)))

    # --- bords des couches (ourlets, encolures, manches): trait épais irrégulier
    for nom, d, h in couches:
        bord = (top_layer == nom) & (d < largeur)
        ink = np.maximum(ink, bord * 1.0)

    # --- cheveux (cellule A droite)
    coif = fiche.get("coiffure")
    if coif:
        cheveux = peindre_cheveux(c, fiche, coif)
        cm = cheveux[1]
        img[cm] = cheveux[0][cm]
        ink[cm] = cheveux[2][cm]
        c.mask |= cm

    col = img * (1 - ink[..., None]) + ENCRE * ink[..., None]
    col = etendre(col, c.mask)
    out = Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8)).resize((512, 512), Image.LANCZOS)
    out.save(sortie)
    print("ATLAS", sortie)


def peindre_cheveux(c, fiche, coif_id):
    racine = ESSAI / "gabarits" / "coiffures"
    st = tomllib.load(open(racine / f"{coif_id}.toml", "rb"))
    d = np.load(str(fiche["corps"]["donnees"]).replace(".npz", f"-{coif_id}.npz") if pathlib.Path(fiche["corps"]["donnees"]).is_absolute()
                else ESSAI / fiche["corps"]["donnees"].replace(".npz", f"-{coif_id}.npz"))
    att, m = rasteriser(d["corners"], 8, nint=0)
    u, v = att[..., 6], att[..., 7]  # u autour de la tête, v du sommet à l'ourlet
    n = att[..., 3:6]
    base = rgb(fiche["cheveux"])
    img = np.broadcast_to(base, att.shape[:2] + (3,)).copy()
    ink = np.zeros(att.shape[:2], dtype=np.float32)
    # Deux tons: ombre sur le bas et sous les mèches (alternance des arêtes), clair sur le dessus.
    cols = st["colonnes"]
    phase = np.mod(u * cols, 2.0)  # 0..2: une arête toutes les deux colonnes
    sous = (v > 0.55) | ((phase > 1.15) & (v > 0.25))
    img[sous] = ombre(base)
    # Grandes masses: traits d'encre du sommet vers l'ourlet, effilés, aux creux entre masses.
    masses = st["meches"]
    for k in range(masses):
        uk = (k + 0.35) / masses
        du = np.abs(np.angle(np.exp(1j * 2 * math.pi * (u - uk - 0.04 * v)))) / (2 * math.pi)
        larg = 0.010 * np.clip(v * 1.6, 0.25, 1.0)
        ink = np.maximum(ink, (du < larg) & (v > 0.12))
    # Traits fins de mèches (courts) et reflets clairs effilés sur le dessus.
    for k in range(masses * 2):
        uk = (k + 0.7) / (masses * 2)
        du = np.abs(np.angle(np.exp(1j * 2 * math.pi * (u - uk + 0.03 * v)))) / (2 * math.pi)
        ink = np.maximum(ink, ((du < 0.004) & (v > 0.45) & (v < 0.85)) * 1.0)
    for k in range(st["reflets"]):
        uk = (k + 0.15) / st["reflets"]
        du = np.abs(np.angle(np.exp(1j * 2 * math.pi * (u - uk)))) / (2 * math.pi)
        refl = (du < 0.012 * (1 - np.abs(v - 0.28) / 0.16)) & (np.abs(v - 0.28) < 0.16)
        img[refl] = clair(clair(base))
    # Ourlet: bande d'encre en bas (épaisseur d'une rangée), dessous plein noir.
    ink = np.maximum(ink, (v > 0.93) * 1.0)
    del n
    return img, m, ink


# ---------------------------------------------------------------- atlas commun des traits
def peindre_traits(sortie):
    """4 cellules de 128 px: neutre, joie, surprise, sommeil. Cellule = carré de face centré entre yeux et
    bouche, côté = 0,62 hauteur de tête; yeux à v 0,81 et bouche à v 0,19 (repères du conformateur)."""
    S = 512  # calcul à 4x, sortie 128 par cellule
    W = S * 4
    rgba = np.zeros((S, W, 4), dtype=np.float32)
    yy, xx = np.mgrid[0:S, 0:S] + 0.5
    u = xx / S
    v = 1 - yy / S
    ink = ENCRE
    blanc = rgb("blanc_oeil")
    iris = rgb("iris.brun")
    joue = rgb("joue")
    bouche = rgb("bouche")
    ey, my, ex = 0.80, 0.20, 0.235   # yeux, bouche, demi-écart des yeux (fractions de cellule)
    ew = 0.135                        # demi-largeur d'oeil (3,7 cm / 13,7 cm)

    def put(cell, mask, color, alpha=1.0):
        sl = rgba[:, cell * S:(cell + 1) * S]
        a = mask.astype(np.float32) * alpha
        sl[..., :3] = sl[..., :3] * (1 - a[..., None]) + color * a[..., None]
        sl[..., 3] = np.maximum(sl[..., 3], a)

    def ellipse(cx, cy, rx, ry):
        return ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 < 1

    def arc(cx, cy, rx, ry, w, lo=-1.0, hi=1.0, taper=True):
        """Arc d'ellipse épais (trait effilé aux bouts), portion de x relatif entre lo et hi."""
        r = np.sqrt(((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2)
        rel = (u - cx) / rx
        t = np.clip(1 - np.abs(rel) ** 3, 0.2, 1) if taper else 1
        return (np.abs(r - 1) * ry < w * t) & (rel > lo) & (rel < hi) & (v > cy if ry > 0 else True)

    for cell, expr in enumerate(("neutre", "joie", "surprise", "sommeil")):
        for s in (-1, 1):
            cx = 0.5 + s * ex
            if expr in ("neutre", "surprise"):
                ry = 0.075 if expr == "neutre" else 0.10
                rx = ew if expr == "neutre" else ew * 1.05
                put(cell, ellipse(cx, ey, rx, ry), blanc)
                put(cell, ellipse(cx + s * -0.02, ey - 0.005, rx * 0.47, ry * 0.86), iris)
                put(cell, ellipse(cx + s * -0.02, ey - 0.005, rx * 0.22, ry * 0.45), ink)
                put(cell, ellipse(cx + s * -0.02 + 0.022, ey + 0.03, 0.018, 0.018), blanc)
                # Paupière haute: trait épais qui déborde vers l'extérieur.
                put(cell, arc(cx, ey - 0.012, rx * 1.12, ry * 1.12, 0.03, taper=True), ink)
                put(cell, (np.abs(v - (ey + 0.012)) < 0.016) & (np.abs(u - (cx + s * rx * 1.05)) < 0.03), ink)
                # Bas de l'oeil: trait fin.
                low = (np.abs(np.sqrt(((u - cx) / rx) ** 2 + ((v - ey) / ry) ** 2) - 1) * ry < 0.008) & (v < ey - 0.03)
                put(cell, low, ink, 0.8)
            elif expr == "joie":
                put(cell, arc(cx, ey - 0.03, ew, 0.07, 0.024), ink)
                put(cell, ellipse(cx + s * 0.04, ey - 0.13, 0.085, 0.045), joue, 0.85)
            else:  # sommeil, aussi clignement: paupière fermée, arc vers le bas
                arcb = (np.abs(np.sqrt(((u - cx) / ew) ** 2 + ((v - ey - 0.02) / 0.05) ** 2) - 1) * 0.05 < 0.018) & (v < ey + 0.02)
                put(cell, arcb, ink)
            # Sourcils: trait effilé épais; ils portent l'expression.
            by = {"neutre": 0.93, "joie": 0.955, "surprise": 0.975, "sommeil": 0.915}[expr]
            tilt = {"neutre": -0.10, "joie": 0.05, "surprise": 0.0, "sommeil": -0.18}[expr]
            rel = (u - cx) * s
            line = by + rel * tilt - (rel / ew) ** 2 * (0.03 if expr == "surprise" else 0.012)
            thick = 0.022 * np.clip(1.15 - (rel / ew + 0.3) * 0.55, 0.35, 1.2)
            put(cell, (np.abs(v - line) < thick) & (np.abs(rel) < ew * 1.05), rgb("cheveux.brun"))
            put(cell, (np.abs(v - line) < thick) & (np.abs(rel) < ew * 1.05), ink, 0.55)
        # Bouche
        if expr == "neutre":
            put(cell, (np.abs(v - my - 0.02 * ((u - 0.5) / 0.12) ** 2) < 0.013) & (np.abs(u - 0.5) < 0.12), ink)
            put(cell, (np.abs(v - (my - 0.055)) < 0.008) & (np.abs(u - 0.5) < 0.045), ink, 0.7)
        elif expr == "joie":
            m = ((u - 0.5) / 0.17) ** 2 + ((v - my - 0.03) / 0.10) ** 2 < 1
            m &= v < my + 0.03
            put(cell, m, ink)
            put(cell, m & (((u - 0.5) / 0.12) ** 2 + ((v - my + 0.035) / 0.04) ** 2 < 1), bouche)
            put(cell, (np.abs(v - (my + 0.03)) < 0.012) & (np.abs(u - 0.5) < 0.19), ink)
        elif expr == "surprise":
            put(cell, ellipse(0.5, my - 0.01, 0.055, 0.075), ink)
            put(cell, ellipse(0.5, my - 0.025, 0.03, 0.04), bouche)
        else:
            put(cell, (np.abs(v - my + 0.01 * ((u - 0.5) / 0.08) ** 2) < 0.011) & (np.abs(u - 0.5) < 0.08), ink)
    img = Image.fromarray((np.clip(rgba, 0, 1) * 255).astype(np.uint8), "RGBA").resize((512, 128), Image.LANCZOS)
    img.save(sortie)
    print("TRAITS", sortie)


if __name__ == "__main__":
    if sys.argv[1] == "atlas":
        peindre_atlas(sys.argv[2], sys.argv[3])
    else:
        peindre_traits(sys.argv[2])

"""Constructeurs des familles d'objets (Python seul). Chaque constructeur reçoit l'entrée du
gabarit (`spec`) et ses couleurs résolues (`c`, nom par pièce), et rend (pièces, prise).
Les mesures sont en mètres, à peu près à la taille réelle; `construire_objets.py` remet ensuite
l'objet à la `taille` exacte du gabarit (plus grande dimension) et pose le dessous sur z = 0.
Repère de Blender: Z en haut, l'avant vers -Y."""
import math

from formes import TAU, blob, box, lathe, leaf, spiral, sweep


def _tuft(n, length, width, color, z, spread=35.0, tilt=0.0):
    """Bouquet de feuilles qui partent de (0, 0, z) vers le haut en s'ouvrant."""
    out = []
    for i in range(n):
        out.append(leaf(length, width, color, bend=-0.1).rot(ry=-(90 - spread)).rot(rz=360 * i / n + tilt).move(dz=z))
    return out


def _stem(h, r, color, z=0.0, lean=8.0):
    return sweep([(0, 0, z), (0, 0, z + h * 0.6), (math.sin(math.radians(lean)) * h, 0, z + h)], [r, r * 0.9, r * 0.8], color, segs=6)


# --------------------------------------------------------------------------------------- fruits
def fruit(spec, c):
    f = spec["forme"]
    parts = []
    if f == "pomme":
        prof = [(0.0, 0.004), (0.02, 0.0), (0.036, 0.012), (0.043, 0.032), (0.04, 0.055), (0.026, 0.07), (0.008, 0.066), (0.0, 0.06)]
        parts.append(lathe(prof, c["peau"], segs=16))
        parts += [_stem(0.02, 0.0025, c["queue"], z=0.058), leaf(0.035, 0.018, c["feuille"]).rot(rz=30).move(0.002, 0, 0.07)]
    elif f == "poire":
        prof = [(0.0, 0.0), (0.03, 0.006), (0.04, 0.03), (0.034, 0.055), (0.02, 0.075), (0.015, 0.09), (0.008, 0.1), (0.0, 0.102)]
        parts.append(lathe(prof, c["peau"], segs=16))
        parts += [_stem(0.022, 0.0025, c["queue"], z=0.098), leaf(0.035, 0.017, c["feuille"]).rot(rz=-20).move(0.002, 0, 0.11)]
    elif f == "prune":
        parts.append(blob(0.021, 0.019, 0.025, c["peau"], segs=14, rings=8).move(dz=0.025))
        parts.append(_stem(0.012, 0.0018, c["queue"], z=0.048))
    elif f == "ronde":
        prof = [(0.0, 0.002), (0.024, 0.0), (0.036, 0.018), (0.037, 0.04), (0.026, 0.066), (0.0, 0.07)]
        parts.append(lathe(prof, c["peau"], segs=16, lobes=1, lobe_amp=0.04))
        parts.append(leaf(0.03, 0.015, c["feuille"]).rot(rz=40).move(0, 0, 0.068))
    elif f == "cerises":
        for side in (-1, 1):
            parts.append(blob(0.012, 0.012, 0.011, c["peau"], segs=12, rings=7).move(side * 0.014, 0, 0.011))
            parts.append(sweep([(side * 0.014, 0, 0.02), (side * 0.01, 0, 0.04), (0.0, 0, 0.062)], 0.0013, c["queue"], segs=5))
        parts.append(leaf(0.03, 0.014, c["feuille"]).rot(rz=90).move(0, 0, 0.062))
    elif f == "baies":
        spots = [(-0.012, 0.0, 0.0), (0.012, 0.004, 0.0), (0.0, -0.012, 0.0), (0.002, 0.004, 0.016)]
        for i, (x, y, z) in enumerate(spots):
            b = lathe([(0.0, 0.0), (0.007, 0.002), (0.0105, 0.008), (0.0105, 0.013), (0.008, 0.018), (0.0, 0.021)], c["peau"], segs=12, lobes=6,
                      lobe_amp=0.05)
            parts.append(b.rot(rx=70 if z > 0 else 80, rz=40 * i).move(x, y, z + 0.011))
        parts.append(leaf(0.03, 0.016, c["feuille"]).rot(rz=150).move(0.004, 0.008, 0.03))
    elif f == "oeuf":
        parts.append(lathe([(0.0, 0.0), (0.016, 0.003), (0.022, 0.014), (0.021, 0.03), (0.019, 0.038), (0.015, 0.045), (0.009, 0.05), (0.0, 0.052)], c["peau"], segs=20))
    elif f == "noisette":
        for i, (x, y) in enumerate(((-0.011, 0.0), (0.011, 0.003), (0.0, -0.012))):
            nut = lathe([(0.0, 0.0), (0.009, 0.003), (0.011, 0.012), (0.007, 0.02), (0.0, 0.024)], c["peau"], segs=10)
            cap = lathe([(0.0, 0.0), (0.008, 0.0), (0.0085, 0.004), (0.0, 0.005)], c["queue"], segs=10)
            parts += [nut.rot(rz=40 * i).move(x, y, 0), cap.move(x, y, -0.0005)]
    else:
        raise ValueError(f"forme de fruit inconnue: {f}")
    return parts, None


# ------------------------------------------------------------------------------------- légumes
def legume(spec, c):
    f = spec["forme"]
    parts = []
    def peau_chair(cut):
        return lambda p: c["chair"] if p[2] < cut else c["peau"]
    if f == "racine-ronde":
        prof = [(0.0, 0.0), (0.004, 0.006), (0.016, 0.02), (0.026, 0.04), (0.026, 0.056), (0.012, 0.07), (0.0, 0.072)]
        parts.append(lathe(prof, peau_chair(0.022), segs=14))
        parts += _tuft(5, 0.06, 0.022, c["feuille"], 0.068, spread=30)
    elif f == "racine-longue":
        prof = [(0.0, 0.0), (0.004, 0.01), (0.01, 0.05), (0.016, 0.1), (0.019, 0.13), (0.015, 0.138), (0.0, 0.14)]
        parts.append(lathe(prof, c["peau"], segs=12, ribs=lambda a, z: 1 + 0.05 * math.sin(z * 260)))
        parts += _tuft(5, 0.06, 0.016, c["feuille"], 0.134, spread=22)
    elif f == "tomate":
        prof = [(0.0, 0.002), (0.022, 0.0), (0.036, 0.016), (0.037, 0.034), (0.026, 0.05), (0.0, 0.052)]
        parts.append(lathe(prof, c["peau"], segs=16, lobes=5, lobe_amp=0.06))
        for i in range(5):
            parts.append(leaf(0.016, 0.006, c["feuille"], bend=0.4).rot(rz=72 * i).move(0, 0, 0.051))
        parts.append(_stem(0.01, 0.002, c["feuille"], z=0.05))
    elif f == "potiron":
        prof = [(0.0, 0.01), (0.07, 0.0), (0.13, 0.03), (0.15, 0.08), (0.13, 0.14), (0.07, 0.16), (0.02, 0.15), (0.0, 0.145)]
        parts.append(lathe(prof, c["peau"], segs=24, lobes=8, lobe_amp=0.08))
        parts.append(sweep([(0, 0, 0.14), (0.004, 0, 0.17), (0.015, 0, 0.19)], [0.012, 0.01, 0.008], c["feuille"], segs=6))
    elif f == "chou":
        parts.append(blob(0.07, 0.07, 0.065, c["chair"], segs=14, rings=8).move(dz=0.068))
        for i in range(5):
            shell = blob(0.06, 0.012, 0.07, c["peau"], segs=10, rings=6, e_lat=0.9)
            parts.append(shell.rot(rx=-18).move(0, -0.06, 0.06).rot(rz=72 * i + 10))
    elif f == "poireau":
        prof = [(0.0, 0.0), (0.016, 0.004), (0.018, 0.02), (0.016, 0.2), (0.0, 0.205)]
        parts.append(lathe(prof, c["peau"], segs=10))
        for i, (lean, turn) in enumerate(((14, 0), (20, 120), (10, 240), (26, 60))):
            parts.append(leaf(0.22, 0.035, c["feuille"], thick=0.2, bend=0.25).rot(ry=-(90 - lean)).rot(rz=turn).move(dz=0.17 + 0.008 * i))
    elif f == "tubercule":
        parts.append(blob(0.04, 0.027, 0.024, c["peau"], segs=18, rings=10, bump=0.12, seed=7).move(dz=0.022))
    elif f == "bulbe":
        prof = [(0.0, 0.0), (0.02, 0.004), (0.038, 0.025), (0.034, 0.05), (0.012, 0.07), (0.005, 0.085), (0.0, 0.09)]
        prof = prof[:1] + [(0.03, 0.012)] + prof[1:3] + [(0.04, 0.038)] + prof[3:]
        parts.append(lathe(prof, c["peau"], segs=18))
        parts.append(lathe([(0.0, -0.002), (0.008, -0.002), (0.0, 0.004)], c["chair"], segs=8))
    else:
        raise ValueError(f"forme de légume inconnue: {f}")
    return parts, None


# ------------------------------------------------------------------------------------ poissons
FISH = {
    # profil de hauteur du corps le long de la longueur (tête à 0, queue à 1), épaisseur, nageoires
    "gardon": dict(h=[0.03, 0.17, 0.25, 0.27, 0.24, 0.16, 0.09, 0.06], w=0.42, dorsal=(0.38, 0.6, 0.12), queue=0.2),
    "truite": dict(h=[0.03, 0.13, 0.19, 0.21, 0.19, 0.14, 0.08, 0.06], w=0.5, dorsal=(0.36, 0.52, 0.08), queue=0.18, taches=True),
    "perche": dict(h=[0.04, 0.18, 0.27, 0.29, 0.25, 0.17, 0.09, 0.07], w=0.45, dorsal=(0.2, 0.62, 0.17), queue=0.2, bandes=True),
    "brochet": dict(h=[0.02, 0.07, 0.11, 0.13, 0.13, 0.12, 0.08, 0.05], w=0.6, dorsal=(0.68, 0.8, 0.07), queue=0.13, taches=True),
    "carpe": dict(h=[0.05, 0.22, 0.32, 0.34, 0.3, 0.2, 0.1, 0.07], w=0.48, dorsal=(0.3, 0.7, 0.08), queue=0.22),
    "goujon": dict(h=[0.04, 0.13, 0.17, 0.17, 0.15, 0.11, 0.07, 0.05], w=0.65, dorsal=(0.35, 0.5, 0.1), queue=0.18, taches=True),
}


def fish_parts(forme, c, length=1.0):
    """Poisson debout sur le ventre, tête vers -Y, longueur 1 (mise à l'échelle ensuite)."""
    p = FISH[forme]
    hs = p["h"]
    n = len(hs)
    path, radii = [], []
    for i, h in enumerate(hs):
        t = i / (n - 1)
        y = -0.5 + t * 0.86
        path.append((0.0, y, 0.0))
        radii.append((h / 2, max(h / 2 * p["w"], 0.008)))
    def col(pt):
        x, y, z = pt
        rel = z / (max(hs) / 2)
        if p.get("bandes") and rel > -0.2 and int((y + 0.5) * 10) % 2 == 1 and y < 0.25:
            return c["tache"]
        if rel > 0.42:
            return c["dos"]
        if rel < -0.4:
            return c["ventre"]
        return c["flanc"]
    body = sweep(path, radii, col, segs=10, up=(0, 0, 1), cap_round=0.9)
    parts = [body]
    # queue en éventail: deux lobes
    for s in (1, -1):
        parts.append(leaf(p["queue"], p["queue"] * 0.45, c["nageoire"], thick=0.1, bend=0.0, segs=4, steps=4).rot(rz=90).rot(rx=s * 32).move(0, 0.33, 0))
    d0, d1, dh = p["dorsal"]
    top = lambda t: hs[min(int(t * (n - 1)), n - 1)] / 2
    for i in range(2):
        t = d0 + (d1 - d0) * i
        y = -0.5 + t * 0.86
        parts.append(leaf(dh * (1.0 - 0.3 * i), (d1 - d0) * 0.6, c["nageoire"], thick=0.12, bend=-0.2, segs=4, steps=4).rot(ry=-75).rot(rx=-25)
                     .move(0, y, top(t) * 0.85))
    for s in (1, -1):
        parts.append(leaf(0.08, 0.035, c["nageoire"], thick=0.12, bend=0.1, segs=4, steps=4).rot(rz=s * 120).rot(ry=s * 30)
                     .move(s * max(hs) * p["w"] * 0.35, -0.25, -max(hs) * 0.15))
        parts.append(blob(0.016, 0.016, 0.016, c["oeil"], segs=6, rings=4).move(s * hs[1] * p["w"] * 0.42, -0.42, hs[1] * 0.12))
    if p.get("taches"):
        for k, (y, z) in enumerate(((-0.12, 0.04), (0.02, -0.02), (0.16, 0.03))):
            for s in (1, -1):
                hloc = hs[min(int((y + 0.5) / 0.86 * (n - 1)), n - 1)]
                x = s * hloc / 2 * p["w"] * 0.92 * math.sqrt(max(0.0, 1 - (z / (hloc / 2)) ** 2))
                parts.append(blob(0.005, 0.014, 0.012, c["tache"], segs=5, rings=3).move(x, y, z))
    return parts


def poisson(spec, c):
    parts = fish_parts(spec["forme"], c)
    return parts, (0.0, 0.25, 0.0)


# ----------------------------------------------------------------------------- bocaux, bouteilles
def bocal(spec, c):
    low = spec["forme"] == "pot"
    h = 0.07 if low else 0.1
    body = lathe([(0.0, 0.0), (0.035, 0.0), (0.04, 0.008), (0.04, h - 0.012), (0.032, h - 0.004), (0.03, h)], c["contenu"], segs=16)
    lid = lathe([(0.0, h - 0.004), (0.034, h - 0.004), (0.036, h + 0.006), (0.0, h + 0.009)], c["couvercle"], segs=16)
    cloth = lathe([(0.0, h + 0.004), (0.043, h - 0.012), (0.046, h - 0.006), (0.036, h + 0.012), (0.0, h + 0.016)], c["couvercle"], segs=16,
                  ribs=lambda a, z: 1 + 0.06 * math.cos(6 * a))
    tie = sweep([(0.034 * math.cos(a), 0.034 * math.sin(a), h - 0.003) for a in [TAU * i / 12 for i in range(12)]], 0.003, c["lien"], segs=5,
                closed=True)
    del lid  # le tissu noué couvre le couvercle: inutile d'en payer les triangles
    return [body, cloth, tie, _label_patch(0.0405, h * 0.32, h * 0.58, c["etiquette"], span=70)], None


def _label_patch(r, z0, z1, color, span=100.0):
    """Étiquette bombée collée sur une surface de révolution (devant, -Y): mince volume courbe."""
    path = []
    for i in range(7):
        a = math.radians(-90 - span / 2 + span * i / 6)
        path.append((r * math.cos(a), r * math.sin(a), (z0 + z1) / 2))
    return sweep(path, [((z1 - z0) / 2, 0.0025)] * 7, color, segs=6, up=(0, 0, 1), cap_round=0.2)


def bouteille(spec, c):
    if spec["forme"] == "fiole":
        prof = [(0.0, 0.0), (0.03, 0.0), (0.034, 0.01), (0.034, 0.09), (0.016, 0.12), (0.011, 0.13), (0.011, 0.15)]
        cork = lathe([(0.0, 0.145), (0.012, 0.145), (0.013, 0.17), (0.0, 0.172)], c["bouchon"], segs=10)
        lab = _label_patch(0.0345, 0.035, 0.07, c["etiquette"], span=80)
    else:
        prof = [(0.0, 0.0), (0.035, 0.0), (0.04, 0.012), (0.04, 0.14), (0.03, 0.18), (0.015, 0.21), (0.014, 0.235)]
        cork = lathe([(0.0, 0.23), (0.016, 0.23), (0.017, 0.255), (0.0, 0.258)], c["bouchon"], segs=10)
        lab = _label_patch(0.0405, 0.06, 0.1, c["etiquette"], span=80)
    return [lathe(prof, c["contenu"], segs=16), cork, lab], (0.0, 0.0, 0.08)


# ----------------------------------------------------------------------------------------- pains
def pain(spec, c):
    f = spec["forme"]
    parts = []
    if f == "boule":
        parts.append(blob(0.11, 0.1, 0.07, c["croute"], segs=20, rings=10, e_lat=0.85, flat=0.45))
        for x in (-0.04, 0.0, 0.04):
            # entailles: bourrelets clairs posés sur le dôme (bible: un détail est un volume)
            zt = 0.07 * math.sqrt(max(0.0, 1 - (x / 0.11) ** 2)) - 0.006
            parts.append(blob(0.008, 0.05, 0.008, c["entaille"], segs=8, rings=4).rot(rz=20).move(x, 0, zt))
    elif f == "baguette":
        path = [(0.0, -0.3 + 0.6 * i / 12, 0.0) for i in range(13)]
        radii = [(0.02 + 0.012 * math.sin(math.pi * min(1, 0.12 + i / 12 * 0.88)), 0.025 + 0.01 * math.sin(math.pi * min(1, 0.12 + i / 12 * 0.88)))
                 for i in range(13)]
        def col(p):
            x, y, z = p
            return c["entaille"] if z > 0.012 and abs(((y + 0.3) / 0.12) % 1 - 0.5) < 0.17 and abs(x) < 0.02 else c["croute"]
        parts.append(sweep(path, radii, col, segs=12, cap_round=0.8))
    elif f == "brioche":
        parts.append(lathe([(0.0, 0.0), (0.05, 0.0), (0.06, 0.02), (0.055, 0.05), (0.03, 0.065), (0.0, 0.068)], c["croute"], segs=16, lobes=8,
                           lobe_amp=0.07))
        parts.append(blob(0.024, 0.024, 0.022, c["entaille"], segs=12, rings=7).move(dz=0.08))
    elif f == "croissant":
        path, radii = [], []
        for i in range(11):
            t = i / 10
            a = math.radians(-110 + 220 * t)
            path.append((0.045 * math.sin(a), -0.03 * math.cos(a) + 0.01, 0.0))
            s = math.sin(math.pi * t)
            radii.append((0.006 + 0.016 * s, 0.006 + 0.02 * s))
        def col(p):
            ang = math.atan2(p[1] - 0.01, p[0])
            return c["entaille"] if int((ang + 4) * 4.5) % 2 == 0 and p[2] > 0.006 else c["croute"]
        parts.append(sweep(path, radii, col, segs=10, cap_round=1.0))
    elif f == "tartine":
        parts.append(box(0.16, 0.1, 0.018, c["croute"], e=0.35, segs=16, rings=6))
        parts.append(box(0.145, 0.085, 0.006, c["entaille"], e=0.3, segs=12, rings=4).move(0, 0, 0.016))
    else:
        raise ValueError(f"forme de pain inconnue: {f}")
    return parts, None


# ----------------------------------------------------------------------------------------- plats
def _container(kind, c):
    if kind == "bol":
        outer = [(0.0, 0.0), (0.03, 0.0), (0.032, 0.006), (0.06, 0.025), (0.072, 0.055), (0.073, 0.06)]
        inner = [(0.066, 0.06), (0.064, 0.052), (0.052, 0.025), (0.0, 0.015)]
        bowl = lathe(outer + inner, lambda p: c["lisere"] if p[2] > 0.045 and math.hypot(p[0], p[1]) > 0.068 else c["vaisselle"], segs=20)
        return [bowl], 0.045
    if kind == "moule":
        prof = [(0.0, 0.0), (0.09, 0.0), (0.1, 0.03), (0.11, 0.032), (0.112, 0.036), (0.1, 0.036), (0.09, 0.012), (0.0, 0.012)]
        return [lathe(prof, c["vaisselle"], segs=20, lobes=14, lobe_amp=0.02)], 0.012
    prof = [(0.0, 0.0), (0.06, 0.0), (0.07, 0.008), (0.11, 0.014), (0.12, 0.02), (0.112, 0.022), (0.068, 0.012), (0.0, 0.012)]
    plate = lathe(prof, lambda p: c["lisere"] if math.hypot(p[0], p[1]) > 0.105 else c["vaisselle"], segs=20)
    return [plate], 0.012


def plat(spec, c):
    parts, z = _container(spec.get("contenant", "assiette"), c)
    f = spec["forme"]
    if f == "soupe":
        parts.append(lathe([(0.0, z + 0.024), (0.062, z + 0.024), (0.062, z), (0.0, z)], c["plat"], segs=20))
        for i in range(5):
            parts.append(leaf(0.018, 0.009, c["garniture"], bend=0.0, thick=0.2).rot(rz=72 * i + 15).move(0.025 * math.cos(i * 1.3), 0.025 * math.sin(i * 1.3),
                                                                                                         z + 0.026))
    elif f in ("salade", "ragout"):
        n = 9 if f == "salade" else 7
        for i in range(n):
            a = i * 2.39
            r = 0.04 * math.sqrt((i + 0.5) / n)
            if f == "salade":
                parts.append(blob(0.024, 0.008, 0.016, c["plat"], segs=6, rings=3).rot(rx=40, rz=math.degrees(a)).move(r * math.cos(a), r * math.sin(a),
                                                                                                                           z + 0.022))
            else:
                parts.append(blob(0.012, 0.012, 0.01, c["garniture"], segs=6, rings=4, bump=0.1, seed=i).move(r * math.cos(a), r * math.sin(a), z + 0.02))
        if f == "salade":
            for i in range(4):
                parts.append(blob(0.01, 0.01, 0.006, c["garniture"], segs=8, rings=4).move(0.03 * math.cos(i * 1.6 + 0.5), 0.03 * math.sin(i * 1.6 + 0.5),
                                                                                             z + 0.03))
        elif spec.get("contenant") != "assiette":
            parts.append(lathe([(0.0, z + 0.018), (0.06, z + 0.018), (0.06, z), (0.0, z)], c["plat"], segs=20))
    elif f == "omelette":
        path = [(0.07 * math.cos(math.radians(a)), 0.035 * math.sin(math.radians(a)), z + 0.012) for a in range(-80, 81, 20)]
        parts.append(sweep(path, [(0.012, 0.03)] * len(path), c["plat"], segs=10, cap_round=0.7).move(-0.02, 0, 0))
        for i in range(3):
            parts.append(leaf(0.014, 0.007, c["garniture"], bend=0.0).rot(rz=40 * i).move(0.0 + 0.015 * i, -0.01, z + 0.026))
    elif f in ("tarte", "tourte"):
        if f == "tourte":
            parts.append(lathe([(0.0, z + 0.045), (0.06, z + 0.04), (0.098, z + 0.024), (0.104, z + 0.014), (0.0, z)], c["plat"], segs=20))
            parts.append(sweep([(0.1 * math.cos(a), 0.1 * math.sin(a), z + 0.022) for a in [TAU * i / 20 for i in range(20)]], 0.008, c["plat"],
                               segs=6, closed=True))
            for i in range(3):
                parts.append(blob(0.016, 0.004, 0.003, c["garniture"], segs=6, rings=3).rot(rz=60 * i).move(0, 0, z + 0.046))
        else:
            parts.append(lathe([(0.0, z + 0.016), (0.09, z + 0.016), (0.09, z), (0.0, z)], c["garniture"], segs=20))
            parts.append(sweep([(0.094 * math.cos(a), 0.094 * math.sin(a), z + 0.016) for a in [TAU * i / 20 for i in range(20)]], 0.01, c["plat"],
                               segs=6, closed=True))
            for i in range(-2, 3):
                for rot in (0, 90):
                    L = math.sqrt(max(0.0, 0.088 ** 2 - (i * 0.032) ** 2))
                    parts.append(sweep([(-L, i * 0.032, z + 0.018), (L, i * 0.032, z + 0.018)], (0.003, 0.006), c["plat"], segs=4).rot(rz=rot + 45))
    elif f == "oeuf-au-plat":
        parts.append(blob(0.06, 0.05, 0.004, c["plat"], segs=14, rings=4, bump=0.15, seed=4).move(0, 0, z + 0.003))
        parts.append(blob(0.022, 0.022, 0.012, c["garniture"], segs=12, rings=6).move(0.01, 0.005, z + 0.006))
    elif f == "pomme-cuite":
        apple = lathe([(0.0, 0.004), (0.02, 0.0), (0.036, 0.012), (0.043, 0.032), (0.04, 0.055), (0.026, 0.07), (0.008, 0.066), (0.0, 0.06)],
                      c["plat"], segs=16)
        parts.append(apple.move(dz=z))
        parts.append(lathe([(0.0, z), (0.075, z), (0.075, z + 0.004), (0.0, z + 0.004)], c["garniture"], segs=16))
        parts.append(_stem(0.02, 0.0025, "chocolat", z=z + 0.058))
    elif f == "poisson-grille":
        fc = {"dos": c["plat"], "flanc": c["plat"], "ventre": c["garniture"], "nageoire": c["plat"], "oeil": "encre", "tache": c["plat"]}
        fish = fish_parts("gardon", fc)
        for p in fish:
            p.scale(0.19).rot(ry=90).rot(rz=-70).move(0, 0, z + 0.012)
        parts += fish
        parts.append(lathe([(0.0, 0.0), (0.016, 0.0), (0.016, 0.006), (0.0, 0.008)], c["garniture"], segs=10).scale(1, 1, 1).move(0.06, -0.05, z))
    else:
        raise ValueError(f"forme de plat inconnue: {f}")
    return parts, None


# ---------------------------------------------------------------------------------------- outils
def outil(spec, c):
    f = spec["forme"]
    lvl = spec.get("niveau", 0)
    parts = []
    if f == "arrosoir":
        body = lathe([(0.0, 0.0), (0.09, 0.0), (0.095, 0.01), (0.095, 0.2), (0.085, 0.22), (0.05, 0.235), (0.05, 0.245), (0.0, 0.245)], c["tete"],
                     segs=18)
        spout = sweep([(0.0, -0.07, 0.05), (0.0, -0.17, 0.13), (0.0, -0.26, 0.24)], [0.018, 0.014, 0.012], c["tete"], segs=8, caps=True)
        rose = lathe([(0.0, 0.0), (0.012, 0.0), (0.03, 0.03), (0.0, 0.034)], c["tete"], segs=10).rot(rx=-30).move(0, -0.265, 0.245)
        handle = sweep([(0.0, 0.085, 0.12), (0.0, 0.14, 0.2), (0.0, 0.1, 0.31), (0.0, 0.0, 0.33), (0.0, -0.06, 0.25)], 0.011, c["manche"], segs=7)
        parts = [body, spout, rose, handle]
        if lvl:
            parts.append(lathe([(0.097, 0.03), (0.1, 0.035), (0.1, 0.05), (0.097, 0.055)], c["virole"], segs=18))
            parts.append(lathe([(0.097, 0.17), (0.1, 0.175), (0.1, 0.19), (0.097, 0.195)], c["virole"], segs=18))
        return parts, (0.0, 0.1, 0.31)
    L = 1.0 if f in ("beche",) else 0.7
    if f == "canne":
        L = 1.5
    if f == "filet":
        L = 0.75
    if f == "serpe":
        L = 0.18
    handle_r = 0.016 if f != "canne" else 0.011
    taper = 0.55 if f == "canne" else 0.95
    pts = [(0.0, 0.0, i * L / 6) for i in range(7)]
    parts.append(sweep(pts, [handle_r * (1 - (1 - taper) * i / 6) for i in range(7)], c["manche"], segs=8, cap_round=0.5))
    if f == "hache":
        blade = sweep([(0.0, 0.0, L * 0.9), (0.0, -0.06, L * 0.9), (0.0, -0.13, L * 0.9)], [(0.035, 0.022), (0.05, 0.012), (0.075, 0.004)], c["tete"],
                      segs=8, cap_round=0.2)
        poll = blob(0.025, 0.028, 0.035, c["tete"], segs=10, rings=6, e_lat=0.6, e_lon=0.6).move(0, 0.02, L * 0.9)
        parts += [blade, poll]
    elif f == "beche":
        parts.append(box(0.17, 0.02, 0.25, c["tete"], e=0.35).move(0, 0, -0.24))
        parts.append(lathe([(0.0, -0.02), (0.02, -0.02), (0.022, 0.06), (0.0, 0.06)], c["tete"], segs=8))
        grip = sweep([(-0.06, 0, L), (-0.05, 0, L + 0.09), (0.05, 0, L + 0.09), (0.06, 0, L)], 0.012, c["manche"], segs=6)
        parts.append(grip)
    elif f == "pioche":
        head = sweep([(-0.26, 0.0, L * 0.88), (-0.12, 0.0, L * 0.93), (0.0, 0.0, L * 0.95), (0.12, 0.0, L * 0.93), (0.26, 0.0, L * 0.86)],
                     [(0.006, 0.006), (0.02, 0.018), (0.03, 0.026), (0.02, 0.022), (0.01, 0.035)], c["tete"], segs=10, cap_round=0.3)
        parts.append(blob(0.028, 0.034, 0.04, c["tete"], segs=10, rings=5, e_lat=0.6, e_lon=0.6).move(0, 0, L * 0.94))
        parts.append(head)
    elif f == "canne":
        parts.append(lathe([(0.0, 0.0), (0.025, 0.0), (0.028, 0.012), (0.0, 0.016)], c["tete"], segs=12).rot(ry=90).move(0.03, 0, 0.3))
        parts.append(sweep([(0.016, 0, 0.3), (0.03, 0, 0.3)], 0.004, c["tete"], segs=6))
        parts.append(blob(0.012, 0.012, 0.016, "coquelicot", segs=8, rings=5).move(0.06, 0, L * 0.55))
        parts.append(sweep([(0.0, 0, L), (0.03, 0, L * 0.85), (0.06, 0, L * 0.58)], 0.0015, "craie", segs=4))
    elif f == "filet":
        ring = sweep([(0.13 * math.sin(a), 0.0, L + 0.13 - 0.13 * math.cos(a)) for a in [TAU * i / 16 for i in range(16)]], 0.007, c["virole"],
                     segs=6, closed=True)
        net = lathe([(0.12, 0.0), (0.1, -0.08), (0.05, -0.15), (0.0, -0.17)], c["tete"], segs=14).rot(rx=90).move(0, 0.0, L + 0.13)
        parts += [ring, net]
    elif f == "serpe":
        blade = []
        path = []
        for i in range(8):
            a = math.radians(-10 + 170 * i / 7)
            path.append((0.07 * math.sin(a) * (1 - 0.3 * i / 7), 0.0, L + 0.03 + 0.12 * (1 - math.cos(a)) * 0.6 + 0.1 * i / 7))
        blade = sweep(path, [(0.006, 0.02 * (1 - 0.6 * i / 7) + 0.004) for i in range(8)], c["tete"], segs=6, up=(0, 1, 0))
        parts.append(blade)
    else:
        raise ValueError(f"forme d'outil inconnue: {f}")
    # virole au collet; au niveau 1, un lien de cuir sur la poignée
    vz = L * 0.86 if f not in ("canne", "serpe", "beche") else (L * 0.2 if f == "canne" else L * 0.98 if f == "serpe" else L * 0.06)
    if lvl or f in ("beche", "serpe"):
        parts.append(lathe([(handle_r * 1.05, vz - 0.02), (handle_r * 1.35, vz - 0.015), (handle_r * 1.35, vz + 0.015), (handle_r * 1.05, vz + 0.02)],
                           c["virole"], segs=10))
    if lvl:
        parts.append(lathe([(handle_r * 1.0, L * 0.1), (handle_r * 1.25, L * 0.12), (handle_r * 1.25, L * 0.3), (handle_r * 1.0, L * 0.32)],
                           c["lien"], segs=8, ribs=lambda a, z: 1 + 0.05 * math.sin(z * 300)))
    return parts, (0.0, 0.0, L * 0.25)


# ------------------------------------------------------------------------------------------ sacs
def sac(spec, c):
    f = spec["forme"]
    if f == "sac-a-dos":
        body = box(0.3, 0.16, 0.38, c["toile"], e=0.4)
        flap = blob(0.15, 0.04, 0.09, c["rabat"], segs=12, rings=6, e_lat=0.5, e_lon=0.5).move(0, -0.06, 0.34)
        pocket = box(0.2, 0.05, 0.12, c["rabat"], e=0.4).move(0, -0.08, 0.06)
        strap = sweep([(0.08, 0.08, 0.35), (0.09, 0.14, 0.3), (0.09, 0.14, 0.08), (0.08, 0.08, 0.04)], (0.008, 0.022), c["sangle"], segs=6)
        strap2 = sweep([(-0.08, 0.08, 0.35), (-0.09, 0.14, 0.3), (-0.09, 0.14, 0.08), (-0.08, 0.08, 0.04)], (0.008, 0.022), c["sangle"], segs=6)
        buckle = box(0.04, 0.012, 0.03, c["boucle"], e=0.4).move(0, -0.105, 0.25)
        loop = sweep([(-0.05, 0.0, 0.38), (0.0, 0.0, 0.43), (0.05, 0.0, 0.38)], 0.009, c["sangle"], segs=6)
        return [body, flap, pocket, strap, strap2, buckle, loop], (0.0, 0.0, 0.42)
    w = 0.3 if f == "besace" else 0.36
    body = box(w, 0.1, 0.22, c["toile"], e=0.4)
    flap = blob(w / 2, 0.02, 0.08, c["rabat"], segs=12, rings=6, e_lat=0.45, e_lon=0.45).rot(rx=-6).move(0, -0.05, 0.16)
    buckle = box(0.03, 0.01, 0.025, c["boucle"], e=0.4).move(0, -0.068, 0.085)
    strap = sweep([(-w / 2 + 0.02, 0, 0.2), (-w / 2, 0, 0.3), (-0.06, 0, 0.36), (0.06, 0, 0.36), (w / 2, 0, 0.3), (w / 2 - 0.02, 0, 0.2)],
                  (0.006, 0.018), c["sangle"], segs=6)
    parts = [body, flap, buckle, strap]
    if f == "sacoche":
        for s in (-1, 1):
            parts.append(box(0.1, 0.04, 0.1, c["rabat"], e=0.4).move(s * 0.1, -0.06, 0.03))
    return parts, (0.0, 0.0, 0.36)


# --------------------------------------------------------------------------------------- graines
def graine(spec, c):
    f = spec["forme"]
    packet = box(0.09, 0.012, 0.12, lambda p: c["bande"] if p[2] < 0.025 else c["papier"], e=0.3)
    fold = box(0.092, 0.016, 0.014, c["bande"], e=0.4).move(0, 0, 0.112)
    parts = [packet, fold]
    if f == "ronde":
        parts.append(blob(0.018, 0.008, 0.018, c["image"], segs=10, rings=6).move(0, -0.007, 0.065))
        parts.append(leaf(0.02, 0.01, c["feuille"], thick=0.2, bend=0.0).rot(rx=90, rz=0).rot(ry=-60).move(0.0, -0.008, 0.08))
    elif f == "longue":
        parts.append(sweep([(0.0, -0.007, 0.04), (0.0, -0.007, 0.075)], [(0.002, 0.002), (0.008, 0.01)], c["image"], segs=6).rot(ry=0))
        parts.append(leaf(0.018, 0.008, c["feuille"], thick=0.2, bend=0.0).rot(ry=-80).move(0, -0.007, 0.078))
    else:
        for i in range(5):
            parts.append(blob(0.008, 0.004, 0.005, c["image"], segs=6, rings=4).move(0.009, 0, 0).rot(ry=72 * i).move(0, -0.008, 0.068))
        parts.append(blob(0.005, 0.005, 0.005, "moutarde", segs=6, rings=4).move(0, -0.011, 0.068))
    return parts, (0.0, 0.0, 0.06)


# ---------------------------------------------------------------------------------------- fleurs
def fleur(spec, c):
    f = spec["forme"]
    H = 0.26 if f != "soleil" else 0.42
    stem = sweep([(0.0, 0, 0.0), (0.004, 0, H * 0.5), (0.0, 0, H)], [0.004, 0.0035, 0.003], c["tige"], segs=6)
    parts = [stem, leaf(0.06, 0.02, c["tige"]).rot(ry=-40).move(0.003, 0, H * 0.35), leaf(0.05, 0.018, c["tige"]).rot(ry=-40).rot(rz=180).move(0, 0, H * 0.5)]
    if f == "coupe":
        for i in range(4):
            parts.append(blob(0.024, 0.006, 0.022, c["petale"], segs=10, rings=5).rot(rx=-35).move(0, -0.017, 0.016).rot(rz=90 * i + 45).move(dz=H))
        parts.append(blob(0.008, 0.008, 0.008, c["coeur"], segs=8, rings=5).move(dz=H + 0.012))
    elif f == "etoile":
        for i in range(12):
            parts.append(blob(0.016, 0.005, 0.002, c["petale"], segs=6, rings=3).move(0.02, 0, 0).rot(ry=-8).rot(rz=30 * i).move(dz=H))
        parts.append(blob(0.009, 0.009, 0.006, c["coeur"], segs=10, rings=5).move(dz=H + 0.003))
    else:
        head = []
        for i in range(14):
            head.append(blob(0.03, 0.01, 0.003, c["petale"], segs=6, rings=3).move(0.06, 0, 0).rot(rz=360 * i / 14))
        head.append(blob(0.045, 0.045, 0.012, c["coeur"], segs=14, rings=6))
        for p in head:
            p.rot(rx=70).move(0, -0.01, H)
        parts += head
    return parts, (0.0, 0.0, H * 0.3)


# -------------------------------------------------------------------------------------- cailloux
def caillou(spec, c):
    f = spec["forme"]
    if f == "fossile":
        base = blob(0.05, 0.04, 0.022, c["pierre"], segs=14, rings=7, bump=0.08, seed=3).move(dz=0.02)
        shell = spiral(0.004, 0.026, 2.2, 0.004, 0.013, c["eclat"], steps=34, segs=8).scale(1, 1, 0.7).rot(rx=-25).move(0, -0.004, 0.036)
        return [base, shell], None
    stone = blob(0.06, 0.045, 0.04, c["pierre"], segs=18, rings=10, bump=0.1, seed=11 if f == "galet" else 5).move(dz=0.034)
    parts = [stone]
    if f == "minerai":
        for i, (a, z, s) in enumerate(((0.3, 0.05, 1.0), (2.2, 0.045, 0.8), (4.0, 0.04, 0.9), (1.2, 0.068, 0.7))):
            r = 0.045
            cr = blob(0.012 * s, 0.012 * s, 0.018 * s, c["eclat"], segs=6, rings=4, e_lat=0.7, e_lon=0.7)
            parts.append(cr.rot(rx=40, rz=math.degrees(a)).move(r * math.cos(a) * 0.95, r * math.sin(a) * 0.75, z))
    return parts, None


# ------------------------------------------------------------------------------------------ bois
def bois(spec, c):
    f = spec["forme"]
    if f == "planche":
        return [box(0.9, 0.16, 0.025, lambda p: c["coeur"] if abs(p[0]) > 0.44 else c["bois"], e=0.25, segs=20, rings=8)], (0.0, 0.0, 0.0125)
    def col(p):
        return c["coeur"] if abs(p[1]) > 0.19 else c["bois"]
    path = [(0.0, -0.2 + 0.4 * i / 6, 0.065) for i in range(7)]
    log = sweep(path, [0.064, 0.067, 0.068, 0.066, 0.068, 0.067, 0.064], col, segs=14, cap_round=0.08)
    knot = blob(0.012, 0.012, 0.012, c["bois"], segs=8, rings=4).move(0.05, 0.05, 0.1)
    return [log, knot], None


# -------------------------------------------------------------------------------------- courrier
def courrier(spec, c):
    if spec["forme"] == "lettre":
        env = box(0.18, 0.12, 0.008, c["papier"], e=0.2, segs=16, rings=6)
        flap = sweep([(-0.085, 0.055, 0.008), (0.0, -0.005, 0.009), (0.085, 0.055, 0.008)], (0.0015, 0.003), c["etiquette"], segs=4)
        seal = lathe([(0.0, 0.006), (0.013, 0.006), (0.014, 0.011), (0.0, 0.013)], c["sceau"], segs=12, lobes=6, lobe_amp=0.08).move(0, -0.005, 0)
        return [env, flap, seal], None
    body = box(0.3, 0.22, 0.14, c["papier"], e=0.18, segs=16, rings=6)
    s1 = sweep([(-0.152, 0, 0.0), (-0.152, 0, 0.142), (0.152, 0, 0.142), (0.152, 0, 0.0)], (0.003, 0.005), c["ficelle"], segs=4)
    s2 = sweep([(0, -0.112, 0.0), (0, -0.112, 0.142), (0, 0.112, 0.142), (0, 0.112, 0.0)], (0.003, 0.005), c["ficelle"], segs=4)
    knot = blob(0.012, 0.012, 0.008, c["ficelle"], segs=8, rings=4).move(0, 0, 0.145)
    label = box(0.08, 0.05, 0.004, c["etiquette"], e=0.3, segs=8, rings=4).move(0.07, 0.05, 0.139)
    return [body, s1, s2, knot, label], None


# ------------------------------------------------------------------------------------ clé, pièce
def cle(spec, c):
    m = c["metal"]
    bow = sweep([(0.016 * math.cos(a), 0.016 * math.sin(a), 0.0) for a in [TAU * i / 12 for i in range(12)]], 0.004, m, segs=6, closed=True)
    shaft = sweep([(0.016, 0, 0.0), (0.075, 0, 0.0)], 0.0035, m, segs=6)
    bit = box(0.012, 0.004, 0.016, m, e=0.4).rot(rx=90).move(0.068, 0.0, -0.008)
    collar = lathe([(0.0, 0.0), (0.0055, 0.0), (0.0055, 0.004), (0.0, 0.004)], m, segs=8).rot(ry=90).move(0.024, 0, 0)
    parts = [bow, shaft, bit.rot(rx=0), collar]
    for p in parts:
        p.move(dz=0.0045)
    return parts, (0.0, 0.0, 0.0045)


def piece(spec, c):
    m = c["metal"]
    coin = lathe([(0.0, 0.0), (0.0145, 0.0), (0.015, 0.0012), (0.015, 0.0025), (0.0135, 0.0028), (0.012, 0.0022), (0.0, 0.0022)], m, segs=20)
    relief = blob(0.006, 0.0075, 0.0012, m, segs=10, rings=4).move(0, 0, 0.0024)
    return [coin, relief], None


# ------------------------------------------------------------------------------------ provisions
def provision(spec, c):
    f = spec["forme"]
    if f == "viande":
        meat = blob(0.07, 0.05, 0.03, c["principale"], segs=16, rings=8, bump=0.06, seed=9).move(dz=0.03)
        fat = sweep([(-0.065, -0.02, 0.03), (-0.02, -0.05, 0.035), (0.04, -0.045, 0.032)], (0.012, 0.008), c["secondaire"], segs=6)
        # ficelle de rôti: un anneau couché qui enserre la pièce à mi-longueur
        string = sweep([(0.0, 0.054 * math.cos(a), 0.03 + 0.034 * math.sin(a)) for a in [TAU * i / 12 for i in range(12)]], 0.0025, c["lien"],
                       segs=4, closed=True)
        return [meat, fat, string], None
    if f == "farine":
        sack = blob(0.08, 0.06, 0.1, c["principale"], segs=16, rings=8, e_lat=0.8, flat=0.6, bump=0.03).move(dz=0.06)
        neck = lathe([(0.0, 0.14), (0.03, 0.14), (0.022, 0.17), (0.035, 0.2), (0.0, 0.205)], c["principale"], segs=12)
        tie = sweep([(0.026 * math.cos(a), 0.026 * math.sin(a), 0.155) for a in [TAU * i / 10 for i in range(10)]], 0.004, c["lien"], segs=5,
                    closed=True)
        label = _label_patch(0.078, 0.05, 0.1, c["secondaire"], span=60)
        return [sack, neck, tie, label], (0.0, 0.0, 0.16)
    if f == "livre":
        cover = box(0.16, 0.2, 0.035, c["principale"], e=0.25, segs=16, rings=6)
        pages = box(0.15, 0.19, 0.027, c["secondaire"], e=0.3, segs=12, rings=4).move(0.006, 0, 0.004)
        band = box(0.03, 0.202, 0.037, c["lien"], e=0.3, segs=8, rings=4).move(-0.04, 0, -0.001)
        return [cover, pages, band], None
    if f == "appareil-photo":
        body = box(0.13, 0.06, 0.08, c["principale"], e=0.3, segs=16, rings=6)
        lens = lathe([(0.0, 0.0), (0.024, 0.0), (0.026, 0.03), (0.02, 0.034), (0.0, 0.03)], c["secondaire"], segs=14).rot(rx=90).move(0, -0.028, 0.04)
        glass = lathe([(0.0, 0.0), (0.016, 0.0), (0.0, 0.004)], "encre", segs=12).rot(rx=90).move(0, -0.061, 0.04)
        button = lathe([(0.0, 0.0), (0.008, 0.0), (0.008, 0.008), (0.0, 0.009)], c["lien"], segs=8).move(0.04, 0, 0.078)
        top = box(0.04, 0.04, 0.02, c["principale"], e=0.3, segs=8, rings=4).move(-0.03, 0, 0.075)
        return [body, lens, glass, button, top], None
    raise ValueError(f"forme de provision inconnue: {f}")


BUILDERS = {
    "provision": provision,
    "fruit": fruit, "legume": legume, "poisson": poisson, "bocal": bocal, "bouteille": bouteille, "pain": pain, "plat": plat,
    "outil": outil, "sac": sac, "graine": graine, "fleur": fleur, "caillou": caillou, "bois": bois, "courrier": courrier,
    "cle": cle, "piece": piece,
}

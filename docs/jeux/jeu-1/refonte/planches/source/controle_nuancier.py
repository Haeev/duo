"""Contrôle du nuancier des personnages: clarté L* (CIELAB) et écarts CIEDE2000.
Lancer: python3 controle_nuancier.py nuancier.json"""
import json, math, sys

def lab(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    x = (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.95047
    y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    z = (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.08883
    f = lambda t: t ** (1 / 3) if t > (6 / 29) ** 3 else t / (3 * (6 / 29) ** 2) + 4 / 29
    return 116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))

def de2000(p, q):
    l1, a1, b1 = p; l2, a2, b2 = q
    cm = (math.hypot(a1, b1) + math.hypot(a2, b2)) / 2
    g = 0.5 * (1 - math.sqrt(cm ** 7 / (cm ** 7 + 25 ** 7)))
    a1, a2 = (1 + g) * a1, (1 + g) * a2
    c1, c2 = math.hypot(a1, b1), math.hypot(a2, b2)
    h1 = math.degrees(math.atan2(b1, a1)) % 360; h2 = math.degrees(math.atan2(b2, a2)) % 360
    dl, dc = l2 - l1, c2 - c1
    dh = h2 - h1
    if c1 * c2 == 0: dh = 0
    elif dh > 180: dh -= 360
    elif dh < -180: dh += 360
    dH = 2 * math.sqrt(c1 * c2) * math.sin(math.radians(dh / 2))
    lm, cm2 = (l1 + l2) / 2, (c1 + c2) / 2
    if c1 * c2 == 0: hm = h1 + h2
    elif abs(h1 - h2) <= 180: hm = (h1 + h2) / 2
    elif h1 + h2 < 360: hm = (h1 + h2 + 360) / 2
    else: hm = (h1 + h2 - 360) / 2
    t = 1 - 0.17 * math.cos(math.radians(hm - 30)) + 0.24 * math.cos(math.radians(2 * hm)) + 0.32 * math.cos(math.radians(3 * hm + 6)) - 0.2 * math.cos(math.radians(4 * hm - 63))
    sl = 1 + 0.015 * (lm - 50) ** 2 / math.sqrt(20 + (lm - 50) ** 2)
    sc, sh = 1 + 0.045 * cm2, 1 + 0.015 * cm2 * t
    rt = -2 * math.sqrt(cm2 ** 7 / (cm2 ** 7 + 25 ** 7)) * math.sin(math.radians(60 * math.exp(-((hm - 275) / 25) ** 2)))
    return math.sqrt((dl / sl) ** 2 + (dc / sc) ** 2 + (dH / sh) ** 2 + rt * (dc / sc) * (dH / sh))

n = json.load(open(sys.argv[1]))
assert abs(de2000((50, 2.6772, -79.7751), (50, 0, -82.7485)) - 2.0425) < 1e-3  # paire de référence de Sharma
for fam in ("peaux", "cheveux", "tissus"):
    print(fam, " ".join(f"{k}:{lab(v)[0]:.0f}" for k, v in n[fam]))
print("peaux voisines:", " ".join(f"{de2000(lab(a[1]), lab(b[1])):.1f}" for a, b in zip(n["peaux"], n["peaux"][1:])))
low = []
for i, (ka, va) in enumerate(n["tissus"]):
    for kb, vb in n["tissus"][i + 1:]:
        d = de2000(lab(va), lab(vb))
        if d < 8: low.append(f"{ka}/{kb} {d:.1f}")
print("tissus à moins de 8:", low or "aucun")
near = []
for kd, vd in n["duo"]:
    for fam in ("tissus", "cheveux", "cheveux_joueurs", "peaux"):
        for k, v in n[fam]:
            d = de2000(lab(vd), lab(v))
            if d < 15: near.append(f"{kd}/{k} {d:.1f}")
print("à moins de 15 d'une couleur de profil Duo:", near or "aucun")

"""Planches de référence de la bible artistique de la refonte (personnages).

Lancer: python3 planches.py <dossier de sortie>, puis rsvg-convert chaque SVG en PNG (voir construire.sh).
Cotes en mètres, vues de face. Les couleurs viennent de nuancier.json (seule source).
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
N = {fam: dict(v) for fam, v in json.load(open(os.path.join(HERE, "nuancier.json"))).items()}
INK = "#2B2A33"
PAPER = "#F4EEE2"
FONT = "DejaVu Sans"

# Gabarits: hauteur au sommet du crâne, tête (hauteur, largeur), carrure, taille, bassin, épaisseur des membres.
BODIES = {
    "child_slim": dict(nom="Enfant menu", H=1.22, hh=0.300, hw=0.290, sh=0.300, wa=0.215, hi=0.235, arm=0.062, leg=0.082, waist=0.545, crotch=0.435),
    "child_round": dict(nom="Enfant rond", H=1.22, hh=0.300, hw=0.300, sh=0.325, wa=0.275, hi=0.285, arm=0.072, leg=0.096, waist=0.545, crotch=0.435),
    "adult_slim": dict(nom="Adulte mince", H=1.70, hh=0.340, hw=0.305, sh=0.385, wa=0.265, hi=0.305, arm=0.072, leg=0.098, waist=0.578, crotch=0.470),
    "adult_medium": dict(nom="Adulte moyen", H=1.70, hh=0.340, hw=0.315, sh=0.425, wa=0.320, hi=0.350, arm=0.085, leg=0.115, waist=0.578, crotch=0.470),
    "adult_round": dict(nom="Adulte rond", H=1.70, hh=0.340, hw=0.330, sh=0.455, wa=0.430, hi=0.440, arm=0.100, leg=0.138, waist=0.578, crotch=0.470),
    "elder_slim": dict(nom="Âgé menu", H=1.62, hh=0.335, hw=0.300, sh=0.350, wa=0.265, hi=0.300, arm=0.066, leg=0.092, waist=0.570, crotch=0.455, stoop=1),
    "elder_medium": dict(nom="Âgé moyen", H=1.62, hh=0.335, hw=0.312, sh=0.395, wa=0.335, hi=0.355, arm=0.080, leg=0.108, waist=0.570, crotch=0.455, stoop=1),
    "elder_round": dict(nom="Âgé rond", H=1.62, hh=0.335, hw=0.328, sh=0.425, wa=0.440, hi=0.445, arm=0.094, leg=0.130, waist=0.570, crotch=0.455, stoop=1),
}


def marks(b):
    """Repères verticaux (m) d'un gabarit."""
    H = b["H"]
    chin = H - b["hh"]
    collar = chin - 0.035
    return dict(top=H, chin=chin, collar=collar, shoulder=collar - 0.035, waist=b["waist"] * H,
                crotch=b["crotch"] * H, wrist=b["crotch"] * H + 0.035, knee=b["crotch"] * H * 0.54 + 0.03,
                ankle=0.10, hatline=H - b["hh"] * 0.36, eyes=H - b["hh"] * 0.56)


def figure(cx, gy, s, b, skin, hair, top, bottom, shoes, hair_style="short", face="neutral", nude=False,
           extra=""):
    """Personnage de face. cx: axe en px, gy: sol en px, s: px par mètre."""
    m = marks(b)
    X = lambda x: cx + x * s
    Y = lambda y: gy - y * s
    o = []
    sw = max(1.2, s * 0.006)
    st = f'stroke="{INK}" stroke-width="{sw:.2f}" stroke-linejoin="round" stroke-linecap="round"'
    under = "#E4DCCB"
    if nude:
        top = bottom = under
        shoes = skin
    # ombre de contact
    o.append(f'<ellipse cx="{cx}" cy="{gy + 2}" rx="{b["hi"] * s * 0.95:.1f}" ry="{s * 0.035:.1f}" fill="#000" opacity="0.13"/>')
    # jambes et chaussures
    lx = b["hi"] / 2 - b["leg"] / 2
    for side in (-1, 1):
        x0 = X(side * lx - b["leg"] / 2)
        leg_c = skin if nude else bottom
        o.append(f'<rect x="{x0:.1f}" y="{Y(m["crotch"] + 0.06):.1f}" width="{b["leg"] * s:.1f}" height="{(m["crotch"] + 0.06 - 0.05) * s:.1f}" rx="{b["leg"] * s * 0.42:.1f}" fill="{leg_c}" {st}/>')
        fw = b["leg"] * 1.25
        o.append(f'<path d="M{X(side * lx - fw / 2):.1f},{Y(0):.1f} L{X(side * lx + fw / 2):.1f},{Y(0):.1f} Q{X(side * lx + fw / 2):.1f},{Y(0.105):.1f} {X(side * lx):.1f},{Y(0.105):.1f} Q{X(side * lx - fw / 2):.1f},{Y(0.105):.1f} {X(side * lx - fw / 2):.1f},{Y(0):.1f} Z" fill="{shoes}" {st}/>')
    # bras (derrière le torse), pose de repos légèrement écartée
    ax = b["sh"] / 2 - b["arm"] * 0.35
    for side in (-1, 1):
        x1, y1 = X(side * ax), Y(m["shoulder"] - b["arm"] * 0.5)
        x2, y2 = X(side * (ax + 0.055)), Y(m["wrist"])
        o.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{INK}" stroke-width="{b["arm"] * s + 2 * sw:.1f}" stroke-linecap="round"/>')
        o.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{skin if nude else top}" stroke-width="{b["arm"] * s:.1f}" stroke-linecap="round"/>')
        o.append(f'<circle cx="{X(side * (ax + 0.062)):.1f}" cy="{Y(m["wrist"] - 0.055):.1f}" r="{b["arm"] * s * 0.56:.1f}" fill="{skin}" {st}/>')
    # bassin puis torse (formes gonflées)
    hw2, ww2, sw2 = b["hi"] / 2, b["wa"] / 2, b["sh"] / 2
    yc, yw, ys, yn = Y(m["crotch"] - 0.02), Y(m["waist"]), Y(m["shoulder"]), Y(m["collar"])
    o.append(f'<path d="M{X(-ww2):.1f},{yw:.1f} C{X(-hw2 * 1.08):.1f},{Y(m["waist"] - 0.08):.1f} {X(-hw2 * 1.05):.1f},{yc:.1f} {X(-hw2 * 0.55):.1f},{yc:.1f} L{X(hw2 * 0.55):.1f},{yc:.1f} C{X(hw2 * 1.05):.1f},{yc:.1f} {X(hw2 * 1.08):.1f},{Y(m["waist"] - 0.08):.1f} {X(ww2):.1f},{yw:.1f} Z" fill="{bottom}" {st}/>')
    belly = max(ww2, sw2 * 0.86) if b["wa"] > b["sh"] * 0.9 else (ww2 + sw2) / 2
    o.append(f'<path d="M{X(-0.045):.1f},{yn:.1f} C{X(-sw2 * 0.8):.1f},{yn:.1f} {X(-sw2):.1f},{Y(m["shoulder"] + 0.01):.1f} {X(-sw2):.1f},{Y(m["shoulder"] - 0.07):.1f} C{X(-belly * 1.04):.1f},{Y(m["waist"] + 0.18):.1f} {X(-belly * 1.06):.1f},{Y(m["waist"] + 0.02):.1f} {X(-ww2 * 1.02):.1f},{Y(m["waist"] - 0.035):.1f} L{X(ww2 * 1.02):.1f},{Y(m["waist"] - 0.035):.1f} C{X(belly * 1.06):.1f},{Y(m["waist"] + 0.02):.1f} {X(belly * 1.04):.1f},{Y(m["waist"] + 0.18):.1f} {X(sw2):.1f},{Y(m["shoulder"] - 0.07):.1f} C{X(sw2):.1f},{Y(m["shoulder"] + 0.01):.1f} {X(sw2 * 0.8):.1f},{yn:.1f} {X(0.045):.1f},{yn:.1f} Z" fill="{top}" {st}/>')
    # cou
    o.append(f'<rect x="{X(-0.043):.1f}" y="{Y(m["chin"] + 0.03):.1f}" width="{0.086 * s:.1f}" height="{(m["chin"] + 0.03 - m["collar"] + 0.012) * s:.1f}" rx="{0.02 * s:.1f}" fill="{skin}" {st}/>')
    if not nude:
        o.append(f'<path d="M{X(-0.06):.1f},{Y(m["collar"] + 0.012):.1f} Q{cx:.1f},{Y(m["collar"] - 0.03):.1f} {X(0.06):.1f},{Y(m["collar"] + 0.012):.1f}" fill="none" stroke="{INK}" stroke-width="{sw:.2f}"/>')
    # tête: calotte commune au-dessus de la ligne de chapeau, bas du visage propre au gabarit
    hcy = m["top"] - b["hh"] / 2
    stoop = b.get("stoop", 0) * 0.012
    hx = cx
    rx, ry = b["hw"] / 2 * s, b["hh"] / 2 * s
    for side in (-1, 1):
        o.append(f'<ellipse cx="{hx + side * rx * 0.98:.1f}" cy="{Y(hcy - 0.025 - stoop):.1f}" rx="{0.026 * s:.1f}" ry="{0.04 * s:.1f}" fill="{skin}" {st}/>')
    o.append(f'<ellipse cx="{hx:.1f}" cy="{Y(hcy - stoop):.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="{skin}" {st}/>')
    ey = Y(m["eyes"] - stoop)
    if hair_style != "none":
        hy = Y(m["top"] - stoop)
        if hair_style == "short":
            o.append(f'<path d="M{hx - rx * 1.04:.1f},{ey - ry * 0.12:.1f} C{hx - rx * 1.15:.1f},{hy - ry * 0.18:.1f} {hx + rx * 1.15:.1f},{hy - ry * 0.18:.1f} {hx + rx * 1.04:.1f},{ey - ry * 0.12:.1f} C{hx + rx * 0.7:.1f},{ey - ry * 0.55:.1f} {hx - rx * 0.2:.1f},{ey - ry * 0.7:.1f} {hx - rx * 0.55:.1f},{ey - ry * 0.38:.1f} C{hx - rx * 0.8:.1f},{ey - ry * 0.3:.1f} {hx - rx * 0.95:.1f},{ey - ry * 0.25:.1f} {hx - rx * 1.04:.1f},{ey - ry * 0.12:.1f} Z" fill="{hair}" {st}/>')
        elif hair_style == "bob":
            o.append(f'<path d="M{hx - rx * 1.12:.1f},{ey + ry * 0.62:.1f} C{hx - rx * 1.3:.1f},{hy - ry * 0.25:.1f} {hx + rx * 1.3:.1f},{hy - ry * 0.25:.1f} {hx + rx * 1.12:.1f},{ey + ry * 0.62:.1f} C{hx + rx * 0.92:.1f},{ey + ry * 0.5:.1f} {hx + rx * 0.98:.1f},{ey - ry * 0.3:.1f} {hx + rx * 0.5:.1f},{ey - ry * 0.5:.1f} C{hx:.1f},{ey - ry * 0.35:.1f} {hx - rx * 0.5:.1f},{ey - ry * 0.42:.1f} {hx - rx * 0.72:.1f},{ey - ry * 0.4:.1f} C{hx - rx * 0.98:.1f},{ey - ry * 0.2:.1f} {hx - rx * 0.92:.1f},{ey + ry * 0.5:.1f} {hx - rx * 1.12:.1f},{ey + ry * 0.62:.1f} Z" fill="{hair}" {st}/>')
        elif hair_style == "bun":
            o.append(f'<circle cx="{hx:.1f}" cy="{hy - ry * 0.12:.1f}" r="{rx * 0.42:.1f}" fill="{hair}" {st}/>')
            o.append(f'<path d="M{hx - rx * 1.04:.1f},{ey:.1f} C{hx - rx * 1.12:.1f},{hy - ry * 0.12:.1f} {hx + rx * 1.12:.1f},{hy - ry * 0.12:.1f} {hx + rx * 1.04:.1f},{ey:.1f} C{hx + rx * 0.6:.1f},{ey - ry * 0.6:.1f} {hx - rx * 0.6:.1f},{ey - ry * 0.6:.1f} {hx - rx * 1.04:.1f},{ey:.1f} Z" fill="{hair}" {st}/>')
        elif hair_style == "bald":
            for side in (-1, 1):
                o.append(f'<ellipse cx="{hx + side * rx * 0.96:.1f}" cy="{ey - ry * 0.1:.1f}" rx="{rx * 0.2:.1f}" ry="{ry * 0.3:.1f}" fill="{hair}" {st}/>')
    o.append(face_parts(hx, ey, rx, ry, face, sw, skin))
    o.append(extra)
    return "\n".join(o)


def face_parts(hx, ey, rx, ry, face, sw, skin):
    """Pièces du visage: yeux en perles, paupières, sourcils mobiles, bouche de rechange, nez en relief."""
    o = []
    dark = sum(int(skin[i:i + 2], 16) for i in (1, 3, 5)) < 300
    LINE = "#F3D3BC" if dark else INK
    ex, er = rx * 0.40, max(1.6, rx * 0.105)
    brow = {"neutral": (0, 0), "joy": (-0.06, 0), "surprise": (-0.22, 0), "worry": (-0.1, 14), "anger": (0.06, -16),
            "sleep": (0.02, 6), "sad": (-0.05, 16), "think": (-0.12, 8)}[face]
    for side in (-1, 1):
        cxe = hx + side * ex
        if face in ("joy",):
            o.append(f'<path d="M{cxe - er * 1.3:.1f},{ey + er * 0.3:.1f} Q{cxe:.1f},{ey - er * 1.5:.1f} {cxe + er * 1.3:.1f},{ey + er * 0.3:.1f}" fill="none" stroke="{LINE}" stroke-width="{sw * 1.7:.2f}" stroke-linecap="round"/>')
        elif face == "sleep":
            o.append(f'<path d="M{cxe - er * 1.3:.1f},{ey:.1f} Q{cxe:.1f},{ey + er * 1.3:.1f} {cxe + er * 1.3:.1f},{ey:.1f}" fill="none" stroke="{LINE}" stroke-width="{sw * 1.7:.2f}" stroke-linecap="round"/>')
        else:
            r = er * (1.25 if face == "surprise" else 1.0)
            o.append(f'<ellipse cx="{cxe:.1f}" cy="{ey:.1f}" rx="{r * 1.55:.1f}" ry="{r * 1.75:.1f}" fill="#F7F3EA" stroke="{INK}" stroke-width="{sw * 0.7:.2f}"/>')
            o.append(f'<ellipse cx="{cxe:.1f}" cy="{ey:.1f}" rx="{r:.1f}" ry="{r * 1.25:.1f}" fill="{INK}"/>')
            o.append(f'<circle cx="{cxe - r * 0.3:.1f}" cy="{ey - r * 0.45:.1f}" r="{r * 0.3:.1f}" fill="#fff"/>')
        by = ey - ry * 0.27 + brow[0] * ry
        rot = brow[1] * side
        o.append(f'<line x1="{cxe - er * 1.6:.1f}" y1="{by:.1f}" x2="{cxe + er * 1.6:.1f}" y2="{by:.1f}" stroke="{INK}" stroke-width="{sw * 2.0:.2f}" stroke-linecap="round" transform="rotate({rot} {cxe:.1f} {by:.1f})"/>')
    # nez: petit relief (ombre dessous, reflet dessus)
    ny = ey + ry * 0.2
    o.append(f'<ellipse cx="{hx:.1f}" cy="{ny:.1f}" rx="{rx * 0.11:.1f}" ry="{ry * 0.10:.1f}" fill="{skin}" stroke="{INK}" stroke-width="{sw * 0.8:.2f}" opacity="0.9"/>')
    my, mw = ey + ry * 0.47, rx * 0.26
    mouth = {
        "neutral": f'<path d="M{hx - mw:.1f},{my:.1f} Q{hx:.1f},{my + mw * 0.35:.1f} {hx + mw:.1f},{my:.1f}" fill="none" stroke="{LINE}" stroke-width="{sw * 1.6:.2f}" stroke-linecap="round"/>',
        "joy": f'<path d="M{hx - mw * 1.2:.1f},{my - mw * 0.2:.1f} Q{hx:.1f},{my + mw * 1.5:.1f} {hx + mw * 1.2:.1f},{my - mw * 0.2:.1f} Z" fill="{N["fixes"]["bouche"]}" stroke="{INK}" stroke-width="{sw * 1.2:.2f}" stroke-linejoin="round"/>',
        "surprise": f'<ellipse cx="{hx:.1f}" cy="{my + mw * 0.2:.1f}" rx="{mw * 0.5:.1f}" ry="{mw * 0.68:.1f}" fill="{N["fixes"]["bouche"]}" stroke="{INK}" stroke-width="{sw * 1.2:.2f}"/>',
        "worry": f'<path d="M{hx - mw:.1f},{my + mw * 0.2:.1f} Q{hx - mw * 0.5:.1f},{my - mw * 0.3:.1f} {hx:.1f},{my + mw * 0.1:.1f} Q{hx + mw * 0.5:.1f},{my + mw * 0.5:.1f} {hx + mw:.1f},{my:.1f}" fill="none" stroke="{LINE}" stroke-width="{sw * 1.6:.2f}" stroke-linecap="round"/>',
        "anger": f'<path d="M{hx - mw:.1f},{my + mw * 0.35:.1f} Q{hx:.1f},{my - mw * 0.35:.1f} {hx + mw:.1f},{my + mw * 0.35:.1f}" fill="none" stroke="{LINE}" stroke-width="{sw * 1.8:.2f}" stroke-linecap="round"/>',
        "sleep": f'<ellipse cx="{hx:.1f}" cy="{my + mw * 0.1:.1f}" rx="{mw * 0.3:.1f}" ry="{mw * 0.3:.1f}" fill="{N["fixes"]["bouche"]}" stroke="{INK}" stroke-width="{sw:.2f}"/>',
        "sad": f'<path d="M{hx - mw:.1f},{my + mw * 0.4:.1f} Q{hx:.1f},{my - mw * 0.3:.1f} {hx + mw:.1f},{my + mw * 0.4:.1f}" fill="none" stroke="{LINE}" stroke-width="{sw * 1.6:.2f}" stroke-linecap="round"/>',
        "think": f'<line x1="{hx - mw * 0.2:.1f}" y1="{my + mw * 0.1:.1f}" x2="{hx + mw * 0.9:.1f}" y2="{my - mw * 0.1:.1f}" stroke="{LINE}" stroke-width="{sw * 1.6:.2f}" stroke-linecap="round"/>',
    }[face]
    o.append(mouth)
    return "\n".join(o)


def text(x, y, t, size=16, weight="normal", anchor="middle", fill=INK, extra=""):
    return f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" fill="{fill}" {extra}>{t}</text>'


def svg(w, h, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
            f'<rect width="{w}" height="{h}" fill="{PAPER}"/>\n{body}\n</svg>\n')


def fr(v, d=2):
    return f"{v:.{d}f}".replace(".", ",")


def planche_proportions():
    W, Hh, s, gy = 2000, 900, 370, 760
    o = [text(W / 2, 46, "La Petite Ligne, refonte: gabarits des personnages (vue de face, cotes en mètres et en têtes)", 24, "bold")]
    # règle graduée
    x0 = 70
    for i in range(0, 19):
        y = gy - i * 0.1 * s
        big = i % 5 == 0
        o.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{W - 40}" y2="{y:.1f}" stroke="{INK}" stroke-width="{1 if big else 0.5}" opacity="{0.32 if big else 0.12}"/>')
        if big:
            o.append(text(x0 - 8, y + 5, fr(i * 0.1, 1) + " m", 14, anchor="end"))
    o.append(f'<line x1="{x0}" y1="{gy}" x2="{W - 40}" y2="{gy}" stroke="{INK}" stroke-width="2"/>')
    looks = {
        "child_slim": ("peche", "roux", "moutarde", "bleu_de_travail", "brique", "bob", "joy"),
        "child_round": ("noisette", "noir", "sauge", "noisette", "craie", "short", "neutral"),
        "adult_slim": ("dore", "brun", "craie", "canard", "chocolat", "bun", "neutral"),
        "adult_medium": ("porcelaine", "chatain", "ardoise", "marine", "chocolat", "short", "neutral"),
        "adult_round": ("acajou", "noir", "coquelicot", "anthracite", "encre", "bob", "joy"),
        "elder_slim": ("miel", "blanc", "lilas", "prune", "chocolat", "bun", "neutral"),
        "elder_medium": ("cannelle", "gris", "olive", "chocolat", "encre", "bald", "neutral"),
        "elder_round": ("porcelaine", "blanc", "rouille", "bouteille", "chocolat", "short", "joy"),
    }
    step = 222
    for i, (key, b) in enumerate(BODIES.items()):
        cx = 215 + i * step
        sk, ha, to, bo, shc, hs, fa = looks[key]
        o.append(figure(cx, gy, s, b, N["peaux"][sk], N["cheveux"][ha], N["tissus"][to], N["tissus"][bo], N["tissus"][shc], hs, fa))
        m = marks(b)
        # graduation en têtes, à gauche du personnage
        tx = cx - step / 2 + 14
        n = b["H"] / b["hh"]
        k = 0
        while k * b["hh"] < b["H"] - 1e-6:
            ya = gy - (b["H"] - k * b["hh"]) * s
            yb = gy - max(0, b["H"] - (k + 1) * b["hh"]) * s
            o.append(f'<line x1="{tx}" y1="{ya:.1f}" x2="{tx + 9}" y2="{ya:.1f}" stroke="{N["tissus"]["brique"]}" stroke-width="1.5"/>')
            o.append(text(tx + 4, (ya + yb) / 2 + 4, str(k + 1), 11, fill=N["tissus"]["brique"]))
            k += 1
        o.append(f'<line x1="{tx}" y1="{gy - b["H"] * s:.1f}" x2="{tx}" y2="{gy}" stroke="{N["tissus"]["brique"]}" stroke-width="1.5"/>')
        o.append(text(cx, gy + 34, b["nom"], 17, "bold"))
        o.append(text(cx, gy + 56, f'{fr(b["H"])} m, {fr(n, 1)} têtes', 14))
        o.append(text(cx, gy + 76, f'tête {fr(b["hh"] * 100, 0)} cm, carrure {fr(b["sh"] * 100, 0)} cm', 13))
        o.append(text(cx, gy + 95, f'taille {fr(b["wa"] * 100, 0)} cm, bassin {fr(b["hi"] * 100, 0)} cm', 13))
    # mannequin de 1,80 m
    mx = 215 + 8 * step - 40
    o.append(f'<rect x="{mx - 12}" y="{gy - 1.8 * s:.1f}" width="24" height="{1.8 * s:.1f}" fill="{N["tissus"]["perle"]}" stroke="{INK}" stroke-width="1.5"/>')
    o.append(text(mx, gy + 34, "Repère", 15, "bold"))
    o.append(text(mx, gy + 56, "1,80 m", 14))
    o.append(text(W / 2, Hh - 22, "Hauteurs au sommet du crâne, sans cheveux ni chapeau. Les adultes vont de 1,60 à 1,80 m par mise à l'échelle (0,94 à 1,06). Mêmes repères de couture pour toutes les corpulences d'un même âge.", 14))
    return svg(W, Hh, "\n".join(o))


def planche_emplacements():
    W, Hh, s, gy, cx = 2300, 1180, 560, 1070, 830
    b = BODIES["adult_medium"]
    m = marks(b)
    Y = lambda y: gy - y * s
    X = lambda x: cx + x * s
    acc = N["tissus"]["brique"]
    blue = N["tissus"]["bleu_de_travail"]
    o = [text(W / 2, 44, "Mannequin adulte moyen: emplacements, coutures cachées et couches d'encombrement", 24, "bold")]
    o.append(f'<line x1="440" y1="{gy}" x2="1220" y2="{gy}" stroke="{INK}" stroke-width="2"/>')
    o.append(figure(cx, gy, s, b, N["peaux"]["miel"], "#000", "", "", "", "none", "neutral", nude=True))
    # calotte commune et ligne de chapeau
    o.append(f'<line x1="{X(-0.30):.1f}" y1="{Y(m["hatline"]):.1f}" x2="{X(0.30):.1f}" y2="{Y(m["hatline"]):.1f}" stroke="{blue}" stroke-width="2.5" stroke-dasharray="10 6"/>')
    # coutures
    seams = [("collar", "Col: 1,33 m", -0.16, 0.16), ("waist", "Taille: 0,98 m", -0.27, 0.27), ("ankle", "Chevilles: 0,10 m", -0.27, 0.27)]
    for key, lab, xa, xb in seams:
        o.append(f'<line x1="{X(xa):.1f}" y1="{Y(m[key]):.1f}" x2="{X(xb):.1f}" y2="{Y(m[key]):.1f}" stroke="{acc}" stroke-width="3"/>')
    ax = b["sh"] / 2 - b["arm"] * 0.35 + 0.055
    for side in (-1, 1):
        o.append(f'<line x1="{X(side * (ax - 0.075)):.1f}" y1="{Y(m["wrist"] + 0.012):.1f}" x2="{X(side * (ax + 0.075)):.1f}" y2="{Y(m["wrist"] - 0.012 * 0):.1f}" stroke="{acc}" stroke-width="3"/>')

    def call(y, label, sub, side=1, x_from=0.0, color=INK, dy=0):
        xa = X(x_from)
        xb = 1210 if side > 0 else 450
        yy = Y(y)
        o.append(f'<line x1="{xa:.1f}" y1="{yy:.1f}" x2="{xb}" y2="{yy + dy:.1f}" stroke="{color}" stroke-width="1.3"/>')
        o.append(f'<circle cx="{xa:.1f}" cy="{yy:.1f}" r="4" fill="{color}"/>')
        anchor = "start" if side > 0 else "end"
        tx = xb + (8 if side > 0 else -8)
        o.append(text(tx, yy + dy - 2, label, 17, "bold", anchor, color))
        o.append(text(tx, yy + dy + 18, sub, 13.5, "normal", anchor, color))

    call(m["top"] + 0.05, "hat (chapeau, coiffe)", "posé sur la calotte commune", 1, 0.0, blue)
    call(m["hatline"], "ligne de chapeau: 1,58 m", "au-dessus, même crâne pour toutes les têtes", -1, -0.30, blue)
    call(m["top"] - 0.03, "hair (cheveux)", "variante « _hat » rasée au-dessus de la ligne", -1, -0.10, INK, -40)
    call(m["eyes"], "glasses (lunettes)", "branches sur les oreilles, pont sur le nez", 1, 0.07)
    call(m["eyes"] - 0.065, "head, nose, eyes, brows, mouth", "tête en relief, pièces du visage", -1, -0.02, INK, 30)
    call(m["chin"] + 0.02, "facial_hair (barbe, moustache)", "", 1, 0.06, INK, 14)
    call(m["collar"], "couture du col", "le col du haut recouvre la base du cou", 1, 0.16, acc, 26)
    call(m["collar"] - 0.045, "neck (écharpe, foulard, cravate)", "", -1, -0.05, INK, 10)
    call(m["shoulder"] - 0.10, "top (haut), puis outer (veste) par-dessus", "couche 1: 1 à 2,5 cm; couche 2: 2,5 à 5 cm", 1, 0.10, INK, 30)
    call(m["shoulder"] - 0.16, "back (sac à dos), side (besace)", "sangles moulées sur la couche portée", -1, -0.17)
    call(m["waist"], "couture de la taille", "le haut tombe 5 cm sous la taille, ou la ceinture monte", 1, 0.27, acc)
    call(m["waist"] - 0.07, "waist (tablier, ceinture, banane)", "", -1, -0.14, INK, 12)
    call(m["wrist"], "couture des poignets", "bord de manche épais; la main est toujours du corps", 1, ax + 0.075, acc, 46)
    call(m["crotch"] - 0.14, "bottom (pantalon, short, jupe, salopette)", "une robe occupe « top » et « bottom »", -1, -0.10)
    call(m["knee"], "genou: 0,46 m", "longueurs: short au-dessus, jupe midi dessous", 1, 0.14)
    call(m["ankle"], "couture des chevilles", "le bas tombe sur la chaussure, ou la botte monte", 1, 0.27, acc, -8)
    call(0.045, "shoes (chaussures)", "le pied nu n'existe pas hors de l'éditeur", -1, -0.10, INK, -6)

    # coupe du torse: couches
    ox, oy = 1930, 300
    o.append(text(ox, 110, "Coupe du torse vue du dessus: les couches", 20, "bold"))
    layers = [(182, 118, N["tissus"]["perle"], "sangle de sac: + 5 à 6 cm"), (166, 104, N["tissus"]["ardoise"], "couche 2, outer: + 2,5 à 5 cm"),
              (148, 88, N["tissus"]["moutarde"], "couche 1, top: + 1 à 2,5 cm"), (132, 74, N["peaux"]["miel"], "corps (masqué sous le vêtement)")]
    for i, (rx, ry, col, lab) in enumerate(layers):
        o.append(f'<ellipse cx="{ox}" cy="{oy}" rx="{rx}" ry="{ry}" fill="{col}" stroke="{INK}" stroke-width="2"/>')
        yy = 460 + i * 30
        o.append(f'<rect x="{ox - 190}" y="{yy - 14}" width="22" height="18" fill="{col}" stroke="{INK}" stroke-width="1.5"/>')
        o.append(text(ox - 158, yy, lab, 15, anchor="start"))
    o.append(text(ox, oy + 6, "corps", 14))
    rules = ["Règles d'emboîtement", "1. Chaque pièce tient dans le volume de son emplacement.",
             "2. Une pièce masque les sections du corps qu'elle couvre", "   (torse, bras, avant-bras, bassin, cuisses, jambes).",
             "3. Une couture est toujours cachée par un bord épais:", "   col, ourlet, poignet, revers, tige de botte.",
             "4. Au-dessus de la ligne de chapeau, toutes les têtes ont", "   le même crâne: tout chapeau va à tout le monde.",
             "5. Mains, cou et tête ne sont jamais couverts par un haut:", "   gants, cols roulés et capuches sont des pièces à part.",
             "6. Couleurs par emplacement de couleur (principale,", "   secondaire, motif), jamais par texture."]
    for i, r in enumerate(rules):
        o.append(text(ox - 190, 630 + i * 27, r, 17 if i == 0 else 15, "bold" if i == 0 else "normal", "start"))
    o.append(text(ox - 190, 1010, "Rouge: coutures cachées. Bleu: calotte commune.", 15, "normal", "start", acc))
    o.append(text(ox - 190, 1036, "Pose de référence des pièces: bras écartés à 40 degrés", 15, "normal", "start"))
    o.append(text(ox - 190, 1058, "(pose en A), à confirmer par l'essai du tech-artist.", 15, "normal", "start"))
    return svg(W, Hh, "\n".join(o))


def onomato(x, y, t, color, rot=-8, size=74):
    st = f'font-family="{FONT}" font-size="{size}" font-weight="bold" text-anchor="middle" transform="rotate({rot} {x} {y})"'
    return (f'<text x="{x + 4}" y="{y + 5}" {st} fill="{INK}" stroke="{INK}" stroke-width="15" stroke-linejoin="round" opacity="0.25">{t}</text>'
            f'<text x="{x}" y="{y}" {st} fill="{INK}" stroke="{INK}" stroke-width="15" stroke-linejoin="round">{t}</text>'
            f'<text x="{x}" y="{y}" {st} fill="#FFF8E8" stroke="#FFF8E8" stroke-width="5" stroke-linejoin="round">{t}</text>'
            f'<text x="{x}" y="{y}" {st} fill="{color}">{t}</text>')


def planche_expressions():
    W, Hh = 2000, 1240
    T = N["tissus"]
    o = [text(W / 2, 44, "Visages en relief à pièces de rechange, onomatopées et nuancier", 24, "bold")]
    faces = [("neutral", "neutre"), ("joy", "joie"), ("surprise", "surprise"), ("think", "réflexion"), ("worry", "gêne"),
             ("sad", "peine"), ("anger", "colère"), ("sleep", "sommeil")]
    signs = ["", "♪", "!", "...", "?!", "snif", "grr", "Zzz"]
    cols = [T["moutarde"], T["moutarde"], T["coquelicot"], T["perle"], T["ardoise"], T["ciel"], T["brique"], T["lilas"]]
    b = BODIES["adult_medium"]
    s = 520
    skins = list(N["peaux"].values())
    hairs = ["chatain", "noir", "roux", "blond_miel", "brun", "gris", "auburn", "blanc"]
    styles = ["short", "bob", "bun", "short", "bob", "bald", "short", "bun"]
    for i, (f, lab) in enumerate(faces):
        cx = 150 + i * 243
        gy = 232 + 1.70 * s
        clip = f'<clipPath id="c{i}"><rect x="{cx - 120}" y="150" width="240" height="282"/></clipPath>'
        o.append(clip)
        o.append(f'<g clip-path="url(#c{i})">' + figure(cx, gy, s, b, skins[i], N["cheveux"][hairs[i]], T[["ardoise", "moutarde", "sauge", "craie", "rose_ancien", "olive", "marine", "lilas"][i]], T["marine"], T["chocolat"], styles[i], f) + "</g>")
        if signs[i]:
            o.append(onomato(cx + 70, 150, signs[i], cols[i], -8 if i % 2 else 7, 58 if len(signs[i]) < 3 else 44))
        o.append(text(cx, 462, lab, 17, "bold"))
    o.append(text(W / 2, 496, "La tête ne se déforme pas: les sourcils bougent, les paupières se ferment, la bouche est remplacée (8 bouches en relief), comme sur une figurine d'animation en volume.", 15))
    # onomatopées
    o.append(text(60, 548, "Onomatopées (lettrage du studio, liseré clair et cerne d'encre, une couleur et une forme par famille)", 19, "bold", "start"))
    row = [("!", T["coquelicot"], "surprise, remarque"), ("!!!", T["coquelicot"], "alarme, choc"), ("?", T["ardoise"], "question"),
           ("??", T["ardoise"], "perplexité"), ("?!", T["prune"], "incrédulité"), ("...", T["perle"], "attente, silence"),
           ("♪", T["moutarde"], "joie, sifflote"), ("♥", T["rose_ancien"], "tendresse, amitié"), ("Zzz", T["lilas"], "sommeil"),
           ("grr", T["brique"], "colère"), ("pff", T["olive"], "lassitude, odeur"), ("ha ha", T["moutarde"], "rire")]
    for i, (t, c, lab) in enumerate(row):
        x = 120 + i * 160
        o.append(onomato(x, 660, t, c, -9 if i % 2 == 0 else 6, 70 if len(t) <= 3 else 46))
        o.append(text(x, 716, lab, 13.5))
    # nuancier
    y0 = 770
    for fam, title, keys in (("peaux", "Peaux (8)", None), ("cheveux", "Cheveux (10, plus 3 teintes réservées aux joueurs)", None), ("tissus", "Tissus (24)", None)):
        items = list(N[fam].items())
        if fam == "cheveux":
            items += list(N["cheveux_joueurs"].items())
        o.append(text(60, y0, title, 18, "bold", "start"))
        w = 76
        for i, (k, v) in enumerate(items):
            x = 60 + i * (w + 3)
            o.append(f'<rect x="{x}" y="{y0 + 14}" width="{w}" height="62" rx="12" fill="{v}" stroke="{INK}" stroke-width="1.5"/>')
            o.append(text(x + w / 2, y0 + 92, k.replace("_", " "), 10.5))
            o.append(text(x + w / 2, y0 + 106, v, 10))
        y0 += 150
    return svg(W, Hh, "\n".join(o))


if __name__ == "__main__":
    out = sys.argv[1]
    for name, fn in (("01-gabarits", planche_proportions), ("02-emplacements", planche_emplacements), ("03-visages-onomatopees-nuancier", planche_expressions)):
        with open(os.path.join(out, name + ".svg"), "w", encoding="utf-8") as f:
            f.write(fn())
